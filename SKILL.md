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

Ask for approval before running any generated command that may mutate a Git repository or GitHub resource, publish or version a package, deploy, send messages, remove system paths, or call a live service.

## Examples

Shell examples may use backtick or tilde fences of three or more matching markers. The closing fence must use the same marker and be at least as long as the opening fence.

```sh
skill-smokeplanner plan ./SKILL.md
skill-smokeplanner plan ./SKILL.md --json
skill-smokeplanner plan ./skills/example/SKILL.md --repo-root .
```

Without `--repo-root`, package metadata is discovered upward from `SKILL.md`
and is bounded to its containing Git worktree. Pass `--repo-root` when the
intended package root is elsewhere or an explicit boundary is preferable.

## Validation Workflow

Run `npm test`, `npm run check`, and `npm run smoke`. Confirm taxonomy fixtures warn for repository, GitHub CLI, package publish/version, and network commands in direct examples and preferred package-script bodies; confirm safe-neighbor fixtures do not trigger broad substring matches.
