# Seed Data — Manifest-Driven Knowledge Base Seeding

Pre-loads the knowledge base with carrier documents so new workspaces get immediate value.

## Usage

```bash
npx tsx scripts/seed-knowledge.ts --workspace <uuid>

# seed only one vertical
npx tsx scripts/seed-knowledge.ts --workspace <uuid> --vertical insurance

# preview without writing
npx tsx scripts/seed-knowledge.ts --workspace <uuid> --dry-run

# re-seed (deletes + recreates existing collections)
npx tsx scripts/seed-knowledge.ts --workspace <uuid> --force
```

Requires `DATABASE_URL` (or `KNOWLEDGE_DATABASE_URL`) and `OPENAI_API_KEY` env vars.

## Adding a New Vertical

1. Create a folder under `fixtures/seed/` (e.g. `fixtures/seed/real-estate-contracts/`)
2. Drop your files (PDF, TXT, CSV, DOCX) into the folder
3. Add a `manifest.json`:

```json
{
  "vertical": "real-estate",
  "description": "Real estate contract templates and guidelines",
  "collections": [
    {
      "name": "real-estate-contracts",
      "description": "Standard contract templates",
      "strategy": {
        "maxTokens": 500,
        "overlap": 50,
        "splitOn": "sentence",
        "preserveHeaders": true,
        "preserveTables": true
      },
      "files": [
        {
          "path": "purchase-agreement.pdf",
          "metadata": { "docType": "contract", "industry": "real_estate" }
        }
      ]
    }
  ]
}
```

4. Run the seed script. Zero code changes needed.

## Directory Structure

```
fixtures/seed/
├── README.md
└── insurance-final-expense/
    ├── manifest.json
    ├── americo-underwriting-guide.pdf
    └── mutual-of-omaha-underwriting-guide.pdf
```

## Manifest Schema

| Field | Type | Description |
|-------|------|-------------|
| `vertical` | string | Vertical name (used with `--vertical` filter) |
| `description` | string | Human-readable description |
| `collections[].name` | string | Collection name (must be unique per workspace) |
| `collections[].strategy` | object | Chunking config: `maxTokens`, `overlap`, `splitOn`, `preserveHeaders`, `preserveTables` |
| `collections[].files[].path` | string | Filename relative to the manifest directory |
| `collections[].files[].metadata` | object | Key-value pairs stored on every chunk (e.g. `carrier`, `productType`, `industry`) |
