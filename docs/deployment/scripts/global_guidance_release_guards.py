"""Pure evidence checks for the reviewed schema 55 -> 57 guidance release.

Callers collect manifests; this module performs no I/O or production operations.
"""

import hashlib
import ipaddress
import re
from urllib.parse import urlsplit


NEW_TABLE_COUNTS = {
    'global_assistant_bindings': 0,
    'global_assistant_legacy_executions': 0,
    'global_assistant_changes': 0,
    'assistant_knowledge_visibility': 1,
    'assistant_knowledge_articles': 0,
    'assistant_knowledge_revisions': 0,
    'assistant_knowledge_jobs': 0,
    'assistant_knowledge_chunks': 0,
    'assistant_knowledge_operations': 0,
    'assistant_knowledge_audit': 0,
}


def assert_migrations_preserved(before, after, migration_bytes):
    """Preserve every historical SQLx row and append the two audited byte hashes."""
    assert before and all(str(int(version)) == version and int(version) <= 55 for version in before), 'Invalid migration baseline'
    assert max(map(int, before)) == 55, 'Release requires schema 55'
    assert set(migration_bytes) == {'56', '57'}, 'Expected audited migration 56 and 57 bytes'
    assert set(after) == set(before) | {'56', '57'}, 'Unexpected migration set'
    assert all(after[version] == row for version, row in before.items()), 'Historical migration row changed'
    for version, source in migration_bytes.items():
        assert after[version]['success'] is True, 'New migration did not succeed'
        assert after[version]['checksum'] == hashlib.sha384(source).hexdigest(), 'Migration checksum differs from audited source bytes'


def assert_business_preserved(before, after, *, conversation_columns_before,
                              conversation_columns_after, nonzero_global_change_sequences,
                              expected_new_counts=None, observation_retention=None):
    """Compare row fingerprints, projecting only the newly added conversation column.

    Both conversation fingerprints must describe the original columns: collect the
    post-migration digest using ``to_jsonb(r) - 'global_change_sequence'``. SQLx
    rows are verified separately by ``assert_migrations_preserved``.
    """
    assert before and {'tavern_conversations', '_sqlx_migrations'} <= set(before), 'Incomplete business baseline'
    assert not set(before) & set(NEW_TABLE_COUNTS), 'New tables already exist in baseline'
    assert set(after) == set(before) | set(NEW_TABLE_COUNTS), 'Unexpected business table set'
    assert conversation_columns_before and 'global_change_sequence' not in conversation_columns_before, 'Invalid conversation column baseline'
    assert list(conversation_columns_after) == list(conversation_columns_before) + ['global_change_sequence'], 'Conversation schema changed beyond the new cursor'
    assert nonzero_global_change_sequences == 0, 'Existing conversation cursor was advanced'
    separately_verified = {'_sqlx_migrations'}
    if observation_retention is not None:
        retention = assert_observation_retention(**observation_retention)
        assert before.get('request_observations') == retention['before'] and after.get('request_observations') == retention['after'], 'Retention row evidence does not match table fingerprints'
        separately_verified.add('request_observations')
    changed = [name for name in before if name not in separately_verified and before[name] != after[name]]
    assert not changed, 'Existing business rows changed: ' + ','.join(changed)
    expected = NEW_TABLE_COUNTS if expected_new_counts is None else expected_new_counts
    assert set(expected) == set(NEW_TABLE_COUNTS), 'New-table count manifest must cover exactly the reviewed ten tables'
    assert all(type(count) is int and count >= 0 for count in expected.values()), 'Invalid new-table count'
    assert all(after[name]['count'] == count for name, count in expected.items()), 'Unexpected rows in new tables'


def assert_observation_retention(before_rows, after_rows, expired_ids, max_count=20000):
    """Bind explicit retention approval to complete before/after row fingerprints.

    Rows map request_id to PostgreSQL ``md5(to_jsonb(r)::text)``. The caller
    first audits expired_ids against the existing age and cap ordering policy.
    A caller may explicitly use 20099 during the writer's 100-write prune cycle.
    This check never grants a blanket exception for request_observations.
    """
    assert type(max_count) is int and max_count > 0, 'Invalid observation retention cap'
    expired = set(expired_ids)
    assert len(expired) == len(expired_ids), 'Duplicate retention approval'
    assert set(before_rows) - set(after_rows) == expired, 'Observation deletion differs from explicitly audited IDs'
    assert expired <= set(before_rows), 'Retention approval refers to unknown observations'
    assert all(after_rows[request] == digest for request, digest in before_rows.items() if request not in expired), 'Surviving observation row changed'
    assert len(after_rows) <= max_count, 'Observation count exceeds the approved retention bound'
    snapshots = {}
    for name, rows in [('before', before_rows), ('after', after_rows)]:
        assert all(re.fullmatch('[a-f0-9]{32}', digest) for digest in rows.values()), 'Invalid observation row digest'
        snapshots[name] = {'count': len(rows), 'digest': hashlib.md5(''.join(sorted(rows.values())).encode('ascii')).hexdigest()}
    return snapshots


def assert_reconciliation_preserved(before, after):
    """Allow only the same durable unowned unknown-outcome executions.

    ``row_digest`` covers the complete agent_executions row, rather than only
    the displayed state. Business fingerprints independently cover call rows.
    """
    required = {'account_id', 'execution_id', 'row_digest', 'state', 'owner_id',
                'lease_expires_at', 'reason', 'unknown_calls', 'dispatched_calls'}
    snapshots = []
    for executions in (before, after):
        indexed = {}
        for execution in executions:
            assert required <= set(execution), 'Incomplete execution evidence'
            assert execution['execution_id'] and execution['account_id'] and execution['row_digest'], 'Missing complete execution identity'
            assert execution['execution_id'] not in indexed, 'Duplicate execution identity'
            assert (execution['state'] == 'awaiting_reconciliation'
                    and execution['owner_id'] is None and execution['lease_expires_at'] is None
                    and execution['reason'] == 'external_outcome_unknown'
                    and execution['unknown_calls'] > 0 and execution['dispatched_calls'] == 0), 'Active or recoverable Agent execution; defer cutover'
            indexed[execution['execution_id']] = execution
        snapshots.append(indexed)
    assert snapshots[0] == snapshots[1], 'Existing reconciliation identity or state changed'


def assert_runtime_config(before, after, *, knowledge_url, revision_labels):
    """Check normalized settings with value-bearing environment and label maps.

    Exclude Docker-generated container identity/timestamps from these settings;
    include mounts, networks, limits, restart policy and security configuration.
    """
    origin = urlsplit(knowledge_url)
    try:
        private = origin.hostname == 'localhost' or ipaddress.ip_address(origin.hostname).is_loopback
    except ValueError:
        private = False
    assert (origin.scheme == 'http' and private and origin.port
            and not origin.username and not origin.password and not origin.query
            and not origin.fragment and origin.path in ('', '/')), 'Knowledge URL must name the private loopback service'
    allowed_labels = {'org.opencontainers.image.revision', 'org.opencontainers.image.version',
                      'com.mapflow.frontend.revision', 'dev.mapflow.frontend.revision'}
    assert 'org.opencontainers.image.revision' in revision_labels and set(revision_labels) <= allowed_labels, 'Unexpected revision label changes'
    assert revision_labels['org.opencontainers.image.revision'] != before['labels'].get('org.opencontainers.image.revision'), 'Backend revision was not updated'
    assert set(before) == set(after) and {'environment', 'labels'} <= set(before), 'Runtime setting set changed'
    assert all(before[name] == after[name] for name in before if name not in {'environment', 'labels'}), 'Existing runtime settings changed'
    assert 'MAPFLOW_KNOWLEDGE_WORKER_URL' not in before['environment'], 'Worker URL unexpectedly exists in baseline'
    assert after['environment'] == {**before['environment'], 'MAPFLOW_KNOWLEDGE_WORKER_URL': knowledge_url}, 'Unreviewed runtime environment changes'
    assert after['labels'] == {**before['labels'], **revision_labels}, 'Unreviewed image label changes'


def assert_runtime_files(before, after, expected):
    """Require the complete frozen runtime, retaining Node and upgrading the worker."""
    node = '/usr/local/bin/node'
    upgraded = {'/usr/local/bin/mapflow-server',
                '/opt/mapflow/harness-worker/dist/harness.js',
                '/opt/mapflow/harness-worker/dist/model-context.js'}
    required = upgraded | {node, '/usr/local/bin/mapflow-admin', '/opt/mapflow/harness-worker/dist/main.js'}
    assert required <= set(before) and set(before) <= set(expected), 'Existing runtime file disappeared'
    assert after == expected, 'Runtime files differ from the complete frozen manifest'
    assert expected[node] == before[node], 'Unreviewed Node binary update'
    assert all(expected[path] != before[path] for path in upgraded), 'Reviewed server or worker update was omitted'


def assert_model_sidecar(container, app_id, health, expected_health):
    """Check raw Docker inspect evidence and the frozen inference health response."""
    host = container['HostConfig']
    assert app_id and host['NetworkMode'] == 'container:' + app_id, 'Inference does not share the application network namespace'
    assert not host.get('PortBindings') and not host.get('PublishAllPorts'), 'Inference publishes host ports'
    assert not any(container.get('NetworkSettings', {}).get('Ports', {}).values()), 'Inference has published port mappings'
    assert host['ReadonlyRootfs'] is True and set(host.get('CapDrop') or []) == {'ALL'}, 'Inference filesystem or capabilities are not restricted'
    assert not host.get('Privileged') and not host.get('CapAdd'), 'Inference has elevated privileges'
    assert set(host.get('SecurityOpt') or []) & {'no-new-privileges', 'no-new-privileges:true'}, 'Inference can gain privileges'
    user_parts = container['Config'].get('User', '').split(':')
    assert 1 <= len(user_parts) <= 2 and all(part.isdecimal() and int(part) > 0 for part in user_parts), 'Inference must run with an explicit non-root user and group'
    assert not any(mount.get('RW') for mount in container.get('Mounts', []) if mount.get('Type') in {'bind', 'volume'}), 'Inference assets are writable'
    assert container['State']['Running'] is True, 'Inference container is not running'
    assert expected_health.get('ready') is True and expected_health.get('providers') == ['CPUExecutionProvider'], 'Frozen inference identity is not CPU-ready'
    assert expected_health.get('spaceId') == '785d7d1f0f013aa4679042e683fc3f31f1dcc1fbca2edbaa0bf81786c805193b', 'Frozen embedding space differs from the reviewed public assets'
    assert health == expected_health, 'Inference health differs from the frozen model identity'


def assert_postgres_compatible(before, after, rollback):
    """Permit vector capability only; preserve baseline PostgreSQL and its settings.

    Evidence contains ``version``, ``binaries`` (path -> SHA-256), ``settings``,
    ``available_extensions`` and ``installed_extensions`` (name -> version).
    Existing available vector versions remain unchanged, including 0.8.2.
    """
    required = {'version', 'binaries', 'settings', 'available_extensions', 'installed_extensions'}
    assert required <= set(before) and before['version'] and before['binaries'] and before['settings'], 'Incomplete PostgreSQL baseline'
    for current in (after, rollback):
        assert set(current) == set(before), 'PostgreSQL evidence set changed'
        assert all(current[name] == before[name] for name in before if name not in {'available_extensions', 'installed_extensions'}), 'PostgreSQL binaries, version or settings changed'
        available = current['available_extensions']
        assert 'vector' in available and available['vector'], 'Vector binaries are unavailable'
        assert available == {**before['available_extensions'], 'vector': available['vector']}, 'Other available extensions changed'
        if 'vector' in before['available_extensions']:
            assert available['vector'] == before['available_extensions']['vector'], 'Existing vector capability was replaced'
        installed = current['installed_extensions']
        assert installed == {**before['installed_extensions'], 'vector': available['vector']}, 'Unexpected installed extension changes or missing vector'
        if 'vector' in before['installed_extensions']:
            assert installed['vector'] == before['installed_extensions']['vector'], 'Installed vector was upgraded without review'
    assert rollback['available_extensions'] == after['available_extensions'] and rollback['installed_extensions'] == after['installed_extensions'], 'Rollback loses vector compatibility'
