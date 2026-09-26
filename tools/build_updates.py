"""Turn CHANGELOG.md into modules/data/updates.js: every update so far, for the game's Settings > Updates tab.

Run by tools/build_importmap.py at every release (so the tab can never fall behind the changelog); run it on its own
to preview. Each '## vX.Y.Z — date' heading is one update: its intro paragraph, its bullets (and their sub-bullets),
and a headline made of the first few **bold** lead-ins. Lines for developers (tests, tools, save schemas, the import
map, bots) are left out: write the changelog for players, and keep such notes in their own bullets.
"""
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
DEV = re.compile(r'\btests?/|\.mjs\b|regression|release (check|gate)|kept save|import map|\bschema\b|tools/|headless|\bbots?\b|ES modules|debug scene', re.I)


def clean(s):
    return re.sub(r'`([^`]*)`', r'\1', s).strip()


def headline(items, intro):
    leads = []
    for it in items:
        m = re.match(r'\*\*(.+?)\*\*', it['t'])
        if m:
            lead = m.group(1).rstrip('.:').strip()
            if len(lead) > 30:
                lead = re.sub(r'\s*\(.*?\)', '', lead)  # a long lead-in loses its aside
            if len(lead) > 46:
                lead = lead[:44].rsplit(' ', 1)[0].rstrip(',;:') + '…'
            if lead not in leads:
                leads.append(lead)
    if leads:
        return ' · '.join(leads[:3])
    text = re.sub(r'\*\*', '', intro or (items[0]['t'] if items else ''))
    return text if len(text) <= 72 else text[:70].rsplit(' ', 1)[0] + '…'


def parse(md):
    updates, cur = [], None
    for line in md.splitlines():
        if line.startswith('## '):
            m = re.search(r'v(\d+\.\d+\.\d+)', line)
            if not m:
                cur = None
                continue
            d = re.search(r'(\d{4}-\d{2}-\d{2})', line)
            cur = {'v': m.group(1), 'date': d.group(1) if d else '', 'intro': '', 'items': []}
            updates.append(cur)
            continue
        if cur is None or not line.strip():
            continue
        sub = re.match(r'^\s{2,}[-*] (.*)', line)
        top = re.match(r'^[-*] (.*)', line)
        if top:
            text = clean(top.group(1))
            cur['items'].append({'t': text, 'sub': [], 'dev': bool(DEV.search(text))})
        elif sub and cur['items']:
            text = clean(sub.group(1))
            if not DEV.search(text):
                cur['items'][-1]['sub'].append(text)
        elif not cur['items']:
            cur['intro'] = (cur['intro'] + ' ' + clean(line)).strip()
        else:  # a paragraph after the bullets: its own item
            text = clean(line)
            cur['items'].append({'t': text, 'sub': [], 'dev': bool(DEV.search(text))})
    out, newer = [], ''
    for u in updates:  # an update with no date went out with the next one that has one
        if u['date']:
            newer = u['v']
        else:
            u['with'] = newer
        items = [{'t': it['t'], **({'sub': it['sub']} if it['sub'] else {})} for it in u['items'] if not it['dev']]
        if not items and not u['intro']:
            continue
        out.append({'v': u['v'], 'date': u['date'], **({'with': u['with']} if u.get('with') else {}), 'head': headline(items, u['intro']), **({'intro': u['intro']} if u['intro'] else {}), 'items': items})
    return out


def build():
    updates = parse((root / 'CHANGELOG.md').read_text(encoding='utf-8'))
    body = ',\n'.join('  ' + json.dumps(u, ensure_ascii=False, separators=(',', ':')) for u in updates)
    js = ("// What's new: every update so far, newest first, for Settings > Updates (ui/overlays.js). GENERATED from\n"
          "// CHANGELOG.md by tools/build_updates.py (tools/build_importmap.py runs it at every release): edit the changelog, not\n"
          "// this file. v: version, date: released (empty when it went out with the next one), head: a headline, intro: its\n"
          "// opening paragraph, items: its bullets (t, with sub-bullets in sub). **bold** marks the lead-ins.\n"
          f"export const UPDATES = [\n{body},\n];\n")
    (root / 'modules' / 'data' / 'updates.js').write_text(js, encoding='utf-8')
    return updates


if __name__ == '__main__':
    got = build()
    print(f'Updates: {len(got)} releases, newest v{got[0]["v"]}')
