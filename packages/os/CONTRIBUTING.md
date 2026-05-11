# contributing

thanks for contributing to openworkspace.

## development setup

```bash
bash setup.sh
```

that bootstraps the local virtualenv and writes starter config files when they do not already exist.

## pull request expectations

- keep changes focused
- explain the problem and the approach in the PR body
- include verification steps you ran
- avoid checking in secrets, private repo trees, personal steering files, or local launchd configs

## local verification

run at least the relevant checks for the files you changed.

for python changes:

```bash
python3 -m compileall server.py tools scripts
```

for shell scripts:

```bash
bash -n setup.sh
bash -n scripts/start-brain.sh
```

## steering and local config

do not commit your personal `BRAIN.md`, `.env`, generated repo tree, or launchd installs. the repository only tracks examples and generators.
