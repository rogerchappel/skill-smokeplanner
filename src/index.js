import { readFile, stat } from "node:fs/promises";
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
  /\bgit\s+(?:commit|push|merge|rebase|reset|tag)\b/,
  /\bgh\s+(?:issue\s+(?:close|create|delete|edit|reopen|transfer)|pr\s+(?:close|create|edit|merge|ready|reopen|review)|release\s+(?:create|delete|edit|upload)|repo\s+(?:archive|create|delete|edit|fork|rename|sync))\b/,
  /\b(?:npm|pnpm)\s+(?:publish|unpublish|deprecate|version)\b/,
  /\byarn\s+npm\s+(?:publish|tag\s+(?:add|remove))\b/,
  /\bdeploy\b/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bssh\b/,
  /\bscp\b/,
  /\bmessage\b/,
  /\bsend\b/
];

export async function planSkill(skillPath, options = {}) {
  const absolutePath = path.resolve(skillPath);
  const markdown = await readFile(absolutePath, "utf8");
  const parsed = parseSkill(markdown);
  const repoRoot = options.repoRoot === undefined
    ? await discoverRepoRoot(absolutePath)
    : path.resolve(options.repoRoot);
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

export async function discoverRepoRoot(skillPath) {
  const skillDirectory = path.dirname(path.resolve(skillPath));
  const repositoryRoot = await findContainingGitRoot(skillDirectory);
  if (repositoryRoot === undefined) return skillDirectory;

  let candidate = skillDirectory;
  while (true) {
    if (await exists(path.join(candidate, "package.json"))) return candidate;
    if (candidate === repositoryRoot) return repositoryRoot;
    candidate = path.dirname(candidate);
  }
}

export function parseSkill(markdown) {
  const sections = {};
  const shellSnippets = [];
  const lines = markdown.split(/\r?\n/);
  let current = "intro";
  let enclosingH2;
  let inFence = false;
  let fenceMarker = "";
  let fenceLength = 0;
  let fenceLang = "";
  let fence = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fenceMatch && !inFence && !(fenceMatch[1][0] === "`" && fenceMatch[2].includes("`"))) {
      inFence = true;
      fenceMarker = fenceMatch[1][0];
      fenceLength = fenceMatch[1].length;
      fenceLang = fenceMatch[2].trim().split(/\s+/, 1)[0].toLowerCase();
      fence = [];
      continue;
    }
    const closingFence = inFence
      ? line.match(new RegExp(`^ {0,3}${fenceMarker === "`" ? "`" : "~"}{${fenceLength},}\\s*$`))
      : null;
    if (closingFence) {
      if (["sh", "shell", "bash", "zsh"].includes(fenceLang)) {
        shellSnippets.push(fence.join("\n").trim());
      }
      inFence = false;
      fenceMarker = "";
      fenceLength = 0;
      fenceLang = "";
      fence = [];
      continue;
    }
    if (inFence) {
      fence.push(line);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/);
    if (heading) {
      if (heading[1].length === 1) {
        current = undefined;
        enclosingH2 = undefined;
        continue;
      }
      const headingText = heading[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      current = normalizeHeading(headingText);
      sections[current] = sections[current] ?? "";
      if (heading[1].length === 2) enclosingH2 = current;
      continue;
    }
    for (const target of new Set([current, enclosingH2].filter(Boolean))) {
      sections[target] = `${sections[target] ?? ""}${line}\n`;
    }
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

async function findContainingGitRoot(start) {
  let candidate = start;
  while (true) {
    if (await exists(path.join(candidate, ".git"))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) return undefined;
    candidate = parent;
  }
}

async function exists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
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
      RISKY_COMMANDS.some((pattern) => pattern.test(candidate)) || hasDestructiveCleanup(candidate)
    )
  };
}

function hasDestructiveCleanup(command) {
  for (const segment of command.split(/(?:&&|\|\||[;|])/u)) {
    const tokens = segment.trim().split(/\s+/u);
    const gitCleanArguments = findGitCleanArguments(tokens);
    if (gitCleanArguments) {
      const options = gitCleanArguments.filter((token) => token.startsWith("-"));
      const dryRun = options.some((token) => token === "--dry-run" || /^-[^-]*n/u.test(token));
      const forced = options.some((token) => token === "--force" || /^-[^-]*f/u.test(token));
      if (forced && !dryRun) return true;
    }

    if (tokens[0] === "rm") {
      const options = tokens.slice(1).filter((token) => token.startsWith("-"));
      const recursive = options.some((token) => token === "--recursive" || /^-[^-]*[rR]/u.test(token));
      const forced = options.some((token) => token === "--force" || /^-[^-]*f/u.test(token));
      if (recursive && forced) return true;
    }
  }
  return false;
}

function findGitCleanArguments(tokens) {
  if (tokens[0] !== "git") return undefined;

  const valueOptions = new Set(["-c", "--config-env", "--git-dir", "--work-tree", "--namespace", "--super-prefix"]);
  const flagOptions = new Set([
    "--bare", "--literal-pathspecs", "--glob-pathspecs", "--noglob-pathspecs",
    "--icase-pathspecs", "--no-optional-locks", "--no-pager", "--paginate"
  ]);

  for (let index = 1; index < tokens.length;) {
    const token = tokens[index];
    if (token === "clean") return tokens.slice(index + 1);
    if (valueOptions.has(token)) {
      if (tokens[index + 1] === undefined) return undefined;
      index += 2;
      continue;
    }
    if (/^-c.+/u.test(token) || /^--(?:config-env|git-dir|work-tree|namespace|super-prefix)=.+/u.test(token) || flagOptions.has(token)) {
      index += 1;
      continue;
    }
    return undefined;
  }
  return undefined;
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
