"""Release gate for the browser source distribution: import map, syntax and regression tests."""
from pathlib import Path
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
modules = sorted((root / 'modules').rglob('*.js'))
html = (root / 'index.html').read_text(encoding='utf-8')
match = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
assert match, 'Missing browser import map'
imports = json.loads(match.group(1))['imports']
mapped = {root / value.split('?', 1)[0].removeprefix('./') for value in imports.values()}
assert mapped == set(modules), 'Import map and published module tree differ (run tools/build_importmap.py)'
assert all(value.startswith('./modules/') for value in imports.values()), 'Import map must use relative source paths'
for module in modules:
    subprocess.run(['node', '--check', str(module)], check=True, cwd=root)
for test in sorted((root / 'tests').glob('*-regression.mjs')):
    subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/' + test.name], check=True, cwd=root)
print(f'Validated {len(modules)} modules and the regression suite.')
