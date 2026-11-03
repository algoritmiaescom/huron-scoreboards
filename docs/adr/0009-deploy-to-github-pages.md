# ADR 0009: Deploy to GitHub Pages

## Status

Accepted

## Decision

Publish the static Vite build to GitHub Pages using the official artifact and deployment
actions in CI. Deploy only `main`, after all existing validation and end-to-end jobs succeed,
using the built-in GitHub token with Pages and OIDC permissions limited to the deployment job.
Do not maintain a generated branch.

Use React Router's hash router. GitHub Pages cannot rewrite arbitrary paths to `index.html`;
hash routes preserve shared links, query filters, and refreshes without a custom 404 redirect.
Build for the repository's subdirectory and resolve public assets through Vite's base URL.

## Consequences

Hosting needs no backend, deployment credentials, or additional provider. The repository must
enable GitHub Actions as its Pages source. Production continues to ship only validated real
archive data.

Public links include `#`, such as `/huron-scoreboards/#/scoreboards?contest=<id>`.
Development uses the same routing format. Moving to a custom domain or another hosting layout
requires updating the build base path. Pages deployments wait for the full CI gate, including
Python ingestion checks.

See the [deployment instructions](../../README.md#deployment) for setup and redeployment.
