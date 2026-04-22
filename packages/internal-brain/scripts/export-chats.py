"""export kiro + opencode chat sessions to supabase with nvidia embeddings.

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
import urllib.parse
import urllib.request
from pathlib import Path

# --- config ---
KIRO_DIR = Path.home() / ".kiro/exports/sessions"
OPENCODE_DIR = Path.home() / ".kiro/exports/opencode"
CHUNK_SIZE = 400  # tokens (~1600 chars) — nvidia limit is 512 tokens
CHUNK_OVERLAP = 60  # ~15% overlap
BATCH_SIZE = 20  # embeddings per nvidia api call
NVIDIA_MODEL = "nvidia/nv-embedqa-e5-v5"

# --- load secrets ---
def load_env():
    env_path = Path.home() / ".openclaw/workspace/.env"
    env = {}
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip('"')
    return env

def load_nvidia_key():
    cfg = json.loads((Path.home() / ".openclaw/openclaw.json").read_text())
    return cfg["env"]["NVIDIA_API_KEY"]

ENV = load_env()
SUPABASE_URL = ENV["SUPABASE_URL"]
SUPABASE_KEY = ENV["SUPABASE_SERVICE_KEY"]
NVIDIA_KEY = load_nvidia_key()

# --- helpers ---
def chunk_text(text, chunk_chars=1600, overlap_chars=240):
    """split text into overlapping chunks by character count."""
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
    """get embeddings from nvidia api. handles batching."""
    body = json.dumps({
        "input": texts,
        "model": NVIDIA_MODEL,
        "input_type": "passage",
        "encoding_format": "float",
    }).encode()
    req = urllib.request.Request(
        "https://integrate.api.nvidia.com/v1/embeddings",
        data=body,
        headers={
            "Authorization": f"Bearer {NVIDIA_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return [d["embedding"] for d in data["data"]]

def supabase_request(method, path, data=None, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:300]}"}

def content_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]

def get_existing_hashes():
    """get all existing content hashes from supabase to skip duplicates."""
    result = supabase_request("GET", "memories", params={
        "select": "tags",
        "category": "in.(kiro-session,opencode-session)",
        "status": "eq.active",
        "limit": "10000",
    })
    if isinstance(result, dict) and "error" in result:
        print(f"  warning: couldn't fetch existing hashes: {result['error']}")
        return set()
    return {r.get("tags", "") for r in result if r.get("tags")}

# --- main export ---
def export_sessions(session_dir, category, dry_run=False, seed=False):
    if not session_dir.exists():
        print(f"  {session_dir} not found, skipping")
        return 0

    files = sorted(session_dir.glob("*.md"))
    print(f"  found {len(files)} files in {session_dir.name}")

    existing = get_existing_hashes() if not seed else set()
    print(f"  {len(existing)} existing chunks in supabase")

    total_chunks = 0
    total_embedded = 0
    skipped = 0

    for i, f in enumerate(files):
        text = f.read_text().strip()
        if not text or len(text) < 50:
            continue

        # extract metadata from header
        lines = text.split("\n")
        title = lines[0].lstrip("# ").strip() if lines else f.stem
        date = ""
        for line in lines[:6]:
            if line.startswith("date:"):
                date = line.split(":", 1)[1].strip()
                break

        chunks = chunk_text(text)
        batch_texts = []
        batch_records = []

        for ci, chunk in enumerate(chunks):
            h = content_hash(chunk)
            tag = f"hash:{h}"
            if tag in existing:
                skipped += 1
                continue

            record = {
                "title": f"{title} (chunk {ci+1}/{len(chunks)})" if len(chunks) > 1 else title,
                "content": chunk,
                "category": category,
                "source": f.name,
                "status": "active",
                "priority": "normal",
                "agent_id": "export-script",
                "tags": tag,
            }
            batch_texts.append(chunk[:2000])  # nvidia 512 token limit
            batch_records.append(record)
            total_chunks += 1

        if not batch_records:
            continue

        if dry_run:
            print(f"  [{i+1}/{len(files)}] {f.name}: {len(batch_records)} new chunks")
            continue

        # embed and upload in batches
        for b_start in range(0, len(batch_records), BATCH_SIZE):
            b_end = min(b_start + BATCH_SIZE, len(batch_records))
            b_texts = batch_texts[b_start:b_end]
            b_records = batch_records[b_start:b_end]

            try:
                embeddings = get_embeddings(b_texts)
                for rec, emb in zip(b_records, embeddings):
                    rec["embedding"] = str(emb)
                result = supabase_request("POST", "memories", data=b_records)
                if isinstance(result, dict) and "error" in result:
                    print(f"  error uploading {f.name}: {result['error']}")
                else:
                    total_embedded += len(b_records)
            except Exception as e:
                print(f"  error on {f.name} batch {b_start}: {e}")

            # rate limit: nvidia free tier
            if b_end < len(batch_records):
                time.sleep(0.5)

        if (i + 1) % 50 == 0:
            print(f"  [{i+1}/{len(files)}] {total_embedded} chunks uploaded, {skipped} skipped")

    return total_chunks, total_embedded, skipped



def sync_skills(dry_run=False):
    """sync kiro skills to supabase."""
    skill_dir = Path.home() / ".kiro/skills"
    if not skill_dir.exists():
        print("  no skills directory found")
        return 0

    files = sorted(skill_dir.glob("*/SKILL.md"))
    print(f"  found {len(files)} skills")

    uploaded = 0
    for f in files:
        name = f.parent.name
        text = f.read_text().strip()
        if not text:
            continue

        # check if skill already exists and content matches
        existing = supabase_request("GET", "memories", params={
            "category": "eq.skill",
            "title": f"eq.{name}",
            "status": "eq.active",
            "select": "id,content",
        })

        if isinstance(existing, list) and existing:
            if existing[0].get("content", "").strip() == text:
                continue  # unchanged
            # update existing
            record_id = existing[0]["id"]
            supabase_request("PATCH", f"memories?id=eq.{record_id}", data={"content": text})
            uploaded += 1
        else:
            # create new
            supabase_request("POST", "memories", data=[{
                "title": name,
                "content": text[:50000],
                "category": "skill",
                "source": "kiro-skills",
                "status": "active",
                "priority": "normal",
                "agent_id": "export-script",
                "tags": f"skill:{name}",
            }])
            uploaded += 1

    return uploaded

def main():
    dry_run = "--dry-run" in sys.argv
    seed = "--seed" in sys.argv

    print(f"chat export {'(dry run)' if dry_run else '(live)'} {'(seed mode)' if seed else ''}")
    print(f"nvidia model: {NVIDIA_MODEL}")
    print()

    print("kiro sessions:")
    k_chunks, k_embedded, k_skipped = export_sessions(KIRO_DIR, "kiro-session", dry_run, seed)
    print(f"  total: {k_chunks} chunks, {k_embedded} embedded, {k_skipped} skipped")
    print()

    print("opencode sessions:")
    o_chunks, o_embedded, o_skipped = export_sessions(OPENCODE_DIR, "opencode-session", dry_run, seed)
    print(f"  total: {o_chunks} chunks, {o_embedded} embedded, {o_skipped} skipped")
    print()

    print(f"done. {k_embedded + o_embedded} total chunks uploaded.")

    print()
    print("skill sync:")
    s_count = sync_skills(dry_run)
    print(f"  {s_count} skills updated")

if __name__ == "__main__":
    main()
