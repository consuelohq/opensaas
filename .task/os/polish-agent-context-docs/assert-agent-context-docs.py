import json
from pathlib import Path

expected_pages = ['os/agent-context/steering', 'os/agent-context/decision', 'os/agent-context/tools', 'os/agent-context/scripts']
expected_titles = {'steering': 'steering.md', 'decision': 'decision.md', 'tools': 'tools.md', 'scripts': 'scripts.md'}
old_routes = {
    '/os/tools/default-steering': '/os/agent-context/steering',
    '/os/tools/decision-engine': '/os/agent-context/decision',
    '/os/tools/tool-manifest': '/os/agent-context/tools',
    '/os/tools/scripts': '/os/agent-context/scripts',
}

docs_root = Path('packages/consuelo-docs')
data = json.load(open(docs_root / 'docs.json'))
for language in data['navigation']['languages']:
    code = language['language']
    os_tab = next(tab for tab in language['tabs'] if tab.get('tab') == 'OS')
    group = next((item for item in os_tab['groups'] if item.get('group') == 'Agent Context'), None)
    assert group is not None, code
    prefix = '' if code == 'en' else 'l/' + code + '/'
    assert group.get('pages') == [prefix + page for page in expected_pages], (code, group.get('pages'))

for slug, title in expected_titles.items():
    page = docs_root / 'os' / 'agent-context' / (slug + '.mdx')
    assert page.exists(), page
    text = page.read_text()
    frontmatter = text.split('---', 2)[1]
    body = text.split('---', 2)[2]
    visible = [line for line in body.splitlines() if line.strip() and not line.startswith('{/*')]
    assert 'title: "' + title + '"' in frontmatter, page
    assert 'Generated documentation for' not in text, page
    assert visible and not visible[0].startswith('Source:'), page

pairs = set()
for redirect in data.get('redirects', []):
    if isinstance(redirect, dict):
        pairs.add((redirect.get('source'), redirect.get('destination')))
for source, destination in old_routes.items():
    assert (source, destination) in pairs, (source, destination)

print('agent context docs nav, pages, titles, body, and redirects present')
