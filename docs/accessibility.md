# Accessibility

Accessibility is a release requirement.

- Use native semantic elements before ARIA.
- Give every interactive control an accessible name.
- Support keyboard-only operation and visible focus.
- Maintain sufficient color contrast through theme tokens.
- Do not encode score meaning by color alone.
- Ensure score updates remain understandable to assistive technology.

ESLint checks JSX accessibility rules. Playwright runs axe against critical pages. Automated
checks do not replace keyboard and screen-reader review for new workflows.
