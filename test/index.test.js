import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { discoverRepoRoot, parseSkill, planSkill, renderPlan } from "../src/index.js";

test("parses sections and shell snippets", () => {
  const parsed = parseSkill(`# Demo

## When To Use
Use it.

## Examples
\`\`\`sh
npm test
\`\`\`
`);
  assert.equal(parsed.sections["when to use"], "Use it.");
  assert.equal(parsed.sections.examples, "npm test");
  assert.deepEqual(parsed.shellSnippets, ["npm test"]);
});

test("accepts a supported shell fence as nonempty Examples content", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-fence-"));
  const skillPath = path.join(directory, "SKILL.md");
  await writeFile(skillPath, `## Examples
\`\`\`sh
echo curl
\`\`\`
`);

  const plan = await planSkill(skillPath, { repoRoot: directory });
  assert.equal(plan.findings.some(({ message }) => message.includes("Examples")), false);
});

test("distinguishes echoed command names from genuine invocations", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-risk-"));
  const skillPath = path.join(directory, "SKILL.md");
  await writeFile(skillPath, `## Examples
\`\`\`sh
echo curl
printf '%s\\n' "npm publish"
echo safe && echo deploy
echo ready && curl https://example.invalid
printf done | npm publish
\`\`\`
`);

  const plan = await planSkill(skillPath, { repoRoot: directory });
  assert.deepEqual(plan.commands.map(({ risky }) => risky), [false, false, false, true, true]);
});

test("parses CommonMark ATX headings with indentation and closing sequences", () => {
  const parsed = parseSkill(`   ## When To Use ##
Use it.

 ### Inputs ###   
Input details.

#### Examples
Examples here.

###### Validation Workflow ######
Validate it.
`);

  assert.equal(parsed.sections["when to use"], "Use it.\n\nInput details.\n\nExamples here.\n\nValidate it.");
  assert.equal(parsed.sections.inputs, "Input details.");
  assert.equal(parsed.sections.examples, "Examples here.");
  assert.equal(parsed.sections["validation workflow"], "Validate it.");
});

test("attributes nested subsection content to its enclosing H2 section", () => {
  const parsed = parseSkill(`## When To Use
Parent introduction.

### Scenario
Nested use case.

#### Detail
Deeply nested detail.

## Required Tools Or Inputs
### Runtime
Node.js 20.

## Examples
Sibling content.
`);

  assert.equal(parsed.sections["when to use"], "Parent introduction.\n\nNested use case.\n\nDeeply nested detail.");
  assert.equal(parsed.sections.scenario, "Nested use case.");
  assert.equal(parsed.sections.detail, "Deeply nested detail.");
  assert.equal(parsed.sections["required tools or inputs"], "Node.js 20.");
  assert.equal(parsed.sections.runtime, "Node.js 20.");
  assert.equal(parsed.sections.examples, "Sibling content.");
  assert.doesNotMatch(parsed.sections["required tools or inputs"], /Sibling content/);
});

test("uses H1 as a boundary without treating it as a skill section", () => {
  const parsed = parseSkill(`## Inputs
# Appendix
Unrelated prose.
`);

  assert.equal(parsed.sections.inputs, undefined);
  assert.equal(parsed.sections.appendix, undefined);
  assert.equal(Object.values(parsed.sections).some((content) => /Unrelated prose/.test(content)), false);
});

test("keeps H2-H6 content nested until an H1 boundary", () => {
  const parsed = parseSkill(`## Inputs
Input introduction.
### Runtime
Node.js 20.
###### Detail
No global install required.
# Appendix
Not part of Inputs.
`);

  assert.equal(parsed.sections.inputs, "Input introduction.\nNode.js 20.\nNo global install required.");
  assert.equal(parsed.sections.runtime, "Node.js 20.");
  assert.equal(parsed.sections.detail, "No global install required.");
  assert.doesNotMatch(parsed.sections.inputs, /Appendix|Not part/);
});

test("keeps fenced nested headings out of parent and child sections", () => {
  const parsed = parseSkill(`## When To Use
### Scenario
Use it.

\`\`\`md
#### Fenced Example
not visible section content
\`\`\`
`);

  assert.equal(parsed.sections["fenced example"], undefined);
  assert.equal(parsed.sections.scenario, "Use it.");
  assert.equal(parsed.sections["when to use"], "Use it.");
});

test("does not parse four-space-indented or fenced heading examples", () => {
  const parsed = parseSkill(`## When To Use
Use it.

    ## Inputs
    This is indented code.

\`\`\`md
### Examples
#### Validation Workflow ####
\`\`\`
`);

  assert.deepEqual(Object.keys(parsed.sections), ["when to use"]);
  assert.match(parsed.sections["when to use"], /## Inputs/);
  assert.match(parsed.sections["when to use"], /This is indented code/);
  assert.doesNotMatch(parsed.sections["when to use"], /### Examples/);
});

test("recognizes required sections under supported CommonMark ATX forms", async () => {
  const plan = await planSkill("fixtures/commonmark-headings/SKILL.md", {
    repoRoot: "fixtures/complete-skill"
  });

  assert.equal(plan.findings.length, 0);
});

test("supports CommonMark shell fences without parsing embedded headings", () => {
  const parsed = parseSkill(`# Demo

~~~sh
npm test
## Approval Requirements
not a real section
~~~~

## Examples
real section
`);

  assert.equal(parsed.sections["approval requirements"], undefined);
  assert.equal(parsed.sections.examples, "real section");
  assert.deepEqual(parsed.shellSnippets, ["npm test\n## Approval Requirements\nnot a real section"]);
});

test("requires matching fence markers and sufficiently long closers", () => {
  const parsed = parseSkill(`## Examples

\`\`\`\`bash extra-info
echo start
~~~
## Still fenced
\`\`\`
echo end
\`\`\`\`\`

## Validation
done
`);

  assert.equal(parsed.sections["still fenced"], undefined);
  assert.equal(parsed.sections.validation, "done");
  assert.deepEqual(parsed.shellSnippets, ["echo start\n~~~\n## Still fenced\n```\necho end"]);
});

test("CLI rejects unknown, duplicate, and extra arguments", () => {
  for (const args of [
    ["plan", "fixtures/complete-skill/SKILL.md", "--bogus"],
    ["plan", "fixtures/complete-skill/SKILL.md", "--json", "--json"],
    ["plan", "fixtures/complete-skill/SKILL.md", "--repo-root"],
    ["plan", "fixtures/complete-skill/SKILL.md", "--repo-root", ".", "--repo-root", "."],
    ["plan", "fixtures/complete-skill/SKILL.md", "extra.md"]
  ]) {
    const result = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", ...args], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^(Unknown|Duplicate|Missing)/);
  }
});

test("discovers nearest ancestor package metadata within the Git worktree", async () => {
  const repository = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-worktree-"));
  const skillPath = path.join(repository, "skills", "example", "SKILL.md");
  await mkdir(path.join(repository, ".git"));
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(path.join(repository, "package.json"), JSON.stringify({
    scripts: { test: "node --test", smoke: "node smoke.js" }
  }));
  await writeFile(skillPath, "# Example\n");
  const plan = await planSkill(skillPath);

  assert.equal(await discoverRepoRoot(skillPath), repository);
  assert.deepEqual(plan.commands.map(({ command }) => command), ["npm run test", "npm run smoke"]);
  assert.equal(plan.findings.some(({ message }) => message === "No local smoke commands found."), false);
});

test("outside a Git worktree only discovers package metadata beside the skill", async () => {
  const outer = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-export-"));
  const skillDirectory = path.join(outer, "export", "skills", "example");
  const skillPath = path.join(skillDirectory, "SKILL.md");
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(path.join(outer, "export", "package.json"), JSON.stringify({
    scripts: { test: "ancestor" }
  }));
  await writeFile(path.join(skillDirectory, "package.json"), JSON.stringify({
    scripts: { smoke: "node smoke.js" }
  }));
  await writeFile(skillPath, "# Example\n");

  const plan = await planSkill(skillPath);
  assert.equal(await discoverRepoRoot(skillPath), skillDirectory);
  assert.deepEqual(plan.commands.map(({ command }) => command), ["npm run smoke"]);
});

test("CLI supports an explicit repository root override", () => {
  const result = spawnSync(process.execPath, [
    "bin/skill-smokeplanner.js",
    "plan",
    "fixtures/nested-repository/skills/example/SKILL.md",
    "--repo-root",
    "fixtures/complete-skill",
    "--json"
  ], { encoding: "utf8" });

  assert.equal(result.status, 0);
  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.commands.map(({ command }) => command), [
    "npm run test",
    "npm run check",
    "npm run smoke"
  ]);
});

test("does not discover unrelated package metadata above a repository boundary", async () => {
  const outer = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-boundary-"));
  const repository = path.join(outer, "repository");
  const skillDirectory = path.join(repository, "skills", "example");
  await mkdir(path.join(repository, ".git"), { recursive: true });
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(path.join(outer, "package.json"), JSON.stringify({ scripts: { test: "outside" } }));
  await writeFile(path.join(skillDirectory, "SKILL.md"), "# Example\n");

  const plan = await planSkill(path.join(skillDirectory, "SKILL.md"));
  assert.deepEqual(plan.commands, []);
  assert.equal(plan.findings.some(({ message }) => message === "No local smoke commands found."), true);
});

test("missing and malformed package.json files produce no package commands", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-packages-"));
  const skill = path.join(root, "SKILL.md");
  await writeFile(skill, "# Example\n");

  assert.deepEqual((await planSkill(skill, { repoRoot: root })).commands, []);
  await writeFile(path.join(root, "package.json"), "{ malformed");
  assert.deepEqual((await planSkill(skill, { repoRoot: root })).commands, []);
});

test("CLI keeps help, Markdown, and JSON invocations stable", () => {
  const help = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", "--help"], { encoding: "utf8" });
  const markdown = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", "plan", "fixtures/complete-skill/SKILL.md"], { encoding: "utf8" });
  const json = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", "plan", "fixtures/complete-skill/SKILL.md", "--json"], { encoding: "utf8" });

  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(markdown.status, 0);
  assert.match(markdown.stdout, /^# Skill Smoke Plan/);
  assert.equal(json.status, 0);
  assert.doesNotThrow(() => JSON.parse(json.stdout));
});

test("CLI accepts populated required sections implemented with nested subsections", () => {
  for (const args of [
    ["plan", "fixtures/nested-sections-skill/SKILL.md"],
    ["plan", "fixtures/nested-sections-skill/SKILL.md", "--json"]
  ]) {
    const result = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", ...args], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Missing or empty section/);
  }
});

test("plans a complete skill with local commands", async () => {
  const plan = await planSkill("fixtures/complete-skill/SKILL.md", {
    repoRoot: "fixtures/complete-skill"
  });
  assert.equal(plan.findings.length, 0);
  assert.equal(plan.commands.some((item) => item.command === "npm run test"), true);
  assert.equal(plan.commands.some((item) => item.command === "npm run smoke"), true);
});

test("flags missing sections and commands for a sparse standalone skill", async () => {
  const plan = await planSkill("fixtures/sparse-skill/SKILL.md", {
    repoRoot: "fixtures/sparse-skill"
  });
  assert.equal(plan.findings.some((item) => item.message.includes("Approval Requirements")), true);
  assert.equal(plan.findings.some((item) => item.message.includes("No local smoke commands")), true);
});

test("flags risky external action commands", async () => {
  const plan = await planSkill("fixtures/risky-skill/SKILL.md");
  assert.equal(plan.commands.filter((item) => item.risky).length, 3);
  assert.equal(plan.findings.some((item) => item.message.includes("npm publish")), true);
});

test("classifies commands embedded in env -S/--split-string", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "skill-smokeplanner-env-split-"));
  const skillPath = path.join(directory, "SKILL.md");
  await writeFile(skillPath, `## Examples
\`\`\`sh
env -S "npm publish"
env --split-string "npm publish"
env CI=1 -S "npm publish"
env -S "CI=1 npm publish"
env -S "git status --short"
env --split-string "git status --short"
\`\`\`
`);

  const plan = await planSkill(skillPath, { repoRoot: directory });
  const risks = Object.fromEntries(plan.commands.map(({ command, risky }) => [command, risky]));

  for (const command of [
    "env -S \"npm publish\"",
    "env --split-string \"npm publish\"",
    "env CI=1 -S \"npm publish\"",
    "env -S \"CI=1 npm publish\""
  ]) assert.equal(risks[command], true, `${command} should be risky`);

  for (const command of [
    "env -S \"git status --short\"",
    "env --split-string \"git status --short\""
  ]) assert.equal(risks[command], false, `${command} should remain non-risky`);
});

test("flags destructive cleanup without flagging safe neighbors", async () => {
  const plan = await planSkill("fixtures/cleanup-risk-skill/SKILL.md");
  const risks = Object.fromEntries(plan.commands.map(({ command, risky }) => [command, risky]));

  for (const command of [
    "git clean -fdx",
    "git clean ./build --force -d",
    "git -C . clean -fd",
    "git -C./sandbox clean ./build --force -d",
    "git --work-tree=./sandbox clean -d --force",
    "git -C /tmp/example push",
    "git -C/tmp/example commit -m release",
    "git --git-dir .git merge topic",
    "git --work-tree=./sandbox rebase main",
    "git --namespace demo reset --hard HEAD",
    "git --no-pager tag v1.0.0",
    "env CI=1 git reset --hard HEAD",
    "env -i HOME=/tmp git -C . clean -fd",
    "rm -rf dist",
    "rm ./coverage -fr",
    "rm --recursive ./cache --force"
  ]) assert.equal(risks[command], true, `${command} should be risky`);

  for (const command of [
    "git clean -ndx",
    "git clean --dry-run -fd",
    "git -C . clean -nfd",
    "git status --short",
    "env CI=1 git status --short",
    "env CI=1 echo git reset --hard HEAD",
    "echo /tmp/git push",
    "printf 'git commit'",
    "./tools/git merge",
    "rm -r logs",
    "rm -f artifact.txt"
  ]) assert.equal(risks[command], false, `${command} should remain non-risky`);

  const jsonResult = spawnSync(process.execPath, [
    "bin/skill-smokeplanner.js",
    "plan",
    "fixtures/cleanup-risk-skill/SKILL.md",
    "--json"
  ], { encoding: "utf8" });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const jsonPlan = JSON.parse(jsonResult.stdout);
  assert.equal(jsonPlan.commands.find(({ command }) => command === "git -C . clean -fd")?.risky, true);
  assert.equal(jsonPlan.commands.find(({ command }) => command === "env CI=1 git reset --hard HEAD")?.risky, true);

  const markdown = renderPlan(plan);
  assert.match(markdown, /WARNING: Review risky command before running: git -C \. clean -fd/);
});

test("flags package-script bodies and commands regardless of casing", async () => {
  const plan = await planSkill("fixtures/script-risk-skill/SKILL.md", {
    repoRoot: "fixtures/script-risk-skill"
  });

  const testCommand = plan.commands.find((item) => item.command === "npm run test");
  const checkCommand = plan.commands.find((item) => item.command === "npm run check");
  const buildCommand = plan.commands.find((item) => item.command === "npm run build");
  const smokeCommand = plan.commands.find((item) => item.command === "npm run smoke");
  const exampleCommand = plan.commands.find((item) => item.command === "NPM PUBLISH");

  assert.deepEqual(
    [testCommand?.risky, checkCommand?.risky, buildCommand?.risky, smokeCommand?.risky, exampleCommand?.risky],
    [false, true, false, true, true]
  );
  assert.equal(smokeCommand?.script, "npm publish");
  assert.equal(checkCommand?.script, "NPM PUBLISH");

  const markdown = renderPlan(plan);
  assert.match(markdown, /npm run smoke.*package\.json#smoke; script: "npm publish"/);
  assert.match(markdown, /WARNING: Review risky command.*script: npm publish/);
});

test("flags repository, GitHub, package, and network mutations with evidence", async () => {
  const plan = await planSkill("fixtures/command-taxonomy-skill/SKILL.md", {
    repoRoot: "fixtures/command-taxonomy-skill"
  });

  assert.equal(plan.commands.length, 8);
  assert.equal(plan.commands.every((item) => item.risky), true);

  const markdown = renderPlan(plan);
  for (const evidence of [
    "git push origin main",
    "gh pr create --fill",
    "npm version patch",
    "wget https://example.invalid/artifact",
    "git commit -m release",
    "gh issue close 42",
    "pnpm publish",
    "ssh example.invalid"
  ]) {
    assert.match(markdown, new RegExp(`WARNING: Review risky command before running: .*${evidence.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  }
  assert.match(markdown, /npm run test.*script: "git push origin main"/);
});

test("does not flag safe neighboring words and filenames", async () => {
  const plan = await planSkill("fixtures/safe-neighbor-skill/SKILL.md", {
    repoRoot: "fixtures/safe-neighbor-skill"
  });

  assert.equal(plan.commands.length, 7);
  assert.equal(plan.commands.some((item) => item.risky), false);
  assert.equal(plan.findings.some((item) => item.message.includes("risky command")), false);
});

test("renders markdown evidence checklist", async () => {
  const plan = await planSkill("fixtures/complete-skill/SKILL.md", {
    repoRoot: "fixtures/complete-skill"
  });
  const markdown = renderPlan(plan);
  assert.match(markdown, /Skill Smoke Plan/);
  assert.match(markdown, /Evidence To Capture/);
});

test("matches the complete skill golden plan shape", async () => {
  const plan = await planSkill("fixtures/complete-skill/SKILL.md", {
    repoRoot: "fixtures/complete-skill"
  });
  const markdown = renderPlan(plan).replace(/^(- Skill: ).+$/m, "$1fixtures/complete-skill/SKILL.md");
  const expected = await readFile("fixtures/complete-skill/expected-plan.md", "utf8");
  assert.equal(markdown.trim(), expected.trim());
});
