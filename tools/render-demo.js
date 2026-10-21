#!/usr/bin/env node
// Renders prismline output for sample sessions into terminal-style SVGs in assets/.
//   node tools/render-demo.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'skills/prismline/scripts/statusline.js');

// A throwaway git repo so the DIR row shows a branch and dirty files
const repo = path.join(os.tmpdir(), 'prismline-demo', 'my-app');
fs.rmSync(path.dirname(repo), { recursive: true, force: true });
fs.mkdirSync(repo, { recursive: true });
const sh = c => execSync(c, { cwd: repo, stdio: 'ignore' });
sh('git init -q -b main');
sh('git -c user.name=demo -c user.email=demo@example.com commit -q --allow-empty -m init');
['a.ts', 'b.ts', 'c.ts'].forEach(f => fs.writeFileSync(path.join(repo, f), ''));

const now = Math.floor(Date.now() / 1000);
const scenarios = {
  demo: {
    title: 'claude — my-app',
    data: {
      model: { display_name: 'Opus 5.5' }, version: '2.3.0',
      workspace: { current_dir: repo },
      cost: { total_cost_usd: 1.234, total_duration_ms: 2112000, total_api_duration_ms: 520000, total_lines_added: 120, total_lines_removed: 45 },
      context_window: { context_window_size: 200000, current_usage: { input_tokens: 12, cache_creation_input_tokens: 2100, cache_read_input_tokens: 81900, output_tokens: 1200 } },
      rate_limits: {
        five_hour: { used_percentage: 30, resets_at: now + 7800 },
        seven_day: { used_percentage: 55, resets_at: now + 2 * 86400 + 4 * 3600 },
      },
    },
  },
  'demo-heavy': {
    title: 'claude — my-app (heavy session)',
    data: {
      model: { display_name: 'Opus 5.5' }, version: '2.3.0', output_style: { name: 'Explanatory' },
      workspace: { current_dir: repo },
      cost: { total_cost_usd: 18.42, total_duration_ms: 9420000, total_api_duration_ms: 4100000, total_lines_added: 2310, total_lines_removed: 877 },
      context_window: { context_window_size: 200000, current_usage: { input_tokens: 840, cache_creation_input_tokens: 12400, cache_read_input_tokens: 165000, output_tokens: 9800 } },
      rate_limits: {
        five_hour: { used_percentage: 92, resets_at: now + 1500 },
        seven_day: { used_percentage: 71, resets_at: now + 3 * 86400 },
      },
    },
  },
};

// Minimal ANSI SGR parser: truecolor fg, bold, dim, reset
function parse(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    const runs = [];
    let st = { fg: null, bold: false, dim: false };
    const re = /\x1b\[([0-9;]*)m|([^\x1b]+)/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[2]) { runs.push({ text: m[2], ...st }); continue; }
      const p = m[1].split(';').map(Number);
      for (let i = 0; i < p.length; i++) {
        if (p[i] === 0) st = { fg: null, bold: false, dim: false };
        else if (p[i] === 1) st = { ...st, bold: true };
        else if (p[i] === 2) st = { ...st, dim: true };
        else if (p[i] === 38 && p[i + 1] === 2) { st = { ...st, fg: `rgb(${p[i + 2]},${p[i + 3]},${p[i + 4]})` }; i += 4; }
      }
    }
    lines.push(runs);
  }
  return lines;
}

const width = s => [...s].reduce((w, c) => w + (c.codePointAt(0) > 0x1f000 ? 2 : 1), 0);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(lines, title) {
  const CW = 8.6, LH = 22, PAD = 22, TOP = 44;
  const cols = Math.max(...lines.map(l => l.reduce((w, r) => w + width(r.text), 0)));
  const W = Math.ceil(cols * CW + PAD * 2), H = TOP + lines.length * LH + PAD;
  let body = '';
  lines.forEach((runs, row) => {
    let col = 0;
    const y = TOP + row * LH + 14;
    for (const r of runs) {
      const w = width(r.text);
      const attrs = [
        `x="${(PAD + col * CW).toFixed(1)}"`, `y="${y}"`,
        `textLength="${(w * CW).toFixed(1)}"`, 'lengthAdjust="spacingAndGlyphs"',
        `fill="${r.fg || '#c9d1d9'}"`,
        r.bold ? 'font-weight="700"' : '',
        r.dim ? 'opacity="0.45"' : '',
      ].filter(Boolean).join(' ');
      if (r.text.trim()) body += `<text ${attrs} xml:space="preserve">${esc(r.text)}</text>\n`;
      col += w;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<rect width="${W}" height="30" rx="10" fill="#161b22"/><rect y="20" width="${W}" height="10" fill="#161b22"/>
<circle cx="18" cy="15" r="6" fill="#ff5f57"/><circle cx="38" cy="15" r="6" fill="#febc2e"/><circle cx="58" cy="15" r="6" fill="#28c840"/>
<text x="${W / 2}" y="19" text-anchor="middle" fill="#8b949e" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12">${esc(title)}</text>
<g font-family="'Cascadia Mono','JetBrains Mono',Menlo,Consolas,monospace" font-size="14">
${body}</g>
</svg>
`;
}

fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
for (const [name, { title, data }] of Object.entries(scenarios)) {
  const out = execFileSync('node', [script], { input: JSON.stringify(data) }).toString();
  fs.writeFileSync(path.join(root, 'assets', `${name}.svg`), svg(parse(out), title));
  console.log(`assets/${name}.svg`);
}
