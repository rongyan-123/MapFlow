"""Behavior tests: reject stale/dirty/wrong entry folders using real Git repositories."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'workspace_entry.py'


class WorkspaceEntryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='mapflow-entry-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / 'project'
        self.remote = self.root / 'fixture-owner/project.git'
        self.remote.parent.mkdir()
        self.repo.mkdir()
        self.git(self.repo, 'init', '--quiet', '-b', 'main')
        self.git(self.repo, 'config', 'user.name', 'Workspace Test')
        self.git(self.repo, 'config', 'user.email', 'workspace-test@example.invalid')
        self.git(self.repo, 'config', 'commit.gpgsign', 'false')
        self.git(self.repo, 'config', 'core.autocrlf', 'false')
        (self.repo / 'content.txt').write_text('published\n', encoding='utf-8')
        self.git(self.repo, 'add', 'content.txt')
        self.git(self.repo, 'commit', '--quiet', '-m', 'published')
        self.git(self.root, 'init', '--bare', '--quiet', str(self.remote))
        self.git(self.repo, 'remote', 'add', 'origin', str(self.remote))
        self.git(self.repo, 'push', '--quiet', '-u', 'origin', 'main')

    def git(self, root, *arguments):
        return subprocess.run(['git', '-C', str(root), '-c', 'core.hooksPath=' + str(self.root / 'empty-hooks'), *arguments],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=dict(os.environ, GIT_OPTIONAL_LOCKS='0')).stdout

    def check(self, path=None, expected_repository=None):
        arguments = [sys.executable, str(SCRIPT), '--repo', str(path or self.repo), '--json']
        if expected_repository:
            arguments += ['--expected-repository', expected_repository]
        completed = subprocess.run(arguments,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8')
        return completed, json.loads(completed.stdout)

    def assert_rejected(self, code, path=None):
        completed, report = self.check(path)
        self.assertEqual(completed.returncode, 1, report)
        self.assertFalse(report['ok'])
        self.assertIn(code, [issue['code'] for issue in report['workspaces'][0]['issues']])

    def test_feature_branch_is_rejected_even_at_the_latest_main_commit(self):
        self.git(self.repo, 'switch', '--quiet', '-c', 'codex/unfinished')
        self.assert_rejected('wrong_branch')

    def test_main_behind_origin_is_rejected(self):
        old = self.git(self.repo, 'rev-parse', 'HEAD').decode().strip()
        (self.repo / 'content.txt').write_text('new published version\n', encoding='utf-8')
        self.git(self.repo, 'add', 'content.txt')
        self.git(self.repo, 'commit', '--quiet', '-m', 'next published')
        self.git(self.repo, 'push', '--quiet', 'origin', 'main')
        self.git(self.repo, 'reset', '--hard', '--quiet', old)
        self.assert_rejected('behind_origin')

    def test_main_with_unstaged_source_edits_is_rejected(self):
        (self.repo / 'content.txt').write_text('unfinished\n', encoding='utf-8')
        self.assert_rejected('tracked_changes')

    def test_remote_main_changes_are_detected_without_fetch_or_source_mutation(self):
        clone = self.root / 'another-workspace'
        self.git(self.root, 'clone', '--quiet', '--branch', 'main', str(self.remote), str(clone))
        self.git(clone, 'config', 'user.name', 'Workspace Test')
        self.git(clone, 'config', 'user.email', 'workspace-test@example.invalid')
        self.git(clone, 'config', 'commit.gpgsign', 'false')
        (clone / 'content.txt').write_text('new remote version\n', encoding='utf-8')
        self.git(clone, 'add', 'content.txt')
        self.git(clone, 'commit', '--quiet', '-m', 'next remote version')
        self.git(clone, 'push', '--quiet', 'origin', 'main')
        original_tracking = self.git(self.repo, 'rev-parse', 'origin/main')
        self.assert_rejected('stale_origin_main')
        self.assertEqual(original_tracking, self.git(self.repo, 'rev-parse', 'origin/main'))

    def test_main_with_staged_source_edits_is_rejected(self):
        (self.repo / 'content.txt').write_text('unfinished\n', encoding='utf-8')
        self.git(self.repo, 'add', 'content.txt')
        self.assert_rejected('tracked_changes')

    def test_main_with_untracked_source_is_rejected(self):
        (self.repo / 'unfinished.py').write_text('unfinished = True\n', encoding='utf-8')
        self.assert_rejected('untracked_files')

    def test_detached_checkout_is_rejected_even_at_main(self):
        self.git(self.repo, 'switch', '--detach', '--quiet')
        self.assert_rejected('wrong_branch')

    def test_a_subdirectory_cannot_impersonate_the_fixed_repository_root(self):
        child = self.repo / 'subdirectory'
        child.mkdir()
        self.assert_rejected('wrong_root', child)

    def test_non_git_directory_reports_a_readable_failure(self):
        directory = self.root / 'not-a-repository'
        directory.mkdir()
        self.assert_rejected('not_repository', directory)

    def test_missing_directory_reports_a_readable_failure(self):
        self.assert_rejected('missing_directory', self.root / 'missing')

    def test_missing_origin_main_is_not_treated_as_latest(self):
        self.git(self.repo, 'update-ref', '-d', 'refs/remotes/origin/main')
        self.assert_rejected('missing_origin_main')

    def test_another_repository_cannot_impersonate_the_fixed_product_entry(self):
        completed, report = self.check(expected_repository='different-owner/project')
        self.assertEqual(completed.returncode, 1, report)
        self.assertIn('wrong_repository', [issue['code'] for issue in report['workspaces'][0]['issues']])

    def test_the_expected_repository_identity_passes(self):
        completed, report = self.check(expected_repository='fixture-owner/project')
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertTrue(report['ok'])

    def test_clean_latest_main_passes_without_modifying_git_state(self):
        original_index = hashlib.sha256((self.repo / '.git/index').read_bytes()).hexdigest()
        original_head = self.git(self.repo, 'rev-parse', 'HEAD')
        completed, report = self.check()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertTrue(report['ok'])
        self.assertEqual(original_head, self.git(self.repo, 'rev-parse', 'HEAD'))
        self.assertEqual(original_index, hashlib.sha256((self.repo / '.git/index').read_bytes()).hexdigest())

    def test_main_containing_origin_and_local_commits_is_current(self):
        (self.repo / 'content.txt').write_text('verified local follow-up\n', encoding='utf-8')
        self.git(self.repo, 'add', 'content.txt')
        self.git(self.repo, 'commit', '--quiet', '-m', 'local follow-up')
        completed, report = self.check()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertTrue(report['ok'])

    def test_ignored_private_assets_do_not_make_product_main_dirty(self):
        (self.repo / '.gitignore').write_text('target/\nprivate.env\n', encoding='utf-8')
        self.git(self.repo, 'add', '.gitignore')
        self.git(self.repo, 'commit', '--quiet', '-m', 'ignore local assets')
        self.git(self.repo, 'push', '--quiet', 'origin', 'main')
        (self.repo / 'target').mkdir()
        (self.repo / 'target/generated.cache').write_bytes(b'rebuildable')
        (self.repo / 'private.env').write_text('TEST_ONLY=value\n', encoding='utf-8')
        completed, report = self.check()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertTrue(report['ok'])


if __name__ == '__main__':
    unittest.main()
