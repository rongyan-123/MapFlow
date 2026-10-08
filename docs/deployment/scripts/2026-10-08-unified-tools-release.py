"""Publish approved tool diagnostics using the established backup/clone/cutover workflow."""
from pathlib import Path
import copy, importlib.util, json, shutil, sys, time

root = Path('/opt/mapflow-laptop-migration-20261006')
source = root / 'releases/20261008-chat-reliability/mapflow-chat-reliability-release.py'
spec = importlib.util.spec_from_file_location('chat_release', source)
chat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chat)
catalog, base, queue = chat.catalog, chat.base, chat.queue
base.release = root / 'releases/20261008-unified-tools'
base.image = 'mapflow-server:unified-tools-20261008'
base.stage_db = 'mapflow-unified-tools-check-postgres'
base.stage_app = 'mapflow-unified-tools-check-app'
queue.previous_name = 'mapflow-laptop-app-before-unified-tools-20261008'
catalog.expected_previous = 'mapflow-server:chat-reliability-20261008'
catalog.bundle = Path('/tmp/mapflow-unified-tools-bundle')
journal = root / 'state/tool-diagnostics'
original_run = base.run

def run(command, **kwargs):
    # Supply a writable durable journal to the clone despite its read-only root.
    if 'run' in command and base.stage_app in command and command[-1] == base.image:
        command = command[:-1] + ['-e', 'MAPFLOW_DIAGNOSTICS_DIR=/var/lib/mapflow/diagnostics',
            '--mount', 'type=bind,src=' + str(base.release / 'clone-diagnostics') + ',dst=/var/lib/mapflow/diagnostics', base.image]
    return original_run(command, **kwargs)
base.run = run

original_create = queue.create_production
def create_production():
    original = queue.original
    config = copy.deepcopy(original())
    config['Config']['Env'] = [entry for entry in config['Config']['Env'] if not entry.startswith('MAPFLOW_DIAGNOSTICS_DIR=')]
    config['Config']['Env'].append('MAPFLOW_DIAGNOSTICS_DIR=/var/lib/mapflow/diagnostics')
    config['HostConfig']['Binds'] = list(config['HostConfig'].get('Binds') or []) + [str(journal) + ':/var/lib/mapflow/diagnostics:rw']
    queue.original = lambda: config
    try: original_create()
    finally: queue.original = original
queue.create_production = create_production

def checks(port):
    container = base.stage_app if port == 18094 else base.name
    statuses = {}
    for path in ['/api/wallet', '/api/admin/model-balance', '/api/admin/request-observations/00000000-0000-0000-0000-000000000001', '/api/me/tavern/conversations']:
        statuses[path] = catalog.api(container, 'GET', path)[0]
        if statuses[path] != 401: raise RuntimeError('Anonymous privileged access accepted: ' + path)
    models, _ = catalog.accepted(container, 'GET', '/api/model-catalog/byok')
    if len(models) != 51: raise RuntimeError('Model catalog changed')
    assets = ''.join(file.read_text() for file in (base.release / 'build/dist/assets').glob('*.js'))
    for marker in ['画布快捷键', '调整画布与聊天宽度', '调整树库与工作区宽度', '工具与生成执行记录', '服务器网络异常，请稍后重试。']:
        if marker not in assets: raise RuntimeError('Missing released interface: ' + marker)
    worker = catalog.worker_hashes(container)
    if worker != json.loads((base.release / 'expected-worker.json').read_text()): raise RuntimeError('Worker build mismatch')
    return statuses
catalog.checks = checks
queue.checks = checks

previous_clone = catalog.clone_acceptance
def clone_acceptance():
    previous_clone()
    report = json.loads((base.release / 'clone-chat-errors-passed.json').read_text())
    if not report['failureUncharged']: raise RuntimeError('Failure billing check missing')
    import secrets
    container = base.stage_app
    challenge, _ = catalog.accepted(container,'POST','/api/auth/registration-challenge',{})
    left, operator, right = challenge['question'].split()[:3]
    username = 'DiagnosticCheck' + secrets.token_hex(4)
    account, cookie = catalog.accepted(container,'POST','/api/auth/register',{
        'username':username,'password':'Aa9!'+secrets.token_urlsafe(24),'email':username.lower()+'@example.invalid',
        'challengeId':challenge['challengeId'],'challengeAnswer':str(int(left)+int(right) if operator=='+' else int(left)-int(right))})
    csrf = account['csrfToken']
    trees, _ = catalog.accepted(container,'GET','/api/trees/public',cookie=cookie)
    entry, _ = catalog.accepted(container,'POST','/api/me/tree-library',{'treeId':trees['trees'][0]['id']},cookie,csrf)
    tutor, _ = catalog.accepted(container,'POST','/api/me/tavern/tree-conversations/'+entry['library_entry_id'],{},cookie,csrf)
    story = '/api/me/tavern/conversations/'+tutor['conversation']['conversationId']
    frames, _ = catalog.accepted(container,'POST',story+'/turns',{
        'clientActionId':'diagnostic-'+secrets.token_hex(4),'expectedRevision':tutor['graph']['revision'],
        'action':{'type':'reply','message':'Diagnostic canary'},
        'modelAccess':{'apiKey':'private-canary-placeholder','model':'deepseek-v4.1-flash','baseUrl':'https://anyai.token6688.com/v1'}},cookie,csrf,stream=True)
    if not any(frame['event']=='error' for frame in frames): raise RuntimeError('Invalid-key canary unexpectedly succeeded')
    saved, _ = catalog.accepted(container,'GET',story,cookie=cookie)
    events = saved.get('diagnostics',[])
    if not any(event['payload'].get('state')=='failed' for event in events): raise RuntimeError('Failed request lost independent diagnostics')
    if not any(event['payload'].get('phase')=='model_response' and event['payload'].get('status') in [401,403] for event in events): raise RuntimeError('Provider HTTP cause was not retained')
    if saved['generations'] or saved.get('cashCharges'): raise RuntimeError('Failed canary committed a reply or charge')
    if 'private-canary-placeholder' in json.dumps(events): raise RuntimeError('Diagnostics leaked credentials')
    (base.release / 'clone-tool-diagnostics-passed.json').write_text(json.dumps({
        'checkedAt':time.time(),'independentFailedRecords':True,'rawHttpCauseRetained':True,
        'failureUncharged':True,'realBillingAndReplayPassed':True},indent=2))
    catalog.accepted(container,'POST','/api/auth/logout',{},cookie,csrf)
catalog.clone_acceptance = clone_acceptance

def prepare():
    catalog.prepare()
    for directory in [journal, base.release / 'clone-diagnostics']:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        import os
        os.chown(directory, 10001, 10001)
    context = base.release / 'build'
    shutil.copytree(catalog.bundle / 'worker-dist', context / 'worker-dist')
    expected = json.loads((catalog.bundle / 'worker-hashes.json').read_text())
    (base.release / 'expected-worker.json').write_text(json.dumps(expected))
    dockerfile = context / 'Dockerfile'
    dockerfile.write_text(dockerfile.read_text() + 'COPY --chown=10001:10001 worker-dist/ /opt/mapflow/harness-worker/dist/\n')
    with (base.release / 'image-build.log').open('wb') as log:
        base.run(base.docker + ['build','--network=none','-t',base.image,str(context)], output=log)
    shutil.copy2(Path(__file__), base.release / Path(__file__).name)

def finish():
    before = json.loads((base.release / 'original-container.json').read_text())
    live = base.inspect(base.name)
    if live['Config']['Image'] != base.image: raise RuntimeError('Wrong production image')
    expected_env = before['Config']['Env'] + ['MAPFLOW_DIAGNOSTICS_DIR=/var/lib/mapflow/diagnostics']
    if live['Config']['Env'] != expected_env: raise RuntimeError('Unexpected runtime environment change')
    for key in ['User','Entrypoint','Cmd','WorkingDir']:
        if live['Config'].get(key) != before['Config'].get(key): raise RuntimeError('Runtime changed: ' + key)
    expected_binds = list(before['HostConfig'].get('Binds') or []) + [str(journal) + ':/var/lib/mapflow/diagnostics:rw']
    if live['HostConfig'].get('Binds') != expected_binds: raise RuntimeError('Journal mount mismatch')
    for key in ['PortBindings','Memory','NanoCpus','ReadonlyRootfs','CapDrop','SecurityOpt','RestartPolicy','Tmpfs']:
        if live['HostConfig'].get(key) != before['HostConfig'].get(key): raise RuntimeError('Host config changed: ' + key)
    manifest = json.loads((base.release / 'provenance.json').read_text())
    for label, part in [('com.mapflow.frontend.revision','frontend'),('org.opencontainers.image.revision','backend')]:
        if live['Config']['Labels'][label] != manifest[part]['commit']: raise RuntimeError('Source label mismatch')
    checks(18092)
    if catalog.payment_record() != (base.release / 'existing-payment.before').read_text(): raise RuntimeError('Prior payment changed')
    report_path = base.release / 'production-passed.json'
    report = json.loads(report_path.read_text())
    report.update(migration=37, sourceLabelsVerified=True, durableJournalMounted=True,
        workerVerified=True, priorPaymentPreserved=True, fullSuites=manifest['validation']['fullTests'])
    report_path.write_text(json.dumps(report,indent=2))
    (base.release / 'DEPLOYMENT.md').write_text('# Unified tool diagnostics\n\nFrontend main: `' + manifest['frontend']['commit'] + '`\nBackend main: `' + manifest['backend']['commit'] + '`\n\nIndependent attempt and tool records, detailed failed results returned to AI, native DSH final outcomes, durable journal and log-only replay. Failure recovery, draggable workspace panels, customizable canvas shortcuts, administrator request details. Migration 0037 is additive. Real receipt settlement and uncharged replay verified on the database clone. Application-only rollback; preserve database and diagnostic journal.\n')
    operations = root / 'OPERATIONS.md'
    _, remainder = operations.read_text().split('\n\n',1)
    operations.write_text('> **工具诊断与布局修复（2026-10-08）**：当前镜像 `' + base.image + '`，前后端 main；持久化工具错误、失败恢复及拖动布局。发布记录：`releases/20261008-unified-tools/`。\n\n' + remainder)
    print('Published unified tool diagnostics: main sources, durable journal, worker, billing, payments and access checks passed',flush=True)

if __name__ == '__main__':
    {'prepare':prepare,'canary':queue.canary,'resume-canary':catalog.resume_canary,'cutover':queue.cutover,'finish':finish}[sys.argv[1]]()
