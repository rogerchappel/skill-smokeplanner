# Script Risk Skill

## When To Use
Use this fixture to verify package-script inspection.

## Required Tools Or Inputs
A local package manifest.

## Side-Effect Boundaries
Do not execute package scripts while planning.

## Approval Requirements
Review risky commands before running them.

## Examples
```sh
NPM PUBLISH
```

## Validation Workflow
Inspect the generated plan.
