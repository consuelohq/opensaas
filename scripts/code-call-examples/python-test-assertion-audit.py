from pathlib import Path
import json
import re

test_files = sorted(Path("packages").glob("**/tests/**/*.test.ts"))
assertion_groups = []

for path in test_files[:300]:
    text = path.read_text(errors="ignore")
    assertions = re.findall(r"expect\(([^\n]+?)\)\.(to[A-Za-z0-9_]+)", text)
    if not assertions:
        continue

    assertion_groups.append({
        "file": str(path),
        "assertionCount": len(assertions),
        "subjects": sorted({subject.strip()[:120] for subject, _ in assertions})[:8],
        "matchers": sorted({matcher for _, matcher in assertions}),
    })

recommendations = []
for group in assertion_groups:
    matchers = set(group["matchers"])
    if "toThrow" in matchers and "resolves" not in matchers:
        recommendations.append({"file": group["file"], "reason": "throw path has no obvious success-path matcher nearby"})
    if "toBeDefined" in matchers and "toEqual" not in matchers and "toStrictEqual" not in matchers:
        recommendations.append({"file": group["file"], "reason": "presence-only assertions may need a stronger value check"})

print(json.dumps({
    "ok": True,
    "filesScanned": len(test_files),
    "assertionGroups": assertion_groups[:40],
    "recommendations": recommendations[:20],
}, indent=2))
