import * as THREE from 'three';
import { AABBCollider, RampSurface } from './types';

export interface TacticalBot {
  id: number;
  name: string;
  group: THREE.Group;
  pelvisGroup: THREE.Group;
  upperBodyGroup: THREE.Group;
  headGroup: THREE.Group;
  weaponRigGroup: THREE.Group;
  botMuzzleFlash: THREE.Group;
  headMesh: THREE.Mesh;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  muzzlePoint: THREE.Object3D;
  hitMeshes: THREE.Object3D[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  alive: boolean;
  deathTimer: number;
  deathDir: number;
  hitFlashTimer: number;
  flinchTimer: number;
  recoilTimer: number;
  muzzleFlashTimer: number;
  crouchBlend: number;
  targetWaypoint: THREE.Vector3;
  strafeDir: number;
  strafeTimer: number;
  fireCooldown: number;
  burstRemaining: number;
  walkPhase: number;
  scanPhase: number;
  awareOfPlayer: boolean;
  alertTimer: number;
  bodyMat: THREE.MeshStandardMaterial;
  vestMat: THREE.MeshStandardMaterial;
  visorMat: THREE.MeshStandardMaterial;
}

export interface BotUpdateOptions {
  difficultyFireScale: number;
  burstPauseScale?: number;
  minDamage?: number;
  maxDamage?: number;
  strafeSpeedScale?: number;
}

const BOT_CALLSIGNS = [
  'Viper-01',
  'Jackal-02',
  'Kestrel-03',
  'Nomad-04',
  'Rook-05',
  'Talon-06',
  'Sirocco-07',
  'Cobalt-08',
  'Dune-09',
  'Specter-10',
];

function createOperativeTextures(): {
  camoMap: THREE.CanvasTexture;
  weaveNormal: THREE.DataTexture;
  vestMap: THREE.CanvasTexture;
  headBalaclavaMap: THREE.CanvasTexture;
} {
  // 1. MultiCam-Inspired Desert/Urban Ripstop BDU Fabric
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#535144';
  ctx.fillRect(0, 0, 256, 256);

  const blotchColors = ['#3d3f35', '#6e6550', '#877b62', '#2d3028', '#5e5a46'];
  for (let i = 0; i < 85; i++) {
    ctx.fillStyle = blotchColors[i % blotchColors.length];
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 256,
      Math.random() * 256,
      8 + Math.random() * 22,
      5 + Math.random() * 14,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  // Micro-speckle & ripstop reinforcement grid + subtle seam stitching
  for (let i = 0; i < 450; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,245,220,0.08)' : 'rgba(20,20,18,0.12)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(20, 22, 20, 0.24)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 256; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const camoMap = new THREE.CanvasTexture(c);
  camoMap.wrapS = THREE.RepeatWrapping;
  camoMap.wrapT = THREE.RepeatWrapping;
  camoMap.repeat.set(2, 2);
  camoMap.colorSpace = THREE.SRGBColorSpace;

  // 2. Ballistic Cordura 1000D Nylon & PALS/MOLLE Webbing Texture
  const vc = document.createElement('canvas');
  vc.width = 256;
  vc.height = 256;
  const vctx = vc.getContext('2d')!;
  vctx.fillStyle = '#5c4b37';
  vctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    vctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)';
    vctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let y = 0; y < 256; y += 24) {
    vctx.fillStyle = '#473928';
    vctx.fillRect(0, y, 256, 11);
    vctx.fillStyle = 'rgba(255,240,210,0.1)';
    vctx.fillRect(0, y, 256, 1.5);
    vctx.fillStyle = 'rgba(0,0,0,0.28)';
    vctx.fillRect(0, y + 10, 256, 2);
    for (let x = 0; x < 256; x += 28) {
      vctx.fillStyle = '#251d14';
      vctx.fillRect(x, y, 3, 11);
    }
  }
  const vestMap = new THREE.CanvasTexture(vc);
  vestMap.wrapS = THREE.RepeatWrapping;
  vestMap.wrapT = THREE.RepeatWrapping;
  vestMap.repeat.set(1.5, 1.5);
  vestMap.colorSpace = THREE.SRGBColorSpace;

  // 3. Tactical Balaclava + Exposed Eye-Bridge Skin Texture (UV mapped onto Lathe head)
  const hc = document.createElement('canvas');
  hc.width = 256;
  hc.height = 256;
  const hctx = hc.getContext('2d')!;
  // Charcoal knit balaclava base
  hctx.fillStyle = '#23262b';
  hctx.fillRect(0, 0, 256, 256);
  // Subtle ribbed knit grain
  for (let x = 0; x < 256; x += 4) {
    hctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
    hctx.fillRect(x, 0, 2, 256);
  }
  // Exposed skin eye-slit band at the front face (LatheGeometry u=0.25 or u=0.5 depending on rotation;
  // in Three.js LatheGeometry default seam is +X, front +Z is around u=0.25 or u=0.75. Let's align cleanly!)
  // We'll place the eye-slit centered at u = 0.25 (x = 64) and rotate headMesh y = Math.PI/2 or check:
  // Actually in Three.js LatheGeometry, phi=0 is (x=0, z=+r) or (x=+r, z=0)?
  // LatheGeometry uses x = r * sin(phi), z = r * cos(phi), so phi=0 -> +Z (front!), u=0 / u=1.
  // So let's draw the face opening wrapped around x=0 and x=256 (or rotate headMesh by Math.PI so u=0.5 is front +Z!).
  // Rotating headMesh.rotation.y = Math.PI makes phi = Math.PI (u = 0.5, x = 128) point directly at +Z!
  const faceX = 128;
  const faceY = 104;
  // Stitched seam around balaclava opening
  hctx.fillStyle = '#181a1e';
  hctx.beginPath();
  hctx.ellipse(faceX, faceY, 44, 20, 0, 0, Math.PI * 2);
  hctx.fill();
  // Realistic warm weathered skin tone inside eye slit
  const skinGrad = hctx.createLinearGradient(faceX, faceY - 16, faceX, faceY + 16);
  skinGrad.addColorStop(0, '#9c7258');
  skinGrad.addColorStop(0.45, '#bd8e70');
  skinGrad.addColorStop(1, '#8c6249');
  hctx.fillStyle = skinGrad;
  hctx.beginPath();
  hctx.ellipse(faceX, faceY, 39, 15, 0, 0, Math.PI * 2);
  hctx.fill();
  // Brow & subtle eye sockets
  hctx.fillStyle = '#3b2920';
  hctx.fillRect(faceX - 24, faceY - 7, 17, 3.5);
  hctx.fillRect(faceX + 7, faceY - 7, 17, 3.5);
  hctx.fillStyle = 'rgba(42, 24, 18, 0.55)';
  hctx.beginPath();
  hctx.ellipse(faceX - 15, faceY + 1, 7, 4, 0, 0, Math.PI * 2);
  hctx.ellipse(faceX + 15, faceY + 1, 7, 4, 0, 0, Math.PI * 2);
  hctx.fill();
  // Nose bridge highlight
  hctx.fillStyle = 'rgba(235, 196, 168, 0.28)';
  hctx.fillRect(faceX - 3, faceY - 2, 6, 11);
  // Mouth breather mesh panel on lower balaclava
  hctx.fillStyle = '#191b1f';
  hctx.beginPath();
  hctx.ellipse(faceX, faceY + 34, 19, 12, 0, 0, Math.PI * 2);
  hctx.fill();
  hctx.fillStyle = 'rgba(255,255,255,0.09)';
  for (let py = faceY + 25; py <= faceY + 42; py += 4) {
    for (let px = faceX - 13; px <= faceX + 13; px += 5) {
      hctx.fillRect(px, py, 2, 2);
    }
  }

  const headBalaclavaMap = new THREE.CanvasTexture(hc);
  headBalaclavaMap.colorSpace = THREE.SRGBColorSpace;

  // 4. Tangent-Space Ripstop Fabric Weave Normal Map
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = Math.sin((x / 3.5) * Math.PI * 2) * 0.3;
      const wy = Math.cos((y / 3.5) * Math.PI * 2) * 0.3;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((wx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((wy * 0.5 + 0.5) * 255);
      data[idx + 2] = 245;
      data[idx + 3] = 255;
    }
  }
  const weaveNormal = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  weaveNormal.wrapS = THREE.RepeatWrapping;
  weaveNormal.wrapT = THREE.RepeatWrapping;
  weaveNormal.repeat.set(4, 4);
  weaveNormal.needsUpdate = true;

  return { camoMap, weaveNormal, vestMap, headBalaclavaMap };
}

export class BotManager {
  public bots: TacticalBot[] = [];
  private sharedGeos: THREE.BufferGeometry[] = [];
  private sharedMats: THREE.Material[] = [];
  private sharedTextures: THREE.Texture[] = [];
  private contactShadowMat: THREE.Material;
  private scene: THREE.Scene;

  private camoMap: THREE.CanvasTexture;
  private weaveNormal: THREE.DataTexture;
  private vestMap: THREE.CanvasTexture;
  private headBalaclavaMap: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, contactShadowMat: THREE.Material) {
    this.scene = scene;
    this.contactShadowMat = contactShadowMat;
    const tex = createOperativeTextures();
    this.camoMap = tex.camoMap;
    this.weaveNormal = tex.weaveNormal;
    this.vestMap = tex.vestMap;
    this.headBalaclavaMap = tex.headBalaclavaMap;
    this.sharedTextures.push(this.camoMap, this.weaveNormal, this.vestMap, this.headBalaclavaMap);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.sharedGeos.push(g);
    return g;
  }

  private createBotMesh(id: number, name: string): TacticalBot {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      map: this.camoMap,
      normalMap: this.weaveNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.84,
      metalness: 0.05,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      map: this.vestMap,
      normalMap: this.weaveNormal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughness: 0.78,
      metalness: 0.08,
    });
    const headBalaclavaMat = new THREE.MeshStandardMaterial({
      map: this.headBalaclavaMap,
      normalMap: this.weaveNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.82,
      metalness: 0.04,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x353932,
      normalMap: this.weaveNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.56,
      metalness: 0.24,
    });
    const bootLeatherMat = new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.68, metalness: 0.12 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.88, metalness: 0.08 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x2c2b26, roughness: 0.78, metalness: 0.08 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.28, metalness: 0.86 });
    const gunTanMat = new THREE.MeshStandardMaterial({ color: 0x6f624c, roughness: 0.44, metalness: 0.35 });
    const opticLensMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b2a36,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.55,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x451a03,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.12,
      metalness: 0.35,
      clearcoat: 1.0,
    });
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x8b2e24, roughness: 0.7, metalness: 0.1 });
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    this.sharedMats.push(
      bodyMat,
      vestMat,
      headBalaclavaMat,
      helmetMat,
      bootLeatherMat,
      rubberMat,
      gloveMat,
      gunMat,
      gunTanMat,
      opticLensMat,
      visorMat,
      patchMat,
      flashMat
    );

    // 1. Soft Ground Contact Shadow
    const shadowDisc = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.3, 1.3)), this.contactShadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.015;
    group.add(shadowDisc);

    // 2. Pelvis & Tactical Battle Belt Hierarchy
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 0.86, 0);
    group.add(pelvisGroup);

    const pelvisGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.01, -0.1),
          new THREE.Vector2(0.17, -0.09),
          new THREE.Vector2(0.2, -0.01),
          new THREE.Vector2(0.19, 0.08),
          new THREE.Vector2(0.01, 0.09),
        ],
        12
      )
    );
    pelvisGeo.scale(1.12, 1, 0.74);
    const pelvisBlock = new THREE.Mesh(pelvisGeo, bodyMat);
    pelvisBlock.castShadow = true;

    const belt = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.215, 0.22, 0.075, 14)), vestMat);
    belt.scale.set(1.12, 1, 0.76);
    belt.position.y = 0.055;
    const buckle = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.085, 0.068, 0.03)), gunMat);
    buckle.position.set(0, 0.055, 0.165);

    // Rear IFAK medical pouch + dump pouch + double pistol mag pouch
    const ifak = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.15, 0.12, 0.085)), vestMat);
    ifak.position.set(0.04, 0.04, -0.175);
    const dumpPouch = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 10)), rubberMat);
    dumpPouch.position.set(-0.18, -0.02, -0.11);

    pelvisGroup.add(pelvisBlock, belt, buckle, ifak, dumpPouch);

    // 3. Anatomically Contoured Multi-Jointed Legs (Lathe Thighs, Calves, Hard Knee Shell & Lugged Boots)
    const thighGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.072, 0.02),
          new THREE.Vector2(0.082, 0.11),
          new THREE.Vector2(0.105, 0.26),
          new THREE.Vector2(0.112, 0.36),
          new THREE.Vector2(0.085, 0.4),
          new THREE.Vector2(0.001, 0.4),
        ],
        12
      )
    );
    thighGeo.translate(0, -0.4, 0);

    const shinGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.058, 0.02),
          new THREE.Vector2(0.066, 0.1),
          new THREE.Vector2(0.086, 0.24),
          new THREE.Vector2(0.08, 0.34),
          new THREE.Vector2(0.072, 0.38),
          new THREE.Vector2(0.001, 0.38),
        ],
        12
      )
    );
    shinGeo.translate(0, -0.37, 0);

    const buildArticulatedLeg = (xOffset: number) => {
      const hipGroup = new THREE.Group();
      hipGroup.position.set(xOffset, -0.02, 0);

      const thigh = new THREE.Mesh(thighGeo, bodyMat);
      thigh.castShadow = true;

      // BDU Cargo pocket with flap on outer thigh
      const pocket = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.04, 0.16, 0.13)), vestMat);
      pocket.position.set(xOffset > 0 ? 0.092 : -0.092, -0.21, 0);
      const pocketFlap = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.045, 0.045, 0.134)), bodyMat);
      pocketFlap.position.set(xOffset > 0 ? 0.095 : -0.095, -0.14, 0);

      // Right thigh drop-leg polymer holster + pistol grip
      let holsterParts: THREE.Object3D[] = [];
      if (xOffset > 0) {
        const holsterBody = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.065, 0.17, 0.105)), rubberMat);
        holsterBody.position.set(0.105, -0.18, 0.02);
        const pistolGrip = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.036, 0.09, 0.05)), gunMat);
        pistolGrip.position.set(0.11, -0.09, -0.01);
        pistolGrip.rotation.x = -0.35;
        const legStrap = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.098, 0.095, 0.028, 12)), rubberMat);
        legStrap.position.set(0, -0.19, 0);
        hipGroup.add(holsterBody, pistolGrip, legStrap);
        holsterParts = [holsterBody, pistolGrip, legStrap];
      }

      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -0.4, 0);

      // Molded hard-shell Crye-style knee pad + strap
      const kneeShell = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.088, 10, 8, 0, Math.PI, 0, Math.PI)), rubberMat);
      kneeShell.scale.set(0.95, 0.9, 0.72);
      kneeShell.position.set(0, -0.01, 0.035);
      const kneeStrap = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.032, 10)), vestMat);
      kneeStrap.position.set(0, -0.01, 0);

      const shin = new THREE.Mesh(shinGeo, bodyMat);
      shin.castShadow = true;

      // Multi-part Tactical Combat Boot (laced shaft, leather vamp, rounded toe cap, lug sole, heel)
      const bootAnkle = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.072, 0.078, 0.14, 10)), bootLeatherMat);
      bootAnkle.position.set(0, -0.32, 0);
      const bootBody = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.135, 0.075, 0.2)), bootLeatherMat);
      bootBody.position.set(0, -0.39, 0.035);
      bootBody.castShadow = true;
      const bootToe = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.068, 10, 8)), bootLeatherMat);
      bootToe.scale.set(0.98, 0.65, 1.15);
      bootToe.position.set(0, -0.395, 0.125);
      const bootSole = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.145, 0.032, 0.28)), rubberMat);
      bootSole.position.set(0, -0.432, 0.055);
      const bootHeel = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.138, 0.025, 0.09)), rubberMat);
      bootHeel.position.set(0, -0.44, -0.04);

      kneeGroup.add(kneeShell, kneeStrap, shin, bootAnkle, bootBody, bootToe, bootSole, bootHeel);
      hipGroup.add(thigh, pocket, pocketFlap, kneeGroup);
      pelvisGroup.add(hipGroup);

      return {
        hipGroup,
        kneeGroup,
        parts: [thigh, pocket, pocketFlap, ...holsterParts, kneeShell, kneeStrap, shin, bootAnkle, bootBody, bootToe, bootSole, bootHeel],
      };
    };

    const leftLegBuilt = buildArticulatedLeg(-0.135);
    const rightLegBuilt = buildArticulatedLeg(0.135);

    // 4. Upper Body Hierarchy (Anatomical Torso + JPC Plate Carrier + PTT Radio + Coiled Cable + Pack)
    const upperBodyGroup = new THREE.Group();
    upperBodyGroup.position.set(0, 0.07, 0);
    pelvisGroup.add(upperBodyGroup);

    // Sculpted anatomical torso (athletic V-taper + collarbone/shoulders)
    const torsoShape = new THREE.Shape();
    torsoShape.moveTo(-0.18, 0);
    torsoShape.lineTo(0.18, 0);
    torsoShape.lineTo(0.24, 0.24);
    torsoShape.lineTo(0.27, 0.44);
    torsoShape.lineTo(0.14, 0.54);
    torsoShape.lineTo(-0.14, 0.54);
    torsoShape.lineTo(-0.27, 0.44);
    torsoShape.lineTo(-0.24, 0.24);
    torsoShape.closePath();
    const torsoGeo = this.trackGeo(
      new THREE.ExtrudeGeometry(torsoShape, {
        depth: 0.22,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.022,
        bevelSegments: 2,
      })
    );
    torsoGeo.translate(0, 0, -0.11);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.castShadow = true;
    torso.receiveShadow = true;

    // Angled SAPI Ballistic Plate Carrier (front & back tapered plates + cummerbund)
    const plateShape = new THREE.Shape();
    plateShape.moveTo(-0.16, 0.08);
    plateShape.lineTo(0.16, 0.08);
    plateShape.lineTo(0.16, 0.36);
    plateShape.lineTo(0.09, 0.47);
    plateShape.lineTo(-0.09, 0.47);
    plateShape.lineTo(-0.16, 0.36);
    plateShape.closePath();
    const plateGeo = this.trackGeo(
      new THREE.ExtrudeGeometry(plateShape, {
        depth: 0.29,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.015,
        bevelSegments: 2,
      })
    );
    plateGeo.translate(0, 0, -0.14);
    const vest = new THREE.Mesh(plateGeo, vestMat);
    vest.castShadow = true;

    // Side Cummerbund Straps
    const cummerbund = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.45, 0.14, 0.25)), vestMat);
    cummerbund.position.set(0, 0.19, 0);

    // Shoulder harness pads + red/IR unit patch + chest admin pouch
    const strapGeo = this.trackGeo(new THREE.BoxGeometry(0.075, 0.09, 0.27));
    const strapL = new THREE.Mesh(strapGeo, vestMat);
    strapL.position.set(-0.135, 0.5, 0);
    const strapR = new THREE.Mesh(strapGeo, vestMat);
    strapR.position.set(0.135, 0.5, 0);

    const adminPouch = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.17, 0.09, 0.045)), vestMat);
    adminPouch.position.set(0, 0.37, 0.165);
    const unitPatch = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.08, 0.045, 0.012)), patchMat);
    unitPatch.position.set(0.02, 0.37, 0.19);

    // Triple Magazine Pouches WITH Visible Curved Rifle Magazine Tops
    const magPouchGroup = new THREE.Group();
    for (let m = -1; m <= 1; m++) {
      const mp = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.082, 0.145, 0.062)), vestMat);
      mp.position.set(m * 0.096, 0.18, 0.185);
      const magTop = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.056, 0.055, 0.036)), gunTanMat);
      magTop.position.set(m * 0.096, 0.255, 0.185);
      magPouchGroup.add(mp, magTop);
    }

    // Chest Tactical Radio + PTT Button + TubeGeometry Comms Wire to Headset
    const radioBox = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.062, 0.13, 0.045)), rubberMat);
    radioBox.position.set(-0.185, 0.25, 0.14);
    const ptt = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.035, 0.05, 0.028)), gunMat);
    ptt.position.set(-0.135, 0.43, 0.17);
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.185, 0.31, 0.14),
      new THREE.Vector3(-0.15, 0.43, 0.165),
      new THREE.Vector3(-0.14, 0.54, 0.09),
      new THREE.Vector3(-0.155, 0.64, 0.02),
    ]);
    const commsWire = new THREE.Mesh(this.trackGeo(new THREE.TubeGeometry(wireCurve, 12, 0.008, 5, false)), rubberMat);

    // Multi-tier Assault Hydration Backpack + Whip Antenna on Back
    const pack = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.28, 0.38, 0.13)), vestMat);
    pack.position.set(0, 0.29, -0.2);
    pack.castShadow = true;
    const packSub = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.23, 0.17, 0.08)), vestMat);
    packSub.position.set(0, 0.2, -0.27);
    const packStraps = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.29, 0.03, 0.16)), rubberMat);
    packStraps.position.set(0, 0.28, -0.21);
    const antCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 0.32, -0.22),
      new THREE.Vector3(-0.165, 0.54, -0.24),
      new THREE.Vector3(-0.145, 0.78, -0.27),
    ]);
    const radioAnt = new THREE.Mesh(this.trackGeo(new THREE.TubeGeometry(antCurve, 8, 0.006, 5, false)), gunMat);

    // Sculpted Deltoid Shoulder Pads + Flag Patch
    const padGeo = this.trackGeo(new THREE.SphereGeometry(0.105, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65));
    const padL = new THREE.Mesh(padGeo, bodyMat);
    padL.position.set(-0.27, 0.44, 0);
    padL.rotation.z = 0.75;
    const padR = new THREE.Mesh(padGeo, bodyMat);
    padR.position.set(0.27, 0.44, 0);
    padR.rotation.z = -0.75;

    // Balaclava / BDU Neck Collar
    const neck = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.072, 0.086, 0.12, 10)), rubberMat);
    neck.position.set(0, 0.56, 0);
    const collar = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.105, 0.125, 0.06, 12)), bodyMat);
    collar.position.set(0, 0.54, 0);

    upperBodyGroup.add(
      torso,
      vest,
      cummerbund,
      strapL,
      strapR,
      adminPouch,
      unitPatch,
      magPouchGroup,
      radioBox,
      ptt,
      commsWire,
      pack,
      packSub,
      packStraps,
      radioAnt,
      padL,
      padR,
      neck,
      collar
    );

    // 5. Realistic Head, Balaclava, Ballistic Goggles, High-Cut FAST Helmet, Headset & Dual NVGs
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.61, 0);
    upperBodyGroup.add(headGroup);

    // Contoured LatheGeometry Human Head (jawline -> cheekbones -> brow -> crown)
    const headGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0.0),
          new THREE.Vector2(0.068, 0.02),
          new THREE.Vector2(0.098, 0.06),
          new THREE.Vector2(0.118, 0.12),
          new THREE.Vector2(0.122, 0.175),
          new THREE.Vector2(0.112, 0.22),
          new THREE.Vector2(0.078, 0.255),
          new THREE.Vector2(0.001, 0.27),
        ],
        16
      )
    );
    headGeo.scale(0.92, 1.0, 1.06);
    const headMesh = new THREE.Mesh(headGeo, headBalaclavaMat);
    headMesh.position.set(0, -0.02, 0.01);
    headMesh.rotation.y = Math.PI; // Aligns texture u=0.5 eye-slit squarely toward +Z
    headMesh.castShadow = true;

    // High-Cut FAST Tactical Helmet Shell + Rear Counterweight + Side ARC Rails
    const helmetDome = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.148, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      helmetMat
    );
    helmetDome.scale.set(0.95, 1.02, 1.08);
    helmetDome.position.set(0, 0.115, -0.008);
    helmetDome.castShadow = true;

    const helmetRim = new THREE.Mesh(this.trackGeo(new THREE.TorusGeometry(0.143, 0.014, 6, 18)), rubberMat);
    helmetRim.rotation.x = Math.PI / 2;
    helmetRim.scale.set(0.94, 1.06, 1);
    helmetRim.position.set(0, 0.115, -0.008);

    const counterWeight = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.11, 0.065, 0.045)), vestMat);
    counterWeight.position.set(0, 0.125, -0.155);

    const arcRailL = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.018, 0.032, 0.12)), gunTanMat);
    arcRailL.position.set(-0.138, 0.145, 0.01);
    const arcRailR = arcRailL.clone();
    arcRailR.position.x = 0.138;

    // Helmet-mounted tactical strobe light on top-left
    const helmetLight = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.075, 8)), gunMat);
    helmetLight.rotation.x = Math.PI / 2;
    helmetLight.position.set(0.145, 0.16, 0.04);

    // Peltor Comms Ear-Pro Cups + Boom Microphone
    const earCupL = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.046, 0.05, 0.042, 10)), helmetMat);
    earCupL.rotation.z = Math.PI / 2;
    earCupL.position.set(-0.135, 0.085, -0.005);
    const earCupR = earCupL.clone();
    earCupR.position.set(0.135, 0.085, -0.005);

    const boomMicCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.135, 0.075, 0.01),
      new THREE.Vector3(-0.12, 0.04, 0.095),
      new THREE.Vector3(-0.045, 0.035, 0.138),
    ]);
    const boomMic = new THREE.Mesh(this.trackGeo(new THREE.TubeGeometry(boomMicCurve, 8, 0.006, 5, false)), rubberMat);

    // Tactical Ballistic Goggles Frame + Tinted Amber Lens
    const goggleFrame = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.205, 0.062, 0.055)), rubberMat);
    goggleFrame.position.set(0, 0.102, 0.118);
    const visor = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.188, 0.048, 0.058)), visorMat);
    visor.position.set(0, 0.102, 0.122);

    // CNC Shroud + Articulated Bridge + Dual-Tube PVS-31 Night Vision Goggles
    const nvgMount = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.055, 0.055, 0.035)), gunMat);
    nvgMount.position.set(0, 0.185, 0.148);
    const nvgArm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.085, 0.022, 0.055)), gunMat);
    nvgArm.position.set(0, 0.17, 0.175);

    const nvgTubeGeo = this.trackGeo(new THREE.CylinderGeometry(0.019, 0.021, 0.095, 10));
    const nvgLensGeo = this.trackGeo(new THREE.CylinderGeometry(0.017, 0.017, 0.008, 10));
    const nvgTubeL = new THREE.Mesh(nvgTubeGeo, gunMat);
    nvgTubeL.rotation.x = Math.PI / 2 - 0.28;
    nvgTubeL.position.set(-0.036, 0.155, 0.2);
    const nvgTubeR = nvgTubeL.clone();
    nvgTubeR.position.x = 0.036;

    const nvgLensL = new THREE.Mesh(nvgLensGeo, opticLensMat);
    nvgLensL.rotation.x = Math.PI / 2 - 0.28;
    nvgLensL.position.set(-0.036, 0.142, 0.244);
    const nvgLensR = nvgLensL.clone();
    nvgLensR.position.x = 0.036;

    headGroup.add(
      headMesh,
      helmetDome,
      helmetRim,
      counterWeight,
      arcRailL,
      arcRailR,
      helmetLight,
      earCupL,
      earCupR,
      boomMic,
      goggleFrame,
      visor,
      nvgMount,
      nvgArm,
      nvgTubeL,
      nvgTubeR,
      nvgLensL,
      nvgLensR
    );

    // 6. Anatomically Tapered Arms, Tactical Gloves & Detailed Carbine Rifle
    const weaponRigGroup = new THREE.Group();
    weaponRigGroup.position.set(0, 0.41, 0.07);
    upperBodyGroup.add(weaponRigGroup);

    const upperArmGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, -0.14),
          new THREE.Vector2(0.052, -0.13),
          new THREE.Vector2(0.064, -0.02),
          new THREE.Vector2(0.072, 0.09),
          new THREE.Vector2(0.065, 0.14),
          new THREE.Vector2(0.001, 0.14),
        ],
        10
      )
    );
    const forearmGeo = this.trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, -0.13),
          new THREE.Vector2(0.04, -0.12),
          new THREE.Vector2(0.052, -0.02),
          new THREE.Vector2(0.058, 0.09),
          new THREE.Vector2(0.05, 0.13),
          new THREE.Vector2(0.001, 0.13),
        ],
        10
      )
    );
    const gloveGeo = this.trackGeo(new THREE.BoxGeometry(0.072, 0.08, 0.088));

    const armR = new THREE.Mesh(upperArmGeo, bodyMat);
    armR.position.set(0.265, -0.05, 0.06);
    armR.rotation.set(0.95, 0, 0.24);
    armR.castShadow = true;

    const forearmR = new THREE.Mesh(forearmGeo, bodyMat);
    forearmR.position.set(0.19, -0.12, 0.23);
    forearmR.rotation.set(1.4, 0.15, 0);

    const gloveR = new THREE.Mesh(gloveGeo, gloveMat);
    gloveR.position.set(0.14, -0.12, 0.34);

    const armL = new THREE.Mesh(upperArmGeo, bodyMat);
    armL.position.set(-0.26, -0.06, 0.09);
    armL.rotation.set(0.92, 0, -0.44);
    armL.castShadow = true;

    const forearmL = new THREE.Mesh(forearmGeo, bodyMat);
    forearmL.position.set(-0.07, -0.12, 0.32);
    forearmL.rotation.set(1.36, -0.58, 0);

    const watch = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.046, 0.046, 0.024, 10)), rubberMat);
    watch.position.set(-0.005, -0.12, 0.4);
    watch.rotation.set(1.36, -0.58, 0);

    const gloveL = new THREE.Mesh(gloveGeo, gloveMat);
    gloveL.position.set(0.08, -0.115, 0.45);

    // Sculpted Tactical M4/MK18 Carbine
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.135, -0.095, 0.33);
    rifleGroup.rotation.y = -0.11;

    const receiver = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.058, 0.085, 0.28)), gunMat);
    const handguard = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.054, 0.068, 0.26)), gunTanMat);
    handguard.position.set(0, 0.01, 0.25);

    // Adjustable Crane Stock
    const stockShape = new THREE.Shape();
    stockShape.moveTo(0, -0.04);
    stockShape.lineTo(-0.22, -0.07);
    stockShape.lineTo(-0.22, 0.04);
    stockShape.lineTo(0, 0.04);
    stockShape.closePath();
    const stockGeo = this.trackGeo(new THREE.ExtrudeGeometry(stockShape, { depth: 0.042, bevelEnabled: false }));
    stockGeo.rotateY(-Math.PI / 2);
    stockGeo.translate(0.021, 0, -0.14);
    const stock = new THREE.Mesh(stockGeo, rubberMat);

    const pistolGrip = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.036, 0.11, 0.048)), rubberMat);
    pistolGrip.position.set(0, -0.068, -0.06);
    pistolGrip.rotation.x = 0.32;

    const vertGrip = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.018, 0.016, 0.095, 8)), rubberMat);
    vertGrip.position.set(0, -0.062, 0.24);

    const barrel = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.013, 0.016, 0.26, 8)), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.42);

    const suppressor = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.17, 10)), gunMat);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.015, 0.59);

    // Curved PMAG
    const mag = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.034, 0.155, 0.056)), gunTanMat);
    mag.position.set(0, -0.1, 0.055);
    mag.rotation.x = 0.24;

    // Holographic EOTech Optic + PEQ Laser Box + Tactical Light
    const optic = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.044, 0.048, 0.088)), gunMat);
    optic.position.set(0, 0.065, 0.02);
    const peqBox = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.048, 0.028, 0.075)), gunTanMat);
    peqBox.position.set(0, 0.056, 0.31);
    const tacLight = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.013, 0.013, 0.08, 8)), gunMat);
    tacLight.rotation.x = Math.PI / 2;
    tacLight.position.set(0.036, 0.012, 0.32);

    // Bot Muzzle Flash Star
    const botMuzzleFlash = new THREE.Group();
    botMuzzleFlash.position.set(0, 0.015, 0.69);
    const mf1 = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.24, 0.07)), flashMat);
    const mf2 = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.07, 0.24)), flashMat);
    botMuzzleFlash.add(mf1, mf2);
    botMuzzleFlash.visible = false;

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.015, 0.69);
    rifleGroup.add(
      receiver,
      handguard,
      stock,
      pistolGrip,
      vertGrip,
      barrel,
      suppressor,
      mag,
      optic,
      peqBox,
      tacLight,
      botMuzzleFlash,
      muzzlePoint
    );

    weaponRigGroup.add(armR, forearmR, gloveR, armL, forearmL, watch, gloveL, rifleGroup);

    // Hitbox Tagging
    const headParts = [
      headMesh,
      helmetDome,
      helmetRim,
      counterWeight,
      earCupL,
      earCupR,
      goggleFrame,
      visor,
      nvgMount,
      nvgArm,
      nvgTubeL,
      nvgTubeR,
    ];
    const bodyParts = [
      pelvisBlock,
      belt,
      torso,
      vest,
      cummerbund,
      pack,
      packSub,
      padL,
      padR,
      neck,
      collar,
      armR,
      forearmR,
      gloveR,
      armL,
      forearmL,
      gloveL,
      ...leftLegBuilt.parts,
      ...rightLegBuilt.parts,
    ];
    headParts.forEach((m) => {
      m.userData = { botId: id, hitZone: 'head' };
    });
    bodyParts.forEach((m) => {
      m.userData = { botId: id, hitZone: 'body' };
    });

    this.scene.add(group);

    return {
      id,
      name,
      group,
      pelvisGroup,
      upperBodyGroup,
      headGroup,
      weaponRigGroup,
      botMuzzleFlash,
      headMesh,
      leftHip: leftLegBuilt.hipGroup,
      leftKnee: leftLegBuilt.kneeGroup,
      rightHip: rightLegBuilt.hipGroup,
      rightKnee: rightLegBuilt.kneeGroup,
      muzzlePoint,
      hitMeshes: [...headParts, ...bodyParts],
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      health: 100,
      maxHealth: 100,
      alive: true,
      deathTimer: 0,
      deathDir: Math.random() < 0.5 ? -1 : 1,
      hitFlashTimer: 0,
      flinchTimer: 0,
      recoilTimer: 0,
      muzzleFlashTimer: 0,
      crouchBlend: 0,
      targetWaypoint: new THREE.Vector3(),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1.2 + Math.random(),
      fireCooldown: 0.8 + Math.random() * 0.8,
      burstRemaining: 0,
      walkPhase: Math.random() * Math.PI * 2,
      scanPhase: Math.random() * Math.PI * 2,
      awareOfPlayer: false,
      alertTimer: 0,
      bodyMat,
      vestMat,
      visorMat,
    };
  }

  public spawnWave(
    count: number,
    spawnPoints: THREE.Vector3[],
    waypoints: THREE.Vector3[],
    hpScale = 1,
    guardPoint?: THREE.Vector3
  ): void {
    this.clearAll();
    for (let i = 0; i < count; i++) {
      const sp = guardPoint
        ? spawnPoints[(i + 1) % spawnPoints.length]
        : spawnPoints[i % spawnPoints.length];
      const bot = this.createBotMesh(i + 1, BOT_CALLSIGNS[i % BOT_CALLSIGNS.length]);
      bot.position.copy(sp);
      bot.position.x += (Math.random() - 0.5) * 2.2;
      bot.position.z += (Math.random() - 0.5) * 2.2;
      bot.maxHealth = Math.round(100 * hpScale);
      bot.health = bot.maxHealth;
      bot.group.position.copy(bot.position);

      if (guardPoint && i < Math.ceil(count / 2)) {
        bot.targetWaypoint.copy(guardPoint).add(
          new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)
        );
      } else {
        bot.targetWaypoint.copy(waypoints[Math.floor(Math.random() * waypoints.length)]);
      }
      this.bots.push(bot);
    }
  }

  public getAllHitMeshes(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    for (const bot of this.bots) {
      if (bot.alive) {
        list.push(...bot.hitMeshes);
      }
    }
    return list;
  }

  public damageBot(botId: number, damage: number): { killed: boolean; bot: TacticalBot | null } {
    const bot = this.bots.find((b) => b.id === botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };

    bot.health = Math.max(0, bot.health - damage);
    bot.hitFlashTimer = 0.12;
    bot.flinchTimer = 0.22;
    bot.awareOfPlayer = true;
    bot.alertTimer = 8;

    if (bot.health <= 0) {
      bot.alive = false;
      bot.deathTimer = 0;
      bot.botMuzzleFlash.visible = false;
      bot.visorMat.emissiveIntensity = 0;
      return { killed: true, bot };
    }
    return { killed: false, bot };
  }

  public clearAll(): void {
    for (const bot of this.bots) {
      this.scene.remove(bot.group);
    }
    this.bots = [];
  }

  public dispose(): void {
    this.clearAll();
    this.sharedGeos.forEach((g) => g.dispose());
    this.sharedMats.forEach((m) => m.dispose());
    this.sharedTextures.forEach((t) => t.dispose());
    this.sharedGeos = [];
    this.sharedMats = [];
    this.sharedTextures = [];
  }
}

const _toPlayer = new THREE.Vector3();
const _eyeOrigin = new THREE.Vector3();
const _playerEye = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _muzzleWorld = new THREE.Vector3();

export function updateBots(
  dt: number,
  botManager: BotManager,
  playerPos: THREE.Vector3,
  playerEyeHeight: number,
  colliders: AABBCollider[],
  ramps: RampSurface[],
  worldRaycastTargets: THREE.Object3D[],
  waypoints: THREE.Vector3[],
  optionsOrScale: number | BotUpdateOptions,
  onBotFire: (muzzleWorldPos: THREE.Vector3, targetPos: THREE.Vector3, hitsPlayer: boolean, damage: number, angleToPlayer: number) => void
): void {
  const opts: Required<BotUpdateOptions> =
    typeof optionsOrScale === 'number'
      ? {
          difficultyFireScale: optionsOrScale,
          burstPauseScale: 1,
          minDamage: 9,
          maxDamage: 13,
          strafeSpeedScale: 1,
        }
      : {
          difficultyFireScale: optionsOrScale.difficultyFireScale,
          burstPauseScale: optionsOrScale.burstPauseScale ?? 1,
          minDamage: optionsOrScale.minDamage ?? 9,
          maxDamage: optionsOrScale.maxDamage ?? 13,
          strafeSpeedScale: optionsOrScale.strafeSpeedScale ?? 1,
        };

  _playerEye.set(playerPos.x, playerPos.y + playerEyeHeight - 0.15, playerPos.z);

  for (const bot of botManager.bots) {
    if (!bot.alive) {
      bot.deathTimer = Math.min(1, bot.deathTimer + dt * 3.8);
      const ease = 1 - Math.pow(1 - bot.deathTimer, 2);
      bot.group.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, ease);
      bot.group.rotation.z = THREE.MathUtils.lerp(0, bot.deathDir * 0.35, ease);
      bot.leftKnee.rotation.x = THREE.MathUtils.lerp(bot.leftKnee.rotation.x, 0.85, ease);
      bot.rightKnee.rotation.x = THREE.MathUtils.lerp(bot.rightKnee.rotation.x, 0.45, ease);
      bot.group.position.y = bot.position.y + THREE.MathUtils.lerp(0, 0.18, ease);
      if (bot.deathTimer >= 1 && bot.group.visible) {
        bot.group.visible = false;
      }
      continue;
    }

    // Hit flash & upper-body flinch recovery
    if (bot.hitFlashTimer > 0) {
      bot.hitFlashTimer -= dt;
      bot.bodyMat.emissive.setHex(0x991b1b);
      bot.bodyMat.emissiveIntensity = 0.75;
      bot.vestMat.emissive.setHex(0x7f1d1d);
      bot.vestMat.emissiveIntensity = 0.65;
    } else {
      bot.bodyMat.emissive.setHex(0x000000);
      bot.bodyMat.emissiveIntensity = 0;
      bot.vestMat.emissive.setHex(0x000000);
      bot.vestMat.emissiveIntensity = 0;
    }

    if (bot.muzzleFlashTimer > 0) {
      bot.muzzleFlashTimer -= dt;
      if (bot.muzzleFlashTimer <= 0) bot.botMuzzleFlash.visible = false;
    }

    _eyeOrigin.set(bot.position.x, bot.position.y + 1.55, bot.position.z);
    _toPlayer.subVectors(_playerEye, _eyeOrigin);
    const distToPlayer = _toPlayer.length();
    let hasLOS = false;

    if (distToPlayer < 48) {
      _toPlayer.normalize();
      _raycaster.set(_eyeOrigin, _toPlayer);
      _raycaster.far = distToPlayer;
      const hits = _raycaster.intersectObjects(worldRaycastTargets, false);
      hasLOS = hits.length === 0;
    }

    if (hasLOS) {
      bot.awareOfPlayer = true;
      bot.alertTimer = 6.0;
    } else if (bot.alertTimer > 0) {
      bot.alertTimer -= dt;
      if (bot.alertTimer <= 0) bot.awareOfPlayer = false;
    }

    let speed = 3.1 * opts.strafeSpeedScale;
    _moveDir.set(0, 0, 0);
    let strafeTilt = 0;

    if (hasLOS) {
      const targetYaw = Math.atan2(playerPos.x - bot.position.x, playerPos.z - bot.position.z);
      let diff = targetYaw - bot.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.group.rotation.y += diff * Math.min(1, dt * 11);

      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = (0.85 + Math.random() * 1.1) / Math.max(0.5, opts.strafeSpeedScale);
      }
      _rightVec.set(Math.cos(targetYaw), 0, -Math.sin(targetYaw));
      _moveDir.addScaledVector(_rightVec, bot.strafeDir * 0.88);
      strafeTilt = -bot.strafeDir * 0.075;

      if (distToPlayer > 18) {
        _moveDir.x += Math.sin(targetYaw) * 0.55;
        _moveDir.z += Math.cos(targetYaw) * 0.55;
      } else if (distToPlayer < 7.5) {
        _moveDir.x -= Math.sin(targetYaw) * 0.65;
        _moveDir.z -= Math.cos(targetYaw) * 0.65;
      }
      speed = 3.55 * opts.strafeSpeedScale;

      const dy = _playerEye.y - (bot.position.y + 1.35);
      const aimPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.max(1, distToPlayer)), -0.6, 0.6);
      bot.weaponRigGroup.rotation.x = THREE.MathUtils.damp(bot.weaponRigGroup.rotation.x, aimPitch, 10, dt);
      bot.headGroup.rotation.x = THREE.MathUtils.damp(bot.headGroup.rotation.x, aimPitch * 0.65, 10, dt);
      bot.headGroup.rotation.y = THREE.MathUtils.damp(bot.headGroup.rotation.y, 0, 10, dt);

      bot.fireCooldown -= dt;
      if (bot.fireCooldown <= 0) {
        if (bot.burstRemaining <= 0) {
          bot.burstRemaining = opts.difficultyFireScale < 0.5 ? 2 : 3;
        }
        bot.muzzlePoint.getWorldPosition(_muzzleWorld);

        bot.muzzleFlashTimer = 0.055;
        bot.botMuzzleFlash.visible = true;
        bot.botMuzzleFlash.rotation.z = Math.random() * Math.PI;
        bot.recoilTimer = 0.11;

        const hitChance = THREE.MathUtils.clamp(0.58 - distToPlayer * 0.011, 0.14, 0.56) * opts.difficultyFireScale;
        const hitsPlayer = Math.random() < hitChance;
        const aimOffset = hitsPlayer
          ? new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2)
          : new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.2);
        const shotTarget = _playerEye.clone().add(aimOffset);

        const dmg = opts.minDamage + Math.floor(Math.random() * Math.max(1, opts.maxDamage - opts.minDamage + 1));
        const angleFromPlayer = Math.atan2(bot.position.x - playerPos.x, bot.position.z - playerPos.z);
        onBotFire(_muzzleWorld.clone(), shotTarget, hitsPlayer, dmg, angleFromPlayer);

        bot.burstRemaining--;
        bot.fireCooldown =
          bot.burstRemaining > 0
            ? 0.18 * opts.burstPauseScale
            : (0.95 + Math.random() * 0.7) * opts.burstPauseScale;
      }
    } else {
      const target = bot.awareOfPlayer ? playerPos : bot.targetWaypoint;
      const dx = target.x - bot.position.x;
      const dz = target.z - bot.position.z;
      const distSq = dx * dx + dz * dz;

      if (!bot.awareOfPlayer && distSq < 2.2) {
        bot.targetWaypoint.copy(waypoints[Math.floor(Math.random() * waypoints.length)]);
      } else if (distSq > 0.2) {
        const len = Math.sqrt(distSq);
        _moveDir.set(dx / len, 0, dz / len);
        const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetYaw - bot.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.group.rotation.y += diff * Math.min(1, dt * 8);
      }

      bot.scanPhase += dt * 1.8;
      bot.headGroup.rotation.y = Math.sin(bot.scanPhase) * 0.38;
      bot.headGroup.rotation.x = THREE.MathUtils.damp(bot.headGroup.rotation.x, 0, 8, dt);
      bot.weaponRigGroup.rotation.x = THREE.MathUtils.damp(bot.weaponRigGroup.rotation.x, 0.16, 8, dt);
    }

    const wantCrouch = hasLOS && bot.burstRemaining > 0 ? 1 : 0;
    bot.crouchBlend = THREE.MathUtils.damp(bot.crouchBlend, wantCrouch, 8, dt);

    let isMoving = false;
    if (_moveDir.lengthSq() > 0.001) {
      isMoving = true;
      _moveDir.normalize();
      const stepX = _moveDir.x * speed * dt;
      const stepZ = _moveDir.z * speed * dt;
      const r = 0.45;

      const nextX = bot.position.x + stepX;
      if (!collidesHorizontal(nextX, bot.position.y, bot.position.z, r, 1.8, colliders)) {
        bot.position.x = nextX;
      } else {
        bot.strafeDir *= -1;
        if (!hasLOS) {
          bot.targetWaypoint.copy(waypoints[Math.floor(Math.random() * waypoints.length)]);
        }
      }

      const nextZ = bot.position.z + stepZ;
      if (!collidesHorizontal(bot.position.x, bot.position.y, nextZ, r, 1.8, colliders)) {
        bot.position.z = nextZ;
      } else {
        bot.strafeDir *= -1;
      }

      bot.walkPhase += dt * speed * 3.1;
    } else {
      bot.scanPhase += dt * 1.4;
    }

    // Multi-Joint Kinematics: Hip swing + Knee bend + Pelvis vertical bob & lean + Torso twist & breathing
    const swingAmp = isMoving ? 0.56 : 0;
    const lSwing = Math.sin(bot.walkPhase) * swingAmp;
    const rSwing = -Math.sin(bot.walkPhase) * swingAmp;
    const crouchHip = -bot.crouchBlend * 0.38;
    const crouchKnee = bot.crouchBlend * 0.72;

    bot.leftHip.rotation.x = THREE.MathUtils.damp(bot.leftHip.rotation.x, lSwing + crouchHip, 14, dt);
    bot.rightHip.rotation.x = THREE.MathUtils.damp(bot.rightHip.rotation.x, rSwing + crouchHip, 14, dt);

    const lKneeTarget = (isMoving ? Math.max(0, -Math.cos(bot.walkPhase)) * 0.78 : 0) + crouchKnee;
    const rKneeTarget = (isMoving ? Math.max(0, Math.cos(bot.walkPhase)) * 0.78 : 0) + crouchKnee;
    bot.leftKnee.rotation.x = THREE.MathUtils.damp(bot.leftKnee.rotation.x, lKneeTarget, 14, dt);
    bot.rightKnee.rotation.x = THREE.MathUtils.damp(bot.rightKnee.rotation.x, rKneeTarget, 14, dt);

    const walkBob = isMoving ? Math.abs(Math.sin(bot.walkPhase)) * 0.055 : Math.sin(bot.scanPhase * 1.5) * 0.014;
    bot.pelvisGroup.position.y = 0.86 - bot.crouchBlend * 0.16 + walkBob;
    bot.pelvisGroup.rotation.z = THREE.MathUtils.damp(bot.pelvisGroup.rotation.z, strafeTilt * 0.45, 10, dt);

    // Upper body combat lean, breathing sway, stride twist, recoil kick & hit flinch
    let torsoPitch = isMoving ? 0.14 : 0.03 + Math.sin(bot.scanPhase * 1.5) * 0.015;
    let torsoRoll = strafeTilt;
    if (bot.flinchTimer > 0) {
      bot.flinchTimer -= dt;
      torsoPitch -= 0.3;
      torsoRoll += bot.deathDir * 0.22;
    }
    if (bot.recoilTimer > 0) {
      bot.recoilTimer -= dt;
      bot.weaponRigGroup.position.z = 0.07 - 0.058;
      torsoPitch -= 0.065;
    } else {
      bot.weaponRigGroup.position.z = THREE.MathUtils.damp(bot.weaponRigGroup.position.z, 0.07, 16, dt);
    }

    bot.upperBodyGroup.rotation.x = THREE.MathUtils.damp(bot.upperBodyGroup.rotation.x, torsoPitch, 12, dt);
    bot.upperBodyGroup.rotation.z = THREE.MathUtils.damp(bot.upperBodyGroup.rotation.z, torsoRoll, 12, dt);
    bot.upperBodyGroup.rotation.y = isMoving
      ? Math.cos(bot.walkPhase) * 0.095
      : THREE.MathUtils.damp(bot.upperBodyGroup.rotation.y, 0, 10, dt);

    // Subtle weapon sway when scanning or moving
    bot.weaponRigGroup.rotation.z = isMoving ? Math.sin(bot.walkPhase) * 0.035 : Math.sin(bot.scanPhase) * 0.015;

    bot.position.y = sampleFloorHeight(bot.position.x, bot.position.y, bot.position.z, colliders, ramps);
    bot.group.position.copy(bot.position);
  }
}

export function collidesHorizontal(
  x: number,
  yFoot: number,
  z: number,
  radius: number,
  height: number,
  colliders: AABBCollider[]
): boolean {
  const yTop = yFoot + height;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (yTop <= c.minY + 0.05 || yFoot >= c.maxY - 0.32) continue;
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      return true;
    }
  }
  return false;
}

export function sampleFloorHeight(
  x: number,
  currentY: number,
  z: number,
  colliders: AABBCollider[],
  ramps: RampSurface[]
): number {
  let highest = 0;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      const coord = r.axis === 'z' ? z : x;
      const t = THREE.MathUtils.clamp((coord - r.startCoord) / (r.endCoord - r.startCoord), 0, 1);
      const y = THREE.MathUtils.lerp(r.startY, r.endY, t);
      if (y <= currentY + 0.8 && y > highest) {
        highest = y;
      }
    }
  }
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x >= c.minX - 0.25 && x <= c.maxX + 0.25 && z >= c.minZ - 0.25 && z <= c.maxZ + 0.25) {
      if (c.maxY <= currentY + 0.55 && c.maxY > highest) {
        highest = c.maxY;
      }
    }
  }
  return highest;
}
