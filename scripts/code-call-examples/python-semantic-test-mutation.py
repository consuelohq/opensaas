from pathlib import Path
import json

path = Path("packages/os/tests/security-gateway.test.ts")
text = path.read_text()

old = "expect(storedAfterIssue.tokens[token.tokenId]?.credentialHash).toMatch(/^sha256:/);"
new = "expect(storedAfterIssue.tokens[token.tokenId]?.signatureAlgorithm).toBe('ed25519');"

if old not in text:
    raise SystemExit(f"expected snippet not found in {path}")

path.write_text(text.replace(old, new))

print(json.dumps({
    "ok": True,
    "file": str(path),
    "replacement": {"from": old, "to": new},
}, indent=2))
