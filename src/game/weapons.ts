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

function makeBeveledExtrude(
  pts: Array<[number, number]>,
  depth: number,
  bevel = 0.004
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
  });
  geo.center();
  return geo;
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

  // Physically calibrated PBR materials (>= 0.25 roughness spread between metal & grip/wood)
  const bluedSteel = trackMat(new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.28, metalness: 0.88 }));
  const anodizedRail = trackMat(new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.36, metalness: 0.82 }));
  const darkPolymer = trackMat(new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.8, metalness: 0.08 }));
  const walnutWood = trackMat(new THREE.MeshStandardMaterial({ color: 0x6f4120, roughness: 0.64, metalness: 0.04 }));
  const oliveChassis = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b4d37, roughness: 0.72, metalness: 0.1 }));
  const brushedBolt = trackMat(new THREE.MeshStandardMaterial({ color: 0xb0b7c2, roughness: 0.2, metalness: 0.92 }));
  const bakeliteMag = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c381c, roughness: 0.52, metalness: 0.12 }));
  const opticGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f766e,
      emissive: 0x0d9488,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.65,
      clearcoat: 1.0,
    })
  );
  const redDotMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
    })
  );
  const sleeveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x323930, roughness: 0.88, metalness: 0.03 }));
  const gloveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.76, metalness: 0.08 }));

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

  const addTacticalArms = (group: THREE.Group) => {
    // Sculpted forearm sleeve + elbow taper
    addPart(
      group,
      new THREE.CylinderGeometry(0.044, 0.052, 0.34, 10),
      sleeveMat,
      [-0.085, -0.14, 0.16],
      [1.34, 0.22, -0.12]
    );
    // Support gloved palm + wrapped fingers
    addPart(group, new THREE.CapsuleGeometry(0.034, 0.045, 4, 8), gloveMat, [-0.012, -0.055, -0.14], [1.4, 0, 0.25]);
    // Trigger hand glove
    addPart(group, new THREE.CapsuleGeometry(0.034, 0.042, 4, 8), gloveMat, [0.005, -0.068, 0.11], [1.15, 0, 0]);
  };

  // ============================================================================
  // 1. AK-47M Tactical (Sculpted Receiver, Curved Banana Mag, Lathe Barrel)
  // ============================================================================
  const ak47 = new THREE.Group();
  // Beveled stamped receiver profile (drawn in XY side-profile, extruded along X width then rotated)
  const akReceiverGeo = makeBeveledExtrude(
    [
      [-0.17, -0.03],
      [0.17, -0.03],
      [0.17, 0.03],
      [0.09, 0.044],
      [-0.15, 0.044],
      [-0.17, 0.025],
    ],
    0.044,
    0.005
  );
  addPart(ak47, akReceiverGeo, bluedSteel, [0, 0.005, 0], [0, Math.PI / 2, 0]);

  // Sculpted walnut stock (angled comb)
  const akStockGeo = makeBeveledExtrude(
    [
      [0.0, -0.02],
      [0.24, -0.07],
      [0.24, 0.015],
      [0.0, 0.025],
    ],
    0.038,
    0.005
  );
  addPart(ak47, akStockGeo, walnutWood, [0, -0.02, 0.26], [0, Math.PI / 2, 0]);

  // Ribbed walnut handguard
  const akHandguardGeo = makeBeveledExtrude(
    [
      [-0.1, -0.028],
      [0.1, -0.024],
      [0.1, 0.022],
      [-0.1, 0.028],
    ],
    0.048,
    0.006
  );
  addPart(ak47, akHandguardGeo, walnutWood, [0, -0.004, -0.25], [0, Math.PI / 2, 0]);

  // Curved Banana Magazine (extruded crescent profile!)
  const akMagShape = new THREE.Shape();
  akMagShape.moveTo(-0.028, 0);
  akMagShape.quadraticCurveTo(-0.04, -0.1, -0.075, -0.17);
  akMagShape.lineTo(-0.02, -0.185);
  akMagShape.quadraticCurveTo(0.015, -0.1, 0.026, 0);
  akMagShape.closePath();
  const akMagGeo = new THREE.ExtrudeGeometry(akMagShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  akMagGeo.center();
  addPart(ak47, akMagGeo, bakeliteMag, [0, -0.1, -0.08], [0, Math.PI / 2, 0]);

  // Pistol grip
  const akGripGeo = makeBeveledExtrude(
    [
      [-0.022, 0.03],
      [0.022, 0.03],
      [0.045, -0.075],
      [0.004, -0.08],
    ],
    0.032,
    0.004
  );
  addPart(ak47, akGripGeo, darkPolymer, [0, -0.065, 0.095], [0, Math.PI / 2, 0]);

  // LatheGeometry tapered barrel + gas block + slanted compensator
  const akBarrelPts = [
    new THREE.Vector2(0.016, 0),
    new THREE.Vector2(0.014, 0.18),
    new THREE.Vector2(0.011, 0.19),
    new THREE.Vector2(0.011, 0.36),
    new THREE.Vector2(0.015, 0.37),
    new THREE.Vector2(0.013, 0.41),
    new THREE.Vector2(0.008, 0.41),
  ];
  addPart(ak47, new THREE.LatheGeometry(akBarrelPts, 14), bluedSteel, [0, 0.014, -0.25], [-Math.PI / 2, 0, 0]);
  // Gas tube + front sight hood
  addPart(ak47, new THREE.CylinderGeometry(0.009, 0.01, 0.21, 10), bluedSteel, [0, 0.036, -0.27], [Math.PI / 2, 0, 0]);
  addPart(ak47, new THREE.TorusGeometry(0.011, 0.0025, 6, 12, Math.PI * 1.4), bluedSteel, [0, 0.038, -0.58], [0, 0, -Math.PI * 0.2]);
  // Charging handle
  addPart(ak47, new THREE.CylinderGeometry(0.006, 0.009, 0.04, 8), brushedBolt, [0.032, 0.016, -0.02], [0, 0, Math.PI / 2]);
  addTacticalArms(ak47);

  // ============================================================================
  // 2. M4-S Tactical Carbine (Sculpted Upper/Lower, Suppressor, Holo Sight)
  // ============================================================================
  const m4s = new THREE.Group();
  const m4RecGeo = makeBeveledExtrude(
    [
      [-0.15, -0.03],
      [0.15, -0.03],
      [0.15, 0.036],
      [-0.15, 0.036],
    ],
    0.044,
    0.005
  );
  addPart(m4s, m4RecGeo, anodizedRail, [0, 0.002, 0.01], [0, Math.PI / 2, 0]);

  // Slotted M-LOK handguard shroud
  const m4RailGeo = makeBeveledExtrude(
    [
      [-0.11, -0.024],
      [0.11, -0.024],
      [0.11, 0.024],
      [-0.11, 0.024],
    ],
    0.042,
    0.005
  );
  addPart(m4s, m4RailGeo, anodizedRail, [0, 0.012, -0.24], [0, Math.PI / 2, 0]);

  // LatheGeometry stepped tactical suppressor
  const suppPts = [
    new THREE.Vector2(0.016, 0),
    new THREE.Vector2(0.022, 0.015),
    new THREE.Vector2(0.022, 0.19),
    new THREE.Vector2(0.019, 0.21),
    new THREE.Vector2(0.009, 0.21),
  ];
  addPart(m4s, new THREE.LatheGeometry(suppPts, 16), darkPolymer, [0, 0.012, -0.35], [-Math.PI / 2, 0, 0]);

  // Collapsible crane stock
  const m4StockGeo = makeBeveledExtrude(
    [
      [-0.11, -0.04],
      [0.11, -0.01],
      [0.11, 0.024],
      [-0.11, 0.024],
    ],
    0.038,
    0.004
  );
  addPart(m4s, m4StockGeo, darkPolymer, [0, -0.008, 0.25], [0, Math.PI / 2, 0]);
  addPart(m4s, akGripGeo.clone(), darkPolymer, [0, -0.065, 0.09], [0, Math.PI / 2, 0]);

  // Curved STANAG magazine
  const m4MagGeo = makeBeveledExtrude(
    [
      [-0.026, 0],
      [0.026, 0],
      [0.015, -0.14],
      [-0.036, -0.135],
    ],
    0.028,
    0.003
  );
  addPart(m4s, m4MagGeo, anodizedRail, [0, -0.085, -0.055], [0, Math.PI / 2, 0]);

  // Holographic reflex sight housing + glowing red dot
  addPart(m4s, new THREE.BoxGeometry(0.038, 0.012, 0.082), anodizedRail, [0, 0.044, -0.02]);
  addPart(m4s, new THREE.BoxGeometry(0.006, 0.032, 0.055), anodizedRail, [-0.018, 0.064, -0.02]);
  addPart(m4s, new THREE.BoxGeometry(0.006, 0.032, 0.055), anodizedRail, [0.018, 0.064, -0.02]);
  addPart(m4s, new THREE.BoxGeometry(0.04, 0.006, 0.055), anodizedRail, [0, 0.08, -0.02]);
  addPart(m4s, new THREE.PlaneGeometry(0.03, 0.026), opticGlass, [0, 0.064, -0.02]);
  addPart(m4s, new THREE.CircleGeometry(0.0022, 8), redDotMat, [0, 0.064, -0.019]);
  addTacticalArms(m4s);

  // ============================================================================
  // 3. AWP-Lite Marksman (Thumbhole Chassis, Lathe Scope & Fluted Barrel)
  // ============================================================================
  const awp = new THREE.Group();
  // Thumbhole polymer chassis with cutout
  const awpShape = new THREE.Shape();
  awpShape.moveTo(-0.34, -0.025);
  awpShape.lineTo(0.18, -0.032);
  awpShape.lineTo(0.2, 0.028);
  awpShape.lineTo(-0.34, 0.028);
  awpShape.closePath();
  const thumbHole = new THREE.Path();
  thumbHole.moveTo(0.06, -0.016);
  thumbHole.lineTo(0.14, -0.016);
  thumbHole.lineTo(0.14, 0.014);
  thumbHole.lineTo(0.06, 0.014);
  thumbHole.closePath();
  awpShape.holes.push(thumbHole);
  const awpChassisGeo = new THREE.ExtrudeGeometry(awpShape, {
    depth: 0.046,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  awpChassisGeo.center();
  addPart(awp, awpChassisGeo, oliveChassis, [0, -0.01, 0.04], [0, Math.PI / 2, 0]);

  // Heavy precision receiver
  addPart(awp, new THREE.CylinderGeometry(0.021, 0.021, 0.24, 12), bluedSteel, [0, 0.028, -0.03], [Math.PI / 2, 0, 0]);

  // LatheGeometry fluted sniper barrel + multi-baffle muzzle brake
  const awpBarrelPts = [
    new THREE.Vector2(0.018, 0),
    new THREE.Vector2(0.014, 0.44),
    new THREE.Vector2(0.021, 0.45),
    new THREE.Vector2(0.021, 0.52),
    new THREE.Vector2(0.01, 0.52),
  ];
  addPart(awp, new THREE.LatheGeometry(awpBarrelPts, 14), bluedSteel, [0, 0.028, -0.16], [-Math.PI / 2, 0, 0]);

  // LatheGeometry sniper scope tube + objective bell + ocular ring
  const scopePts = [
    new THREE.Vector2(0.022, 0),
    new THREE.Vector2(0.022, 0.04),
    new THREE.Vector2(0.016, 0.06),
    new THREE.Vector2(0.016, 0.19),
    new THREE.Vector2(0.027, 0.23),
    new THREE.Vector2(0.027, 0.3),
    new THREE.Vector2(0.023, 0.3),
  ];
  addPart(awp, new THREE.LatheGeometry(scopePts, 16), anodizedRail, [0, 0.074, 0.06], [-Math.PI / 2, 0, 0]);
  addPart(awp, new THREE.CircleGeometry(0.02, 14), opticGlass, [0, 0.074, 0.061], [0, Math.PI, 0]);
  // Scope elevation turret + bolt handle
  addPart(awp, new THREE.CylinderGeometry(0.009, 0.009, 0.018, 10), anodizedRail, [0, 0.095, -0.06]);
  addPart(awp, new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8), brushedBolt, [0.028, 0.024, 0.03], [0, 0, -Math.PI / 3]);
  addPart(awp, new THREE.SphereGeometry(0.012, 10, 10), brushedBolt, [0.048, 0.015, 0.035]);
  // Box magazine
  addPart(awp, new THREE.BoxGeometry(0.034, 0.075, 0.072), darkPolymer, [0, -0.055, -0.06]);
  addTacticalArms(awp);

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
