"""Pure release guards for the additive settlement review migration 57 -> 58."""
import copy
import hashlib


def assert_migration(before, after, source):
    assert before and max(map(int, before)) == 57, 'Release requires schema57'
    assert set(after) == set(before) | {'58'}, 'Unexpected migration set'
    assert all(after[version] == row for version, row in before.items()), 'Historical migration row changed'
    assert after['58']['success'] is True, 'Migration58 did not succeed'
    assert after['58']['checksum'] == hashlib.sha384(source).hexdigest(), 'Migration58 differs from audited bytes'


def assert_business(before, after, *, retention_verified=False):
    assert before and '_sqlx_migrations' in before, 'Incomplete database baseline'
    assert 'agent_settlement_reviews' not in before, 'Review table already exists'
    assert set(after) == set(before) | {'agent_settlement_reviews'}, 'Unexpected table set'
    assert after['agent_settlement_reviews']['count'] == 0, 'Deployment must not review real records'
    exceptions = {'_sqlx_migrations'} | ({'request_observations'} if retention_verified else set())
    changed = [name for name in before if name not in exceptions and before[name] != after[name]]
    assert not changed, 'Business records changed: ' + ','.join(changed)


def assert_config(before, after, frontend, backend):
    expected = copy.deepcopy(before)
    expected['labels'].update({'org.opencontainers.image.revision': backend,
                              'com.mapflow.frontend.revision': frontend,
                              'dev.mapflow.frontend.revision': frontend})
    assert after == expected, 'Existing runtime settings changed'


def assert_runtime(before, after):
    upgraded = {'/usr/local/bin/mapflow-server', '/usr/local/bin/mapflow-admin'}
    assert upgraded | {'/usr/local/bin/node'} <= set(before), 'Incomplete runtime manifest'
    assert set(before) == set(after), 'Runtime file set changed'
    assert all(after[name] != before[name] for name in upgraded), 'New application binary missing'
    assert all(after[name] == before[name] for name in before if name not in upgraded), 'Unreviewed runtime changed'
