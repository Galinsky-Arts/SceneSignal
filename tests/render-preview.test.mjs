import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Render draft preview publishes the Vite output only after repository checks', () => {
  const spec = readFileSync('render-static.yaml','utf8');
  const vite = readFileSync('vite.config.mjs','utf8');
  assert.match(spec, /runtime: static/);
  assert.match(spec, /branch: main/);
  assert.match(spec, /staticPublishPath: web-dist/);
  assert.match(spec, /npm run core:prepare && npm ci --ignore-scripts && npm run check/);
  assert.match(vite, /outDir: '\.\.\/web-dist'/);
  assert.match(spec, /NODE_VERSION\s*\n\s*value: 24\.19\.0/);
  assert.doesNotMatch(spec, /DATABASE_URL|GITHUB_APP_PRIVATE_KEY|SECRET|privateKey|apiKey/);
});

test('Galinsky Labs preview is free, uses an external verified database and commits no secrets', () => {
  const spec = readFileSync('render.galinsky-labs.yaml', 'utf8');
  assert.match(spec, /plan: free/);
  assert.doesNotMatch(spec, /plan: (?!free)/);
  assert.match(spec, /startCommand: node scripts\/render-start\.mjs/);
  assert.match(spec, /healthCheckPath: \/healthz/);
  assert.match(spec, /key: BETTER_AUTH_SECRET\s*\n\s*generateValue: true/);
  assert.match(spec, /key: DATABASE_URL\s*\n\s*sync: false/);
  assert.doesNotMatch(spec, /^databases:|POSTGRES_EXTERNAL_HOST|postgres(?:ql)?:\/\/|npg_|tea-dbp1vrrl550s73c3dgrg/m);
  assert.match(readFileSync('render.yaml', 'utf8'), /POSTGRES_EXTERNAL_HOST/);
});
