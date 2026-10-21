// Serveur Express : héberge le widget, le moteur WebAssembly et le modèle de pose.
// Aucune image d'utilisateur n'arrive ici : tout le traitement se fait dans le navigateur.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Sites autorisés à intégrer le widget, séparés par des virgules. "*" = tous.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);

app.disable('x-powered-by');

app.use('/tryon', (req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.use('/tryon', express.static(path.join(root, 'public/tryon'), {
  setHeaders(res, file) {
    if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    if (file.endsWith('.task')) res.setHeader('Content-Type', 'application/octet-stream');
    // moteur et modèle : cache long ; tryon.js : cache court pour pouvoir le mettre à jour
    const long = /[\\/](vendor|models)[\\/]/.test(file);
    res.setHeader('Cache-Control', long ? 'public, max-age=2592000, immutable' : 'public, max-age=300');
  }
}));

app.use('/', express.static(path.join(root, 'demo')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TryOn prêt sur http://localhost:${PORT}`);
  console.log(`Widget : http://localhost:${PORT}/tryon/tryon.js`);
});
