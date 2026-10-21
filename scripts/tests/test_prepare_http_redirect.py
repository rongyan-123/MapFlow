import importlib.util
import subprocess
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'prepare_http_redirect.py'


class HttpRedirectPreparationTests(unittest.TestCase):
    def test_creates_only_http_route_without_modifying_existing_https_or_ssh(self):
        spec = importlib.util.spec_from_file_location('http_redirect', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        original = '''serverAddr = "relay.example.test"
serverPort = 1210
user = "private-test-identity"
[auth]
method = "token"
token = "private-test-token"
[webServer]
port = 7400
[[proxies]]
name = "original-https"
type = "https"
localPort = 18443
customDomains = ["xxian.fun"]
[proxies.transport]
proxyProtocolVersion = "v2"
'''
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'original.toml'
            output = Path(directory) / 'candidate.toml'
            source.write_text(original, encoding='utf-8')
            module.prepare(source, output, 'provider-assigned-route-7')
            parsed = tomllib.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(source.read_text(encoding='utf-8'), original)
            self.assertEqual(parsed['user'], 'private-test-identity')
            self.assertEqual(parsed['auth']['token'], 'private-test-token')
            self.assertNotIn('webServer', parsed)
            self.assertEqual(parsed['proxies'], [{
                'name': 'provider-assigned-route-7', 'type': 'http', 'localIP': '127.0.0.1',
                'localPort': 18090, 'customDomains': ['xxian.fun'],
                'transport': {'useEncryption': True, 'useCompression': True},
            }])
            with self.assertRaises(FileExistsError):
                module.prepare(source, output, 'provider-assigned-route-7')

    def test_cli_requires_the_provider_assigned_name_before_writing_a_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'original.toml'
            output = Path(directory) / 'candidate.toml'
            source.write_text('serverAddr = "relay.example.test"\nserverPort = 1210\n', encoding='utf-8')
            process = subprocess.run([sys.executable, str(SCRIPT), '--source', str(source),
                                      '--output', str(output)], capture_output=True, text=True)
            self.assertNotEqual(process.returncode, 0)
            self.assertIn('--proxy-name', process.stderr)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
