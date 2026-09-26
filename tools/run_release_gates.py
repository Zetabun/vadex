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
# Every release keeps a save made by that build (tests/saves, made by tools/save_fixture.mjs), and the save regression
# loads them all, so no later build can stop an older save loading. Preview builds (2.19.0-p1) don't need one.
version = re.search(r'\?v=([^"]+)"', match.group(1)).group(1)
if re.fullmatch(r'\d+\.\d+\.\d+', version):
    assert (root / 'tests' / 'saves' / f'v{version}.json').is_file(), f'No kept save for v{version}: run node --experimental-loader ./tests/loader.mjs tools/save_fixture.mjs'
for module in modules:
    subprocess.run(['node', '--check', str(module)], check=True, cwd=root)
# A trailing // comment whose text reads like code has almost always swallowed code by accident (a comment inserted
# mid-line): the page loads but part of that line silently never runs.
CODE = re.compile(r"\);|\) \{|\bconst \w+ =|\bif \(|\bfor \(|=> |\bthis\.\w+\(|\} else")
swallowed = []
for module in modules:
    for n, line in enumerate(module.read_text(encoding='utf-8').splitlines(), 1):
        k = 0
        while (k := line.find('//', k)) >= 0:
            before = line[:k]
            if before.count("'") % 2 or before.count('`') % 2 or before.count('"') % 2 or before.endswith(':'):
                k += 2
                continue
            if before.strip() and CODE.search(line[k + 2:]):
                swallowed.append(f'{module.relative_to(root)}:{n}')
            break
assert not swallowed, 'Code hidden behind a // comment (use /* */ mid-line): ' + ', '.join(swallowed)
for test in sorted((root / 'tests').glob('*-regression.mjs')):
    subprocess.run(['node', '--experimental-loader', './tests/loader.mjs', './tests/' + test.name], check=True, cwd=root)
print(f'Validated {len(modules)} modules and the regression suite.')
