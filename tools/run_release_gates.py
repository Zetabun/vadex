"""Minimal release gate for the browser source distribution."""
from pathlib import Path
import json
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
modules = sorted((root / 'modules').rglob('*.js'))
html = (root / 'index.html').read_text(encoding='utf-8')
match = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
assert match, 'Missing browser import map'
imports = json.loads(match.group(1))['imports']
mapped = {root / value.split('?', 1)[0].removeprefix('./') for value in imports.values()}
assert mapped == set(modules), 'Import map and published module tree differ'
assert all(value.startswith('./modules/') for value in imports.values()), 'Import map must use relative source paths'
for module in modules:
    subprocess.run(['node', '--check', str(module)], check=True, cwd=root)
subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/skills-regression.mjs'], check=True, cwd=root)
subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/industry-regression.mjs'], check=True, cwd=root)
subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/ui-progression-regression.mjs'], check=True, cwd=root)
subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/defence-regression.mjs'], check=True, cwd=root)
print(f'Validated {len(modules)} modules, skills, industry, UI and defence regression tests.')
