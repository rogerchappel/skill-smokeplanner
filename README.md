# skill-smokeplanner

`skill-smokeplanner` turns a `SKILL.md` file plus nearby repo metadata into a conservative local smoke plan. It helps maintainers prove an agent skill has usable instructions, safe fixture commands, approval boundaries, and review evidence before claiming the skill works.

## Quickstart

```sh
npm install
npm test
npm run smoke
node bin/skill-smokeplanner.js plan fixtures/complete-skill/SKILL.md
node bin/skill-smokeplanner.js plan fixtures/complete-skill/SKILL.md --json
```

## What It Checks

- Required skill sections such as when to use, inputs, side effects, approvals, examples, and validation.
- Local smoke commands from fenced shell snippets and `package.json` scripts.
- Risky command words such as publish, deploy, curl, message, or gh release.
- Evidence artifacts a reviewer should expect from the smoke run.

## Safety Notes

- The planner never runs commands.
- Commands are recommendations only and should be reviewed before execution.
- External actions are flagged as warnings so a maintainer can replace them with fixtures or dry-run equivalents.

## Limitations

- Markdown parsing is intentionally small and deterministic.
- Risk detection is heuristic and errs on the side of warnings.
- The planner cannot prove that a skill works; it creates a repeatable checklist for local validation.
