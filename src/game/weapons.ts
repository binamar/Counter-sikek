import * as THREE from 'three';
import { WeaponId, WeaponSpec } from './types';

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47M Tactical',
    slot: 1,
    category: 'Assault Rifle',
    damage: 34,
    headshotMult: 2.6,
    fireRateMs: 105,
    magSize: 30,
    reserveMax: 120,
    reloadTimeMs: 1350,
    spreadBase: 0.004,
    spreadMove: 0.026,
    recoilPitch: 0.026,
    recoilYaw: 0.011,
    automatic: true,
    adsFov: 60,
    hasScopeOverlay: false,
    tracerColor: 0xffc857,
  },
  m4s: {
    id: 'm4s',
    name: 'M4-S Carbine',
    slot: 2,
    category: 'Suppressed Carbine',
    damage: 28,
    headshotMult: 2.4,
    fireRateMs: 85,
    magSize: 30,
    reserveMax: 120,
    reloadTimeMs: 1200,
    spreadBase: 0.0022,
    spreadMove: 0.016,
    recoilPitch: 0.016,
    recoilYaw: 0.007,
    automatic: true,
    adsFov: 56,
    hasScopeOverlay: false,
    tracerColor: 0xfef08a,
  },
  awp: {
    id: 'awp',
    name: 'AWP-Lite Marksman',
    slot: 3,
    category: 'Bolt Marksman',
    damage: 105,
    headshotMult: 2.2,
    fireRateMs: 820,
    magSize: 8,
    reserveMax: 32,
    reloadTimeMs: 1650,
    spreadBase: 0.0005,
    spreadMove: 0.042,
    recoilPitch: 0.055,
    recoilYaw: 0.014,
    automatic: false,
    adsFov: 30,
    hasScopeOverlay: true,
    tracerColor: 0xfde047,
  },
};

export interface WeaponViewModelRig {
  root: THREE.Group;
  models: Record<WeaponId, THREE.Group>;
  muzzleFlash: THREE.Group;
  muzzleLight: THREE.PointLight;
  dispose: () => void;
}

export function createWeaponViewModelRig(): WeaponViewModelRig {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Distinct PBR materials with >= 0.25 roughness contrast
  const gunmetal = trackMat(new THREE.MeshStandardMaterial({ color: 0x262a32, roughness: 0.32, metalness: 0.85 }));
  const darkPolymer = trackMat(new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.78, metalness: 0.12 }));
  const walnutWood = trackMat(new THREE.MeshStandardMaterial({ color: 0x6f4324, roughness: 0.68, metalness: 0.05 }));
  const olivePolymer = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b4d38, roughness: 0.74, metalness: 0.1 }));
  const brushedBolt = trackMat(new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.24, metalness: 0.9 }));
  const opticLens = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0f766e,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.8,
    })
  );
  const sleeveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2f3530, roughness: 0.85, metalness: 0.05 }));
  const gloveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.72, metalness: 0.1 }));

  const addPart = (
    group: THREE.Group,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0]
  ) => {
    const mesh = new THREE.Mesh(trackGeo(geo), mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  const addForearmAndGlove = (group: THREE.Group) => {
    // Support forearm + gloved hand
    addPart(group, new THREE.BoxGeometry(0.085, 0.085, 0.34), sleeveMat, [-0.08, -0.14, 0.16], [0.22, -0.25, 0.1]);
    addPart(group, new THREE.BoxGeometry(0.068, 0.062, 0.09), gloveMat, [-0.015, -0.06, -0.12], [0, 0, 0.12]);
    // Trigger hand
    addPart(group, new THREE.BoxGeometry(0.065, 0.07, 0.085), gloveMat, [0.005, -0.07, 0.12], [-0.2, 0, 0]);
  };

  // --- 1. AK-47M Tactical (9 parts + arms) ---
  const ak47 = new THREE.Group();
  addPart(ak47, new THREE.BoxGeometry(0.052, 0.075, 0.34), gunmetal, [0, 0, 0]); // Receiver
  addPart(ak47, new THREE.BoxGeometry(0.058, 0.065, 0.18), walnutWood, [0, -0.004, -0.25]); // Handguard
  addPart(ak47, new THREE.BoxGeometry(0.044, 0.085, 0.22), walnutWood, [0, -0.03, 0.25], [-0.14, 0, 0]); // Stock
  addPart(ak47, new THREE.BoxGeometry(0.038, 0.11, 0.052), darkPolymer, [0, -0.08, 0.09], [0.28, 0, 0]); // Pistol grip
  addPart(ak47, new THREE.BoxGeometry(0.036, 0.17, 0.068), darkPolymer, [0, -0.1, -0.07], [-0.26, 0, 0]); // Curved mag
  addPart(ak47, new THREE.CylinderGeometry(0.012, 0.014, 0.36, 10), gunmetal, [0, 0.012, -0.46], [Math.PI / 2, 0, 0]); // Barrel
  addPart(ak47, new THREE.CylinderGeometry(0.01, 0.01, 0.2, 10), gunmetal, [0, 0.035, -0.27], [Math.PI / 2, 0, 0]); // Gas tube
  addPart(ak47, new THREE.BoxGeometry(0.014, 0.032, 0.018), gunmetal, [0, 0.035, -0.58]); // Front sight post
  addPart(ak47, new THREE.BoxGeometry(0.022, 0.016, 0.05), brushedBolt, [0.03, 0.015, -0.02]); // Bolt carrier
  addForearmAndGlove(ak47);

  // --- 2. M4-S Tactical Carbine (9 parts + arms) ---
  const m4s = new THREE.Group();
  addPart(m4s, new THREE.BoxGeometry(0.052, 0.072, 0.3), darkPolymer, [0, 0, 0.01]); // Upper/lower receiver
  addPart(m4s, new THREE.BoxGeometry(0.046, 0.052, 0.22), gunmetal, [0, 0.01, -0.24]); // Quad rail
  addPart(m4s, new THREE.CylinderGeometry(0.022, 0.022, 0.22, 12), darkPolymer, [0, 0.01, -0.45], [Math.PI / 2, 0, 0]); // Suppressor
  addPart(m4s, new THREE.BoxGeometry(0.044, 0.075, 0.22), darkPolymer, [0, -0.01, 0.25]); // Collapsible stock
  addPart(m4s, new THREE.BoxGeometry(0.036, 0.1, 0.048), darkPolymer, [0, -0.075, 0.09], [0.26, 0, 0]); // Grip
  addPart(m4s, new THREE.BoxGeometry(0.034, 0.15, 0.062), gunmetal, [0, -0.09, -0.06], [-0.1, 0, 0]); // Straight STANAG mag
  addPart(m4s, new THREE.BoxGeometry(0.034, 0.038, 0.085), gunmetal, [0, 0.06, -0.02]); // Red-dot optic housing
  addPart(m4s, new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12), opticLens, [0, 0.06, 0.024], [Math.PI / 2, 0, 0]); // Optic glass
  addPart(m4s, new THREE.BoxGeometry(0.026, 0.014, 0.26), gunmetal, [0, 0.038, -0.06]); // Top Picatinny rail
  addForearmAndGlove(m4s);

  // --- 3. AWP-Lite Marksman (10 parts + arms) ---
  const awp = new THREE.Group();
  addPart(awp, new THREE.BoxGeometry(0.056, 0.072, 0.44), olivePolymer, [0, -0.008, -0.04]); // Chassis
  addPart(awp, new THREE.BoxGeometry(0.048, 0.088, 0.24), olivePolymer, [0, -0.02, 0.26]); // Thumbhole stock
  addPart(awp, new THREE.BoxGeometry(0.042, 0.042, 0.22), gunmetal, [0, 0.028, -0.02]); // Heavy receiver
  addPart(awp, new THREE.CylinderGeometry(0.013, 0.016, 0.5, 12), gunmetal, [0, 0.028, -0.45], [Math.PI / 2, 0, 0]); // Fluted barrel
  addPart(awp, new THREE.BoxGeometry(0.032, 0.032, 0.055), darkPolymer, [0, 0.028, -0.7], [0, 0, Math.PI / 4]); // Muzzle brake
  addPart(awp, new THREE.CylinderGeometry(0.022, 0.018, 0.28, 14), darkPolymer, [0, 0.075, -0.08], [Math.PI / 2, 0, 0]); // Scope body
  addPart(awp, new THREE.CylinderGeometry(0.028, 0.022, 0.07, 14), darkPolymer, [0, 0.075, -0.23], [Math.PI / 2, 0, 0]); // Objective bell
  addPart(awp, new THREE.CylinderGeometry(0.022, 0.022, 0.01, 14), opticLens, [0, 0.075, 0.06], [Math.PI / 2, 0, 0]); // Scope ocular lens
  addPart(awp, new THREE.BoxGeometry(0.038, 0.085, 0.075), darkPolymer, [0, -0.065, -0.08]); // Box mag
  addPart(awp, new THREE.SphereGeometry(0.014, 10, 10), brushedBolt, [0.045, 0.022, 0.04]); // Bolt handle knob
  addForearmAndGlove(awp);

  // Muzzle flash star + point light
  const muzzleFlash = new THREE.Group();
  const flashMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
  );
  const f1 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.18, 0.045)), flashMat);
  const f2 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.045, 0.18)), flashMat);
  const f3 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.14, 0.04)), flashMat);
  f3.rotation.z = Math.PI / 4;
  muzzleFlash.add(f1, f2, f3);
  muzzleFlash.position.set(0, 0.02, -0.68);
  muzzleFlash.visible = false;

  const muzzleLight = new THREE.PointLight(0xffb703, 0, 7, 2);
  muzzleLight.position.set(0, 0.05, -0.65);

  ak47.visible = true;
  m4s.visible = false;
  awp.visible = false;

  root.add(ak47, m4s, awp, muzzleFlash, muzzleLight);
  root.position.set(0.24, -0.22, -0.44);

  return {
    root,
    models: { ak47, m4s, awp },
    muzzleFlash,
    muzzleLight,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
