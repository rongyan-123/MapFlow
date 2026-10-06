"""Run as the laptop service user; preserve H2/settings during the tested WAR update."""
from pathlib import Path
import http.cookiejar, json, shutil, subprocess, time, urllib.parse, urllib.request

runtime = Path('/home/rong/.local/state/mapflow-vmq')
backup = runtime/'backups/20261006-allocation-lock'
if backup.exists():
    raise RuntimeError('allocation lock release backup already exists')
credentials = json.loads((runtime/'credentials.json').read_text())
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path, fields=None):
    with client.open('http://127.0.0.1:28080'+path,
                    urllib.parse.urlencode(fields).encode() if fields else None, timeout=8) as response:
        return json.load(response)
def login():
    if api('/login', {'user':credentials['user'],'pass':credentials['pass']})['code']!=1:
        raise RuntimeError('service administrative login failed')
login()
settings = api('/admin/getSettings')['data']
backup.mkdir(parents=True)
backup.chmod(0o700)
(backup/'settings.json').write_text(json.dumps(settings))
(backup/'settings.json').chmod(0o600)
subprocess.run(['systemctl','--user','stop','mapflow-vmq.service'],check=True)
shutil.copy2(runtime/'vmq.war',backup/'vmq.war')
shutil.copytree(runtime/'data',backup/'data')
try:
    shutil.copy2('/tmp/mapflow-listener-audit-c49f631/integrations/payment-listener/vmq-server/target/mq-0.0.1-SNAPSHOT.war',runtime/'vmq.war')
    subprocess.run(['systemctl','--user','start','mapflow-vmq.service'],check=True)
    for _ in range(60):
        try:
            login()
            break
        except Exception:
            time.sleep(.3)
    else:
        raise RuntimeError('updated service did not start')
    verified = api('/admin/getSettings')['data']
    if any(verified[field]!=settings[field] for field in ['user','pass','notifyUrl','returnUrl','key','wxpay','zfbpay','close','payQf']):
        raise RuntimeError('service settings changed unexpectedly')
    print('Vmq allocation/expiration lock update live; payment codes and settings retained')
except Exception:
    subprocess.run(['systemctl','--user','stop','mapflow-vmq.service'],check=True)
    shutil.copy2(backup/'vmq.war',runtime/'vmq.war')
    subprocess.run(['systemctl','--user','start','mapflow-vmq.service'],check=True)
    raise
