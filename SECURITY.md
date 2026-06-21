# Security

`skill-smokeplanner` reads local skill files and prints a plan. It should not run commands, call external services, publish packages, send messages, or mutate accounts.

## Reporting

If a fixture or generated output accidentally includes private data, open a private security advisory or contact the maintainer directly. Include paths and commit SHAs, but do not repeat the private value.

## Boundaries

Any proposal to execute generated commands should be treated as a separate project with explicit approvals, sandboxing, and audit logs.
