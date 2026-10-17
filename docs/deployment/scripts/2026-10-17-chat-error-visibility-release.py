"""Deploy the error-only recovery UI using the retained paired-release helpers.

Run on the deployment host as root. All synthetic records are restricted to the
isolated restored database. Production cutover and rollback reuse verified code.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import sys
import tarfile
import uuid

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/chat-error-visibility-20261017')
RELEASE = ROOT / 'releases/20261017-chat-error-visibility'
FRONTEND = 'ae0917f4f95d7fd1279493fd55bfed030c90c2d0'
BACKEND = 'c6080cd86ed5bdd7aa8ca5d4d3d6e94d531906fc'
PREVIOUS = 'sha256:0c544da93395d92f04ee32d2cc4aa0f51e1c115b4b9a2c44f7bcf2fdb10067c3'
EXPECTED_APP = '10055c9ab3f8fdb22f806141a49b25b3ef3432e55468c1fa344ae44ac3f0eaee'
IMAGE = 'mapflow-server:chat-error-visibility-20261017-c6080cd'
BASE = 'mapflow-server:chat-error-base-20261017-0c544da'
APP, KNOWLEDGE, DB = 'mapflow-laptop-app', 'mapflow-laptop-knowledge', 'mapflow-laptop-postgres'
OLD_APP = APP + '-before-chat-error-20261017'
OLD_KNOWLEDGE = KNOWLEDGE + '-before-chat-error-20261017'
CLONE_APP, CLONE_DB = 'mapflow-chat-error-check-app-20261017', 'mapflow-chat-error-check-postgres-20261017'
CLONE_NETWORK, CLONE_KNOWLEDGE = 'mapflow-chat-error-check-20261017', 'mapflow-chat-error-check-knowledge-20261017'
ROLLBACK_APP = CLONE_APP + '-rollback'
BUILDER = 'mapflow-chat-error-build-20261017'

spec = importlib.util.spec_from_file_location('retained_byok_release', ROOT / 'releases/20261017-byok-repair/2026-10-17-byok-release.py')
paired = importlib.util.module_from_spec(spec)
spec.loader.exec_module(paired)
for module in [paired, paired.prior, paired.g, paired.f]:
    for key in ['PACKET', 'RELEASE', 'FRONTEND', 'BACKEND', 'PREVIOUS', 'EXPECTED_APP', 'IMAGE', 'BASE', 'APP', 'OLD_APP', 'OLD_KNOWLEDGE', 'CLONE_APP', 'CLONE_DB', 'CLONE_NETWORK', 'CLONE_KNOWLEDGE', 'ROLLBACK_APP']:
        setattr(module, key, globals()[key])
paired.f.load_helpers()
paired.f.helpers.IMAGE, paired.f.helpers.PROD_DB = IMAGE, DB
run, inspect, exists, private = paired.run, paired.inspect, paired.exists, paired.private
D = paired.D


def prepare():
    assert not RELEASE.exists() and not exists(OLD_APP) and not exists(OLD_KNOWLEDGE)
    assert inspect(APP)['Id'] == EXPECTED_APP and inspect(APP)['Image'] == PREVIOUS
    builder = inspect(BUILDER)
    assert builder['State']['Status'] == 'exited' and builder['State']['ExitCode'] == 0
    RELEASE.mkdir(mode=0o700)
    for filename, container in [('original-container.json', APP), ('original-knowledge.json', KNOWLEDGE), ('original-postgres.json', DB)]:
        private(filename, inspect(container))
    manifest = paired.source()
    context = PACKET / 'context'
    context.mkdir(mode=0o700)
    for name in ['frontend.tar.gz', 'worker.tar.gz']:
        with tarfile.open(PACKET / name) as archive:
            archive.extractall(context, filter='data')
    web = json.loads((PACKET / 'frontend-files.json').read_text())
    worker = json.loads((PACKET / 'worker-files.json').read_text())
    paired.f.verify_web_manifest(context / 'web-dist', web)
    actual_worker = {path.relative_to(context / 'harness-dist').as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in (context / 'harness-dist').rglob('*') if path.is_file()}
    assert actual_worker == worker
    previous = json.loads((ROOT / 'releases/20261017-byok-repair/provenance.json').read_text())
    assert previous['imageId'] == PREVIOUS and previous['workerFiles'] == worker
    runtime = previous['runtimeFiles']
    assert paired.g.file_hashes(APP, runtime) == runtime
    current = dict(runtime)
    for name in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(PACKET / 'build-output' / name, context / name)
        current['/usr/local/bin/' + name] = hashlib.sha256((context / name).read_bytes()).hexdigest()
    changed = {name for name in current if current[name] != runtime[name]}
    assert '/usr/local/bin/mapflow-server' in changed and changed <= {'/usr/local/bin/mapflow-server', '/usr/local/bin/mapflow-admin'}
    run(D + ['tag', PREVIOUS, BASE])
    (context / 'Dockerfile').write_text('FROM ' + BASE + '\nUSER 0:0\nRUN rm -rf /srv/mapflow && mkdir -p /srv/mapflow && chown 10001:10001 /srv/mapflow\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\nUSER 10001:10001\nLABEL org.opencontainers.image.revision="' + BACKEND + '" com.mapflow.frontend.revision="' + FRONTEND + '" dev.mapflow.frontend.revision="' + FRONTEND + '"\n')
    run(D + ['build', '--network=none', '-t', IMAGE, str(context)])
    paired.f.assert_runtime_layers(inspect(PREVIOUS)['RootFS']['Layers'], inspect(IMAGE)['RootFS']['Layers'])
    private('provenance.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(IMAGE)['Id'], 'baseImage': PREVIOUS, 'runtimeFiles': current, 'previousRuntimeFiles': runtime, 'webFiles': web, 'workerFiles': worker, 'source': manifest, 'buildContainer': builder['Id']})
    assert paired.f.migration(DB) == 58
    size = paired.f.backup('canary-source.dump')
    shutil.copy2(PACKET / Path(__file__).name, RELEASE / Path(__file__).name)
    private('prepared.json', {'passed': True, 'backupBytes': size, 'schema': 58, 'unchangedWorker': True})
    print(json.dumps({'prepared': True, 'imageId': inspect(IMAGE)['Id'], 'backupBytes': size, 'unchangedWorker': True}), flush=True)


def check_canary():
    assert inspect(CLONE_NETWORK)['Internal'] and CLONE_DB != DB
    cookie, csrf, account = paired.g.clone_register('progress')
    status, snapshot, _ = paired.g.api(CLONE_APP, 'POST', '/api/me/global-assistant/open', {}, cookie, csrf)
    assert status == 200
    conversation = str(uuid.UUID(snapshot['conversationId']))
    execution, owner, call = [str(uuid.uuid4()) for _ in range(3)]
    paired.g.sql(CLONE_DB, "INSERT INTO agent_executions(execution_id,account_id,conversation_id,funding,state,request,model_snapshot,owner_id,fence,lease_expires_at) VALUES('" + execution + "','" + account + "','" + conversation + "','byok','running','{}','{}','" + owner + "',1,clock_timestamp()+interval '1 day'); INSERT INTO agent_model_calls(call_id,account_id,execution_id,owner_fence,status,payload_digest,request) VALUES('" + call + "','" + account + "','" + execution + "',1,'dispatched',repeat('a',64),'{}')")
    path = '/api/me/agent-executions/' + execution + '/control'
    run(D + ['start', ROLLBACK_APP])
    paired.f.helpers.ready(ROLLBACK_APP)
    checked = []
    try:
        for funding in ['cash', 'points', 'byok']:
            for state in ['queued', 'running', 'recovering', 'ready_to_commit']:
                paired.g.sql(CLONE_DB, "UPDATE agent_executions SET funding='" + funding + "',state='" + state + "' WHERE execution_id='" + execution + "'")
                old_status, old, _ = paired.g.api(ROLLBACK_APP, 'GET', path, cookie=cookie)
                status, current, _ = paired.g.api(CLONE_APP, 'GET', path, cookie=cookie)
                assert old_status == status == 200
                assert old['state'] == current['state'] == state
                assert old['reason'] == 'external_outcome_unknown' and current['reason'] == 'none'
                assert current['actions'] == {'canCheck': True, 'canStop': True, 'canResume': False, 'needsCredential': False}
                checked.append(funding + '/' + state)
        for state in ['failed', 'awaiting_reconciliation']:
            paired.g.sql(CLONE_DB, "UPDATE agent_executions SET state='" + state + "' WHERE execution_id='" + execution + "'")
            status, current, _ = paired.g.api(CLONE_APP, 'GET', path, cookie=cookie)
            assert status == 200 and current['reason'] == 'external_outcome_unknown'
    finally:
        paired.g.sql(CLONE_DB, "UPDATE agent_executions SET state='stopped',owner_id=NULL,lease_expires_at=NULL,call_set_sealed=true WHERE execution_id='" + execution + "'")
        run(D + ['stop', ROLLBACK_APP])
    private('inflight-control-passed.json', {'passed': True, 'checked': checked, 'oldImageReproducesFalseWarning': True, 'newImageClassifiesNormalProgressCorrectly': True, 'actualFailuresRemainVisible': True, 'realProviderCalls': 0})
    paired.check_canary()
    report = paired.read('canary-passed.json')
    report['inflightControls'] = paired.read('inflight-control-passed.json')
    private('canary-passed.json', report)


def finish():
    report = paired.read('production-passed.json')
    paired.artifacts(APP)
    paired.g.verify_knowledge(KNOWLEDGE, APP)
    paired.f.public_checks()
    notice = '> 正常生成异常卡片误报修复已发布（2026-10-17）：前端 ' + FRONTEND + '；后端 ' + BACKEND + '；Worker 和 schema58 不变。回退见 releases/20261017-chat-error-visibility/。\n\n'
    operations = ROOT / 'OPERATIONS.md'
    if not operations.read_text().startswith(notice):
        operations.write_text(notice + operations.read_text())
    (RELEASE / 'DEPLOYMENT.md').write_text('# Chat error visibility — 2026-10-17\n\nFrontend ' + FRONTEND + '; backend ' + BACKEND + '; image ' + report['imageId'] + '. Worker, Node, SDK dependencies, schema58 and payment configuration retained.\n\nRollback: sudo python3 ' + str(PACKET / Path(__file__).name) + ' rollback. Restores both ' + OLD_APP + ' and ' + OLD_KNOWLEDGE + '; keep all current database records. Never restore an old dump over production.\n')
    print(json.dumps({'finished': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': report['imageId'], 'schema': 58}), flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'rollback':
        before = (RELEASE / 'Caddyfile.before').read_text()
        marker = 'reverse_proxy mapflow-app:8080 {'
        paired.prior.restore(before, before.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker))
    else:
        {'prepare': prepare, 'canary-setup': paired.canary_setup, 'check-canary': check_canary, 'cutover': paired.cutover, 'finish': finish}[sys.argv[1]]()
