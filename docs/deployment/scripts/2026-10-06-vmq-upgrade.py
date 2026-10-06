from pathlib import Path
import http.cookiejar,json,shutil,subprocess,time,urllib.parse,urllib.request
runtime=Path('/home/rong/.local/state/mapflow-vmq')
backup=runtime/'backups'/'20261006-auto-topup'
backup.mkdir(parents=True,exist_ok=True);backup.chmod(0o700)
if (backup/'vmq.war').exists(): raise RuntimeError('Vmq upgrade backup already exists')
credentials=json.loads((runtime/'credentials.json').read_text())
cookie=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie))
def api(path,values=None):
    body=urllib.parse.urlencode(values).encode() if values else None
    with client.open('http://127.0.0.1:28080'+path,body,timeout=8) as response:return json.load(response)
def login():
    result=api('/login',{'user':credentials['user'],'pass':credentials['pass']})
    if result.get('code')!=1:raise RuntimeError('Vmq administrative login failed')
login()
settings=api('/admin/getSettings')['data']
(backup/'settings.json').write_text(json.dumps(settings));(backup/'settings.json').chmod(0o600)
subprocess.run(['systemctl','--user','stop','mapflow-vmq.service'],check=True)
shutil.copy2(runtime/'vmq.war',backup/'vmq.war')
shutil.copytree(runtime/'data',backup/'data')
try:
    shutil.copy2('/tmp/mapflow-listener-audit-c49f631/integrations/payment-listener/vmq-server/target/mq-0.0.1-SNAPSHOT.war',runtime/'vmq.war')
    subprocess.run(['systemctl','--user','start','mapflow-vmq.service'],check=True)
    for _ in range(60):
        try: login();break
        except Exception:time.sleep(.3)
    else:raise RuntimeError('updated Vmq did not become ready')
    fields={field:settings[field] for field in ['user','pass','notifyUrl','returnUrl','key','wxpay','zfbpay','close','payQf']}
    fields.update(notifyUrl='http://127.0.0.1:18092/api/wallet/payments/vmq/notify',returnUrl='https://xxian.fun/',
        wxpay='wxp://f2f6OXLGUZ3qDQyin9aGLZYbuwc0xkxfewtDRFHE1nlEiqw',
        zfbpay='https://qr.alipay.com/2m611628fhnturpr4p9bs96',close='5',payQf='1')
    result=api('/admin/saveSetting',fields)
    if result.get('code')!=1:raise RuntimeError('Vmq settings update failed')
    verified=api('/admin/getSettings')['data']
    if any(verified[key]!=value for key,value in fields.items()):raise RuntimeError('Vmq settings verification failed')
    print('Vmq upgraded; credentials retained; both payment codes and local callback configured')
except Exception:
    subprocess.run(['systemctl','--user','stop','mapflow-vmq.service'],check=True)
    shutil.copy2(backup/'vmq.war',runtime/'vmq.war')
    subprocess.run(['systemctl','--user','start','mapflow-vmq.service'],check=True)
    raise
