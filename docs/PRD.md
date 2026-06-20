# PRD: skill-smokeplanner

Status: in-progress
Decision: build now
Created: 2026-06-20

## Pitch

`skill-smokeplanner` turns a SKILL.md plus repo metadata into a compact local smoke plan: required tools, safe fixture commands, approval boundaries, and evidence artifacts an agent should produce before claiming the skill works.

## V1 Scope

- TypeScript-style CLI package implemented as dependency-light ESM.
- `skill-smokeplanner plan <skill-path>` emits Markdown and JSON.
- Parse SKILL.md headings for when-to-use, inputs, side effects, approval boundaries, examples, and validation workflow.
- Suggest local-only smoke commands from package scripts, shell snippets, and docs examples.
- Flag missing safety sections and commands that appear to publish, deploy, or message externally.
- Include fixtures for complete, sparse, and risky skills.

## Out of Scope

- Running commands.
- Publishing or installing skills.
- Hosted marketplace features.

## Verification

- Fixture-backed parser and planner tests.
- CLI smoke against local sample skills.
- README with quickstart, limitations, and safety notes.
