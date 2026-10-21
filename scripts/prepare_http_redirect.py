"""Prepare a separate FRP HTTP route; never start it or edit the live tunnel."""
import argparse
import json
import os
import tomllib
from pathlib import Path


def render_table(values, prefix=()):
    lines = []
    for key, value in values.items():
        if not isinstance(value, dict):
            lines.append(f'{json.dumps(key)} = {json.dumps(value, ensure_ascii=True)}')
    for key, value in values.items():
        if isinstance(value, dict):
            nested = (*prefix, key)
            lines.extend(['', '[' + '.'.join(json.dumps(part) for part in nested) + ']'])
            lines.extend(render_table(value, nested))
    return lines


def prepare(source: Path, output: Path, proxy_name: str):
    original = tomllib.loads(source.read_text(encoding='utf-8'))
    if not isinstance(original.get('serverAddr'), str) or not isinstance(original.get('serverPort'), int):
        raise ValueError('Source must contain the current FRP server address and port.')
    # A separate client must not reuse the existing client's management listener.
    common = {key: original[key] for key in ['serverAddr', 'serverPort', 'user', 'auth', 'transport'] if key in original}
    common['loginFailExit'] = True
    proxy = {'name': proxy_name, 'type': 'http', 'localIP': '127.0.0.1',
             'localPort': 18090, 'customDomains': ['xxian.fun'],
             'transport': {'useEncryption': True, 'useCompression': True}}
    # Port 18090 expects HTTP, not the PROXY v2 header required by HTTPS port 18443.
    content = '\n'.join([*render_table(common), '', '[[proxies]]', *render_table(proxy, ('proxies',)), ''])
    parsed = tomllib.loads(content)
    if parsed.get('proxies') != [proxy]:
        raise ValueError('The candidate does not describe exactly one HTTP route.')
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
        stream.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--proxy-name', required=True, help='Exact tunnel name assigned by the provider; do not rename it.')
    arguments = parser.parse_args()
    prepare(arguments.source, arguments.output, arguments.proxy_name)
    print(f'Prepared {arguments.output}; no service was started and the original configuration is unchanged.')


if __name__ == '__main__':
    main()
