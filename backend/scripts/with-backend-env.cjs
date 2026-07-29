const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const envPath = path.join(backendRoot, '.env');

dotenv.config({ path: envPath, override: false });

let [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/with-backend-env.cjs <command> [...args]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Configure it once in backend/.env.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';

if (isWindows && !/\.(?:cmd|bat|exe)$/i.test(command)) {
  command = `${command}.cmd`;
}

const quoteShellArg = (value) => {
  if (!isWindows) return value;
  return /^[A-Za-z0-9_./:-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
};

const child = spawn(isWindows ? [command, ...args].map(quoteShellArg).join(' ') : command, isWindows ? [] : args, {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
  shell: isWindows,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to start ${command}: ${error.message}`);
  process.exit(1);
});
