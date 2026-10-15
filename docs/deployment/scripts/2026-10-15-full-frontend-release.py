"""Publish the reviewed frontend over the unchanged production runtime and database."""
from pathlib import Path, PurePosixPath
import hashlib,importlib.util,json,os,re,secrets,shutil,subprocess,sys,tarfile,time,urllib.parse,urllib.request,uuid

ROOT=Path('/opt/mapflow-laptop-migration-20261006')
PACKET=Path('/home/rong/.local/state/mapflow/full-frontend-20261015')
RELEASE=ROOT/'releases/20261015-full-frontend'
FRONTEND='075cc2be16a5b0f3310a85a68721bde7e7afbc56'
BACKEND='99e550374d41d1e210dd637062b3955cbba98404'
PREVIOUS='sha256:94b4c65d59f293c3eeec6cb5ef67b4013add6ebe4c9c3897da22e7a6d22536f9'
BASE='mapflow-server:full-frontend-baseline-20261015-94b4c65'
IMAGE='mapflow-server:full-frontend-main-20261015-075cc2b'
APP='mapflow-laptop-app'
OLD_APP='mapflow-laptop-app-before-full-frontend-20261015'
PROD_DB='mapflow-laptop-postgres'
NETWORK='mapflow-laptop-migration'
CLONE_APP='mapflow-full-frontend-check-app-20261015'
CLONE_DB='mapflow-full-frontend-check-postgres-20261015'
CLONE_NETWORK='mapflow-full-frontend-check-20261015'
DOCKER=['docker','-H','unix:///var/run/docker.sock']
helpers=None
factory=None

def verify_web_manifest(root,expected):
    assert root.is_dir() and expected and 'index.html' in expected,'Incomplete frontend bundle'
    for name in expected:
        path=PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts and '\\' not in name,'Invalid frontend path'
    actual={}
    for path in root.rglob('*'):
        assert not path.is_symlink(),'Unexpected link in frontend'
        if path.is_file():actual[path.relative_to(root).as_posix()]=hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual==expected,'Frontend differs from reviewed bundle'
    return len(actual)

def assert_business_unchanged(before,after):
    assert before.keys()==after.keys(),'Database table set changed'
    changed=[name for name in before if name!='request_observations' and before[name]!=after[name]]
    assert not changed,'Business records changed: '+','.join(changed)

def assert_runtime_layers(before,after):
    assert before and after[:len(before)]==before,'Production runtime layers changed'

def assert_executions_quiescent(executions):
    for execution in executions:
        assert (execution['state']=='awaiting_reconciliation' and execution['owner_id'] is None
                and execution['lease_expires_at'] is None and execution['reason']=='external_outcome_unknown'
                and execution['unknown_calls']>0 and execution['dispatched_calls']==0),'Active or recoverable Agent execution; defer cutover'

def run(arguments,payload=None,*,input_bytes=None,output=None):
    completed=subprocess.run(arguments,input=payload if payload is not None else input_bytes,stdout=output or subprocess.PIPE,stderr=subprocess.PIPE)
    if completed.returncode:
        diagnostic=RELEASE/('operation-failure-'+str(time.time_ns())+'.private.log')
        diagnostic.write_bytes((completed.stdout or b'')+b'\n'+completed.stderr);diagnostic.chmod(0o600)
        raise RuntimeError('Operation failed; private diagnostic: '+diagnostic.name)
    return completed.stdout

def load_helpers():
    global helpers,factory
    source=ROOT/'releases/20261013-chat-ui-and-deletion/chat_ui_release.py'
    spec=importlib.util.spec_from_file_location('verified_chat_release',source)
    helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
    factory=helpers.prior
    helpers.RELEASE,helpers.PACKET,helpers.CLONE_APP=RELEASE,PACKET,CLONE_APP
    helpers.run=run
    factory.RELEASE,factory.IMAGE,factory.APP,factory.OLD_APP,factory.NETWORK=RELEASE,IMAGE,APP,OLD_APP,NETWORK
    factory.run,factory.original=run,original
    factory.base.release,factory.base.image=RELEASE,IMAGE
    factory.base.run=run

def inspect(name):return json.loads(run(DOCKER+['inspect',name]))[0]
def exists(name):return subprocess.run(DOCKER+['inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
def save(name,value):factory.private_json(RELEASE/name,value)
def original():return json.loads((RELEASE/'original-container.json').read_text())
def sql(container,query):return helpers.sql(container,query)
def migration(container):return int(sql(container,'SELECT max(version) FROM _sqlx_migrations WHERE success'))
def api(container,method,path,body=None,cookie=None,csrf=None):return helpers.api(container,method,path,body,cookie,csrf)

def pending_executions(container):
    return json.loads(sql(container,"""SELECT coalesce(json_agg(row_to_json(r)),'[]') FROM (
        SELECT execution_id,state,owner_id,lease_expires_at,last_failure->'detail'->>'code' AS reason,
        (SELECT count(*) FROM agent_model_calls c WHERE c.execution_id=e.execution_id AND c.status='outcome_unknown') AS unknown_calls,
        (SELECT count(*) FROM agent_model_calls c WHERE c.execution_id=e.execution_id AND c.status='dispatched') AS dispatched_calls
        FROM agent_executions e WHERE state NOT IN ('succeeded','stopped','failed') ORDER BY execution_id) r"""))

def fingerprints(container):
    tables=sql(container,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").splitlines()
    snapshot={}
    for table in tables:
        assert re.fullmatch('[a-z_][a-z0-9_]*',table)
        snapshot[table]=json.loads(sql(container,f"""SELECT json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' ORDER BY md5(to_jsonb(r)::text)),''))) FROM public."{table}" r"""))
    return snapshot

def backup(name):
    _,user,database=factory.base.database_info()
    path=RELEASE/name
    with path.open('wb') as stream:run(DOCKER+['exec',PROD_DB,'pg_dump','-U',user,'-d',database,'-Fc'],output=stream)
    path.chmod(0o600)
    return path.stat().st_size

def artifacts(container):
    manifest=json.loads((RELEASE/'provenance.json').read_text())
    expected={**manifest['runtimeFiles'],**{'/srv/mapflow/'+name:digest for name,digest in manifest['webFiles'].items()}}
    actual={line.split(maxsplit=1)[1].strip():line.split()[0] for line in run(DOCKER+['exec',container,'sha256sum',*sorted(expected)]).decode().splitlines()}
    assert actual==expected,'Container artifacts differ'
    current=inspect(container)
    assert current['Image']==manifest['imageId']
    assert current['Config']['Labels']['com.mapflow.frontend.revision']==FRONTEND
    assert current['Config']['Labels']['org.opencontainers.image.revision']==BACKEND
    return {'frontendFiles':len(manifest['webFiles']),'unchangedRuntimeFiles':len(manifest['runtimeFiles'])}

def access(container):
    expected=(PACKET/'context/web-dist/index.html').read_bytes();routes={}
    for path in ['/','/?marketing=1','/login','/register','/console','/assistant','/library','/maps','/learning','/tavern','/wallet','/models','/settings','/admin']:
        status,body,_=api(container,'GET',path);assert status==200 and body==expected,path;routes[path]=status
    protected={}
    for path in ['/api/auth/session','/api/wallet','/api/admin/dashboard','/api/admin/agent-models','/api/me/agent-models','/api/me/tavern/conversations?scene=management','/api/me/learning-areas']:
        status,_,_=api(container,'GET',path);assert status==401,path;protected[path]=status
    assert api(container,'GET','/api/trees/public')[0]==200
    assert api(container,'GET','/api/model-catalog/byok')[0]==200
    return {'routes':routes,'anonymousProtected':protected,**artifacts(container)}

def prepare():
    assert not RELEASE.exists() and not exists(OLD_APP),'Release already prepared'
    assert inspect(APP)['Image']==PREVIOUS and inspect(APP)['State']['Running']
    RELEASE.mkdir(mode=0o700);save('original-container.json',inspect(APP))
    source=json.loads((PACKET/'source.json').read_text());assert source['frontend']==source['main']==FRONTEND
    archive=PACKET/'frontend.tar.gz';assert hashlib.sha256(archive.read_bytes()).hexdigest()==source['archiveSha256']
    context=PACKET/'context';context.mkdir(mode=0o700)
    with tarfile.open(archive) as package:package.extractall(context,filter='data')
    expected=json.loads((PACKET/'frontend-files.json').read_text());verify_web_manifest(context/'web-dist',expected)
    runtime_source=json.loads((ROOT/'releases/20261013-chat-ui-and-deletion/provenance.json').read_text())
    assert runtime_source['imageId']==PREVIOUS
    runtime={name:digest for name,digest in runtime_source['files'].items() if not name.startswith('/srv/mapflow/')}
    run(DOCKER+['tag',PREVIOUS,BASE]);assert inspect(BASE)['Id']==PREVIOUS
    (context/'Dockerfile').write_text('FROM '+BASE+'\nLABEL com.mapflow.frontend.revision="'+FRONTEND+'" dev.mapflow.frontend.revision="'+FRONTEND+'" com.mapflow.source.branch="main"\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\n')
    run(DOCKER+['build','--network=none','-t',IMAGE,str(context)])
    assert_runtime_layers(inspect(PREVIOUS)['RootFS']['Layers'],inspect(IMAGE)['RootFS']['Layers'])
    save('provenance.json',{'frontend':FRONTEND,'backend':BACKEND,'baseImage':PREVIOUS,'image':IMAGE,'imageId':inspect(IMAGE)['Id'],'webFiles':expected,'runtimeFiles':runtime,'source':source})
    shutil.copy2(Path(__file__),RELEASE/'full_frontend_release.py')
    assert migration(PROD_DB)==54
    size=backup('canary-source.dump')
    save('prepared.json',{'imageId':inspect(IMAGE)['Id'],'migration':54,'backupBytes':size})
    print(json.dumps({'prepared':True,'imageId':inspect(IMAGE)['Id'],'reviewedFrontendFiles':len(expected),'unchangedRuntimeFiles':len(runtime),'backupBytes':size}),flush=True)

def canary():
    assert (RELEASE/'prepared.json').exists() and inspect(APP)['Id']==original()['Id']
    assert not exists(CLONE_APP) and not exists(CLONE_DB) and not exists(CLONE_NETWORK)
    run(DOCKER+['network','create','--internal','--label','org.mapflow.release=full-frontend-20261015',CLONE_NETWORK])
    uri,user,database=factory.base.database_info();password=secrets.token_urlsafe(30)
    factory.base.private_write(RELEASE/'stage-db.env','POSTGRES_USER='+user+'\nPOSTGRES_DB='+database+'\nPOSTGRES_PASSWORD='+password+'\n')
    run(DOCKER+['run','-d','--name',CLONE_DB,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-db.env'),'--memory','768m','--tmpfs','/var/lib/postgresql/data:rw,size=768m',inspect(PROD_DB)['Image']])
    for attempt in range(80):
        ready=subprocess.run(DOCKER+['exec',CLONE_DB,'pg_isready','-U',user,'-d',database],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        initialized=subprocess.run(DOCKER+['exec',CLONE_DB,'sh','-c','test "$(cat /proc/1/comm)" = postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        if ready and initialized:break
        time.sleep(.3)
    else:raise RuntimeError('Clone database unavailable')
    run(DOCKER+['exec','-i',CLONE_DB,'pg_restore','--no-owner','--no-acl','--exit-on-error','-U',user,'-d',database],(RELEASE/'canary-source.dump').read_bytes())
    assert migration(CLONE_DB)==54
    destination=uri._replace(netloc=urllib.parse.quote(user,safe='')+':'+urllib.parse.quote(password,safe='')+'@'+CLONE_DB+':5432',query='')
    factory.base.private_write(RELEASE/'stage-database.url',urllib.parse.urlunsplit(destination),10001)
    factory.base.private_write(RELEASE/'stage-app.env','\n'.join(original()['Config']['Env'])+'\n')
    command=DOCKER+['run','-d','--name',CLONE_APP,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-app.env'),'-e','MAPFLOW_IDENTITY_TRUSTED_PROXY_IP=127.0.0.1','--read-only','--memory','1073741824','--cpus','2','--cap-drop','ALL','--security-opt','no-new-privileges:true']
    for index,mount in enumerate(original()['Mounts']):
        assert mount['Type']=='bind';source=mount['Source'];readonly=not mount['RW']
        if mount['Destination']=='/run/secrets/database.url':source=str(RELEASE/'stage-database.url')
        elif mount['RW']:
            target=RELEASE/('clone-mount-'+str(index));assert not Path(source).is_symlink()
            if mount['Destination']=='/var/lib/mapflow/diagnostics':target.mkdir(mode=0o700)
            elif Path(source).is_dir():
                assert not any(item.is_symlink() for item in Path(source).rglob('*'));shutil.copytree(source,target)
            else:shutil.copy2(source,target)
            os.chown(target,10001,10001)
            if target.is_dir():
                for item in target.rglob('*'):os.chown(item,10001,10001)
            source=str(target)
        command+=['--mount','type=bind,src='+source+',dst='+mount['Destination']+(',readonly' if readonly else '')]
    for target,options in original()['HostConfig'].get('Tmpfs',{}).items():command+=['--tmpfs',target+':'+options]
    run(command+[IMAGE]);helpers.ready(CLONE_APP);assert inspect(CLONE_NETWORK)['Internal']
    check_canary()

def check_management_lifecycle(container,cookie,csrf):
    status,history,_=api(container,'GET','/api/me/tavern/conversations?scene=management',cookie=cookie)
    assert status==200 and history['bootstrapState']=='never_created'
    request={'clientRequestId':str(uuid.uuid4()),'userName':'发布验收','newConversation':True}
    status,detail,_=api(container,'POST','/api/me/tavern/management-conversations',request,cookie,csrf);assert status in [200,201]
    identity=detail['conversation']['conversationId']
    status,history,_=api(container,'GET','/api/me/tavern/conversations?scene=management',cookie=cookie);assert status==200 and history['bootstrapState']=='has_active'
    assert api(container,'DELETE','/api/me/tavern/conversations/'+identity,cookie=cookie,csrf=csrf)[0]==204
    status,history,_=api(container,'GET','/api/me/tavern/conversations?scene=management',cookie=cookie);assert status==200 and history['bootstrapState']=='cleared' and not history['conversations']
    assert api(container,'POST','/api/me/tavern/management-conversations',request,cookie,csrf)[0]==410
    request['clientRequestId']=str(uuid.uuid4());assert api(container,'POST','/api/me/tavern/management-conversations',request,cookie,csrf)[0] in [200,201]

def check_canary():
    assert (RELEASE/'prepared.json').exists() and inspect(APP)['Id']==original()['Id']
    assert inspect(CLONE_NETWORK)['Internal']
    clone=inspect(CLONE_APP)
    assert clone['State']['Running'] and set(clone['NetworkSettings']['Networks'])=={CLONE_NETWORK}
    assert not clone['HostConfig'].get('PortBindings')
    helpers.ready(CLONE_APP);report=access(CLONE_APP)
    executions=int(sql(CLONE_DB,'SELECT count(*) FROM agent_executions'))
    cookie,csrf=helpers.register('UIReview')
    check_management_lifecycle(CLONE_APP,cookie,csrf)
    assert int(sql(CLONE_DB,'SELECT count(*) FROM agent_executions'))==executions
    save('canary-passed.json',{'passed':True,'noExternalNetwork':True,'migration':54,'newModelExecutions':0,'creationDeletionReplayCleared':True,**report})
    print(json.dumps({'canaryPassed':True,'newModelExecutions':0,'migration':54,**report}),flush=True)

def rollback(before,maintenance):
    if exists(OLD_APP):
        if exists(APP):
            run(DOCKER+['stop',APP])
            if NETWORK in inspect(APP)['NetworkSettings']['Networks']:run(DOCKER+['network','disconnect',NETWORK,APP])
            run(DOCKER+['rename',APP,'mapflow-laptop-app-failed-full-frontend-'+str(time.time_ns())])
        run(DOCKER+['rename',OLD_APP,APP])
    if NETWORK not in inspect(APP)['NetworkSettings']['Networks']:
        endpoint=original()['NetworkSettings']['Networks'][NETWORK];command=DOCKER+['network','connect','--ip',endpoint['IPAddress']]
        for alias in endpoint.get('Aliases') or []:
            if len(alias)!=64:command+=['--alias',alias]
        run(command+[NETWORK,APP])
    run(DOCKER+['start',APP]);helpers.ready(APP)
    proxy=ROOT/'runtime/Caddyfile';assert proxy.read_text() in [before,maintenance];proxy.write_text(before);factory.base.caddy_reload()
    save('rollback-passed.json',{'originalApplicationRestored':True,'databaseRestoredFromBackup':False})

def public_checks():
    expected=(PACKET/'context/web-dist/index.html').read_bytes();routes={}
    for path in ['/','/login','/register','/console','/assistant','/library','/maps','/learning','/tavern','/wallet','/models','/settings','/admin','/health/ready']:
        request=urllib.request.Request('https://xxian.fun'+path,headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(request,timeout=25) as response:
            assert response.status==200
            if path!='/health/ready':assert response.read()==expected,'Public frontend version differs'
        routes[path]=200
    return routes

def cutover():
    assert json.loads((RELEASE/'canary-passed.json').read_text())['passed']
    assert inspect(APP)['Id']==original()['Id'] and inspect(APP)['Image']==PREVIOUS and not exists(OLD_APP)
    pending=pending_executions(PROD_DB);assert_executions_quiescent(pending)
    assert helpers.legacy_locks(PROD_DB)==0,'Active legacy generation; defer cutover'
    proxy=ROOT/'runtime/Caddyfile';before=proxy.read_text();marker='reverse_proxy mapflow-app:8080 {';assert before.count(marker)==1
    maintenance=before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker);factory.base.private_write(RELEASE/'Caddyfile.before',before)
    try:
        proxy.write_text(maintenance);factory.base.caddy_reload();run(DOCKER+['stop','--time','30',APP])
        current_pending=pending_executions(PROD_DB);assert_executions_quiescent(current_pending)
        assert current_pending==pending,'Execution activity changed during drain; defer cutover'
        size=backup('before-cutover.dump');baseline=fingerprints(PROD_DB);observations=helpers.observation_rows(PROD_DB)
        ordered=json.loads(sql(PROD_DB,"SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        ages=helpers.observation_age_metadata(PROD_DB)
        save('production-data.before.json',baseline);save('production-observations.before.json',observations)
        save('production-observation-order.private.json',ordered);save('production-observation-ages.private.json',ages)
        assert migration(PROD_DB)==54
        run(DOCKER+['network','disconnect',NETWORK,APP]);run(DOCKER+['rename',APP,OLD_APP])
        factory.create_production();helpers.ready(APP);report=access(APP);assert factory.retained_config()
        current=fingerprints(PROD_DB);assert_business_unchanged(baseline,current);assert migration(PROD_DB)==54
        save('production-data.after.json',current)
        retention=helpers.verify_observation_retention(observations,helpers.observation_rows(PROD_DB),ordered,expired=helpers.expired_observations(ages,time.time()))
        assert proxy.read_text()==maintenance;proxy.write_text(before);factory.base.caddy_reload()
        public=public_checks()
        save('production-passed.json',{'frontend':FRONTEND,'backend':BACKEND,'image':IMAGE,'imageId':inspect(APP)['Image'],'migration':54,'backupBytes':size,'originalTablesPreserved':len(baseline),'pendingReconciliationPreserved':len(pending),'observationRetention':retention,'runtimeConfigurationPreserved':True,'publicRoutes':public,**report})
    except Exception:
        rollback(before,maintenance);raise
    print(json.dumps({'cutoverPassed':True,'imageId':inspect(APP)['Image'],'originalTablesPreserved':len(baseline),'observationRetention':retention,'publicRoutes':public,**report}),flush=True)

def finish():
    report=json.loads((RELEASE/'production-passed.json').read_text());assert factory.retained_config();artifacts(APP);public_checks()
    notice='> 全站新前端已发布（2026-10-15）：前端 main '+FRONTEND+'；后端保持 '+BACKEND+'；镜像 '+IMAGE+'，ID '+report['imageId']+'。数据库仍为 0054；发布材料和应用回退见 releases/20261015-full-frontend/。回退保留当前数据库及新增用户活动。\n\n'
    operations=ROOT/'OPERATIONS.md'
    if not operations.read_text().startswith(notice):operations.write_text(notice+operations.read_text())
    (RELEASE/'DEPLOYMENT.md').write_text('# Full frontend release — 2026-10-15\n\nFrontend main '+FRONTEND+'. Unchanged backend '+BACKEND+'. Image '+report['imageId']+'. Reviewed candidate files match all deployed frontend hashes. Backend binaries and worker files match the preceding production image. No database migration or candidate-account import. Original business rows and migrations preserved; existing observation retention verified. Runtime, network, secrets and payment mounts retained.\n\nRollback only the application using '+OLD_APP+' and original-container.json network/runtime configuration. Preserve the current database and any later activity; never restore the historical dump over newer records.\n')
    run(DOCKER+['stop',CLONE_APP,CLONE_DB])
    print(json.dumps({'deploymentFinished':True,'frontend':FRONTEND,'backend':BACKEND,'imageId':report['imageId'],'originalTablesPreserved':report['originalTablesPreserved']}),flush=True)

if __name__=='__main__':
    load_helpers()
    {'prepare':prepare,'canary':canary,'check-canary':check_canary,'cutover':cutover,'finish':finish}[sys.argv[1]]()
