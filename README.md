# skill-smokeplanner

`skill-smokeplanner` turns a `SKILL.md` file plus nearby repo metadata into a conservative local smoke plan. It helps maintainers prove an agent skill has usable instructions, safe fixture commands, approval boundaries, and review evidence before claiming the skill works.

## Quickstart

```sh
npm install
npm test
npm run smoke
node bin/skill-smokeplanner.js plan fixtures/complete-skill/SKILL.md
node bin/skill-smokeplanner.js plan fixtures/complete-skill/SKILL.md --json
node bin/skill-smokeplanner.js plan path/to/SKILL.md --repo-root path/to/repository
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
- Risky command families: mutating Git operations; mutating GitHub issue, pull-request, release, and repository operations; package publish/version operations; deploy, messaging, destructive removal, and network commands (`curl`, `wget`, `ssh`, and `scp`). Destructive cleanup includes forced `git clean` (but not `--dry-run`/`-n`) and `rm` only when both recursive and force options are present; combined, separated, long, and target-before-option forms are recognized. Standard Git global options before `clean`, including separated or combined `-C` and long `--work-tree`/`--git-dir` forms, do not hide destructive cleanup. Matching is case-insensitive and checks both fenced examples and suggested `npm run` wrappers' package-script bodies.
- Evidence artifacts a reviewer should expect from the smoke run.

By default, the planner searches from the `SKILL.md` directory upward for the
nearest `package.json`, stopping at the root of the containing Git worktree. It
does not inspect package metadata above that boundary. Outside a Git worktree,
only a `package.json` beside `SKILL.md` is considered. Use `--repo-root <path>`
to read one specific repository root instead; the library API provides the same
override as `planSkill(skillPath, { repoRoot })`.

Section names may use CommonMark ATX headings from level 2 through level 6. The
heading may have up to three leading spaces and an optional closing sequence of
`#` characters, for example `   #### Inputs ####`. Headings inside fenced code
blocks and headings indented by four or more spaces are treated as examples,
not skill sections. Content beneath an H3-H6 subsection is attributed both to
that subsection and to its enclosing H2 section. This lets required H2 sections
organize their substantive guidance under nested headings without producing
false missing-section warnings; content never carries into a sibling H2.

## Safety Notes

- The planner never runs commands.
- Commands are recommendations only and should be reviewed before execution.
- Markdown and JSON plans include each suggested package command's source and script body so reviewers can inspect indirect behavior.
- External actions are flagged as warnings so a maintainer can replace them with fixtures or dry-run equivalents.

## Limitations

- Markdown parsing is intentionally small and deterministic.
- Shell examples may use CommonMark backtick or tilde fences (three or more matching markers) with an `sh`, `shell`, `bash`, or `zsh` info string. A closing fence must use the same marker and be at least as long as its opener.
- The CLI accepts `plan <skill-path>` with optional single `--json` and `--repo-root <path>` flags; unknown, duplicate, missing-value, and extra arguments are errors.
- Risk detection recognizes a conservative command taxonomy, not shell semantics. It does not expand aliases, variables, or scripts beyond the preferred `test`, `check`, `build`, and `smoke` package-script bodies.
- The planner cannot prove that a skill works; it creates a repeatable checklist for local validation.
