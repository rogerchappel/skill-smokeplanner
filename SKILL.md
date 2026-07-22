# Skill Smokeplanner Skill

## When To Use

Use this skill when reviewing, packaging, or releasing an agent skill and you need a deterministic local smoke plan from its `SKILL.md`.

## Required Tools Or Inputs

- Node.js 20 or newer.
- A local `SKILL.md` file.
- Optional nearby `package.json` with verification scripts.

## Side-Effect Boundaries

The planner reads files and prints Markdown or JSON. It does not run shell commands, install packages, publish packages, send messages, or call external APIs.

## Approval Requirements

Ask for approval before running any generated command that may publish, deploy, mutate accounts, send messages, or call a live service.

## Examples

```sh
skill-smokeplanner plan ./SKILL.md
skill-smokeplanner plan ./SKILL.md --json
```

## Validation Workflow

Run `npm test`, `npm run check`, and `npm run smoke`. Confirm risky fixtures produce warnings for direct commands and indirect package-script bodies regardless of casing, and complete fixtures produce actionable local commands with script evidence.
