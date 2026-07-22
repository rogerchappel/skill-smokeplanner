import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
