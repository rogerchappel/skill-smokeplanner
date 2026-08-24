# Cleanup Risk Demo

## When To Use
Use this fixture to verify cleanup command classification.

## Required Tools Or Inputs
A disposable working directory.

## Side-Effect Boundaries
Never execute the listed commands from this fixture.

## Approval Requirements
Maintainer approval is required before destructive cleanup.

## Examples
```sh
git clean -fdx
git clean ./build --force -d
git clean -ndx
git clean --dry-run -fd
git status --short
rm -rf dist
rm ./coverage -fr
rm --recursive ./cache --force
rm -r logs
rm -f artifact.txt
```

## Validation Workflow
Inspect the generated plan without executing its commands.
