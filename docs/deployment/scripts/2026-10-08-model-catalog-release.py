"""Deploy tested main catalog and reference pricing with an isolated billing canary."""
from pathlib import Path
from decimal import Decimal, ROUND_CEILING
import importlib.util, json, secrets, shutil, sys, time, urllib.request, uuid

root = Path('/opt/mapflow-laptop-migration-20261006')
path = root / 'releases/20261006-character-card-communities/mapflow-community-release-20261006.py'
spec = importlib.util.spec_from_file_location('previous_release', path)
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, queue = previous.base, previous.queue
base.release = root / 'releases/20261008-model-catalog'
base.image = 'mapflow-server:model-catalog-20261008'
base.stage_db = 'mapflow-model-catalog-check-postgres'
base.stage_app = 'mapflow-model-catalog-check-app'
queue.previous_name = 'mapflow-laptop-app-before-model-catalog-20261008'
bundle = Path('/tmp/mapflow-model-catalog-bundle')
expected_previous = 'mapflow-server:tavern-interaction-ui-20261007'

def api(container, method, path, body=None, cookie=None, csrf=None, stream=False):
    address = base.inspect(container)['NetworkSettings']['Networks'][base.network]['IPAddress']
    command = base.docker + ['exec', '-i', 'mapflow-laptop-caddy', 'curl', '-sS', '--max-time', '180' if stream else '60', '-i', '-X', method,
        '-H', 'Host: xxian.fun', '-H', 'Origin: https://xxian.fun', '-H', 'X-Real-IP: 198.51.100.73', '-H', 'X-MapFlow-Proxy: caddy']
    if cookie: command += ['-H', 'Cookie: ' + cookie]
    if csrf: command += ['-H', 'X-CSRF-Token: ' + csrf]
    if stream: command += ['-H', 'Accept: text/event-stream']
    if body is not None: command += ['-H', 'Content-Type: application/json', '--data-binary', '@-']
    command += ['http://' + address + ':8080' + path]
    raw = base.run(command, input_bytes=None if body is None else json.dumps(body).encode())
    headers, payload = raw.split(b'\r\n\r\n', 1)
    status = int(headers.splitlines()[0].split()[1])
    session_cookie = next((line.split(b':', 1)[1].strip().split(b';')[0].decode() for line in headers.splitlines() if line.lower().startswith(b'set-cookie:')), None)
    if status not in [200, 201, 204]: return status, {}, session_cookie
    if stream:
        frames, event = [], ''
        for line in payload.decode().splitlines():
            if line.startswith('event:'): event = line[6:].strip()
            elif line.startswith('data:'): frames.append({'event': event, 'data': json.loads(line[5:].strip())})
        return status, frames, session_cookie
    return status, json.loads(payload) if payload.strip() else {}, session_cookie

def accepted(container, method, path, body=None, cookie=None, csrf=None, stream=False):
    status, payload, session_cookie = api(container, method, path, body, cookie, csrf, stream)
    if status not in [200, 201, 204]: raise RuntimeError('HTTP ' + str(status) + ' ' + method + ' ' + path)
    return payload, session_cookie

def payment_record():
    _, user, database = base.database_info()
    query = "SELECT amount_micros,(SELECT count(*) FROM wallet_ledger w WHERE w.topup_id=l.topup_id AND w.kind='topup') FROM wallet_ledger l WHERE topup_id='01a1113b-7b6e-7573-bc10-d89d284b93ee' AND kind='topup';"
    return base.run(base.docker + ['exec', 'mapflow-laptop-postgres', 'psql', '-U', user, '-d', database, '-XqAt', '-c', query]).decode().strip()

def worker_hashes(container):
    files = ['/opt/mapflow/harness-worker/dist/harness.js', '/opt/mapflow/harness-worker/dist/protocol.js', '/opt/mapflow/harness-worker/dist/main.js']
    return dict(zip(files, [line.split()[0] for line in base.run(base.docker + ['exec', container, 'sha256sum', *files]).decode().splitlines()]))

def checks(port):
    container = base.stage_app if port == 18094 else base.name
    statuses = {}
    for method, path in [('GET', '/api/wallet'), ('GET', '/api/admin/model-balance'), ('GET', '/api/admin/wallet/settings'),
        ('GET', '/api/me/tavern/conversations'), ('POST', '/api/me/tavern/conversations'),
        ('POST', '/api/me/tavern/model-access/test'), ('POST', '/api/me/tavern/tree-conversations/invalid')]:
        statuses[path] = api(container, method, path, None if method == 'GET' else {})[0]
        if statuses[path] != 401: raise RuntimeError('Anonymous privileged access accepted: ' + path)
    catalog, _ = accepted(container, 'GET', '/api/model-catalog/byok')
    if len(catalog) != 51 or len({model['id'] for model in catalog}) != 51: raise RuntimeError('Model catalog incomplete')
    flash = next(model for model in catalog if model['id'] == 'deepseek-v4.1-flash')
    if flash['contextWindow'] != 1048576 or flash['displayName'] != 'DeepSeek V4.1 Flash': raise RuntimeError('Flash metadata mismatch')
    assets = ''.join(file.read_text() for file in (base.release / 'build/dist/assets').glob('*.js'))
    for marker in ['缓存命中参考价', '输入参考价', '输出参考价', '计费倍率', 'deepseek-v4.1-flash', '新建会话',
        '教学画布', '查找节点', '读取节点资料', '我的额度', '可以加入 Q 群：']:
        if marker not in assets: raise RuntimeError('Missing released feature: ' + marker)
    for marker in ['按上游实际扣费 × 2', '上游实扣 × 2', '确认本次费用']:
        if marker in assets: raise RuntimeError('Obsolete billing copy retained')
    if worker_hashes(container) != json.loads((base.release / 'retained-worker.json').read_text()): raise RuntimeError('DSH worker unexpectedly changed')
    return statuses

queue.checks = checks
original_ready = base.ready

def clone_sql(query):
    _, user, database = base.database_info()
    return base.run(base.docker + ['exec', '-i', base.stage_db, 'psql', '-U', user, '-d', database, '-XqAt', '-v', 'ON_ERROR_STOP=1'], input_bytes=query.encode()).decode().strip()

def clone_acceptance():
    container = base.stage_app
    catalog, _ = accepted(container, 'GET', '/api/model-catalog/pricing')
    if len(catalog['models']) != 51 or '0.2' not in catalog['multiplierLabel']: raise RuntimeError('Pricing catalog missing')
    key = (root / 'runtime/secrets/tavern-anyai-api-key').read_text().strip()
    request = urllib.request.Request('https://anyai.token6688.com/v1/skills/models/deepseek-v4.1-flash/pricing', headers={'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(request, timeout=30) as response: raw = json.load(response)
    flash = next(model for model in catalog['models'] if model['id'] == 'deepseek-v4.1-flash')
    quote = flash['pricing']
    if quote['basis'] != 'upstream_reference': raise RuntimeError('Reference prices use the wrong basis')
    for channel in quote['channels']:
        source = next(group for group in raw['channel_groups'] if group['vendor'] == channel['vendor'] and group['lane_no'] == channel['lane'])
        for original, public in [('user_price_per_million_input_rmb', 'inputMicrosPerMillion'), ('user_price_per_million_output_rmb', 'outputMicrosPerMillion')]:
            expected = int((Decimal(str(source[original])) * 1_000_000).to_integral_value(rounding=ROUND_CEILING))
            if channel[public] != expected: raise RuntimeError('Reference price was multiplied or altered')
    priced_count = sum(model['pricing'] is not None for model in catalog['models'])
    if priced_count != 51: raise RuntimeError('Not all verified models retrieved their live prices')
    challenge, _ = accepted(container, 'POST', '/api/auth/registration-challenge', {})
    left, operator, right = challenge['question'].split()[:3]
    username = 'CatalogCheck' + secrets.token_hex(4)
    account, cookie = accepted(container, 'POST', '/api/auth/register', {'username': username,
        'password': 'Aa9!' + secrets.token_urlsafe(24), 'email': username.lower() + '@example.invalid',
        'challengeId': challenge['challengeId'], 'challengeAnswer': str(int(left) + int(right) if operator == '+' else int(left) - int(right))})
    csrf = account['csrfToken']
    account_id = str(uuid.UUID(clone_sql("UPDATE wallet_accounts w SET balance_micros=5000000 FROM accounts a WHERE w.account_id=a.account_id AND a.username_key='" + username.lower() + "' RETURNING w.account_id")))
    trees, _ = accepted(container, 'GET', '/api/trees/public', cookie=cookie)
    entry, _ = accepted(container, 'POST', '/api/me/tree-library', {'treeId': trees['trees'][0]['id']}, cookie, csrf)
    tutor, _ = accepted(container, 'POST', '/api/me/tavern/tree-conversations/' + entry['library_entry_id'], {}, cookie, csrf)
    created = tutor['conversation']
    story = '/api/me/tavern/conversations/' + created['conversationId']
    accepted(container, 'PATCH', story + '/tree-connection', {'expectedRevision': tutor['graph']['revision'],
        'libraryEntryId': None, 'toolsEnabled': False}, cookie, csrf)
    accepted(container, 'PATCH', story + '/settings', {'expectedSettingsVersion': created['generationSettingsVersion'],
        'settings': {'maxOutputTokens': 1024, 'stopSequences': []}}, cookie, csrf)
    detail, _ = accepted(container, 'GET', story, cookie=cookie)
    turn = {'clientActionId': 'catalog-' + secrets.token_hex(4), 'expectedRevision': detail['graph']['revision'],
        'action': {'type': 'reply', 'message': '只回复一句：连接成功。不要调用任何工具。'}, 'platformModel': 'deepseek-v4.1-flash',
        'historyBytes': 8192, 'billingPolicy': 'cash-v1-actual-x2'}
    frames, _ = accepted(container, 'POST', story + '/turns', turn, cookie, csrf, stream=True)
    completed = [frame['data'] for frame in frames if frame['event'] == 'completed']
    if not completed:
        (base.release / 'failed-model-canary.json').write_text(json.dumps(frames, ensure_ascii=False, indent=2))
        raise RuntimeError('New Flash model did not complete; private stream retained')
    paid = completed[-1]
    receipt = json.loads(clone_sql("SELECT row_to_json(bill) FROM (SELECT upstream_cost_cny,amount_micros FROM wallet_tavern_charges WHERE account_id='" + account_id + "'::uuid) bill"))
    expected = int((Decimal(receipt['upstream_cost_cny']) * 2_000_000).to_integral_value(rounding=ROUND_CEILING))
    after, _ = accepted(container, 'GET', '/api/wallet', cookie=cookie)
    if expected <= 0 or paid['cashCharge']['amountMicros'] != expected or receipt['amount_micros'] != expected or after['balanceMicros'] != 5_000_000 - expected:
        raise RuntimeError('Actual charge does not equal the upstream receipt times two')
    replay, _ = accepted(container, 'POST', story + '/turns', turn, cookie, csrf, stream=True)
    duplicate = [frame['data'] for frame in replay if frame['event'] == 'completed']
    after_replay, _ = accepted(container, 'GET', '/api/wallet', cookie=cookie)
    if not duplicate[-1]['idempotencyHit'] or after_replay != after: raise RuntimeError('Replay debited cash twice')
    report = {'checkedAt': time.time(), 'clonedDatabase': True, 'models': 51, 'livePricedModels': priced_count,
        'referencePricesMatchUpstream': True, 'realModel': 'deepseek-v4.1-flash', 'upstreamCostCny': receipt['upstream_cost_cny'],
        'chargeMicros': expected, 'actualCostTimesTwoVerified': True, 'replayUncharged': True,
        'streamingVerified': any(frame['event'] == 'delta' for frame in frames)}
    (base.release / 'clone-model-catalog-passed.json').write_text(json.dumps(report, indent=2))
    accepted(container, 'POST', '/api/auth/logout', {}, cookie, csrf)
    print('Clone passed: 51 live prices, unchanged reference quotes, actual Flash response, receipt times two, uncharged replay:', expected, 'micros', flush=True)

def ready(port):
    original_ready(port)
    if port == 18094:
        checks(port)
        clone_acceptance()
base.ready = ready

def resume_canary():
    if base.inspect(base.stage_app)['Config']['Image'] != base.image:
        raise RuntimeError('Unexpected isolated canary image')
    ready(18094)
    denied = api(base.stage_app, 'GET', '/api/wallet')[0]
    forged = api(base.stage_app, 'GET', '/api/wallet/payments/vmq/notify?payId=forged')[0]
    if (denied, forged) != (401, 400): raise RuntimeError('Canary wallet or callback access failed')
    with urllib.request.urlopen('http://127.0.0.1:18094/', timeout=5) as response:
        if b'index-' not in response.read(): raise RuntimeError('Canary frontend absent')
    (base.release / 'canary-passed.json').write_text(json.dumps({'ready': True, 'checks': {'wallet': denied, 'forgedCallback': forged}, 'checkedAt': time.time()}))
    for name in [base.stage_app, base.stage_db]:
        base.run(base.docker + ['stop', name]); base.run(base.docker + ['rm', name])
    print('Cloned database canary and retained wallet access passed', flush=True)

def create_production():
    original = queue.original()
    config = {key: original['Config'][key] for key in ['User', 'Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'ExposedPorts', 'Healthcheck', 'StopSignal'] if key in original['Config']}
    config['Labels'] = {**original['Config']['Labels'], **base.inspect(base.image)['Config']['Labels']}
    config['Image'] = base.image
    config['HostConfig'] = original['HostConfig']
    endpoint = original['NetworkSettings']['Networks'][base.network]
    config['NetworkingConfig'] = {'EndpointsConfig': {base.network: {'Aliases': [alias for alias in endpoint.get('Aliases', []) or [] if len(alias) != 64], 'IPAMConfig': {'IPv4Address': endpoint['IPAddress']}}}}
    connection = queue.DockerConnection('localhost')
    connection.request('POST', '/containers/create?name=' + base.name, json.dumps(config), {'Content-Type': 'application/json'})
    response = connection.getresponse(); response.read()
    if response.status != 201: raise RuntimeError('Production container creation failed')
    connection.close(); base.run(base.docker + ['start', base.name])
queue.create_production = create_production

def prepare():
    manifest = json.loads((bundle / 'provenance.json').read_text())
    if any(manifest[part]['branch'] != 'main' for part in ['frontend', 'backend']): raise RuntimeError('Main sources required')
    live = base.inspect(base.name)
    if live['Config']['Image'] != expected_previous: raise RuntimeError('Production changed during validation')
    base.release.mkdir(mode=0o700)
    base.private_write(base.release / 'original-container.json', json.dumps(live))
    for artifact in ['provenance.json', 'frontend-source.tar.gz', 'backend-source.tar.gz', 'frontend-tests.log',
        'frontend-build.log', 'backend-tests.log', 'backend-clippy.log', 'backend-fmt.log', 'browser-smoke.log', 'browser-report.json']:
        shutil.copy2(bundle / artifact, base.release / artifact)
    base.backup(base.release / 'canary-source.dump')
    base.private_write(base.release / 'existing-payment.before', payment_record())
    (base.release / 'retained-worker.json').write_text(json.dumps(worker_hashes(base.name), indent=2))
    context = base.release / 'build'; context.mkdir()
    shutil.copytree(bundle / 'dist', context / 'dist')
    for binary in ['mapflow-server', 'mapflow-admin']: shutil.copy2(bundle / binary, context / binary)
    (context / 'Dockerfile').write_text('FROM ' + expected_previous + '\n'
        'LABEL org.opencontainers.image.revision="' + manifest['backend']['commit'] + '"\n'
        'LABEL com.mapflow.frontend.revision="' + manifest['frontend']['commit'] + '" com.mapflow.source.branch="main"\n'
        'COPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\n'
        'COPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\n'
        'COPY --chown=10001:10001 dist/ /srv/mapflow/\n')
    with (base.release / 'image-build.log').open('wb') as log: base.run(base.docker + ['build', '--network=none', '-t', base.image, str(context)], output=log)
    shutil.copy2(Path(__file__), base.release / Path(__file__).name)
    print('Tested main image prepared; production payment and worker baselines saved', flush=True)

def finish():
    before = json.loads((base.release / 'original-container.json').read_text())
    live = base.inspect(base.name)
    manifest = json.loads((base.release / 'provenance.json').read_text())
    if live['Config']['Image'] != base.image: raise RuntimeError('Wrong production image')
    for key in ['Env', 'User', 'Entrypoint', 'Cmd', 'WorkingDir']:
        if live['Config'].get(key) != before['Config'].get(key): raise RuntimeError('Runtime changed: ' + key)
    for key in ['Binds', 'PortBindings', 'Memory', 'NanoCpus', 'ReadonlyRootfs', 'CapDrop', 'SecurityOpt', 'RestartPolicy', 'Tmpfs']:
        if live['HostConfig'].get(key) != before['HostConfig'].get(key): raise RuntimeError('Host config changed: ' + key)
    for label, part in [('com.mapflow.frontend.revision', 'frontend'), ('org.opencontainers.image.revision', 'backend')]:
        if live['Config']['Labels'][label] != manifest[part]['commit']: raise RuntimeError('Source label mismatch')
    checks(18092)
    if payment_record() != (base.release / 'existing-payment.before').read_text(): raise RuntimeError('Prior payment changed')
    with urllib.request.urlopen('https://xxian.fun/health/ready', timeout=20) as response:
        if response.status != 200: raise RuntimeError('Public health failed')
    report_path = base.release / 'production-passed.json'
    report = json.loads(report_path.read_text())
    report.update(referencePricingVerified=True, catalogModels=51, actualCostTimesTwoVerified=True,
        sourceLabelsVerified=True, retainedWorker=True, retainedPayment=True, runtimePreserved=True, migration=36)
    report_path.write_text(json.dumps(report, indent=2))
    (base.release / 'DEPLOYMENT.md').write_text('# Model catalog and reference prices\n\nFrontend main: `' + manifest['frontend']['commit'] + '`\nBackend main: `' + manifest['backend']['commit'] + '`\nImage: `' + base.image + '`\n\n51 verified provider chat aliases and parameter schemas. Reference prices are unchanged provider quotes; cache fallback is a labelled 10% reference estimate. Displayed billing multiplier is 0.2. Actual measured receipts still settle once at twice the upstream cost. Opaque high-layer tree menu, channel cards and separate input/cache/output rows. Full suites and desktop/mobile browser checks passed. A cloned database verified all 51 live price snapshots and a real Flash 4.1 streamed reply, exact bill and uncharged replay. DSH worker, runtime and prior payment preserved. Rollback application only.\n')
    operations = root / 'OPERATIONS.md'
    _, remainder = operations.read_text().split('\n\n', 1)
    operations.write_text('> **模型目录与参考价格（2026-10-08）**：当前镜像 `' + base.image + '`，前后端 main；51 个聊天模型，参考价保留原值，实扣仍按账单结算。发布记录：`releases/20261008-model-catalog/`。\n\n' + remainder)
    print('Published main catalog; public health, source labels, runtime, worker and prior payment verified', flush=True)

if __name__ == '__main__':
    {'prepare': prepare, 'canary': queue.canary, 'resume-canary': resume_canary, 'cutover': queue.cutover, 'finish': finish}[sys.argv[1]]()
