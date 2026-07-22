import { readFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_SECTIONS = [
  { key: "whenToUse", label: "When To Use", aliases: ["when to use"] },
  { key: "inputs", label: "Required Tools Or Inputs", aliases: ["required tools or inputs", "inputs", "tools"] },
  { key: "sideEffects", label: "Side-Effect Boundaries", aliases: ["side-effect boundaries", "side effect boundaries", "side effects"] },
  { key: "approvals", label: "Approval Requirements", aliases: ["approval requirements", "approvals"] },
  { key: "examples", label: "Examples", aliases: ["examples"] },
  { key: "validation", label: "Validation Workflow", aliases: ["validation workflow", "validation"] }
];

const RISKY_COMMANDS = [
  /\bnpm\s+publish\b/,
  /\bpnpm\s+publish\b/,
  /\byarn\s+npm\s+publish\b/,
  /\bgh\s+release\b/,
  /\bgh\s+repo\s+edit\b/,
  /\bdeploy\b/,
  /\bcurl\b/,
  /\bmessage\b/,
  /\bsend\b/,
  /\brm\s+-rf\s+\//
];

export async function planSkill(skillPath, options = {}) {
  const absolutePath = path.resolve(skillPath);
  const markdown = await readFile(absolutePath, "utf8");
  const parsed = parseSkill(markdown);
  const repoRoot = options.repoRoot ?? path.dirname(absolutePath);
  const packageScripts = await readPackageScripts(repoRoot);
  const commands = suggestCommands(parsed, packageScripts);
  const findings = findGaps(parsed, commands);

  return {
    skillPath: absolutePath,
    sections: parsed.sections,
    commands,
    findings,
    evidence: evidenceFor(commands, findings)
  };
}

export function parseSkill(markdown) {
  const sections = {};
  const shellSnippets = [];
  const lines = markdown.split(/\r?\n/);
  let current = "intro";
  let inFence = false;
  let fenceLang = "";
  let fence = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fenceMatch && !inFence) {
      inFence = true;
      fenceLang = fenceMatch[1].toLowerCase();
      fence = [];
      continue;
    }
    if (line.trim() === "```" && inFence) {
      if (["sh", "shell", "bash", "zsh"].includes(fenceLang)) {
        shellSnippets.push(fence.join("\n").trim());
      }
      inFence = false;
      fenceLang = "";
      fence = [];
      continue;
    }
    if (inFence) {
      fence.push(line);
      continue;
    }

    const heading = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (heading) {
      current = normalizeHeading(heading[1]);
      sections[current] = sections[current] ?? "";
      continue;
    }
    sections[current] = `${sections[current] ?? ""}${line}\n`;
  }

  return {
    sections: trimSections(sections),
    shellSnippets
  };
}

export function renderPlan(plan) {
  const lines = [
    `# Skill Smoke Plan`,
    "",
    `- Skill: ${plan.skillPath}`,
    `- Findings: ${plan.findings.length}`,
    "",
    "## Recommended Local Commands",
    ""
  ];

  if (plan.commands.length === 0) {
    lines.push("- No local commands found.");
  } else {
    for (const command of plan.commands) {
      const risk = command.risky ? " risky" : " local";
      const scriptEvidence = command.script === undefined
        ? ""
        : `; script: ${JSON.stringify(command.script)}`;
      lines.push(`- [${risk.trim()}] \`${command.command}\` (${command.source}${scriptEvidence})`);
    }
  }

  lines.push("", "## Findings", "");
  if (plan.findings.length === 0) {
    lines.push("- No findings.");
  } else {
    for (const item of plan.findings) {
      lines.push(`- ${item.severity.toUpperCase()}: ${item.message}`);
    }
  }

  lines.push("", "## Evidence To Capture", "");
  for (const item of plan.evidence) {
    lines.push(`- ${item}`);
  }

  return `${lines.join("\n")}\n`;
}

function suggestCommands(parsed, packageScripts) {
  const commands = [];

  for (const preferred of ["test", "check", "build", "smoke"]) {
    if (packageScripts[preferred]) {
      commands.push(makeCommand(`npm run ${preferred}`, `package.json#${preferred}`, packageScripts[preferred]));
    }
  }

  for (const snippet of parsed.shellSnippets) {
    for (const line of snippet.split(/\r?\n/)) {
      const command = line.trim();
      if (!command || command.startsWith("#")) continue;
      if (commands.some((item) => item.command === command)) continue;
      commands.push(makeCommand(command, "SKILL.md example"));
    }
  }

  return commands;
}

function findGaps(parsed, commands) {
  const findings = [];
  const headings = new Set(Object.keys(parsed.sections));

  for (const section of REQUIRED_SECTIONS) {
    if (!section.aliases.some((alias) => headings.has(normalizeHeading(alias)))) {
      findings.push({
        severity: "warning",
        message: `Missing or empty section: ${section.label}`
      });
    }
  }

  for (const command of commands) {
    if (command.risky) {
      const scriptEvidence = command.script ? ` (script: ${command.script})` : "";
      findings.push({
        severity: "warning",
        message: `Review risky command before running: ${command.command}${scriptEvidence}`
      });
    }
  }

  if (commands.length === 0) {
    findings.push({
      severity: "warning",
      message: "No local smoke commands found."
    });
  }

  return findings;
}

function evidenceFor(commands, findings) {
  const evidence = [
    "Generated smoke plan output",
    "Maintainer review of side-effect and approval sections"
  ];
  if (commands.length > 0) evidence.push("Terminal output for approved local commands");
  if (findings.length > 0) evidence.push("Resolution notes for warnings or accepted risks");
  return evidence;
}

async function readPackageScripts(repoRoot) {
  try {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    return packageJson.scripts ?? {};
  } catch {
    return {};
  }
}

function makeCommand(command, source, script) {
  const inspectedCommands = [command, script]
    .filter((value) => typeof value === "string")
    .map(normalizeCommandForRisk);

  return {
    command,
    source,
    ...(script === undefined ? {} : { script }),
    risky: inspectedCommands.some((candidate) =>
      RISKY_COMMANDS.some((pattern) => pattern.test(candidate))
    )
  };
}

function normalizeCommandForRisk(command) {
  return command.toLowerCase();
}

function normalizeHeading(value) {
  return value.toLowerCase().replace(/[`*_]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function trimSections(sections) {
  return Object.fromEntries(
    Object.entries(sections)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  );
}
