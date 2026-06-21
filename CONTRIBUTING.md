# Contributing

Thanks for improving `skill-smokeplanner`.

## Local Checks

Run these before opening a PR:

```sh
npm test
npm run check
npm run smoke
```

## Planner Rules

- Keep planning deterministic and local-only.
- Do not add command execution to the planner.
- Add fixtures for complete, sparse, and risky skill shapes when changing parser behavior.
- Prefer warnings over silent acceptance when a command might publish, deploy, or message externally.

## PR Evidence

Include Markdown or JSON planner output for parser and risk-detection changes.
