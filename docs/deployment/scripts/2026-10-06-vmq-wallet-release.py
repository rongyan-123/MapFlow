from pathlib import Path
import http.cookiejar, json, os, secrets, shutil, subprocess, sys, time, urllib.parse, urllib.request

docker=['docker','-H','unix:///var/run/docker.sock']
root=Path('/opt/mapflow-laptop-migration-20261006')
release=root/'releases'/'20261006-vmq-wallet'
name='mapflow-laptop-app'
image='mapflow-server:vmq-wallet-20261006'
network='mapflow-laptop-migration'
stage_db='mapflow-payment-check-postgres'
stage_app='mapflow-payment-check-app'

def run(arguments, *, input_bytes=None, output=None):
    completed=subprocess.run(arguments,input=input_bytes,stdout=output or subprocess.PIPE,stderr=subprocess.PIPE)
    if completed.returncode:
        raise RuntimeError('operation failed ('+arguments[0]+'): '+completed.stderr.decode(errors='replace')[-1200:])
    return completed.stdout

def inspect(container): return json.loads(run(docker+['inspect',container]))[0]
def private_write(path,text,uid=0):
    path.write_text(text); path.chmod(0o400); os.chown(path,uid,uid)

def database_info():
    uri=urllib.parse.urlsplit((root/'runtime/secrets/database.url').read_text().strip())
    return uri,urllib.parse.unquote(uri.username),uri.path.lstrip('/')

def backup(filename):
    _,user,database=database_info()
    with filename.open('wb') as stream:
        run(docker+['exec','mapflow-laptop-postgres','pg_dump','-U',user,'-d',database,'-Fc'],output=stream)
    filename.chmod(0o600)
    print('database backup complete',filename.name,filename.stat().st_size,flush=True)

def app_create(container,db_file,public_port,internal_port,ip=None):
    original=json.loads((release/'original-container.json').read_text())
    environment={item.split('=',1)[0]:item.split('=',1)[1] for item in original['Config']['Env']}
    environment['MAPFLOW_VMQ_CONFIG_FILE']='/run/secrets/vmq-wallet.json'
    env_file=release/(container+'.env')
    private_write(env_file,'\n'.join(k+'='+v for k,v in environment.items())+'\n')
    command=docker+['run','-d','--name',container,'--network',network,'--env-file',str(env_file),
        '--read-only','--memory',str(original['HostConfig']['Memory']),'--cpus','2','--cap-drop','ALL',
        '--security-opt','no-new-privileges:true','--restart','unless-stopped',
        '-p',f'127.0.0.1:{public_port}:8080','-p',f'127.0.0.1:{internal_port}:8081']
    for mount in original['Mounts']:
        source=str(db_file) if mount['Destination']=='/run/secrets/database.url' else mount['Source']
        command+=['--mount',f'type=bind,src={source},dst={mount["Destination"]},readonly']
    command+=['--mount',f'type=bind,src={release}/vmq-wallet.json,dst=/run/secrets/vmq-wallet.json,readonly']
    for target,options in original['HostConfig'].get('Tmpfs',{}).items(): command+=['--tmpfs',target+':'+options]
    if ip:
        command+=['--ip',ip]
        for alias in original['NetworkSettings']['Networks'][network].get('Aliases',[]) or []:
            if alias!=name and len(alias)!=64: command+=['--network-alias',alias]
    run(command+[image])

def ready(port):
    for attempt in range(50):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health/ready',timeout=2) as response:
                if response.status==200: return
        except Exception: time.sleep(0.4)
    raise RuntimeError('new container did not become ready')

def rebuild():
    context=release/'build'
    for binary in ['mapflow-server','mapflow-admin']:
        shutil.copy2('/home/rong/.cache/mapflow-payment-release/release/'+binary,context/binary)
    original=json.loads((release/'original-container.json').read_text())
    (context/'Dockerfile').write_text('FROM '+original['Config']['Image']+'\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 dist/ /srv/mapflow/\nCOPY --chown=10001:10001 harness-worker/ /opt/mapflow/harness-worker/\n')
    with (release/'image-build-final.log').open('wb') as log: run(docker+['build','--network=none','-t',image,str(context)],output=log)
    print('final release image built',flush=True)

def migrate(db_file):
    result=run(docker+['run','--rm','--network',network,'--read-only','--entrypoint','/usr/local/bin/mapflow-admin',
        '-e','MAPFLOW_DATABASE_URL_FILE=/run/secrets/database.url','--mount',f'type=bind,src={db_file},dst=/run/secrets/database.url,readonly',image,'database','migrate'])
    print(result.decode().strip(),flush=True)

def prepare():
    release.mkdir(parents=True,exist_ok=True); release.chmod(0o700)
    if (release/'original-container.json').exists(): raise RuntimeError('release already prepared')
    private_write(release/'original-container.json',json.dumps(inspect(name)))
    backup(release/'canary-source.dump')
    credentials=json.loads(Path('/home/rong/.local/state/mapflow-vmq/credentials.json').read_text())
    private_write(release/'vmq-wallet.json',json.dumps({'baseUrl':'http://172.31.66.1:28081','key':credentials['key'],
        'notifyUrl':'http://127.0.0.1:18092/api/wallet/payments/vmq/notify','returnUrl':'https://xxian.fun/'}),10001)
    service=Path('/etc/systemd/system/mapflow-vmq-docker-bridge.service')
    service.write_text('[Unit]\nDescription=Private Docker bridge to MapFlow Vmq\nAfter=docker.service\nRequires=docker.service\n\n[Service]\nUser=rong\nExecStart=/usr/bin/socat TCP4-LISTEN:28081,bind=172.31.66.1,reuseaddr,fork,range=172.31.66.0/24 TCP4:127.0.0.1:28080\nRestart=always\nRestartSec=3\nNoNewPrivileges=true\n\n[Install]\nWantedBy=multi-user.target\n')
    run(['systemctl','daemon-reload']); run(['systemctl','enable','--now',service.name])
    context=release/'build'; context.mkdir()
    shutil.copy2('/home/rong/.cache/mapflow-payment-release/release/mapflow-server',context/'mapflow-server')
    shutil.copytree('/tmp/mapflow-payment-frontend-dist/dist',context/'dist')
    harness=Path('/home/rong/project/mapflow/mapflow-server-payment-listener/harness-worker')
    (context/'harness-worker').mkdir()
    for item in ['dist','node_modules']: shutil.copytree(harness/item,context/'harness-worker'/item)
    shutil.copy2(harness/'package.json',context/'harness-worker/package.json')
    original=json.loads((release/'original-container.json').read_text())
    (context/'Dockerfile').write_text('FROM '+original['Config']['Image']+'\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chown=10001:10001 dist/ /srv/mapflow/\nCOPY --chown=10001:10001 harness-worker/ /opt/mapflow/harness-worker/\n')
    with (release/'image-build.log').open('wb') as log: run(docker+['build','--network=none','-t',image,str(context)],output=log)
    print('release image prepared',image,flush=True)

def canary():
    uri,user,database=database_info(); password=secrets.token_urlsafe(30)
    env=release/'stage-db.env'; private_write(env,'POSTGRES_USER='+user+'\nPOSTGRES_DB='+database+'\nPOSTGRES_PASSWORD='+password+'\n')
    run(docker+['run','-d','--name',stage_db,'--network',network,'--env-file',str(env),'--memory','768m',
        '--tmpfs','/var/lib/postgresql/data:rw,size=768m','pgvector/pgvector:pg16'])
    for _ in range(50):
        check=subprocess.run(docker+['exec',stage_db,'pg_isready','-U',user,'-d',database],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        initialized=subprocess.run(docker+['exec',stage_db,'sh','-c','test "$(cat /proc/1/comm)" = postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if check.returncode==0 and initialized.returncode==0: break
        time.sleep(.3)
    else: raise RuntimeError('canary database unavailable')
    with (release/'canary-source.dump').open('rb') as dump:
        restored=subprocess.run(docker+['exec','-i',stage_db,'pg_restore','--no-owner','--no-acl','-U',user,'-d',database],stdin=dump,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if restored.returncode:
            (release/'canary-restore-error.log').write_bytes(restored.stderr)
            raise RuntimeError('canary database restore failed; see private restore log')
    destination=uri._replace(netloc=urllib.parse.quote(user,safe='')+':'+urllib.parse.quote(password,safe='')+'@'+stage_db+':5432',query='')
    db_file=release/'stage-database.url'; private_write(db_file,urllib.parse.urlunsplit(destination),10001)
    migrate(db_file)
    app_create(stage_app,db_file,18094,18095)
    ready(18094)
    # Configured callback rejects forgery; authenticated wallet is not exposed.
    checks={}
    for path in ['/api/wallet','/api/wallet/payments/vmq/notify?payId=forged']:
        try:
            request=urllib.request.Request('http://127.0.0.1:18094'+path,headers={'Host':'xxian.fun','Origin':'https://xxian.fun'})
            with urllib.request.urlopen(request,timeout=5) as response: checks[path]=response.status
        except urllib.error.HTTPError as error: checks[path]=error.code
    if list(checks.values())!=[401,400]: raise RuntimeError('canary access checks failed')
    with urllib.request.urlopen('http://127.0.0.1:18094/',timeout=5) as response:
        if b'index-' not in response.read(): raise RuntimeError('canary frontend missing')
    (release/'canary-passed.json').write_text(json.dumps({'ready':True,'checks':checks,'checkedAt':time.time()}))
    print('canary migration, frontend and access checks passed',flush=True)
    run(docker+['stop',stage_app]); run(docker+['rm',stage_app]); run(docker+['stop',stage_db]); run(docker+['rm',stage_db])

def caddy_reload():
    # This installation disables Caddy's admin API; apply its validated file via restart.
    run(docker+['exec','mapflow-laptop-caddy','caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'])
    run(docker+['restart','mapflow-laptop-caddy'])

def recover_proxy():
    (root/'runtime/Caddyfile').write_text((release/'Caddyfile.before').read_text())
    caddy_reload()

def restore_database():
    _,user,database=database_info()
    environment={item.split('=',1)[0]:item.split('=',1)[1] for item in inspect('mapflow-laptop-postgres')['Config']['Env']}
    administrator=environment.get('POSTGRES_USER','postgres')
    run(docker+['exec','mapflow-laptop-postgres','dropdb','--force','-U',administrator,database])
    run(docker+['exec','mapflow-laptop-postgres','createdb','-U',administrator,'--owner',user,database])
    with (release/'before-cutover.dump').open('rb') as dump:
        process=subprocess.run(docker+['exec','-i','mapflow-laptop-postgres','pg_restore','-U',administrator,'-d',database],stdin=dump,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if process.returncode:raise RuntimeError('rollback restore failed; maintenance retained')

def cutover():
    if not (release/'canary-passed.json').exists():raise RuntimeError('canary must pass first')
    original=json.loads((release/'original-container.json').read_text())
    if inspect(name)['Id']!=original['Id']:raise RuntimeError('production container changed externally')
    if (release/'production-passed.json').exists():raise RuntimeError('release already live')
    proxy=root/'runtime/Caddyfile'; previous=proxy.read_text()
    marker='reverse_proxy mapflow-app:8080 {'
    if previous.count(marker)!=1:raise RuntimeError('production proxy target changed')
    maintenance=previous.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker)
    private_write(release/'Caddyfile.before',previous)
    old_name='mapflow-laptop-app-before-vmq-20261006'
    maintenance_started=False; database_changed=False; renamed=False
    try:
        proxy.write_text(maintenance);maintenance_started=True;caddy_reload()
        run(docker+['stop',name])
        backup(release/'before-cutover.dump')
        database_changed=True
        migrate(root/'runtime/secrets/database.url')
        run(docker+['network','disconnect',network,name])
        run(docker+['rename',name,old_name]);renamed=True
        app_create(name,root/'runtime/secrets/database.url',18092,18093,'172.31.66.2')
        ready(18092)
        request=urllib.request.Request('http://127.0.0.1:18092/api/wallet/payments/vmq/notify?payId=forged')
        try:urllib.request.urlopen(request,timeout=5);raise RuntimeError('callback accepted unsigned request')
        except urllib.error.HTTPError as error:
            if error.code!=400:raise RuntimeError('callback configuration check failed')
        if proxy.read_text()!=maintenance:raise RuntimeError('proxy configuration changed during cutover')
        proxy.write_text(previous);caddy_reload();maintenance_started=False
        with urllib.request.urlopen('https://xxian.fun/health/ready',timeout=10) as response:
            if response.status!=200:raise RuntimeError('public health check failed')
        (release/'production-passed.json').write_text(json.dumps({'image':image,'checkedAt':time.time(),'publicReady':True}))
        print('production cutover passed; xxian.fun ready; previous image and cold backup retained',flush=True)
    except Exception:
        # Restore only while traffic is still held, before accepting new writes.
        if not maintenance_started:
            raise RuntimeError('post-cutover check failed; do not restore database after admitting traffic')
        if renamed:
            if subprocess.run(docker+['inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:
                run(docker+['stop',name]);run(docker+['rm',name])
            run(docker+['rename',old_name,name])
            run(docker+['network','connect','--ip','172.31.66.2','--alias','mapflow-app',network,name])
        if database_changed:restore_database()
        run(docker+['start',name]);ready(18092)
        proxy.write_text(previous);caddy_reload()
        print('cutover rolled back before traffic was admitted',flush=True)
        raise

if __name__=='__main__':
    {'prepare':prepare,'rebuild':rebuild,'canary':canary,'cutover':cutover,'recover-proxy':recover_proxy}[sys.argv[1]]()
