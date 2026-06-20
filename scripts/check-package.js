import { access, readFile } from "node:fs/promises";

const required = [
  "README.md",
  "SKILL.md",
  "docs/PRD.md",
  "docs/TASKS.md",
  "docs/ORCHESTRATION.md",
  "fixtures/complete-skill/SKILL.md",
  "fixtures/risky-skill/SKILL.md"
];

for (const file of required) {
  await access(file);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!pkg.bin || !pkg.exports || !pkg.scripts?.smoke) {
  throw new Error("package metadata is missing CLI, exports, or smoke script");
}

console.log("package check passed");
