"""Root-only laptop release: publish main sources, retain secrets and never restore payment data."""
from pathlib import Path
from decimal import Decimal, ROUND_CEILING
import copy
import hashlib
import importlib.util
import json
import os
import re
import secrets
import shutil
import sys
import time
import urllib.request

helpers = Path('/opt/mapflow-laptop-migration-20261006/releases/20261006-main-integration')
spec = importlib.util.spec_from_file_location('main_release', helpers / '2026-10-06-main-integration-release.py')
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)
base, queue = main.base, main.queue
base.release = base.root / 'releases/20261007-tavern-cash'
base.image = 'mapflow-server:tavern-cash-20261007'
base.stage_db = 'mapflow-tavern-cash-check-postgres'
base.stage_app = 'mapflow-tavern-cash-check-app'
queue.previous_name = 'mapflow-laptop-app-before-tavern-cash-20261007'
bundle = Path('/tmp/mapflow-tavern-cash-bundle')
expected_previous = 'mapflow-server:character-card-communities-20261006'
key_source = Path('/home/rong/.local/state/mapflow/wallet-preview-20260930/anyai-api-key')
key_destination = base.root / 'runtime/secrets/tavern-anyai-api-key'
key_target = '/run/secrets/tavern-anyai-api-key'
main_checks = queue.checks
read_original = queue.original


def manifest():
    source = json.loads((base.release / 'provenance.json').read_text())
    for component in ['frontend', 'backend']:
        if source[component]['branch'] != 'main' or not re.fullmatch('[0-9a-f]{40}', source[component]['commit']):
            raise RuntimeError('release requires verified main commits')
    return source


def configured_original():
    previous = copy.deepcopy(read_original())
    environment = {item.split('=', 1)[0]: item.split('=', 1)[1] for item in previous['Config']['Env']}
    environment.update(MAPFLOW_TAVERN_PLATFORM_CASH='true', MAPFLOW_TAVERN_PLATFORM_TRIAL='false', MAPFLOW_TAVERN_ANYAI_API_KEY_FILE=key_target)
    previous['Config']['Env'] = [name + '=' + value for name, value in environment.items()]
    labels = dict(previous['Config'].get('Labels') or {})
    source = manifest()
    labels.update({'org.opencontainers.image.revision': source['backend']['commit'],
                   'com.mapflow.frontend.revision': source['frontend']['commit'], 'com.mapflow.source.branch': 'main'})
    previous['Config']['Labels'] = labels
    if any(mount['Destination'] == key_target for mount in previous['Mounts']):
        raise RuntimeError('unexpected existing billing secret mount')
    previous['Mounts'].append({'Type': 'bind', 'Source': str(key_destination), 'Destination': key_target})
    previous['HostConfig']['Binds'] = (previous['HostConfig'].get('Binds') or []) + [str(key_destination) + ':' + key_target + ':ro']
    return previous


queue.original = configured_original


def checks(port):
    statuses = main_checks(port)
    asset_text = ''.join(path.read_text() for path in (base.release / 'build/dist/assets').glob('*.js'))
    for content in ['创建角色卡', '确认本次费用', '本次费用', '真实监控', '估算数据', 'https://discord.gg/odysseia', 'https://discord.gg/UZ8JcvFFks']:
        if content not in asset_text:
            raise RuntimeError('missing merged feature: ' + content)
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/model-catalog/pricing', timeout=40) as response:
        pricing = json.load(response)
    if pricing['multiplierLabel'] != '上游实扣 × 2' or not any(model['pricing'] for model in pricing['models']):
        raise RuntimeError('trusted server pricing is unavailable')
    return statuses


queue.checks = checks


def api(container, method, path, body=None, cookie=None, csrf=None, content_type='application/json'):
    address = base.inspect(container)['NetworkSettings']['Networks'][base.network]['IPAddress']
    command = base.docker + ['exec', '-i', 'mapflow-laptop-caddy', 'curl', '-sS', '--max-time', '150', '-i', '-X', method,
                             '-H', 'Host: xxian.fun', '-H', 'Origin: https://xxian.fun', '-H', 'X-Real-IP: 198.51.100.57',
                             '-H', 'X-MapFlow-Proxy: caddy']
    if cookie:
        command += ['-H', 'Cookie: ' + cookie]
    if csrf:
        command += ['-H', 'X-CSRF-Token: ' + csrf]
    if body is not None:
        command += ['-H', 'Content-Type: ' + content_type, '--data-binary', '@-']
    command += [f'http://{address}:8080' + path]
    encoded = body if isinstance(body, bytes) else None if body is None else json.dumps(body).encode()
    raw = base.run(command, input_bytes=encoded)
    headers, payload = raw.split(b'\r\n\r\n', 1)
    status = int(headers.splitlines()[0].split()[1])
    received_cookie = next((line.split(b':', 1)[1].strip().split(b';')[0].decode() for line in headers.splitlines() if line.lower().startswith(b'set-cookie:')), None)
    if status >= 400:
        error = json.loads(payload).get('error', {})
        raise RuntimeError(f'acceptance API rejected {path}: {status} {error.get("code", "unknown")}')
    return payload, received_cookie


def json_api(*args, **kwargs):
    payload, cookie = api(*args, **kwargs)
    return json.loads(payload), cookie


def paid_acceptance(container, database_container, filename, allow_real_call):
    question, _ = json_api(container, 'POST', '/api/auth/registration-challenge', {})
    left, operator, right = question['question'].split()[:3]
    answer = int(left) + int(right) if operator == '+' else int(left) - int(right)
    username = 'CashCheck' + secrets.token_hex(4)
    registered, cookie = json_api(container, 'POST', '/api/auth/register', {
        'username': username, 'password': 'Aa9!' + secrets.token_urlsafe(24),
        'challengeId': question['challengeId'], 'challengeAnswer': str(answer)})
    csrf = registered['csrfToken']
    catalogue, _ = json_api(container, 'GET', '/api/me/tavern/platform-models', cookie=cookie)
    if not catalogue['enabled'] or catalogue['billingMode'] != 'wallet' or catalogue['policyVersion'] != 'cash-v1-actual-x2':
        raise RuntimeError('paid platform opt-in missing')
    card = {'schemaVersion': 1, 'sourceFormat': 'json', 'name': '费用验收', 'description': 'Reply OK when greeted.',
            'personality': '', 'scenario': '', 'firstMessage': 'Hello.', 'exampleDialogue': '', 'systemPrompt': '',
            'postHistoryInstructions': '', 'creatorNotes': '', 'alternateGreetings': [], 'lorebook': [], 'warnings': []}
    boundary = 'mapflow-cash-' + secrets.token_hex(12)
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="normalized_card"\r\n\r\n' +
                 json.dumps(card) + f'\r\n--{boundary}--\r\n').encode()
    imported, _ = json_api(container, 'POST', '/api/me/tavern/characters', multipart, cookie, csrf,
                            content_type='multipart/form-data; boundary=' + boundary)
    conversation, _ = json_api(container, 'POST', '/api/me/tavern/conversations',
                                {'characterId': imported['characterId'], 'userName': 'Tester', 'greetingIndex': 0}, cookie, csrf)
    root = '/api/me/tavern/conversations/' + conversation['conversationId']
    json_api(container, 'PATCH', root + '/settings', {'expectedSettingsVersion': conversation['generationSettingsVersion'],
              'settings': {'maxOutputTokens': 128, 'stopSequences': []}}, cookie, csrf)
    detail, _ = json_api(container, 'GET', root, cookie=cookie)
    quote_input = {'expectedRevision': detail['graph']['revision'], 'action': {'type': 'reply', 'message': 'Hi. Reply OK.'},
                   'platformModel': 'gpt-5.4-nano', 'historyBytes': 8192}
    quote, _ = json_api(container, 'POST', root + '/quote', quote_input, cookie, csrf)
    if quote['maximumChargeMicros'] > 10_000:
        raise RuntimeError('acceptance cost ceiling exceeded one fen')
    wallet_before, _ = json_api(container, 'GET', '/api/wallet', cookie=cookie)
    report = {'createdAt': time.time(), 'playerId': registered['account']['playerId'], 'conversationId': conversation['conversationId'],
              'quoteMaximumMicros': quote['maximumChargeMicros'], 'characterCreation': True, 'paidCatalogue': True}
    if allow_real_call:
        command = dict(quote_input, clientActionId='cash-check-' + secrets.token_hex(12),
                       billingPolicy=quote['policyVersion'], quoteId=quote['quoteId'])
        payload, _ = api(container, 'POST', root + '/turns', command, cookie, csrf)
        def completed(stream):
            for frame in stream.decode().split('\n\n'):
                if frame.startswith('event: completed\n'):
                    return json.loads(frame.split('data: ', 1)[1])
            raise RuntimeError('real upstream reply did not complete; private account can be inspected')
        receipt = completed(payload)
        replay = completed(api(container, 'POST', root + '/turns', command, cookie, csrf)[0])
        wallet_after, _ = json_api(container, 'GET', '/api/wallet', cookie=cookie)
        persisted, _ = json_api(container, 'GET', root, cookie=cookie)
        charge = receipt['cashCharge']
        debits = [entry for entry in wallet_after['ledger'] if entry['kind'] == 'usage']
        if not replay['idempotencyHit'] or replay['cashCharge']['generationId'] != charge['generationId']:
            raise RuntimeError('real reply replay is not idempotent')
        if len(debits) != 1 or debits[0]['amountMicros'] != -charge['amountMicros']:
            raise RuntimeError('real consumption ledger is not unique')
        if wallet_before['balanceMicros'] - wallet_after['balanceMicros'] != charge['amountMicros']:
            raise RuntimeError('actual balance differs from receipt')
        if persisted['cashCharges'][0]['generationId'] != charge['generationId']:
            raise RuntimeError('receipt lost after reload')
        _, database_user, database_name = base.database_info()
        query = "SELECT upstream_cost_cny,amount_micros,capped FROM wallet_tavern_charges WHERE generation_id='" + charge['generationId'] + "';"
        recorded = base.run(base.docker + ['exec', database_container, 'psql', '-U', database_user, '-d', database_name, '-At', '-F', '|', '-c', query]).decode().strip().split('|')
        expected = int((Decimal(recorded[0]) * 2_000_000).to_integral_value(rounding=ROUND_CEILING))
        if recorded[2] != 'f' or expected != charge['amountMicros'] or int(recorded[1]) != expected:
            raise RuntimeError('real upstream cost is not doubled exactly')
        report.update(realUpstreamCostCny=recorded[0], chargedMicros=charge['amountMicros'], balanceMicros=wallet_after['balanceMicros'],
                      inputTokens=receipt['turn']['usage']['inputTokens'], outputTokens=receipt['turn']['usage']['outputTokens'],
                      uniqueLedger=True, persistedReceipt=True, idempotency=True)
    api(container, 'POST', '/api/auth/logout', {}, cookie, csrf)
    (base.release / filename).write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print('independent cash acceptance passed:', filename, flush=True)


old_ready = base.ready


def ready(port):
    old_ready(port)
    if port == 18094:
        paid_acceptance(base.stage_app, base.stage_db, 'canary-cash-acceptance.json', True)


base.ready = ready


def existing_payment():
    _, user, database = base.database_info()
    query = "SELECT ledger.amount_micros,wallet.balance_micros,(SELECT COUNT(*) FROM wallet_ledger WHERE topup_id=ledger.topup_id AND kind='topup') FROM wallet_ledger ledger JOIN wallet_accounts wallet USING(account_id) WHERE ledger.topup_id='01a1113b-7b6e-7573-bc10-d89d284b93ee' AND ledger.kind='topup';"
    return base.run(base.docker + ['exec', 'mapflow-laptop-postgres', 'psql', '-U', user, '-d', database, '-At', '-c', query]).decode().strip()


def prepare():
    previous = base.inspect(base.name)
    if previous['Config']['Image'] != expected_previous:
        raise RuntimeError('production source changed before release')
    base.release.mkdir(mode=0o700)
    base.private_write(base.release / 'original-container.json', json.dumps(previous))
    baseline = existing_payment()
    if not baseline.startswith('30000|') or not baseline.endswith('|1'):
        raise RuntimeError('existing credited payment was not found uniquely')
    base.private_write(base.release / 'existing-payment.before', baseline)
    shutil.copy2(bundle / 'provenance.json', base.release / 'provenance.json')
    source = manifest()
    shutil.copy2(key_source, key_destination)
    os.chown(key_destination, 10001, 10001)
    key_destination.chmod(0o400)
    for artifact in ['frontend-source.tar.gz', 'backend-source.tar.gz', 'frontend-tests.log', 'frontend-build.log', 'backend-tests.log', 'backend-clippy.log']:
        shutil.copy2(bundle / artifact, base.release / artifact)
    base.backup(base.release / 'canary-source.dump')
    context = base.release / 'build'
    context.mkdir()
    for binary in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(bundle / binary, context / binary)
    shutil.copytree(bundle / 'dist', context / 'dist')
    (context / 'Dockerfile').write_text('FROM ' + expected_previous + '\n'
        'LABEL org.opencontainers.image.revision="' + source['backend']['commit'] + '" \\\n'
        '      com.mapflow.frontend.revision="' + source['frontend']['commit'] + '" \\\n'
        '      com.mapflow.source.branch="main"\n'
        'COPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\n'
        'COPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\n'
        'COPY --chown=10001:10001 dist/ /srv/mapflow/\n')
    with (base.release / 'image-build.log').open('wb') as log:
        base.run(base.docker + ['build', '--network=none', '-t', base.image, str(context)], output=log)
    shutil.copy2(Path(__file__), base.release / Path(__file__).name)
    print('verified main cash release image prepared', flush=True)


def finish():
    source = manifest()
    live = base.inspect(base.name)
    previous = configured_original()
    if live['Config']['Image'] != base.image:
        raise RuntimeError('unexpected production image')
    for field in ['Env', 'User', 'Entrypoint', 'Cmd', 'WorkingDir']:
        if live['Config'].get(field) != previous['Config'].get(field):
            raise RuntimeError('unexpected runtime config: ' + field)
    for field in ['Binds', 'PortBindings', 'Memory', 'NanoCpus', 'ReadonlyRootfs', 'CapDrop', 'SecurityOpt', 'RestartPolicy', 'Tmpfs']:
        if live['HostConfig'].get(field) != previous['HostConfig'].get(field):
            raise RuntimeError('unexpected runtime host config: ' + field)
    checks(18092)
    paid_acceptance(base.name, 'mapflow-laptop-postgres', 'production-cash-acceptance.json', True)
    preserved = existing_payment() == (base.release / 'existing-payment.before').read_text()
    if not preserved:
        raise RuntimeError('existing user payment or balance changed during release; inspect without restoring data')
    report_path = base.release / 'production-passed.json'
    report = json.loads(report_path.read_text())
    report.update(migration=31, existingPaymentPreserved=True, cashSettlementVerified=True)
    report_path.write_text(json.dumps(report, indent=2))
    (base.release / 'DEPLOYMENT.md').write_text('# Tavern cash billing\n\nFrontend main: `' + source['frontend']['commit'] +
        '`\nBackend main: `' + source['backend']['commit'] + '`\nImage: `' + base.image +
        '`\n\nMigration 0031. Actual upstream CNY cost × 2; user-owned keys do not debit site cash. '
        'Cloned database and independent low-cost production accounts verify usage, unique ledger, replay and persistent receipt. '
        'Preserved VMQ, registration, public-library search and filters, secrets, resource limits and FRP. '
        'Rollback the application only; never restore old data over new payments.\n')
    operations = base.root / 'OPERATIONS.md'
    operations.write_text('> **酒馆现金扣费发布（2026-10-07）**：当前镜像 `' + base.image + '`，前后端已合入 main；'
        '上游实扣 × 2，迁移 0031。发布与独立验收资料：`releases/20261007-tavern-cash/`。\n\n' + operations.read_text())
    print('main cash billing and real production settlement verified', flush=True)


if __name__ == '__main__':
    {'prepare': prepare, 'canary': queue.canary, 'cutover': queue.cutover, 'finish': finish}[sys.argv[1]]()
