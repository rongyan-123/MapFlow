"""Publish approved tool diagnostics using the established backup/clone/cutover workflow."""
from pathlib import Path
import copy, importlib.util, json, shutil, sys, time

root = Path('/opt/mapflow-laptop-migration-20261006')
source = root / 'releases/20261008-chat-reliability/mapflow-chat-reliability-release.py'
spec = importlib.util.spec_from_file_location('chat_release', source)
chat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chat)
catalog, base, queue = chat.catalog, chat.base, chat.queue
base.release = root / 'releases/20261008-streaming-output'
base.image = 'mapflow-server:streaming-output-20261008'
base.stage_db = 'mapflow-streaming-output-check-postgres'
base.stage_app = 'mapflow-streaming-output-check-app'
queue.previous_name = 'mapflow-laptop-app-before-streaming-output-20261008'
catalog.expected_previous = 'mapflow-server:unified-tools-20261008'
catalog.bundle = Path('/tmp/mapflow-streaming-output-bundle')
journal = root / 'state/tool-diagnostics'
original_run = base.run

def run(command, **kwargs):
    # Supply a writable durable journal to the clone despite its read-only root.
    if 'run' in command and base.stage_app in command and command[-1] == base.image:
        # The inherited production journal must stay isolated from clone events.
        filtered, index = [], 0
        while index < len(command):
            if command[index] == '--mount' and 'dst=/var/lib/mapflow/diagnostics' in command[index + 1].split(','):
                index += 2
                continue
            filtered.append(command[index])
            index += 1
        command = filtered
        command = command[:-1] + ['-e', 'MAPFLOW_DIAGNOSTICS_DIR=/var/lib/mapflow/diagnostics',
            '--mount', 'type=bind,src=' + str(base.release / 'clone-diagnostics') + ',dst=/var/lib/mapflow/diagnostics', base.image]
    if 'curl' in command and '--max-time' in command:
        command = list(command)
        index = command.index('--max-time') + 1
        if command[index] == '180': command[index] = '1000'
    return original_run(command, **kwargs)
base.run = run

original_create = queue.create_production
def create_production():
    original = queue.original
    config = copy.deepcopy(original())
    config['Config']['Env'] = [entry for entry in config['Config']['Env'] if not entry.startswith('MAPFLOW_DIAGNOSTICS_DIR=')]
    config['Config']['Env'].append('MAPFLOW_DIAGNOSTICS_DIR=/var/lib/mapflow/diagnostics')
    config['HostConfig']['Binds'] = list(config['HostConfig'].get('Binds') or [])
    if str(journal) + ':/var/lib/mapflow/diagnostics:rw' not in config['HostConfig']['Binds']:
        config['HostConfig']['Binds'].append(str(journal) + ':/var/lib/mapflow/diagnostics:rw')
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

def worker_hashes(container):
    expected = json.loads((base.release / 'expected-worker.json').read_text())
    paths = sorted(expected)
    return dict(zip(paths, [line.split()[0] for line in base.run(base.docker + ['exec', container, 'sha256sum', *paths]).decode().splitlines()]))
# Preparation captures the previous three-file baseline before expected-worker exists.
old_worker_hashes = catalog.worker_hashes
def verify_worker_hashes(container):
    return worker_hashes(container) if (base.release / 'expected-worker.json').exists() else old_worker_hashes(container)
catalog.worker_hashes = verify_worker_hashes

previous_clone = catalog.clone_acceptance
def clone_acceptance():
    previous_clone()
    import secrets, uuid, re
    from decimal import Decimal, ROUND_CEILING
    container = base.stage_app
    challenge, _ = catalog.accepted(container, 'POST', '/api/auth/registration-challenge', {})
    left, operator, right = challenge['question'].split()[:3]
    username = 'LongStream' + secrets.token_hex(4)
    account, cookie = catalog.accepted(container, 'POST', '/api/auth/register', {
        'username': username, 'password': 'Aa9!' + secrets.token_urlsafe(24), 'email': username.lower() + '@example.invalid',
        'challengeId': challenge['challengeId'], 'challengeAnswer': str(int(left)+int(right) if operator=='+' else int(left)-int(right))})
    csrf = account['csrfToken']
    account_id = str(uuid.UUID(catalog.clone_sql("UPDATE wallet_accounts w SET balance_micros=5000000 FROM accounts a WHERE w.account_id=a.account_id AND a.username_key='" + username.lower() + "' RETURNING w.account_id")))
    trees, _ = catalog.accepted(container, 'GET', '/api/trees/public', cookie=cookie)
    entry, _ = catalog.accepted(container, 'POST', '/api/me/tree-library', {'treeId':trees['trees'][0]['id']}, cookie, csrf)
    tutor, _ = catalog.accepted(container, 'POST', '/api/me/tavern/tree-conversations/'+entry['library_entry_id'], {}, cookie, csrf)
    created = tutor['conversation']
    if created['generationSettings']['maxOutputTokens'] is not None: raise RuntimeError('New conversation forced an output limit')
    story = '/api/me/tavern/conversations/'+created['conversationId']
    catalog.accepted(container, 'PATCH', story+'/tree-connection', {'expectedRevision':tutor['graph']['revision'],'libraryEntryId':None,'toolsEnabled':False}, cookie, csrf)
    catalog.accepted(container, 'PATCH', story+'/settings', {'expectedSettingsVersion':created['generationSettingsVersion'],
        'settings':{'maxOutputTokens':32768,'stopSequences':[]}}, cookie, csrf)
    detail, _ = catalog.accepted(container,'GET',story,cookie=cookie)
    turn = {'clientActionId':'long-'+secrets.token_hex(4),'expectedRevision':detail['graph']['revision'],
        'action':{'type':'reply','message':'请直接写一份深入、完整的中文长篇教学分析：操作系统中的进程、线程、Session、Run、Agent Process 和 Agent Runtime 的边界与关系。全文至少 16000 个中文字，分 20 章，每章至少 800 字，每章必须展开原理、一个具体例子、常见误解和适用边界。不同章节不要重复：分别覆盖生命周期、隔离、内存、并发、调度、取消、超时、持久化、数据库、日志、重试、工具调用、权限、流式输出、计费、故障恢复、部署、性能、测试和完整实例。不要输出摘要，不要省略，不要反问，不要调用工具，不要声称篇幅不够，不要提前结束。在这一条回复里完成全文。'},
        'platformModel':'deepseek-v4.1-flash','historyBytes':8192,'billingPolicy':'cash-v1-actual-x2'}
    started=time.time()
    print('Starting authorized real long-output billing test (32768 requested tokens)',flush=True)
    frames, _ = catalog.accepted(container,'POST',story+'/turns',turn,cookie,csrf,stream=True)
    (base.release/'long-stream-private.json').write_text(json.dumps(frames,ensure_ascii=False))
    completed=[frame['data'] for frame in frames if frame['event']=='completed']
    if len(completed)!=1: raise RuntimeError('Long output did not complete; diagnostics retained in cloned DB and private stream')
    paid=completed[0]
    output=paid['turn']['usage']['outputTokens']
    answer=paid['turn']['assistantMessage']
    chinese=sum(0x4E00 <= ord(character) <= 0x9FFF for character in answer)
    if output<=8192: raise RuntimeError('Long test did not exceed the old 8192 token boundary: '+str(output))
    receipt=json.loads(catalog.clone_sql("SELECT row_to_json(bill) FROM (SELECT upstream_cost_cny,amount_micros FROM wallet_tavern_charges WHERE account_id='"+account_id+"'::uuid) bill"))
    expected=int((Decimal(receipt['upstream_cost_cny'])*2000000).to_integral_value(rounding=ROUND_CEILING))
    after,_=catalog.accepted(container,'GET','/api/wallet',cookie=cookie)
    if expected<=0 or paid['cashCharge']['amountMicros']!=expected or receipt['amount_micros']!=expected or after['balanceMicros']!=5000000-expected: raise RuntimeError('Actual long-output billing mismatch')
    replay,_=catalog.accepted(container,'POST',story+'/turns',turn,cookie,csrf,stream=True)
    duplicate=[f['data'] for f in replay if f['event']=='completed']
    after_replay,_=catalog.accepted(container,'GET','/api/wallet',cookie=cookie)
    if not duplicate[-1]['idempotencyHit'] or after_replay!=after: raise RuntimeError('Long-output replay charged twice')
    # Conversation previews are intentionally bounded; inspect persisted model phases.
    records=json.loads(catalog.clone_sql("SELECT COALESCE(jsonb_agg(payload ORDER BY event_id),'[]'::jsonb) FROM tavern_execution_records WHERE account_id='"+account_id+"'::uuid AND action_id='"+turn['clientActionId']+"' AND payload->>'phase' IN ('model_request','model_finish','model_usage')"))
    if not any(r.get('phase')=='model_request' and r.get('maxTokens')==32768 for r in records): raise RuntimeError('Effective settings missing from diagnostics')
    if not any(r.get('phase')=='model_finish' and r.get('raw',{}).get('choices',[{}])[0].get('finish_reason')=='stop' for r in records): raise RuntimeError('Original successful finish not retained')
    if sum(r.get('phase')=='model_finish' for r in records)!=1: raise RuntimeError('Unfinished deltas were written as finish diagnostics')
    if not any(r.get('phase')=='model_usage' and r.get('raw',{}).get('completion_tokens')==output for r in records): raise RuntimeError('Measured usage not retained')
    reasoning=max((r.get('raw',{}).get('completion_tokens_details',{}).get('reasoning_tokens',0) for r in records if r.get('phase')=='model_usage'),default=0)
    report={'checkedAt':time.time(),'durationSeconds':round(time.time()-started,2),'model':'deepseek-v4.1-flash',
        'outputTokens':output,'inputTokens':paid['turn']['usage']['inputTokens'],'answerCharacters':len(answer),'chineseCharacters':chinese,
        'reasoningOutputTokens':reasoning,'answerOutputTokens':output-reasoning,'finishDiagnosticRecords':1,
        'requestedMaxTokens':32768,'upstreamCostCny':receipt['upstream_cost_cny'],'chargeMicros':expected,
        'actualCostTimesTwoVerified':True,'replayUncharged':True,'originalFinishAndUsageRetained':True,'newConversationModelDefault':True}
    (base.release/'clone-long-stream-passed.json').write_text(json.dumps(report,indent=2))
    catalog.accepted(container,'POST','/api/auth/logout',{},cookie,csrf)
    print('Long-output billing acceptance passed:',json.dumps(report),flush=True)
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
    expected_env = before['Config']['Env']
    if live['Config']['Env'] != expected_env: raise RuntimeError('Unexpected runtime environment change')
    for key in ['User','Entrypoint','Cmd','WorkingDir']:
        if live['Config'].get(key) != before['Config'].get(key): raise RuntimeError('Runtime changed: ' + key)
    expected_binds = list(before['HostConfig'].get('Binds') or [])
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
    report.update(migration=38, sourceLabelsVerified=True, durableJournalMounted=True,
        workerVerified=True, priorPaymentPreserved=True, fullSuites=manifest['validation']['fullTests'])
    report_path.write_text(json.dumps(report,indent=2))
    (base.release / 'DEPLOYMENT.md').write_text('# Streaming and output policy\n\nFrontend main: `' + manifest['frontend']['commit'] + '`\nBackend main: `' + manifest['backend']['commit'] + '`\n\nWheel shortcuts mouse+/mouse-, fixed cadence answer/reasoning presentation, process snapshot recovery, nullable model-default output and wide explicit limits, DSH parameter forwarding and tool-record permissions. Original finish/usage diagnostics and uncharged truncation. Migration 0038 changes untouched 2048 defaults to model defaults and preserves explicit settings and historical receipts. Real receipt settlement and uncharged replay verified on the database clone. Application-only rollback; preserve database and diagnostic journal.\n')
    operations = root / 'OPERATIONS.md'
    _, remainder = operations.read_text().split('\n\n',1)
    operations.write_text('> **滚轮、流式与输出限制修复（2026-10-08）**：当前镜像 `' + base.image + '`，前后端 main；滚轮绑定、流式缓冲、模型默认输出、完整结束记录；真实长输出账单已验收。发布记录：`releases/20261008-streaming-output/`。\n\n' + remainder)
    print('Published unified tool diagnostics: main sources, durable journal, worker, billing, payments and access checks passed',flush=True)

if __name__ == '__main__':
    {'prepare':prepare,'canary':queue.canary,'resume-canary':catalog.resume_canary,'cutover':queue.cutover,'finish':finish}[sys.argv[1]]()
