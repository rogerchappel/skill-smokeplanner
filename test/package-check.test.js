import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, "scripts/check-package.js");

async function checkWithPackage(mutator) {
  const directory = await mkdtemp(join(tmpdir(), "skill-smokeplanner-package-check-"));
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    mutator(packageJson);
    const packagePath = join(directory, "package.json");
    await writeFile(packagePath, JSON.stringify(packageJson));
    return spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PACKAGE_JSON_PATH: packagePath }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("package checker accepts the project metadata", async () => {
  const result = await checkWithPackage(() => {});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /package check passed/);
});

test("package checker rejects missing CLI metadata", async () => {
  const result = await checkWithPackage((pkg) => { delete pkg.bin; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package metadata is missing CLI, exports, or smoke script/);
});

test("package checker rejects missing exports metadata", async () => {
  const result = await checkWithPackage((pkg) => { delete pkg.exports; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package metadata is missing CLI, exports, or smoke script/);
});

test("package checker rejects a missing smoke script", async () => {
  const result = await checkWithPackage((pkg) => { delete pkg.scripts.smoke; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package metadata is missing CLI, exports, or smoke script/);
});
