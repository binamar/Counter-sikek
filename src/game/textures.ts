import * as THREE from 'three';

export interface TacticalMaterials {
  sandGround: THREE.MeshStandardMaterial;
  desertTerrain: THREE.MeshStandardMaterial;
  sandstoneWall: THREE.MeshStandardMaterial;
  concreteWall: THREE.MeshStandardMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  woodCrate: THREE.MeshStandardMaterial;
  containerOlive: THREE.MeshStandardMaterial;
  containerRust: THREE.MeshStandardMaterial;
  hazardTrim: THREE.MeshStandardMaterial;
  helipadFloor: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  mesaRock: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number): void {
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

function toTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTacticalMaterials(maxAnisotropy: number): TacticalMaterials {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const track = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Courtyard compacted sandstone pavers & grit
  const [sandC, sandCtx] = makeCanvas(512, 512);
  sandCtx.fillStyle = '#c8aa7e';
  sandCtx.fillRect(0, 0, 512, 512);
  const tile = 64;
  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      const shade = Math.floor((Math.random() - 0.5) * 16);
      sandCtx.fillStyle = `rgb(${202 + shade}, ${172 + shade}, ${126 + shade})`;
      sandCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      sandCtx.strokeStyle = 'rgba(115, 92, 62, 0.28)';
      sandCtx.lineWidth = 2;
      sandCtx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }
  // Subtle dust drift patches
  for (let i = 0; i < 16; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const r = 30 + Math.random() * 60;
    const grad = sandCtx.createRadialGradient(gx, gy, 2, gx, gy, r);
    grad.addColorStop(0, 'rgba(218, 192, 146, 0.32)');
    grad.addColorStop(1, 'rgba(218, 192, 146, 0)');
    sandCtx.fillStyle = grad;
    sandCtx.fillRect(0, 0, 512, 512);
  }
  addGrain(sandCtx, 512, 512, 18);
  const sandGroundTex = track(toTexture(sandC, 16, 16, maxAnisotropy));

  // 2. Outer open desert terrain
  const [desC, desCtx] = makeCanvas(512, 512);
  desCtx.fillStyle = '#bfa074';
  desCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    desCtx.fillStyle = i % 2 === 0 ? 'rgba(168, 134, 92, 0.22)' : 'rgba(225, 198, 152, 0.22)';
    desCtx.beginPath();
    desCtx.ellipse(
      Math.random() * 512,
      Math.random() * 512,
      30 + Math.random() * 80,
      10 + Math.random() * 25,
      0.2,
      0,
      Math.PI * 2
    );
    desCtx.fill();
  }
  addGrain(desCtx, 512, 512, 22);
  const desertTex = track(toTexture(desC, 24, 24, maxAnisotropy));

  // 3. Sandstone ashlar block walls (Counter-Strike Dust2 vibe)
  const [wallC, wallCtx] = makeCanvas(512, 512);
  wallCtx.fillStyle = '#d3b88c';
  wallCtx.fillRect(0, 0, 512, 512);
  const rowH = 64;
  const colW = 128;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (colW / 2);
    for (let col = -1; col < 5; col++) {
      const x = col * colW + offset;
      const y = row * rowH;
      const d = Math.floor((Math.random() - 0.5) * 20);
      wallCtx.fillStyle = `rgb(${212 + d}, ${184 + d}, ${140 + d})`;
      wallCtx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
      wallCtx.strokeStyle = 'rgba(118, 94, 62, 0.48)';
      wallCtx.lineWidth = 3;
      wallCtx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);
    }
  }
  // Bottom weathering band
  const dirtGrad = wallCtx.createLinearGradient(0, 360, 0, 512);
  dirtGrad.addColorStop(0, 'rgba(90, 70, 48, 0)');
  dirtGrad.addColorStop(1, 'rgba(90, 70, 48, 0.32)');
  wallCtx.fillStyle = dirtGrad;
  wallCtx.fillRect(0, 360, 512, 152);
  addGrain(wallCtx, 512, 512, 18);
  const sandstoneWallTex = track(toTexture(wallC, 2, 1, maxAnisotropy));

  // 4. Industrial poured concrete wall
  const [concC, concCtx] = makeCanvas(512, 512);
  concCtx.fillStyle = '#8b9196';
  concCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 256) {
      const s = Math.floor((Math.random() - 0.5) * 14);
      concCtx.fillStyle = `rgb(${138 + s}, ${144 + s}, ${149 + s})`;
      concCtx.fillRect(x + 2, y + 2, 252, 124);
      concCtx.strokeStyle = 'rgba(42, 46, 52, 0.45)';
      concCtx.lineWidth = 3;
      concCtx.strokeRect(x + 1, y + 1, 254, 126);
      // Formwork tie holes
      concCtx.fillStyle = 'rgba(42, 46, 52, 0.55)';
      [24, 232].forEach((bx) => {
        [24, 104].forEach((by) => {
          concCtx.beginPath();
          concCtx.arc(x + bx, y + by, 4, 0, Math.PI * 2);
          concCtx.fill();
        });
      });
    }
  }
  addGrain(concCtx, 512, 512, 20);
  const concreteWallTex = track(toTexture(concC, 2, 1, maxAnisotropy));

  // 5. Industrial concrete floor
  const [flC, flCtx] = makeCanvas(512, 512);
  flCtx.fillStyle = '#7b8085';
  flCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const s = Math.floor((Math.random() - 0.5) * 12);
      flCtx.fillStyle = `rgb(${120 + s}, ${125 + s}, ${130 + s})`;
      flCtx.fillRect(x + 2, y + 2, 124, 124);
    }
  }
  addGrain(flCtx, 512, 512, 16);
  const concreteFloorTex = track(toTexture(flC, 4, 4, maxAnisotropy));

  // 6. Wooden tactical crate
  const [wdC, wdCtx] = makeCanvas(512, 512);
  wdCtx.fillStyle = '#a37849';
  wdCtx.fillRect(0, 0, 512, 512);
  // Horizontal planks
  for (let y = 0; y < 512; y += 64) {
    const d = Math.floor((Math.random() - 0.5) * 18);
    wdCtx.fillStyle = `rgb(${164 + d}, ${118 + d}, ${72 + d})`;
    wdCtx.fillRect(0, y + 2, 512, 60);
    wdCtx.fillStyle = 'rgba(65, 42, 20, 0.45)';
    wdCtx.fillRect(0, y, 512, 3);
  }
  // Outer frame + diagonal brace
  wdCtx.strokeStyle = '#6f4c28';
  wdCtx.lineWidth = 42;
  wdCtx.strokeRect(21, 21, 470, 470);
  wdCtx.beginPath();
  wdCtx.moveTo(28, 28);
  wdCtx.lineTo(484, 484);
  wdCtx.lineWidth = 34;
  wdCtx.stroke();
  // Stencil mark
  wdCtx.fillStyle = 'rgba(30, 24, 16, 0.65)';
  wdCtx.font = 'bold 42px monospace';
  wdCtx.fillText('ORD-04', 70, 120);
  addGrain(wdCtx, 512, 512, 18);
  const woodCrateTex = track(toTexture(wdC, 1, 1, maxAnisotropy));

  // 7. Corrugated shipping container builder
  const buildContainerTex = (baseRgb: [number, number, number], code: string) => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = `rgb(${baseRgb[0]}, ${baseRgb[1]}, ${baseRgb[2]})`;
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 24) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 8, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x + 8, 0, 6, 512);
    }
    // Weathering grime
    const gr = ctx.createLinearGradient(0, 380, 0, 512);
    gr.addColorStop(0, 'rgba(35,28,20,0)');
    gr.addColorStop(1, 'rgba(35,28,20,0.42)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 380, 512, 132);
    // White stencil code
    ctx.fillStyle = 'rgba(240, 242, 238, 0.72)';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(code, 38, 120);
    addGrain(ctx, 512, 512, 16);
    return track(toTexture(c, 2, 1, maxAnisotropy));
  };
  const containerOliveTex = buildContainerTex([72, 92, 68], 'SEC-A7');
  const containerRustTex = buildContainerTex([152, 76, 48], 'LOG-B2');

  // 8. Hazard chevron trim
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
  addGrain(hzCtx, 256, 256, 14);
  const hazardTex = track(toTexture(hzC, 6, 1, maxAnisotropy));

  // 9. Helipad H marking
  const [hpC, hpCtx] = makeCanvas(512, 512);
  hpCtx.fillStyle = '#5c626a';
  hpCtx.fillRect(0, 0, 512, 512);
  addGrain(hpCtx, 512, 512, 14);
  hpCtx.strokeStyle = '#f59e0b';
  hpCtx.lineWidth = 22;
  hpCtx.beginPath();
  hpCtx.arc(256, 256, 210, 0, Math.PI * 2);
  hpCtx.stroke();
  hpCtx.fillStyle = '#e2e8f0';
  hpCtx.fillRect(148, 128, 42, 256);
  hpCtx.fillRect(322, 128, 42, 256);
  hpCtx.fillRect(148, 235, 216, 42);
  const helipadTex = track(toTexture(hpC, 1, 1, maxAnisotropy));

  return {
    sandGround: trackMat(new THREE.MeshStandardMaterial({ map: sandGroundTex, roughness: 0.92, metalness: 0.02 })),
    desertTerrain: trackMat(new THREE.MeshStandardMaterial({ map: desertTex, roughness: 0.96, metalness: 0.0 })),
    sandstoneWall: trackMat(new THREE.MeshStandardMaterial({ map: sandstoneWallTex, roughness: 0.88, metalness: 0.04 })),
    concreteWall: trackMat(new THREE.MeshStandardMaterial({ map: concreteWallTex, roughness: 0.82, metalness: 0.08 })),
    concreteFloor: trackMat(new THREE.MeshStandardMaterial({ map: concreteFloorTex, roughness: 0.8, metalness: 0.08 })),
    woodCrate: trackMat(new THREE.MeshStandardMaterial({ map: woodCrateTex, roughness: 0.84, metalness: 0.05 })),
    containerOlive: trackMat(new THREE.MeshStandardMaterial({ map: containerOliveTex, roughness: 0.54, metalness: 0.42 })),
    containerRust: trackMat(new THREE.MeshStandardMaterial({ map: containerRustTex, roughness: 0.62, metalness: 0.35 })),
    hazardTrim: trackMat(new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.65, metalness: 0.15 })),
    helipadFloor: trackMat(new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.78, metalness: 0.1 })),
    darkSteel: trackMat(new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.4, metalness: 0.78 })),
    mesaRock: trackMat(new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.95, metalness: 0.02 })),
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
