"""Pinned main release. Never restore a historical database during application rollback."""
from pathlib import Path
import base64, hashlib, importlib.util, json, os, re, secrets, shutil, subprocess, sys, tarfile, time, urllib.error, urllib.parse, urllib.request, uuid

ROOT = Path('/opt/mapflow-laptop-migration-20261006')
PACKET = Path('/home/rong/.local/state/mapflow/chat-ui-main-release-20261013')
RELEASE = ROOT/'releases/20261013-chat-ui-and-deletion'
FRONTEND = '6e417752d8bf69d1432282843f9d25b0f9fe059f'
BACKEND = '99e550374d41d1e210dd637062b3955cbba98404'
PREVIOUS = 'sha256:e428ecaaff94c1de4b09504aecadefe2e15a9403e07356a72cad3c6439e685c2'
BASE = 'mapflow-server:chat-ui-baseline-20261013'
IMAGE = 'mapflow-server:chat-ui-main-20261013-99e5503'
COMPATIBLE = 'mapflow-server:chat-deletion-compatible-rollback-20261013'
APP = 'mapflow-laptop-app'
OLD_APP = 'mapflow-laptop-app-before-chat-ui-deletion-20261013'
PROD_DB = 'mapflow-laptop-postgres'
NETWORK = 'mapflow-laptop-migration'
CLONE_APP = 'mapflow-chat-ui-release-check-app-20261013'
CLONE_DB = 'mapflow-chat-ui-release-check-postgres-20261013'
CLONE_NETWORK = 'mapflow-chat-ui-release-check-20261013'
DOCKER = ['docker','-H','unix:///var/run/docker.sock']
spec = importlib.util.spec_from_file_location('existing_release',ROOT/'releases/20261013-mobile-chat-ui/mobile-ui-release.py')
previous = importlib.util.module_from_spec(spec); spec.loader.exec_module(previous)
prior = previous.prior
prior.RELEASE, prior.IMAGE, prior.OLD_APP = RELEASE, IMAGE, OLD_APP
prior.base.release, prior.base.image = RELEASE, IMAGE

def run(arguments, payload=None):
    completed_command = subprocess.run(arguments,input=payload,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if completed_command.returncode:
        log = RELEASE/('operation-failure-'+str(time.time_ns())+'.private.log')
        log.write_bytes(completed_command.stdout+b'\n'+completed_command.stderr); log.chmod(0o600)
        raise RuntimeError('Operation failed; private diagnostic: '+log.name)
    return completed_command.stdout
prior.run = run

def inspect(name): return json.loads(run(DOCKER+['inspect',name]))[0]
def exists(name): return subprocess.run(DOCKER+['inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
def save(name,value): prior.private_json(RELEASE/name,value)
def original(): return json.loads((RELEASE/'original-container.json').read_text())
prior.original = original
def sql(container,query): return prior.sql(container,query)
def migration(container): return int(sql(container,'SELECT max(version) FROM _sqlx_migrations WHERE success'))
def version_rows(container): return json.loads(sql(container,"SELECT coalesce(json_object_agg(version::text,md5(to_jsonb(r)::text)),'{}') FROM _sqlx_migrations r"))
def observation_rows(container): return json.loads(sql(container,"SELECT coalesce(json_object_agg(request_id::text,md5(to_jsonb(r)::text)),'{}') FROM request_observations r"))

def legacy_locks(container):
    query="WITH keys AS (SELECT hashtextextended('tavern:'||account_id::text||':'||conversation_id::text,0) AS k FROM tavern_conversations) SELECT count(*) FROM pg_locks l JOIN keys ON l.classid=((k>>32)&4294967295)::oid AND l.objid=(k&4294967295)::oid AND l.objsubid=1 WHERE l.locktype='advisory' AND l.granted AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database())"
    return int(sql(container,query))

def verify_observation_retention(before,current,ordered,cap=20000,expired=None):
    assert cap>0 and len(ordered)==len(before) and set(ordered)==set(before)
    assert all(current[key]==digest for key,digest in before.items() if key in current),'A retained original request log changed'
    missing=set(before)-set(current);new=set(current)-set(before)
    expired=set(expired or []);assert expired<=set(before)
    aged=missing&expired;capped=missing-expired;fresh_order=[key for key in ordered if key not in expired]
    assert capped==set(fresh_order[:len(capped)]),'Removal differs from original retention order'
    assert len(capped)<=max(0,len(before)-len(aged)+len(new)-cap),'Removal exceeds original retention cap pressure'
    return {'retainedOriginalRows':len(before)-len(missing),'policyRemovedRows':len(missing),'ageRemovedRows':len(aged),'capRemovedRows':len(capped),'newRows':len(new),'originalPolicyCap':cap,'originalAgePolicyDays':{'succeeded':7,'other':30}}

def observation_age_metadata(container):
    return json.loads(sql(container,"SELECT coalesce(json_object_agg(request_id::text,json_build_object('completedEpoch',extract(epoch FROM completed_at),'retentionDays',CASE WHEN outcome='succeeded' THEN 7 ELSE 30 END)),'{}'::json) FROM request_observations"))

def expired_observations(metadata,epoch):
    return {key for key,row in metadata.items() if row['completedEpoch'] is not None and row['completedEpoch']<epoch-row['retentionDays']*86400}

def fingerprints(container):
    tables = sql(container,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_sqlx_migrations' ORDER BY table_name").splitlines()
    snapshot = {}
    for table in tables:
        assert re.fullmatch('[a-z_][a-z0-9_]*',table)
        row = "(to_jsonb(r)-'deleted_at')" if table == 'tavern_conversations' else 'to_jsonb(r)'
        snapshot[table] = json.loads(sql(container,f'''SELECT json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5({row}::text),'' ORDER BY md5({row}::text)),''))) FROM public."{table}" r'''))
    return snapshot

def unchanged(before,after,allow_observations=False):
    assert before.keys()==after.keys(),'Original table set changed'
    changed = [name for name in before if before[name]!=after[name] and not (allow_observations and name=='request_observations')]
    assert not changed,'Original fields or rows changed: '+','.join(changed)

def preserve_migration(container,before):
    assert migration(container)==54
    after = version_rows(container)
    assert all(after.get(key)==value for key,value in before.items()),'An original migration record changed'
    assert set(after)==set(before)|{'54'}
    assert int(sql(container,'SELECT count(*) FROM tavern_conversations WHERE deleted_at IS NOT NULL'))==0
    expected = json.loads((PACKET/'backend-source-verified.json').read_text())['migration54Sha384']
    assert sql(container,"SELECT encode(checksum,'hex') FROM _sqlx_migrations WHERE version=54 AND success")==expected

def migrate(container,secret,network):
    run(DOCKER+['run','--rm','--network',network,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--entrypoint','/usr/local/bin/mapflow-admin','-e','MAPFLOW_DATABASE_URL_FILE=/run/secrets/database.url','--mount','type=bind,src='+str(secret)+',dst=/run/secrets/database.url,readonly',IMAGE,'database','migrate'])

def backup(name):
    _,user,database = prior.base.database_info()
    payload = run(DOCKER+['exec',PROD_DB,'pg_dump','-U',user,'-d',database,'-Fc'])
    file = RELEASE/name; file.write_bytes(payload); file.chmod(0o600)
    print(json.dumps({'backup':name,'bytes':len(payload)}),flush=True)

def api(container,method,path,body=None,cookie=None,csrf=None):
    script = "const http=require('http');let inputText='';process.stdin.on('data',chunk=>inputText+=chunk);process.stdin.on('end',()=>{const p=JSON.parse(inputText);const body=p.body==null?null:JSON.stringify(p.body);const headers={Host:'xxian.fun',Origin:'https://xxian.fun','Cache-Control':'no-cache','X-MapFlow-Proxy':'caddy','X-Real-IP':'198.51.100.73'};if(p.cookie)headers.Cookie=p.cookie;if(p.csrf)headers['X-CSRF-Token']=p.csrf;if(body!=null){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(body)}const req=http.request({hostname:'127.0.0.1',port:8080,path:p.path,method:p.method,headers},res=>{let chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>process.stdout.write(JSON.stringify({status:res.statusCode,body:Buffer.concat(chunks).toString('base64'),cookie:(res.headers['set-cookie']||[])[0]||null})));});req.on('error',e=>process.stdout.write(JSON.stringify({status:0,body:'',error:e.code})));req.setTimeout(10000,()=>req.destroy());if(body!=null)req.write(body);req.end();});"
    response = json.loads(run(DOCKER+['exec','-i',container,'node','-e',script],json.dumps({'method':method,'path':path,'body':body,'cookie':cookie,'csrf':csrf}).encode()))
    raw = base64.b64decode(response['body'])
    try: parsed=json.loads(raw)
    except ValueError: parsed=raw
    return response['status'],parsed,response.get('cookie')

def ready(container):
    for attempt in range(80):
        if not inspect(container)['State']['Running']: raise RuntimeError('Candidate stopped; inspect its private startup diagnostics')
        if api(container,'GET','/health/ready')[0]==200: return
        time.sleep(.4)
    raise RuntimeError('Readiness did not become healthy')

def artifacts(container,compatible=False):
    manifest=json.loads((RELEASE/'provenance.json').read_text())
    expected=manifest['rollbackFiles'] if compatible else manifest['files']
    actual={line.split(maxsplit=1)[1].strip():line.split()[0] for line in run(DOCKER+['exec',container,'sha256sum',*sorted(expected)]).decode().splitlines()}
    assert actual==expected,'Packaged artifact differs'
    current=inspect(container)
    assert current['Image']==manifest['rollbackImageId' if compatible else 'imageId']
    assert current['Config']['Labels']['org.opencontainers.image.revision']==BACKEND
    if not compatible: assert current['Config']['Labels']['com.mapflow.frontend.revision']==FRONTEND
    return {'verifiedFiles':len(expected),'unchangedWorkerFiles':len(manifest['workerFiles'])}

def access(container):
    routes={}
    expected=(PACKET/'context/web-dist/index.html').read_bytes()
    for path in ['/assistant','/library','/maps','/learning','/tavern']:
        status,body,_=api(container,'GET',path); assert status==200 and body==expected,path; routes[path]=status
    protected={}
    for path in ['/api/wallet','/api/admin/model-balance','/api/admin/agent-models','/api/admin/agent-settlements','/api/me/agent-models','/api/me/tavern/conversations','/api/me/learning-areas','/api/me/agent-executions/'+str(uuid.uuid4())]:
        status,_,_=api(container,'GET',path);assert status==401,path;protected[path]=status
    assert api(container,'DELETE','/api/me/tavern/conversations/'+str(uuid.uuid4()))[0]==401
    assert api(container,'GET','/api/wallet/payments/vmq/notify?payId=forged')[0]==400
    status,models,_=api(container,'GET','/api/model-catalog/byok')
    assert status==200 and len(models)==len({model['id'] for model in models})==51
    assert api(container,'GET','/api/trees/public')[0]==200
    return {'routes':routes,'anonymousProtected':protected,'anonymousDeletion':401,'forgedPaymentRejected':400,'catalogModels':len(models),**artifacts(container)}

def prepare(resume=False):
    assert inspect(APP)['Image']==PREVIOUS
    if resume:
        assert RELEASE.exists() and not (RELEASE/'prepared.json').exists()
        assert inspect(APP)['Id']==original()['Id']
    else:
        assert not RELEASE.exists()
    assert not exists(OLD_APP) and not exists(CLONE_APP) and not exists(CLONE_DB) and not exists(CLONE_NETWORK)
    if not resume:
        RELEASE.mkdir(mode=0o700);save('original-container.json',inspect(APP))
    source=json.loads((PACKET/'backend-source-verified.json').read_text());assert source['commit']==BACKEND and source['allSourceContentEqual']
    context=PACKET/'context';context.mkdir(mode=0o700,exist_ok=resume)
    with tarfile.open(PACKET/'frontend-main-build.tar.gz') as archive: archive.extractall(context,filter='data')
    for binary in ['mapflow-server','mapflow-admin']:
        shutil.copy2(Path('/home/rong/.cache/mapflow-payment-release/debug')/binary,context/binary)
        assert hashlib.sha256((context/binary).read_bytes()).hexdigest()==source[binary]
    web=json.loads((PACKET/'frontend-main-files.json').read_text())
    assert {p.relative_to(context/'web-dist').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (context/'web-dist').rglob('*') if p.is_file()}==web
    prior_manifest=json.loads((ROOT/'releases/20261013-global-assistant/candidate-provenance.json').read_text())
    worker={('/opt/mapflow/harness-worker/dist/'+name.removeprefix('worker-dist/')):value for name,value in prior_manifest['packagedFiles'].items() if name.startswith('worker-dist/')}
    binaries={'/usr/local/bin/'+name:source[name] for name in ['mapflow-server','mapflow-admin']}
    old_index=json.loads((ROOT/'releases/20261013-mobile-chat-ui/mobile-provenance.json').read_text())['webFiles']
    run(DOCKER+['tag',PREVIOUS,BASE]);assert inspect(BASE)['Id']==PREVIOUS
    common='FROM '+BASE+'\nLABEL org.opencontainers.image.revision="'+BACKEND+'" com.mapflow.source.branch="main"\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\n'
    (context/'Dockerfile.rollback').write_text(common)
    run(DOCKER+['build','--network=none','-f',str(context/'Dockerfile.rollback'),'-t',COMPATIBLE,str(context)])
    (context/'Dockerfile').write_text(common+'LABEL com.mapflow.frontend.revision="'+FRONTEND+'" dev.mapflow.frontend.revision="'+FRONTEND+'"\nCOPY --chown=10001:10001 web-dist/ /srv/mapflow/\n')
    run(DOCKER+['build','--network=none','-t',IMAGE,str(context)])
    manifest={'frontend':{'commit':FRONTEND,'branch':'main'},'backend':source,'baseImage':PREVIOUS,'image':IMAGE,'imageId':inspect(IMAGE)['Id'],'rollbackImage':COMPATIBLE,'rollbackImageId':inspect(COMPATIBLE)['Id'],'workerFiles':worker,'files':{**worker,**binaries,**{'/srv/mapflow/'+name:digest for name,digest in web.items()}},'rollbackFiles':{**worker,**binaries,**{'/srv/mapflow/'+name:digest for name,digest in old_index.items()}}}
    save('provenance.json',manifest);shutil.copy2(Path(__file__),RELEASE/'chat_ui_release.py')
    backup('canary-source.dump');assert migration(PROD_DB)==53
    save('prepared.json',{'imageId':manifest['imageId'],'rollbackImageId':manifest['rollbackImageId'],'backupBytes':(RELEASE/'canary-source.dump').stat().st_size})
    print(json.dumps({'prepared':True,'imageId':manifest['imageId'],'compatibleRollbackImageId':manifest['rollbackImageId']}),flush=True)

def canary():
    assert (RELEASE/'prepared.json').exists() and inspect(APP)['Id']==original()['Id']
    run(DOCKER+['network','create','--internal','--label','org.mapflow.release=chat-ui-and-deletion-20261013',CLONE_NETWORK])
    uri,user,database=prior.base.database_info();password=secrets.token_urlsafe(30)
    prior.base.private_write(RELEASE/'stage-db.env','POSTGRES_USER='+user+'\nPOSTGRES_DB='+database+'\nPOSTGRES_PASSWORD='+password+'\n')
    run(DOCKER+['run','-d','--name',CLONE_DB,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-db.env'),'--memory','768m','--tmpfs','/var/lib/postgresql/data:rw,size=768m','pgvector/pgvector:pg16'])
    for attempt in range(80):
        ready_db=subprocess.run(DOCKER+['exec',CLONE_DB,'pg_isready','-U',user,'-d',database],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        initialized=subprocess.run(DOCKER+['exec',CLONE_DB,'sh','-c','test "$(cat /proc/1/comm)" = postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        if ready_db and initialized:break
        time.sleep(.3)
    else:raise RuntimeError('Clone database unavailable')
    run(DOCKER+['exec','-i',CLONE_DB,'pg_restore','--no-owner','--no-acl','--exit-on-error','-U',user,'-d',database],(RELEASE/'canary-source.dump').read_bytes())
    before=fingerprints(CLONE_DB);versions=version_rows(CLONE_DB);save('canary-data.before.json',before)
    destination=uri._replace(netloc=urllib.parse.quote(user,safe='')+':'+urllib.parse.quote(password,safe='')+'@'+CLONE_DB+':5432',query='')
    prior.base.private_write(RELEASE/'stage-database.url',urllib.parse.urlunsplit(destination),10001)
    migrate(CLONE_DB,RELEASE/'stage-database.url',CLONE_NETWORK);migrate(CLONE_DB,RELEASE/'stage-database.url',CLONE_NETWORK)
    unchanged(before,fingerprints(CLONE_DB));preserve_migration(CLONE_DB,versions)
    save('canary-migration-passed.json',{'migration':54,'migrationRepeated':True,'originalTablesPreserved':len(before),'existingMigrationsPreserved':len(versions),'existingDeletedAtNull':True})
    prior.base.private_write(RELEASE/'stage-app.env','\n'.join(original()['Config']['Env'])+'\n')
    command=DOCKER+['run','-d','--name',CLONE_APP,'--network',CLONE_NETWORK,'--env-file',str(RELEASE/'stage-app.env'),'--read-only','--memory','1073741824','--cpus','2','--cap-drop','ALL','--security-opt','no-new-privileges:true']
    for index,mount in enumerate(original()['Mounts']):
        assert mount['Type']=='bind';source=mount['Source'];readonly=not mount['RW']
        if mount['Destination']=='/run/secrets/database.url':source=str(RELEASE/'stage-database.url')
        elif mount['RW']:
            local=RELEASE/('clone-mount-'+str(index));assert not Path(source).is_symlink()
            if mount['Destination']=='/var/lib/mapflow/diagnostics':local.mkdir(mode=0o700)
            elif Path(source).is_dir():
                assert not any(item.is_symlink() for item in Path(source).rglob('*'));shutil.copytree(source,local)
            else:shutil.copy2(source,local)
            os.chown(local,10001,10001)
            if local.is_dir():
                for item in local.rglob('*'):os.chown(item,10001,10001)
            source=str(local)
        command+=['--mount','type=bind,src='+source+',dst='+mount['Destination']+(',readonly' if readonly else '')]
    for target,options in original()['HostConfig'].get('Tmpfs',{}).items():command+=['--tmpfs',target+':'+options]
    save('clone-app-command.private.json',command)
    run(command+[IMAGE]);check_canary()

def check_canary():
    assert (RELEASE/'canary-migration-passed.json').exists() and migration(CLONE_DB)==54
    assert inspect(APP)['Id']==original()['Id'] and inspect(APP)['Image']==PREVIOUS
    ready(CLONE_APP);assert inspect(CLONE_NETWORK)['Internal']
    report=access(CLONE_APP);save('canary-access-passed.json',report)
    print(json.dumps({'cloneMigrationPassed':True,'migration':54,'noExternalNetwork':True,**report}),flush=True)

def register(label):
    status,challenge,_=api(CLONE_APP,'POST','/api/auth/registration-challenge',{});assert status==200
    left,operator,right=challenge['question'].split()[:3];username=label+secrets.token_hex(4)
    status,account,cookie=api(CLONE_APP,'POST','/api/auth/register',{'username':username,'password':'Aa9!'+secrets.token_urlsafe(24),'email':username.lower()+'@example.invalid','challengeId':challenge['challengeId'],'challengeAnswer':str(int(left)+int(right) if operator=='+' else int(left)-int(right))})
    assert status in [200,201] and cookie
    return cookie.split(';')[0],account['csrfToken']

def configure_clone_proxy():
    assert migration(PROD_DB)==53 and inspect(APP)['Image']==PREVIOUS
    assert not (RELEASE/'canary-passed.json').exists()
    old=CLONE_APP+'-before-proxy';assert not exists(old)
    command=json.loads((RELEASE/'clone-app-command.private.json').read_text())
    command+=['-e','MAPFLOW_IDENTITY_TRUSTED_PROXY_IP=127.0.0.1']
    run(DOCKER+['stop',CLONE_APP]);run(DOCKER+['network','disconnect',CLONE_NETWORK,CLONE_APP]);run(DOCKER+['rename',CLONE_APP,old])
    save('clone-app-command.private.json',command)
    run(command+[IMAGE]);ready(CLONE_APP);check_canary()
    save('clone-proxy-policy.json',{'trustedProxyIp':'127.0.0.1','scope':'isolated clone only','productionPolicyUnchanged':True})

def protocol():
    assert (RELEASE/'canary-access-passed.json').exists()
    cookie,csrf=register('ChatUiRelease');other,other_csrf=register('ChatUiForeign')
    def call(method,path,body=None,expected=200,code=None):
        status,payload,_=api(CLONE_APP,method,path,body,cookie,csrf);assert status==expected,(method,path,status)
        if code:assert payload['error']['code']==code
        return payload
    wallet=call('GET','/api/wallet');listing='/api/me/tavern/conversations?scene=management'
    assert call('GET',listing)['bootstrapState']=='never_created'
    request={'newConversation':True,'clientRequestId':str(uuid.uuid4())}
    first=call('POST','/api/me/tavern/management-conversations',request);identity=first['conversation']['conversationId'];path='/api/me/tavern/conversations/'+identity
    assert call('POST','/api/me/tavern/management-conversations',request)['conversation']['conversationId']==identity
    assert api(CLONE_APP,'DELETE',path,cookie=other,csrf=other_csrf)[0]==404
    for _ in range(2):call('DELETE',path,expected=204)
    for suffix in ['', '/turns','/canvas','/map-generation-draft']:call('GET',path+suffix,expected=404)
    call('PATCH',path+'/canvas',{'expectedRevision':0,'enabled':True,'elements':[]},expected=404)
    assert call('GET',listing)=={'conversations':[],'bootstrapState':'cleared'}
    call('POST','/api/me/tavern/management-conversations',{},expected=409,code='tavern.history_cleared')
    call('POST','/api/me/tavern/management-conversations',request,expected=410,code='tavern.creation_target_deleted')
    next_chat=call('POST','/api/me/tavern/management-conversations',{'newConversation':True,'clientRequestId':str(uuid.uuid4())})
    assert next_chat['conversation']['conversationId']!=identity
    trees=call('GET','/api/trees/public')['trees'];assert trees
    entry=call('POST','/api/me/tree-library',{'treeId':trees[0]['id']})['library_entry_id']
    call('POST','/api/me/learning-areas/'+entry,{})
    learning='/api/me/learning-areas/'+entry+'/conversations'
    assert call('GET',learning)['bootstrapState']=='never_created'
    request={'clientRequestId':str(uuid.uuid4()),'toolsEnabled':True}
    created=call('POST',learning,request);identity=created['conversation']['conversationId']
    call('DELETE','/api/me/tavern/conversations/'+identity,expected=204)
    assert call('GET',learning)=={'conversations':[],'bootstrapState':'cleared'}
    call('POST','/api/me/tavern/tree-conversations/'+entry,{},expected=409,code='tavern.history_cleared')
    call('POST',learning,request,expected=410,code='tavern.creation_target_deleted')
    assert call('POST',learning,{'clientRequestId':str(uuid.uuid4())})['conversation']['conversationId']!=identity
    independent=call('POST','/api/me/tavern/conversations',{'characterId':created['conversation']['characterId'],'userName':'发布验收'},expected=201)
    call('DELETE','/api/me/tavern/conversations/'+independent['conversationId'],expected=204)
    assert call('GET','/api/me/tavern/conversations')['conversations']==[]
    assert call('GET','/api/wallet')==wallet
    assert int(sql(CLONE_DB,"SELECT count(*) FROM agent_executions e JOIN accounts a USING(account_id) WHERE a.username_key LIKE 'chatuirelease%'"))==0
    run(DOCKER+['restart',CLONE_APP]);ready(CLONE_APP)
    assert call('GET','/api/me/tavern/conversations')['conversations']==[]
    assert migration(PROD_DB)==53 and inspect(APP)['Image']==PREVIOUS
    save('canary-auth.private.json',{'cookie':cookie,'csrf':csrf,'deletedConversations':[path,'/api/me/tavern/conversations/'+identity,'/api/me/tavern/conversations/'+independent['conversationId']]})
    report={'passed':True,'allThreeScenesDeletion':True,'ownershipVerified':True,'repeatDelete204':True,'deletedReadsAndCanvas404':True,'bootstrapAndClear':True,'clearSurvivesRestart':True,'terminalCreationReplay410':True,'explicitNewAfterClear':True,'walletUnchanged':True,'modelExecutions':0,'productionUnaffected':True}
    save('canary-passed.json',report);print(json.dumps(report),flush=True)

def rollback_canary():
    fixture=json.loads((RELEASE/'canary-auth.private.json').read_text())
    name='mapflow-chat-ui-compatible-check-app-20261013';assert not exists(name)
    command=json.loads((RELEASE/'clone-app-command.private.json').read_text());command[command.index('--name')+1]=name
    run(DOCKER+['stop',CLONE_APP])
    try:
        run(command+[COMPATIBLE]);ready(name);artifacts(name,compatible=True)
        for path in fixture['deletedConversations']:
            for suffix in ['', '/turns','/canvas']:
                assert api(name,'GET',path+suffix,cookie=fixture['cookie'])[0]==404
        assert migration(CLONE_DB)==54
        report=json.loads((RELEASE/'canary-passed.json').read_text());report['compatibleRollbackVerified']=True
        save('canary-passed.json',report)
    finally:
        if exists(name):run(DOCKER+['stop',name])
        run(DOCKER+['start',CLONE_APP]);ready(CLONE_APP)
    print(json.dumps({'compatibleRollbackVerified':True,'deletedConversationReads':404,'databaseRetained':True}),flush=True)

def restore_traffic(before,maintenance):
    proxy=ROOT/'runtime/Caddyfile';assert proxy.read_text() in [before,maintenance],'Proxy changed concurrently'
    proxy.write_text(before);prior.base.caddy_reload()

def rollback(before,maintenance):
    version=migration(PROD_DB);assert version in [53,54]
    if exists(APP):
        run(DOCKER+['stop',APP])
        if NETWORK in inspect(APP)['NetworkSettings']['Networks']:run(DOCKER+['network','disconnect',NETWORK,APP])
        if exists(OLD_APP):run(DOCKER+['rename',APP,'mapflow-laptop-app-failed-chat-ui-'+str(time.time_ns())])
        else:run(DOCKER+['rename',APP,OLD_APP])
    if version==54:
        prior.IMAGE=COMPATIBLE;prior.create_production();ready(APP);artifacts(APP,compatible=True);prior.retained_config()
    else:
        run(DOCKER+['rename',OLD_APP,APP]);endpoint=original()['NetworkSettings']['Networks'][NETWORK]
        command=DOCKER+['network','connect','--ip',endpoint['IPAddress']]
        for alias in endpoint.get('Aliases') or []:
            if len(alias)!=64:command+=['--alias',alias]
        run(command+[NETWORK,APP]);run(DOCKER+['start',APP]);ready(APP)
    restore_traffic(before,maintenance);save('rollback-passed.json',{'migration':version,'compatibleDeletionBackend':version==54,'databaseRestoredFromBackup':False})

def cutover(resume=False):
    canary_report=json.loads((RELEASE/'canary-passed.json').read_text())
    assert canary_report['passed'] and canary_report['compatibleRollbackVerified']
    if resume:
        manifest=json.loads((RELEASE/'provenance.json').read_text())
        assert inspect(APP)['Image']==manifest['rollbackImageId'] and exists(OLD_APP) and migration(PROD_DB)==54
        assert json.loads((RELEASE/'original-observation-retention-audit.json').read_text())['missingEqualsOldestPolicyOrderedRows']
        assert not (RELEASE/'production-passed.json').exists()
        assert prior.retained_config()
        archive=RELEASE/'attempts'/str(time.time_ns());archive.mkdir(mode=0o700,parents=True)
        for name in ['before-cutover.dump','production-data.before.json','production-data.after.json','production-migrations.before.json','production-observations.before.json','production-observation-order.private.json','production-observation-ages.private.json','production-migration-passed.json','rollback-passed.json','original-observation-retention-audit.json','second-observation-retention-audit.private.json']:
            if (RELEASE/name).is_file():shutil.copy2(RELEASE/name,archive/name)
    else:
        assert inspect(APP)['Id']==original()['Id'] and inspect(APP)['Image']==PREVIOUS and not exists(OLD_APP)
    assert int(sql(PROD_DB,"SELECT count(*) FROM agent_executions WHERE state NOT IN ('succeeded','stopped','failed')"))==0,'Active execution; defer cutover'
    assert legacy_locks(PROD_DB)==0,'Legacy generation lock active; defer cutover'
    proxy=ROOT/'runtime/Caddyfile';before=proxy.read_text();marker='reverse_proxy mapflow-app:8080 {';assert before.count(marker)==1
    maintenance=before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker);prior.base.private_write(RELEASE/'Caddyfile.before',before)
    try:
        proxy.write_text(maintenance);prior.base.caddy_reload();run(DOCKER+['stop','--time','30',APP])
        assert int(sql(PROD_DB,"SELECT count(*) FROM agent_executions WHERE state NOT IN ('succeeded','stopped','failed')"))==0
        backup('before-cutover.dump');baseline=fingerprints(PROD_DB);versions=version_rows(PROD_DB);observations=observation_rows(PROD_DB)
        ordered=json.loads(sql(PROD_DB,"SELECT coalesce(json_agg(request_id::text),'[]') FROM (SELECT request_id FROM request_observations ORDER BY CASE WHEN outcome='succeeded' THEN 0 ELSE 1 END,completed_at ASC,request_id ASC) r"))
        ages=observation_age_metadata(PROD_DB);assert set(ages)==set(observations)
        save('production-observation-order.private.json',ordered)
        save('production-observation-ages.private.json',ages)
        save('production-data.before.json',baseline);save('production-migrations.before.json',versions);save('production-observations.before.json',observations)
        assert migration(PROD_DB)==(54 if resume else 53)
        if not resume:migrate(PROD_DB,ROOT/'runtime/secrets/database.url',NETWORK)
        preserve_migration(PROD_DB,versions);unchanged(baseline,fingerprints(PROD_DB))
        save('production-migration-passed.json',{'migration':54,'originalFieldsPreserved':True,'originalTablesPreserved':len(baseline),'existingMigrationsPreserved':len(versions),'existingDeletedAtNull':True})
        run(DOCKER+['network','disconnect',NETWORK,APP])
        retained=OLD_APP+'-compatible-'+str(time.time_ns()) if resume else OLD_APP
        run(DOCKER+['rename',APP,retained]);prior.IMAGE=IMAGE;prior.create_production();ready(APP)
        report=access(APP);assert prior.retained_config()
        after=fingerprints(PROD_DB);unchanged(baseline,after,allow_observations=True);save('production-data.after.json',after)
        current=observation_rows(PROD_DB);retention=verify_observation_retention(observations,current,ordered,expired=expired_observations(ages,time.time()))
        save('production-observation-retention-passed.json',retention)
        save('production-passed.json',{'frontendMain':FRONTEND,'backendMain':BACKEND,'image':IMAGE,'imageId':inspect(APP)['Image'],'migration':54,'originalTablesPreserved':len(baseline),'observationRetention':retention,'runtimeConfigurationPreserved':True,**report})
        restore_traffic(before,maintenance)
    except Exception:
        rollback(before,maintenance);raise
    print(json.dumps({'cutoverPassed':True,'migration':54,'originalTablesPreserved':len(baseline),'runtimeConfigurationPreserved':True,**report}),flush=True)

def finish():
    report=json.loads((RELEASE/'production-passed.json').read_text());expected=(PACKET/'context/web-dist/index.html').read_bytes();public={}
    for path in ['/assistant','/library','/maps','/learning','/tavern','/health/ready']:
        request=urllib.request.Request('https://xxian.fun'+path,headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(request,timeout=25) as response:
            assert response.status==200
            if path!='/health/ready':assert response.read()==expected
        public[path]=200
    assert prior.retained_config();report.update(publicRoutes=public,finishedAt=time.time(),**artifacts(APP));save('production-passed.json',report)
    operations=ROOT/'OPERATIONS.md';notice='> **聊天 UI 与会话删除已发布（2026-10-13）**：前端 main `'+FRONTEND+'`，后端 main `'+BACKEND+'`；镜像 `'+IMAGE+'`，ID `'+report['imageId']+'`；迁移 0054。桌面、手机工具栏与固定配置弹窗、会话软删除已上线。私有备份与验证：`releases/20261013-chat-ui-and-deletion/`。回退必须保留当前数据库并使用兼容删除后端镜像 `'+COMPATIBLE+'`；旧后端会绕过删除标记，禁止直接恢复旧容器或覆盖旧数据库。\n\n'
    if not operations.read_text().startswith(notice):operations.write_text(notice+operations.read_text())
    (RELEASE/'DEPLOYMENT.md').write_text('# Chat UI and durable conversation deletion — 2026-10-13\n\nFrontend main '+FRONTEND+'; backend main '+BACKEND+'; image '+report['imageId']+'. Migration 0054 applied with original business fields, rows and historical migration records preserved. Retained observations are identical; normal existing 20000-row and 7/30-day retention is verified separately, with cold backups and initial rollback attempts retained. Internal-network production clone passed repeated migrations, three-scene deletion, terminal replay, new-after-clear, restart persistence, ownership and wallet invariance without model execution. Runtime configuration and worker bytes preserved.\n\nRollback uses '+COMPATIBLE+' with the deletion-compatible backend and previous frontend. Preserve the current database and newer transactions. Never restore a historical database or directly resume the old backend after soft deletion.\n')
    run(DOCKER+['stop',CLONE_APP,CLONE_DB]);print(json.dumps({'deploymentFinished':True,'imageId':report['imageId'],'migration':54,'publicRoutes':public,'verifiedFiles':report['verifiedFiles']}),flush=True)

if __name__=='__main__':
    {'prepare':prepare,'resume-prepare':lambda:prepare(True),'canary':canary,'check-canary':check_canary,'clone-proxy':configure_clone_proxy,'protocol':protocol,'rollback-canary':rollback_canary,'cutover':cutover,'resume-cutover':lambda:cutover(True),'finish':finish}[sys.argv[1]]()
