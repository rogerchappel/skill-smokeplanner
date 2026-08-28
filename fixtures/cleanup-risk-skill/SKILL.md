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
git -C . clean -fd
git -C./sandbox clean ./build --force -d
git --work-tree=./sandbox clean -d --force
git -C /tmp/example push
git -C/tmp/example commit -m release
git --git-dir .git merge topic
git --work-tree=./sandbox rebase main
git --namespace demo reset --hard HEAD
git --no-pager tag v1.0.0
git clean -ndx
git clean --dry-run -fd
git -C . clean -nfd
git status --short
echo /tmp/git push
printf 'git commit'
./tools/git merge
rm -rf dist
rm ./coverage -fr
rm --recursive ./cache --force
rm -r logs
rm -f artifact.txt
```

## Validation Workflow
Inspect the generated plan without executing its commands.
