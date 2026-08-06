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

## Release Verification

Run the release gate before tagging or publishing:

```sh
npm run release:check
```

The release gate runs package checks, tests, the fixture-backed CLI smoke, and a dry-run `npm pack` so missing runtime files are caught before publication.

`npm run package:smoke` also asserts the published tarball contains the CLI, library API, fixtures, release notes, skill guide, license, security policy, and contribution guide.

## What It Checks

- Required skill sections such as when to use, inputs, side effects, approvals, examples, and validation.
- Local smoke commands from fenced shell snippets and `package.json` scripts.
- Risky command families: mutating Git operations; mutating GitHub issue, pull-request, release, and repository operations; package publish/version operations; deploy, messaging, destructive removal, and network commands (`curl`, `wget`, `ssh`, and `scp`). Matching is case-insensitive and checks both fenced examples and suggested `npm run` wrappers' package-script bodies.
- Evidence artifacts a reviewer should expect from the smoke run.

Section names may use CommonMark ATX headings from level 2 through level 6. The
heading may have up to three leading spaces and an optional closing sequence of
`#` characters, for example `   #### Inputs ####`. Headings inside fenced code
blocks and headings indented by four or more spaces are treated as examples,
not skill sections.

## Safety Notes

- The planner never runs commands.
- Commands are recommendations only and should be reviewed before execution.
- Markdown and JSON plans include each suggested package command's source and script body so reviewers can inspect indirect behavior.
- External actions are flagged as warnings so a maintainer can replace them with fixtures or dry-run equivalents.

## Limitations

- Markdown parsing is intentionally small and deterministic.
- Shell examples may use CommonMark backtick or tilde fences (three or more matching markers) with an `sh`, `shell`, `bash`, or `zsh` info string. A closing fence must use the same marker and be at least as long as its opener.
- The CLI accepts exactly `plan <skill-path>` with an optional single `--json` flag; unknown, duplicate, and extra arguments are errors.
- Risk detection recognizes a conservative command taxonomy, not shell semantics. It does not expand aliases, variables, or scripts beyond the preferred `test`, `check`, `build`, and `smoke` package-script bodies.
- The planner cannot prove that a skill works; it creates a repeatable checklist for local validation.
