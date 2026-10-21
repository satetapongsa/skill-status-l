#!/usr/bin/env node
// prismline installer: sets up (or removes) the status line for Claude Code.
//   npx github:satetapongsa/skill-status-l             install to ~/.claude and point settings.json at it
//   npx github:satetapongsa/skill-status-l --uninstall restore the previous statusLine setting
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = path.join(os.homedir(), '.claude');
const target = path.join(home, 'statusline.js');
const settingsFile = path.join(home, 'settings.json');
const backupFile = path.join(home, 'prismline.settings-backup.json');

const readJson = f => {
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { console.error(`Cannot parse ${f}; fix it first.`); process.exit(1); }
};
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');

fs.mkdirSync(home, { recursive: true });
const settings = readJson(settingsFile);

if (process.argv.includes('--uninstall')) {
  const prev = readJson(backupFile).statusLine;
  if (prev) settings.statusLine = prev; else delete settings.statusLine;
  writeJson(settingsFile, settings);
  if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
  console.log('prismline removed. Restart Claude Code to apply.');
  process.exit(0);
}

// Keep the user's existing status line so --uninstall can restore it
if (fs.existsSync(target)) fs.copyFileSync(target, target.replace(/\.js$/, '.backup.js'));
if (!fs.existsSync(backupFile)) writeJson(backupFile, { statusLine: settings.statusLine ?? null });

fs.copyFileSync(path.join(__dirname, 'statusline.js'), target);
settings.statusLine = {
  type: 'command',
  command: `node "${target.replace(/\\/g, '/')}"`,
  padding: 0,
};
writeJson(settingsFile, settings);

console.log(`Installed ${target}`);
console.log(`Updated  ${settingsFile}`);
console.log('Restart Claude Code (or start a new session) to see it.');
