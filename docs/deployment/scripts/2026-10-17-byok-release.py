"""Paired BYOK release, no migrations; reuse the retained release/rollback helpers.

Run as host root. Private snapshots, credentials and database dumps stay on the
host. stdout contains only release versions and acceptance summaries.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import secrets
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.parse
import uuid

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/byok-repair-20261017')
RELEASE = ROOT / 'releases/20261017-byok-repair'
FRONTEND = 'bfd508b4478e81f2265c7430e834939dcc670cd8'
BACKEND = '4fec6b9912ff0931555cddbf1f0575aff39dad0a'
PREVIOUS = 'sha256:87796a6edf7071b8ba7f1ecd2a90e3940b07927015ad7e61d2d40d2a29282bc8'
EXPECTED_APP = 'e3a55bf023ce7968ebe1b06044562df0b099625915d814a00c13db2777b40c80'
IMAGE = 'mapflow-server:byok-repair-20261017-4fec6b9'
BASE = 'mapflow-server:byok-base-20261017-87796a6'
APP, KNOWLEDGE, DB = 'mapflow-laptop-app', 'mapflow-laptop-knowledge', 'mapflow-laptop-postgres'
NETWORK = 'mapflow-laptop-migration'
OLD_APP, OLD_KNOWLEDGE = APP + '-before-byok-20261017', KNOWLEDGE + '-before-byok-20261017'
CLONE_APP, CLONE_DB = 'mapflow-byok-check-app-20261017', 'mapflow-byok-check-postgres-20261017'
CLONE_NETWORK, CLONE_KNOWLEDGE = 'mapflow-byok-check-20261017', 'mapflow-byok-check-knowledge-20261017'
ROLLBACK_APP = CLONE_APP + '-rollback'
D = ['docker', '-H', 'unix:///var/run/docker.sock']


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prior = load('retained_chat_scene_release', ROOT / 'releases/20261016-chat-scene-core/chat_scene_release.py')
g, f = prior.g, prior.f
for module in [prior, g, f]:
    for key in ['PACKET', 'RELEASE', 'FRONTEND', 'BACKEND', 'PREVIOUS', 'EXPECTED_APP', 'IMAGE', 'BASE', 'APP', 'OLD_APP', 'OLD_KNOWLEDGE', 'CLONE_APP', 'CLONE_DB', 'CLONE_NETWORK', 'CLONE_KNOWLEDGE', 'ROLLBACK_APP']:
        setattr(module, key, globals()[key])
g.full.run = g.run
f.load_helpers()
f.helpers.IMAGE, f.helpers.PROD_DB = IMAGE, DB
config_checks = load('retained_pair_config_checks', ROOT / 'releases/20261016-admin-settlement-review/admin_settlement_release_checks.py')
run, inspect, exists, private = g.run, g.inspect, g.exists, g.save


def read(name):
    return json.loads((RELEASE / name).read_text())


def source():
    manifest = json.loads((PACKET / 'source.json').read_text())
    assert manifest['frontend'] == FRONTEND and manifest['backend'] == BACKEND
    assert manifest['noDatabaseMigration'] and manifest['dependenciesUnchanged']
    for name, digest in {**manifest['archives'], **manifest['tools']}.items():
        assert hashlib.sha256((PACKET / name).read_bytes()).hexdigest() == digest, 'Frozen release input changed: ' + name
    return manifest


def artifacts(container):
    manifest = read('provenance.json')
    assert g.file_hashes(container, manifest['runtimeFiles']) == manifest['runtimeFiles']
    web = {'/srv/mapflow/' + name: digest for name, digest in manifest['webFiles'].items()}
    assert g.file_hashes(container, web) == web
    assert set(run(D + ['exec', container, 'find', '/srv/mapflow', '-type', 'f']).decode().splitlines()) == set(web)
    worker = run(D + ['exec', container, 'find', '/opt/mapflow/harness-worker/dist', '-type', 'f']).decode().splitlines()
    assert set(worker) == {name for name in manifest['runtimeFiles'] if name.startswith('/opt/mapflow/harness-worker/dist/')}
    current = inspect(container)
    assert current['Image'] == manifest['imageId']
    assert current['Config']['Labels']['org.opencontainers.image.revision'] == BACKEND
    assert all(current['Config']['Labels'][name] == FRONTEND for name in ['com.mapflow.frontend.revision', 'dev.mapflow.frontend.revision'])
    return {'frontendFiles': len(web), 'runtimeFiles': len(manifest['runtimeFiles'])}


def access(container):
    expected = (PACKET / 'context/web-dist/index.html').read_bytes()
    routes = {}
    for path in ['/', '/login', '/register', '/console', '/assistant', '/library', '/maps', '/learning', '/tavern', '/wallet', '/models', '/settings', '/admin', '/admin/assistant-knowledge']:
        status, body, _ = g.api(container, 'GET', path)
        assert status == 200 and body == expected, (path, status)
        routes[path] = status
    protected = {}
    for path in ['/api/auth/session', '/api/wallet', '/api/admin/agent-settlements', '/api/admin/assistant-knowledge/articles', '/api/me/global-assistant/messages', '/api/me/agent-executions/' + str(uuid.uuid4()) + '/control']:
        status, _, _ = g.api(container, 'GET', path)
        assert status == 401, (path, status)
        protected[path] = status
    assert g.api(container, 'GET', '/api/wallet/payments/vmq/notify?payId=forged')[0] == 400
    assert g.api(container, 'GET', '/api/trees/public')[0] == 200
    assert g.api(container, 'GET', '/api/model-catalog/byok')[0] == 200
    return {'routes': routes, 'protected': protected, **artifacts(container)}


def worker_smoke(container):
    output = run(D + ['exec', '-i', container, '/usr/local/bin/node', '/opt/mapflow/harness-worker/dist/main.js'],
                 payload=b'{"protocolVersion":1,"type":"shutdown"}\n')
    frames = [json.loads(line) for line in output.splitlines()]
    assert frames and frames[0]['type'] == 'ready' and frames[0]['evidenceDrain'] is True
    return {'realWorkerReady': True, 'evidenceDrainSupported': True}


def prepare():
    assert not RELEASE.exists() and not exists(OLD_APP) and not exists(OLD_KNOWLEDGE)
    assert inspect(APP)['Id'] == EXPECTED_APP and inspect(APP)['Image'] == PREVIOUS
    builder = inspect('mapflow-byok-build-20261017')
    assert builder['State']['Status'] == 'exited' and builder['State']['ExitCode'] == 0, 'Linux build incomplete'
    RELEASE.mkdir(mode=0o700)
    for filename, container in [('original-container.json', APP), ('original-knowledge.json', KNOWLEDGE), ('original-postgres.json', DB)]:
        private(filename, inspect(container))
    manifest = source()
    context = PACKET / 'context'
    context.mkdir(mode=0o700)
    for name in ['frontend.tar.gz', 'worker.tar.gz']:
        with tarfile.open(PACKET / name) as archive:
            archive.extractall(context, filter='data')
    web = json.loads((PACKET / 'frontend-files.json').read_text())
    worker = json.loads((PACKET / 'worker-files.json').read_text())
    f.verify_web_manifest(context / 'web-dist', web)
    actual_worker = {path.relative_to(context / 'harness-dist').as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in (context / 'harness-dist').rglob('*') if path.is_file()}
    assert actual_worker == worker
    previous = json.loads((ROOT / 'releases/20261016-chat-scene-core/provenance.json').read_text())
    assert previous['imageId'] == PREVIOUS
    runtime = previous['runtimeFiles']
    assert g.file_hashes(APP, runtime) == runtime
    current = {**runtime, **{'/opt/mapflow/harness-worker/dist/' + name: digest for name, digest in worker.items()}}
    for name in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(PACKET / 'build-output' / name, context / name)
        current['/usr/local/bin/' + name] = hashlib.sha256((context / name).read_bytes()).hexdigest()
    upgraded = {'/usr/local/bin/mapflow-server', '/usr/local/bin/mapflow-admin', '/opt/mapflow/harness-worker/dist/harness.js', '/opt/mapflow/harness-worker/dist/protocol.js'}
    assert set(current) == set(runtime) and {name for name in current if current[name] != runtime[name]} == upgraded
    run(D + ['tag', PREVIOUS, BASE])
    (context / 'Dockerfile').write_text('FROM ' + BASE + '\nUSER 0:0\nRUN rm -rf /srv/mapflow /opt/mapflow/harness-worker/dist && mkdir -p /srv/mapflow /opt/mapflow/harness-worker/dist && chown 10001:10001 /srv/mapflow /opt/mapflow/harness-worker/dist\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 harness-dist/ /opt/mapflow/harness-worker/dist/\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\nUSER 10001:10001\nLABEL org.opencontainers.image.revision="' + BACKEND + '" com.mapflow.frontend.revision="' + FRONTEND + '" dev.mapflow.frontend.revision="' + FRONTEND + '"\n')
    run(D + ['build', '--network=none', '-t', IMAGE, str(context)])
    f.assert_runtime_layers(inspect(PREVIOUS)['RootFS']['Layers'], inspect(IMAGE)['RootFS']['Layers'])
    private('provenance.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(IMAGE)['Id'], 'baseImage': PREVIOUS, 'runtimeFiles': current, 'previousRuntimeFiles': runtime, 'webFiles': web, 'workerFiles': worker, 'source': manifest, 'buildContainer': builder['Id']})
    assert f.migration(DB) == 58
    size = f.backup('canary-source.dump')
    shutil.copy2(PACKET / Path(__file__).name, RELEASE / Path(__file__).name)
    private('prepared.json', {'passed': True, 'backupBytes': size, 'schema': 58})
    print(json.dumps({'prepared': True, 'imageId': inspect(IMAGE)['Id'], 'backupBytes': size}), flush=True)


def canary_setup():
    assert read('prepared.json')['passed'] and inspect(APP)['Id'] == EXPECTED_APP
    assert not any(exists(name) for name in [CLONE_APP, CLONE_DB, CLONE_NETWORK, CLONE_KNOWLEDGE, ROLLBACK_APP])
    run(D + ['network', 'create', '--internal', '--label', 'org.mapflow.release=byok-20261017', CLONE_NETWORK])
    uri, user, database = f.factory.base.database_info()
    password = secrets.token_urlsafe(30)
    f.factory.base.private_write(RELEASE / 'stage-db.env', 'POSTGRES_USER=' + user + '\nPOSTGRES_DB=' + database + '\nPOSTGRES_PASSWORD=' + password + '\n')
    data = RELEASE / 'clone-postgres-data'
    data.mkdir(mode=0o700)
    run(D + ['run', '-d', '--name', CLONE_DB, '--network', CLONE_NETWORK, '--env-file', str(RELEASE / 'stage-db.env'), '--memory', '512m', '--cpus', '0.75', '--mount', 'type=bind,src=' + str(data) + ',dst=/var/lib/postgresql/data', inspect(DB)['Image']])
    for attempt in range(120):
        ready = subprocess.run(D + ['exec', CLONE_DB, 'pg_isready', '-U', user, '-d', database], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        initialized = subprocess.run(D + ['exec', CLONE_DB, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if ready and initialized:
            break
        time.sleep(.3)
    else:
        raise RuntimeError('Clone database unavailable')
    run(D + ['exec', '-i', CLONE_DB, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '-U', user, '-d', database], payload=(RELEASE / 'canary-source.dump').read_bytes())
    pending, versions = g.pending(CLONE_DB), g.migration_rows(CLONE_DB)
    g.guards.assert_reconciliation_preserved(pending, pending)
    destination = uri._replace(netloc=urllib.parse.quote(user, safe='') + ':' + urllib.parse.quote(password, safe='') + '@' + CLONE_DB + ':5432', query='')
    f.factory.base.private_write(RELEASE / 'stage-database.url', urllib.parse.urlunsplit(destination), 10001)
    f.factory.base.private_write(RELEASE / 'stage-app.env', '\n'.join(g.original()['Config']['Env']) + '\n')
    f.factory.base.private_write(RELEASE / 'stage-admin-username', 'ByokAdmin' + secrets.token_hex(4), 10001)
    g.stage_app(ROLLBACK_APP, PREVIOUS, knowledge=False)
    assert g.api(ROLLBACK_APP, 'GET', '/api/wallet')[0] == 401
    run(D + ['stop', ROLLBACK_APP])
    g.stage_app(CLONE_APP, IMAGE)
    assert inspect(CLONE_NETWORK)['Internal'] and not inspect(CLONE_APP)['HostConfig'].get('PortBindings')
    g.start_knowledge(CLONE_KNOWLEDGE, CLONE_APP)
    assert g.migration_rows(CLONE_DB) == versions
    g.guards.assert_reconciliation_preserved(pending, g.pending(CLONE_DB))
    private('clone-prepared.private.json', {'pending': pending, 'migrationRows': versions, 'actualOldImageRollbackVerified': True})
    print(json.dumps({'clonePrepared': True, 'schema': 58, 'actualOldImageRollbackVerified': True}), flush=True)


def check_canary():
    report = access(CLONE_APP)
    worker = worker_smoke(CLONE_APP)
    before = read('clone-prepared.private.json')
    cookie, csrf, account = g.clone_register('member')
    assert g.api(CLONE_APP, 'GET', '/api/wallet', cookie=cookie)[0] == 200
    assert str(uuid.UUID(account)) == account
    g.sql(CLONE_DB, "UPDATE wallet_accounts SET balance_micros=-50000 WHERE account_id='" + account + "'")
    status, snapshot, _ = g.api(CLONE_APP, 'POST', '/api/me/global-assistant/open', {}, cookie, csrf)
    assert status == 200 and snapshot['sendAvailability']['conversation']
    path = '/api/me/tavern/conversations/' + snapshot['conversationId'] + '/executions'
    command = {'clientActionId': str(uuid.uuid4()), 'bindingVersion': snapshot['bindingVersion'], 'expectedRevision': snapshot['graphRevision'], 'action': {'type': 'reply', 'message': 'Isolated deployment verification'}, 'funding': 'cash'}
    status, rejected, _ = g.api(CLONE_APP, 'POST', path, command, cookie, csrf)
    assert status == 402 and rejected['error']['code'] == 'cash_non_positive'
    command.update(clientActionId=str(uuid.uuid4()), funding='byok', modelAccess={'apiKey': 'synthetic-not-a-provider-key', 'baseUrl': 'https://fixture.invalid/v1', 'model': 'fixture-model', 'contextWindow': 64000, 'reasoningProtocol': 'none', 'reasoningSupported': False})
    status, accepted, _ = g.api(CLONE_APP, 'POST', path, command, cookie, csrf)
    assert status == 200 and accepted['execution']['funding'] == 'byok'
    execution_path = '/api/me/agent-executions/' + accepted['execution']['executionId']
    status, stopped, _ = g.api(CLONE_APP, 'POST', execution_path + '/stop', {'clientActionId': str(uuid.uuid4())}, cookie, csrf)
    assert status == 200 and stopped['state'] in ['stopped', 'failed']
    status, control, _ = g.api(CLONE_APP, 'GET', execution_path + '/control', cookie=cookie)
    assert status == 200 and control['version'] == 1 and not control['actions']['canResume']
    assert set(accepted['execution']) == {'executionId', 'conversationId', 'state', 'funding', 'modelId', 'result', 'error'}
    assert int(g.sql(CLONE_DB, "SELECT balance_micros FROM wallet_accounts WHERE account_id='" + account + "'")) == -50000
    member_cookie, _, _ = g.clone_register('another')
    assert g.api(CLONE_APP, 'GET', execution_path + '/control', cookie=member_cookie)[0] == 404
    g.guards.assert_reconciliation_preserved(before['pending'], g.pending(CLONE_DB))
    assert g.migration_rows(CLONE_DB) == before['migrationRows']
    private('canary-passed.json', {'passed': True, 'schema': 58, 'cashRejectedAtNegativeBalance': True, 'byokAcceptedAtNegativeBalance': True, 'siteBalanceUnchanged': True, 'legacyStatusFields': 7, 'controlVersion': 1, 'crossAccountControlDenied': True, 'realProviderCalls': 0, **worker, **report})
    run(D + ['stop', CLONE_KNOWLEDGE, CLONE_APP, CLONE_DB])
    print(json.dumps({'canaryPassed': True, 'negativeBalanceByokAccepted': True, 'cashRejected': True, 'realProviderCalls': 0, **worker}), flush=True)


def create_app():
    original = g.original()
    config = {name: copy.deepcopy(original['Config'][name]) for name in ['User', 'Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'ExposedPorts', 'Healthcheck', 'StopSignal'] if name in original['Config']}
    config['Labels'] = {**original['Config']['Labels'], 'org.opencontainers.image.revision': BACKEND, 'com.mapflow.frontend.revision': FRONTEND, 'dev.mapflow.frontend.revision': FRONTEND}
    config['Image'], config['HostConfig'] = IMAGE, copy.deepcopy(original['HostConfig'])
    endpoint = original['NetworkSettings']['Networks'][NETWORK]
    config['NetworkingConfig'] = {'EndpointsConfig': {NETWORK: {'Aliases': [alias for alias in endpoint.get('Aliases') or [] if len(alias) != 64], 'IPAMConfig': {'IPv4Address': endpoint['IPAddress']}}}}
    connection = g.DockerConnection('localhost')
    connection.request('POST', '/containers/create?name=' + APP, json.dumps(config), {'Content-Type': 'application/json'})
    response = connection.getresponse()
    body = response.read()
    connection.close()
    if response.status != 201:
        private('container-create-failure.private.json', {'status': response.status, 'body': body.decode(errors='replace')})
        raise RuntimeError('Application creation failed; private diagnostic retained')
    run(D + ['start', APP])


def cutover():
    source()
    assert read('canary-passed.json')['passed']
    assert inspect(APP)['Id'] == EXPECTED_APP and inspect(APP)['Image'] == PREVIOUS
    assert inspect(KNOWLEDGE)['Id'] == read('original-knowledge.json')['Id']
    assert not exists(OLD_APP) and not exists(OLD_KNOWLEDGE)
    pending = g.pending(DB)
    g.guards.assert_reconciliation_preserved(pending, pending)
    assert f.helpers.legacy_locks(DB) == 0, 'Active legacy generation; defer cutover'
    assert int(g.sql(DB, "SELECT count(*) FROM tree_generation_runs WHERE status IN ('queued','running')")) == 0
    proxy = ROOT / 'runtime/Caddyfile'
    before = proxy.read_text()
    marker = 'reverse_proxy mapflow-app:8080 {'
    assert before.count(marker) == 1
    maintenance = before.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker)
    f.factory.base.private_write(RELEASE / 'Caddyfile.before', before)
    try:
        proxy.write_text(maintenance)
        f.factory.base.caddy_reload()
        g.guards.assert_reconciliation_preserved(pending, g.pending(DB))
        assert f.helpers.legacy_locks(DB) == 0
        run(D + ['stop', KNOWLEDGE])
        run(D + ['stop', '--time', '30', APP])
        g.guards.assert_reconciliation_preserved(pending, g.pending(DB))
        size = f.backup('before-cutover.dump')
        baseline, versions = g.fingerprints(DB), g.migration_rows(DB)
        observations, ages = f.helpers.observation_rows(DB), f.helpers.observation_age_metadata(DB)
        ordered = json.loads(g.sql(DB, "SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        private('business.before.json', baseline)
        private('migrations.before.json', versions)
        private('pending.before.private.json', pending)
        private('observations.before.private.json', {'rows': observations, 'ages': ages, 'order': ordered})
        run(D + ['rename', KNOWLEDGE, OLD_KNOWLEDGE])
        run(D + ['network', 'disconnect', NETWORK, APP])
        run(D + ['rename', APP, OLD_APP])
        create_app()
        f.helpers.ready(APP)
        knowledge = g.start_knowledge(KNOWLEDGE, APP)
        config_checks.assert_config(g.normalized_config(g.original()), g.normalized_config(inspect(APP)), FRONTEND, BACKEND)
        old = read('original-knowledge.json')
        prior.checks.assert_knowledge_config(g.normalized_config(old), g.normalized_config(inspect(KNOWLEDGE)), inspect(APP)['Id'], old['Image'], inspect(KNOWLEDGE)['Image'])
        report = access(APP)
        smoke = worker_smoke(APP)
        g.guards.assert_reconciliation_preserved(pending, g.pending(DB))
        assert g.migration_rows(DB) == versions
        current = g.fingerprints(DB)
        f.assert_business_unchanged(baseline, current)
        _, retention = g.retention_evidence(observations, ages, ordered)
        assert inspect(DB)['Id'] == read('original-postgres.json')['Id']
        assert proxy.read_text() == maintenance
        proxy.write_text(before)
        f.factory.base.caddy_reload()
        public = f.public_checks()
        private('business.after.json', current)
        private('production-passed.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(APP)['Image'], 'schema': 58, 'unchangedBusinessTables': len(baseline), 'reconciliationPreserved': len(pending), 'backupBytes': size, 'databaseContainerUnchanged': True, 'observationRetention': retention, 'knowledge': knowledge, 'publicRoutes': public, **smoke, **report})
    except BaseException:
        prior.restore(before, maintenance)
        raise
    print(json.dumps({'cutoverPassed': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(APP)['Image'], 'schema': 58, 'businessTablesPreserved': len(baseline), 'reconciliationPreserved': len(pending), 'knowledgeHealthy': True, **smoke}), flush=True)


def finish():
    report = read('production-passed.json')
    artifacts(APP)
    g.verify_knowledge(KNOWLEDGE, APP)
    f.public_checks()
    notice = '> BYOK 请求隔离与停止恢复修复已发布（2026-10-17）：前端 ' + FRONTEND + '；后端 ' + BACKEND + '，配套 Worker，schema58 不变。回退见 releases/20261017-byok-repair/。\n\n'
    operations = ROOT / 'OPERATIONS.md'
    if not operations.read_text().startswith(notice):
        operations.write_text(notice + operations.read_text())
    (RELEASE / 'DEPLOYMENT.md').write_text('# BYOK execution recovery — 2026-10-17\n\nFrontend ' + FRONTEND + '; backend ' + BACKEND + '; image ' + report['imageId'] + '. Existing Node, SDK dependencies, database, payment settings and knowledge model retained.\n\nRollback: sudo python3 ' + str(PACKET / Path(__file__).name) + ' rollback. Restores both ' + OLD_APP + ' and ' + OLD_KNOWLEDGE + '; keep all current database records. Never restore the historical dump over subsequent activity.\n')
    print(json.dumps({'finished': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': report['imageId'], 'schema': 58}), flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'rollback':
        before = (RELEASE / 'Caddyfile.before').read_text()
        marker = 'reverse_proxy mapflow-app:8080 {'
        prior.restore(before, before.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker))
    else:
        {'prepare': prepare, 'canary-setup': canary_setup, 'check-canary': check_canary, 'cutover': cutover, 'finish': finish}[sys.argv[1]]()
