import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE=Path(__file__).parents[1]/'2026-10-15-full-frontend-release.py'
spec=importlib.util.spec_from_file_location('full_frontend_release',SOURCE)
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class FrontendReleaseGuards(unittest.TestCase):
    def test_accepts_the_exact_reviewed_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'index.html').write_bytes(b'reviewed entry')
            self.assertEqual(release.verify_web_manifest(root,{'index.html':hashlib.sha256(b'reviewed entry').hexdigest()}),1)

    def test_rejects_changed_or_extra_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'index.html').write_bytes(b'reviewed entry')
            expected={'index.html':hashlib.sha256(b'reviewed entry').hexdigest()}
            (root/'private.txt').write_bytes(b'not part of the reviewed bundle')
            with self.assertRaises(AssertionError):release.verify_web_manifest(root,expected)
            (root/'private.txt').unlink();(root/'index.html').write_bytes(b'changed entry')
            with self.assertRaises(AssertionError):release.verify_web_manifest(root,expected)

    def test_rejects_manifest_paths_outside_the_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(AssertionError):release.verify_web_manifest(Path(directory),{'../secret':'0'*64})

    def test_keeps_existing_business_rows_and_migrations(self):
        original={'accounts':{'count':1,'digest':'same'},'_sqlx_migrations':{'count':54,'digest':'same'},'request_observations':{'count':20000,'digest':'before'}}
        current={**original,'request_observations':{'count':19999,'digest':'after'}}
        release.assert_business_unchanged(original,current)
        for name in ['accounts','_sqlx_migrations']:
            with self.assertRaises(AssertionError):release.assert_business_unchanged(original,{**current,name:{'count':1,'digest':'changed'}})

    def test_requires_unchanged_parent_image_layers(self):
        release.assert_runtime_layers(['server','worker'],['server','worker','new frontend'])
        with self.assertRaises(AssertionError):release.assert_runtime_layers(['server','worker'],['changed server','worker','new frontend'])

    def test_only_allows_durable_unowned_reconciliation_to_survive_restart(self):
        pending={'execution_id':'pending','state':'awaiting_reconciliation','owner_id':None,'lease_expires_at':None,'reason':'external_outcome_unknown','unknown_calls':1,'dispatched_calls':0}
        release.assert_executions_quiescent([pending])
        for change in [{'state':'running'},{'state':'queued'},{'owner_id':'worker'},{'lease_expires_at':'2026-10-15T00:00:00Z'},{'unknown_calls':0},{'dispatched_calls':1},{'reason':'unexpected'}]:
            with self.subTest(change=change),self.assertRaises(AssertionError):
                release.assert_executions_quiescent([{**pending,**change}])

    def test_checks_history_with_the_read_route_and_preserves_deletion_replay_contract(self):
        conversations={};deleted_requests=set();history_states=[]
        def backend(container,method,path,body=None,cookie=None,csrf=None):
            if method=='GET' and path=='/api/me/tavern/conversations?scene=management':
                state='has_active' if conversations else 'cleared' if deleted_requests else 'never_created'
                history_states.append(state)
                return 200,{'bootstrapState':state,'conversations':list(conversations.values())},None
            if method=='POST' and path=='/api/me/tavern/management-conversations':
                request_id=body['clientRequestId']
                if request_id in deleted_requests:return 410,{},None
                conversations[request_id]={'conversationId':request_id}
                return 200,{'conversation':conversations[request_id]},None
            if method=='DELETE' and path.startswith('/api/me/tavern/conversations/'):
                request_id=path.rsplit('/',1)[1];conversations.pop(request_id);deleted_requests.add(request_id)
                return 204,None,None
            return 405,{},None
        with patch.object(release,'api',side_effect=backend):
            release.check_management_lifecycle('clone','cookie','csrf')
        self.assertEqual(history_states,['never_created','has_active','cleared'])
        self.assertEqual(len(conversations),1)
        self.assertEqual(len(deleted_requests),1)

if __name__=='__main__':unittest.main()
