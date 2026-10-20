import importlib.util
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
            module.prepare(source, output)
            parsed = tomllib.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(source.read_text(encoding='utf-8'), original)
            self.assertEqual(parsed['user'], 'private-test-identity')
            self.assertEqual(parsed['auth']['token'], 'private-test-token')
            self.assertNotIn('webServer', parsed)
            self.assertEqual(parsed['proxies'], [{
                'name': 'mapflow-http-redirect', 'type': 'http', 'localIP': '127.0.0.1',
                'localPort': 18090, 'customDomains': ['xxian.fun'],
                'transport': {'useEncryption': True, 'useCompression': True},
            }])
            with self.assertRaises(FileExistsError):
                module.prepare(source, output)


if __name__ == '__main__':
    unittest.main()
