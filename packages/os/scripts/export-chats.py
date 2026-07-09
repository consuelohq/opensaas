"""export kiro + opencode chat sessions to supabase with configurable nvidia embeddings.

usage:
  python3 export-chats.py              # export new sessions only
  python3 export-chats.py --seed       # seed all existing sessions
  python3 export-chats.py --dry-run    # preview without uploading
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CHUNK_SIZE = 400
CHUNK_OVERLAP = 60
BATCH_SIZE = 20
DEFAULT_EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'nvidia/nv-embedqa-e5-v5')


def load_env_file() -> None:
    env_file = os.environ.get('OPENWORKSPACE_ENV_FILE')
    if env_file is None:
        env_file = str(Path(__file__).resolve().parents[1] / '.env')
    path = Path(env_file)
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' not in line or line.lstrip().startswith('#'):
            continue
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip(), value.strip().strip('"'))


load_env_file()

KIRO_DIR = Path(os.environ.get('CHAT_EXPORT_KIRO_DIR', str(Path.home() / '.kiro/exports/sessions')))
OPENCODE_DIR = Path(os.environ.get('CHAT_EXPORT_OPENCODE_DIR', str(Path.home() / '.kiro/exports/opencode')))
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY', '')
NVIDIA_KEY = os.environ.get('NVIDIA_API_KEY', '')
NVIDIA_MODEL = os.environ.get('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL)


def chunk_text(text, chunk_chars=1600, overlap_chars=240):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_chars
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap_chars
    return chunks


def get_embeddings(texts):
    body = json.dumps(
        {
            'input': texts,
            'model': NVIDIA_MODEL,
            'input_type': 'passage',
            'encoding_format': 'float',
        }
    ).encode()
    req = urllib.request.Request(
        'https://integrate.api.nvidia.com/v1/embeddings',
        data=body,
        headers={
            'Authorization': f'Bearer {NVIDIA_KEY}',
            'Content-Type': 'application/json',
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return [item['embedding'] for item in data['data']]


def supabase_request(method, path, data=None, params=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {'error': f"{exc.code} {exc.read().decode()[:300]}"}


def content_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def get_existing_hashes():
    result = supabase_request(
        'GET',
        'memories',
        params={
            'select': 'tags',
            'category': 'in.(kiro-session,opencode-session)',
            'status': 'eq.active',
            'limit': '10000',
        },
    )
    if isinstance(result, dict) and 'error' in result:
        print(f"  warning: couldn't fetch existing hashes: {result['error']}")
        return set()
    return {record.get('tags', '') for record in result if record.get('tags')}


def export_sessions(session_dir, category, dry_run=False, seed=False):
    if not session_dir.exists():
        print(f'  {session_dir} not found, skipping')
        return 0, 0, 0

    files = sorted(session_dir.glob('*.md'))
    print(f'  found {len(files)} files in {session_dir.name}')

    existing = get_existing_hashes() if not seed else set()
    print(f'  {len(existing)} existing chunks in supabase')

    total_chunks = 0
    total_embedded = 0
    skipped = 0

    for index, file_path in enumerate(files):
        text = file_path.read_text(encoding='utf-8').strip()
        if not text or len(text) < 50:
            continue

        lines = text.split('\n')
        title = lines[0].lstrip('# ').strip() if lines else file_path.stem
        chunks = chunk_text(text)
        batch_texts = []
        batch_records = []

        for chunk_index, chunk in enumerate(chunks):
            chunk_hash = content_hash(chunk)
            tag = f'hash:{chunk_hash}'
            if tag in existing:
                skipped += 1
                continue
            record = {
                'title': f'{title} (chunk {chunk_index + 1}/{len(chunks)})' if len(chunks) > 1 else title,
                'content': chunk,
                'category': category,
                'source': file_path.name,
                'status': 'active',
                'priority': 'normal',
                'agent_id': 'export-script',
                'tags': tag,
            }
            batch_texts.append(chunk[:2000])
            batch_records.append(record)
            total_chunks += 1

        if not batch_records:
            continue

        if dry_run:
            print(f'  [{index + 1}/{len(files)}] {file_path.name}: {len(batch_records)} new chunks')
            continue

        for batch_start in range(0, len(batch_records), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(batch_records))
            texts = batch_texts[batch_start:batch_end]
            records = batch_records[batch_start:batch_end]
            try:
                embeddings = get_embeddings(texts)
                for record, embedding in zip(records, embeddings):
                    record['embedding'] = str(embedding)
                result = supabase_request('POST', 'memories', data=records)
                if isinstance(result, dict) and 'error' in result:
                    print(f"  error uploading {file_path.name}: {result['error']}")
                else:
                    total_embedded += len(records)
            except Exception as exc:
                print(f'  error on {file_path.name} batch {batch_start}: {exc}')
            if batch_end < len(batch_records):
                time.sleep(0.5)

    return total_chunks, total_embedded, skipped


def sync_skills(dry_run=False):
    skill_dir = Path(os.environ.get('SKILL_DIR', str(Path.home() / '.kiro/skills')))
    if not skill_dir.exists():
        print('  no skills directory found')
        return 0

    files = sorted(skill_dir.glob('*/SKILL.md'))
    print(f'  found {len(files)} skills')

    uploaded = 0
    for file_path in files:
        name = file_path.parent.name
        text = file_path.read_text(encoding='utf-8').strip()
        if not text:
            continue
        existing = supabase_request(
            'GET',
            'memories',
            params={
                'category': 'eq.skill',
                'title': f'eq.{name}',
                'status': 'eq.active',
                'select': 'id,content',
            },
        )
        if isinstance(existing, list) and existing:
            if existing[0].get('content', '').strip() == text:
                continue
            if not dry_run:
                record_id = existing[0]['id']
                supabase_request('PATCH', f'memories?id=eq.{record_id}', data={'content': text})
            uploaded += 1
        else:
            if not dry_run:
                supabase_request(
                    'POST',
                    'memories',
                    data=[
                        {
                            'title': name,
                            'content': text[:50000],
                            'category': 'skill',
                            'source': 'skill-sync',
                            'status': 'active',
                            'priority': 'normal',
                            'agent_id': 'export-script',
                            'tags': f'skill:{name}',
                        }
                    ],
                )
            uploaded += 1
    return uploaded


def main():
    dry_run = '--dry-run' in sys.argv
    seed = '--seed' in sys.argv

    print(f"chat export {'(dry run)' if dry_run else '(live)'} {'(seed mode)' if seed else ''}")
    print(f'nvidia model: {NVIDIA_MODEL}')
    print()

    print('kiro sessions:')
    kiro_chunks, kiro_embedded, kiro_skipped = export_sessions(KIRO_DIR, 'kiro-session', dry_run, seed)
    print(f'  total: {kiro_chunks} chunks, {kiro_embedded} embedded, {kiro_skipped} skipped')

    print('\nopencode sessions:')
    opencode_chunks, opencode_embedded, opencode_skipped = export_sessions(
        OPENCODE_DIR,
        'opencode-session',
        dry_run,
        seed,
    )
    print(f'  total: {opencode_chunks} chunks, {opencode_embedded} embedded, {opencode_skipped} skipped')

    print('\nskills:')
    skills_uploaded = sync_skills(dry_run)
    print(f'  {skills_uploaded} skills synced')


if __name__ == '__main__':
    main()
