"""Frozen guidance rollout: isolated restore, additive migration, app-only rollback.

Run as host root. Private environment, account and database evidence stays in the
0700 release directory; stdout contains only non-sensitive release summaries.
"""
from pathlib import Path
import copy
import hashlib
import http.client
import importlib.util
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/global-guidance-release-20261015')
RUNTIME_PACKET = Path('/home/rong/.local/state/mapflow/global-guidance-runtime-20261015')
RELEASE = ROOT / 'releases/20261015-global-assistant-guidance'
FRONTEND = '204e04370cb768a73d95426fc524ef4eec3fd366'
BACKEND = '900798a38bf6f5493fd3f97cf9985f9ac91f25df'
PREVIOUS = 'sha256:f0c767064b51c4c47bbe115828270f477899741dc2cd7fef35ad46410fa9dcbc'
BASE = 'mapflow-server:global-guidance-base-20261015-f0c7670'
IMAGE = 'mapflow-server:global-guidance-20261015-900798a'
KNOWLEDGE_IMAGE = 'mapflow-knowledge:global-guidance-20261015-serial1'
KNOWLEDGE_URL = 'http://127.0.0.1:18219'
APP = 'mapflow-laptop-app'
OLD_APP = 'mapflow-laptop-app-before-global-guidance-20261015'
PROD_DB = 'mapflow-laptop-postgres'
NETWORK = 'mapflow-laptop-migration'
CLONE_APP = 'mapflow-guidance-check-app-20261015'
CLONE_DB = 'mapflow-guidance-check-postgres-20261015'
CLONE_NETWORK = 'mapflow-guidance-check-20261015'
CLONE_KNOWLEDGE = 'mapflow-guidance-check-knowledge-20261015'
PROD_KNOWLEDGE = 'mapflow-laptop-knowledge'
ROLLBACK_APP = CLONE_APP + '-rollback'
DOCKER = ['docker', '-H', 'unix:///var/run/docker.sock']
LABELS = {'org.opencontainers.image.revision': BACKEND,
          'org.opencontainers.image.version': 'global-guidance-20261015',
          'com.mapflow.frontend.revision': FRONTEND,
          'dev.mapflow.frontend.revision': FRONTEND}
full = None
guards = None


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect('/var/run/docker.sock')


def run(arguments, payload=None, *, input_bytes=None, output=None):
    completed = subprocess.run(arguments, input=payload if payload is not None else input_bytes,
                               stdout=output or subprocess.PIPE, stderr=subprocess.PIPE)
    if completed.returncode:
        diagnostic = (RELEASE if RELEASE.exists() else PACKET) / ('operation-failure-' + str(time.time_ns()) + '.private.log')
        diagnostic.write_bytes((completed.stdout or b'') + b'\n' + completed.stderr)
        diagnostic.chmod(0o600)
        raise RuntimeError('Operation failed; private diagnostic: ' + diagnostic.name)
    return completed.stdout


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_helpers():
    global full, guards
    guards = load_module('guidance_release_guards', PACKET / 'global_guidance_release_guards.py')
    full = load_module('reviewed_frontend_release', ROOT / 'releases/20261015-full-frontend/full_frontend_release.py')
    for name in ['PACKET', 'RELEASE', 'FRONTEND', 'BACKEND', 'PREVIOUS', 'IMAGE', 'APP', 'OLD_APP',
                 'PROD_DB', 'NETWORK', 'CLONE_APP', 'CLONE_DB', 'CLONE_NETWORK']:
        setattr(full, name, globals()[name])
    full.run = run
    full.load_helpers()
    full.helpers.IMAGE = IMAGE


def inspect(name):
    return json.loads(run(DOCKER + ['inspect', name]))[0]


def exists(name):
    return subprocess.run(DOCKER + ['inspect', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def save(name, value):
    path = RELEASE / name
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    path.chmod(0o600)


def original():
    return json.loads((RELEASE / 'original-container.json').read_text())


def sql(container, query):
    return full.sql(container, query)


def api(container, method, path, body=None, cookie=None, csrf=None):
    return full.api(container, method, path, body, cookie, csrf)


def migration_rows(container):
    return json.loads(sql(container, "SELECT coalesce(json_object_agg(version::text,(to_jsonb(r)-'checksum')||jsonb_build_object('checksum',encode(checksum,'hex'))),'{}') FROM _sqlx_migrations r"))


def conversation_columns(container):
    return json.loads(sql(container, "SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='tavern_conversations'"))


def fingerprints(container, projected=False):
    tables = sql(container, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").splitlines()
    snapshot = {}
    for table in tables:
        assert re.fullmatch('[a-z_][a-z0-9_]*', table)
        row = "(to_jsonb(r)-'global_change_sequence')" if projected and table == 'tavern_conversations' else 'to_jsonb(r)'
        snapshot[table] = json.loads(sql(container, f"SELECT json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5({row}::text),'' ORDER BY md5({row}::text)),''))) FROM public.\"{table}\" r"))
    return snapshot


def pending(container):
    return json.loads(sql(container, """SELECT coalesce(json_agg(to_jsonb(r)),'[]') FROM (
      SELECT account_id,execution_id,md5(to_jsonb(e)::text) AS row_digest,state,owner_id,lease_expires_at,
      last_failure->'detail'->>'code' AS reason,
      (SELECT count(*) FROM agent_model_calls c WHERE c.account_id=e.account_id AND c.execution_id=e.execution_id AND c.status='outcome_unknown') AS unknown_calls,
      (SELECT count(*) FROM agent_model_calls c WHERE c.account_id=e.account_id AND c.execution_id=e.execution_id AND c.status='dispatched') AS dispatched_calls
      FROM agent_executions e WHERE state NOT IN ('succeeded','stopped','failed') ORDER BY account_id,execution_id) r"""))


def verify_migration(container, before):
    sources = {str(version): (PACKET / ('migration-' + str(version) + '.sql')).read_bytes() for version in [56, 57]}
    guards.assert_migrations_preserved(before, migration_rows(container), sources)


def postgres_evidence(container):
    binaries = {line.split(maxsplit=1)[1].strip(): line.split()[0] for line in run(DOCKER + ['exec', container, 'sha256sum', '/usr/lib/postgresql/16/bin/postgres', '/usr/bin/pg_dump']).decode().splitlines()}
    return {'version': sql(container, 'SELECT version()').strip(), 'binaries': binaries,
            'settings': json.loads(sql(container, "SELECT json_object_agg(name,setting) FROM pg_settings WHERE name IN ('server_version','server_encoding','lc_collate','lc_ctype','shared_preload_libraries','max_connections','shared_buffers','wal_level','data_checksums')")),
            'available_extensions': json.loads(sql(container, "SELECT json_object_agg(name,default_version) FROM pg_available_extensions")),
            'installed_extensions': json.loads(sql(container, 'SELECT json_object_agg(extname,extversion) FROM pg_extension'))}


def normalized_config(container):
    config = container['Config']
    networks = {name: {'ip': endpoint['IPAddress'], 'aliases': sorted(alias for alias in endpoint.get('Aliases') or [] if len(alias) != 64)} for name, endpoint in container['NetworkSettings']['Networks'].items()}
    return {'environment': dict(entry.split('=', 1) for entry in config['Env']), 'labels': config.get('Labels') or {},
            'config': {name: config.get(name) for name in ['User', 'Entrypoint', 'Cmd', 'WorkingDir', 'ExposedPorts', 'Healthcheck', 'StopSignal']},
            'host': container['HostConfig'],
            'mounts': sorted(container['Mounts'], key=lambda mount: mount['Destination']), 'networks': networks}


def verify_runtime_config():
    guards.assert_runtime_config(normalized_config(original()), normalized_config(inspect(APP)), knowledge_url=KNOWLEDGE_URL, revision_labels=LABELS)


def file_hashes(container, paths):
    return {line.split(maxsplit=1)[1].strip(): line.split()[0] for line in run(DOCKER + ['exec', container, 'sha256sum', *sorted(paths)]).decode().splitlines()}


def artifacts(container):
    manifest = json.loads((RELEASE / 'provenance.json').read_text())
    expected = manifest['runtimeFiles']
    guards.assert_runtime_files(manifest['previousRuntimeFiles'], file_hashes(container, expected), expected)
    worker_paths = run(DOCKER + ['exec', container, 'find', '/opt/mapflow/harness-worker/dist', '-type', 'f']).decode().splitlines()
    assert set(worker_paths) == {name for name in expected if name.startswith('/opt/mapflow/harness-worker/dist/')}, 'Unreviewed worker files remain'
    web = {'/srv/mapflow/' + name: digest for name, digest in manifest['webFiles'].items()}
    assert file_hashes(container, web) == web, 'Frontend artifact mismatch'
    actual_paths = run(DOCKER + ['exec', container, 'find', '/srv/mapflow', '-type', 'f']).decode().splitlines()
    assert set(actual_paths) == set(web), 'Obsolete or unreviewed frontend files remain'
    current = inspect(container)
    assert current['Image'] == manifest['imageId']
    assert all(current['Config']['Labels'].get(name) == value for name, value in LABELS.items())
    return {'verifiedRuntimeFiles': len(expected), 'verifiedFrontendFiles': len(web)}


def access(container):
    expected = (PACKET / 'context/web-dist/index.html').read_bytes()
    routes = {}
    for path in ['/', '/login', '/register', '/console', '/assistant', '/library', '/maps', '/learning', '/tavern', '/wallet', '/models', '/settings', '/admin', '/admin/assistant-knowledge']:
        status, body, _ = api(container, 'GET', path)
        assert status == 200 and body == expected, (path, status)
        routes[path] = status
    protected = {}
    for path in ['/api/auth/session', '/api/wallet', '/api/admin/assistant-knowledge/articles', '/api/me/assistant-knowledge/search?query=test', '/api/me/global-assistant/messages']:
        status, _, _ = api(container, 'GET', path)
        assert status == 401, (path, status)
        protected[path] = status
    assert api(container, 'POST', '/api/me/global-assistant/open', {})[0] == 401
    assert api(container, 'GET', '/api/wallet/payments/vmq/notify?payId=forged')[0] == 400
    assert api(container, 'GET', '/api/trees/public')[0] == 200
    assert api(container, 'GET', '/api/model-catalog/byok')[0] == 200
    return {'routes': routes, 'anonymousProtected': protected, 'forgedPaymentRejected': True, **artifacts(container)}


def prepare(resume=False):
    assert not exists(OLD_APP), 'Previous application already retained'
    if resume:
        assert RELEASE.exists() and not (RELEASE / 'prepared.json').exists(), 'Only incomplete preparation can resume'
        assert inspect(APP)['Id'] == original()['Id'], 'Production changed during preparation'
    else:
        assert not RELEASE.exists(), 'Release already prepared'
    assert inspect(APP)['Image'] == PREVIOUS and inspect(APP)['State']['Running']
    builder = inspect('mapflow-guidance-build-20261015')
    assert builder['State']['Status'] == 'exited' and builder['State']['ExitCode'] == 0, 'Build incomplete'
    if not resume:
        RELEASE.mkdir(mode=0o700)
        save('original-container.json', inspect(APP))
        save('original-postgres-container.json', inspect(PROD_DB))
        save('postgres.before.json', postgres_evidence(PROD_DB))
    source = json.loads((PACKET / 'source.json').read_text())
    assert source['frontend'] == FRONTEND and source['backend'] == BACKEND
    for name, digest in source['archives'].items():
        assert hashlib.sha256((PACKET / name).read_bytes()).hexdigest() == digest
    context = PACKET / 'context'
    context.mkdir(mode=0o700, exist_ok=resume)
    for name in ['frontend.tar.gz', 'worker.tar.gz']:
        with tarfile.open(PACKET / name) as archive:
            archive.extractall(context, filter='data')
    web = json.loads((PACKET / 'frontend-files.json').read_text())
    worker = json.loads((PACKET / 'worker-files.json').read_text())
    full.verify_web_manifest(context / 'web-dist', web)
    assert {path.relative_to(context / 'harness-dist').as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in (context / 'harness-dist').rglob('*') if path.is_file()} == worker
    previous = json.loads((ROOT / 'releases/20261015-platform-assistant/provenance.json').read_text())
    assert previous['imageId'] == PREVIOUS
    old_runtime = {name: digest for name, digest in previous['files'].items() if not name.startswith('/srv/mapflow/')}
    old_runtime['/usr/local/bin/node'] = file_hashes(APP, ['/usr/local/bin/node'])['/usr/local/bin/node']
    assert file_hashes(APP, old_runtime) == old_runtime
    binaries = {}
    for name in ['mapflow-server', 'mapflow-admin']:
        shutil.copy2(PACKET / 'build-output' / name, context / name)
        binaries['/usr/local/bin/' + name] = hashlib.sha256((context / name).read_bytes()).hexdigest()
    runtime = {**old_runtime, **binaries, **{'/opt/mapflow/harness-worker/dist/' + name: digest for name, digest in worker.items()}}
    guards.assert_runtime_files(old_runtime, runtime, runtime)
    run(DOCKER + ['tag', PREVIOUS, BASE])
    assert inspect(BASE)['Id'] == PREVIOUS
    labels = ' '.join(name + '="' + value + '"' for name, value in LABELS.items())
    (context / 'Dockerfile').write_text('FROM ' + BASE + '\nUSER 0:0\nLABEL ' + labels + '\nRUN test -d /srv/mapflow && find /srv/mapflow -mindepth 1 -delete\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 harness-dist/ /opt/mapflow/harness-worker/dist/\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\nUSER 10001:10001\n')
    run(DOCKER + ['build', '--network=none', '-t', IMAGE, str(context)])
    save('provenance.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(IMAGE)['Id'],
                            'runtimeFiles': runtime, 'previousRuntimeFiles': old_runtime, 'webFiles': web,
                            'workerFiles': worker, 'source': source, 'buildContainer': builder['Id']})
    assert full.migration(PROD_DB) == 55
    size = full.backup('canary-source.dump')
    for name in ['2026-10-15-global-guidance-release.py', 'global_guidance_release_guards.py', 'global_guidance_canary.py']:
        shutil.copy2(PACKET / name, RELEASE / name)
    save('prepared.json', {'backupBytes': size, 'imageId': inspect(IMAGE)['Id'], 'migrationBefore': 55})
    print(json.dumps({'prepared': True, 'backupBytes': size, 'imageId': inspect(IMAGE)['Id']}), flush=True)


def model_directory():
    manifest = json.loads((RUNTIME_PACKET / 'runtime-ready.json').read_text())
    assert inspect(KNOWLEDGE_IMAGE)['Id'] == manifest['imageId']
    return Path(manifest['modelDirectory']), manifest


def start_knowledge(name, app):
    model, _ = model_directory()
    assert not exists(name), 'Inference container already exists'
    run(DOCKER + ['run', '-d', '--name', name, '--network', 'container:' + inspect(app)['Id'],
                  '--user', '65532:65532', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                  '--memory', '384m', '--memory-swap', '384m', '--cpus', '0.5', '--pids-limit', '64',
                  '--ulimit', 'nofile=1024:1024', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777',
                  '--mount', 'type=bind,src=' + str(model) + ',dst=/models/bge-small-zh-v1.5,readonly',
                  '--log-driver', 'local', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3',
                  '--restart', 'unless-stopped', KNOWLEDGE_IMAGE])
    return verify_knowledge(name, app)


def verify_knowledge(name, app):
    _, manifest = model_directory()
    for attempt in range(80):
        current = inspect(name)
        assert current['Image'] == manifest['imageId'], 'Unreviewed inference image'
        assert current['State']['Running'], 'Inference container exited'
        result = subprocess.run(DOCKER + ['exec', name, 'python', '-I', '-B', '/opt/mapflow/runtime.py', 'health'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode == 0:
            health = json.loads(run(DOCKER + ['exec', name, 'python', '-I', '-B', '-c', 'import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen("http://127.0.0.1:18219/healthz",timeout=15))))']))
            break
        time.sleep(.4)
    else:
        raise RuntimeError('Inference health unavailable')
    guards.assert_model_sidecar(inspect(name), inspect(app)['Id'], health, manifest['health'])
    files = json.loads(run(DOCKER + ['exec', name, 'python', '-I', '-B', '/opt/mapflow/runtime.py', 'files']))
    smoke = json.loads(run(DOCKER + ['exec', name, 'python', '-I', '-B', '/opt/mapflow/runtime.py', 'smoke']))
    return {'health': health, 'files': files, 'smoke': smoke, 'imageId': inspect(name)['Image']}


def stage_app(name, image, knowledge=True):
    command = DOCKER + ['run', '-d', '--name', name, '--network', CLONE_NETWORK, '--env-file', str(RELEASE / 'stage-app.env'),
                        '-e', 'MAPFLOW_IDENTITY_TRUSTED_PROXY_IP=127.0.0.1', '--read-only', '--memory', '768m', '--cpus', '1',
                        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true']
    if knowledge:
        command += ['-e', 'MAPFLOW_KNOWLEDGE_WORKER_URL=' + KNOWLEDGE_URL]
    for index, mount in enumerate(original()['Mounts']):
        assert mount['Type'] == 'bind'
        source = mount['Source']
        if mount['Destination'] == '/run/secrets/database.url':
            source = str(RELEASE / 'stage-database.url')
        elif mount['Destination'] == '/run/secrets/admin-username':
            source = str(RELEASE / 'stage-admin-username')
        elif mount['RW']:
            target = RELEASE / ('clone-mount-' + str(index))
            if not target.exists():
                assert not Path(source).is_symlink()
                if mount['Destination'] == '/var/lib/mapflow/diagnostics':
                    target.mkdir(mode=0o700)
                elif Path(source).is_dir():
                    assert not any(child.is_symlink() for child in Path(source).rglob('*'))
                    shutil.copytree(source, target)
                else:
                    shutil.copy2(source, target)
                for item in [target, *target.rglob('*')] if target.is_dir() else [target]:
                    os.chown(item, 10001, 10001)
            source = str(target)
        command += ['--mount', 'type=bind,src=' + source + ',dst=' + mount['Destination'] + ('' if mount['RW'] else ',readonly')]
    for target, options in original()['HostConfig'].get('Tmpfs', {}).items():
        command += ['--tmpfs', target + ':' + options]
    run(command + [image])
    full.helpers.ready(name)


def verify_business(container, before, columns, *, seeded=False, retention=None):
    current = fingerprints(container, projected=True)
    expected = dict(guards.NEW_TABLE_COUNTS)
    if seeded:
        expected.update(assistant_knowledge_articles=9, assistant_knowledge_revisions=9, assistant_knowledge_audit=9)
    guards.assert_business_preserved(before, current, conversation_columns_before=columns,
                                    conversation_columns_after=conversation_columns(container),
                                    nonzero_global_change_sequences=int(sql(container, 'SELECT count(*) FROM tavern_conversations WHERE global_change_sequence<>0')),
                                    expected_new_counts=expected, observation_retention=retention)
    return current


def clone_register(label):
    username = (RELEASE / 'stage-admin-username').read_text().strip() if label == 'admin' else label + secrets.token_hex(4)
    status, challenge, _ = api(CLONE_APP, 'POST', '/api/auth/registration-challenge', {})
    assert status == 200
    left, operator, right = challenge['question'].split()[:3]
    status, account, cookie = api(CLONE_APP, 'POST', '/api/auth/register', {
        'username': username, 'password': 'Aa9!' + secrets.token_urlsafe(24), 'email': username.lower() + '@example.invalid',
        'challengeId': challenge['challengeId'], 'challengeAnswer': str(int(left) + int(right) if operator == '+' else int(left) - int(right))})
    assert status in [200, 201] and cookie
    account_id = sql(CLONE_DB, "SELECT account_id FROM accounts WHERE username_key='" + username.lower() + "'").strip()
    return cookie.split(';')[0], account['csrfToken'], account_id


def canary_setup():
    assert (RELEASE / 'prepared.json').exists() and inspect(APP)['Id'] == original()['Id']
    assert not any(exists(name) for name in [CLONE_APP, CLONE_DB, CLONE_NETWORK, CLONE_KNOWLEDGE, ROLLBACK_APP])
    run(DOCKER + ['network', 'create', '--internal', '--label', 'org.mapflow.release=global-guidance-20261015', CLONE_NETWORK])
    uri, user, database = full.factory.base.database_info()
    password = secrets.token_urlsafe(30)
    full.factory.base.private_write(RELEASE / 'stage-db.env', 'POSTGRES_USER=' + user + '\nPOSTGRES_DB=' + database + '\nPOSTGRES_PASSWORD=' + password + '\n')
    data = RELEASE / 'clone-postgres-data'
    data.mkdir(mode=0o700)
    run(DOCKER + ['run', '-d', '--name', CLONE_DB, '--network', CLONE_NETWORK, '--env-file', str(RELEASE / 'stage-db.env'),
                  '--memory', '512m', '--cpus', '0.75', '--mount', 'type=bind,src=' + str(data) + ',dst=/var/lib/postgresql/data', inspect(PROD_DB)['Image']])
    for attempt in range(120):
        ready = subprocess.run(DOCKER + ['exec', CLONE_DB, 'pg_isready', '-U', user, '-d', database], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        initialized = subprocess.run(DOCKER + ['exec', CLONE_DB, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if ready and initialized:
            break
        time.sleep(.3)
    else:
        raise RuntimeError('Clone database unavailable')
    run(DOCKER + ['exec', '-i', CLONE_DB, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '-U', user, '-d', database], (RELEASE / 'canary-source.dump').read_bytes())
    before, versions, columns = fingerprints(CLONE_DB), migration_rows(CLONE_DB), conversation_columns(CLONE_DB)
    prior_pending = pending(CLONE_DB)
    guards.assert_reconciliation_preserved(prior_pending, prior_pending)
    pg_before = postgres_evidence(CLONE_DB)
    destination = uri._replace(netloc=urllib.parse.quote(user, safe='') + ':' + urllib.parse.quote(password, safe='') + '@' + CLONE_DB + ':5432', query='')
    full.factory.base.private_write(RELEASE / 'stage-database.url', urllib.parse.urlunsplit(destination), 10001)
    full.factory.base.private_write(RELEASE / 'stage-app.env', '\n'.join(original()['Config']['Env']) + '\n')
    full.factory.base.private_write(RELEASE / 'stage-admin-username', 'GuidanceAdmin' + secrets.token_hex(4), 10001)
    full.helpers.migrate(CLONE_DB, RELEASE / 'stage-database.url', CLONE_NETWORK)
    verify_migration(CLONE_DB, versions)
    verify_business(CLONE_DB, before, columns)
    pg_after = postgres_evidence(CLONE_DB)
    stage_app(ROLLBACK_APP, PREVIOUS, knowledge=False)
    assert api(ROLLBACK_APP, 'GET', '/api/wallet')[0] == 401
    pg_rollback = postgres_evidence(CLONE_DB)
    guards.assert_postgres_compatible(pg_before, pg_after, pg_rollback)
    run(DOCKER + ['stop', ROLLBACK_APP])
    stage_app(CLONE_APP, IMAGE)
    assert inspect(CLONE_NETWORK)['Internal'] and not inspect(CLONE_APP)['HostConfig'].get('PortBindings')
    guards.assert_reconciliation_preserved(prior_pending, pending(CLONE_DB))
    save('clone-prepared.private.json', {'pending': prior_pending, 'oldApplicationOnSchema57': True,
                                       'executions': int(sql(CLONE_DB, 'SELECT count(*) FROM agent_executions')),
                                       'modelCalls': int(sql(CLONE_DB, 'SELECT count(*) FROM agent_model_calls'))})
    print(json.dumps({'clonePrepared': True, 'migration': 57, 'oldApplicationRollbackVerified': True}), flush=True)


def check_canary():
    assert inspect(APP)['Id'] == original()['Id'] and inspect(CLONE_NETWORK)['Internal']
    evidence = json.loads((RELEASE / 'clone-prepared.private.json').read_text())
    full.helpers.ready(CLONE_APP)
    knowledge = verify_knowledge(CLONE_KNOWLEDGE, CLONE_APP) if exists(CLONE_KNOWLEDGE) else start_knowledge(CLONE_KNOWLEDGE, CLONE_APP)
    report = access(CLONE_APP)
    guards.assert_reconciliation_preserved(evidence['pending'], pending(CLONE_DB))
    acceptance = load_module('guidance_canary', PACKET / 'global_guidance_canary.py')
    protocols = acceptance.run_checks(lambda *args, **kwargs: api(CLONE_APP, *args, **kwargs), lambda query: sql(CLONE_DB, query), clone_register)
    assert int(sql(CLONE_DB, 'SELECT count(*) FROM agent_executions')) == evidence['executions']
    assert int(sql(CLONE_DB, 'SELECT count(*) FROM agent_model_calls')) == evidence['modelCalls']
    save('canary-passed.json', {'passed': True, 'noExternalNetwork': True, 'migration': 57,
                               'actualOldApplicationOnSchema57': True, 'newModelCalls': 0, 'knowledge': knowledge,
                               'protocols': protocols, 'originalReconciliationPreserved': len(evidence['pending']), **report})
    print(json.dumps({'canaryPassed': True, 'migration': 57, 'oldApplicationRollbackVerified': True, 'newModelCalls': 0, 'protocols': protocols}), flush=True)
    run(DOCKER + ['stop', CLONE_KNOWLEDGE, CLONE_APP, CLONE_DB])


def canary():
    canary_setup()
    check_canary()


def create_production():
    prior = original()
    config = {name: copy.deepcopy(prior['Config'][name]) for name in ['User', 'Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'ExposedPorts', 'Healthcheck', 'StopSignal'] if name in prior['Config']}
    assert not any(entry.startswith('MAPFLOW_KNOWLEDGE_WORKER_URL=') for entry in config['Env'])
    config['Env'].append('MAPFLOW_KNOWLEDGE_WORKER_URL=' + KNOWLEDGE_URL)
    config['Labels'] = {**prior['Config']['Labels'], **LABELS}
    config['Image'], config['HostConfig'] = IMAGE, copy.deepcopy(prior['HostConfig'])
    endpoint = prior['NetworkSettings']['Networks'][NETWORK]
    config['NetworkingConfig'] = {'EndpointsConfig': {NETWORK: {'Aliases': [alias for alias in endpoint.get('Aliases') or [] if len(alias) != 64], 'IPAMConfig': {'IPv4Address': endpoint['IPAddress']}}}}
    connection = DockerConnection('localhost')
    connection.request('POST', '/containers/create?name=' + APP, json.dumps(config), {'Content-Type': 'application/json'})
    response = connection.getresponse()
    body = response.read()
    if response.status != 201:
        save('container-create-failure.private.json', {'status': response.status, 'body': body.decode(errors='replace')})
        raise RuntimeError('Production container creation failed; private diagnostic retained')
    connection.close()
    run(DOCKER + ['start', APP])


def rollback(before, maintenance):
    proxy = ROOT / 'runtime/Caddyfile'
    assert proxy.read_text() in [before, maintenance]
    if proxy.read_text() == before:
        proxy.write_text(maintenance)
        full.factory.base.caddy_reload()
    if exists(PROD_KNOWLEDGE):
        run(DOCKER + ['stop', PROD_KNOWLEDGE])
        run(DOCKER + ['rename', PROD_KNOWLEDGE, PROD_KNOWLEDGE + '-failed-' + str(time.time_ns())])
    if exists(OLD_APP):
        if exists(APP):
            run(DOCKER + ['stop', APP])
            if NETWORK in inspect(APP)['NetworkSettings']['Networks']:
                run(DOCKER + ['network', 'disconnect', NETWORK, APP])
            run(DOCKER + ['rename', APP, APP + '-failed-guidance-' + str(time.time_ns())])
        run(DOCKER + ['rename', OLD_APP, APP])
    if NETWORK not in inspect(APP)['NetworkSettings']['Networks']:
        endpoint = original()['NetworkSettings']['Networks'][NETWORK]
        command = DOCKER + ['network', 'connect', '--ip', endpoint['IPAddress']]
        for alias in endpoint.get('Aliases') or []:
            if len(alias) != 64:
                command += ['--alias', alias]
        run(command + [NETWORK, APP])
    run(DOCKER + ['start', APP])
    full.helpers.ready(APP)
    assert inspect(APP)['Image'] == PREVIOUS
    assert proxy.read_text() in [before, maintenance]
    proxy.write_text(before)
    full.factory.base.caddy_reload()
    save('rollback-passed.json', {'originalApplicationRestored': True, 'databaseRestoredFromBackup': False, 'schema': full.migration(PROD_DB)})


def retention_evidence(before_rows, ages, ordered):
    current = full.helpers.observation_rows(PROD_DB)
    expired = full.helpers.expired_observations(ages, time.time())
    report = full.helpers.verify_observation_retention(before_rows, current, ordered, expired=expired)
    evidence = {'before_rows': before_rows, 'after_rows': current, 'expired_ids': sorted(set(before_rows) - set(current)), 'max_count': 20099}
    guards.assert_observation_retention(**evidence)
    return evidence, report


def cutover():
    assert json.loads((RELEASE / 'canary-passed.json').read_text())['passed']
    assert inspect(APP)['Id'] == original()['Id'] and inspect(APP)['Image'] == PREVIOUS
    assert not exists(OLD_APP) and not exists(PROD_KNOWLEDGE)
    prior_pending = pending(PROD_DB)
    guards.assert_reconciliation_preserved(prior_pending, prior_pending)
    assert full.helpers.legacy_locks(PROD_DB) == 0, 'Active legacy generation; defer cutover'
    assert int(sql(PROD_DB, "SELECT count(*) FROM tree_generation_runs WHERE status IN ('queued','running')")) == 0, 'Active tree generation; defer cutover'
    proxy = ROOT / 'runtime/Caddyfile'
    before = proxy.read_text()
    marker = 'reverse_proxy mapflow-app:8080 {'
    assert before.count(marker) == 1
    maintenance = before.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker)
    full.factory.base.private_write(RELEASE / 'Caddyfile.before', before)
    try:
        proxy.write_text(maintenance)
        full.factory.base.caddy_reload()
        run(DOCKER + ['stop', '--time', '30', APP])
        guards.assert_reconciliation_preserved(prior_pending, pending(PROD_DB))
        size = full.backup('before-cutover.dump')
        baseline, versions, columns = fingerprints(PROD_DB), migration_rows(PROD_DB), conversation_columns(PROD_DB)
        observations = full.helpers.observation_rows(PROD_DB)
        ordered = json.loads(sql(PROD_DB, "SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        ages = full.helpers.observation_age_metadata(PROD_DB)
        save('production-data.before.json', baseline)
        save('production-migrations.before.json', versions)
        save('production-pending.before.private.json', prior_pending)
        save('production-observations.before.private.json', {'rows': observations, 'order': ordered, 'ages': ages})
        full.helpers.migrate(PROD_DB, ROOT / 'runtime/secrets/database.url', NETWORK)
        verify_migration(PROD_DB, versions)
        verify_business(PROD_DB, baseline, columns)
        pg_after = postgres_evidence(PROD_DB)
        pg_before = json.loads((RELEASE / 'postgres.before.json').read_text())
        guards.assert_postgres_compatible(pg_before, pg_after, pg_after)
        run(DOCKER + ['network', 'disconnect', NETWORK, APP])
        run(DOCKER + ['rename', APP, OLD_APP])
        create_production()
        full.helpers.ready(APP)
        knowledge = start_knowledge(PROD_KNOWLEDGE, APP)
        report = access(APP)
        verify_runtime_config()
        guards.assert_reconciliation_preserved(prior_pending, pending(PROD_DB))
        evidence, retention = retention_evidence(observations, ages, ordered)
        current = verify_business(PROD_DB, baseline, columns, seeded=True, retention=evidence)
        verify_migration(PROD_DB, versions)
        assert inspect(PROD_DB)['Id'] == json.loads((RELEASE / 'original-postgres-container.json').read_text())['Id']
        assert proxy.read_text() == maintenance
        proxy.write_text(before)
        full.factory.base.caddy_reload()
        public = full.public_checks()
        save('production-data.after.json', current)
        save('production-passed.json', {'frontend': FRONTEND, 'backend': BACKEND, 'imageId': inspect(APP)['Image'], 'migration': 57,
                                       'backupBytes': size, 'originalTablesPreserved': len(baseline), 'reconciliationPreserved': len(prior_pending),
                                       'observationRetention': retention, 'runtimeConfigurationPreserved': True, 'databaseContainerUnchanged': True,
                                       'knowledge': knowledge, 'publicRoutes': public, **report})
    except Exception:
        rollback(before, maintenance)
        raise
    print(json.dumps({'cutoverPassed': True, 'imageId': inspect(APP)['Image'], 'originalTablesPreserved': len(baseline), 'reconciliationPreserved': len(prior_pending), 'publicRoutes': public, **report}), flush=True)


def finish():
    report = json.loads((RELEASE / 'production-passed.json').read_text())
    verify_runtime_config()
    artifacts(APP)
    verify_knowledge(PROD_KNOWLEDGE, APP)
    full.public_checks()
    notice = '> 全局助手与管理员知识库已发布（2026-10-15）：前端 ' + FRONTEND + '；后端 ' + BACKEND + '；schema57；知识推理仅共享应用loopback。发布、私有备份和应用回退：releases/20261015-global-assistant-guidance/。\n\n'
    operations = ROOT / 'OPERATIONS.md'
    if not operations.read_text().startswith(notice):
        operations.write_text(notice + operations.read_text())
    (RELEASE / 'DEPLOYMENT.md').write_text('# Global assistant guidance — 2026-10-15\n\nFrontend ' + FRONTEND + '; backend ' + BACKEND + '; image ' + report['imageId'] + '. Exact reviewed frontend, Rust and Harness hashes verified. Existing PostgreSQL container/image/binaries/settings retained, vector0.8.2 installed, only migrations56/57 added. Original business records and four reconciliation records retained. Nine help drafts require administrator review; no article published automatically. Isolated restore verified actual ONNX hybrid retrieval, permissions and old application startup on schema57.\n\nRollback: call this release script rollback CLI; it restores ' + OLD_APP + ' with its original environment, mounts, network/IP and payment configuration. Stop the knowledge sidecar tied to the replaced namespace. Keep schema57 and all current database activity. Never restore before-cutover.dump over later user records. The sidecar must be recreated against a replacement app container ID on future releases; see backend runtime documentation.\n')
    print(json.dumps({'deploymentFinished': True, 'frontend': FRONTEND, 'backend': BACKEND, 'imageId': report['imageId'], 'schema': 57}), flush=True)


if __name__ == '__main__':
    load_helpers()
    if sys.argv[1] == 'rollback':
        previous = (RELEASE / 'Caddyfile.before').read_text()
        marker = 'reverse_proxy mapflow-app:8080 {'
        rollback(previous, previous.replace(marker, 'respond "网站升级中，请稍后再试" 503\n\t' + marker))
    else:
        {'prepare': prepare, 'resume-prepare': lambda: prepare(resume=True), 'canary': canary,
         'canary-setup': canary_setup, 'check-canary': check_canary, 'cutover': cutover, 'finish': finish}[sys.argv[1]]()
