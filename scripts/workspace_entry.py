"""Read-only checks for the fixed MapFlow main directories before development or review."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

DEFAULT_ROOTS = ('D:/MapFlow-publish', 'D:/mapflow-server')
REGISTERED_REPOSITORIES = {'d:/mapflow-publish': 'rongyan-123/MapFlow',
                          'd:/mapflow-server': 'rongyan-123/mapflow-server'}


def read_git(root, *arguments):
    return subprocess.run(['git', '-C', str(root), *arguments], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', timeout=20,
        env=dict(os.environ, GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never'))


def inspect_workspace(location, expected_repository=None):
    root = Path(location).resolve()
    result = {'path': str(root), 'issues': []}

    def issue(code, message):
        result['issues'].append({'code': code, 'message': message})

    if not root.is_dir():
        issue('missing_directory', '固定目录不存在。')
        return result
    try:
        top = read_git(root, 'rev-parse', '--show-toplevel')
        if top.returncode:
            issue('not_repository', '固定目录不是可读取的 Git 工作区。')
            return result
        if Path(top.stdout.strip()).resolve() != root:
            issue('wrong_root', '指定目录是仓库的子目录，不能作为固定入口。')
        expected_repository = expected_repository or REGISTERED_REPOSITORIES.get(root.as_posix().casefold())
        if expected_repository:
            remote_url = read_git(root, 'remote', 'get-url', 'origin')
            value = remote_url.stdout.strip()
            if '://' in value:
                repository_path = urlsplit(value).path
            elif '@' in value and ':' in value:
                repository_path = value.split(':', 1)[1]
            else:
                repository_path = value.replace('\\', '/')
            repository_name = '/'.join(repository_path.rstrip('/').split('/')[-2:]).casefold().removesuffix('.git')
            if remote_url.returncode or repository_name != expected_repository.casefold().removesuffix('.git'):
                issue('wrong_repository', 'origin 与固定入口登记的产品仓库不一致。')
        branch = read_git(root, 'symbolic-ref', '--short', '-q', 'HEAD')
        result['branch'] = branch.stdout.strip() if branch.returncode == 0 else 'DETACHED'
        if result['branch'] != 'main':
            issue('wrong_branch', '固定入口应位于 main；请先保存开发工作，再恢复主目录。')
        head = read_git(root, 'rev-parse', '--verify', 'HEAD')
        if head.returncode:
            issue('missing_head', '工作区没有可读取的提交。')
            return result
        result['head'] = head.stdout.strip()
        tracking = read_git(root, 'rev-parse', '--verify', 'refs/remotes/origin/main')
        if tracking.returncode:
            issue('missing_origin_main', '缺少 origin/main；请先 git fetch origin。')
        else:
            result['originMain'] = tracking.stdout.strip()
            counts = read_git(root, 'rev-list', '--left-right', '--count', 'HEAD...refs/remotes/origin/main')
            if counts.returncode:
                issue('cannot_compare_main', '无法核对 main 的提交范围。')
            else:
                result['aheadOrigin'], result['behindOrigin'] = map(int, counts.stdout.split())
                if result['behindOrigin']:
                    issue('behind_origin', '工作区缺少 origin/main 的提交；请在保存本地工作后更新固定主线。')
        status = read_git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
        if status.returncode:
            issue('cannot_read_status', '无法核对暂存、未暂存与未跟踪状态。')
        else:
            records = status.stdout.split('\0')
            tracked = 0
            untracked = 0
            cursor = 0
            while cursor < len(records):
                record = records[cursor]
                cursor += 1
                if not record:
                    continue
                flags = record[:2]
                if flags == '??':
                    untracked += 1
                else:
                    tracked += 1
                    if 'R' in flags or 'C' in flags:
                        cursor += 1
            result['trackedChangeCount'] = tracked
            result['untrackedFileCount'] = untracked
            if tracked:
                issue('tracked_changes', '固定入口有暂存或未暂存改动；请将功能工作保存在独立工作区。')
            if untracked:
                issue('untracked_files', '固定入口有未跟踪文件；先确认其用途，保存工作或明确本地资料的忽略规则。')
        if tracking.returncode == 0:
            remote = read_git(root, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main')
            if remote.returncode or not remote.stdout.strip():
                issue('remote_unavailable', '无法读取远端 main；本次不能确认固定入口为最新。')
            else:
                result['remoteMain'] = remote.stdout.split()[0]
                if result['remoteMain'] != result['originMain']:
                    issue('stale_origin_main', '远端 main 已变化；请先 git fetch origin 再重新检查。')
    except (OSError, subprocess.TimeoutExpired, ValueError):
        issue('git_check_failed', 'Git 检查失败或超时；请核对目录、Git 安装与远端访问。')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', action='append', help='指定完整仓库根目录；可重复。默认检查两个固定 MapFlow 入口。')
    parser.add_argument('--expected-repository', help='核对 origin 的 owner/repository；默认固定目录使用已登记仓库。')
    parser.add_argument('--json', action='store_true', help='输出结构化检查结果。')
    arguments = parser.parse_args()
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    workspaces = [inspect_workspace(location, arguments.expected_repository) for location in arguments.repo or DEFAULT_ROOTS]
    report = {'ok': all(not workspace['issues'] for workspace in workspaces), 'workspaces': workspaces}
    if arguments.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for workspace in workspaces:
            print(f"{workspace['path']}: {'通过' if not workspace['issues'] else '需要处理'}")
            if workspace.get('head'):
                print(f"  {workspace.get('branch')} {workspace['head'][:12]}；落后 origin/main {workspace.get('behindOrigin', '?')} 个提交")
            for issue in workspace['issues']:
                print(f"  {issue['message']}")
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
