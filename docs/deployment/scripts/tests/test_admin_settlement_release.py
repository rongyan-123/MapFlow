import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest


path = Path(__file__).resolve().parents[1] / 'admin_settlement_release_checks.py'
spec = importlib.util.spec_from_file_location('settlement_checks', path)
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class SettlementReleaseChecks(unittest.TestCase):
    def test_only_audited_migration_is_appended(self):
        before = {'57': {'checksum': 'original', 'success': True}}
        source = b'audited SQL bytes\n'
        after = {**before, '58': {'checksum': hashlib.sha384(source).hexdigest(), 'success': True}}
        checks.assert_migration(before, after, source)
        for mutation in [
            {'57': {'checksum': 'changed', 'success': True}},
            {'58': {'checksum': 'wrong', 'success': True}},
            {'58': {'checksum': hashlib.sha384(source).hexdigest(), 'success': False}},
            {'59': {'checksum': 'unknown', 'success': True}},
        ]:
            with self.assertRaises(AssertionError):
                checks.assert_migration(before, {**after, **mutation}, source)

    def test_preserves_every_business_table_and_creates_empty_review_table(self):
        before = {'accounts': {'count': 2, 'digest': 'a'}, '_sqlx_migrations': {'count': 57, 'digest': 'm'}, 'request_observations': {'count': 10, 'digest': 'o'}}
        after = {**before, '_sqlx_migrations': {'count': 58, 'digest': 'next'}, 'agent_settlement_reviews': {'count': 0, 'digest': hashlib.md5(b'').hexdigest()}}
        checks.assert_business(before, after)
        for mutation in [
            {'accounts': {'count': 2, 'digest': 'changed'}},
            {'agent_settlement_reviews': {'count': 1, 'digest': 'reviewed-real-record'}},
            {'unexpected': {'count': 0, 'digest': 'empty'}},
        ]:
            with self.assertRaises(AssertionError):
                checks.assert_business(before, {**after, **mutation})
        with self.assertRaises(AssertionError):
            checks.assert_business(before, {name: row for name, row in after.items() if name != 'accounts'})

    def test_observation_exception_requires_independent_verified_retention(self):
        before = {'accounts': {}, '_sqlx_migrations': {}, 'request_observations': {'count': 10}}
        after = {**before, 'request_observations': {'count': 9}, 'agent_settlement_reviews': {'count': 0}}
        with self.assertRaises(AssertionError):
            checks.assert_business(before, after)
        checks.assert_business(before, after, retention_verified=True)

    def test_runtime_can_only_change_three_revision_labels(self):
        before = {'environment': {'secret': 'preserved'}, 'labels': {'org.opencontainers.image.revision': 'old', 'com.mapflow.frontend.revision': 'old', 'dev.mapflow.frontend.revision': 'old'}, 'host': {'Memory': 123}, 'networks': {'production': {'ip': 'fixed'}}}
        after = copy.deepcopy(before)
        after['labels'].update({'org.opencontainers.image.revision': 'backend', 'com.mapflow.frontend.revision': 'frontend', 'dev.mapflow.frontend.revision': 'frontend'})
        checks.assert_config(before, after, 'frontend', 'backend')
        for field, value in [('environment', {'secret': 'changed'}), ('host', {'Memory': 0}), ('labels', {**after['labels'], 'other': 'new'})]:
            with self.assertRaises(AssertionError):
                checks.assert_config(before, {**after, field: value}, 'frontend', 'backend')

    def test_runtime_replaces_only_two_binaries(self):
        before = {'/usr/local/bin/mapflow-server': 'server1', '/usr/local/bin/mapflow-admin': 'admin1', '/usr/local/bin/node': 'node', '/opt/mapflow/harness-worker/dist/main.js': 'worker'}
        after = {**before, '/usr/local/bin/mapflow-server': 'server2', '/usr/local/bin/mapflow-admin': 'admin2'}
        checks.assert_runtime(before, after)
        for mutation in [{'/usr/local/bin/node': 'different'}, {'/opt/mapflow/harness-worker/dist/main.js': 'different'}, {'unreviewed': 'file'}, {'/usr/local/bin/mapflow-server': 'server1'}]:
            with self.assertRaises(AssertionError):
                checks.assert_runtime(before, {**after, **mutation})


if __name__ == '__main__':
    unittest.main()
