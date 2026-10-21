// Copie le moteur MediaPipe depuis node_modules et télécharge le modèle de pose une seule fois.
// Après ce script, plus aucune ressource n'est chargée depuis un service externe.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules/@mediapipe/tasks-vision');

const vendor = path.join(root, 'public/tryon/vendor');
const models = path.join(root, 'public/tryon/models');

const MODELS = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
};

const exists = (p) => stat(p).then(() => true, () => false);

await mkdir(vendor, { recursive: true });
await cp(path.join(pkgDir, 'vision_bundle.mjs'), path.join(vendor, 'vision_bundle.mjs'));
await cp(path.join(pkgDir, 'wasm'), path.join(vendor, 'wasm'), { recursive: true });
console.log('✓ Moteur MediaPipe copié dans public/tryon/vendor');

await mkdir(models, { recursive: true });
const wanted = process.argv.includes('--full') ? ['lite', 'full'] : ['lite'];
for (const name of wanted) {
  const dest = path.join(models, `pose_landmarker_${name}.task`);
  if (await exists(dest)) { console.log(`✓ Modèle ${name} déjà présent`); continue; }
  try {
    const res = await fetch(MODELS[name]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`✓ Modèle ${name} téléchargé (${dest})`);
  } catch (e) {
    console.warn(`⚠ Téléchargement du modèle ${name} impossible (${e.message}).`);
    console.warn(`  Téléchargez-le manuellement depuis ${MODELS[name]}`);
    console.warn(`  et placez-le dans ${dest}`);
  }
}
