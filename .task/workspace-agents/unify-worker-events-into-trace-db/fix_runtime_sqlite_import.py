from pathlib import Path
p=Path('packages/workspace/scripts/lib/worker/runtime.ts')
s=p.read_text()
s=s.replace("import { Database } from 'bun:sqlite';\n", "")
s=s.replace("    const db = new Database(dbPath, { create: true });", "    const { Database } = eval('require')('bun:sqlite') as { Database: new (path: string, options?: { create?: boolean }) => any };\n    const db = new Database(dbPath, { create: true });")
s=s.replace("function ensureTraceSchema(db: Database): void {", "function ensureTraceSchema(db: any): void {")
p.write_text(s)
