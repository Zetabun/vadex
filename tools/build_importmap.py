"""Regenerate the import map in index.html from the modules/ tree, stamped with the release version."""
from pathlib import Path
import json, re, sys

root = Path(__file__).resolve().parents[1]
version = sys.argv[1] if len(sys.argv) > 1 else None
html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')
if not version:
    m = re.search(r'\?v=([0-9.]+)', html)
    version = m.group(1) if m else '2.0.0'
imports = {}
for f in sorted((root / 'modules').rglob('*.js')):
    rel = f.relative_to(root / 'modules').as_posix()
    imports['@last-orbit/' + rel] = f'./modules/{rel}?v={version}'
block = '<script type="importmap">' + json.dumps({'imports': imports}, separators=(',', ':')) + '</script>'
html, n = re.subn(r'<script type="importmap">.*?</script>', lambda _: block, html, flags=re.S)
assert n == 1, 'index.html must contain exactly one import map'
html_path.write_text(html, encoding='utf-8')
print(f'Import map: {len(imports)} modules at v{version}')
