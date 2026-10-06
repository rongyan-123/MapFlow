"""One-off authorized reconciliation of the user's confirmed 20:41 WeChat payment.

Run as root on the laptop. Verifies the receipt, rehearses with ROLLBACK,
closes the unmatched reservation, and posts the actual amount exactly once.
"""
from datetime import datetime
from pathlib import Path
import hashlib, http.cookiejar, json, subprocess, urllib.parse, urllib.request

topup_id = '01a1113b-7b6e-7573-bc10-d89d284b93ee'
order_id = '202610062041132452'
receipt_reference = 'vmq-unmatched:5:20261006204129'
credentials = json.loads(Path('/home/rong/.local/state/mapflow-vmq/credentials.json').read_text())
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path, values=None):
    with client.open('http://127.0.0.1:28080'+path,
                    urllib.parse.urlencode(values).encode() if values else None,timeout=8) as response:
        return json.load(response)
assert api('/login', {'user':credentials['user'],'pass':credentials['pass']})['code'] == 1
receipts = api('/admin/getOrders?page=1&limit=100')['data']
receipt = next(entry for entry in receipts if entry['id'] == 5)
assert receipt['type'] == 1 and receipt['state'] == 3 and receipt['reallyPrice'] == 0.03
assert receipt['payDate'] == int(datetime.fromisoformat('2026-10-06T20:41:28.963+08:00').timestamp()*1000)
reservation = api('/getOrder?'+urllib.parse.urlencode({'orderId':order_id}))['data']
assert reservation['payId'] == topup_id and reservation['payType'] == 1
assert reservation['price'] == 0.03 and reservation['reallyPrice'] == 0.04
assert reservation['state'] in (0,-1)
admin_name = (Path('/opt/mapflow-laptop-migration-20261006/runtime/secrets/admin-username').read_text().strip())
quoted_admin = "'"+admin_name.replace("'","''")+"'"
note = '微信实收0.03元；用户确认归属，人工核实入账。原分配0.04元已关闭，Vmq收款记录5。'
sql = """BEGIN;
DO $$ DECLARE owner_id uuid; actor_id uuid; current_order wallet_topups%%ROWTYPE; balance bigint;
BEGIN
SELECT account_id INTO STRICT owner_id FROM wallet_topups WHERE topup_id='%s';
PERFORM 1 FROM wallet_accounts WHERE account_id=owner_id FOR UPDATE;
SELECT * INTO STRICT current_order FROM wallet_topups WHERE topup_id='%s' FOR UPDATE;
IF current_order.status='credited' AND current_order.receipt_reference='%s' THEN
  IF (SELECT count(*) FROM wallet_ledger WHERE topup_id=current_order.topup_id AND kind='topup' AND amount_micros=30000)<>1
  THEN RAISE EXCEPTION 'existing reconciliation ledger inconsistent'; END IF;
  RETURN;
END IF;
IF current_order.status NOT IN ('awaiting_payment','awaiting_review') OR current_order.channel<>'wechat'
 OR current_order.amount_fen<>3 OR current_order.payment_amount_fen<>4 OR current_order.vmq_order_id<>'%s'
THEN RAISE EXCEPTION 'order changed, manual reconciliation aborted'; END IF;
SELECT account_id INTO STRICT actor_id FROM accounts
WHERE (username_display=%s OR username_key=lower(%s)) AND status='active';
UPDATE wallet_topups SET status='credited',payment_amount_fen=3,receipt_reference='%s',
review_note='%s',reviewed_by=actor_id,updated_at=clock_timestamp() WHERE topup_id=current_order.topup_id;
UPDATE wallet_accounts SET balance_micros=balance_micros+30000 WHERE account_id=owner_id RETURNING balance_micros INTO balance;
INSERT INTO wallet_ledger(entry_id,account_id,kind,amount_micros,balance_after_micros,topup_id,actor_id,note)
VALUES(gen_random_uuid(),owner_id,'topup',30000,balance,current_order.topup_id,actor_id,'%s');
INSERT INTO wallet_topup_events(event_id,topup_id,actor_id,kind)
VALUES(gen_random_uuid(),current_order.topup_id,actor_id,'approved');
INSERT INTO identity_audit_events(event_id,event_type,account_id,outcome,details)
VALUES(gen_random_uuid(),'wallet.topup_approved',owner_id,'succeeded',
jsonb_build_object('topupId',current_order.topup_id,'actorId',actor_id,'amountFen',3,
'originalAllocatedFen',4,'receiptReference','%s','vmqReceiptId',5,'vmqPaidAtMillis',%s,
'reconciliation','user explicitly confirmed real receipt in chat; credited actual amount'));
END $$;
SELECT status,payment_amount_fen,receipt_reference,
(SELECT count(*) FROM wallet_ledger WHERE topup_id=t.topup_id AND kind='topup') AS credit_count,
(SELECT balance_micros FROM wallet_accounts WHERE account_id=t.account_id) AS balance_micros
FROM wallet_topups t WHERE topup_id='%s';
""" % (topup_id,topup_id,receipt_reference,order_id,quoted_admin,quoted_admin,
        receipt_reference,note,note,receipt_reference,receipt['payDate'],topup_id)
def execute(ending):
    completed = subprocess.run(['docker','-H','unix:///var/run/docker.sock','exec','-i',
        'mapflow-laptop-postgres','psql','-v','ON_ERROR_STOP=1','-U','mapflow','-d','mapflow','-P','pager=off'],
        input=(sql+ending+';\n').encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if completed.returncode:
        raise RuntimeError('guarded reconciliation transaction failed')
    print(completed.stdout.decode())
execute('ROLLBACK')
if reservation['state'] == 0:
    sign = hashlib.md5((order_id+credentials['key']).encode()).hexdigest()
    assert api('/closeOrder?'+urllib.parse.urlencode({'orderId':order_id,'sign':sign}))['code'] == 1
assert api('/getOrder?'+urllib.parse.urlencode({'orderId':order_id}))['data']['state'] == -1
execute('COMMIT')
execute('COMMIT')  # Verify replay does not create another credit.
