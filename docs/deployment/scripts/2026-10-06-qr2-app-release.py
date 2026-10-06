"""Laptop root: publish the verified QR revision binary, preserving live config."""
from pathlib import Path
import hashlib, http.client, importlib.util, json, socket, time, urllib.request

spec = importlib.util.spec_from_file_location('release', '/tmp/mapflow-payment-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
release.image = 'mapflow-server:vmq-wallet-20261006-qr2'
previous = release.inspect(release.name)
if previous['Config']['Image'] != 'mapflow-server:vmq-wallet-20261006':
    raise RuntimeError('production image changed externally')
backup_name = 'mapflow-laptop-app-before-qr2-20261006'
release.private_write(release.release/'qr2-container-before.json', json.dumps(previous))
release.rebuild()
release.canary()

class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.connect('/var/run/docker.sock')
def create():
    config = {key:previous['Config'][key] for key in ['User','Env','Cmd','Entrypoint','WorkingDir','Labels','ExposedPorts','Healthcheck','StopSignal'] if key in previous['Config']}
    config['Image'] = release.image
    config['HostConfig'] = previous['HostConfig']
    endpoint = previous['NetworkSettings']['Networks'][release.network]
    config['NetworkingConfig'] = {'EndpointsConfig':{release.network:{
        'Aliases':[alias for alias in endpoint.get('Aliases',[]) or [] if len(alias)!=64],
        'IPAMConfig':{'IPv4Address':endpoint['IPAddress']}}}}
    connection = DockerConnection('localhost')
    connection.request('POST','/containers/create?name='+release.name,json.dumps(config),{'Content-Type':'application/json'})
    response = connection.getresponse()
    body = response.read()
    if response.status != 201:
        raise RuntimeError('new container creation failed, status '+str(response.status))
    connection.close()
    release.run(release.docker+['start',release.name])

proxy = release.root/'runtime/Caddyfile'
original_proxy = proxy.read_text()
marker = 'reverse_proxy mapflow-app:8080 {'
if original_proxy.count(marker)!=1:
    raise RuntimeError('proxy target changed')
maintenance = original_proxy.replace(marker,'respond "网站升级中，请稍后再试" 503\n\t'+marker)
renamed = False
created = False
try:
    if release.inspect(release.name)['Id'] != previous['Id']:
        raise RuntimeError('production container changed during verification')
    proxy.write_text(maintenance)
    release.caddy_reload()
    release.run(release.docker+['stop',release.name])
    release.run(release.docker+['network','disconnect',release.network,release.name])
    release.run(release.docker+['rename',release.name,backup_name])
    renamed = True
    create()
    created = True
    release.ready(18092)
    expected = hashlib.sha256(Path('/home/rong/.cache/mapflow-payment-release/release/mapflow-server').read_bytes()).hexdigest()
    installed = release.run(release.docker+['exec',release.name,'sha256sum','/usr/local/bin/mapflow-server']).decode().split()[0]
    if installed != expected:
        raise RuntimeError('installed binary hash differs')
except Exception:
    if renamed:
        # Roll back only the application; keep all new wallet data.
        current = release.run(release.docker+['ps','-aq','--filter','name=^/'+release.name+'$']).strip()
        if current:
            release.run(release.docker+['rm','-f',release.name])
        release.run(release.docker+['rename',backup_name,release.name])
        release.run(release.docker+['network','connect','--ip','172.31.66.2','--alias','mapflow-app',release.network,release.name])
        release.run(release.docker+['start',release.name])
        release.ready(18092)
    proxy.write_text(original_proxy)
    release.caddy_reload()
    raise
if proxy.read_text()!=maintenance:
    raise RuntimeError('proxy changed externally; inspect before removing maintenance')
proxy.write_text(original_proxy)
release.caddy_reload()
with urllib.request.urlopen('https://xxian.fun/health/ready',timeout=10) as response:
    if response.status != 200:
        raise RuntimeError('public readiness failed')
(release.release/'qr2-production-passed.json').write_text(json.dumps({'image':release.image,'binarySha256':expected,'ready':True,'checkedAt':time.time()}))
print('QR revision application live; no database restore performed;', expected)
