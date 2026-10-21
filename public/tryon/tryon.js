/*!
 * TryOn — module d'essayage virtuel pour sites e-commerce.
 * 100 % côté navigateur : la photo / la vidéo de l'utilisateur ne quitte jamais son appareil.
 * Détection du corps : MediaPipe Pose Landmarker (Apache-2.0), auto-hébergé.
 *
 * Intégration minimale :
 *   <script src="https://VOTRE-SERVEUR/tryon/tryon.js" defer></script>
 *   <button data-tryon-type="top" data-tryon-image="/img/tshirt.png" data-tryon-name="T-shirt">Essayer</button>
 *
 * API JS :
 *   TryOn.init({ lang: 'fr', accent: '#111' })
 *   TryOn.open({ type: 'top', image: '/img/tshirt.png', name: 'T-shirt' })
 *   TryOn.open([{ type: 'top', ... }, { type: 'bottom', ... }, { type: 'shoes', ... }])   // tenue complète
 */
(function () {
  'use strict';
  if (window.TryOn) return;

  var SCRIPT = document.currentScript;
  var DEFAULT_BASE = SCRIPT && SCRIPT.src ? new URL('.', SCRIPT.src).href : '/tryon/';

  var config = {
    baseUrl: DEFAULT_BASE,             // dossier où sont servis tryon.js, vendor/ et models/
    modelUrl: null,                    // par défaut : baseUrl + 'models/pose_landmarker_lite.task'
    lang: (document.documentElement.lang || 'fr').slice(0, 2),
    accent: '#111111',
    autoBind: true,                    // active les boutons [data-tryon-image]
    delegate: 'GPU',                   // 'GPU' (repli automatique sur CPU) ou 'CPU'
    segmentation: true,                // découpe le vêtement sur la silhouette de la personne
    shading: 0.5,                      // 0 → 1 : reprend ombres et plis de la photo sur le vêtement
    detector: null                     // (tests) fonction async (source, mode) => landmarks[33] ou { lms, mask }
  };

  // ---------------------------------------------------------------- textes
  var I18N = {
    fr: {
      title: 'Essayage virtuel', photo: 'Photo', camera: 'Caméra', close: 'Fermer',
      upload: 'Importer une photo', uploadHint: 'Photo de face, en pied, bien éclairée. Glissez-la ici ou cliquez.',
      changePhoto: 'Changer de photo', capture: 'Capturer', flip: 'Changer de caméra', download: 'Télécharger',
      size: 'Taille', vertical: 'Hauteur', horizontal: 'Gauche / droite', reset: 'Réinitialiser',
      loading: 'Chargement du moteur…', analysing: 'Analyse de la photo…', startingCam: 'Ouverture de la caméra…',
      noPose: 'Aucune personne détectée. Essayez une photo de face, en pied, avec un fond simple.',
      camDenied: "Accès à la caméra refusé ou indisponible. Autorisez la caméra ou utilisez une photo.",
      camInsecure: 'La caméra nécessite une page en HTTPS.',
      engineError: "Le moteur d'essayage n'a pas pu se charger.",
      hintTop: 'Montrez le haut du corps (épaules et hanches).',
      hintBottom: 'Reculez : hanches et chevilles doivent être visibles.',
      hintShoes: 'Reculez : vos pieds doivent être visibles.',
      privacy: 'Vos images sont traitées sur votre appareil et ne sont envoyées nulle part.',
      dragHint: 'Glissez sur l’image pour ajuster le vêtement sélectionné.',
      taint: "Téléchargement impossible : l'image du vêtement n'autorise pas l'export (CORS).",
      top: 'Haut', bottom: 'Bas', shoes: 'Chaussures'
    },
    en: {
      title: 'Virtual try-on', photo: 'Photo', camera: 'Camera', close: 'Close',
      upload: 'Upload a photo', uploadHint: 'Front-facing, full body, good lighting. Drop it here or click.',
      changePhoto: 'Change photo', capture: 'Capture', flip: 'Switch camera', download: 'Download',
      size: 'Size', vertical: 'Height', horizontal: 'Left / right', reset: 'Reset',
      loading: 'Loading engine…', analysing: 'Analysing photo…', startingCam: 'Starting camera…',
      noPose: 'No person detected. Try a front-facing, full-body photo with a plain background.',
      camDenied: 'Camera access denied or unavailable. Allow the camera or use a photo.',
      camInsecure: 'The camera requires an HTTPS page.',
      engineError: 'The try-on engine failed to load.',
      hintTop: 'Show your upper body (shoulders and hips).',
      hintBottom: 'Step back: hips and ankles must be visible.',
      hintShoes: 'Step back: your feet must be visible.',
      privacy: 'Your images are processed on your device and never uploaded.',
      dragHint: 'Drag on the image to adjust the selected item.',
      taint: 'Download blocked: the garment image does not allow export (CORS).',
      top: 'Top', bottom: 'Bottom', shoes: 'Shoes'
    },
    ar: {
      title: 'القياس الافتراضي', photo: 'صورة', camera: 'الكاميرا', close: 'إغلاق',
      upload: 'حمّل صورة', uploadHint: 'صورة من الأمام، للجسم كاملًا، بإضاءة جيدة. اسحبها هنا أو انقر.',
      changePhoto: 'تغيير الصورة', capture: 'التقاط', flip: 'تبديل الكاميرا', download: 'تنزيل',
      size: 'الحجم', vertical: 'الارتفاع', horizontal: 'يمين / يسار', reset: 'إعادة الضبط',
      loading: 'جارٍ تحميل المحرك…', analysing: 'جارٍ تحليل الصورة…', startingCam: 'جارٍ تشغيل الكاميرا…',
      noPose: 'لم يتم العثور على شخص. جرّب صورة من الأمام للجسم كاملًا بخلفية بسيطة.',
      camDenied: 'تم رفض الوصول إلى الكاميرا أو أنها غير متاحة. اسمح بالكاميرا أو استعمل صورة.',
      camInsecure: 'تتطلب الكاميرا صفحة HTTPS.',
      engineError: 'تعذّر تحميل محرك القياس.',
      hintTop: 'أظهر الجزء العلوي من جسمك (الكتفين والوركين).',
      hintBottom: 'ابتعد قليلًا: يجب أن يظهر الوركان والكاحلان.',
      hintShoes: 'ابتعد قليلًا: يجب أن تظهر قدماك.',
      privacy: 'تُعالَج صورك على جهازك ولا تُرسل إلى أي مكان.',
      dragHint: 'اسحب على الصورة لضبط القطعة المحددة.',
      taint: 'تعذّر التنزيل: صورة القطعة لا تسمح بالتصدير (CORS).',
      top: 'علوي', bottom: 'سفلي', shoes: 'أحذية'
    }
  };
  function t(key) { var d = I18N[config.lang] || I18N.fr; return d[key] || I18N.fr[key] || key; }

  // ---------------------------------------------------------------- géométrie
  var FIT = {
    top:    { width: 2.1, top: 0.14, length: 1.25, sleeve: 0.25, sleeveLen: 0.45 }, // largeur × épaules, longueur × torse ; manches = part de l'image
    bottom: { width: 1.75, top: 0.12, length: 1.12, waist: 0.3 }, // largeur × hanches, longueur × jambe
    shoes:  { width: 1.5, sole: 0.85, frontWidth: 1.1 }          // largeur × pied
  };
  var ORDER = { shoes: 0, bottom: 1, top: 2 };
  var NEEDS = { top: [11, 12], bottom: [23, 24, 27, 28], shoes: [27, 29, 31] };

  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lineAngle(a, b) { var p = a.x <= b.x ? a : b, q = a.x <= b.x ? b : a; return Math.atan2(q.y - p.y, q.x - p.x); }
  function vis(P, idx, min) { min = min == null ? 0.5 : min; return idx.every(function (i) { return P[i] && P[i].v >= min; }); }
  function toPixels(lms, W, H, mirror) {
    return lms.map(function (l) { return { x: (mirror ? 1 - l.x : l.x) * W, y: l.y * H, z: l.z || 0, v: l.visibility == null ? 1 : l.visibility }; });
  }

  // Haut découpé en 3 : corps + deux manches qui pivotent à l'épaule pour suivre les bras.
  function drawTop(ctx, it, g, P) {
    if (!vis(P, NEEDS.top)) return false;
    var li = P[11].x <= P[12].x ? 11 : 12, ri = li === 11 ? 12 : 11;   // épaule à gauche / à droite de l'écran
    var Ls = P[li], Rs = P[ri], sMid = mid(Ls, Rs), sw = dist(Ls, Rs);
    if (sw < 4) return false;
    // hanches hors champ (personne assise devant la webcam) : longueur du torse estimée
    var Hc = ctx.canvas.height;
    var hipsOk = vis(P, [23, 24], 0.6) && P[23].y < Hc && P[24].y < Hc;
    var torso = hipsOk ? dist(sMid, mid(P[23], P[24])) : sw * 1.3;
    var f = it.fit, s = it.adj.scale, W = sw * f.width * s, H = torso * f.length * s;
    var ang = lineAngle(Ls, Rs), cos = Math.cos(ang), sin = Math.sin(ang);
    var o = { x: sMid.x + it.adj.dx * sw, y: sMid.y + it.adj.dy * sw };
    var src = g.canvas, gw = g.w, gh = g.h, kx = W / gw, ky = H / gh, top = torso * f.top * s;
    it._unit = sw;

    var sl = f.sleeve;
    if (!(sl > 0) || !vis(P, [li + 2, ri + 2], 0.5)) {           // coudes invisibles : image d'un seul bloc
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang);
      ctx.drawImage(src, -W / 2, -top, W, H);
      ctx.restore();
      return true;
    }

    var sx = sl * gw, sh = Math.min(gh, f.sleeveLen * gh), pivotY = top / ky, ov = 0.04 * gw;
    var bodyW = W * (1 - 2 * sl);
    [[Ls, P[li + 2], -1], [Rs, P[ri + 2], 1]].forEach(function (arm) {
      var side = arm[2], lx = side * bodyW / 2;
      var pivot = { x: o.x + lx * cos, y: o.y + lx * sin };
      var rest = Math.atan2((sh * 0.85 - pivotY) * ky, side * sx * kx);   // direction de la manche dans l'image
      var armAng = Math.atan2(arm[1].y - arm[0].y, arm[1].x - arm[0].x);
      var srcX = side < 0 ? 0 : gw - sx - ov, srcW = sx + ov;
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(armAng - rest);
      ctx.drawImage(src, srcX, 0, srcW, sh, side < 0 ? -sx * kx : -ov * kx, -pivotY * ky, srcW * kx, sh * ky);
      ctx.restore();
    });

    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang);
    ctx.drawImage(src, sx, 0, gw - 2 * sx, gh, -bodyW / 2, -top, bodyW, H);
    ctx.restore();
    return true;
  }

  function capsule(ctx, a, b, r) {
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.moveTo(a.x + r * Math.cos(ang + Math.PI / 2), a.y + r * Math.sin(ang + Math.PI / 2));
    ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang + Math.PI * 1.5);
    ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
  }

  // Le pantalon est découpé : bloc taille rigide + chaque jambe orientée hanche → cheville.
  function drawBottom(ctx, it, g, P) {
    if (!vis(P, NEEDS.bottom)) return false;
    var hl = P[23], hr = P[24], al = P[27], ar = P[28], tmp;
    if (hl.x > hr.x) { tmp = hl; hl = hr; hr = tmp; tmp = al; al = ar; ar = tmp; }
    var hMid = mid(hl, hr), hw = dist(hl, hr), leg = dist(hMid, mid(al, ar));
    if (hw < 3 || leg < 6) return false;
    var f = it.fit, s = it.adj.scale, W = hw * f.width * s;
    var ox = it.adj.dx * hw, oy = it.adj.dy * hw;
    var origin = { x: hMid.x + ox, y: hMid.y + oy };
    var ang = lineAngle(hl, hr), cos = Math.cos(ang), sin = Math.sin(ang);
    var topY = -leg * f.top * s, Hw = leg * f.length * s * f.waist;
    var src = g.canvas, sw = g.w, sh = g.h, wy = sh * f.waist, overlap = 0.06;
    it._unit = hw;

    [[al, 0], [ar, 1]].forEach(function (pair) {
      var ankle = { x: pair[0].x + ox, y: pair[0].y + oy }, k = pair[1];
      var lx = (k ? 1 : -1) * W / 4, ly = topY + Hw * (1 - overlap);
      var start = { x: origin.x + lx * cos - ly * sin, y: origin.y + lx * sin + ly * cos };
      var d = dist(start, ankle) || 1, ext = leg * 0.1 * s;
      var end = { x: ankle.x + (ankle.x - start.x) / d * ext, y: ankle.y + (ankle.y - start.y) / d * ext };
      var L = dist(start, end), sy = wy * (1 - overlap);
      ctx.save();
      ctx.translate(start.x, start.y);
      ctx.rotate(Math.atan2(-(end.x - start.x), end.y - start.y));
      ctx.drawImage(src, k * sw / 2, sy, sw / 2, sh - sy, -W / 4, 0, W / 2, L);
      ctx.restore();
    });

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(ang);
    ctx.drawImage(src, 0, 0, sw, wy, -W / 2, topY, W, Hw);
    ctx.restore();
    return true;
  }

  // Image de chaussure attendue : vue de profil, pointe vers la droite. imageFront (optionnel) : vue de face.
  function drawShoes(ctx, it, g, gFront, P) {
    var drawn = false;
    [[27, 29, 31, 28], [28, 30, 32, 27]].forEach(function (ids) {
      if (!vis(P, [ids[0], ids[1], ids[2]], 0.4)) return;
      var a = P[ids[0]], h = P[ids[1]], tt = P[ids[2]], other = P[ids[3]];
      var f = it.fit, s = it.adj.scale;
      var foot = Math.max(dist(h, tt), dist(a, tt) * 0.9, 6);
      var ox = it.adj.dx * foot, oy = it.adj.dy * foot;
      var dx = tt.x - h.x, dy = tt.y - h.y;
      var profile = Math.abs(dx) > Math.abs(dy) * 1.1;
      it._unit = foot;
      ctx.save();
      if (profile) {
        var W = foot * f.width * s, H = W * g.h / g.w, c = mid(h, tt), flip = dx < 0;
        ctx.translate(c.x + ox, c.y + oy);
        ctx.rotate(flip ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx));
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(g.canvas, -W / 2, -H * f.sole, W, H);
      } else {
        var img = gFront || g;
        var Wf = foot * (gFront ? f.frontWidth : f.width) * s, Hf = Wf * img.h / img.w;
        var cx = (a.x + tt.x) / 2 + ox, bottom = Math.max(h.y, tt.y) + foot * 0.12 + oy;
        ctx.translate(cx, bottom);
        if (!gFront && other && a.x < other.x) ctx.scale(-1, 1); // pointe vers l'extérieur
        ctx.drawImage(img.canvas, -Wf / 2, -Hf, Wf, Hf);
      }
      ctx.restore();
      drawn = true;
    });
    return drawn;
  }

  // ---------------------------------------------------------------- moteur de pose
  var posePromise = null;
  function loadPose() {
    if (config.detector) return Promise.resolve(null);
    if (posePromise) return posePromise;
    posePromise = (async function () {
      var base = config.baseUrl.replace(/\/?$/, '/');
      var vision = await import(base + 'vendor/vision_bundle.mjs');
      var fileset = await vision.FilesetResolver.forVisionTasks(base + 'vendor/wasm');
      var make = function (delegate) {
        return vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: config.modelUrl || base + 'models/pose_landmarker_lite.task', delegate: delegate },
          runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: !!config.segmentation,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5
        });
      };
      var lmk;
      try { lmk = await make(config.delegate); }
      catch (e) { if (config.delegate !== 'GPU') throw e; lmk = await make('CPU'); }
      lmk.__mode = 'IMAGE';
      return lmk;
    })();
    posePromise.catch(function () { posePromise = null; });
    return posePromise;
  }

  // Masque de silhouette → canvas (alpha = probabilité d'être la personne).
  // En vidéo, le canvas est réutilisé à chaque image ; pour une photo, il est conservé.
  var videoMaskCanvas = null;
  function maskToCanvas(m, reuse) {
    var w = m.width, h = m.height, data = m.getAsFloat32Array();
    var c = reuse ? (videoMaskCanvas || (videoMaskCanvas = document.createElement('canvas'))) : document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var cx = c.getContext('2d'), img = cx.createImageData(w, h), d = img.data;
    for (var i = 0, n = w * h; i < n; i++) d[i * 4 + 3] = data[i] * 255;
    cx.putImageData(img, 0, 0);
    return c;
  }

  async function detect(source, mode, ts) {
    if (config.detector) {
      var r = await config.detector(source, mode);
      return Array.isArray(r) || !r ? { lms: r || null, mask: null } : r;
    }
    var lmk = await loadPose();
    if (lmk.__mode !== mode) { await lmk.setOptions({ runningMode: mode }); lmk.__mode = mode; }
    var res = mode === 'VIDEO' ? lmk.detectForVideo(source, ts) : lmk.detect(source);
    var lms = (res && res.landmarks && res.landmarks[0]) || null, mask = null;
    if (res && res.segmentationMasks && res.segmentationMasks.length) {
      try { if (lms) mask = maskToCanvas(res.segmentationMasks[0], mode === 'VIDEO'); } catch (e) { /* masque optionnel */ }
      res.segmentationMasks.forEach(function (m) { if (m && m.close) m.close(); });
    }
    return { lms: lms, mask: mask };
  }

  // ---------------------------------------------------------------- préparation des vêtements
  var garmentCache = new Map();

  function loadImage(src) {
    function attempt(cors) {
      return new Promise(function (res, rej) {
        var img = new Image();
        if (cors && !/^(data|blob):/.test(src)) img.crossOrigin = 'anonymous';
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error('Image introuvable : ' + src)); };
        img.src = src;
      });
    }
    return attempt(true).catch(function () { return attempt(false); });
  }

  // Détoure un fond uni (souvent blanc) par remplissage depuis les bords, puis recadre au contenu.
  function processGarment(img, removeBg) {
    var w = img.naturalWidth || img.width || 512, h = img.naturalHeight || img.height || 512;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var data;
    try { data = ctx.getImageData(0, 0, w, h); }
    catch (e) { return { canvas: img, w: w, h: h, tainted: true }; }
    var px = data.data;

    if (removeBg !== false) {
      var corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
      var bg = [px[0], px[1], px[2]];
      var tol = 42, tol2 = tol * tol;
      var d2 = function (i) { var r = px[i] - bg[0], g = px[i + 1] - bg[1], b = px[i + 2] - bg[2]; return r * r + g * g + b * b; };
      var opaque = corners.every(function (i) { return px[i + 3] > 250; });
      var uniform = corners.filter(function (i) { return d2(i) < tol2; }).length >= 3;
      if ((removeBg === true || opaque) && uniform) {
        var seen = new Uint8Array(w * h), stack = [], x, y, p;
        for (x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
        for (y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
        while (stack.length) {
          p = stack.pop();
          if (seen[p]) continue;
          seen[p] = 1;
          var i = p * 4, dd = d2(i);
          if (dd >= tol2 * 4) continue;
          if (dd >= tol2) { px[i + 3] = Math.min(px[i + 3], Math.round((Math.sqrt(dd) - tol) / tol * 255)); continue; }
          px[i + 3] = 0;
          x = p % w; y = (p - x) / w;
          if (x > 0) stack.push(p - 1);
          if (x < w - 1) stack.push(p + 1);
          if (y > 0) stack.push(p - w);
          if (y < h - 1) stack.push(p + w);
        }
        ctx.putImageData(data, 0, 0);
      }
    }

    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      if (px[(yy * w + xx) * 4 + 3] > 12) {
        if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
      }
    }
    if (maxX < 0) return { canvas: c, w: w, h: h };
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    var out = document.createElement('canvas'); out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
    return { canvas: out, w: cw, h: ch };
  }

  function prepareGarment(src, removeBg) {
    if (!src) return Promise.resolve(null);
    var key = src + '|' + removeBg;
    if (!garmentCache.has(key)) {
      var p = loadImage(src).then(function (img) { return processGarment(img, removeBg); });
      p.catch(function () { garmentCache.delete(key); });
      garmentCache.set(key, p);
    }
    return garmentCache.get(key);
  }

  var uid = 0;
  function normalizeItem(raw) {
    var type = String(raw.type || 'top').toLowerCase();
    if (!FIT[type]) throw new Error('TryOn : type inconnu "' + type + '" (top | bottom | shoes)');
    if (!raw.image) throw new Error('TryOn : "image" est obligatoire');
    var fit = {}, k;
    for (k in FIT[type]) fit[k] = FIT[type][k];
    for (k in (raw.fit || {})) fit[k] = Number(raw.fit[k]);
    return {
      id: 'i' + (++uid), type: type, name: raw.name || t(type), image: raw.image,
      imageFront: raw.imageFront || null, thumb: raw.thumb || raw.image,
      removeBackground: raw.removeBackground == null ? 'auto' : raw.removeBackground,
      fit: fit, adj: { scale: 1, dx: 0, dy: 0 }, on: true, g: null, gFront: null
    };
  }

  // ---------------------------------------------------------------- interface
  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif}',
    '.bd{position:fixed;inset:0;z-index:2147483000;background:rgba(15,15,18,.62);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.m{background:#fff;color:#16161a;width:min(920px,100%);max-height:100%;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35)}',
    'header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #ececf0}',
    'h2{font-size:17px;font-weight:650;margin:0;flex:1}',
    '.x{border:0;background:#f2f2f5;width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:#16161a}',
    '.tabs{display:inline-flex;background:#f2f2f5;border-radius:999px;padding:3px}',
    '.tab{border:0;background:transparent;padding:7px 14px;border-radius:999px;font-size:14px;cursor:pointer;color:#55555f}',
    '.tab[aria-selected=true]{background:#fff;color:#16161a;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}',
    '.body{display:grid;grid-template-columns:1fr 260px;min-height:0;flex:1}',
    '.stage{position:relative;background:#f6f6f8;display:flex;align-items:center;justify-content:center;min-height:420px;overflow:hidden;touch-action:none}',
    'canvas{max-width:100%;max-height:68vh;display:block;cursor:grab}',
    'canvas.drag{cursor:grabbing}',
    '.drop{position:absolute;inset:16px;border:2px dashed #c9c9d3;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:24px;cursor:pointer;color:#55555f;font-size:14px;background:#f6f6f8}',
    '.drop.over{border-color:var(--a);background:#efeff4}',
    '.drop b{color:#16161a;font-size:16px}',
    '.status{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,24,.82);color:#fff;font-size:13px;padding:8px 12px;border-radius:999px;max-width:calc(100% - 28px);text-align:center;pointer-events:none}',
    '.side{border-inline-start:1px solid #ececf0;padding:16px;display:flex;flex-direction:column;gap:14px;overflow:auto}',
    '.items{display:flex;flex-direction:column;gap:8px;flex-shrink:0}',
    '.it{display:flex;align-items:center;gap:10px;border:1.5px solid #e3e3ea;border-radius:10px;padding:6px 8px;background:#fff;cursor:pointer;text-align:start;font-size:13px;color:#16161a}',
    '.it[aria-pressed=true]{border-color:var(--a)}',
    '.it.off{opacity:.45}',
    '.it img{width:38px;height:38px;object-fit:contain;background:#f6f6f8;border-radius:6px}',
    '.it span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.it small{display:block;color:#7a7a85;font-size:11px}',
    '.eye{border:0;background:none;font-size:15px;cursor:pointer;padding:4px;color:#55555f}',
    'label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#55555f}',
    'input[type=range]{width:100%;accent-color:var(--a)}',
    '.btns{display:flex;flex-direction:column;gap:8px;margin-top:auto}',
    '.b{border:1.5px solid #16161a;background:#fff;color:#16161a;padding:10px 12px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}',
    '.b.p{background:var(--a);border-color:var(--a);color:#fff}',
    '.b:disabled{opacity:.4;cursor:not-allowed}',
    '.lnk{border:0;background:none;color:#55555f;font-size:12px;text-decoration:underline;cursor:pointer;align-self:flex-start;padding:0}',
    '.note{font-size:11.5px;color:#7a7a85;margin:0;line-height:1.4}',
    'button:focus-visible,input:focus-visible{outline:2px solid var(--a);outline-offset:2px}',
    '[hidden]{display:none!important}',
    '@media (max-width:720px){.bd{padding:0}.m{border-radius:0;height:100%}.body{grid-template-columns:1fr;overflow:auto}.stage{min-height:56vh}.side{border:0;border-top:1px solid #ececf0}canvas{max-height:56vh}.items{flex-direction:row;overflow-x:auto}.it{flex:0 0 auto}}'
  ].join('\n');

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function Session(items) {
    this.items = items.sort(function (a, b) { return ORDER[a.type] - ORDER[b.type]; });
    this.active = this.items[this.items.length - 1];
    this.tab = 'photo';
    this.photo = null;     // { img, lms }
    this.cam = { stream: null, video: null, facing: 'user', raf: 0, prev: null, busy: false };
    this.lastFocus = document.activeElement;
    this.build();
    this.prepare();
    loadPose().catch(function () {});
  }

  Session.prototype.build = function () {
    var self = this;
    this.host = el('div', { 'data-tryon-root': true });
    var root = this.host.attachShadow({ mode: 'open' });
    root.appendChild(el('style', { text: CSS }));

    this.canvas = el('canvas', { 'aria-label': t('title') });
    this.ctx = this.canvas.getContext('2d');
    this.file = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function () { if (self.file.files[0]) self.loadFile(self.file.files[0]); self.file.value = ''; } });
    this.drop = el('div', { class: 'drop', role: 'button', tabindex: '0',
      onclick: function () { self.file.click(); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.file.click(); } } },
      [el('b', { text: t('upload') }), el('span', { text: t('uploadHint') })]);
    ['dragenter', 'dragover'].forEach(function (ev) { self.drop.addEventListener(ev, function (e) { e.preventDefault(); self.drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { self.drop.addEventListener(ev, function (e) { e.preventDefault(); self.drop.classList.remove('over'); }); });
    this.drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) self.loadFile(f); });
    this.status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: true });

    this.tabs = {
      photo: el('button', { class: 'tab', role: 'tab', text: t('photo'), onclick: function () { self.setTab('photo'); } }),
      camera: el('button', { class: 'tab', role: 'tab', text: t('camera'), onclick: function () { self.setTab('camera'); } })
    };
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) this.tabs.camera.hidden = true;

    this.itemList = el('div', { class: 'items' });
    var range = function (min, max, step, key, label) {
      var input = el('input', { type: 'range', min: min, max: max, step: step, value: key === 'scale' ? 1 : 0,
        oninput: function () { self.active.adj[key] = Number(input.value); self.redraw(); } });
      self.sliders[key] = input;
      return el('label', {}, [document.createTextNode(label), input]);
    };
    this.sliders = {};

    this.btn = {
      change: el('button', { class: 'b', text: t('changePhoto'), onclick: function () { self.file.click(); } }),
      capture: el('button', { class: 'b p', text: t('capture'), onclick: function () { self.capture(); } }),
      flip: el('button', { class: 'b', text: t('flip'), onclick: function () { self.flipCamera(); } }),
      download: el('button', { class: 'b p', text: t('download'), onclick: function () { self.download(); } })
    };

    var dir = config.lang === 'ar' ? 'rtl' : 'ltr';
    this.modal = el('div', { class: 'm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tryon-title', dir: dir, style: '--a:' + config.accent }, [
      el('header', {}, [
        el('h2', { id: 'tryon-title', text: t('title') }),
        el('div', { class: 'tabs', role: 'tablist' }, [this.tabs.photo, this.tabs.camera]),
        el('button', { class: 'x', 'aria-label': t('close'), text: '×', onclick: function () { self.close(); } })
      ]),
      el('div', { class: 'body' }, [
        el('div', { class: 'stage' }, [this.canvas, this.drop, this.status, this.file]),
        el('div', { class: 'side' }, [
          this.itemList,
          range(0.6, 1.5, 0.01, 'scale', t('size')),
          range(-0.8, 0.8, 0.01, 'dy', t('vertical')),
          range(-0.8, 0.8, 0.01, 'dx', t('horizontal')),
          el('button', { class: 'lnk', text: t('reset'), onclick: function () { self.active.adj = { scale: 1, dx: 0, dy: 0 }; self.syncSliders(); self.redraw(); } }),
          el('p', { class: 'note', text: t('dragHint') }),
          el('div', { class: 'btns' }, [this.btn.change, this.btn.capture, this.btn.flip, this.btn.download]),
          el('p', { class: 'note', text: '🔒 ' + t('privacy') })
        ])
      ])
    ]);
    this.backdrop = el('div', { class: 'bd', onclick: function (e) { if (e.target === self.backdrop) self.close(); } }, [this.modal]);
    root.appendChild(this.backdrop);

    this.onKey = function (e) {
      if (e.key === 'Escape') self.close();
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(self.modal.querySelectorAll('button,[tabindex="0"],input:not([hidden])'), function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) return;
        var cur = root.activeElement;
        if (e.shiftKey && cur === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && cur === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', this.onKey);
    this.bindDrag();
    this.renderItems();
    document.body.appendChild(this.host);
    this.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    this.setTab('photo');
    this.tabs.photo.focus();
  };

  Session.prototype.renderItems = function () {
    var self = this;
    this.itemList.textContent = '';
    this.items.forEach(function (it) {
      var eye = el('button', { class: 'eye', 'aria-label': it.name, 'aria-pressed': String(it.on), text: it.on ? '👁' : '◌',
        onclick: function (e) { e.stopPropagation(); it.on = !it.on; self.renderItems(); self.redraw(); } });
      self.itemList.appendChild(el('div', { class: 'it' + (it.on ? '' : ' off'), role: 'button', tabindex: '0', 'aria-pressed': String(it === self.active),
        onclick: function () { self.active = it; self.syncSliders(); self.renderItems(); },
        onkeydown: function (e) { if (e.key === 'Enter') { self.active = it; self.syncSliders(); self.renderItems(); } } },
        [el('img', { src: it.thumb, alt: '' }), el('span', {}, [document.createTextNode(it.name), el('small', { text: t(it.type) })]), eye]));
    });
    this.syncSliders();
  };

  Session.prototype.syncSliders = function () {
    for (var k in this.sliders) this.sliders[k].value = this.active.adj[k];
  };

  Session.prototype.prepare = function () {
    var self = this;
    this.ready = Promise.all(this.items.map(function (it) {
      return Promise.all([prepareGarment(it.image, it.removeBackground), prepareGarment(it.imageFront, it.removeBackground)])
        .then(function (r) { it.g = r[0]; it.gFront = r[1]; })
        .catch(function (e) { console.warn('[TryOn]', e.message); it.on = false; });
    })).then(function () { self.renderItems(); self.redraw(); });
  };

  Session.prototype.setStatus = function (msg) { this.status.hidden = !msg; this.status.textContent = msg || ''; };

  Session.prototype.setTab = function (tab) {
    this.tab = tab;
    for (var k in this.tabs) this.tabs[k].setAttribute('aria-selected', String(k === tab));
    var cam = tab === 'camera';
    this.btn.capture.hidden = this.btn.flip.hidden = !cam;
    this.btn.change.hidden = cam || !this.photo;
    this.btn.download.hidden = cam;
    this.btn.download.disabled = !this.photo;
    this.drop.hidden = cam || !!this.photo;
    this.canvas.hidden = !cam && !this.photo;
    this.setStatus('');
    if (cam) this.startCamera(); else { this.stopCamera(); this.redraw(); }
  };

  Session.prototype.loadFile = async function (file) {
    var url = URL.createObjectURL(file);
    try { await this.usePhoto(await loadImage(url)); }
    finally { URL.revokeObjectURL(url); }
  };

  Session.prototype.usePhoto = async function (img) {
    // limite la taille de travail pour la vitesse
    var maxSide = 1600, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, r = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(h * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    this.photo = { img: c, lms: null, mask: null };
    this.setTab('photo');
    this.setStatus(posePromise || config.detector ? t('analysing') : t('loading'));
    try {
      await this.ready;
      var r = await detect(c, 'IMAGE');
      this.photo.lms = r.lms; this.photo.mask = r.mask;
      this.setStatus(this.photo.lms ? '' : t('noPose'));
    } catch (e) {
      console.error('[TryOn]', e);
      this.setStatus(t('engineError'));
    }
    this.redraw();
  };

  Session.prototype.buf = function (name, W, H) {
    this._bufs = this._bufs || {};
    var c = this._bufs[name] || (this._bufs[name] = document.createElement('canvas'));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    return c;
  };

  // Compose l'image finale : personne → vêtements (découpés sur la silhouette, ombrés) → avant-bras devant.
  Session.prototype.compose = function (frame, P, mask, mirror) {
    var W = frame.width, H = frame.height, ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(frame, 0, 0);

    // 1) chaussures : non découpées (elles dépassent du pied) ; 2) vêtements : découpés sur la silhouette
    var missing = this.layer(frame, P, mask, mirror, true).concat(this.layer(frame, P, mask, mirror, false));
    this.drawForearms(frame, P);
    return missing;
  };

  Session.prototype.layer = function (frame, P, mask, mirror, shoes) {
    var W = frame.width, H = frame.height, ctx = this.ctx;
    var L = this.buf('layer', W, H), lc = L.getContext('2d');
    lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
    lc.clearRect(0, 0, W, H);
    var missing = this.drawGarments(lc, P, function (it) { return (it.type === 'shoes') === shoes; });

    if (!shoes && mask && config.segmentation) {
      // silhouette légèrement élargie pour garder un vêtement un peu ample
      var M = this.buf('mask', W, H), mc = M.getContext('2d'), r = Math.max(2, Math.round(W / 140));
      mc.clearRect(0, 0, W, H);
      mc.save();
      if (mirror) { mc.translate(W, 0); mc.scale(-1, 1); }
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) mc.drawImage(mask, dx * r, dy * r, W, H);
      mc.restore();
      lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(M, 0, 0);
    }

    if (config.shading > 0) {
      // reprend la luminosité de la scène (plis, ombres, éclairage) sur le vêtement
      var A = this.buf('alpha', W, H), ac = A.getContext('2d');
      ac.globalCompositeOperation = 'copy'; ac.drawImage(L, 0, 0);
      var G = this.buf('gray', W, H), gc = G.getContext('2d');
      gc.globalCompositeOperation = 'source-over'; gc.fillStyle = '#fff'; gc.fillRect(0, 0, W, H);
      gc.globalCompositeOperation = 'luminosity'; gc.drawImage(frame, 0, 0);
      lc.globalCompositeOperation = 'soft-light'; lc.globalAlpha = Math.min(1, config.shading);
      lc.drawImage(G, 0, 0);
      lc.globalAlpha = 1; lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(A, 0, 0);
    }
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(L, 0, 0);
    return missing;
  };

  // Un avant-bras placé devant le corps (plus proche de la caméra) repasse par-dessus le vêtement.
  Session.prototype.drawForearms = function (frame, P) {
    if (!vis(P, [11, 12])) return;
    var ctx = this.ctx, sw = dist(P[11], P[12]), zs = (P[11].z + P[12].z) / 2;
    [[13, 15, 19], [14, 16, 20]].forEach(function (ids) {
      if (!vis(P, [ids[0], ids[1]], 0.6)) return;
      var e = P[ids[0]], w = P[ids[1]];
      if ((e.z + w.z) / 2 > zs - 0.12) return;
      var hand = P[ids[2]] && P[ids[2]].v > 0.5 ? P[ids[2]] : w, r = sw * 0.16;
      ctx.save();
      ctx.beginPath();
      capsule(ctx, e, w, r);
      capsule(ctx, w, hand, r * 1.15);
      ctx.clip();
      ctx.drawImage(frame, 0, 0);
      ctx.restore();
    });
  };

  Session.prototype.drawGarments = function (ctx, P, filter) {
    var missing = [];
    this.items.forEach(function (it) {
      if (!it.on || !it.g || (filter && !filter(it))) return;
      var ok = it.type === 'top' ? drawTop(ctx, it, it.g, P)
        : it.type === 'bottom' ? drawBottom(ctx, it, it.g, P)
        : drawShoes(ctx, it, it.g, it.gFront, P);
      if (!ok) missing.push(it.type);
    });
    return missing;
  };

  Session.prototype.hintFor = function (missing) {
    if (!missing.length) return '';
    return t('hint' + missing[0].charAt(0).toUpperCase() + missing[0].slice(1));
  };

  Session.prototype.redraw = function () {
    if (this.tab !== 'photo' || !this.photo) return;
    var c = this.photo.img;
    this.canvas.width = c.width; this.canvas.height = c.height;
    if (this.photo.lms) {
      var missing = this.compose(c, toPixels(this.photo.lms, c.width, c.height, false), this.photo.mask, false);
      this.setStatus(this.hintFor(missing));
    } else this.ctx.drawImage(c, 0, 0);
  };

  // ------------------------------------------------------------ caméra
  Session.prototype.startCamera = async function () {
    var self = this;
    if (!window.isSecureContext) { this.setStatus(t('camInsecure')); return; }
    this.stopCamera();
    this.setStatus(t('startingCam'));
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: this.cam.facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (this.tab !== 'camera' || this.closed) { stream.getTracks().forEach(function (tr) { tr.stop(); }); return; }
      var video = el('video', { playsinline: true, muted: true, autoplay: true });
      video.muted = true; video.srcObject = stream;
      await video.play();
      this.cam.stream = stream; this.cam.video = video; this.cam.prev = null;
      this.setStatus(posePromise || config.detector ? '' : t('loading'));
      await loadPose();
      this.setStatus('');
      var lastTs = 0;
      var loop = async function () {
        if (!self.cam.video || self.tab !== 'camera') return;
        self.cam.raf = requestAnimationFrame(loop);
        if (self.cam.busy || video.readyState < 2) return;
        self.cam.busy = true;
        try {
          var W = video.videoWidth, H = video.videoHeight, mirror = self.cam.facing === 'user';
          var ts = Math.max(performance.now(), lastTs + 1); lastTs = ts;
          var r = await detect(video, 'VIDEO', ts);
          if (self.canvas.width !== W) self.canvas.width = W;
          if (self.canvas.height !== H) self.canvas.height = H;
          var frame = self.buf('frame', W, H), fc = frame.getContext('2d');
          fc.save();
          if (mirror) { fc.translate(W, 0); fc.scale(-1, 1); }
          fc.drawImage(video, 0, 0, W, H);
          fc.restore();
          if (r.lms) {
            var P = self.smooth(toPixels(r.lms, W, H, mirror));
            self.setStatus(self.hintFor(self.compose(frame, P, r.mask, mirror)));
          } else {
            self.ctx.drawImage(frame, 0, 0);
            self.cam.prev = null; self.setStatus(self.hintFor(['top']));
          }
        } catch (e) { console.error('[TryOn]', e); }
        self.cam.busy = false;
      };
      loop();
    } catch (e) {
      console.warn('[TryOn]', e);
      this.setStatus(e && e.name === 'NotAllowedError' ? t('camDenied') : (e && e.name ? t('camDenied') : t('engineError')));
    }
  };

  // lissage exponentiel pour éviter les tremblements
  Session.prototype.smooth = function (P) {
    var prev = this.cam.prev, a = 0.55;
    if (prev) P = P.map(function (p, i) { var q = prev[i]; return { x: q.x + (p.x - q.x) * a, y: q.y + (p.y - q.y) * a, z: q.z + (p.z - q.z) * a, v: p.v }; });
    this.cam.prev = P;
    return P;
  };

  Session.prototype.stopCamera = function () {
    cancelAnimationFrame(this.cam.raf);
    if (this.cam.stream) this.cam.stream.getTracks().forEach(function (tr) { tr.stop(); });
    this.cam.stream = null; this.cam.video = null; this.cam.busy = false;
  };

  Session.prototype.flipCamera = function () {
    this.cam.facing = this.cam.facing === 'user' ? 'environment' : 'user';
    this.startCamera();
  };

  // capture l'image (sans vêtement) et passe en mode photo pour ajuster puis télécharger
  Session.prototype.capture = function () {
    var v = this.cam.video;
    if (!v) return;
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    var ctx = c.getContext('2d');
    if (this.cam.facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    this.usePhoto(c);
  };

  Session.prototype.download = function () {
    var self = this;
    try {
      this.canvas.toBlob(function (blob) {
        if (!blob) return;
        var a = el('a', { href: URL.createObjectURL(blob), download: 'essayage.png' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        window.dispatchEvent(new CustomEvent('tryon:download', { detail: { items: self.publicItems() } }));
      }, 'image/png');
    } catch (e) { this.setStatus(t('taint')); }
  };

  Session.prototype.bindDrag = function () {
    var self = this, start = null;
    this.canvas.addEventListener('pointerdown', function (e) {
      if (self.tab !== 'photo' || !self.photo || !self.active._unit) return;
      var r = self.canvas.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, dx: self.active.adj.dx, dy: self.active.adj.dy, k: self.canvas.width / r.width };
      self.canvas.setPointerCapture(e.pointerId);
      self.canvas.classList.add('drag');
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!start) return;
      var u = self.active._unit;
      self.active.adj.dx = start.dx + (e.clientX - start.x) * start.k / u;
      self.active.adj.dy = start.dy + (e.clientY - start.y) * start.k / u;
      self.syncSliders();
      self.redraw();
    });
    var end = function () { start = null; self.canvas.classList.remove('drag'); };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  };

  Session.prototype.publicItems = function () {
    return this.items.map(function (it) { return { type: it.type, name: it.name, image: it.image, visible: it.on }; });
  };

  Session.prototype.close = function () {
    if (this.closed) return;
    this.closed = true;
    this.stopCamera();
    document.removeEventListener('keydown', this.onKey);
    document.documentElement.style.overflow = this.prevOverflow;
    this.host.remove();
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
    if (current === this) current = null;
    window.dispatchEvent(new CustomEvent('tryon:close'));
  };

  // ---------------------------------------------------------------- API publique
  var current = null;

  function open(items) {
    var list = (Array.isArray(items) ? items : [items]).map(normalizeItem);
    if (current) current.close();
    current = new Session(list);
    window.dispatchEvent(new CustomEvent('tryon:open', { detail: { items: current.publicItems() } }));
    return current;
  }

  function itemFromElement(btn) {
    var d = btn.dataset, fit = null;
    if (d.tryonFit) { try { fit = JSON.parse(d.tryonFit); } catch (e) { console.warn('[TryOn] data-tryon-fit invalide'); } }
    return {
      type: d.tryonType, image: d.tryonImage, imageFront: d.tryonImageFront, name: d.tryonName, thumb: d.tryonThumb, fit: fit,
      removeBackground: d.tryonRemoveBackground == null ? undefined : d.tryonRemoveBackground !== 'false'
    };
  }

  function bind() {
    document.addEventListener('click', function (e) {
      if (!config.autoBind) return;
      var btn = e.target.closest && e.target.closest('[data-tryon-image],[data-tryon-group]');
      if (!btn) return;
      e.preventDefault();
      if (btn.dataset.tryonGroup) {
        var nodes = document.querySelectorAll('[data-tryon-image][data-tryon-in="' + CSS_escape(btn.dataset.tryonGroup) + '"]');
        open(Array.prototype.map.call(nodes, itemFromElement));
      } else open(itemFromElement(btn));
    });
    // préchargement du moteur au survol pour une ouverture plus rapide
    document.addEventListener('pointerover', function (e) {
      if (config.autoBind && e.target.closest && e.target.closest('[data-tryon-image],[data-tryon-group]')) loadPose().catch(function () {});
    }, { passive: true });
  }
  function CSS_escape(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

  window.TryOn = {
    version: '1.0.0',
    init: function (opts) { for (var k in opts || {}) config[k] = opts[k]; return window.TryOn; },
    open: open,
    close: function () { if (current) current.close(); },
    preload: function () { return loadPose(); },
    _internals: { processGarment: processGarment, drawTop: drawTop, drawBottom: drawBottom, drawShoes: drawShoes, toPixels: toPixels }
  };

  var preset = SCRIPT && SCRIPT.dataset;
  if (preset) {
    if (preset.lang) config.lang = preset.lang;
    if (preset.accent) config.accent = preset.accent;
  }
  bind();
})();
