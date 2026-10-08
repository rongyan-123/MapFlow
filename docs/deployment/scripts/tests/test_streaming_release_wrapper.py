import ast, unittest
from pathlib import Path, PurePosixPath
from types import SimpleNamespace
source=Path(__file__).resolve().parents[1] / '2026-10-08-streaming-output-release.py'
class ReleaseWrapperTests(unittest.TestCase):
    def test_clone_replaces_inherited_journal_mount_without_touching_secrets(self):
        run_node=next(node for node in ast.parse(source.read_text(encoding='utf-8')).body if isinstance(node,ast.FunctionDef) and node.name=='run')
        calls=[]
        base=SimpleNamespace(stage_app='clone-app',image='new-image',release=PurePosixPath('/safe/clone'))
        namespace={'base':base,'original_run':lambda command,**kwargs:calls.append(command)}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[run_node],type_ignores=[])),str(source),'exec'),namespace)
        command=['docker','run','--name','clone-app','--mount','type=bind,src=/prod/journal,dst=/var/lib/mapflow/diagnostics,readonly','--mount','type=bind,src=/safe/clone/database.url,dst=/run/secrets/database.url,readonly','new-image']
        namespace['run'](command)
        mounts=[calls[0][i+1] for i,flag in enumerate(calls[0]) if flag=='--mount']
        journals=[mount for mount in mounts if 'dst=/var/lib/mapflow/diagnostics' in mount]
        self.assertEqual(journals,['type=bind,src=/safe/clone/clone-diagnostics,dst=/var/lib/mapflow/diagnostics'])
        self.assertIn('type=bind,src=/safe/clone/database.url,dst=/run/secrets/database.url,readonly',mounts)
        self.assertIn('type=bind,src=/prod/journal,dst=/var/lib/mapflow/diagnostics,readonly',command)
if __name__=='__main__':unittest.main()
