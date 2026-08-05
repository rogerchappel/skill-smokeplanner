# Safe Neighbor Skill

## When To Use
Use this fixture to prevent broad substring matches.

## Required Tools Or Inputs
Local fixture files.

## Side-Effect Boundaries
The examples only print local labels.

## Approval Requirements
No approval is required for these local commands.

## Examples
```sh
node scripts/git-push-report.js
echo deployment
echo curlish
```

## Validation Workflow
Confirm the plan contains no risky-command warning.
