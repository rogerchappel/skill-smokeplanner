import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8"
});
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const required = [
  "bin/skill-smokeplanner.js",
  "src/index.js",
  "scripts/check-package.js",
  "scripts/package-smoke.js",
  "fixtures/complete-skill/SKILL.md",
  "fixtures/complete-skill/expected-plan.md",
  "fixtures/risky-skill/SKILL.md",
  "fixtures/sparse-skill/SKILL.md",
  "docs/RELEASE_CANDIDATE.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md"
];

const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) {
  console.error(`package smoke failed; missing expected files: ${missing.join(", ")}`);
  process.exit(1);
}

if (pkg.bin?.["skill-smokeplanner"] !== "./bin/skill-smokeplanner.js") {
  console.error("package smoke failed; skill-smokeplanner bin points at the wrong file");
  process.exit(1);
}

if (pkg.exports?.["."] !== "./src/index.js") {
  console.error("package smoke failed; package export must expose ./src/index.js");
  process.exit(1);
}

const importSmoke = execFileSync(process.execPath, [
  "--input-type=module",
  "-e",
  "import('./src/index.js').then((mod) => { if (typeof mod.planSkill !== 'function' || typeof mod.renderPlan !== 'function') process.exit(1); })"
], {
  encoding: "utf8"
});
if (importSmoke.trim()) {
  console.error("package smoke failed; package import smoke produced unexpected output");
  process.exit(1);
}

console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files`);
