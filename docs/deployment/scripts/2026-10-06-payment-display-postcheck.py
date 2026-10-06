"""Read-only production verification plus deployment index maintenance."""
from pathlib import Path
import datetime, http.cookiejar, json, shutil, subprocess, urllib.parse, urllib.request
from zoneinfo import ZoneInfo
root=Path('/opt/mapflow-laptop-migration-20261006')
release=root/'releases/20261006-payment-display-queue'
report=json.loads((release/'production-passed.json').read_text())
docker=['docker','-H','unix:///var/run/docker.sock']
live=json.loads(subprocess.check_output(docker+['inspect','mapflow-laptop-app']))[0]
if live['Config']['Image']!=report['image']: raise RuntimeError('production image changed')
sql="""SELECT json_build_object(
 'migration',(SELECT max(version) FROM _sqlx_migrations WHERE success),
 'activeDisplays',(SELECT count(*) FROM wallet_payment_display_queue WHERE status='active'),
 'previous003CreditEntries',(SELECT count(*) FROM wallet_ledger WHERE topup_id='01a1113b-7b6e-7573-bc10-d89d284b93ee' AND kind='topup' AND amount_micros=30000),
 'wechatQr',(SELECT qr_code_id FROM wallet_payment_channels WHERE channel='wechat'),
 'alipayQr',(SELECT qr_code_id FROM wallet_payment_channels WHERE channel='alipay'));
"""
database=json.loads(subprocess.check_output(docker+['exec','-i','mapflow-laptop-postgres','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','mapflow','-d','mapflow'],input=sql.encode()))
if database['migration']!=30 or database['activeDisplays']>1 or database['previous003CreditEntries']!=1:
    raise RuntimeError('migration, queue invariant or existing credit check failed')
if database['wechatQr']!='00000000-0000-0000-0000-000000000005' or database['alipayQr']!='00000000-0000-0000-0000-000000000004':
    raise RuntimeError('payment QR configuration changed')
credentials=json.loads(Path('/home/rong/.local/state/mapflow-vmq/credentials.json').read_text())
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with client.open('http://127.0.0.1:28080/login',urllib.parse.urlencode({'user':credentials['user'],'pass':credentials['pass']}).encode(),timeout=8) as response:
    if json.load(response)['code']!=1: raise RuntimeError('monitor status read failed')
with client.open('http://127.0.0.1:28080/admin/getSettings',timeout=8) as response: settings=json.load(response)['data']
heartbeat=datetime.datetime.fromtimestamp(int(settings['lastheart'])/1000,ZoneInfo('Asia/Shanghai')).isoformat()
report.update({'databaseChecks':database,'monitorState':settings.get('jkstate'),'lastHeartbeat':heartbeat})
(release/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
summary=json.loads(Path('/tmp/mapflow-display-test-summary.json').read_text())
shutil.copy2('/tmp/mapflow-display-test-summary.json',release/'test-summary.json')
shutil.copy2('/tmp/mapflow-display-complete-tests.log',release/'backend-tests.log')
shutil.copy2('/tmp/mapflow-display-queue-release.py',release/'release.py')
shutil.copy2('/tmp/mapflow-payment-release.py',release/'base-release.py')
shutil.copy2('/tmp/mapflow-queue-full-check.py',release/'backend-check.py')
index=root/'OPERATIONS.md'
heading='> 20 秒充值展示队列已发布（2026-10-06）'
if not index.read_text().startswith(heading):
    introduction=heading+'：当前镜像 `'+report['image']+'`，数据库迁移 0030。微信/支付宝共用 FIFO 队列，单次展示 20 秒；付款归属仍以指定金额匹配，展示超时不取消原 5 分钟订单。后端源码 `D:\\mapflow-server-payment-queue` / `/home/rong/project/mapflow/mapflow-server-payment-queue`，分支 `codex/payment-display-queue-20261006`；前端 `D:\\MapFlow-payment-listener`。注册 `f60293e` / `a8d393d` 保留。当前记录 `releases/20261006-payment-display-queue/DEPLOYMENT.md`，验证与备份同目录。后端 '+str(summary['passed'])+' 用例全部通过；前端 467 通过、1 跳过。已核实的 0.03 元仍只有一条充值流水。下文是历史记录，当前部署以本段为准；不要使用旧阿里云 CI。\n\n'
    index.write_text(introduction+index.read_text())
first_line, remaining_index=index.read_text().split('\n',1)
index.write_text(first_line.replace(chr(92)*2,chr(92))+'\n'+remaining_index)
print(json.dumps({'image':report['image'],'binarySha256':report['binarySha256'],'database':database,'monitorState':report['monitorState'],'lastHeartbeat':heartbeat,'backendTests':summary},ensure_ascii=False))
