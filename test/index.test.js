import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseSkill, planSkill, renderPlan } from "../src/index.js";

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
  assert.deepEqual(parsed.shellSnippets, ["npm test"]);
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
    ["plan", "fixtures/complete-skill/SKILL.md", "extra.md"]
  ]) {
    const result = spawnSync(process.execPath, ["bin/skill-smokeplanner.js", ...args], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^(Unknown|Duplicate)/);
  }
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

test("plans a complete skill with local commands", async () => {
  const plan = await planSkill("fixtures/complete-skill/SKILL.md", {
    repoRoot: "fixtures/complete-skill"
  });
  assert.equal(plan.findings.length, 0);
  assert.equal(plan.commands.some((item) => item.command === "npm run test"), true);
  assert.equal(plan.commands.some((item) => item.command === "npm run smoke"), true);
});

test("flags missing sections for sparse skills", async () => {
  const plan = await planSkill("fixtures/sparse-skill/SKILL.md");
  assert.equal(plan.findings.some((item) => item.message.includes("Approval Requirements")), true);
  assert.equal(plan.findings.some((item) => item.message.includes("No local smoke commands")), true);
});

test("flags risky external action commands", async () => {
  const plan = await planSkill("fixtures/risky-skill/SKILL.md");
  assert.equal(plan.commands.filter((item) => item.risky).length, 3);
  assert.equal(plan.findings.some((item) => item.message.includes("npm publish")), true);
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
