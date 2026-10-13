import ast
from pathlib import Path
import unittest

script=Path(__file__).with_name('2026-10-13-chat-ui-release.py')
parsed=ast.parse(script.read_text(encoding='utf-8'))
node=next(n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='verify_observation_retention')
namespace={}
exec(compile(ast.Module(body=[node],type_ignores=[]),str(script),'exec'),namespace)
verify=namespace['verify_observation_retention']

class ObservationRetention(unittest.TestCase):
    def test_surviving_records_and_new_probes(self):
        verify({'a':'1','b':'2'},{'a':'1','b':'2','new':'3'},['a','b'],3)
    def test_original_hard_cap_removes_oldest_only(self):
        retention_report=verify({'a':'1','b':'2','c':'3','d':'4'},{'b':'2','c':'3','d':'4'},['a','b','c','d'],3)
        self.assertEqual(retention_report['policyRemovedRows'],1)
    def test_changed_surviving_content_is_rejected(self):
        with self.assertRaises(AssertionError):verify({'a':'1','b':'2'},{'a':'wrong','b':'2'},['a','b'],2)
    def test_missing_middle_record_is_rejected(self):
        with self.assertRaises(AssertionError):verify({'a':'1','b':'2','c':'3','d':'4'},{'a':'1','c':'3','d':'4'},['a','b','c','d'],3)
    def test_deletion_without_cap_pressure_is_rejected(self):
        with self.assertRaises(AssertionError):verify({'a':'1','b':'2'},{'b':'2'},['a','b'],3)
    def test_excessive_deletion_is_rejected(self):
        with self.assertRaises(AssertionError):verify({'a':'1','b':'2','c':'3','d':'4'},{'d':'4'},['a','b','c','d'],3)
    def test_expired_failure_can_be_removed_outside_cap_order(self):
        retention_report=verify({'a':'1','b':'2','c':'3','old_failure':'4'},{'a':'1','b':'2','c':'3'},['a','b','c','old_failure'],3,{'old_failure'})
        self.assertEqual(retention_report['ageRemovedRows'],1)
    def test_age_retention_can_reduce_rows_below_cap(self):
        verify({'a':'1','old':'2'},{'a':'1'},['a','old'],3,{'old'})
    def test_age_allowance_never_permits_changed_retained_rows(self):
        with self.assertRaises(AssertionError):verify({'a':'1','old':'2'},{'a':'changed'},['a','old'],3,{'old'})
    def test_age_allowance_does_not_permit_missing_middle_fresh_row(self):
        with self.assertRaises(AssertionError):verify({'a':'1','b':'2','c':'3','old':'4'},{'a':'1','c':'3'},['a','b','c','old'],2,{'old'})

if __name__=='__main__':unittest.main(verbosity=2)
