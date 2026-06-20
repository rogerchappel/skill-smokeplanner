# Release Candidate Notes

## 0.1.0

- Adds `plan` CLI with Markdown and JSON output.
- Parses skill headings, examples, validation workflows, and package scripts.
- Flags missing sections and risky external-action commands.
- Ships complete, sparse, and risky fixture skills.

## Verification

```sh
npm test
npm run check
npm run build
npm run smoke
bash scripts/validate.sh
```
