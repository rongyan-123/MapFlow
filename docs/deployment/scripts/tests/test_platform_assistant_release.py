import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).parents[1] / '2026-10-15-platform-assistant-release.py'
spec = importlib.util.spec_from_file_location('platform_assistant_release', SOURCE)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class PlatformAssistantReleaseGuards(unittest.TestCase):
    def test_accepts_exact_migration_append_and_execution_scoped_key(self):
        before = {'54': {'digest': 'unchanged', 'checksum': '54hash'}}
        after = {**before, '55': {'digest': 'new', 'checksum': '55hash'}}
        release.assert_migrations_preserved(before, after, '55hash', release.DRAFT_PRIMARY_KEY)

    def test_rejects_changed_history_missing_or_extra_migrations(self):
        before = {'54': {'digest': 'unchanged', 'checksum': '54hash'}}
        valid = {**before, '55': {'digest': 'new', 'checksum': '55hash'}}
        for after in [before, {'55': valid['55']}, {**valid, '54': {'digest': 'changed', 'checksum': '54hash'}}, {**valid, '56': {'digest': 'extra', 'checksum': '56hash'}}]:
            with self.subTest(after=after), self.assertRaises(AssertionError):
                release.assert_migrations_preserved(before, after, '55hash', release.DRAFT_PRIMARY_KEY)

    def test_rejects_wrong_checksum_or_the_old_draft_operation_scope(self):
        before = {'54': {'digest': 'unchanged', 'checksum': '54hash'}}
        after = {**before, '55': {'digest': 'new', 'checksum': '55hash'}}
        with self.assertRaises(AssertionError):
            release.assert_migrations_preserved(before, after, 'other', release.DRAFT_PRIMARY_KEY)
        with self.assertRaises(AssertionError):
            release.assert_migrations_preserved(before, after, '55hash', 'PRIMARY KEY (account_id, draft_id, kind, action_id)')

    def test_uses_the_compatible_binary_after_migration_instead_of_original_runtime(self):
        self.assertEqual(release.rollback_image_for_schema(54), release.PREVIOUS)
        self.assertEqual(release.rollback_image_for_schema(55), release.COMPATIBLE)
        self.assertNotEqual(release.rollback_image_for_schema(55), release.PREVIOUS)
        with self.assertRaises(AssertionError):
            release.rollback_image_for_schema(56)

    def test_only_server_and_admin_binaries_may_change_in_runtime_manifest(self):
        before = {'/usr/local/bin/mapflow-server': 'server1', '/usr/local/bin/mapflow-admin': 'admin1', '/usr/local/bin/node': 'node', '/opt/mapflow/harness-worker/dist/main.js': 'worker'}
        after = {**before, '/usr/local/bin/mapflow-server': 'server2', '/usr/local/bin/mapflow-admin': 'admin2'}
        release.assert_runtime_changes(before, after)
        for wrong in [{**after, '/usr/local/bin/node': 'different'}, {**after, '/opt/mapflow/harness-worker/dist/main.js': 'different'}, {key: value for key, value in after.items() if key != '/usr/local/bin/node'}]:
            with self.subTest(wrong=wrong), self.assertRaises(AssertionError):
                release.assert_runtime_changes(before, wrong)

    def test_business_rows_stay_identical_while_migration_append_is_verified_separately(self):
        before = {'accounts': {'count': 1, 'digest': 'same'}, '_sqlx_migrations': {'count': 54}, 'request_observations': {'count': 20000}}
        after = {**before, '_sqlx_migrations': {'count': 55}, 'request_observations': {'count': 20001}}
        release.assert_business_preserved(before, after)
        with self.assertRaises(AssertionError):
            release.assert_business_preserved(before, {**after, 'accounts': {'count': 0, 'digest': 'changed'}})
        with self.assertRaises(AssertionError):
            release.assert_business_preserved(before, {**after, 'unexpected_table': {}})

    def test_candidate_and_rollback_cannot_reuse_the_same_server_binary(self):
        candidate = {'/usr/local/bin/mapflow-server': 'candidate'}
        rollback = {'/usr/local/bin/mapflow-server': 'rollback'}
        release.assert_distinct_server_versions(candidate, rollback)
        with self.assertRaises(AssertionError):
            release.assert_distinct_server_versions(candidate, candidate)

    def test_clone_must_have_one_internal_network_and_no_published_ports(self):
        clone = {'NetworkSettings': {'Networks': {release.CLONE_NETWORK: {}}}, 'HostConfig': {'PortBindings': {}}}
        release.assert_isolated_clone(clone, {'Internal': True})
        with self.assertRaises(AssertionError):
            release.assert_isolated_clone(clone, {'Internal': False})
        clone['HostConfig']['PortBindings'] = {'8080/tcp': [{'HostPort': '18080'}]}
        with self.assertRaises(AssertionError):
            release.assert_isolated_clone(clone, {'Internal': True})
        clone['HostConfig']['PortBindings'] = {}
        clone['NetworkSettings']['Networks']['production'] = {}
        with self.assertRaises(AssertionError):
            release.assert_isolated_clone(clone, {'Internal': True})


if __name__ == '__main__':
    unittest.main()
