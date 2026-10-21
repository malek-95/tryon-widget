// Test de rendu sans caméra ni modèle : un détecteur simulé renvoie les points connus
// du mannequin (tests/fixtures/lm.json) et un masque de silhouette calculé depuis l'image.
// Produit des captures dans tests/output/ et échoue s'il y a une erreur dans la page.
//
//   npm run test:render
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'tests/fixtures');
const out = path.join(root, 'tests/output');
fs.mkdirSync(out, { recursive: true });
const lm = JSON.parse(fs.readFileSync(path.join(fixtures, 'lm.json'), 'utf8'));

const PORT = 3399;
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

  await page.evaluate((lm) => {
    TryOn.init({
      detector: async (src) => {
        const W = src.width, H = src.height;
        const lms = Array.from({ length: 33 }, (_, i) => lm[i]
          ? { x: lm[i][0] / W, y: lm[i][1] / H, z: 0, visibility: lm[i][1] < H ? 0.99 : 0.3 }
          : { x: 0.5, y: 0.5, z: 0, visibility: 0.1 });
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.drawImage(src, 0, 0);
        const d = x.getImageData(0, 0, W, H);
        for (let i = 0; i < d.data.length; i += 4) {
          const bg = Math.abs(d.data[i] - 225) + Math.abs(d.data[i + 1] - 222) + Math.abs(d.data[i + 2] - 215) < 20;
          d.data[i + 3] = bg ? 0 : 255;
        }
        x.putImageData(d, 0, 0);
        return { lms, mask: c };
      }
    });
  }, lm);

  const cases = [
    ['person.png', 'tenue-complete.png', '[data-tryon-group="look-1"]'],
    ['person.png', 'jean.png', '.card:nth-child(2) .try'],
    ['seated.png', 'assis-tshirt.png', '.card:nth-child(1) .try']
  ];
  for (const [file, name, selector] of cases) {
    await page.evaluate((s) => document.querySelector(s).click(), selector);
    await new Promise((r) => setTimeout(r, 300));
    const input = await page.evaluateHandle(() => document.querySelector('[data-tryon-root]').shadowRoot.querySelector('input[type=file]'));
    await input.uploadFile(path.join(fixtures, file));
    await new Promise((r) => setTimeout(r, 1000));
    const status = await page.evaluate(() => document.querySelector('[data-tryon-root]').shadowRoot.querySelector('.status').textContent);
    const canvas = await page.evaluateHandle(() => document.querySelector('[data-tryon-root]').shadowRoot.querySelector('canvas'));
    await canvas.screenshot({ path: path.join(out, name) });
    await page.evaluate(() => TryOn.close());
    console.log(`✓ ${name}${status ? `  (message : ${status})` : ''}`);
  }
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error('✗ Erreurs dans la page :\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Captures dans ${path.relative(root, out)}/`);
