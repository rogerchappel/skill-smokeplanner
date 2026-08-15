#!/usr/bin/env node
import { planSkill, renderPlan } from "../src/index.js";

const args = process.argv.slice(2);

async function main() {
  const [command, skillPath, ...flags] = args;
  if (!command || command === "--help" || command === "-h") {
    if (args.length > 1) throw new Error("Help does not accept additional arguments.");
    printHelp();
    return;
  }

  if (command !== "plan") {
    throw new Error(`Unknown command: ${command}`);
  }
  if (!skillPath) {
    throw new Error("Missing SKILL.md path.");
  }
  let json = false;
  let repoRoot;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--json") {
      if (json) throw new Error("Duplicate argument: --json");
      json = true;
    } else if (flag === "--repo-root") {
      if (repoRoot !== undefined) throw new Error("Duplicate argument: --repo-root");
      repoRoot = flags[index + 1];
      if (!repoRoot || repoRoot.startsWith("--")) throw new Error("Missing value for --repo-root");
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  const plan = await planSkill(skillPath, { ...(repoRoot === undefined ? {} : { repoRoot }) });
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  process.stdout.write(renderPlan(plan));
}

function printHelp() {
  console.log(`skill-smokeplanner

Usage:
  skill-smokeplanner plan <skill-path> [--json] [--repo-root <path>]

Options:
  --json              Print the plan as JSON
  --repo-root <path>  Read package.json only from this repository root`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
