"""Frozen paired release; validate schema58 and actual old-image rollback on a clone."""
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

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/admin-settlement-review-20261016')
RELEASE = ROOT / 'releases/20261016-admin-settlement-review'
FRONTEND = '2632500548c045a1f532bdc143000dad8eaab0aa'
BACKEND = 'd485130ba4806b8800d44bc011c8abdea970ec26'
PREVIOUS = 'sha256:b2af8b2f1794ba11ac8c51a79549d90d8e738b5b5ecbb3b01e567513eb5672ec'
EXPECTED_APP = '546dd24c2a690284729a150fb1e06c673fd8bafe8bf72d9565fbaaee1466a2b3'
IMAGE = 'mapflow-server:admin-settlement-review-20261016-d485130'
BASE = 'mapflow-server:admin-settlement-base-20261016-b2af8b2'
APP = 'mapflow-laptop-app'
KNOWLEDGE = 'mapflow-laptop-knowledge'
DB = 'mapflow-laptop-postgres'
NETWORK = 'mapflow-laptop-migration'
OLD_APP = APP + '-before-admin-settlement-20261016'
OLD_KNOWLEDGE = KNOWLEDGE + '-before-admin-settlement-20261016'
CLONE_APP = 'mapflow-admin-settlement-check-app-20261016'
CLONE_DB = 'mapflow-admin-settlement-check-postgres-20261016'
CLONE_NETWORK = 'mapflow-admin-settlement-check-20261016'
CLONE_KNOWLEDGE = 'mapflow-admin-settlement-check-knowledge-20261016'
ROLLBACK_APP = CLONE_APP + '-rollback'
EXECUTION = '01a14370-3646-7603-a29c-69dcc8bc6e49'
D = ['docker', '-H', 'unix:///var/run/docker.sock']


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checks = load('settlement_release_checks', PACKET / 'admin_settlement_release_checks.py')
sidecar_checks = load('sidecar_release_checks', ROOT / 'releases/20261016-chat-interactions/release_checks.py')
g = load('guidance_release', ROOT / 'releases/20261015-global-assistant-guidance/2026-10-15-global-guidance-release.py')
g.load_helpers()
for key in ['RELEASE', 'PACKET', 'FRONTEND', 'BACKEND', 'PREVIOUS', 'IMAGE', 'OLD_APP', 'CLONE_APP', 'CLONE_DB', 'CLONE_NETWORK', 'CLONE_KNOWLEDGE', 'ROLLBACK_APP']:
    setattr(g, key, globals()[key])
    setattr(g.full, key, globals()[key])
g.full.run = g.run
g.full.load_helpers()
f = g.full
f.helpers.IMAGE = IMAGE
f.helpers.PROD_DB = DB


def run(arguments, **kwargs):
    return g.run(arguments, **kwargs)


def read(name):
    return json.loads((RELEASE / name).read_text())


def private(name, value):
    g.save(name, value)


def source():
    manifest = json.loads((PACKET / 'source.json').read_text())
    assert manifest['frontend'] == FRONTEND and manifest['backend'] == BACKEND
    for name, digest in {**manifest['archives'], **manifest['tools']}.items():
        assert hashlib.sha256((PACKET / name).read_bytes()).hexdigest() == digest, 'Frozen input changed: ' + name
    assert hashlib.sha384((PACKET / 'migration-58.sql').read_bytes()).hexdigest() == manifest['migration58Sha384']
    return manifest


def artifacts(container):
    manifest = read('provenance.json')
    assert g.file_hashes(container, manifest['runtimeFiles']) == manifest['runtimeFiles']
    web = {'/srv/mapflow/' + name: digest for name, digest in manifest['webFiles'].items()}
    assert g.file_hashes(container, web) == web
    paths = run(D + ['exec', container, 'find', '/srv/mapflow', '-type', 'f']).decode().splitlines()
    assert set(paths) == set(web), 'Obsolete frontend artifacts remain'
    paths = run(D + ['exec', container, 'find', '/opt/mapflow/harness-worker/dist', '-type', 'f']).decode().splitlines()
    assert set(paths) == {name for name in manifest['runtimeFiles'] if name.startswith('/opt/mapflow/harness-worker/dist/')}
    current = g.inspect(container)
    assert current['Image'] == manifest['imageId']
    assert current['Config']['Labels']['org.opencontainers.image.revision'] == BACKEND
    assert current['Config']['Labels']['com.mapflow.frontend.revision'] == FRONTEND
    return {'frontendFiles': len(web), 'runtimeFiles': len(manifest['runtimeFiles'])}


def execution_evidence(container):
    return json.loads(g.sql(container, """SELECT json_build_object(
      'execution',md5(to_jsonb(e)::text),'settlement',md5(to_jsonb(s)::text),
      'calls',(SELECT md5(coalesce(string_agg(md5(to_jsonb(c)::text),'' ORDER BY c.call_id),'')) FROM agent_model_calls c WHERE c.execution_id=e.execution_id),
      'receipts',(SELECT count(*) FROM agent_model_call_receipts r JOIN agent_model_calls c USING(call_id) WHERE c.execution_id=e.execution_id),
      'usages',(SELECT count(*) FROM agent_model_call_usages u JOIN agent_model_calls c USING(call_id) WHERE c.execution_id=e.execution_id),
      'state',e.state,'funding',e.funding,'status',s.status,'cashMicros',s.cash_micros,'pointUnits',s.point_units)
      FROM agent_executions e JOIN agent_execution_settlements s USING(account_id,execution_id)
      WHERE e.execution_id='""" + EXECUTION + "'").strip())


def verify_migration(container, before):
    checks.assert_migration(before, g.migration_rows(container), (PACKET / 'migration-58.sql').read_bytes())


def prepare():
    assert not RELEASE.exists() and not g.exists(OLD_APP) and not g.exists(OLD_KNOWLEDGE)
    assert g.inspect(APP)['Id'] == EXPECTED_APP and g.inspect(APP)['Image'] == PREVIOUS
    builder = g.inspect('mapflow-admin-receipts-build-20261016')
    assert builder['State']['Status'] == 'exited' and builder['State']['ExitCode'] == 0, 'Build incomplete'
    RELEASE.mkdir(mode=0o700)
    private('original-container.json', g.inspect(APP))
    private('original-knowledge.json', g.inspect(KNOWLEDGE))
    private('original-postgres.json', g.inspect(DB))
    manifest = source()
    context = PACKET / 'context'
    context.mkdir(mode=0o700)
    with tarfile.open(PACKET / 'frontend.tar.gz') as archive:
        archive.extractall(context, filter='data')
    web = json.loads((PACKET / 'frontend-files.json').read_text())
    f.verify_web_manifest(context / 'web-dist', web)
    previous = json.loads((ROOT / 'releases/20261016-chat-interactions/provenance.json').read_text())
    assert previous['imageId'] == PREVIOUS
    runtime = previous['runtimeFiles']
    assert g.file_hashes(APP, runtime) == runtime
    current = dict(runtime)
    for name in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(PACKET / 'build-output' / name, context / name)
        current['/usr/local/bin/' + name] = hashlib.sha256((context / name).read_bytes()).hexdigest()
    checks.assert_runtime(runtime, current)
    run(D + ['tag', PREVIOUS, BASE])
    assert g.inspect(BASE)['Id'] == PREVIOUS
    (context / 'Dockerfile').write_text('FROM ' + BASE + '\nUSER 0:0\nRUN rm -rf /srv/mapflow && mkdir -p /srv/mapflow && chown 10001:10001 /srv/mapflow\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\nUSER 10001:10001\nLABEL org.opencontainers.image.revision="' + BACKEND + '" com.mapflow.frontend.revision="' + FRONTEND + '" dev.mapflow.frontend.revision="' + FRONTEND + '"\n')
    run(D + ['build', '--network=none', '-t', IMAGE, str(context)])
    f.assert_runtime_layers(g.inspect(PREVIOUS)['RootFS']['Layers'], g.inspect(IMAGE)['RootFS']['Layers'])
    private('provenance.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': g.inspect(IMAGE)['Id'], 'baseImage': PREVIOUS, 'runtimeFiles': current, 'previousRuntimeFiles': runtime, 'webFiles': web, 'source': manifest, 'buildContainer': builder['Id']})
    candidate = CLONE_APP + '-files'
    assert not g.exists(candidate)
    run(D + ['create', '--name', candidate, '--network=none', IMAGE])
    run(D + ['cp', candidate + ':/srv/mapflow', str(RELEASE / 'candidate-web')])
    f.verify_web_manifest(RELEASE / 'candidate-web', web)
    run(D + ['rm', candidate])
    assert f.migration(DB) == 57
    size = f.backup('canary-source.dump')
    for name in manifest['tools']:
        shutil.copy2(PACKET / name, RELEASE / name)
    private('prepared.json', {'passed': True, 'backupBytes': size, 'schema': 57})
    print(json.dumps({'prepared': True, 'backupBytes': size, 'imageId': g.inspect(IMAGE)['Id']}), flush=True)


def access(container):
    expected = (PACKET / 'context/web-dist/index.html').read_bytes()
    routes = {}
    for path in ['/', '/login', '/register', '/console', '/assistant', '/library', '/maps', '/learning', '/tavern', '/wallet', '/models', '/settings', '/admin', '/admin/assistant-knowledge']:
        status, body, _ = g.api(container, 'GET', path)
        assert status == 200 and body == expected, (path, status)
        routes[path] = status
    protected = {}
    for path in ['/api/auth/session', '/api/wallet', '/api/admin/agent-settlements', '/api/admin/assistant-knowledge/articles', '/api/me/global-assistant/messages']:
        status, _, _ = g.api(container, 'GET', path)
        assert status == 401, (path, status)
        protected[path] = status
    path = '/api/admin/agent-settlements/' + EXECUTION + '/review'
    assert g.api(container, 'POST', path, {'action': 'recheck', 'expectedAttentionKey': '0' * 64})[0] == 401
    assert g.api(container, 'GET', '/api/wallet/payments/vmq/notify?payId=forged')[0] == 400
    assert g.api(container, 'GET', '/api/trees/public')[0] == 200
    assert g.api(container, 'GET', '/api/model-catalog/byok')[0] == 200
    return {'routes': routes, 'protected': protected, 'anonymousReview': 401, **artifacts(container)}


def canary_setup():
    assert read('prepared.json')['passed'] and g.inspect(APP)['Id'] == EXPECTED_APP
    assert not any(g.exists(name) for name in [CLONE_APP, CLONE_DB, CLONE_NETWORK, CLONE_KNOWLEDGE, ROLLBACK_APP])
    run(D + ['network', 'create', '--internal', '--label', 'org.mapflow.release=admin-settlement-20261016', CLONE_NETWORK])
    uri, user, database = f.factory.base.database_info()
    password = secrets.token_urlsafe(30)
    f.factory.base.private_write(RELEASE / 'stage-db.env', 'POSTGRES_USER=' + user + '\nPOSTGRES_DB=' + database + '\nPOSTGRES_PASSWORD=' + password + '\n')
    data = RELEASE / 'clone-postgres-data'
    data.mkdir(mode=0o700)
    run(D + ['run', '-d', '--name', CLONE_DB, '--network', CLONE_NETWORK, '--env-file', str(RELEASE / 'stage-db.env'), '--memory', '512m', '--cpus', '0.75', '--mount', 'type=bind,src=' + str(data) + ',dst=/var/lib/postgresql/data', g.inspect(DB)['Image']])
    for attempt in range(120):
        ready = subprocess.run(D + ['exec', CLONE_DB, 'pg_isready', '-U', user, '-d', database], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        initialized = subprocess.run(D + ['exec', CLONE_DB, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if ready and initialized:
            break
        time.sleep(.3)
    else:
        raise RuntimeError('Clone database unavailable')
    run(D + ['exec', '-i', CLONE_DB, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '-U', user, '-d', database], payload=(RELEASE / 'canary-source.dump').read_bytes())
    before, versions = g.fingerprints(CLONE_DB), g.migration_rows(CLONE_DB)
    pending = g.pending(CLONE_DB)
    g.guards.assert_reconciliation_preserved(pending, pending)
    destination = uri._replace(netloc=urllib.parse.quote(user, safe='') + ':' + urllib.parse.quote(password, safe='') + '@' + CLONE_DB + ':5432', query='')
    f.factory.base.private_write(RELEASE / 'stage-database.url', urllib.parse.urlunsplit(destination), 10001)
    f.factory.base.private_write(RELEASE / 'stage-app.env', '\n'.join(g.original()['Config']['Env']) + '\n')
    f.factory.base.private_write(RELEASE / 'stage-admin-username', 'SettlementAdmin' + secrets.token_hex(4), 10001)
    f.helpers.migrate(CLONE_DB, RELEASE / 'stage-database.url', CLONE_NETWORK)
    verify_migration(CLONE_DB, versions)
    checks.assert_business(before, g.fingerprints(CLONE_DB))
    g.stage_app(ROLLBACK_APP, PREVIOUS, knowledge=False)
    assert g.api(ROLLBACK_APP, 'GET', '/api/wallet')[0] == 401
    g.guards.assert_reconciliation_preserved(pending, g.pending(CLONE_DB))
    run(D + ['stop', ROLLBACK_APP])
    g.stage_app(CLONE_APP, IMAGE)
    assert g.inspect(CLONE_NETWORK)['Internal'] and not g.inspect(CLONE_APP)['HostConfig'].get('PortBindings')
    knowledge = g.start_knowledge(CLONE_KNOWLEDGE, CLONE_APP)
    private('clone-prepared.private.json', {'pending': pending, 'oldApplicationOnSchema58': True, 'productionRecord': execution_evidence(DB), 'modelCalls': int(g.sql(CLONE_DB, 'SELECT count(*) FROM agent_model_calls')), 'knowledge': knowledge})
    print(json.dumps({'clonePrepared': True, 'schema': 58, 'actualOldImageRollbackVerified': True}), flush=True)


def check_canary():
    report = access(CLONE_APP)
    before = read('clone-prepared.private.json')
    cookie, csrf, administrator = g.clone_register('admin')
    member_cookie, member_csrf, _ = g.clone_register('member')
    path = '/api/admin/agent-settlements/' + EXECUTION + '/review'
    status, pending, _ = g.api(CLONE_APP, 'GET', '/api/admin/agent-settlements', cookie=cookie)
    assert status == 200
    record = next(item for item in pending['pending'] if item['executionId'] == EXECUTION)
    body = {'action': 'acknowledge_audit', 'expectedAttentionKey': record['attentionKey'], 'note': 'Isolated restored-database acceptance; not a production review.'}
    guards = {
        'anonymous': g.api(CLONE_APP, 'POST', path, body)[0],
        'member': g.api(CLONE_APP, 'POST', path, body, member_cookie, member_csrf)[0],
        'missingCsrf': g.api(CLONE_APP, 'POST', path, body, cookie)[0],
        'stale': g.api(CLONE_APP, 'POST', path, {**body, 'expectedAttentionKey': '0' * 64}, cookie, csrf)[0],
        'emptyNote': g.api(CLONE_APP, 'POST', path, {**body, 'note': ' '}, cookie, csrf)[0],
        'inventedAmount': g.api(CLONE_APP, 'POST', path, {**body, 'cashMicros': 0}, cookie, csrf)[0],
    }
    assert guards == {'anonymous': 401, 'member': 403, 'missingCsrf': 403, 'stale': 409, 'emptyNote': 400, 'inventedAmount': 400}, guards
    raw_before = execution_evidence(CLONE_DB)
    status, result, _ = g.api(CLONE_APP, 'POST', path, {'action': 'recheck', 'expectedAttentionKey': record['attentionKey']}, cookie, csrf)
    assert status == 200 and result['outcome'] == 'pending', status
    body['expectedAttentionKey'] = result['attentionKey']
    for repeat in range(2):
        status, result, _ = g.api(CLONE_APP, 'POST', path, body, cookie, csrf)
        assert status == 200 and result['outcome'] == 'acknowledged'
    assert int(g.sql(CLONE_DB, "SELECT count(*) FROM agent_settlement_reviews WHERE execution_id='" + EXECUTION + "'")) == 1
    run(D + ['restart', CLONE_APP])
    f.helpers.ready(CLONE_APP)
    _, pending, _ = g.api(CLONE_APP, 'GET', '/api/admin/agent-settlements', cookie=cookie)
    assert not any(item['executionId'] == EXECUTION for item in pending['pending'])
    raw_after = execution_evidence(CLONE_DB)
    assert all(raw_before[name] == raw_after[name] for name in raw_before if name != 'settlement')
    assert int(g.sql(CLONE_DB, 'SELECT count(*) FROM agent_model_calls')) == before['modelCalls']
    assert execution_evidence(DB) == before['productionRecord'], 'Production record changed during clone verification'
    g.guards.assert_reconciliation_preserved(before['pending'], g.pending(CLONE_DB))
    knowledge = g.verify_knowledge(CLONE_KNOWLEDGE, CLONE_APP)
    private('canary-passed.json', {'passed': True, 'schema': 58, 'actualOldImageRollbackVerified': True, 'newModelCalls': 0, 'reviewSurvivesRestart': True, 'idempotentReview': True, 'authorization': guards, 'knowledge': knowledge, **report})
    run(D + ['stop', CLONE_KNOWLEDGE, CLONE_APP, CLONE_DB])
    print(json.dumps({'canaryPassed': True, 'schema': 58, 'reviewSurvivesRestart': True, 'actualOldImageRollbackVerified': True, 'newModelCalls': 0, 'authorization': guards}), flush=True)


def create_app():
    prior = g.original()
    config = {name: copy.deepcopy(prior['Config'][name]) for name in ['User', 'Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'ExposedPorts', 'Healthcheck', 'StopSignal'] if name in prior['Config']}
    config['Labels'] = {**prior['Config']['Labels'], 'org.opencontainers.image.revision': BACKEND, 'com.mapflow.frontend.revision': FRONTEND, 'dev.mapflow.frontend.revision': FRONTEND}
    config['Image'], config['HostConfig'] = IMAGE, copy.deepcopy(prior['HostConfig'])
    endpoint = prior['NetworkSettings']['Networks'][NETWORK]
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


def restore(before, maintenance):
    proxy = ROOT / 'runtime/Caddyfile'
    assert proxy.read_text() in [before, maintenance]
    if proxy.read_text() == before:
        proxy.write_text(maintenance)
        f.factory.base.caddy_reload()
    suffix = '-failed-admin-settlement-' + str(time.time_ns())
    if g.exists(KNOWLEDGE) and g.inspect(KNOWLEDGE)['Id'] != read('original-knowledge.json')['Id']:
        run(D + ['stop', KNOWLEDGE])
        run(D + ['rename', KNOWLEDGE, KNOWLEDGE + suffix])
    if g.exists(OLD_APP):
        if g.exists(APP):
            run(D + ['stop', APP])
            if NETWORK in g.inspect(APP)['NetworkSettings']['Networks']:
                run(D + ['network', 'disconnect', NETWORK, APP])
            run(D + ['rename', APP, APP + suffix])
        run(D + ['rename', OLD_APP, APP])
    if NETWORK not in g.inspect(APP)['NetworkSettings']['Networks']:
        endpoint = g.original()['NetworkSettings']['Networks'][NETWORK]
        command = D + ['network', 'connect', '--ip', endpoint['IPAddress']]
        for alias in endpoint.get('Aliases') or []:
            if len(alias) != 64:
                command += ['--alias', alias]
        run(command + [NETWORK, APP])
    run(D + ['start', APP])
    f.helpers.ready(APP)
    if g.exists(OLD_KNOWLEDGE):
        run(D + ['rename', OLD_KNOWLEDGE, KNOWLEDGE])
    run(D + ['start', KNOWLEDGE])
    g.verify_knowledge(KNOWLEDGE, APP)
    assert g.inspect(APP)['Id'] == EXPECTED_APP and g.inspect(APP)['Image'] == PREVIOUS
    assert g.inspect(KNOWLEDGE)['Id'] == read('original-knowledge.json')['Id']
    proxy.write_text(before)
    f.factory.base.caddy_reload()
    private('rollback-passed.json', {'applicationRestored': True, 'knowledgeRestored': True, 'databaseRestoredFromBackup': False, 'schema': f.migration(DB)})


def cutover():
    source()
    assert read('canary-passed.json')['passed']
    assert g.inspect(APP)['Id'] == EXPECTED_APP and g.inspect(APP)['Image'] == PREVIOUS
    assert g.inspect(KNOWLEDGE)['Id'] == read('original-knowledge.json')['Id']
    assert not g.exists(OLD_APP) and not g.exists(OLD_KNOWLEDGE)
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
        evidence = execution_evidence(DB)
        observations = f.helpers.observation_rows(DB)
        ages = f.helpers.observation_age_metadata(DB)
        ordered = json.loads(g.sql(DB, "SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        private('business.before.json', baseline)
        private('migrations.before.json', versions)
        private('pending.before.private.json', pending)
        private('reported-execution.before.private.json', evidence)
        private('observations.before.private.json', {'rows': observations, 'ages': ages, 'order': ordered})
        f.helpers.migrate(DB, ROOT / 'runtime/secrets/database.url', NETWORK)
        verify_migration(DB, versions)
        checks.assert_business(baseline, g.fingerprints(DB))
        run(D + ['rename', KNOWLEDGE, OLD_KNOWLEDGE])
        run(D + ['network', 'disconnect', NETWORK, APP])
        run(D + ['rename', APP, OLD_APP])
        create_app()
        f.helpers.ready(APP)
        knowledge = g.start_knowledge(KNOWLEDGE, APP)
        checks.assert_config(g.normalized_config(g.original()), g.normalized_config(g.inspect(APP)), FRONTEND, BACKEND)
        old = read('original-knowledge.json')
        sidecar_checks.assert_knowledge_config(g.normalized_config(old), g.normalized_config(g.inspect(KNOWLEDGE)), g.inspect(APP)['Id'], old['Image'], g.inspect(KNOWLEDGE)['Image'])
        report = access(APP)
        g.guards.assert_reconciliation_preserved(pending, g.pending(DB))
        verify_migration(DB, versions)
        _, retention = g.retention_evidence(observations, ages, ordered)
        current = g.fingerprints(DB)
        checks.assert_business(baseline, current, retention_verified=True)
        assert execution_evidence(DB) == evidence, 'Reported production record changed'
        assert int(g.sql(DB, "SELECT count(*) FROM agent_settlement_attention_required WHERE execution_id='" + EXECUTION + "'")) == 1
        assert g.inspect(DB)['Id'] == read('original-postgres.json')['Id']
        assert proxy.read_text() == maintenance
        proxy.write_text(before)
        f.factory.base.caddy_reload()
        public = f.public_checks()
        private('business.after.json', current)
        private('production-passed.json', {'frontend': FRONTEND, 'backend': BACKEND, 'image': IMAGE, 'imageId': g.inspect(APP)['Image'], 'schema': 58, 'originalBusinessTablesPreserved': len(baseline), 'reviewTableRows': 0, 'reportedRecordUnchanged': True, 'reconciliationPreserved': len(pending), 'backupBytes': size, 'databaseContainerUnchanged': True, 'observationRetention': retention, 'knowledge': knowledge, 'publicRoutes': public, **report})
    except BaseException:
        restore(before, maintenance)
        raise
    print(json.dumps({'cutoverPassed': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': g.inspect(APP)['Image'], 'schema': 58, 'businessTablesPreserved': len(baseline), 'reportedRecordUnchanged': True, 'reconciliationPreserved': len(pending), 'knowledgeHealthy': True, **report}), flush=True)


def finish():
    report = read('production-passed.json')
    artifacts(APP)
    g.verify_knowledge(KNOWLEDGE, APP)
    f.public_checks()
    notice = '> 管理员回执核对与学习区角色库修复已发布（2026-10-16）：前端 ' + FRONTEND + '；后端 ' + BACKEND + '；schema58。回退见 releases/20261016-admin-settlement-review/。\n\n'
    operations = ROOT / 'OPERATIONS.md'
    if not operations.read_text().startswith(notice):
        operations.write_text(notice + operations.read_text())
    (RELEASE / 'DEPLOYMENT.md').write_text('# Administrator settlement review — 2026-10-16\n\nFrontend ' + FRONTEND + '; backend ' + BACKEND + '; image ' + report['imageId'] + '. Additive migration58; original business data, reported receipt record, payment configuration and knowledge model retained. Actual prior image was started on schema58 in the restored internal-network clone.\n\nRollback: sudo python3 ' + str(PACKET / Path(__file__).name) + ' rollback. Restores ' + OLD_APP + ' and ' + OLD_KNOWLEDGE + '; retains schema58 and all current database activity. Never restore the historical dump over subsequent records.\n')
    print(json.dumps({'finished': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': report['imageId'], 'schema': 58}), flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'rollback':
        previous = (RELEASE / 'Caddyfile.before').read_text()
        marker = 'reverse_proxy mapflow-app:8080 {'
        restore(previous, previous.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker))
    else:
        {'prepare': prepare, 'canary-setup': canary_setup, 'check-canary': check_canary, 'cutover': cutover, 'finish': finish}[sys.argv[1]]()
