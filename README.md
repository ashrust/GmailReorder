# Gmail Reorder (Chrome MV3)

A Chrome extension that reorders Gmail inbox rows visually without breaking Gmail click handlers.

## Re-order modes

The extension injects a compact star-icon dropdown to the right of the Gmail logo with these options:

1. `Stars`
2. `Subject`
3. `Default`

Selection is persisted in `localStorage` under `gmailReorder.mode` with valid values:

- `default`
- `subject`
- `star`

## Star mode behavior

In `star color` mode, rows are sorted by:

1. Priority labels first: exact label chip text `SR Founder` or `SR Grant Founder`
2. Star color priority: `none`, `purple`, `red`, `yellow`
3. Newest timestamp first within the same group

Unread rows are treated as `none`.

## Stability guards

To avoid UI jitter and action conflicts, reordering pauses when:

- A star control was clicked in the last second
- The mouse is currently hovering any inbox row
- Archive/reply was triggered in the last 1200ms

The extension also debounces inbox mutation updates before applying reorder.

## Security policy (public repository)

This repository is public. Do not commit secrets.

1. Never commit API keys, access tokens, credentials, or private URLs.
2. Do not add remote network calls from the content script.
3. Do not add dynamic code execution (`eval`, `new Function`).
4. Keep extension scope least-privilege (`*://mail.google.com/*`).

CI enforces secret scanning and extension safety checks on pull requests and pushes.

## Local checks

Run these before pushing:

```bash
gitleaks detect --source . --no-git --redact
```

## Install (Chrome)

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked` and select this folder.
4. Open Gmail inbox and use the `Re-order` dropdown.
