"""Run on the laptop as root after transferring the exact user PNG to /tmp."""
from pathlib import Path
import hashlib, http.cookiejar, json, subprocess, urllib.parse, urllib.request

image = Path('/tmp/mapflow-wechat-qr-revision.png').read_bytes()
expected_hash = '97a32e1ff21d0ed864327dce079b180dc6cfe0e19b0530e0565bfa034813e6f8'
payload = 'wxp://f2f0XO9MxuKhCB52g30uvHa1Pxe4kqoOc9ubMFa82j6b_uM2V3I_cgZzPVoQ5wHbXl0z'
if hashlib.sha256(image).hexdigest() != expected_hash:
    raise RuntimeError('transferred QR hash differs')

runtime = Path('/home/rong/.local/state/mapflow-vmq')
credentials = json.loads((runtime/'credentials.json').read_text())
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path, values=None):
    body = urllib.parse.urlencode(values).encode() if values is not None else None
    with client.open('http://127.0.0.1:28080'+path, body, timeout=8) as response:
        return json.load(response)

if api('/login', {'user':credentials['user'], 'pass':credentials['pass']}).get('code') != 1:
    raise RuntimeError('Vmq administrative login failed')
settings = api('/admin/getSettings')['data']
backup = runtime/'backups/20261006-wechat-qr-revision'
backup.mkdir(parents=True, exist_ok=True)
backup.chmod(0o700)
if not (backup/'settings.json').exists():
    (backup/'settings.json').write_text(json.dumps(settings))
    (backup/'settings.json').chmod(0o600)
fields = {name:settings[name] for name in ['user','pass','notifyUrl','returnUrl','key','wxpay','zfbpay','close','payQf']}
fields['wxpay'] = payload
if api('/admin/saveSetting', fields).get('code') != 1:
    raise RuntimeError('Vmq settings update failed')
if api('/admin/getSettings')['data']['wxpay'] != payload:
    raise RuntimeError('Vmq QR verification failed')

qr_id = '00000000-0000-0000-0000-000000000005'
sql = """BEGIN;
INSERT INTO wallet_qr_codes(qr_code_id,channel,content_type,image_bytes)
VALUES ('%s','wechat','image/png',decode('%s','hex'))
ON CONFLICT(qr_code_id) DO NOTHING;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM wallet_qr_codes WHERE qr_code_id='%s' AND image_bytes=decode('%s','hex'))
THEN RAISE EXCEPTION 'QR revision ID already contains different bytes'; END IF;
END $$;
UPDATE wallet_payment_channels SET qr_code_id='%s' WHERE channel='wechat';
COMMIT;
SELECT channel,qr_code_id FROM wallet_payment_channels ORDER BY channel;
SELECT count(*) AS retained_previous_wechat_orders FROM wallet_topups
WHERE channel='wechat' AND qr_code_id<>'%s';
""" % (qr_id,image.hex(),qr_id,image.hex(),qr_id,qr_id)
completed = subprocess.run(['docker','-H','unix:///var/run/docker.sock','exec','-i',
    'mapflow-laptop-postgres','psql','-v','ON_ERROR_STOP=1','-U','mapflow','-d','mapflow'],
    input=sql.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if completed.returncode:
    raise RuntimeError('website QR transaction failed; previous image rows remain retained')
print(completed.stdout.decode())
print('New WeChat QR configured in website and Vmq; SHA-256:',expected_hash)
