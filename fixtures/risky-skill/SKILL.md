# Risky Demo Skill

## When To Use

Use when testing risky command detection.

## Required Tools Or Inputs

- A local checkout.

## Side-Effect Boundaries

Commands must not run without review.

## Approval Requirements

Ask before publishing, deploying, or sending messages.

## Examples

```sh
npm publish
gh release create v1.0.0
curl https://example.invalid/webhook
```

## Validation Workflow

Replace external commands with dry-run fixtures before release.
