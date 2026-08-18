# Nested Sections Skill

## When To Use

### Scenario

Use this skill for local verification.

## Required Tools Or Inputs

### Runtime

Node.js 20 or newer.

## Side-Effect Boundaries

### Files

Read local fixtures without modifying them.

## Approval Requirements

### Local Checks

No approval is required for read-only local checks.

## Examples

### Smoke Plan

Run the fixture-backed command:

```sh
npm test
```

## Validation Workflow

### Assertions

Confirm the Markdown and JSON plans contain no missing-section warnings.
