# Contributing

Thanks for contributing to Consuelo OS.

## Development setup

```bash
bash setup.sh
```

Setup requires Bun and runs the TypeScript installer. It does not create a Python environment or install an alternative product server.

## Pull request expectations

- Keep changes focused.
- Explain the problem and the approach in the PR body.
- Include the verification steps you ran.
- Avoid checking in secrets, private repository trees, personal steering files, or local LaunchAgent configuration.

## Local verification

Run the focused tests for the behavior you changed, then the package checks:

```bash
bun run typecheck
bun test
```

For shell scripts:

```bash
bash -n setup.sh
bash -n scripts/start-consuelo-daemon.sh
```

Some optional media and utility workflows use Python. When changing one of those files, validate that utility directly, for example:

```bash
python3 -m py_compile scripts/media-svg.py
```

Python utilities are not Consuelo OS product-server entrypoints.

## Steering and local config

Do not commit personal `.env` files, generated repository trees, private steering files, or LaunchAgent installs. The repository tracks only maintained examples and generators.
