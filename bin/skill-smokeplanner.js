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
  const unknownFlag = flags.find((flag) => flag !== "--json");
  if (unknownFlag) throw new Error(`Unknown argument: ${unknownFlag}`);
  if (flags.filter((flag) => flag === "--json").length > 1) {
    throw new Error("Duplicate argument: --json");
  }

  const plan = await planSkill(skillPath);
  if (flags.includes("--json")) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  process.stdout.write(renderPlan(plan));
}

function printHelp() {
  console.log(`skill-smokeplanner

Usage:
  skill-smokeplanner plan <skill-path>
  skill-smokeplanner plan <skill-path> --json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
