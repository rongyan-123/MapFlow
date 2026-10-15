import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest


SOURCE = Path(__file__).parents[1] / 'global_guidance_release_guards.py'
spec = importlib.util.spec_from_file_location('global_guidance_release_guards', SOURCE)
guards = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guards)


class GlobalGuidanceReleaseGuards(unittest.TestCase):
    def business_evidence(self):
        before = {
            'accounts': {'count': 2, 'digest': 'accounts unchanged'},
            'agent_model_call_receipts': {'count': 4, 'digest': 'billing unchanged'},
            'tavern_conversations': {'count': 3, 'digest': 'old columns unchanged'},
            'request_observations': {'count': 20, 'digest': 'request history unchanged'},
            '_sqlx_migrations': {'count': 55, 'digest': 'old SQLx rows'},
        }
        new_counts = {
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
        after = {
            **before,
            '_sqlx_migrations': {'count': 57, 'digest': 'separately audited SQLx rows'},
            **{name: {'count': count, 'digest': 'migration-created table'} for name, count in new_counts.items()},
        }
        evidence = {
            'conversation_columns_before': ['account_id', 'conversation_id', 'scene'],
            'conversation_columns_after': ['account_id', 'conversation_id', 'scene', 'global_change_sequence'],
            'nonzero_global_change_sequences': 0,
        }
        return before, after, evidence, new_counts

    def test_migrations_only_append_successful_56_and_57_from_exact_source_bytes(self):
        before = {'55': {'checksum': '55hash', 'digest': 'old migration row'}}
        sources = {'56': b'-- reviewed migration 56\r\n', '57': b'-- reviewed migration 57\n'}
        after = {
            **before,
            '56': {'checksum': hashlib.sha384(sources['56']).hexdigest(), 'success': True},
            '57': {'checksum': hashlib.sha384(sources['57']).hexdigest(), 'success': True},
        }
        guards.assert_migrations_preserved(before, after, sources)
        invalid = []
        for version in ('55', '56', '57'):
            missing = copy.deepcopy(after)
            del missing[version]
            invalid.append(missing)
        changed_history = copy.deepcopy(after)
        changed_history['55']['digest'] = 'historical execution time changed'
        invalid.append(changed_history)
        invalid.append({**after, '58': {'checksum': 'unexpected'}})
        failed = copy.deepcopy(after)
        failed['57']['success'] = False
        invalid.append(failed)
        for snapshot in invalid:
            with self.subTest(snapshot=snapshot), self.assertRaises(AssertionError):
                guards.assert_migrations_preserved(before, snapshot, sources)
        with self.assertRaises(AssertionError):
            guards.assert_migrations_preserved(before, after, {**sources, '56': sources['56'].replace(b'\r\n', b'\n')})
        with self.assertRaises(AssertionError):
            guards.assert_migrations_preserved({'54': before['55']}, after, sources)

    def test_business_gate_preserves_all_old_rows_and_only_adds_reviewed_tables(self):
        before, after, evidence, _ = self.business_evidence()
        guards.assert_business_preserved(before, after, **evidence)
        for table in before:
            if table == '_sqlx_migrations':
                continue
            changed = copy.deepcopy(after)
            changed[table]['digest'] = 'a previously existing row was edited'
            with self.subTest(table=table), self.assertRaises(AssertionError):
                guards.assert_business_preserved(before, changed, **evidence)
        missing = copy.deepcopy(after)
        del missing['global_assistant_legacy_executions']
        for invalid in [missing, {**after, 'surprise_table': {'count': 0, 'digest': 'empty'}}]:
            with self.subTest(invalid=invalid), self.assertRaises(AssertionError):
                guards.assert_business_preserved(before, invalid, **evidence)

    def test_conversation_projection_cannot_hide_another_added_or_removed_column_or_nonzero_cursor(self):
        before, after, evidence, _ = self.business_evidence()
        for change in [
            {'conversation_columns_after': evidence['conversation_columns_after'] + ['hidden_write']},
            {'conversation_columns_after': ['account_id', 'conversation_id', 'global_change_sequence']},
            {'nonzero_global_change_sequences': 1},
        ]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                guards.assert_business_preserved(before, after, **{**evidence, **change})

    def test_seed_counts_require_an_explicit_complete_manifest(self):
        before, after, evidence, new_counts = self.business_evidence()
        seeded_counts = {**new_counts, 'assistant_knowledge_articles': 9, 'assistant_knowledge_revisions': 9, 'assistant_knowledge_audit': 9}
        seeded = {**after, **{name: {'count': count, 'digest': 'review drafts'} for name, count in seeded_counts.items()}}
        with self.assertRaises(AssertionError):
            guards.assert_business_preserved(before, seeded, **evidence)
        guards.assert_business_preserved(before, seeded, **evidence, expected_new_counts=seeded_counts)
        for invalid in [{'assistant_knowledge_articles': 9}, {**seeded_counts, 'surprise_table': 0}]:
            with self.subTest(invalid=invalid), self.assertRaises(AssertionError):
                guards.assert_business_preserved(before, seeded, **evidence, expected_new_counts=invalid)

    def test_unowned_unknown_executions_survive_with_complete_identity_and_status_unchanged(self):
        pending = {
            'account_id': 'account-original', 'execution_id': 'execution-original',
            'row_digest': 'entire execution row including result and settlement identity',
            'state': 'awaiting_reconciliation', 'owner_id': None, 'lease_expires_at': None,
            'reason': 'external_outcome_unknown', 'unknown_calls': 2, 'dispatched_calls': 0,
        }
        before = [{**pending, 'execution_id': f'execution-{index}'} for index in range(4)]
        guards.assert_reconciliation_preserved(before, list(reversed(copy.deepcopy(before))))
        for change in [
            {'state': 'running'}, {'state': 'queued'}, {'state': 'reconciling'},
            {'owner_id': 'worker'}, {'lease_expires_at': '2026-10-15T20:00:00Z'},
            {'reason': 'retry_needed'}, {'unknown_calls': 0}, {'dispatched_calls': 1},
            {'row_digest': 'result was silently modified'}, {'account_id': 'different-account'},
            {'execution_id': 'reused-identity'},
        ]:
            changed = copy.deepcopy(before)
            changed[0].update(change)
            with self.subTest(change=change), self.assertRaises(AssertionError):
                guards.assert_reconciliation_preserved(before, changed)
        for invalid in [before[1:], before + [{**pending, 'execution_id': 'newly-queued'}], before + [before[0]]]:
            with self.subTest(invalid=invalid), self.assertRaises(AssertionError):
                guards.assert_reconciliation_preserved(before, invalid)
        for change in [{'state': 'running'}, {'owner_id': 'old-worker'}, {'unknown_calls': 0}]:
            active_baseline = [{**pending, **change}]
            with self.subTest(active_baseline=active_baseline), self.assertRaises(AssertionError):
                guards.assert_reconciliation_preserved(active_baseline, active_baseline)
        incomplete = {key: value for key, value in pending.items() if key != 'row_digest'}
        with self.assertRaises(AssertionError):
            guards.assert_reconciliation_preserved([incomplete], [incomplete])

    def test_runtime_config_only_adds_the_private_worker_url_and_frozen_image_revisions(self):
        before = {
            'environment': {'MAPFLOW_GENERATION_RUNTIME': 'harness', 'MAPFLOW_DATABASE_URL_FILE': '/run/secrets/database.url'},
            'labels': {'org.opencontainers.image.revision': 'old-backend', 'com.mapflow.source.branch': 'main'},
            'user': '10001:10001', 'readonly': True, 'memory': 1073741824,
            'mounts': [{'source': '/private/existing', 'destination': '/run/secrets/database.url', 'writable': False}],
            'networks': ['production'], 'restart': {'Name': 'unless-stopped'},
        }
        revisions = {'org.opencontainers.image.revision': 'new-backend', 'com.mapflow.frontend.revision': 'new-frontend'}
        after = {
            **before,
            'environment': {**before['environment'], 'MAPFLOW_KNOWLEDGE_WORKER_URL': 'http://127.0.0.1:18219'},
            'labels': {**before['labels'], **revisions},
        }
        arguments = {'knowledge_url': 'http://127.0.0.1:18219', 'revision_labels': revisions}
        guards.assert_runtime_config(before, after, **arguments)
        invalid = []
        for field, value in [('user', '0'), ('readonly', False), ('memory', 2147483648), ('networks', ['other']), ('mounts', [])]:
            invalid.append({**after, field: value})
        for environment in [
            {**after['environment'], 'MAPFLOW_DATABASE_URL_FILE': '/other/db'},
            {**after['environment'], 'UNREVIEWED_FLAG': 'enabled'},
            before['environment'],
        ]:
            invalid.append({**after, 'environment': environment})
        invalid.append({**after, 'labels': {**after['labels'], 'com.mapflow.source.branch': 'development'}})
        for snapshot in invalid:
            with self.subTest(snapshot=snapshot), self.assertRaises(AssertionError):
                guards.assert_runtime_config(before, snapshot, **arguments)
        public = {**after, 'environment': {**after['environment'], 'MAPFLOW_KNOWLEDGE_WORKER_URL': 'http://external.example:18219'}}
        with self.assertRaises(AssertionError):
            guards.assert_runtime_config(before, public, **{**arguments, 'knowledge_url': 'http://external.example:18219'})
        with self.assertRaises(AssertionError):
            guards.assert_runtime_config(before, after, **{**arguments, 'revision_labels': {**revisions, 'com.mapflow.source.branch': 'main'}})

    def test_runtime_files_use_the_frozen_new_worker_and_preserve_node_and_existing_paths(self):
        before = {
            '/usr/local/bin/mapflow-server': 'a' * 64,
            '/usr/local/bin/mapflow-admin': 'b' * 64,
            '/usr/local/bin/node': 'c' * 64,
            '/opt/mapflow/harness-worker/dist/main.js': 'd' * 64,
            '/opt/mapflow/harness-worker/dist/harness.js': 'e' * 64,
            '/opt/mapflow/harness-worker/dist/model-context.js': 'f' * 64,
            '/opt/mapflow/harness-worker/node_modules/existing/index.js': '1' * 64,
        }
        expected = {
            **before,
            '/usr/local/bin/mapflow-server': '2' * 64,
            '/usr/local/bin/mapflow-admin': '3' * 64,
            '/opt/mapflow/harness-worker/dist/harness.js': '4' * 64,
            '/opt/mapflow/harness-worker/dist/model-context.js': '5' * 64,
            '/opt/mapflow/harness-worker/dist/knowledge-context.js': '6' * 64,
        }
        guards.assert_runtime_files(before, copy.deepcopy(expected), expected)
        changed = {**expected, '/opt/mapflow/harness-worker/dist/knowledge-context.js': '7' * 64}
        extra = {**expected, '/opt/mapflow/harness-worker/dist/unreviewed.js': '8' * 64}
        for actual in [changed, extra, before]:
            with self.subTest(actual=actual), self.assertRaises(AssertionError):
                guards.assert_runtime_files(before, actual, expected)
        for path in [
            '/usr/local/bin/node', '/usr/local/bin/mapflow-server',
            '/opt/mapflow/harness-worker/dist/harness.js', '/opt/mapflow/harness-worker/dist/model-context.js',
        ]:
            wrong = {**expected, path: '9' * 64 if path == '/usr/local/bin/node' else before[path]}
            with self.subTest(path=path), self.assertRaises(AssertionError):
                guards.assert_runtime_files(before, wrong, wrong)
        missing = {path: digest for path, digest in expected.items() if '/node_modules/' not in path}
        with self.assertRaises(AssertionError):
            guards.assert_runtime_files(before, missing, missing)

    def test_sidecar_shares_only_the_app_namespace_and_has_the_exact_healthy_model_identity(self):
        expected_health = {
            'spaceId': '785d7d1f0f013aa4679042e683fc3f31f1dcc1fbca2edbaa0bf81786c805193b',
            'modelId': 'BAAI/bge-small-zh-v1.5',
            'modelDigest': '15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc',
            'tokenizerDigest': '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26',
            'dimensions': 512, 'pooling': 'cls', 'normalization': 'l2', 'maxTokens': 512,
            'queryInstruction': '为这个句子生成表示以用于检索相关文章：',
            'ready': True, 'providers': ['CPUExecutionProvider'],
        }
        container = {
            'Config': {'User': '10001:10001'}, 'State': {'Running': True},
            'HostConfig': {
                'NetworkMode': 'container:production-app-id', 'PortBindings': {},
                'PublishAllPorts': False, 'ReadonlyRootfs': True, 'CapDrop': ['ALL'],
                'CapAdd': None, 'Privileged': False, 'SecurityOpt': ['no-new-privileges:true'],
            },
            'NetworkSettings': {'Ports': {'18219/tcp': None}},
            'Mounts': [{'Type': 'bind', 'RW': False, 'Destination': '/models'}],
        }
        guards.assert_model_sidecar(container, 'production-app-id', copy.deepcopy(expected_health), expected_health)
        for change in [
            {'NetworkMode': 'host'}, {'NetworkMode': 'container:old-app-id'},
            {'PortBindings': {'18219/tcp': [{'HostPort': '18219'}]}}, {'PublishAllPorts': True},
            {'ReadonlyRootfs': False}, {'CapDrop': []}, {'CapAdd': ['SYS_ADMIN']},
            {'Privileged': True}, {'SecurityOpt': []},
        ]:
            wrong = {**container, 'HostConfig': {**container['HostConfig'], **change}}
            with self.subTest(change=change), self.assertRaises(AssertionError):
                guards.assert_model_sidecar(wrong, 'production-app-id', expected_health, expected_health)
        for user in ['', 'root', 'root:root', '0:10001', '10001:0']:
            with self.subTest(user=user), self.assertRaises(AssertionError):
                guards.assert_model_sidecar({**container, 'Config': {'User': user}}, 'production-app-id', expected_health, expected_health)
        exposed = {**container, 'NetworkSettings': {'Ports': {'18219/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '18219'}]}}}
        with self.assertRaises(AssertionError):
            guards.assert_model_sidecar(exposed, 'production-app-id', expected_health, expected_health)
        writable_model = {**container, 'Mounts': [{'Type': 'bind', 'RW': True, 'Destination': '/models'}]}
        with self.assertRaises(AssertionError):
            guards.assert_model_sidecar(writable_model, 'production-app-id', expected_health, expected_health)
        for change in [{'spaceId': 'a' * 64}, {'modelDigest': 'b' * 64}, {'ready': False}, {'dimensions': 384}]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                guards.assert_model_sidecar(container, 'production-app-id', {**expected_health, **change}, expected_health)

    def test_postgres_keeps_exact_binaries_version_and_settings_with_vector_on_rollback(self):
        before = {
            'version': 'PostgreSQL 16.14 (Debian 16.14-1.pgdg12+1)',
            'binaries': {'/usr/lib/postgresql/16/bin/postgres': 'a' * 64, '/usr/bin/pg_dump': 'b' * 64},
            'settings': {'imageId': 'existing-pg-image', 'mounts': ['existing-production-volume'], 'restart': 'unless-stopped'},
            'available_extensions': {'plpgsql': '1.0', 'vector': '0.8.2'},
            'installed_extensions': {'plpgsql': '1.0'},
        }
        upgraded = {**before, 'installed_extensions': {'plpgsql': '1.0', 'vector': '0.8.2'}}
        guards.assert_postgres_compatible(before, upgraded, copy.deepcopy(upgraded))
        guards.assert_postgres_compatible(upgraded, upgraded, upgraded)
        unavailable = {**before, 'available_extensions': {'plpgsql': '1.0'}}
        provisioned = {**upgraded, 'available_extensions': {'plpgsql': '1.0', 'vector': '0.8.7'}, 'installed_extensions': {'plpgsql': '1.0', 'vector': '0.8.7'}}
        guards.assert_postgres_compatible(unavailable, provisioned, provisioned)
        for change in [
            {'version': 'PostgreSQL 16.15'},
            {'binaries': {**before['binaries'], '/usr/lib/postgresql/16/bin/postgres': 'c' * 64}},
            {'binaries': {'/usr/lib/postgresql/16/bin/postgres': 'a' * 64}},
            {'settings': {**before['settings'], 'mounts': ['different-production-volume']}},
            {'available_extensions': {**before['available_extensions'], 'vector': '0.8.7'}},
            {'installed_extensions': {'plpgsql': '1.0'}},
            {'installed_extensions': {**upgraded['installed_extensions'], 'postgis': '3.0'}},
        ]:
            for target in ('candidate', 'rollback'):
                candidate, rollback = upgraded, upgraded
                if target == 'candidate':
                    candidate = {**upgraded, **change}
                else:
                    rollback = {**upgraded, **change}
                with self.subTest(change=change, target=target), self.assertRaises(AssertionError):
                    guards.assert_postgres_compatible(before, candidate, rollback)

    def test_observation_retention_only_drops_explicitly_audited_ids_and_preserves_survivor_rows(self):
        before_rows = {'expired-request': '0' * 32, 'retained-request': '1' * 32}
        after_rows = {'retained-request': '1' * 32, 'new-health-request': '2' * 32}
        evidence = guards.assert_observation_retention(before_rows, after_rows, ['expired-request'], max_count=2)
        self.assertEqual(evidence, {
            'before': {'count': 2, 'digest': '7180db15267aa5734649a08478f56896'},
            'after': {'count': 2, 'digest': '846561904750555293980a84ecdee8a9'},
        })
        for current, expired in [
            ({**after_rows, 'retained-request': '3' * 32}, ['expired-request']),
            (after_rows, []), (after_rows, ['expired-request', 'unknown-request']),
            (after_rows, ['expired-request', 'expired-request']),
            ({**after_rows, 'expired-request': '0' * 32}, ['expired-request']),
            ({**after_rows, 'extra-request': '4' * 32}, ['expired-request']),
        ]:
            with self.subTest(current=current, expired=expired), self.assertRaises(AssertionError):
                guards.assert_observation_retention(before_rows, current, expired, max_count=2)

    def test_business_observation_exception_requires_retention_rows_bound_to_both_fingerprints(self):
        before, after, arguments, _ = self.business_evidence()
        before['request_observations'] = {'count': 2, 'digest': '7180db15267aa5734649a08478f56896'}
        after['request_observations'] = {'count': 2, 'digest': '846561904750555293980a84ecdee8a9'}
        retention = {
            'before_rows': {'expired-request': '0' * 32, 'retained-request': '1' * 32},
            'after_rows': {'retained-request': '1' * 32, 'new-health-request': '2' * 32},
            'expired_ids': ['expired-request'], 'max_count': 2,
        }
        with self.assertRaises(AssertionError):
            guards.assert_business_preserved(before, after, **arguments)
        guards.assert_business_preserved(before, after, **arguments, observation_retention=retention)
        for field in ['count', 'digest']:
            wrong = copy.deepcopy(after)
            wrong['request_observations'][field] = 3 if field == 'count' else 'unbound table digest'
            with self.subTest(field=field), self.assertRaises(AssertionError):
                guards.assert_business_preserved(before, wrong, **arguments, observation_retention=retention)
        changed_account = {**after, 'accounts': {'count': 2, 'digest': 'modified account'}}
        with self.assertRaises(AssertionError):
            guards.assert_business_preserved(before, changed_account, **arguments, observation_retention=retention)


if __name__ == '__main__':
    unittest.main()
