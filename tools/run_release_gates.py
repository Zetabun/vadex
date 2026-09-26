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
    # Patch notes and docs are written before a release goes out (AGENTS.md, "Before every push").
    notes = (root / 'CHANGELOG.md').read_text(encoding='utf-8')
    assert re.search(rf'^## v{re.escape(version)} — \d{{4}}-\d{{2}}-\d{{2}}', notes, re.M), f'CHANGELOG.md has no dated "## v{version} — YYYY-MM-DD" entry: write the patch notes before pushing'
    assert f'{{"v":"{version}"' in (root / 'modules' / 'data' / 'updates.js').read_text(encoding='utf-8'), f'The Updates tab lacks v{version}: run tools/build_importmap.py {version}'
    assert f'Current build: **v{version}**' in (root / 'AGENTS.md').read_text(encoding='utf-8'), f'AGENTS.md: set "Current build" to v{version}'
    assert f'Current build: **v{version}**' in (root / 'README.md').read_text(encoding='utf-8'), f'README.md: set "Current build" to v{version}'
    assert f'v{version}' in (root / 'BUILD_NOTES.md').read_text(encoding='utf-8').splitlines()[0], f'BUILD_NOTES.md: set its heading to v{version}'
for module in modules:
    subprocess.run(['node', '--check', str(module)], check=True, cwd=root)
# The Updates tab (modules/data/updates.js) must carry the changelog's newest release (tools/build_importmap.py rebuilds it),
# and never name a file: it is for players.
_upd = (root / 'modules' / 'data' / 'updates.js').read_text(encoding='utf-8')
_files = re.findall(r'[\w/-]+\.(?:md|js|mjs|py|json|sql|toml)\b|\b(?:modules|rendering|progression|combat|core|api)/[\w./-]+', _upd[_upd.index('['):])
assert not _files, 'The Updates tab names files (tools/build_updates.py should leave those lines out): ' + ', '.join(sorted(set(_files))[:8])
newest = re.search(r'^## v(\d+\.\d+\.\d+)', (root / 'CHANGELOG.md').read_text(encoding='utf-8'), re.M).group(1)
assert f"{{\"v\":\"{newest}\"" in (root / 'modules' / 'data' / 'updates.js').read_text(encoding='utf-8'), f'The Updates tab lacks v{newest}: run tools/build_importmap.py'
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
