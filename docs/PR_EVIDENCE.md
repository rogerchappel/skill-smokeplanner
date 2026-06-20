# Release Candidate PR Evidence

## Verification Run

- `npm test` passed with 5 tests.
- `npm run check` passed package metadata and required-file checks.
- `npm run build` passed package checks.
- `npm run smoke` passed JSON plan generation against the complete skill fixture.
- `bash scripts/validate.sh` passed the full local validation sequence.

## Commit Groups

- Project scaffold, README, product docs, release notes, and skill instructions.
- SKILL.md parser, planning engine, Markdown and JSON CLI output.
- Complete, sparse, and risky fixtures with parser and planner tests.
- Fixture cleanup after verification caught an examples-section gap.

## Classification

Ship. The package is local-first, deterministic, and useful for release-candidate reviews of reusable agent skills.
