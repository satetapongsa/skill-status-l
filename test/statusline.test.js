// Smoke tests for statusline.js — run with `npm test` (node:test, no dependencies)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const script = path.join(__dirname, '../skills/prismline/scripts/statusline.js');
const run = data => execFileSync('node', [script], { input: typeof data === 'string' ? data : JSON.stringify(data) })
  .toString().replace(/\x1b\[[0-9;]*m/g, '');

test('survives empty or invalid input', () => {
  assert.match(run(''), /MODEL/);
  assert.match(run('not json'), /MODEL/);
});

test('shows model and context usage', () => {
  const out = run({ model: { display_name: 'Opus' }, context_window: { used_percentage: 42, context_window_size: 200000 } });
  assert.match(out, /Opus/);
  assert.match(out, /42\.0%/);
  assert.match(out, /84k\/200k/);
});

test('shows cost and rate limits', () => {
  const out = run({
    cost: { total_cost_usd: 1.5, total_duration_ms: 120000 },
    rate_limits: { five_hour: { used_percentage: 30, resets_at: Math.floor(Date.now() / 1000) + 3600 } },
  });
  assert.match(out, /\$1\.500/);
  assert.match(out, /5H/);
  assert.match(out, /pace/);
});
