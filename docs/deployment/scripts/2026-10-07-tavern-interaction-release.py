"""Release a tested frontend on the existing laptop, retaining the running backend."""
from pathlib import Path
import hashlib, importlib.util, json, secrets, shutil, sys, time, urllib.request

root = Path('/opt/mapflow-laptop-migration-20261006')
prior_release = root / 'releases/20261007-granular-context'
spec = importlib.util.spec_from_file_location('community_release', root / 'releases/20261006-character-card-communities/mapflow-community-release-20261006.py')
frontend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frontend)
base, queue = frontend.base, frontend.queue
base.release = root / 'releases/20261007-tavern-interaction'
base.image = 'mapflow-server:tavern-interaction-20261007'
base.stage_db = 'mapflow-tavern-interaction-check-postgres'
base.stage_app = 'mapflow-tavern-interaction-check-app'
queue.previous_name = 'mapflow-laptop-app-before-tavern-interaction-20261007'
frontend.expected_previous = 'mapflow-server:granular-context-20261007'
frontend.bundle = Path('/tmp/mapflow-tavern-interaction-bundle')

def api(container, method, path, body=None, cookie=None, csrf=None):
    address = base.inspect(container)['NetworkSettings']['Networks'][base.network]['IPAddress']
    command = base.docker + ['exec', '-i', 'mapflow-laptop-caddy', 'curl', '-sS', '--max-time', '30', '-i', '-X', method,
        '-H', 'Host: xxian.fun', '-H', 'Origin: https://xxian.fun', '-H', 'X-Real-IP: 198.51.100.63', '-H', 'X-MapFlow-Proxy: caddy']
    if cookie: command += ['-H', 'Cookie: ' + cookie]
    if csrf: command += ['-H', 'X-CSRF-Token: ' + csrf]
    if body is not None: command += ['-H', 'Content-Type: application/json', '--data-binary', '@-']
    command += ['http://' + address + ':8080' + path]
    raw = base.run(command, input_bytes=None if body is None else json.dumps(body).encode())
    headers, payload = raw.split(b'\r\n\r\n', 1)
    status = int(headers.splitlines()[0].split()[1])
    session_cookie = next((line.split(b':', 1)[1].strip().split(b';')[0].decode() for line in headers.splitlines() if line.lower().startswith(b'set-cookie:')), None)
    return status, json.loads(payload) if payload.strip() else {}, session_cookie

def accepted(container, method, path, body=None, cookie=None, csrf=None):
    status, payload, session_cookie = api(container, method, path, body, cookie, csrf)
    if status not in [200, 201, 204]: raise RuntimeError('HTTP ' + str(status) + ': ' + method + ' ' + path)
    return payload, session_cookie

def retained_runtime_hashes(container):
    paths = ['/usr/local/bin/mapflow-server', '/usr/local/bin/mapflow-admin',
        '/opt/mapflow/harness-worker/dist/harness.js', '/opt/mapflow/harness-worker/dist/protocol.js', '/opt/mapflow/harness-worker/dist/main.js']
    return dict(zip(paths, [line.split()[0] for line in base.run(base.docker + ['exec', container, 'sha256sum', *paths]).decode().splitlines()]))

def payment_record():
    _, user, database = base.database_info()
    query = "SELECT amount_micros,(SELECT count(*) FROM wallet_ledger w WHERE w.topup_id=l.topup_id AND w.kind='topup') FROM wallet_ledger l WHERE topup_id='01a1113b-7b6e-7573-bc10-d89d284b93ee' AND kind='topup';"
    return base.run(base.docker + ['exec', 'mapflow-laptop-postgres', 'psql', '-U', user, '-d', database, '-XqAt', '-c', query]).decode().strip()

def checks(port):
    statuses = frontend.checks(port)
    assets = ''.join(path.read_text() for path in (base.release / 'build/dist/assets').glob('*.js'))
    for marker in ['新建会话', '模型参数', '使用模型默认', '高级参数', 'mapflow.tavern.model-preferences.v1.',
        'mapflow.tavern.selection.v1.', '收窄画布', '绘图讲解', '允许 AI 绘图', '输入（缓存命中）', '查找节点', '读取节点资料',
        '我的额度', '可以加入 Q 群：', '上游账号余额已耗尽']:
        if marker not in assets: raise RuntimeError('Missing feature in release: ' + marker)
    css = ''.join(path.read_text() for path in (base.release / 'build/dist/assets').glob('*.css'))
    if '.tavern-workspace' not in css or 'prefers-reduced-motion' not in css: raise RuntimeError('Missing canvas animation CSS')
    container = base.stage_app if port == 18094 else base.name
    for method, path in [('GET', '/api/admin/model-balance'), ('GET', '/api/admin/wallet/settings'),
        ('GET', '/api/me/tavern/conversations'), ('POST', '/api/me/tavern/conversations'),
        ('POST', '/api/me/tavern/tree-conversations/invalid'),
        ('PATCH', '/api/me/tavern/conversations/00000000-0000-0000-0000-000000000001/settings')]:
        if api(container, method, path, None if method == 'GET' else {})[0] != 401:
            raise RuntimeError('Anonymous access accepted: ' + path)
    return statuses

queue.checks = checks

def clone_acceptance():
    container = base.stage_app
    challenge, _ = accepted(container, 'POST', '/api/auth/registration-challenge', {})
    left, operator, right = challenge['question'].split()[:3]
    username = 'InteractionCheck' + secrets.token_hex(4)
    account, cookie = accepted(container, 'POST', '/api/auth/register', {
        'username': username, 'password': 'Aa9!' + secrets.token_urlsafe(24), 'email': username.lower() + '@example.invalid',
        'challengeId': challenge['challengeId'], 'challengeAnswer': str(int(left) + int(right) if operator == '+' else int(left) - int(right))})
    csrf = account['csrfToken']
    before, _ = accepted(container, 'GET', '/api/wallet', cookie=cookie)
    catalog, _ = accepted(container, 'GET', '/api/trees/public', cookie=cookie)
    added, _ = accepted(container, 'POST', '/api/me/tree-library', {'treeId': catalog['trees'][0]['id']}, cookie, csrf)
    entry_id = added['library_entry_id']
    original, _ = accepted(container, 'POST', '/api/me/tavern/tree-conversations/' + entry_id, {}, cookie, csrf)
    old_story = '/api/me/tavern/conversations/' + original['conversation']['conversationId']
    old_before, _ = accepted(container, 'GET', old_story, cookie=cookie)
    created_ids = []
    for enabled in [False, True]:
        fresh, _ = accepted(container, 'POST', '/api/me/tavern/conversations', {
            'characterId': original['character']['characterId'], 'userName': username, 'greetingIndex': 0}, cookie, csrf)
        story = '/api/me/tavern/conversations/' + fresh['conversationId']
        linked, _ = accepted(container, 'PATCH', story + '/tree-connection', {
            'expectedRevision': 0, 'libraryEntryId': entry_id, 'toolsEnabled': enabled}, cookie, csrf)
        restored, _ = accepted(container, 'GET', story, cookie=cookie)
        if restored != linked or restored['conversation']['treeToolsEnabled'] != enabled or restored['conversation']['libraryEntryId'] != entry_id:
            raise RuntimeError('New conversation association or permission mismatch')
        settings = {'temperature': .65, 'maxOutputTokens': 1024, 'stopSequences': ['END']}
        result, _ = accepted(container, 'PATCH', story + '/settings', {'expectedSettingsVersion': fresh['generationSettingsVersion'], 'settings': settings}, cookie, csrf)
        if result['generationSettings'] != settings: raise RuntimeError('Parameter save differs')
        if api(container, 'PATCH', story + '/settings', {'expectedSettingsVersion': fresh['generationSettingsVersion'], 'settings': settings}, cookie, csrf)[0] != 409:
            raise RuntimeError('Stale parameter version accepted')
        latest, _ = accepted(container, 'GET', story, cookie=cookie)
        if latest['conversation']['generationSettings'] != settings: raise RuntimeError('Saved parameters missing on reload')
        created_ids.append(fresh['conversationId'])
    history, _ = accepted(container, 'GET', '/api/me/tavern/conversations', cookie=cookie)
    ids = {story['conversationId'] for story in history['conversations']}
    if not set(created_ids + [original['conversation']['conversationId']]).issubset(ids): raise RuntimeError('Saved history missing')
    old_after, _ = accepted(container, 'GET', old_story, cookie=cookie)
    after, _ = accepted(container, 'GET', '/api/wallet', cookie=cookie)
    if old_before != old_after or before != after: raise RuntimeError('Session/configuration operations changed old chat or cash')
    if retained_runtime_hashes(container) != json.loads((base.release / 'retained-runtime.json').read_text()): raise RuntimeError('Runtime artifact changed')
    accepted(container, 'POST', '/api/auth/logout', {}, cookie, csrf)
    (base.release / 'clone-interaction-passed.json').write_text(json.dumps({
        'checkedAt': time.time(), 'databaseCloned': True, 'newSessionBothPermissions': True, 'sharedServerHistory': True,
        'originalConversationPreserved': True, 'parametersPersisted': True, 'staleParametersRejected': True,
        'cashUnchanged': True, 'paidCalls': 0, 'retainedBackendAndWorker': True}, indent=2))
    print('Clone acceptance passed: new sessions, both tool permissions, shared history, parameters, unchanged cash; no paid generation.', flush=True)

previous_ready = base.ready
def ready(port):
    previous_ready(port)
    if port == 18094: clone_acceptance()
base.ready = ready

def prepare():
    frontend.prepare()
    (base.release / 'retained-runtime.json').write_text(json.dumps(retained_runtime_hashes(base.name), indent=2))
    base.private_write(base.release / 'existing-payment.before', payment_record())
    for artifact in ['frontend-tests.log', 'frontend-build.log', 'browser-smoke.log', 'browser-report.json']:
        shutil.copy2(frontend.bundle / artifact, base.release / artifact)
    shutil.copy2(Path(__file__), base.release / Path(__file__).name)

def finish():
    # Reuse the established source-label, public-health and runtime comparison checks.
    frontend.finish()
    before_hashes = json.loads((base.release / 'retained-runtime.json').read_text())
    if retained_runtime_hashes(base.name) != before_hashes: raise RuntimeError('Backend or DSH worker changed')
    if payment_record() != (base.release / 'existing-payment.before').read_text(): raise RuntimeError('Prior payment record changed')
    report_path = base.release / 'production-passed.json'
    report = json.loads(report_path.read_text()); report.update(migration=36, retainedBackendAndWorker=True, retainedPriorPayment=True, interactionClonePassed=True, paidCalls=0)
    report_path.write_text(json.dumps(report, indent=2))
    manifest = json.loads((base.release / 'provenance.json').read_text())
    (base.release / 'DEPLOYMENT.md').write_text('# Tavern interaction\n\nFrontend main: `' + manifest['frontend']['commit'] +
        '`\nBackend retained: `' + manifest['backend']['commit'] + '`\nImage: `' + base.image +
        '`\n\nAccount-scoped model preferences without API-key persistence; new shared tree sessions retaining tool permission; '
        'animated teaching canvas retaining editor/undo; independent model parameter dialog. Full UI tests, typecheck/build, '
        'real editor with controlled API and cloned-database real session/settings APIs passed. No paid generation. '
        'Backend, DSH worker, runtime, ports, tunnel and prior payment preserved. Application-only rollback.\n')
    operations = root / 'OPERATIONS.md'
    _, existing = operations.read_text().split('\n\n', 1)
    operations.write_text('> **酒馆交互更新（2026-10-07）**：当前镜像 `' + base.image + '`；前端 main `' + manifest['frontend']['commit'] +
        '`；后端和 DSH worker 沿用已验证的颗粒化工具版本。资料与回滚：`releases/20261007-tavern-interaction/`。\n\n' + existing)
    print('Tavern interaction published; source, runtime, backend/worker and prior payment verified.', flush=True)

if __name__ == '__main__':
    {'prepare': prepare, 'canary': queue.canary, 'cutover': queue.cutover, 'finish': finish}[sys.argv[1]]()
