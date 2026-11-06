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
Development uses the same routing format. Hash routes are client-rendered and cannot be emitted
as independently crawlable static pages under GitHub Pages. The root document provides canonical
and social metadata; the client updates the title and description after route loading. Route-
specific static SEO requires revisiting this routing decision and the deployment layout.

Moving to a custom domain or another hosting layout requires updating the build base path. Pages
deployments wait for the full CI gate, including Python ingestion checks.

See the [deployment instructions](../../README.md#deployment) for setup and redeployment.
