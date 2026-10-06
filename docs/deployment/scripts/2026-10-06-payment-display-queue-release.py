"""Run as laptop root. Preserve the current registration release and private configuration."""
from pathlib import Path
import hashlib, http.client, importlib.util, json, shutil, socket, sys, time, urllib.error, urllib.request

spec = importlib.util.spec_from_file_location('base', '/tmp/mapflow-payment-release.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.release = base.root/'releases'/'20261006-payment-display-queue'
base.image = 'mapflow-server:payment-display-queue-20261006'
base.stage_db = 'mapflow-display-check-postgres'
base.stage_app = 'mapflow-display-check-app'
expected_previous = 'mapflow-server:registration-vmq-20261006-f60293e'
previous_name = 'mapflow-laptop-app-before-display-queue-20261006'

def original(): return json.loads((base.release/'original-container.json').read_text())

def stage_create(container, db_file, public_port, internal_port, ip=None):
    previous = original()
    environment = previous['Config']['Env']
    env_file = base.release/'stage-app.env'
    base.private_write(env_file, '\n'.join(environment)+'\n')
    command=base.docker+['run','-d','--name',container,'--network',base.network,'--env-file',str(env_file),
        '--read-only','--memory','1073741824','--cpus','2','--cap-drop','ALL','--security-opt','no-new-privileges:true',
        '-p',f'127.0.0.1:{public_port}:8080','-p',f'127.0.0.1:{internal_port}:8081']
    for mount in previous['Mounts']:
        if mount['Type'] != 'bind': continue
        source = str(db_file) if mount['Destination']=='/run/secrets/database.url' else mount['Source']
        command += ['--mount',f'type=bind,src={source},dst={mount["Destination"]},readonly']
    for target, options in previous['HostConfig'].get('Tmpfs',{}).items():
        command += ['--tmpfs',target+':'+options]
    base.run(command+[base.image])

base.app_create = stage_create

def prepare():
    previous=base.inspect(base.name)
    if previous['Config']['Image'] != expected_previous: raise RuntimeError('production changed; rebase before publishing')
    base.release.mkdir(mode=0o700)
    base.private_write(base.release/'original-container.json',json.dumps(previous))
    base.backup(base.release/'canary-source.dump')
    context=base.release/'build'; context.mkdir()
    for binary in ['mapflow-server','mapflow-admin']:
        shutil.copy2('/home/rong/.cache/mapflow-payment-release/release/'+binary,context/binary)
    shutil.copytree('/tmp/mapflow-display-frontend/dist',context/'dist')
    (context/'Dockerfile').write_text('FROM '+expected_previous+'\nCOPY --chmod=0555 mapflow-server /usr/local/bin/mapflow-server\nCOPY --chmod=0555 mapflow-admin /usr/local/bin/mapflow-admin\nCOPY --chown=10001:10001 dist/ /srv/mapflow/\n')
    with (base.release/'image-build.log').open('wb') as log:
        base.run(base.docker+['build','--network=none','-t',base.image,str(context)],output=log)
    print('queue image prepared; registration and harness retained',flush=True)

def rebuild():
    if base.inspect(base.name)['Id'] != original()['Id']: raise RuntimeError('production changed during verification')
    context=base.release/'build'
    for binary in ['mapflow-server','mapflow-admin']:
        shutil.copy2('/home/rong/.cache/mapflow-payment-release/release/'+binary,context/binary)
    with (base.release/'image-build-final.log').open('wb') as log:
        base.run(base.docker+['build','--network=none','-t',base.image,str(context)],output=log)
    (base.release/'canary-passed.json').unlink(missing_ok=True)
    print('final image rebuilt; canary must pass again',flush=True)

class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.connect('/var/run/docker.sock')

def create_production():
    previous=original()
    config={key:previous['Config'][key] for key in ['User','Env','Cmd','Entrypoint','WorkingDir','Labels','ExposedPorts','Healthcheck','StopSignal'] if key in previous['Config']}
    config['Image']=base.image
    config['HostConfig']=previous['HostConfig']
    endpoint=previous['NetworkSettings']['Networks'][base.network]
    config['NetworkingConfig']={'EndpointsConfig':{base.network:{'Aliases':[alias for alias in endpoint.get('Aliases',[]) or [] if len(alias)!=64], 'IPAMConfig':{'IPv4Address':endpoint['IPAddress']}}}}
    connection=DockerConnection('localhost')
    connection.request('POST','/containers/create?name='+base.name,json.dumps(config),{'Content-Type':'application/json'})
    response=connection.getresponse(); response.read()
    if response.status != 201: raise RuntimeError('container creation failed, status '+str(response.status))
    connection.close(); base.run(base.docker+['start',base.name])

def checks(port):
    statuses=[]
    for method,path,body in [('GET','/api/wallet',None),('GET','/api/wallet/payments/vmq/notify?payId=forged',None),('POST','/api/auth/registration-challenge',b'{}'),('POST','/api/wallet/topups/00000000-0000-0000-0000-000000000001/display',b'{"action":"join"}')]:
        if path == '/api/auth/registration-challenge':
            container=base.stage_app if port == 18094 else base.name
            address=base.inspect(container)['NetworkSettings']['Networks'][base.network]['IPAddress']
            # Registration requires the existing trusted proxy; preserve its strict IP policy.
            status=base.run(base.docker+['exec','mapflow-laptop-caddy','curl','-sS','-o','/dev/null','-w','%{http_code}','-X','POST',
                '-H','Host: xxian.fun','-H','Origin: https://xxian.fun','-H','X-Real-IP: 198.51.100.23','-H','X-MapFlow-Proxy: caddy',
                f'http://{address}:8080'+path])
            statuses.append(int(status)); continue
        request=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=body,method=method,headers={'Host':'xxian.fun','Origin':'https://xxian.fun','Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=10) as response: statuses.append(response.status)
        except urllib.error.HTTPError as error: statuses.append(error.code)
    if statuses != [401,400,200,401]: raise RuntimeError('wallet, callback, registration or queue checks failed: '+str(statuses))
    expected_index=(base.release/'build/dist/index.html').read_bytes()
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=10) as response:
        if response.read() != expected_index: raise RuntimeError('frontend release differs')
    return statuses

original_ready = base.ready
def ready_with_canary_checks(port):
    original_ready(port)
    if port == 18094:
        statuses=checks(port)
        print('clone registration, queue authentication, wallet and callback checks',statuses,flush=True)
base.ready = ready_with_canary_checks

def canary():
    base.canary()
    # base.canary removes its temporary containers only after migration/readiness checks pass.
    print('database clone upgraded and application checks passed',flush=True)

def rollback_application():
    current=base.run(base.docker+['ps','-aq','--filter','name=^/'+base.name+'$']).strip()
    if current: base.run(base.docker+['rm','-f',base.name])
    base.run(base.docker+['rename',previous_name,base.name])
    base.run(base.docker+['network','connect','--ip','172.31.66.2','--alias','mapflow-app',base.network,base.name])
    base.run(base.docker+['start',base.name]); base.ready(18092)

def cutover():
    if not (base.release/'canary-passed.json').exists(): raise RuntimeError('canary must pass first')
    previous=original()
    if base.inspect(base.name)['Id'] != previous['Id']: raise RuntimeError('production changed during validation')
    proxy=base.root/'runtime/Caddyfile'; before=proxy.read_text()
    marker='reverse_proxy mapflow-app:8080 {'
    if before.count(marker)!=1: raise RuntimeError('proxy configuration changed')
    maintenance=before.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker)
    base.private_write(base.release/'Caddyfile.before',before)
    renamed=False
    try:
        proxy.write_text(maintenance); base.caddy_reload()
        base.run(base.docker+['stop',base.name])
        base.backup(base.release/'before-cutover.dump')
        base.migrate(base.root/'runtime/secrets/database.url')
        base.run(base.docker+['network','disconnect',base.network,base.name])
        base.run(base.docker+['rename',base.name,previous_name]); renamed=True
        create_production(); base.ready(18092)
        statuses=checks(18092)
        expected=hashlib.sha256((base.release/'build/mapflow-server').read_bytes()).hexdigest()
        installed=base.run(base.docker+['exec',base.name,'sha256sum','/usr/local/bin/mapflow-server']).decode().split()[0]
        if installed!=expected: raise RuntimeError('installed binary differs')
    except Exception:
        if renamed: rollback_application()
        else: base.run(base.docker+['start',base.name]); base.ready(18092)
        if proxy.read_text()!=maintenance: raise RuntimeError('proxy changed externally; inspect before restoring')
        proxy.write_text(before); base.caddy_reload()
        # Migration 0030 is additive. Never discard payments by restoring the database.
        raise
    if proxy.read_text()!=maintenance: raise RuntimeError('proxy changed externally; inspect before restoring')
    proxy.write_text(before); base.caddy_reload()
    with urllib.request.urlopen('https://xxian.fun/health/ready',timeout=15) as response:
        if response.status!=200: raise RuntimeError('public readiness failed; do not restore database')
    (base.release/'production-passed.json').write_text(json.dumps({'image':base.image,'binarySha256':expected,'migration':30,'checks':statuses,'checkedAt':time.time(),'publicReady':True}))
    print('queue live; registration challenge preserved; anonymous wallet denied; callback rejects forgery;',expected,flush=True)

if __name__=='__main__': {'prepare':prepare,'rebuild':rebuild,'canary':canary,'cutover':cutover}[sys.argv[1]]()
