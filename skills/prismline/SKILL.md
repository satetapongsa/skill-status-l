---
name: prismline
description: Install, customize, or remove prismline, a rainbow truecolor status line for Claude Code that shows model, folder, git branch, cost, context-window usage, token breakdown, and plan usage limits (5h / 7d) with pace markers. Use when the user asks to set up, change, or uninstall prismline or this status line.
---

# prismline

A multi-line, truecolor status line for Claude Code. The script is in
`scripts/statusline.js` and the installer is `scripts/install.js`. Both need only Node.js 18+.

## What it shows

| Row      | Content                                                                  |
|----------|--------------------------------------------------------------------------|
| `MODEL`  | Model name (rainbow), Claude Code version, output style                  |
| `DIR`    | Current folder, git branch, dirty file count (or ✓ when clean)           |
| `COST`   | Session cost, $/hour, wall time, API time, lines added/removed           |
| `CTX`    | Context-window bar, % used, tokens used/total, tokens left               |
| `TOKENS` | input / cache write / cache read / output tokens                         |
| `5H` `7D`| Plan usage bars with reset time and a `┊` pace marker (▲ ahead, ▼ behind)|

## Install

Run the installer from this skill's folder:

```bash
node "<skill-dir>/scripts/install.js"
```

It copies `statusline.js` to `~/.claude/statusline.js`, backs up any existing one to
`statusline.backup.js`, saves the old `statusLine` setting, and points
`~/.claude/settings.json` at the new script. Tell the user to restart Claude Code.

Verify with sample input:

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":42,"context_window_size":200000}}' | node ~/.claude/statusline.js
```

## Uninstall

```bash
node "<skill-dir>/scripts/install.js" --uninstall
```

Restores the previous `statusLine` setting (or removes it if there was none).

## Customize

Edit `~/.claude/statusline.js` (the installed copy). Common tweaks:

- **Bar width:** `const W = 24;`
- **Row label colours:** the `ROW` hue array (0–360).
- **Severity thresholds:** the `level` function (90 / 75 / 50 / 25 %).
- **Hide a row:** remove the matching `lines.push(...)` block.
- **Terminal without truecolor:** replace `hue()` output with 16-colour codes like `\x1b[32m`.

After editing, re-run the sample-input command above to check it still renders.
