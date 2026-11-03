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

The media archive selector uses a visible label and native select semantics, appears only when
there is more than one event choice or an invalid selection needs recovery, and keeps its selection
in the URL. Its populated state is covered by keyboard-operable browser interaction and axe scans
in both themes at phone and desktop
widths; the production media archive is scanned separately. The browser suite also checks mobile
navigation, touch interactions, visible focus, reduced motion, and enlarged-text reflow.

The automated checks do not represent physical-device testing, screen-reader review, or
browser-toolbar zoom testing. Those remain supplemental manual release checks.
