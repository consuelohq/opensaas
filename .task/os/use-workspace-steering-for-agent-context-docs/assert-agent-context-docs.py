import json
from pathlib import Path

docs_root = Path('packages/consuelo-docs')
generator = (docs_root / 'scripts' / 'generate-os-source-docs.ts').read_text()
steering_page = docs_root / 'os' / 'agent-context' / 'steering.mdx'
text = steering_page.read_text()

data = json.load(open(docs_root / 'docs.json'))
os_tab = next(tab for tab in data['navigation']['languages'][0]['tabs'] if tab.get('tab') == 'OS')
agent_context = next((group for group in os_tab['groups'] if group.get('group') == 'Agent Context'), None)
expected_pages = [
    'os/agent-context/steering',
    'os/agent-context/decision',
    'os/agent-context/tools',
    'os/agent-context/scripts',
]
assert agent_context is not None, 'Agent Context nav group missing'
assert agent_context.get('pages') == expected_pages, agent_context.get('pages')
assert "sourcePath: 'packages/workspace/STEERING.md'" in generator, 'steering.md source should be packages/workspace/STEERING.md'
assert 'Generated from packages/workspace/STEERING.md' in text, 'generated notice should name workspace steering source'
assert 'Generated from packages/os/STEERING.md' not in text, 'tiny OS steering source still used'
assert 'you are suelo' in text, 'workspace steering body missing'
assert '## Source document' in text, 'generated docs wrapper should label source document'
assert '| Source file |' in text, 'generated source metadata table missing'
assert 'Consuelo OS is a managed AI operating system for revenue teams.' not in text, 'tiny OS steering body leaked into page'

redirect_pairs = {(r.get('source'), r.get('destination')) for r in data.get('redirects', []) if isinstance(r, dict)}
assert ('/os/tools/default-steering', '/os/agent-context/steering') in redirect_pairs, 'legacy steering redirect missing'
print('agent context steering source and docs wrapper are correct')
