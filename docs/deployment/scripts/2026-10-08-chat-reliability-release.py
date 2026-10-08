"""Release the validated chat fix using the laptop's established clone/cutover workflow."""
from pathlib import Path
import importlib.util, json, secrets, sys, time

root = Path('/opt/mapflow-laptop-migration-20261006')
previous_path = root / 'releases/20261008-model-catalog/mapflow-model-catalog-release.py'
spec = importlib.util.spec_from_file_location('catalog_release', previous_path)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
base, queue = catalog.base, catalog.queue
base.release = root / 'releases/20261008-chat-reliability'
base.image = 'mapflow-server:chat-reliability-20261008'
base.stage_db = 'mapflow-chat-reliability-check-postgres'
base.stage_app = 'mapflow-chat-reliability-check-app'
queue.previous_name = 'mapflow-laptop-app-before-chat-reliability-20261008'
catalog.expected_previous = 'mapflow-server:model-catalog-20261008'
catalog.bundle = Path('/tmp/mapflow-chat-reliability-bundle')
original_checks = catalog.checks

def checks(port):
    statuses = original_checks(port)
    assets = ''.join(path.read_text() for path in (base.release / 'build/dist/assets').glob('*.js'))
    for marker in ['调整生成参数', '本次生成失败，未扣除本站额度', 'tavern.user_model_output_limit',
            '服务器网络异常，请稍后重试。', '本次生成失败，请稍后重试。']:
        if marker not in assets:
            raise RuntimeError('Missing chat recovery feature: ' + marker)
    return statuses

catalog.checks = checks
queue.checks = checks
original_clone_acceptance = catalog.clone_acceptance

def clone_acceptance():
    original_clone_acceptance()
    container = base.stage_app
    challenge, _ = catalog.accepted(container, 'POST', '/api/auth/registration-challenge', {})
    left, operator, right = challenge['question'].split()[:3]
    username = 'ChatCheck' + secrets.token_hex(4)
    account, cookie = catalog.accepted(container, 'POST', '/api/auth/register', {
        'username': username, 'password': 'Aa9!' + secrets.token_urlsafe(24),
        'email': username.lower() + '@example.invalid', 'challengeId': challenge['challengeId'],
        'challengeAnswer': str(int(left) + int(right) if operator == '+' else int(left) - int(right))})
    csrf = account['csrfToken']
    trees, _ = catalog.accepted(container, 'GET', '/api/trees/public', cookie=cookie)
    entry, _ = catalog.accepted(container, 'POST', '/api/me/tree-library', {'treeId': trees['trees'][0]['id']}, cookie, csrf)
    tutor, _ = catalog.accepted(container, 'POST', '/api/me/tavern/tree-conversations/' + entry['library_entry_id'], {}, cookie, csrf)
    story = '/api/me/tavern/conversations/' + tutor['conversation']['conversationId']
    before, _ = catalog.accepted(container, 'GET', '/api/wallet', cookie=cookie)
    frames, _ = catalog.accepted(container, 'POST', story + '/turns', {
        'clientActionId': 'network-' + secrets.token_hex(4), 'expectedRevision': tutor['graph']['revision'],
        'action': {'type': 'reply', 'message': '网络故障验收'},
        'modelAccess': {'apiKey': 'private-canary-placeholder', 'model': 'deepseek-v4.1-flash',
            'baseUrl': 'https://mapflow-unresolvable.invalid/v1'}}, cookie, csrf, stream=True)
    errors = [frame['data'] for frame in frames if frame['event'] == 'error']
    if len(errors) != 1 or errors[0]['code'] != 'server.network_unavailable' or errors[0]['httpStatus'] != 503:
        raise RuntimeError('Server DNS failure was not classified as a server network error')
    if errors[0]['message'] != '服务器网络异常，请稍后重试。' or not errors[0].get('traceId'):
        raise RuntimeError('Public network error or request trace is incorrect')
    if any(word in json.dumps(errors, ensure_ascii=False) for word in ['上游', 'AnyAI', 'URL', 'private-canary-placeholder', 'mapflow-unresolvable']):
        raise RuntimeError('Public network failure exposed private diagnostic information')
    after, _ = catalog.accepted(container, 'GET', '/api/wallet', cookie=cookie)
    saved, _ = catalog.accepted(container, 'GET', story, cookie=cookie)
    if before != after or saved['generations'] or saved.get('cashCharges'):
        raise RuntimeError('Failed network request changed wallet or committed a generation')
    (base.release / 'clone-chat-errors-passed.json').write_text(json.dumps({
        'checkedAt': time.time(), 'clonedDatabase': True, 'serverDnsFailureClassified': True,
        'requestTracePreserved': True, 'publicDetailsRedacted': True, 'failureUncharged': True}, indent=2))
    catalog.accepted(container, 'POST', '/api/auth/logout', {}, cookie, csrf)
    print('Clone passed: DNS failure classification, public error redaction, trace and zero debit', flush=True)

catalog.clone_acceptance = clone_acceptance

def finish():
    catalog.finish()
    manifest = json.loads((base.release / 'provenance.json').read_text())
    report_path = base.release / 'production-passed.json'
    report = json.loads(report_path.read_text())
    report.update(chatRecoveryAssetsVerified=True, publicErrorMessagesVerified=True, referencePricingRetained=True,
        fullSuites=manifest['validation']['fullTests'], sourceBranch='main')
    report_path.write_text(json.dumps(report, indent=2))
    (base.release / 'DEPLOYMENT.md').write_text(
        '# Chat reliability release\n\n'
        'Frontend main: `' + manifest['frontend']['commit'] + '`\n'
        'Backend main: `' + manifest['backend']['commit'] + '`\n'
        'Image: `' + base.image + '`\n\n'
        'Sequential tool batches, an eighth tool followed by a final answer, EOF DONE compatibility, '
        'output-limit guidance, explicit server network errors, minimal public errors, redacted diagnostics, and read-only recovery '
        'after a lost completion receipt. Actual upstream bills still settle once at x2. '
        'Failure does not debit site cash; no automatic paid POST retry. '
        'Full test suites and desktop/mobile controlled API browser checks passed. '
        'The cloned database verified real streaming, billing and idempotency. '
        'Existing payments, worker and runtime preserved. Roll back application only.\n')
    operations = root / 'OPERATIONS.md'
    _, remainder = operations.read_text().split('\n\n',1)
    operations.write_text('> **教学聊天链路修复（2026-10-08）**：当前镜像 `' + base.image
        + '`，前后端 main；失败分类、参数引导、流式恢复和工具调用修复。发布及回滚记录：'
        '`releases/20261008-chat-reliability/`。\n\n' + remainder)
    print('Chat release: public health, source labels, retained worker/payment and clone billing verified', flush=True)

if __name__ == '__main__':
    {'prepare':catalog.prepare, 'canary':queue.canary, 'resume-canary':catalog.resume_canary,
        'cutover':queue.cutover, 'finish':finish}[sys.argv[1]]()
