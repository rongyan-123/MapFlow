"""Release the fixed platform assistant with migration-aware application rollback."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import secrets
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.parse
import uuid

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/platform-assistant-release-20261015')
RELEASE = ROOT / 'releases/20261015-platform-assistant'
FRONTEND = 'c49ba0f9aadfb6d6bac594a9c5ac83f238caf5ed'
BACKEND = 'a1a579be354a82a955f92090d597aedfa641f7b5'
ROLLBACK_BACKEND = '7fc39d0e21a94769a8cf675a331be7eeaa2be437'
PREVIOUS_FRONTEND = '075cc2be16a5b0f3310a85a68721bde7e7afbc56'
PREVIOUS = 'sha256:d6edb3e9abe14f78d48823649f6fe4afcfd45248786f9457f77267fa72d2a0ab'
IMAGE = 'mapflow-server:platform-assistant-main-20261015-a1a579b'
COMPATIBLE = 'mapflow-server:platform-assistant-compatible-rollback-20261015'
BASE = 'mapflow-server:platform-assistant-base-20261015'
APP = 'mapflow-laptop-app'
OLD_APP = 'mapflow-laptop-app-before-platform-assistant-20261015'
PROD_DB = 'mapflow-laptop-postgres'
NETWORK = 'mapflow-laptop-migration'
CLONE_APP = 'mapflow-platform-assistant-check-app-20261015'
CLONE_DB = 'mapflow-platform-assistant-check-postgres-20261015'
CLONE_NETWORK = 'mapflow-platform-assistant-check-20261015'
COMPATIBLE_APP = CLONE_APP + '-rollback'
DOCKER = ['docker', '-H', 'unix:///var/run/docker.sock']
DRAFT_PRIMARY_KEY = 'PRIMARY KEY (account_id, draft_id, execution_id, kind, action_id)'
BINARY_PATHS = {'/usr/local/bin/mapflow-server', '/usr/local/bin/mapflow-admin'}
full = None


def assert_migrations_preserved(before, after, checksum, primary_key):
    assert set(after) == set(before) | {'55'}, 'Unexpected migration set'
    assert all(after[key] == row for key, row in before.items()), 'Original migration modified'
    assert after['55']['checksum'] == checksum, 'Migration checksum differs'
    assert primary_key == DRAFT_PRIMARY_KEY, 'Draft deduplication is not execution-scoped'


def rollback_image_for_schema(version):
    assert version in [54, 55], 'Unknown schema; refuse automatic rollback'
    return COMPATIBLE if version == 55 else PREVIOUS


def assert_runtime_changes(before, after):
    assert before.keys() == after.keys(), 'Runtime file set changed'
    assert all(before[key] == after[key] for key in before if key not in BINARY_PATHS), 'Worker or Node changed'


def assert_distinct_server_versions(candidate, rollback):
    assert candidate['/usr/local/bin/mapflow-server'] != rollback['/usr/local/bin/mapflow-server'], 'Different source versions reused the same server binary'


def assert_business_preserved(before, after):
    assert before.keys() == after.keys(), 'Business table set changed'
    assert all(before[key] == after[key] for key in before if key not in ['_sqlx_migrations', 'request_observations']), 'Business rows changed'


def assert_isolated_clone(container, network):
    assert network['Internal'], 'Clone can reach external networks'
    assert set(container['NetworkSettings']['Networks']) == {CLONE_NETWORK}, 'Unexpected clone network'
    assert not container['HostConfig'].get('PortBindings'), 'Clone publishes host ports'


def run(arguments, payload=None, **options):
    completed = subprocess.run(arguments, input=payload if payload is not None else options.get('input_bytes'), stdout=options.get('output') or subprocess.PIPE, stderr=subprocess.PIPE)
    if completed.returncode:
        diagnostic = (RELEASE if RELEASE.exists() else PACKET) / ('operation-failure-' + str(time.time_ns()) + '.private.log')
        diagnostic.write_bytes((completed.stdout or b'') + b'\n' + completed.stderr)
        diagnostic.chmod(0o600)
        raise RuntimeError('Operation failed; private diagnostic: ' + diagnostic.name)
    return completed.stdout


def save(name, value):
    path = RELEASE / name
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    path.chmod(0o600)


def load_helpers():
    global full
    source = ROOT / 'releases/20261015-full-frontend/full_frontend_release.py'
    spec = importlib.util.spec_from_file_location('reviewed_frontend_release', source)
    full = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(full)
    for name in ['PACKET', 'RELEASE', 'FRONTEND', 'BACKEND', 'PREVIOUS', 'IMAGE', 'APP', 'OLD_APP', 'PROD_DB', 'NETWORK', 'CLONE_APP', 'CLONE_DB', 'CLONE_NETWORK']:
        setattr(full, name, globals()[name])
    full.run = run
    full.load_helpers()
    full.helpers.IMAGE = IMAGE
    full.artifacts = artifacts


def inspect(name):
    return full.inspect(name)


def sql(container, query):
    return full.sql(container, query)


def api(container, method, path, body=None, cookie=None, csrf=None):
    return full.api(container, method, path, body, cookie, csrf)


def versions(container):
    return json.loads(sql(container, "SELECT coalesce(json_object_agg(version::text,json_build_object('digest',md5(to_jsonb(r)::text),'checksum',encode(checksum,'hex'))),'{}') FROM _sqlx_migrations r"))


def verify_upgrade(container, original_versions):
    primary_key = sql(container, "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='agent_map_draft_operations'::regclass AND contype='p'").strip()
    assert full.migration(container) == 55
    assert_migrations_preserved(original_versions, versions(container), json.loads((PACKET/'source.json').read_text())['migration55Sha384'], primary_key)


def artifacts(container, compatible=False):
    provenance = json.loads((RELEASE/'provenance.json').read_text())
    expected = provenance['rollbackFiles' if compatible else 'files']
    actual = {line.split(maxsplit=1)[1].strip():line.split()[0] for line in run(DOCKER+['exec',container,'sha256sum',*sorted(expected)]).decode().splitlines()}
    assert actual == expected, 'Container artifacts differ'
    current = inspect(container)
    assert current['Image'] == provenance['rollbackImageId' if compatible else 'imageId']
    assert current['Config']['Labels']['org.opencontainers.image.revision'] == (ROLLBACK_BACKEND if compatible else BACKEND)
    assert current['Config']['Labels']['com.mapflow.frontend.revision'] == (PREVIOUS_FRONTEND if compatible else FRONTEND)
    return {'verifiedFiles':len(expected), 'unchangedWorkerFiles':len(provenance['workerFiles'])}


def prepare():
    assert not RELEASE.exists() and not full.exists(OLD_APP), 'Release already exists'
    assert inspect(APP)['Image'] == PREVIOUS and inspect(APP)['State']['Running']
    builder = inspect('mapflow-platform-assistant-build-20261015')
    assert builder['State']['Status'] == 'exited' and builder['State']['ExitCode'] == 0, 'Build incomplete'
    RELEASE.mkdir(mode=0o700)
    save('original-container.json', inspect(APP))
    source = json.loads((PACKET/'source.json').read_text())
    assert source['frontend'] == FRONTEND and source['backend'] == BACKEND and source['rollbackBackend'] == ROLLBACK_BACKEND
    for name, digest in source['archives'].items():
        assert hashlib.sha256((PACKET/name).read_bytes()).hexdigest() == digest, 'Source archive changed'
    context = PACKET/'context'
    context.mkdir()
    with tarfile.open(PACKET/'frontend.tar.gz') as archive:
        archive.extractall(context, filter='data')
    web = json.loads((PACKET/'frontend-files.json').read_text())
    full.verify_web_manifest(context/'web-dist', web)
    previous = json.loads((ROOT/'releases/20261015-full-frontend/provenance.json').read_text())
    assert previous['imageId'] == PREVIOUS
    before = previous['runtimeFiles']
    worker = {name:digest for name,digest in before.items() if name not in BINARY_PATHS}
    runtime = {}
    for version in ['candidate', 'rollback']:
        shutil.copytree(PACKET/'build-output'/version, context/version)
        runtime[version] = {**worker, **{'/usr/local/bin/'+name:hashlib.sha256((context/version/name).read_bytes()).hexdigest() for name in ['mapflow-server','mapflow-admin']}}
        assert_runtime_changes(before, runtime[version])
    assert_distinct_server_versions(runtime['candidate'],runtime['rollback'])
    run(DOCKER+['tag',PREVIOUS,BASE])
    assert inspect(BASE)['Id'] == PREVIOUS
    for compatible in [False, True]:
        version = 'rollback' if compatible else 'candidate'
        backend = ROLLBACK_BACKEND if compatible else BACKEND
        frontend = PREVIOUS_FRONTEND if compatible else FRONTEND
        dockerfile = context/('Dockerfile.rollback' if compatible else 'Dockerfile')
        dockerfile.write_text('FROM '+BASE+'\nLABEL org.opencontainers.image.revision="'+backend+'" com.mapflow.frontend.revision="'+frontend+'" dev.mapflow.frontend.revision="'+frontend+'" org.opencontainers.image.version="platform-assistant-20261015"\nCOPY --chmod=0555 '+version+'/mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 '+version+'/mapflow-admin /usr/local/bin/mapflow-admin\n'+('' if compatible else 'COPY --chown=10001:10001 web-dist/ /srv/mapflow/\n'))
        run(DOCKER+['build','--network=none','-f',str(dockerfile),'-t',COMPATIBLE if compatible else IMAGE,str(context)])
    files = {**runtime['candidate'],**{'/srv/mapflow/'+name:digest for name,digest in web.items()}}
    rollback_files = {**runtime['rollback'],**{'/srv/mapflow/'+name:digest for name,digest in previous['webFiles'].items()}}
    save('provenance.json', {'frontend':FRONTEND,'backend':BACKEND,'rollbackBackend':ROLLBACK_BACKEND,'imageId':inspect(IMAGE)['Id'],'rollbackImageId':inspect(COMPATIBLE)['Id'],'files':files,'rollbackFiles':rollback_files,'workerFiles':worker,'source':source,'buildContainer':builder['Id']})
    assert full.migration(PROD_DB) == 54
    size = full.backup('canary-source.dump')
    shutil.copy2(__file__, RELEASE/'platform_assistant_release.py')
    save('prepared.json', {'backupBytes':size,'imageId':inspect(IMAGE)['Id'],'reviewedFrontendFiles':len(web),'migrationBefore':54})
    print(json.dumps({'prepared':True,'backupBytes':size,'imageId':inspect(IMAGE)['Id']}),flush=True)


def start_stage(name, image):
    command = DOCKER+['run','-d','--name',name,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-app.env'),'-e','MAPFLOW_IDENTITY_TRUSTED_PROXY_IP=127.0.0.1','--read-only','--memory','1073741824','--cpus','2','--cap-drop','ALL','--security-opt','no-new-privileges:true']
    for index, mount in enumerate(full.original()['Mounts']):
        assert mount['Type'] == 'bind'
        source = mount['Source']
        readonly = not mount['RW']
        if mount['Destination'] == '/run/secrets/database.url':
            source = str(RELEASE/'stage-database.url')
        elif mount['RW']:
            target = RELEASE/('clone-mount-'+str(index))
            if not target.exists():
                assert not Path(source).is_symlink()
                if mount['Destination'] == '/var/lib/mapflow/diagnostics':
                    target.mkdir(mode=0o700)
                elif Path(source).is_dir():
                    assert not any(p.is_symlink() for p in Path(source).rglob('*'))
                    shutil.copytree(source,target)
                else:
                    shutil.copy2(source,target)
                os.chown(target,10001,10001)
                if target.is_dir():
                    for child in target.rglob('*'):
                        os.chown(child,10001,10001)
            source = str(target)
        command += ['--mount','type=bind,src='+source+',dst='+mount['Destination']+(',readonly' if readonly else '')]
    for target, options in full.original()['HostConfig'].get('Tmpfs',{}).items():
        command += ['--tmpfs',target+':'+options]
    run(command+[image])
    full.helpers.ready(name)
    assert_isolated_clone(inspect(name), inspect(CLONE_NETWORK))


def platform_protocol(cookie, csrf):
    def call(method, path, body=None, expected=200):
        status, payload, _ = api(CLONE_APP,method,path,body,cookie,csrf)
        assert status == expected, (method,path,status,expected)
        return payload
    wallet = call('GET','/api/wallet')
    assistant = call('POST','/api/me/tavern/management-conversations',{})
    platform = assistant['character']['characterId']
    card = assistant['character']['card']
    identity = assistant['conversation']['conversationId']
    role_path = '/api/me/tavern/characters/'+platform
    assert not call('GET','/api/me/tavern/characters')['characters']
    for method, body in [('GET',None),('PATCH',{'expectedHash':assistant['character']['normalizedHash'],'card':{**card,'name':'forbidden user edit'}}),('DELETE',None)]:
        call(method,role_path,body,404)
    call('POST','/api/me/tavern/conversations',{'characterId':platform,'userName':'release'},404)
    trees = call('GET','/api/trees/public')['trees']
    assert trees
    entry = call('POST','/api/me/tree-library',{'treeId':trees[0]['id']})['library_entry_id']
    area = '/api/me/learning-areas/'+entry
    call('POST',area,{})
    learning = call('POST',area+'/conversations',{})
    private_role = learning['character']['characterId']
    assert private_role != platform
    call('POST',area+'/conversations',{'characterId':platform},404)
    call('POST','/api/me/tavern/management-conversations',{'newConversation':True,'characterId':private_role},404)
    call('PATCH','/api/me/tavern/conversations/'+identity+'/character',{'expectedRevision':assistant['graph']['revision'],'characterId':private_role},403)
    story = call('POST','/api/me/tavern/conversations',{'characterId':private_role,'userName':'release'},201)
    assert story['characterId'] == private_role
    next_assistant = call('POST','/api/me/tavern/management-conversations',{'newConversation':True,'clientRequestId':str(uuid.uuid4())})
    assert next_assistant['character']['characterId'] == platform
    restored = call('GET','/api/me/tavern/conversations/'+identity)
    assert restored['graph'] == assistant['graph'] and restored['character'] == assistant['character']
    assert all(role['characterId'] != platform for role in call('GET','/api/me/tavern/characters')['characters'])
    assert call('GET','/api/wallet') == wallet
    return {'platformProtected':True,'privateRoleUsable':True,'fixedGlobalCreation':True,'historyPreserved':True,'walletUnchanged':True}


def canary():
    assert (RELEASE/'prepared.json').exists() and inspect(APP)['Id'] == full.original()['Id']
    assert not any(full.exists(name) for name in [CLONE_APP,CLONE_DB,CLONE_NETWORK,COMPATIBLE_APP])
    run(DOCKER+['network','create','--internal',CLONE_NETWORK])
    uri, user, database = full.factory.base.database_info()
    password = secrets.token_urlsafe(30)
    full.factory.base.private_write(RELEASE/'stage-db.env','POSTGRES_USER='+user+'\nPOSTGRES_DB='+database+'\nPOSTGRES_PASSWORD='+password+'\n')
    run(DOCKER+['run','-d','--name',CLONE_DB,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-db.env'),'--memory','768m','--tmpfs','/var/lib/postgresql/data:rw,size=768m',inspect(PROD_DB)['Image']])
    for attempt in range(100):
        ready = subprocess.run(DOCKER+['exec',CLONE_DB,'pg_isready','-U',user,'-d',database],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
        initialized = subprocess.run(DOCKER+['exec',CLONE_DB,'sh','-c','test "$(cat /proc/1/comm)" = postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
        if ready and initialized:
            break
        time.sleep(.3)
    else:
        raise RuntimeError('Clone database unavailable')
    run(DOCKER+['exec','-i',CLONE_DB,'pg_restore','--no-owner','--no-acl','--exit-on-error','-U',user,'-d',database],(RELEASE/'canary-source.dump').read_bytes())
    before, original_versions = full.fingerprints(CLONE_DB), versions(CLONE_DB)
    assert full.migration(CLONE_DB) == 54
    destination = uri._replace(netloc=urllib.parse.quote(user,safe='')+':'+urllib.parse.quote(password,safe='')+'@'+CLONE_DB+':5432',query='')
    full.factory.base.private_write(RELEASE/'stage-database.url',urllib.parse.urlunsplit(destination),10001)
    for repeat in range(2):
        full.helpers.migrate(CLONE_DB,RELEASE/'stage-database.url',CLONE_NETWORK)
        verify_upgrade(CLONE_DB,original_versions)
        assert_business_preserved(before,full.fingerprints(CLONE_DB))
    full.factory.base.private_write(RELEASE/'stage-app.env','\n'.join(full.original()['Config']['Env'])+'\n')
    start_stage(CLONE_APP,IMAGE)
    report = full.access(CLONE_APP)
    executions = int(sql(CLONE_DB,'SELECT count(*) FROM agent_executions'))
    protocol = platform_protocol(*full.helpers.register('PlatformReview'))
    full.check_management_lifecycle(CLONE_APP,*full.helpers.register('DeleteReview'))
    assert int(sql(CLONE_DB,'SELECT count(*) FROM agent_executions')) == executions
    run(DOCKER+['stop',CLONE_APP])
    start_stage(COMPATIBLE_APP,COMPATIBLE)
    rollback_artifacts = artifacts(COMPATIBLE_APP,True)
    assert api(COMPATIBLE_APP,'GET','/assistant')[1] == api(APP,'GET','/assistant')[1]
    full.helpers.CLONE_APP = COMPATIBLE_APP
    try:
        full.check_management_lifecycle(COMPATIBLE_APP,*full.helpers.register('RollbackReview'))
    finally:
        full.helpers.CLONE_APP = CLONE_APP
    assert int(sql(CLONE_DB,'SELECT count(*) FROM agent_executions')) == executions
    run(DOCKER+['stop',COMPATIBLE_APP])
    run(DOCKER+['start',CLONE_APP])
    full.helpers.ready(CLONE_APP)
    assert inspect(APP)['Image'] == PREVIOUS and full.migration(PROD_DB) == 54
    save('canary-passed.json',{'passed':True,'migration':55,'migrationRepeated':True,'originalTablesPreserved':len(before),'newModelExecutions':0,'compatibleRollbackVerified':True,'rollbackArtifacts':rollback_artifacts,**protocol,**report})
    print(json.dumps({'canaryPassed':True,'migration':55,'newModelExecutions':0,'compatibleRollbackVerified':True,**protocol}),flush=True)


def quiescent():
    pending = full.pending_executions(PROD_DB)
    full.assert_executions_quiescent(pending)
    assert full.helpers.legacy_locks(PROD_DB) == 0, 'Active conversation generation'
    assert int(sql(PROD_DB,"SELECT count(*) FROM tree_generation_runs WHERE status IN ('queued','running')")) == 0, 'Active tree generation'
    return pending


def rollback(before, maintenance):
    compatible = rollback_image_for_schema(full.migration(PROD_DB))
    if compatible == PREVIOUS:
        full.rollback(before,maintenance)
        return
    if full.exists(APP):
        run(DOCKER+['stop',APP])
        if NETWORK in inspect(APP)['NetworkSettings']['Networks']:
            run(DOCKER+['network','disconnect',NETWORK,APP])
        run(DOCKER+['rename',APP,OLD_APP if not full.exists(OLD_APP) else 'mapflow-platform-assistant-failed-'+str(time.time_ns())])
    full.factory.IMAGE = COMPATIBLE
    try:
        full.factory.create_production()
    finally:
        full.factory.IMAGE = IMAGE
    full.helpers.ready(APP)
    artifacts(APP,True)
    assert full.factory.retained_config()
    proxy = ROOT/'runtime/Caddyfile'
    assert proxy.read_text() in [before,maintenance]
    proxy.write_text(before)
    full.factory.base.caddy_reload()
    save('rollback-passed.json',{'compatibleBackend':ROLLBACK_BACKEND,'imageId':inspect(APP)['Image'],'databaseRestoredFromBackup':False})


def cutover():
    assert json.loads((RELEASE/'canary-passed.json').read_text())['passed']
    assert inspect(APP)['Id'] == full.original()['Id'] and inspect(APP)['Image'] == PREVIOUS and not full.exists(OLD_APP)
    pending = quiescent()
    proxy = ROOT/'runtime/Caddyfile'
    before = proxy.read_text()
    marker = 'reverse_proxy mapflow-app:8080 {'
    assert before.count(marker) == 1
    maintenance = before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker)
    full.factory.base.private_write(RELEASE/'Caddyfile.before',before)
    try:
        proxy.write_text(maintenance)
        full.factory.base.caddy_reload()
        run(DOCKER+['stop','--time','30',APP])
        assert quiescent() == pending, 'Execution activity changed while draining'
        size = full.backup('before-cutover.dump')
        baseline, original_versions = full.fingerprints(PROD_DB), versions(PROD_DB)
        observations = full.helpers.observation_rows(PROD_DB)
        ordered = json.loads(sql(PROD_DB,"SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        ages = full.helpers.observation_age_metadata(PROD_DB)
        save('production-data.before.json',baseline)
        save('production-migrations.before.json',original_versions)
        save('production-observations.before.json',observations)
        save('production-observation-order.private.json',ordered)
        save('production-observation-ages.private.json',ages)
        mount = next(mount for mount in full.original()['Mounts'] if mount['Destination'] == '/run/secrets/database.url')
        full.helpers.migrate(PROD_DB,Path(mount['Source']),NETWORK)
        verify_upgrade(PROD_DB,original_versions)
        assert_business_preserved(baseline,full.fingerprints(PROD_DB))
        run(DOCKER+['network','disconnect',NETWORK,APP])
        run(DOCKER+['rename',APP,OLD_APP])
        full.factory.create_production()
        full.helpers.ready(APP)
        report = full.access(APP)
        assert full.factory.retained_config()
        assert full.pending_executions(PROD_DB) == pending
        current = full.fingerprints(PROD_DB)
        assert_business_preserved(baseline,current)
        verify_upgrade(PROD_DB,original_versions)
        save('production-data.after.json',current)
        retention = full.helpers.verify_observation_retention(observations,full.helpers.observation_rows(PROD_DB),ordered,expired=full.helpers.expired_observations(ages,time.time()))
        assert proxy.read_text() == maintenance
        proxy.write_text(before)
        full.factory.base.caddy_reload()
        public = full.public_checks()
        save('production-passed.json',{'frontend':FRONTEND,'backend':BACKEND,'imageId':inspect(APP)['Image'],'migration':55,'backupBytes':size,'originalTablesPreserved':len(baseline),'pendingReconciliationPreserved':len(pending),'observationRetention':retention,'runtimeConfigurationPreserved':True,'publicRoutes':public,**report})
    except Exception:
        rollback(before,maintenance)
        raise
    print(json.dumps({'cutoverPassed':True,'migration':55,'imageId':inspect(APP)['Image'],'originalTablesPreserved':len(baseline),'observationRetention':retention,**report}),flush=True)


def finish():
    report = json.loads((RELEASE/'production-passed.json').read_text())
    assert full.factory.retained_config()
    artifacts(APP)
    full.public_checks()
    notice = '> 平台固定助手与角色库发布（2026-10-15）：前端 '+FRONTEND+'；后端 '+BACKEND+'；数据库 0055；镜像 '+IMAGE+'。兼容回退镜像 '+COMPATIBLE+'（后端 '+ROLLBACK_BACKEND+'）。不得直接重启迁移前的旧应用，不得以历史数据库覆盖新用户活动。材料见 releases/20261015-platform-assistant/。\n\n'
    operations = ROOT/'OPERATIONS.md'
    if not operations.read_text().startswith(notice):
        operations.write_text(notice+operations.read_text())
    (RELEASE/'DEPLOYMENT.md').write_text('# Platform assistant release — 2026-10-15\n\nFrontend '+FRONTEND+'; backend '+BACKEND+'; migration 0055; image '+report['imageId']+'. Old business rows and migration rows preserved; request observation retention verified. Compatible rollback '+COMPATIBLE+' uses backend '+ROLLBACK_BACKEND+' and the previous frontend. Never restart '+OLD_APP+' directly after 0055 and never restore a historical dump over new activity.\n')
    run(DOCKER+['stop',CLONE_APP,CLONE_DB])
    print(json.dumps({'deploymentFinished':True,'frontend':FRONTEND,'backend':BACKEND,'migration':55,'imageId':report['imageId']}),flush=True)


if __name__ == '__main__':
    load_helpers()
    {'prepare':prepare,'canary':canary,'cutover':cutover,'finish':finish}[sys.argv[1]]()
