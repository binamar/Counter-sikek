import * as THREE from 'three';
import { TacticalMaterials } from './textures';
import { AABBCollider, BombSiteInfo, PickupItem, RampSurface } from './types';

export interface EnvLightFixture {
  position: THREE.Vector3;
  color: number;
  baseIntensity: number;
  distance: number;
  kind: 'warehouse' | 'sconce' | 'beacon';
  bulbMat: THREE.MeshStandardMaterial;
}

export interface BuiltCompoundMap {
  worldGroup: THREE.Group;
  colliders: AABBCollider[];
  ramps: RampSurface[];
  raycastTargets: THREE.Object3D[];
  waypoints: THREE.Vector3[];
  botSpawnPoints: THREE.Vector3[];
  playerSpawn: THREE.Vector3;
  bombSites: Record<'A' | 'B', BombSiteInfo>;
  pickups: PickupItem[];
  envLightFixtures: EnvLightFixture[];
  minimapWalls: Array<{ x: number; z: number; w: number; d: number }>;
  dispose: () => void;
}

export function buildCompoundMap(mats: TacticalMaterials): BuiltCompoundMap {
  const worldGroup = new THREE.Group();
  const colliders: AABBCollider[] = [];
  const ramps: RampSurface[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const minimapWalls: Array<{ x: number; z: number; w: number; d: number }> = [];
  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    extraMaterials.push(m);
    return m;
  };

  // --- 0. Procedural Desert Sky Dome (Clouds + Sun Halo, unaffected by fog) ---
  const skyDomeMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: mats.skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(225, 32, 20)), skyDomeMat);
  worldGroup.add(skyDome);

  // --- 1. Extended Desert Basin & Playable Courtyard Floor ---
  const outerDesert = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(340, 340)), mats.desertTerrain);
  outerDesert.rotation.x = -Math.PI / 2;
  outerDesert.position.y = -0.04;
  outerDesert.receiveShadow = true;
  worldGroup.add(outerDesert);
  raycastTargets.push(outerDesert);

  const courtyardFloor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(92, 92)), mats.sandGround);
  courtyardFloor.rotation.x = -Math.PI / 2;
  courtyardFloor.position.y = 0;
  courtyardFloor.receiveShadow = true;
  worldGroup.add(courtyardFloor);
  raycastTargets.push(courtyardFloor);

  // Warehouse A concrete slab
  const warehouseSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.05, 40)), mats.concreteFloor);
  warehouseSlab.position.set(-28, 0.025, -4);
  warehouseSlab.receiveShadow = true;
  worldGroup.add(warehouseSlab);
  raycastTargets.push(warehouseSlab);

  // Helipad B circular pad
  const helipadMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(9.5, 9.8, 0.06, 28)), mats.helipadFloor);
  helipadMesh.position.set(28, 0.03, -4);
  helipadMesh.receiveShadow = true;
  worldGroup.add(helipadMesh);
  raycastTargets.push(helipadMesh);

  // --- Helper: Ground Contact Shadow Plane ---
  const addContactShadow = (x: number, yBase: number, z: number, w: number, d: number) => {
    if (yBase > 0.1) return;
    const disc = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(w, d)), mats.contactShadowMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, yBase + 0.015, z);
    worldGroup.add(disc);
  };

  // --- Helper: Solid Wall / Box with AABB Collider ---
  const addSolidBox = (
    x: number,
    yCenter: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    options?: { castShadow?: boolean; minimap?: boolean; tag?: string; parent?: THREE.Group }
  ) => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, yCenter, z);
    mesh.castShadow = options?.castShadow ?? true;
    mesh.receiveShadow = true;
    (options?.parent ?? worldGroup).add(mesh);
    raycastTargets.push(mesh);

    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: yCenter - h / 2,
      maxY: yCenter + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag: options?.tag,
    });

    if (options?.minimap !== false && h >= 1.2) {
      minimapWalls.push({ x, z, w, d });
    }
    return mesh;
  };

  // --- Helper: Sculpted Beveled Sandstone Archway (Dust2 style!) ---
  const addSandstoneArchway = (x: number, z: number, spanW: number, archH: number, thickness: number) => {
    const halfW = spanW / 2;
    const innerR = halfW - 1.25;
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(-innerR, 0);
    shape.lineTo(-innerR, archH - innerR);
    shape.absarc(0, archH - innerR, innerR, Math.PI, 0, true);
    shape.lineTo(innerR, 0);
    shape.lineTo(halfW, 0);
    shape.lineTo(halfW, archH + 0.8);
    shape.lineTo(-halfW, archH + 0.8);
    shape.closePath();

    const geo = trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.08,
        bevelSegments: 2,
      })
    );
    geo.translate(0, 0, -thickness / 2);
    const archMesh = new THREE.Mesh(geo, mats.sandstoneArch);
    archMesh.position.set(x, 0, z);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    worldGroup.add(archMesh);
    raycastTargets.push(archMesh);

    // Side pillar colliders + overhead lintel collider (so player walks freely through the arch!)
    addSolidBox(x - (halfW - 0.65), archH / 2, z, 1.3, archH, thickness, mats.sandstoneWall, {
      castShadow: false,
      minimap: true,
    });
    addSolidBox(x + (halfW - 0.65), archH / 2, z, 1.3, archH, thickness, mats.sandstoneWall, {
      castShadow: false,
      minimap: true,
    });
    colliders.push({
      minX: x - halfW,
      maxX: x + halfW,
      minY: archH - 0.3,
      maxY: archH + 0.9,
      minZ: z - thickness / 2,
      maxZ: z + thickness / 2,
      tag: 'arch-lintel',
    });
  };

  // --- Helper: Sculpted Sandbag Barricade (Stacked Capsule Rows) ---
  const addSandbagWall = (x: number, z: number, rotY = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    const bagGeo = trackGeo(new THREE.CapsuleGeometry(0.18, 0.56, 4, 8));
    bagGeo.rotateZ(Math.PI / 2);

    for (let row = 0; row < 3; row++) {
      const cols = row === 2 ? 3 : 4;
      const startX = -((cols - 1) * 0.72) / 2;
      for (let col = 0; col < cols; col++) {
        const bag = new THREE.Mesh(bagGeo, mats.sandbagMat);
        bag.position.set(
          startX + col * 0.72 + (row % 2) * 0.14,
          0.16 + row * 0.27,
          (Math.random() - 0.5) * 0.05
        );
        bag.scale.set(1, 0.78, 1.15);
        bag.castShadow = true;
        bag.receiveShadow = true;
        group.add(bag);
        raycastTargets.push(bag);
      }
    }
    worldGroup.add(group);
    addContactShadow(x, 0, z, rotY === 0 ? 3.5 : 1.3, rotY === 0 ? 1.3 : 3.5);
    const w = rotY === 0 ? 3.0 : 0.75;
    const d = rotY === 0 ? 0.75 : 3.0;
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: 0.98,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag: 'sandbags',
    });
  };

  // --- Helper: Composite 7-Part Corrugated Shipping Container ---
  const addShippingContainer = (x: number, yBase: number, z: number, rotY: number, isOlive: boolean) => {
    const w = rotY === 0 ? 3.2 : 7.4;
    const d = rotY === 0 ? 7.4 : 3.2;
    const h = 3.0;
    const mat = isOlive ? mats.containerOlive : mats.containerRust;
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    group.rotation.y = rotY;

    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, h, 7.4)), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    raycastTargets.push(body);

    // Top, bottom & corner casting steel frame
    const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.3, 0.16, 7.5)), mats.darkSteel);
    topRail.position.y = h - 0.06;
    topRail.castShadow = true;
    const baseRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.3, 0.16, 7.5)), mats.darkSteel);
    baseRail.position.y = 0.08;
    group.add(topRail, baseRail);

    [-1.56, 1.56].forEach((cx) => {
      [-3.65, 3.65].forEach((cz) => {
        const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, h, 0.18)), mats.darkSteel);
        post.position.set(cx, h / 2, cz);
        group.add(post);
      });
    });

    [-0.5, 0.5].forEach((bx) => {
      const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, h - 0.3, 8)), mats.darkSteel);
      bar.position.set(bx, h / 2, 3.74);
      group.add(bar);
    });

    const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.28, 0.22, 0.25)), mats.hazardTrim);
    trim.position.set(0, 0.28, 3.64);
    group.add(trim);

    worldGroup.add(group);
    addContactShadow(x, yBase, z, w + 1.0, d + 1.0);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: yBase,
      maxY: yBase + h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag: 'container',
    });
    minimapWalls.push({ x, z, w, d });
  };

  // --- Helper: Composite 5-Part Wooden Tactical Crate ---
  const addTacticalCrate = (x: number, yBase: number, z: number, size = 1.65) => {
    const group = new THREE.Group();
    group.position.set(x, yBase, z);

    const core = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size, size, size)), mats.woodCrate);
    core.position.y = size / 2;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);
    raycastTargets.push(core);

    const capTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.06, 0.1, size + 0.06)), mats.darkSteel);
    capTop.position.y = size - 0.04;
    const capBot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.06, 0.1, size + 0.06)), mats.darkSteel);
    capBot.position.y = 0.05;
    const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.03, 0.13, size + 0.03)), mats.hazardTrim);
    band.position.y = size * 0.5;
    group.add(capTop, capBot, band);

    worldGroup.add(group);
    addContactShadow(x, yBase, z, size + 0.65, size + 0.65);
    colliders.push({
      minX: x - size / 2,
      maxX: x + size / 2,
      minY: yBase,
      maxY: yBase + size,
      minZ: z - size / 2,
      maxZ: z + size / 2,
      tag: 'crate',
    });
    if (size >= 1.4) minimapWalls.push({ x, z, w: size, d: size });
  };

  // --- Helper: Sculpted LatheGeometry Industrial Fuel Drum ---
  const addFuelBarrel = (x: number, yBase: number, z: number, rust = true) => {
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    const mat = rust ? mats.containerRust : mats.containerOlive;

    // Rolled rib Lathe profile
    const drumPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.45, 0),
      new THREE.Vector2(0.46, 0.04),
      new THREE.Vector2(0.44, 0.08),
      new THREE.Vector2(0.44, 0.42),
      new THREE.Vector2(0.47, 0.45),
      new THREE.Vector2(0.44, 0.48),
      new THREE.Vector2(0.44, 0.8),
      new THREE.Vector2(0.47, 0.83),
      new THREE.Vector2(0.44, 0.86),
      new THREE.Vector2(0.44, 1.2),
      new THREE.Vector2(0.46, 1.24),
      new THREE.Vector2(0.43, 1.25),
      new THREE.Vector2(0, 1.25),
    ];
    const body = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(drumPts, 16)), mat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    raycastTargets.push(body);

    const hazard = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.452, 0.452, 0.16, 16)), mats.hazardTrim);
    hazard.position.y = 0.64;
    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8)), mats.darkSteel);
    cap.position.set(0.18, 1.26, 0.1);
    group.add(hazard, cap);

    worldGroup.add(group);
    addContactShadow(x, yBase, z, 1.3, 1.3);
    colliders.push({
      minX: x - 0.48,
      maxX: x + 0.48,
      minY: yBase,
      maxY: yBase + 1.28,
      minZ: z - 0.48,
      maxZ: z + 0.48,
      tag: 'barrel',
    });
  };

  // --- Helper: Walkable Ramp Mesh + RampSurface ---
  const addRamp = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    axis: 'x' | 'z',
    startCoord: number,
    endCoord: number,
    startY: number,
    endY: number
  ) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const dy = endY - startY;
    const horiz = Math.abs(endCoord - startCoord);
    const length = Math.hypot(horiz, dy);
    const angle = Math.atan2(dy, horiz);

    const mesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(axis === 'x' ? length : w, 0.28, axis === 'z' ? length : d)),
      mats.concreteFloor
    );
    mesh.position.set((minX + maxX) / 2, (startY + endY) / 2 - 0.12, (minZ + maxZ) / 2);

    if (axis === 'z') {
      mesh.rotation.x = endCoord > startCoord ? -angle : angle;
    } else {
      mesh.rotation.z = endCoord > startCoord ? angle : -angle;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
    raycastTargets.push(mesh);

    ramps.push({ minX, maxX, minZ, maxZ, axis, startCoord, endCoord, startY, endY });
  };

  // --- 2. Compound Perimeter Walls + Battlement Coping ---
  addSolidBox(0, 3.2, -45, 92, 6.4, 2, mats.sandstoneWall);
  addSolidBox(0, 3.2, 45, 92, 6.4, 2, mats.sandstoneWall);
  addSolidBox(-45, 3.2, 0, 2, 6.4, 92, mats.sandstoneWall);
  addSolidBox(45, 3.2, 0, 2, 6.4, 92, mats.sandstoneWall);

  // Sandstone battlements / parapet caps along perimeter skyline
  for (let i = -38; i <= 38; i += 8) {
    addSolidBox(i, 6.7, -45, 3.5, 0.7, 2.3, mats.concreteWall, { minimap: false });
    addSolidBox(i, 6.7, 45, 3.5, 0.7, 2.3, mats.concreteWall, { minimap: false });
    addSolidBox(-45, 6.7, i, 2.3, 0.7, 3.5, mats.concreteWall, { minimap: false });
    addSolidBox(45, 6.7, i, 2.3, 0.7, 3.5, mats.concreteWall, { minimap: false });
  }

  // --- 3. South Spawn Courtyard + Sandstone Archways + Sandbag Bunkers ---
  addSolidBox(-28, 2.5, 25, 16, 5.0, 2.2, mats.sandstoneWall);
  addSolidBox(-28, 0.22, 25, 16.2, 0.44, 2.5, mats.concreteWall, { minimap: false });
  addSolidBox(28, 2.5, 25, 16, 5.0, 2.2, mats.sandstoneWall);
  addSolidBox(28, 0.22, 25, 16.2, 0.44, 2.5, mats.concreteWall, { minimap: false });
  addSandstoneArchway(-13, 25, 9, 4.4, 2.2);
  addSandstoneArchway(13, 25, 9, 4.4, 2.2);

  addSandbagWall(-5.2, 31.5, 0);
  addSandbagWall(5.2, 31.5, 0);
  addTacticalCrate(-12, 0, 34, 1.7);
  addTacticalCrate(12, 0, 34, 1.7);

  // --- 4. Mid Courtyard & Elevated Overpass Catwalk ---
  addSolidBox(-14, 2.5, 12, 2.2, 5.0, 14, mats.sandstoneWall);
  addSolidBox(-14, 0.22, 12, 2.5, 0.44, 14.2, mats.concreteWall, { minimap: false });
  addSolidBox(-14, 2.5, -14, 2.2, 5.0, 16, mats.sandstoneWall);
  addSolidBox(-14, 0.22, -14, 2.5, 0.44, 16.2, mats.concreteWall, { minimap: false });
  addSolidBox(14, 2.5, 12, 2.2, 5.0, 14, mats.sandstoneWall);
  addSolidBox(14, 0.22, 12, 2.5, 0.44, 14.2, mats.concreteWall, { minimap: false });
  addSolidBox(14, 2.5, -14, 2.2, 5.0, 16, mats.sandstoneWall);
  addSolidBox(14, 0.22, -14, 2.5, 0.44, 16.2, mats.concreteWall, { minimap: false });

  // Slanted corrugated metal awnings over Mid walls (cast sharp angled shadows!)
  const addAwning = (x: number, y: number, z: number, w: number, d: number, tiltZ: number) => {
    const awning = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 0.12, d)), mats.containerRust);
    awning.position.set(x, y, z);
    awning.rotation.z = tiltZ;
    awning.castShadow = true;
    awning.receiveShadow = true;
    worldGroup.add(awning);
  };
  addAwning(-11.8, 4.1, 12, 2.8, 9.5, -0.26);
  addAwning(11.8, 4.1, -14, 2.8, 9.5, 0.26);

  // Elevated Concrete Catwalk Bridge in Mid
  addSolidBox(0, 2.45, 0, 7.6, 0.3, 16, mats.concreteWall, { minimap: false, tag: 'catwalk' });
  [-3.2, 3.2].forEach((px) => {
    [-6.8, 6.8].forEach((pz) => {
      addSolidBox(px, 1.2, pz, 0.9, 2.4, 0.9, mats.darkSteel);
    });
  });
  addSolidBox(-3.6, 3.05, 0, 0.3, 0.95, 15.6, mats.concreteWall, { minimap: false });
  addSolidBox(3.6, 3.05, 0, 0.3, 0.95, 15.6, mats.concreteWall, { minimap: false });
  addRamp(-3.5, 3.5, 8, 17, 'z', 17, 8, 0, 2.6);
  addRamp(-3.5, 3.5, -17, -8, 'z', -17, -8, 0, 2.6);

  // Mid Shipping Containers + Sandbags
  addShippingContainer(-8.8, 0, 3, 0, true);
  addShippingContainer(8.8, 0, -4, 0, false);
  addSandbagWall(-8.5, 11.5, 0);
  addSandbagWall(8.5, -12.5, 0);

  // --- 5. Site A: West Industrial Warehouse ---
  addSolidBox(-29, 6.2, -16, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  addSolidBox(-29, 6.2, -4, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  addSolidBox(-29, 6.2, 8, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  // Rooftop HVAC & industrial cross-purlins
  addSolidBox(-29, 6.65, -4, 2.4, 0.65, 22, mats.concreteWall, { minimap: false });
  addSolidBox(-23, 6.9, -16, 2.2, 1.1, 1.8, mats.darkSteel, { minimap: false });
  [-39, -19].forEach((cx) => {
    [-16, -4, 8].forEach((cz) => {
      addSolidBox(cx, 3.0, cz, 0.85, 6.0, 0.85, mats.darkSteel);
    });
  });
  addTacticalCrate(-25, 0, -10, 1.8);
  addTacticalCrate(-25, 1.8, -10, 1.5);
  addTacticalCrate(-26.9, 0, -10, 1.8);
  addTacticalCrate(-33, 0, 1, 1.8);
  addTacticalCrate(-22, 0, 4, 1.7);
  addFuelBarrel(-35, 0, -12, true);
  addFuelBarrel(-34, 0, -13, false);
  addFuelBarrel(-21, 0, -13, true);

  // --- 6. Site B: East Helipad & Watchtower ---
  addSolidBox(38, 2.65, 12, 8.0, 0.3, 8.0, mats.concreteWall, { minimap: false });
  [34.5, 41.5].forEach((tx) => {
    [8.5, 15.5].forEach((tz) => {
      addSolidBox(tx, 1.3, tz, 0.75, 2.6, 0.75, mats.darkSteel);
    });
  });
  addSolidBox(34.2, 3.3, 12, 0.35, 1.0, 7.6, mats.concreteWall, { minimap: false });
  addSolidBox(38, 3.3, 8.2, 7.6, 1.0, 0.35, mats.concreteWall, { minimap: false });
  // Watchtower Steel Canopy & Comms Mast
  [34.5, 41.5].forEach((tx) => {
    [8.5, 15.5].forEach((tz) => {
      addSolidBox(tx, 4.1, tz, 0.28, 2.7, 0.28, mats.darkSteel, { minimap: false });
    });
  });
  addSolidBox(38, 5.5, 12, 8.2, 0.22, 8.2, mats.containerOlive, { minimap: false });
  const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 3.2, 8)), mats.darkSteel);
  mast.position.set(40.5, 7.1, 14.5);
  const dish = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.65, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42)), mats.concreteWall);
  dish.position.set(40.5, 8.1, 14.1);
  dish.rotation.x = -0.9;
  worldGroup.add(mast, dish);

  addRamp(35.5, 40.5, 16, 24, 'z', 24, 16, 0, 2.8);

  // Overhead Power Poles & Catenary Cables spanning across Compound
  const addCableSpan = (p1: THREE.Vector3, p2: THREE.Vector3, sag: number) => {
    const mid = p1.clone().lerp(p2, 0.5);
    mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
    const cable = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 16, 0.032, 5, false)), mats.darkSteel);
    worldGroup.add(cable);
  };
  addSolidBox(-14, 6.2, 18, 0.35, 2.6, 0.35, mats.darkSteel, { minimap: false });
  addSolidBox(14, 6.2, 18, 0.35, 2.6, 0.35, mats.darkSteel, { minimap: false });
  addSolidBox(14, 6.2, -18, 0.35, 2.6, 0.35, mats.darkSteel, { minimap: false });
  addCableSpan(new THREE.Vector3(-19, 6.4, 8), new THREE.Vector3(-14, 7.3, 18), 0.7);
  addCableSpan(new THREE.Vector3(-14, 7.3, 18), new THREE.Vector3(14, 7.3, 18), 1.45);
  addCableSpan(new THREE.Vector3(14, 7.3, 18), new THREE.Vector3(34.5, 5.5, 15.5), 1.1);
  addCableSpan(new THREE.Vector3(14, 7.3, -18), new THREE.Vector3(-19, 6.4, -16), 1.6);

  addShippingContainer(28, 0, -17, Math.PI / 2, true);
  addTacticalCrate(21, 0, -1, 1.75);
  addTacticalCrate(21, 0, 1.0, 1.75);
  addTacticalCrate(35, 0, -6, 1.8);
  addFuelBarrel(22, 0, -12, false);
  addFuelBarrel(23.1, 0, -12, true);

  // --- 7. North Underpass / Sniper Alley + Sandstone Arches ---
  addSolidBox(-28, 2.6, -27, 14, 5.2, 2.2, mats.sandstoneWall);
  addSolidBox(28, 2.6, -27, 14, 5.2, 2.2, mats.sandstoneWall);
  addSandstoneArchway(-13, -27, 9, 4.4, 2.2);
  addSandstoneArchway(13, -27, 9, 4.4, 2.2);

  addSolidBox(0, 2.0, -33, 12, 4.0, 2.2, mats.concreteWall);
  addTacticalCrate(-12, 0, -35, 1.7);
  addTacticalCrate(12, 0, -35, 1.7);
  addFuelBarrel(-5, 0, -30, true);
  addFuelBarrel(5, 0, -30, false);

  // --- 8. Outer Natural Desert Mesa Cliffs & Scrub Palms (InstancedMesh) ---
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(1, 0));
  const rockCount = 56;
  const rockInst = new THREE.InstancedMesh(rockGeo, mats.mesaRock, rockCount);
  const dummy = new THREE.Object3D();
  const colorTint = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const dist = 58 + Math.random() * 44;
    const sx = 5 + Math.random() * 12;
    const sy = 4 + Math.random() * 14;
    const sz = 5 + Math.random() * 12;
    dummy.position.set(Math.cos(angle) * dist, sy * 0.35 - 0.2, Math.sin(angle) * dist);
    dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    colorTint.setHSL(0.08, 0.34, 0.44 + (Math.random() - 0.5) * 0.14);
    rockInst.setColorAt(i, colorTint);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  rockInst.receiveShadow = true;
  worldGroup.add(rockInst);

  // Desert scrub bushes outside perimeter walls
  const bushGeo = trackGeo(new THREE.IcosahedronGeometry(1.1, 0));
  const bushCount = 34;
  const bushInst = new THREE.InstancedMesh(bushGeo, mats.foliageMat, bushCount);
  for (let i = 0; i < bushCount; i++) {
    const angle = (i / bushCount) * Math.PI * 2 + 0.15;
    const dist = 50 + Math.random() * 16;
    const s = 0.75 + Math.random() * 0.9;
    dummy.position.set(Math.cos(angle) * dist, s * 0.55 - 0.05, Math.sin(angle) * dist);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(s * 1.2, s * 0.75, s * 1.2);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    colorTint.setHSL(0.24 + (Math.random() - 0.5) * 0.05, 0.32, 0.32 + (Math.random() - 0.5) * 0.08);
    bushInst.setColorAt(i, colorTint);
  }
  bushInst.instanceMatrix.needsUpdate = true;
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  bushInst.computeBoundingSphere();
  worldGroup.add(bushInst);

  // --- 9. Bomb Sites A & B (Sculpted C4 Charge Case + Coiled Wire + Zone Ring) ---
  const createBombSite = (id: 'A' | 'B', label: string, x: number, y: number, z: number): BombSiteInfo => {
    const ringMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const ringMesh = new THREE.Mesh(trackGeo(new THREE.RingGeometry(2.4, 2.75, 36)), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, y + 0.06, z);
    worldGroup.add(ringMesh);

    const chargeGroup = new THREE.Group();
    chargeGroup.position.set(x, y + 0.04, z);
    const caseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.5, metalness: 0.45 }));
    const ledMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.9 })
    );
    const wireMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5, metalness: 0.2 }));

    const pack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.58, 0.2, 0.4)), caseMat);
    pack.position.y = 0.1;
    const screen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.03, 0.14)), ledMat);
    screen.position.set(0.08, 0.21, 0);
    const antenna = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.018, 0.42, 8)), mats.darkSteel);
    antenna.position.set(-0.2, 0.28, -0.1);
    const beacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 10, 10)), ledMat);
    beacon.position.set(-0.2, 0.5, -0.1);

    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, 0.2, 0.1),
      new THREE.Vector3(-0.02, 0.27, 0.04),
      new THREE.Vector3(0.1, 0.22, -0.08),
    ]);
    const wire = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(wireCurve, 12, 0.012, 6, false)), wireMat);

    chargeGroup.add(pack, screen, antenna, beacon, wire);
    chargeGroup.visible = false;
    worldGroup.add(chargeGroup);

    return {
      id,
      label,
      position: new THREE.Vector3(x, y, z),
      radius: 3.4,
      ringMesh,
      chargeGroup,
    };
  };

  const bombSites: Record<'A' | 'B', BombSiteInfo> = {
    A: createBombSite('A', 'Site A · Warehouse', -28, 0.05, -6),
    B: createBombSite('B', 'Site B · Helipad', 28, 0.06, -4),
  };

  // --- 10. Tactical Medkit & Ammo Pickups ---
  const createPickup = (id: string, type: 'medkit' | 'ammo', x: number, y: number, z: number): PickupItem => {
    const group = new THREE.Group();
    group.position.set(x, y + 0.45, z);
    const baseColor = type === 'medkit' ? 0x10b981 : 0xf59e0b;
    const boxMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.38,
        metalness: 0.3,
        emissive: baseColor,
        emissiveIntensity: 0.22,
      })
    );
    const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 }));

    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.38, 0.44)), boxMat);
    body.castShadow = true;
    const crossH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.08, 0.46)), trimMat);
    const crossV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.24, 0.46)), trimMat);
    group.add(body, crossH, crossV);
    worldGroup.add(group);

    return {
      id,
      type,
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      active: true,
      respawnTimer: 0,
    };
  };

  const pickups: PickupItem[] = [
    createPickup('med-mid', 'medkit', 0, 2.6, 0),
    createPickup('med-north', 'medkit', 0, 0, -26),
    createPickup('ammo-a', 'ammo', -36, 0, 12),
    createPickup('ammo-b', 'ammo', 38, 2.8, 12),
  ];

  // --- 11. Tactical Waypoints & Bot Spawns ---
  const waypoints = [
    new THREE.Vector3(0, 0, 19),
    new THREE.Vector3(-9, 0, 14),
    new THREE.Vector3(9, 0, 14),
    new THREE.Vector3(0, 2.6, 0),
    new THREE.Vector3(-9, 0, -14),
    new THREE.Vector3(9, 0, -14),
    new THREE.Vector3(-28, 0, -6),
    new THREE.Vector3(-28, 0, 12),
    new THREE.Vector3(-28, 0, -22),
    new THREE.Vector3(28, 0, -4),
    new THREE.Vector3(28, 0, 14),
    new THREE.Vector3(28, 0, -22),
    new THREE.Vector3(0, 0, -38),
    new THREE.Vector3(-18, 0, -35),
    new THREE.Vector3(18, 0, -35),
  ];

  const botSpawnPoints = [
    new THREE.Vector3(-28, 0, -14),
    new THREE.Vector3(28, 0, -10),
    new THREE.Vector3(0, 2.6, -2),
    new THREE.Vector3(-18, 0, -36),
    new THREE.Vector3(18, 0, -36),
    new THREE.Vector3(-34, 0, 6),
    new THREE.Vector3(34, 0, 5),
    new THREE.Vector3(0, 0, -24),
  ];

  // --- 12. Sculpted Environmental Light Fixtures (Floodlights, Sconces, Helipad Beacons) ---
  const envLightFixtures: EnvLightFixture[] = [];

  const addHangingLamp = (x: number, y: number, z: number, color: number, intensity: number, distance: number) => {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, y, z);

    const cord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6)), mats.darkSteel);
    cord.position.y = 0.42;
    const shade = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.45, 0.34, 12, 1, true)), mats.darkSteel);
    shade.position.y = -0.05;
    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      })
    );
    const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 10, 8)), bulbMat);
    bulb.position.y = -0.15;
    lampGroup.add(cord, shade, bulb);
    worldGroup.add(lampGroup);

    envLightFixtures.push({
      position: new THREE.Vector3(x, y - 0.35, z),
      color,
      baseIntensity: intensity,
      distance,
      kind: 'warehouse',
      bulbMat,
    });
  };

  const addWallSconce = (x: number, y: number, z: number, color: number, intensity: number) => {
    const sconce = new THREE.Group();
    sconce.position.set(x, y, z);
    const housing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.42, 0.2)), mats.darkSteel);
    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      })
    );
    const glass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.26, 0.22)), bulbMat);
    sconce.add(housing, glass);
    worldGroup.add(sconce);

    envLightFixtures.push({
      position: new THREE.Vector3(x, y - 0.2, z),
      color,
      baseIntensity: intensity,
      distance: 18,
      kind: 'sconce',
      bulbMat,
    });
  };

  const addHelipadBeacon = (x: number, z: number) => {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.55, 8)), mats.darkSteel);
    post.position.set(x, 0.275, z);
    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.0,
        roughness: 0.15,
      })
    );
    const dome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 8)), bulbMat);
    dome.position.set(x, 0.58, z);
    worldGroup.add(post, dome);

    envLightFixtures.push({
      position: new THREE.Vector3(x, 0.72, z),
      color: 0xffa726,
      baseIntensity: 5.0,
      distance: 14,
      kind: 'beacon',
      bulbMat,
    });
  };

  // Warehouse A warm industrial sodium lamps + Watchtower lamp
  addHangingLamp(-28, 5.4, -4, 0xffd28a, 14, 24);
  addHangingLamp(38, 5.1, 12, 0xffe4b5, 11, 20);
  // North Underpass shadowed bunker sconce
  addWallSconce(0, 3.3, -31.8, 0xffaa44, 10);
  // Helipad B perimeter amber beacon
  addHelipadBeacon(19.5, -4);

  return {
    worldGroup,
    colliders,
    ramps,
    raycastTargets,
    waypoints,
    botSpawnPoints,
    playerSpawn: new THREE.Vector3(0, 0, 38),
    bombSites,
    pickups,
    envLightFixtures,
    minimapWalls,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
