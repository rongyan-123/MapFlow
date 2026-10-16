import copy
import unittest
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('material_theme_release_checks',Path(__file__).parents[1]/'material_theme_release_checks.py')
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)
assert_frontend_config=checks.assert_frontend_config
assert_knowledge_config=checks.assert_knowledge_config

class ReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.before = {'environment': {'MODEL_KEY':'unchanged'}, 'labels': {'org.opencontainers.image.revision':'backend-original','com.mapflow.frontend.revision':'old','dev.mapflow.frontend.revision':'old'}, 'config': {'User':'10001'}, 'host': {'NetworkMode':'production','Memory':805306368}, 'mounts': [{'Destination':'/data','RW':False}], 'networks': {'production': {'ip':'172.31.66.2'}}}
        self.after=copy.deepcopy(self.before)
        for key in ['com.mapflow.frontend.revision','dev.mapflow.frontend.revision']:
            self.after['labels'][key]='reviewed'

    def test_only_frontend_labels_may_change(self):
        assert_frontend_config(self.before,self.after,'reviewed')

    def test_backend_revision_cannot_change(self):
        self.after['labels']['org.opencontainers.image.revision']='different'
        with self.assertRaises(AssertionError):assert_frontend_config(self.before,self.after,'reviewed')

    def test_environment_cannot_change(self):
        self.after['environment']['MODEL_KEY']='different'
        with self.assertRaises(AssertionError):assert_frontend_config(self.before,self.after,'reviewed')

    def test_both_frontend_labels_required(self):
        self.after['labels']['dev.mapflow.frontend.revision']='old'
        with self.assertRaises(AssertionError):assert_frontend_config(self.before,self.after,'reviewed')

    def test_mounts_cannot_change(self):
        self.after['mounts'][0]['RW']=True
        with self.assertRaises(AssertionError):assert_frontend_config(self.before,self.after,'reviewed')

    def test_knowledge_binding_changes_to_replacement_app_only(self):
        after=copy.deepcopy(self.before);after['host']['NetworkMode']='container:new-app'
        assert_knowledge_config(self.before,after,'new-app','same-image','same-image')

    def test_old_knowledge_namespace_rejected(self):
        with self.assertRaises(AssertionError):assert_knowledge_config(self.before,self.before,'new-app','same-image','same-image')

    def test_knowledge_image_cannot_change(self):
        after=copy.deepcopy(self.before);after['host']['NetworkMode']='container:new-app'
        with self.assertRaises(AssertionError):assert_knowledge_config(self.before,after,'new-app','old-image','new-image')

    def test_knowledge_mounts_cannot_change(self):
        after=copy.deepcopy(self.before);after['host']['NetworkMode']='container:new-app';after['mounts']=[]
        with self.assertRaises(AssertionError):assert_knowledge_config(self.before,after,'new-app','same-image','same-image')

if __name__=='__main__':unittest.main()
