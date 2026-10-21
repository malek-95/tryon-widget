#!/usr/bin/env node
// Copie le widget TryOn (tryon.js + moteur MediaPipe + modèle de pose) dans le dossier public d'un site.
//
//   npx tryon-web init              → public/tryon/ (ou ./tryon/ s'il n'y a pas de dossier public)
//   npx tryon-web init static       → static/tryon/
import { cp, mkdir, stat, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const exists = (p) => stat(p).then(() => true, () => false);

const HELP = `TryOn Web — essayage virtuel dans le navigateur

Utilisation :
  npx tryon-web init [dossier-public]

  Copie le widget dans <dossier-public>/tryon/.
  Par défaut : "public" s'il existe dans le projet, sinon le dossier courant.

Exemples :
  npx tryon-web init            # Vite, React, Next.js, Vue… (dossier public/)
  npx tryon-web init static     # SvelteKit, Hugo
  npx tryon-web init .          # site HTML simple
`;

async function init(arg) {
  const cwd = process.cwd();
  const publicDir = arg ? path.resolve(cwd, arg) : (await exists(path.join(cwd, 'public')) ? path.join(cwd, 'public') : cwd);
  const dest = path.join(publicDir, 'tryon');

  const mediapipeDir = path.dirname(require.resolve('@mediapipe/tasks-vision'));
  const model = path.join(pkgRoot, 'public/tryon/models/pose_landmarker_lite.task');
  if (!(await exists(model))) throw new Error(`modèle de pose introuvable (${model}). Réinstallez le paquet tryon-web.`);

  await mkdir(path.join(dest, 'vendor'), { recursive: true });
  await mkdir(path.join(dest, 'models'), { recursive: true });
  await cp(path.join(pkgRoot, 'public/tryon/tryon.js'), path.join(dest, 'tryon.js'));
  await cp(path.join(mediapipeDir, 'vision_bundle.mjs'), path.join(dest, 'vendor/vision_bundle.mjs'));
  await cp(path.join(mediapipeDir, 'wasm'), path.join(dest, 'vendor/wasm'), { recursive: true });
  await cp(model, path.join(dest, 'models/pose_landmarker_lite.task'));
  for (const f of ['LICENSE', 'NOTICE']) await cp(path.join(pkgRoot, f), path.join(dest, f));

  const { version } = JSON.parse(await readFile(path.join(pkgRoot, 'package.json'), 'utf8'));
  const rel = path.relative(cwd, dest) || '.';
  console.log(`✓ TryOn ${version} copié dans ${rel}/`);
  console.log(`
Ajoutez dans votre page :

  <script src="/tryon/tryon.js" data-lang="fr" defer></script>
  <button data-tryon-type="top" data-tryon-image="/images/tshirt.png" data-tryon-name="T-shirt">Essayer</button>

Documentation : https://github.com/malek-95/tryon-widget#readme`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'init') {
  init(arg).catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
} else {
  console.log(HELP);
  if (cmd && cmd !== 'help' && cmd !== '--help' && cmd !== '-h') process.exit(1);
}
