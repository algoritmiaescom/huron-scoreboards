# Architecture decision records

An ADR records a decision that shapes the structure of the system: technology selection, module
boundaries, data flow, persistence, and integration points. Write one when the decision is
expensive to reverse and a future contributor would otherwise have to guess why the system is
shaped this way.

## What does not belong here

| Topic                                     | Where it belongs                             |
| ----------------------------------------- | -------------------------------------------- |
| Coding standards and language conventions | `docs/best-practices.md`, enforced in config |
| Lint, format, and build rules             | `eslint.config.js`, `prettier.config.js`     |
| Visual identity, palette, and theming     | `docs/design.md`, `src/app/theme/`           |
| Product scope, modules, and features      | `docs/product-scope.md`                      |
| Folder layout                             | `docs/folder-structure.md`                   |
| Testing approach and coverage gates       | `docs/testing.md`                            |
| Accessibility requirements                | `docs/accessibility.md`                      |
| Contribution workflow                     | `CONTRIBUTING.md`                            |

Prefer an enforceable rule over prose: if a convention can be a lint rule or a type, add it
there instead of writing a document about it.

## Format

Use `NNNN-short-title.md` with `Status`, `Decision`, and `Consequences` sections. Status is
`Accepted`, `Superseded by <ADR>`, or `Rejected`. Supersede a record instead of editing a decision
that was already made; the history is the point.

Keep a record short. State the decision and what it costs, and link to the document that carries
the detail rather than restating it here. This directory listing is the index; there is no
separate table to maintain.
