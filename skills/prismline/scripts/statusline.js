// prismline — rainbow status line for Claude Code (https://github.com/satetapongsa/skill-status-l)
const { execSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch {}

  const W = 24; // bar width in cells
  const R = '\x1b[0m', B = '\x1b[1m', DIM = '\x1b[2m';

  // HSL hue (0-360) -> truecolor fg
  const hue = (h, s = 0.85, l = 0.62) => {
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    return `\x1b[38;2;${f(0)};${f(8)};${f(4)}m`;
  };
  const rainbow = (s, start = 0, span = 300) => {
    const ch = [...s];
    return ch.map((c, i) => hue(start + (span * i) / Math.max(1, ch.length - 1)) + c).join('') + R;
  };

  // Row colours: red → orange → yellow → green → cyan → blue → violet → pink
  const ROW = [0, 30, 55, 120, 180, 215, 270, 310];
  let row = 0;
  const label = s => { const h = ROW[row++ % ROW.length]; return `${hue(h)}${B}▌${s.padEnd(7)}${R}`; };

  // Severity colour for numbers
  const level = p => hue(p >= 90 ? 0 : p >= 75 ? 25 : p >= 50 ? 50 : p >= 25 ? 90 : 130);

  // Bar: each filled cell takes its rainbow hue by position (green → red as it fills)
  const PART = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
  const cellHue = i => 140 - (140 * i) / (W - 1);
  const bar = (p, marker) => {
    const v = (Math.min(100, Math.max(0, p)) / 100) * W;
    const full = Math.floor(v);
    const part = PART[Math.floor((v - full) * 8)];
    const m = marker != null ? Math.min(W - 1, Math.floor((marker / 100) * W)) : -1;
    let out = '';
    for (let i = 0; i < W; i++) {
      if (i < full) out += hue(cellHue(i)) + '█';
      else if (i === full && part) out += hue(cellHue(i)) + part;
      else if (i === m) out += `${R}\x1b[38;2;255;255;255m┊`;
      else out += `${R}${DIM}░`;
    }
    return out + R;
  };

  const pct = p => `${B}${level(p)}${p.toFixed(1).padStart(5)}%${R}`;
  const k = n => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : String(n));
  const sep = `${DIM} │ ${R}`;
  const dim = s => `${DIM}${s}${R}`;
  const dur = ms => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}m${String(s).padStart(2, '0')}s`;
  };

  const toMs = ts => {
    if (!ts) return NaN;
    return typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : Date.parse(ts);
  };
  const resetIn = t => {
    if (isNaN(t)) return '';
    const mins = Math.max(0, Math.round((t - Date.now()) / 60000));
    const clock = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = mins >= 1440 ? new Date(t).toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' : '';
    const left = mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
      : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return `${hue(195)}⟳ ${day}${clock}${R} ${dim('in ' + left)}`;
  };

  const lines = [];

  // ── MODEL: name · version · output style · session time
  const model = d.model?.display_name || d.model?.id || '?';
  const extras = [];
  if (d.version) extras.push(`${hue(270)}v${d.version}${R}`);
  if (d.output_style?.name && d.output_style.name !== 'default') extras.push(`${hue(310)}✎ ${d.output_style.name}${R}`);
  lines.push(`${label('MODEL')}${B}${rainbow(model, 0, 300)}${extras.length ? sep + extras.join(sep) : ''}`);

  // ── DIR: folder · git branch + dirty count
  const cwd = d.workspace?.current_dir || d.cwd || process.cwd();
  let git = '';
  try {
    const opt = { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 800 };
    const br = execSync('git rev-parse --abbrev-ref HEAD', opt).toString().trim();
    const dirty = execSync('git status --porcelain', opt).toString().split('\n').filter(Boolean).length;
    git = `${sep}${hue(130)}⎇ ${br}${R}${dirty ? ` ${hue(40)}±${dirty}${R}` : ` ${hue(130)}✓${R}`}`;
  } catch {}
  lines.push(`${label('DIR')}${hue(55)}📁 ${path.basename(cwd) || cwd}${R}${git}`);

  // ── COST: $ · burn rate · duration · API time · lines changed
  const c = d.cost || {};
  if (c.total_cost_usd != null || c.total_duration_ms != null) {
    const parts = [];
    if (c.total_cost_usd != null) {
      parts.push(`${B}${hue(140)}$${c.total_cost_usd.toFixed(3)}${R}`);
      if (c.total_duration_ms > 60000) parts.push(dim(`$${(c.total_cost_usd / (c.total_duration_ms / 3600000)).toFixed(2)}/h`));
    }
    if (c.total_duration_ms != null) parts.push(`${hue(180)}⏱ ${dur(c.total_duration_ms)}${R}`);
    if (c.total_api_duration_ms != null) parts.push(`${hue(200)}⚡api ${dur(c.total_api_duration_ms)}${R}`);
    if (c.total_lines_added != null || c.total_lines_removed != null)
      parts.push(`${hue(120)}+${c.total_lines_added || 0}${R} ${hue(0)}-${c.total_lines_removed || 0}${R}`);
    lines.push(`${label('COST')}${parts.join(sep)}`);
  }

  // ── CTX: bar · % · used/total · left · token breakdown
  const cw = d.context_window || {};
  const size = cw.context_window_size || 200000;
  const cu = cw.current_usage;
  const used = cu
    ? (cu.input_tokens || 0) + (cu.cache_creation_input_tokens || 0) + (cu.cache_read_input_tokens || 0)
    : null;
  const ctxPct = cw.used_percentage ?? (used != null ? (used / size) * 100 : null);
  if (ctxPct != null) {
    const usedTok = used ?? Math.round((ctxPct / 100) * size);
    lines.push(`${label('CTX')}${bar(ctxPct)} ${pct(ctxPct)}  ${B}${k(usedTok)}${R}${dim('/' + k(size))}${sep}${hue(170)}${k(size - usedTok)} left${R}`);
    if (cu) {
      const t = [
        [hue(0), 'in', cu.input_tokens],
        [hue(55), 'cache+', cu.cache_creation_input_tokens],
        [hue(130), 'cache↺', cu.cache_read_input_tokens],
        [hue(260), 'out', cu.output_tokens],
      ].filter(x => x[2] != null).map(([col, n, v]) => `${col}${n} ${k(v)}${R}`);
      if (t.length) lines.push(`${label('TOKENS')}${t.join(sep)}`);
    }
  }

  // ── Plan usage limits with pace marker (┊ = where you'd be at an even pace)
  const rl = d.rate_limits || {};
  const names = { five_hour: '5H', seven_day: '7D', seven_day_opus: '7D OP', seven_day_sonnet: '7D SN' };
  const windows = { five_hour: 5 * 3600e3, seven_day: 7 * 86400e3, seven_day_opus: 7 * 86400e3, seven_day_sonnet: 7 * 86400e3 };
  for (const [key, r] of Object.entries(rl)) {
    if (!r || r.used_percentage == null) continue;
    const name = names[key] || key.replace(/_/g, ' ').toUpperCase().slice(0, 6);
    const t = toMs(r.resets_at);
    let pace = null, paceTxt = '';
    if (windows[key] && !isNaN(t)) {
      pace = Math.min(100, Math.max(0, (1 - (t - Date.now()) / windows[key]) * 100));
      const diff = r.used_percentage - pace;
      paceTxt = `${sep}${diff > 5 ? hue(0) + '▲' : diff < -5 ? hue(130) + '▼' : hue(55) + '≈'}${Math.abs(diff).toFixed(0)}% pace${R}`;
    }
    lines.push(`${label(name)}${bar(r.used_percentage, pace)} ${pct(r.used_percentage)}  ${resetIn(t)}${paceTxt}`);
  }

  process.stdout.write(lines.join('\n'));
});
