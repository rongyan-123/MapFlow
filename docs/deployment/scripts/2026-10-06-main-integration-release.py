"""Publish verified frontend/backend main commits on the laptop, preserving runtime secrets."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys
import types
import urllib.request

helpers = Path(__file__).resolve().parent
queue_path = helpers / '2026-10-06-payment-display-queue-release.py'
base_path = helpers / '2026-10-06-vmq-wallet-release.py'
queue = types.ModuleType('main_release_queue')
queue.__file__ = str(queue_path)
source = queue_path.read_text().replace("'/tmp/mapflow-payment-release.py'", repr(str(base_path)))
exec(compile(source, str(queue_path), 'exec'), queue.__dict__)
base = queue.base
base.release = base.root / 'releases' / '20261006-main-integration'
base.image = 'mapflow-server:main-integration-20261006'
base.stage_db = 'mapflow-main-check-postgres'
base.stage_app = 'mapflow-main-check-app'
queue.previous_name = 'mapflow-laptop-app-before-main-integration-20261006'
bundle = Path('/tmp/mapflow-main-bundle')
expected_previous = 'mapflow-server:payment-display-queue-20261006'
original_checks = queue.checks


def provenance():
    manifest = json.loads((bundle / 'provenance.json').read_text())
    for component in ['frontend', 'backend']:
        if manifest[component]['branch'] != 'main':
            raise RuntimeError('only main source commits may be published')
        if not re.fullmatch('[0-9a-f]{40}', manifest[component]['commit']):
            raise RuntimeError('a full main source commit is required')
    return manifest


def checks(port):
    statuses = original_checks(port)
    html = (base.release / 'build/dist/index.html').read_text()
    assets = re.findall(r'<script[^>]*src="([^"]+\.js)"', html)
    if not assets:
        raise RuntimeError('frontend entry asset is missing')
    combined = ''
    for asset in assets:
        expected = (base.release / 'build/dist' / asset.lstrip('/')).read_bytes()
        with urllib.request.urlopen(f'http://127.0.0.1:{port}' + asset, timeout=10) as response:
            installed = response.read()
        if installed != expected:
            raise RuntimeError('served frontend asset differs from the main build')
        combined += installed.decode()
    for feature in ['搜索公共地图', '清除筛选', '地图排序', '重新排队', '我的额度']:
        if feature not in combined:
            raise RuntimeError('merged frontend feature is missing: ' + feature)
    return statuses


queue.checks = checks


def prepare():
    manifest = provenance()
    previous = base.inspect(base.name)
    if previous['Config']['Image'] != expected_previous:
        raise RuntimeError('production changed; integrate its source before publishing')
    base.release.mkdir(mode=0o700)
    base.private_write(base.release / 'original-container.json', json.dumps(previous))
    (base.release / 'provenance.json').write_text(json.dumps(manifest, indent=2))
    base.backup(base.release / 'canary-source.dump')
    context = base.release / 'build'
    context.mkdir()
    for binary in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(bundle / binary, context / binary)
    shutil.copytree(bundle / 'dist', context / 'dist')
    (context / 'Dockerfile').write_text(
        'FROM ' + expected_previous + '\n'
        'LABEL org.opencontainers.image.revision="' + manifest['backend']['commit'] + '" \\\n'
        '      com.mapflow.frontend.revision="' + manifest['frontend']['commit'] + '" \\\n'
        '      com.mapflow.source.branch="main"\n'
        'COPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\n'
        'COPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\n'
        'COPY --chown=10001:10001 dist/ /srv/mapflow/\n'
    )
    with (base.release / 'image-build.log').open('wb') as log:
        base.run(base.docker + ['build', '--network=none', '-t', base.image, str(context)], output=log)
    for helper in [Path(__file__), queue_path, base_path]:
        shutil.copy2(helper, base.release / helper.name)
    print('main image prepared with pinned frontend and backend commits', flush=True)


def finish():
    report = json.loads((base.release / 'production-passed.json').read_text())
    live = base.inspect(base.name)
    if live['Config']['Image'] != base.image or report['image'] != base.image:
        raise RuntimeError('production changed after main cutover')
    manifest = json.loads((base.release / 'provenance.json').read_text())
    labels = json.loads(base.run(base.docker + ['image', 'inspect', base.image]))[0]['Config']['Labels']
    if labels['org.opencontainers.image.revision'] != manifest['backend']['commit']:
        raise RuntimeError('backend revision differs')
    if labels['com.mapflow.frontend.revision'] != manifest['frontend']['commit']:
        raise RuntimeError('frontend revision differs')
    checks(18092)
    record = (
        '# Main integration deployment\n\n'
        'Frontend main: `' + manifest['frontend']['commit'] + '`\n\n'
        'Backend main: `' + manifest['backend']['commit'] + '`\n\n'
        'Image: `' + base.image + '`\n\n'
        'Public tree search, filters, pagination, previews, notes and publication restored. '
        'VMQ wallet, 20-second display queue and arithmetic registration retained. '
        'Source archives, frontend assets, binary hashes, cloned-database canary and cold backup '
        'are recorded in this directory. Runtime secrets, proxy policy and FRP were preserved. '
        'Rollback the application only; never overwrite new payments with an old database.\n'
    )
    (base.release / 'DEPLOYMENT.md').write_text(record)
    ops = base.root / 'OPERATIONS.md'
    heading = '> **Main 集成发布（2026-10-06）**'
    if heading not in ops.read_text():
        ops.write_text(
            heading + '：当前镜像 `' + base.image + '`，前后端均来自已合并的 `main`。'
            '前端 `D:\\MapFlow-main-integration-20261006`；后端 '
            '`D:\\mapflow-server-main-integration-20261006`，Linux 源码 '
            '`/home/rong/project/mapflow/mapflow-server-main-20261006`。'
            '搜索筛选与充值、排队、注册共同保留；迁移仍为 0030。'
            '发布记录、来源提交、验证和备份见 `releases/20261006-main-integration/`。'
            '下文为历史版本，不要从功能分支直接覆盖生产。\n\n' + ops.read_text()
        )
    print('main revisions and served assets verified', json.dumps(manifest['frontend']), flush=True)


if __name__ == '__main__':
    {'prepare': prepare, 'canary': queue.canary, 'cutover': queue.cutover, 'finish': finish}[sys.argv[1]]()
