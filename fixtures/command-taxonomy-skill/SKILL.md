# Command Taxonomy Skill

## When To Use
Use this fixture to verify risky command families.

## Required Tools Or Inputs
A local package manifest.

## Side-Effect Boundaries
Do not execute commands while planning.

## Approval Requirements
Review risky commands before running them.

## Examples
```sh
git commit -m release
gh issue close 42
pnpm publish
ssh example.invalid
```

## Validation Workflow
Inspect every generated warning and its command or script evidence.
