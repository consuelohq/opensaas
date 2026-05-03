# Open Design upstream

Source: `https://github.com/nexu-io/open-design`

Vendored path:

```text
packages/consuelo-design/upstream/open-design
```

The upstream repository is included as source files, with nested Git metadata removed so GitHub reviews the content normally.

## license

Open Design declares `Apache-2.0` in its `package.json` and includes its upstream `LICENSE` file in the vendored directory.

## local runtime

Open Design creates local runtime state under `.od/` and uses pnpm for its own workspace. Do not commit local runtime state, generated artifacts, or upstream build outputs.

## sync policy

Use a focused sync script or manual vendor refresh task when updating upstream. Preserve:

- upstream `LICENSE`
- upstream `README.md`
- upstream `package.json`
- this `UPSTREAM.md`
- Consuelo facade files outside `upstream/open-design`

Do not edit vendored upstream internals to encode Consuelo-specific behavior. Put Consuelo behavior in the facade.
