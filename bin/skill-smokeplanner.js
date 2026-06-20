#!/usr/bin/env node
import { planSkill, renderPlan } from "../src/index.js";

const [command, skillPath, ...flags] = process.argv.slice(2);

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "plan") {
    throw new Error(`Unknown command: ${command}`);
  }
  if (!skillPath) {
    throw new Error("Missing SKILL.md path.");
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
