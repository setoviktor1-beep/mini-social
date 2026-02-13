# Legal Pages Manual Smoke Checklist

Use this checklist when no dedicated test framework is configured.

## Routes

1. Open `/legal/privacy` and verify page loads (HTTP 200 in browser/network panel).
2. Confirm page contains heading `Privacy Policy`.
3. Open `/legal/terms` and verify page loads (HTTP 200 in browser/network panel).
4. Confirm page contains heading `Terms of Service`.

## Navigation

1. In footer, click `Privacy` and verify it opens `/legal/privacy`.
2. In footer, click `Terms` and verify it opens `/legal/terms`.
3. In footer, click `Contact` and verify it keeps current behavior (`/legal/contact` in this project).

## Accessibility Basics

1. Verify headings are in order (`h1` then section `h2`).
2. Tab through table-of-contents links and confirm visible focus styles.
3. Click a table-of-contents item and confirm anchor scrolling to the matching section.
