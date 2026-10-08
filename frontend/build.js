'use strict';

// A tiny "build": copy src/ to dist/ and stamp which version this is.
// Real frameworks (React, Next.js, Vite) also produce a dist/ or build/ folder,
// and that folder is what gets uploaded to S3.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const dist = path.join(__dirname, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true });

const info = {
  version: (process.env.GITHUB_SHA || 'local').slice(0, 7),
  builtAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dist, 'build-info.json'), JSON.stringify(info, null, 2));

console.log(`Built frontend into dist/ (version ${info.version})`);
