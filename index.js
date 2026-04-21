'use strict';
const { execSync } = require('child_process');
const path = require('path');

const serverDir = path.join(__dirname, 'tg', 'server');

console.log('==> Installing server dependencies...');
execSync('npm install --production=false', { cwd: serverDir, stdio: 'inherit' });

console.log('==> Generating Prisma client...');
execSync('npx prisma generate', { cwd: serverDir, stdio: 'inherit' });

console.log('==> Building TypeScript...');
execSync('npm run build', { cwd: serverDir, stdio: 'inherit' });

// Free port 3000 from bothost http-wrapper before starting Fastify
try {
  execSync('fuser -k 3000/tcp', { stdio: 'ignore', shell: true });
} catch (_) {}

setTimeout(() => {
  console.log('==> Starting server...');
  require(path.join(serverDir, 'dist', 'index.js'));
}, 500);
