import * as THREE from 'three';

export interface TacticalMaterials {
  sandGround: THREE.MeshStandardMaterial;
  desertTerrain: THREE.MeshStandardMaterial;
  sandstoneWall: THREE.MeshStandardMaterial;
  sandstoneArch: THREE.MeshStandardMaterial;
  concreteWall: THREE.MeshStandardMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  woodCrate: THREE.MeshStandardMaterial;
  containerOlive: THREE.MeshStandardMaterial;
  containerRust: THREE.MeshStandardMaterial;
  hazardTrim: THREE.MeshStandardMaterial;
  helipadFloor: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  sandbagMat: THREE.MeshStandardMaterial;
  mesaRock: THREE.MeshStandardMaterial;
  foliageMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  bulletDecalMat: THREE.MeshBasicMaterial;
  skyTexture: THREE.CanvasTexture;
  dispose: () => void;
}

const PHOTO_TEXTURE_URLS = {
  sandstone: '/src/assets/images/tex_sandstone_masonry_1795554894822.jpg',
  desertGround: '/src/assets/images/tex_desert_ground_1795554895419.jpg',
  concrete: '/src/assets/images/tex_concrete_industrial_1795554895406.jpg',
  woodCrate: '/src/assets/images/tex_wood_crate_1795554896940.jpg',
} as const;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!];
}

function addAlbedoGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * intensity;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function buildNormalAndRoughnessMaps(
  heightCanvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  strength: number,
  roughMin: number,
  roughMax: number,
  invertRoughness = false
): { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture } {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, w, h).data;

  const normData = new Uint8Array(w * h * 4);
  const roughData = new Uint8Array(w * h * 4);

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    const i = (wy * w + wx) * 4;
    // Luminance works for both grayscale height canvases and RGB photographic textures
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const c = sampleH(x, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      normData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;

      const factor = invertRoughness ? c : 1 - c;
      const rv = Math.round((roughMin + factor * (roughMax - roughMin)) * 255);
      roughData[idx] = rv;
      roughData[idx + 1] = rv;
      roughData[idx + 2] = rv;
      roughData[idx + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normData, w, h, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeatX, repeatY);
  normalMap.anisotropy = anisotropy;
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, w, h, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatX, repeatY);
  roughnessMap.anisotropy = anisotropy;
  roughnessMap.generateMipmaps = true;
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.needsUpdate = true;

  return { normalMap, roughnessMap };
}

function toColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTacticalMaterials(maxAnisotropy: number): TacticalMaterials {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  let disposed = false;

  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const makePbrMaterial = (
    albedoC: HTMLCanvasElement,
    heightC: HTMLCanvasElement,
    rx: number,
    ry: number,
    opts: {
      normalStrength: number;
      normalScale?: number;
      roughMin: number;
      roughMax: number;
      metalness: number;
      invertRough?: boolean;
    }
  ) => {
    const map = trackTex(toColorTexture(albedoC, rx, ry, maxAnisotropy));
    const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
      heightC,
      rx,
      ry,
      maxAnisotropy,
      opts.normalStrength,
      opts.roughMin,
      opts.roughMax,
      opts.invertRough
    );
    trackTex(normalMap);
    trackTex(roughnessMap);

    const ns = opts.normalScale ?? 1.0;
    return trackMat(
      new THREE.MeshStandardMaterial({
        map,
        normalMap,
        normalScale: new THREE.Vector2(ns, ns),
        roughnessMap,
        roughness: 1.0,
        metalness: opts.metalness,
      })
    );
  };

  // --- 1. Courtyard Flagstone & Desert Ground ---
  const [sandC, sandCtx] = makeCanvas(256, 256);
  const [sandH, sandHCtx] = makeCanvas(256, 256);
  sandCtx.fillStyle = '#b49468';
  sandCtx.fillRect(0, 0, 256, 256);
  sandHCtx.fillStyle = '#606060';
  sandHCtx.fillRect(0, 0, 256, 256);
  addAlbedoGrain(sandCtx, 256, 256, 20);
  const sandGround = makePbrMaterial(sandC, sandH, 20, 20, {
    normalStrength: 2.0,
    normalScale: 1.15,
    roughMin: 0.78,
    roughMax: 0.96,
    metalness: 0.02,
  });

  // --- 2. Outer Open Desert Dunes ---
  const [desC, desCtx] = makeCanvas(512, 512);
  const [desH, desHCtx] = makeCanvas(512, 512);
  desCtx.fillStyle = '#c1a274';
  desCtx.fillRect(0, 0, 512, 512);
  desHCtx.fillStyle = '#808080';
  desHCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const wave = Math.sin((y / 512) * Math.PI * 16) * 0.5 + 0.5;
    const hVal = Math.round(90 + wave * 110);
    desHCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
    desHCtx.fillRect(0, y, 512, 1);
  }
  addAlbedoGrain(desCtx, 512, 512, 24);
  const desertTerrain = makePbrMaterial(desC, desH, 28, 28, {
    normalStrength: 1.6,
    normalScale: 0.9,
    roughMin: 0.88,
    roughMax: 0.98,
    metalness: 0.0,
  });

  // --- 3. Sandstone Masonry Wall & Arch ---
  const [wallC, wallCtx] = makeCanvas(256, 256);
  const [wallH, wallHCtx] = makeCanvas(256, 256);
  wallCtx.fillStyle = '#cba878';
  wallCtx.fillRect(0, 0, 256, 256);
  wallHCtx.fillStyle = '#888888';
  wallHCtx.fillRect(0, 0, 256, 256);
  addAlbedoGrain(wallCtx, 256, 256, 18);

  const sandstoneWall = makePbrMaterial(wallC, wallH, 3.0, 1.0, {
    normalStrength: 2.5,
    normalScale: 1.25,
    roughMin: 0.74,
    roughMax: 0.96,
    metalness: 0.02,
  });

  const sandstoneArch = makePbrMaterial(wallC, wallH, 0.35, 0.35, {
    normalStrength: 2.2,
    normalScale: 1.15,
    roughMin: 0.74,
    roughMax: 0.96,
    metalness: 0.02,
  });

  // --- 4. Industrial Concrete Wall & Slab ---
  const [concC, concCtx] = makeCanvas(256, 256);
  const [concH, concHCtx] = makeCanvas(256, 256);
  concCtx.fillStyle = '#8b9096';
  concCtx.fillRect(0, 0, 256, 256);
  concHCtx.fillStyle = '#909090';
  concHCtx.fillRect(0, 0, 256, 256);
  addAlbedoGrain(concCtx, 256, 256, 18);

  const concreteWall = makePbrMaterial(concC, concH, 2.0, 1.0, {
    normalStrength: 2.0,
    normalScale: 1.0,
    roughMin: 0.7,
    roughMax: 0.92,
    metalness: 0.06,
  });

  const concreteFloor = makePbrMaterial(concC, concH, 4.0, 4.0, {
    normalStrength: 1.8,
    normalScale: 0.9,
    roughMin: 0.68,
    roughMax: 0.9,
    metalness: 0.06,
  });

  // --- 5. Military Wood Crate ---
  const [wdC, wdCtx] = makeCanvas(256, 256);
  const [wdH, wdHCtx] = makeCanvas(256, 256);
  wdCtx.fillStyle = '#8f6942';
  wdCtx.fillRect(0, 0, 256, 256);
  wdHCtx.fillStyle = '#888888';
  wdHCtx.fillRect(0, 0, 256, 256);
  addAlbedoGrain(wdCtx, 256, 256, 18);

  const woodCrate = makePbrMaterial(wdC, wdH, 1.0, 1.0, {
    normalStrength: 2.4,
    normalScale: 1.25,
    roughMin: 0.68,
    roughMax: 0.92,
    metalness: 0.04,
  });

  // --- 6. Photorealistic Seamless Upgrade Loader (Albedo + Luminance-to-Normal/Roughness) ---
  const upgradeFromPhoto = (
    url: string,
    targets: Array<{ mat: THREE.MeshStandardMaterial; rx: number; ry: number; strength: number; rMin: number; rMax: number }>
  ) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (disposed) return;
      const [c, ctx] = makeCanvas(512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);

      targets.forEach(({ mat, rx, ry, strength, rMin, rMax }) => {
        const colorTex = trackTex(toColorTexture(c, rx, ry, maxAnisotropy));
        const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
          c,
          rx,
          ry,
          maxAnisotropy,
          strength,
          rMin,
          rMax
        );
        trackTex(normalMap);
        trackTex(roughnessMap);

        mat.map = colorTex;
        mat.normalMap = normalMap;
        mat.roughnessMap = roughnessMap;
        mat.needsUpdate = true;
      });
    };
    img.src = url;
  };

  upgradeFromPhoto(PHOTO_TEXTURE_URLS.sandstone, [
    { mat: sandstoneWall, rx: 3.0, ry: 1.0, strength: 2.8, rMin: 0.72, rMax: 0.96 },
    { mat: sandstoneArch, rx: 0.32, ry: 0.32, strength: 2.4, rMin: 0.72, rMax: 0.96 },
  ]);
  upgradeFromPhoto(PHOTO_TEXTURE_URLS.desertGround, [
    { mat: sandGround, rx: 20, ry: 20, strength: 2.4, rMin: 0.76, rMax: 0.97 },
  ]);
  upgradeFromPhoto(PHOTO_TEXTURE_URLS.concrete, [
    { mat: concreteWall, rx: 2.0, ry: 1.0, strength: 2.2, rMin: 0.68, rMax: 0.92 },
    { mat: concreteFloor, rx: 4.0, ry: 4.0, strength: 1.9, rMin: 0.66, rMax: 0.9 },
  ]);
  upgradeFromPhoto(PHOTO_TEXTURE_URLS.woodCrate, [
    { mat: woodCrate, rx: 1.0, ry: 1.0, strength: 2.6, rMin: 0.68, rMax: 0.92 },
  ]);

  // --- 7. Corrugated Shipping Containers (Sinusoidal Normal Ribs + Metallic Specular) ---
  const buildContainerMat = (baseRgb: [number, number, number], code: string) => {
    const [c, ctx] = makeCanvas(512, 512);
    const [hc, hctx] = makeCanvas(512, 512);
    for (let x = 0; x < 512; x++) {
      const rib = Math.sin((x / 24) * Math.PI * 2) * 0.5 + 0.5;
      const shade = Math.round((rib - 0.5) * 34);
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, baseRgb[0] + shade))}, ${Math.max(
        0,
        Math.min(255, baseRgb[1] + shade)
      )}, ${Math.max(0, Math.min(255, baseRgb[2] + shade))})`;
      ctx.fillRect(x, 0, 1, 512);

      const hv = Math.round(50 + rib * 185);
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(x, 0, 1, 512);
    }
    const gr = ctx.createLinearGradient(0, 360, 0, 512);
    gr.addColorStop(0, 'rgba(40,28,18,0)');
    gr.addColorStop(1, 'rgba(40,28,18,0.48)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 360, 512, 152);
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = 'rgba(110, 52, 28, 0.28)';
      ctx.fillRect(Math.random() * 512, Math.random() * 440, 4 + Math.random() * 14, 24 + Math.random() * 60);
    }
    ctx.fillStyle = 'rgba(242, 244, 240, 0.78)';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(code, 38, 120);
    addAlbedoGrain(ctx, 512, 512, 18);

    return makePbrMaterial(c, hc, 2, 1, {
      normalStrength: 2.9,
      normalScale: 1.4,
      roughMin: 0.34,
      roughMax: 0.74,
      metalness: 0.55,
    });
  };

  const containerOlive = buildContainerMat([74, 94, 68], 'SEC-A7');
  const containerRust = buildContainerMat([156, 78, 48], 'LOG-B2');

  // --- 8. Hazard Chevron Trim ---
  const [hzC, hzCtx] = makeCanvas(256, 256);
  hzCtx.fillStyle = '#eab308';
  hzCtx.fillRect(0, 0, 256, 256);
  hzCtx.fillStyle = '#18181b';
  for (let i = -256; i < 512; i += 64) {
    hzCtx.beginPath();
    hzCtx.moveTo(i, 0);
    hzCtx.lineTo(i + 32, 0);
    hzCtx.lineTo(i + 288, 256);
    hzCtx.lineTo(i + 256, 256);
    hzCtx.closePath();
    hzCtx.fill();
  }
  addAlbedoGrain(hzCtx, 256, 256, 16);
  const hazardTex = trackTex(toColorTexture(hzC, 6, 1, maxAnisotropy));

  // --- 9. Helipad H Concrete Marking ---
  const [hpC, hpCtx] = makeCanvas(512, 512);
  const [hpH, hpHCtx] = makeCanvas(512, 512);
  hpCtx.fillStyle = '#5c626a';
  hpCtx.fillRect(0, 0, 512, 512);
  hpHCtx.fillStyle = '#a8a8a8';
  hpHCtx.fillRect(0, 0, 512, 512);
  addAlbedoGrain(hpCtx, 512, 512, 18);
  addAlbedoGrain(hpHCtx, 512, 512, 24);
  hpCtx.strokeStyle = '#f59e0b';
  hpCtx.lineWidth = 22;
  hpCtx.beginPath();
  hpCtx.arc(256, 256, 210, 0, Math.PI * 2);
  hpCtx.stroke();
  hpCtx.fillStyle = '#e2e8f0';
  hpCtx.fillRect(148, 128, 42, 256);
  hpCtx.fillRect(322, 128, 42, 256);
  hpCtx.fillRect(148, 235, 216, 42);
  const helipadFloor = makePbrMaterial(hpC, hpH, 1, 1, {
    normalStrength: 1.5,
    normalScale: 0.7,
    roughMin: 0.7,
    roughMax: 0.9,
    metalness: 0.08,
  });

  // --- 10. Sandbag Canvas Texture ---
  const [sbC, sbCtx] = makeCanvas(256, 256);
  const [sbH, sbHCtx] = makeCanvas(256, 256);
  sbCtx.fillStyle = '#bfa67a';
  sbCtx.fillRect(0, 0, 256, 256);
  sbHCtx.fillStyle = '#9a9a9a';
  sbHCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 6) {
    sbCtx.fillStyle = i % 12 === 0 ? 'rgba(90, 72, 48, 0.14)' : 'rgba(245, 228, 195, 0.12)';
    sbCtx.fillRect(0, i, 256, 2);
    sbCtx.fillRect(i, 0, 2, 256);
    sbHCtx.fillStyle = i % 12 === 0 ? '#707070' : '#c0c0c0';
    sbHCtx.fillRect(0, i, 256, 2);
  }
  addAlbedoGrain(sbCtx, 256, 256, 16);
  const sandbagMat = makePbrMaterial(sbC, sbH, 2, 2, {
    normalStrength: 1.6,
    normalScale: 0.9,
    roughMin: 0.86,
    roughMax: 0.98,
    metalness: 0.0,
  });

  // --- 11. Ground Contact Shadow Disc Texture ---
  const [csC, csCtx] = makeCanvas(128, 128);
  const csGrad = csCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  csGrad.addColorStop(0, 'rgba(14, 11, 8, 0.72)');
  csGrad.addColorStop(0.55, 'rgba(14, 11, 8, 0.34)');
  csGrad.addColorStop(1, 'rgba(14, 11, 8, 0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 128, 128);
  const csTex = trackTex(toColorTexture(csC, 1, 1, maxAnisotropy));

  // --- 12. Bullet Impact Crater Decal Texture ---
  const [bdC, bdCtx] = makeCanvas(64, 64);
  const bdGrad = bdCtx.createRadialGradient(32, 32, 2, 32, 32, 28);
  bdGrad.addColorStop(0, 'rgba(15, 15, 15, 0.95)');
  bdGrad.addColorStop(0.32, 'rgba(35, 32, 28, 0.8)');
  bdGrad.addColorStop(0.6, 'rgba(85, 76, 62, 0.35)');
  bdGrad.addColorStop(1, 'rgba(85, 76, 62, 0)');
  bdCtx.fillStyle = bdGrad;
  bdCtx.fillRect(0, 0, 64, 64);
  const bdTex = trackTex(toColorTexture(bdC, 1, 1, maxAnisotropy));

  // --- 13. Panoramic Desert Sky Dome Texture ---
  const [skyC, skyCtx] = makeCanvas(1024, 512);
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0.0, '#1e4a7a');
  skyGrad.addColorStop(0.34, '#568bc0');
  skyGrad.addColorStop(0.49, '#cbd3d4');
  skyGrad.addColorStop(0.54, '#e2d2ba');
  skyGrad.addColorStop(1.0, '#b99d73');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * 1024;
    const cy = 85 + Math.random() * 135;
    const rw = 65 + Math.random() * 125;
    const rh = 12 + Math.random() * 24;
    const cGrad = skyCtx.createRadialGradient(cx, cy, 4, cx, cy, rw);
    cGrad.addColorStop(0, 'rgba(255, 248, 238, 0.38)');
    cGrad.addColorStop(1, 'rgba(255, 248, 238, 0)');
    skyCtx.save();
    skyCtx.translate(cx, cy);
    skyCtx.scale(1, rh / rw);
    skyCtx.translate(-cx, -cy);
    skyCtx.fillStyle = cGrad;
    skyCtx.beginPath();
    skyCtx.arc(cx, cy, rw, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.restore();
  }

  const sunAzimuth = Math.atan2(42, 34);
  const sunU = ((sunAzimuth / (Math.PI * 2)) + 1) % 1;
  const sunX = sunU * 1024;
  const sunY = 125;
  const sunHalo = skyCtx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 160);
  sunHalo.addColorStop(0, 'rgba(255, 252, 235, 1)');
  sunHalo.addColorStop(0.08, 'rgba(255, 236, 188, 0.88)');
  sunHalo.addColorStop(0.35, 'rgba(255, 214, 148, 0.3)');
  sunHalo.addColorStop(1, 'rgba(255, 214, 148, 0)');
  skyCtx.fillStyle = sunHalo;
  skyCtx.fillRect(0, 0, 1024, 340);

  const skyTexture = trackTex(new THREE.CanvasTexture(skyC));
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.needsUpdate = true;

  return {
    sandGround,
    desertTerrain,
    sandstoneWall,
    sandstoneArch,
    concreteWall,
    concreteFloor,
    woodCrate,
    containerOlive,
    containerRust,
    hazardTrim: trackMat(new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.62, metalness: 0.18 })),
    helipadFloor,
    darkSteel: trackMat(new THREE.MeshStandardMaterial({ color: 0x262c35, roughness: 0.32, metalness: 0.86 })),
    sandbagMat,
    mesaRock: trackMat(new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.94, metalness: 0.02 })),
    foliageMat: trackMat(new THREE.MeshStandardMaterial({ color: 0x5c6f3e, roughness: 0.88, metalness: 0.02 })),
    contactShadowMat: trackMat(
      new THREE.MeshBasicMaterial({
        map: csTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    ),
    bulletDecalMat: trackMat(
      new THREE.MeshBasicMaterial({
        map: bdTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    ),
    skyTexture,
    dispose: () => {
      disposed = true;
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
