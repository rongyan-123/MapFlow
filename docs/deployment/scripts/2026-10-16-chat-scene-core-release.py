"""Frontend-only release over the existing guidance runtime. No SQL writes or migrations."""
from pathlib import Path
import copy,hashlib,importlib.util,json,shutil,subprocess,sys,tarfile,time

ROOT=Path('/opt/mapflow-laptop-migration-20261006')
PACKET=Path('/home/rong/.local/state/mapflow/chat-scene-core-20261016')
RELEASE=ROOT/'releases/20261016-chat-scene-core'
FRONTEND='093a79bd5488c9ae908297d774cd3fee89ab5efd'
PREVIOUS='sha256:14dd0656ee0645d11fefcd6d0f8daf5dc4562788cb46b9ec16dbd23fe3194dd7'
EXPECTED_APP='2ecf5ac0e60d3e8f91d11ccb69d44d8999edcdcb164d29e999e64f02b70dfb9c'
IMAGE='mapflow-server:chat-scene-core-20261016-093a79b'
BASE='mapflow-server:chat-scene-core-base-20261016-14dd065'
APP='mapflow-laptop-app'
KNOWLEDGE='mapflow-laptop-knowledge'
OLD_APP=APP+'-before-chat-scene-core-20261016'
OLD_KNOWLEDGE=KNOWLEDGE+'-before-chat-scene-core-20261016'
DB='mapflow-laptop-postgres'
NETWORK='mapflow-laptop-migration'
D=['docker','-H','unix:///var/run/docker.sock']

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

checks=load('frontend_release_checks',PACKET/'release_checks.py')
g=load('prior_guidance_release',ROOT/'releases/20261015-global-assistant-guidance/2026-10-15-global-guidance-release.py')
g.load_helpers()
for key,value in {'RELEASE':RELEASE,'PACKET':PACKET,'FRONTEND':FRONTEND,'PREVIOUS':PREVIOUS,'IMAGE':IMAGE,'OLD_APP':OLD_APP}.items():
    setattr(g,key,value);setattr(g.full,key,value)
g.full.run=g.run;g.full.load_helpers()
f=g.full

def private(name,value):g.save(name,value)
def inspect(name):return g.inspect(name)
def run(arguments,**kwargs):return g.run(arguments,**kwargs)
def original():return g.original()
def exists(name):return g.exists(name)
def read(name):return json.loads((RELEASE/name).read_text())

def verify_inputs():
    source=json.loads((PACKET/'source.json').read_text())
    assert source['frontend']==source['main']==FRONTEND
    assert hashlib.sha256((PACKET/'frontend.tar.gz').read_bytes()).hexdigest()==source['archiveSha256']
    for name,digest in source['tools'].items():
        assert hashlib.sha256((PACKET/name).read_bytes()).hexdigest()==digest,'Release tool changed'
    return source

def artifacts(container):
    manifest=read('provenance.json')
    runtime=g.file_hashes(container,manifest['runtimeFiles'])
    assert runtime==manifest['runtimeFiles'],'Production runtime files changed'
    web={'/srv/mapflow/'+name:digest for name,digest in manifest['webFiles'].items()}
    assert g.file_hashes(container,web)==web,'Frontend artifact mismatch'
    actual=run(D+['exec',container,'find','/srv/mapflow','-type','f']).decode().splitlines()
    assert set(actual)==set(web),'Obsolete frontend artifacts remain'
    worker=run(D+['exec',container,'find','/opt/mapflow/harness-worker/dist','-type','f']).decode().splitlines()
    assert set(worker)=={name for name in runtime if name.startswith('/opt/mapflow/harness-worker/dist/')}
    assert inspect(container)['Image']==manifest['imageId']
    return {'frontendFiles':len(web),'unchangedRuntimeFiles':len(runtime)}

def prepare():
    assert not RELEASE.exists() and not exists(OLD_APP) and not exists(OLD_KNOWLEDGE)
    assert inspect(APP)['Id']==EXPECTED_APP and inspect(APP)['Image']==PREVIOUS
    RELEASE.mkdir(mode=0o700)
    private('original-container.json',inspect(APP));private('original-knowledge.json',inspect(KNOWLEDGE));private('original-postgres.json',inspect(DB))
    source=verify_inputs()
    context=PACKET/'context';context.mkdir(mode=0o700)
    with tarfile.open(PACKET/'frontend.tar.gz') as archive:archive.extractall(context,filter='data')
    web=json.loads((PACKET/'frontend-files.json').read_text())
    f.verify_web_manifest(context/'web-dist',web)
    baseline=json.loads((ROOT/'releases/20261016-admin-settlement-review/provenance.json').read_text())
    assert baseline['imageId']==PREVIOUS
    runtime=baseline['runtimeFiles']
    assert g.file_hashes(APP,runtime)==runtime
    run(D+['tag',PREVIOUS,BASE])
    user=original()['Config']['User'];assert user=='10001:10001'
    (context/'Dockerfile').write_text('FROM '+BASE+'\nUSER 0\nRUN rm -rf /srv/mapflow && mkdir -p /srv/mapflow && chown 10001:10001 /srv/mapflow\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\nUSER '+user+'\nLABEL com.mapflow.frontend.revision="'+FRONTEND+'" dev.mapflow.frontend.revision="'+FRONTEND+'"\n')
    run(D+['build','--network=none','-t',IMAGE,str(context)])
    f.assert_runtime_layers(inspect(PREVIOUS)['RootFS']['Layers'],inspect(IMAGE)['RootFS']['Layers'])
    actual={line.split(maxsplit=1)[1].strip():line.split()[0] for line in run(D+['run','--rm','--network=none','--read-only','--memory=64m','--pids-limit=32','--cap-drop=ALL','--entrypoint=sha256sum',IMAGE,*sorted(runtime)]).decode().splitlines()}
    assert actual==runtime,'New image changed runtime artifacts'
    candidate='mapflow-chat-scene-core-files-20261016';assert not exists(candidate)
    run(D+['create','--name',candidate,'--network=none',IMAGE])
    run(D+['cp',candidate+':/srv/mapflow',str(RELEASE/'candidate-web')])
    f.verify_web_manifest(RELEASE/'candidate-web',web)
    run(D+['rm',candidate])
    private('provenance.json',{'frontend':FRONTEND,'backend':original()['Config']['Labels']['org.opencontainers.image.revision'],'baseImage':PREVIOUS,'image':IMAGE,'imageId':inspect(IMAGE)['Id'],'webFiles':web,'runtimeFiles':runtime,'source':source})
    shutil.copy2(PACKET/'chat_scene_release.py',RELEASE/'chat_scene_release.py');shutil.copy2(PACKET/'release_checks.py',RELEASE/'release_checks.py')
    private('prepared.json',{'passed':True,'frontendFiles':len(web),'unchangedRuntimeFiles':len(runtime),'schema':f.migration(DB)})
    print(json.dumps({'prepared':True,'frontendFiles':len(web),'unchangedRuntimeFiles':len(runtime),'imageId':inspect(IMAGE)['Id']}),flush=True)

def create_app():
    prior=original()
    config={name:copy.deepcopy(prior['Config'][name]) for name in ['User','Env','Cmd','Entrypoint','WorkingDir','ExposedPorts','Healthcheck','StopSignal'] if name in prior['Config']}
    config['Labels']=dict(prior['Config']['Labels'])
    for key in ['com.mapflow.frontend.revision','dev.mapflow.frontend.revision']:config['Labels'][key]=FRONTEND
    config['Image']=IMAGE;config['HostConfig']=copy.deepcopy(prior['HostConfig'])
    endpoint=prior['NetworkSettings']['Networks'][NETWORK]
    config['NetworkingConfig']={'EndpointsConfig':{NETWORK:{'Aliases':[alias for alias in endpoint.get('Aliases') or [] if len(alias)!=64],'IPAMConfig':{'IPv4Address':endpoint['IPAddress']}}}}
    connection=g.DockerConnection('localhost')
    connection.request('POST','/containers/create?name='+APP,json.dumps(config),{'Content-Type':'application/json'})
    response=connection.getresponse();body=response.read();connection.close()
    if response.status!=201:
        private('container-create-failure.private.json',{'status':response.status,'body':body.decode(errors='replace')})
        raise RuntimeError('Application creation failed; private diagnostic retained')
    run(D+['start',APP])

def access():
    expected=(PACKET/'context/web-dist/index.html').read_bytes()
    routes={}
    for path in ['/','/login','/register','/console','/assistant','/library','/maps','/learning','/tavern','/wallet','/models','/settings','/admin','/admin/assistant-knowledge']:
        status,body,_=g.api(APP,'GET',path);assert status==200 and body==expected,(path,status);routes[path]=status
    protected={}
    for path in ['/api/auth/session','/api/wallet','/api/admin/assistant-knowledge/articles','/api/me/assistant-knowledge/search?query=test','/api/me/global-assistant/messages']:
        status,_,_=g.api(APP,'GET',path);assert status==401,(path,status);protected[path]=status
    return {'applicationRoutes':routes,'protectedRoutes':protected,**artifacts(APP)}

def restore(before,maintenance):
    proxy=ROOT/'runtime/Caddyfile';assert proxy.read_text() in [before,maintenance]
    if proxy.read_text()==before:proxy.write_text(maintenance);f.factory.base.caddy_reload()
    suffix='-failed-chat-scene-core-'+str(time.time_ns())
    if exists(KNOWLEDGE) and inspect(KNOWLEDGE)['Id']!=read('original-knowledge.json')['Id']:
        run(D+['stop',KNOWLEDGE]);run(D+['rename',KNOWLEDGE,KNOWLEDGE+suffix])
    if exists(OLD_APP):
        if exists(APP):
            run(D+['stop',APP])
            if NETWORK in inspect(APP)['NetworkSettings']['Networks']:run(D+['network','disconnect',NETWORK,APP])
            run(D+['rename',APP,APP+suffix])
        run(D+['rename',OLD_APP,APP])
    if NETWORK not in inspect(APP)['NetworkSettings']['Networks']:
        endpoint=original()['NetworkSettings']['Networks'][NETWORK]
        command=D+['network','connect','--ip',endpoint['IPAddress']]
        for alias in endpoint.get('Aliases') or []:
            if len(alias)!=64:command+=['--alias',alias]
        run(command+[NETWORK,APP])
    run(D+['start',APP]);f.helpers.ready(APP)
    if exists(OLD_KNOWLEDGE):run(D+['rename',OLD_KNOWLEDGE,KNOWLEDGE])
    run(D+['start',KNOWLEDGE]);g.verify_knowledge(KNOWLEDGE,APP)
    assert inspect(APP)['Id']==original()['Id'] and inspect(APP)['Image']==PREVIOUS
    assert inspect(KNOWLEDGE)['Id']==read('original-knowledge.json')['Id']
    proxy.write_text(before);f.factory.base.caddy_reload()
    private('rollback-passed.json',{'applicationRestored':True,'knowledgeRestored':True,'databaseRestoredFromBackup':False})

def cutover():
    verify_inputs();assert read('prepared.json')['passed']
    assert inspect(APP)['Id']==original()['Id']==EXPECTED_APP and inspect(APP)['Image']==PREVIOUS
    assert inspect(KNOWLEDGE)['Id']==read('original-knowledge.json')['Id']
    assert not exists(OLD_APP) and not exists(OLD_KNOWLEDGE)
    prior_pending=g.pending(DB);g.guards.assert_reconciliation_preserved(prior_pending,prior_pending)
    assert f.helpers.legacy_locks(DB)==0,'Active legacy generation; defer cutover'
    assert int(g.sql(DB,"SELECT count(*) FROM tree_generation_runs WHERE status IN ('queued','running')"))==0
    proxy=ROOT/'runtime/Caddyfile';before=proxy.read_text();marker='reverse_proxy mapflow-app:8080 {';assert before.count(marker)==1
    maintenance=before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker)
    f.factory.base.private_write(RELEASE/'Caddyfile.before',before)
    try:
        proxy.write_text(maintenance);f.factory.base.caddy_reload()
        run(D+['stop',KNOWLEDGE]);run(D+['stop','--time','30',APP])
        g.guards.assert_reconciliation_preserved(prior_pending,g.pending(DB))
        size=f.backup('before-cutover.dump')
        baseline=g.fingerprints(DB);versions=g.migration_rows(DB)
        observations=f.helpers.observation_rows(DB);ages=f.helpers.observation_age_metadata(DB)
        ordered=json.loads(g.sql(DB,"SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        private('business.before.json',baseline);private('migrations.before.json',versions)
        private('pending.before.private.json',prior_pending);private('observations.before.private.json',{'rows':observations,'ages':ages,'order':ordered})
        run(D+['rename',KNOWLEDGE,OLD_KNOWLEDGE]);run(D+['network','disconnect',NETWORK,APP]);run(D+['rename',APP,OLD_APP])
        create_app();f.helpers.ready(APP)
        knowledge=g.start_knowledge(KNOWLEDGE,APP)
        checks.assert_frontend_config(g.normalized_config(original()),g.normalized_config(inspect(APP)),FRONTEND)
        old_knowledge=read('original-knowledge.json')
        checks.assert_knowledge_config(g.normalized_config(old_knowledge),g.normalized_config(inspect(KNOWLEDGE)),inspect(APP)['Id'],old_knowledge['Image'],inspect(KNOWLEDGE)['Image'])
        report=access()
        g.guards.assert_reconciliation_preserved(prior_pending,g.pending(DB))
        assert g.migration_rows(DB)==versions,'Database migration rows changed'
        current=g.fingerprints(DB);f.assert_business_unchanged(baseline,current)
        retention_evidence,retention=g.retention_evidence(observations,ages,ordered)
        assert inspect(DB)['Id']==read('original-postgres.json')['Id']
        assert proxy.read_text()==maintenance;proxy.write_text(before);f.factory.base.caddy_reload()
        public=f.public_checks()
        private('business.after.json',current)
        private('production-passed.json',{'frontend':FRONTEND,'backend':read('provenance.json')['backend'],'image':IMAGE,'imageId':inspect(APP)['Image'],'schema':f.migration(DB),'unchangedBusinessTables':len(baseline),'reconciliationPreserved':len(prior_pending),'backupBytes':size,'databaseContainerUnchanged':True,'observationRetention':retention,'knowledge':knowledge,'publicRoutes':public,**report})
    except BaseException:
        restore(before,maintenance)
        raise
    print(json.dumps({'cutoverPassed':True,'frontend':FRONTEND,'imageId':inspect(APP)['Image'],'schema':f.migration(DB),'businessTablesUnchanged':len(baseline),'reconciliationPreserved':len(prior_pending),'knowledgeHealthy':True,**report}),flush=True)

def finish():
    report=read('production-passed.json');artifacts(APP);g.verify_knowledge(KNOWLEDGE,APP);f.public_checks()
    notice='> 酒馆与学习聊天共享核心已发布（2026-10-16）：'+FRONTEND+'；后端、知识模型与 schema58 不变。回退见 releases/20261016-chat-scene-core/。\n\n'
    operations=ROOT/'OPERATIONS.md'
    if not operations.read_text().startswith(notice):operations.write_text(notice+operations.read_text())
    (RELEASE/'DEPLOYMENT.md').write_text('# Chat scene shared core frontend release — 2026-10-16\n\nFrontend '+FRONTEND+'; image '+report['imageId']+'. Existing runtime files, environment, mounts, networks and database retained. Knowledge sidecar recreated with its original image against replacement app ID.\n\nRollback: sudo python3 '+str(PACKET/'chat_scene_release.py')+' rollback. Restores both '+OLD_APP+' and '+OLD_KNOWLEDGE+'; keep all current database activity. Never restore the historical dump over new records.\n')
    print(json.dumps({'finished':True,'frontend':FRONTEND,'imageId':report['imageId'],'schema':report['schema']}),flush=True)

if __name__=='__main__':
    if sys.argv[1]=='rollback':
        before=(RELEASE/'Caddyfile.before').read_text();marker='reverse_proxy mapflow-app:8080 {'
        restore(before,before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker))
    else:{'prepare':prepare,'cutover':cutover,'finish':finish}[sys.argv[1]]()
