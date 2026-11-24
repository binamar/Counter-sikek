import * as THREE from 'three';
import { TacticalMaterials } from './textures';
import { AABBCollider, BombSiteInfo, PickupItem, RampSurface } from './types';

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

  // --- 1. Extended Desert Basin & Playable Courtyard Floor (zero floating void) ---
  const outerDesert = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(320, 320)), mats.desertTerrain);
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

  // Warehouse A concrete slab (offset +0.025 to prevent Z-fighting)
  const warehouseSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.05, 40)), mats.concreteFloor);
  warehouseSlab.position.set(-28, 0.025, -4);
  warehouseSlab.receiveShadow = true;
  worldGroup.add(warehouseSlab);
  raycastTargets.push(warehouseSlab);

  // Helipad B circular pad (offset +0.03)
  const helipadMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(9.5, 9.8, 0.06, 28)), mats.helipadFloor);
  helipadMesh.position.set(28, 0.03, -4);
  helipadMesh.receiveShadow = true;
  worldGroup.add(helipadMesh);
  raycastTargets.push(helipadMesh);

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

  // --- Helper: Composite 6-Part Shipping Container ---
  const addShippingContainer = (x: number, yBase: number, z: number, rotY: number, isOlive: boolean) => {
    const w = rotY === 0 ? 3.2 : 7.4;
    const d = rotY === 0 ? 7.4 : 3.2;
    const h = 3.0;
    const mat = isOlive ? mats.containerOlive : mats.containerRust;
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    group.rotation.y = rotY;

    // 1. Primary hull
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, h, 7.4)), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    raycastTargets.push(body);

    // 2. Top & bottom dark steel frame rails
    const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.28, 0.14, 7.48)), mats.darkSteel);
    topRail.position.y = h - 0.05;
    topRail.castShadow = true;
    group.add(topRail);

    const baseRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.28, 0.14, 7.48)), mats.darkSteel);
    baseRail.position.y = 0.07;
    group.add(baseRail);

    // 3. End door locking bars (2 parts)
    [-0.5, 0.5].forEach((bx) => {
      const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, h - 0.3, 8)), mats.darkSteel);
      bar.position.set(bx, h / 2, 3.74);
      group.add(bar);
    });

    // 4. Hazard bumper corner accents
    const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.26, 0.22, 0.25)), mats.hazardTrim);
    trim.position.set(0, 0.28, 3.64);
    group.add(trim);

    worldGroup.add(group);
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

    // Steel corner brackets
    const capTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.06, 0.1, size + 0.06)), mats.darkSteel);
    capTop.position.y = size - 0.04;
    const capBot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.06, 0.1, size + 0.06)), mats.darkSteel);
    capBot.position.y = 0.05;
    // Stencil hazard band
    const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(size + 0.03, 0.14, size + 0.03)), mats.hazardTrim);
    band.position.y = size * 0.5;
    group.add(capTop, capBot, band);

    worldGroup.add(group);
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

  // --- Helper: Composite 5-Part Fuel Drum / Industrial Barrel ---
  const addFuelBarrel = (x: number, yBase: number, z: number, rust = true) => {
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    const mat = rust ? mats.containerRust : mats.containerOlive;

    const body = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 1.25, 14)), mat);
    body.position.y = 0.625;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    raycastTargets.push(body);

    const rimTop = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.45, 0.035, 8, 16)), mats.darkSteel);
    rimTop.rotation.x = Math.PI / 2;
    rimTop.position.y = 1.24;
    const rimMid = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.46, 0.025, 8, 16)), mats.darkSteel);
    rimMid.rotation.x = Math.PI / 2;
    rimMid.position.y = 0.62;
    const hazard = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.458, 0.458, 0.18, 14)), mats.hazardTrim);
    hazard.position.y = 0.92;
    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8)), mats.darkSteel);
    cap.position.set(0.18, 1.26, 0.1);
    group.add(rimTop, rimMid, hazard, cap);

    worldGroup.add(group);
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
    const horiz = axis === 'z' ? Math.abs(endCoord - startCoord) : Math.abs(endCoord - startCoord);
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

  // --- 2. Compound Perimeter Walls (with tactical arches & battlements) ---
  // North wall
  addSolidBox(0, 3.2, -45, 92, 6.4, 2, mats.sandstoneWall);
  // South wall (Player spawn rear)
  addSolidBox(0, 3.2, 45, 92, 6.4, 2, mats.sandstoneWall);
  // West wall
  addSolidBox(-45, 3.2, 0, 2, 6.4, 92, mats.sandstoneWall);
  // East wall
  addSolidBox(45, 3.2, 0, 2, 6.4, 92, mats.sandstoneWall);

  // --- 3. South Spawn Courtyard Divider Walls (with 3 tactical exits: West, Mid, East) ---
  addSolidBox(-26, 2.5, 25, 18, 5.0, 2.2, mats.sandstoneWall);
  addSolidBox(26, 2.5, 25, 18, 5.0, 2.2, mats.sandstoneWall);
  // Central spawn Jersey barriers
  addSolidBox(-5, 0.7, 32, 4.2, 1.4, 0.9, mats.concreteWall);
  addSolidBox(5, 0.7, 32, 4.2, 1.4, 0.9, mats.concreteWall);
  addTacticalCrate(-12, 0, 34, 1.7);
  addTacticalCrate(12, 0, 34, 1.7);

  // --- 4. Mid Courtyard & Elevated Overpass Catwalk ---
  // West & East Mid Lane Divider Walls (separating A-Warehouse & B-Helipad from Mid)
  addSolidBox(-14, 2.5, 12, 2.2, 5.0, 14, mats.sandstoneWall);
  addSolidBox(-14, 2.5, -14, 2.2, 5.0, 16, mats.sandstoneWall);
  addSolidBox(14, 2.5, 12, 2.2, 5.0, 14, mats.sandstoneWall);
  addSolidBox(14, 2.5, -14, 2.2, 5.0, 16, mats.sandstoneWall);

  // Elevated Concrete Catwalk Bridge in Mid (x: -4..4, z: -8..8, y = 2.6)
  addSolidBox(0, 2.45, 0, 7.6, 0.3, 16, mats.concreteWall, { minimap: false, tag: 'catwalk' });
  // Support pillars beneath catwalk
  [-3.2, 3.2].forEach((px) => {
    [-6.8, 6.8].forEach((pz) => {
      addSolidBox(px, 1.2, pz, 0.9, 2.4, 0.9, mats.darkSteel);
    });
  });
  // Guard waist-high parapets along sides of catwalk
  addSolidBox(-3.6, 3.05, 0, 0.3, 0.95, 15.6, mats.concreteWall, { minimap: false });
  addSolidBox(3.6, 3.05, 0, 0.3, 0.95, 15.6, mats.concreteWall, { minimap: false });
  // Walkable ramps up to Catwalk (South & North)
  addRamp(-3.5, 3.5, 8, 17, 'z', 17, 8, 0, 2.6);
  addRamp(-3.5, 3.5, -17, -8, 'z', -17, -8, 0, 2.6);

  // Mid Shipping Containers (providing rich flanking cover)
  addShippingContainer(-8.8, 0, 3, 0, true);
  addShippingContainer(8.8, 0, -4, 0, false);

  // --- 5. Site A: West Industrial Warehouse (x: -44..-15, z: -24..18) ---
  // Warehouse overhead steel roof trusses & partial open-bay roof (dramatic shadow stripes!)
  addSolidBox(-29, 6.2, -16, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  addSolidBox(-29, 6.2, -4, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  addSolidBox(-29, 6.2, 8, 24, 0.45, 2.0, mats.darkSteel, { minimap: false });
  // Vertical I-beam columns
  [-39, -19].forEach((cx) => {
    [-16, -4, 8].forEach((cz) => {
      addSolidBox(cx, 3.0, cz, 0.85, 6.0, 0.85, mats.darkSteel);
    });
  });
  // Warehouse tactical crates & fuel barrels (A-site cover)
  addTacticalCrate(-25, 0, -10, 1.8);
  addTacticalCrate(-25, 1.8, -10, 1.5);
  addTacticalCrate(-26.9, 0, -10, 1.8);
  addTacticalCrate(-33, 0, 1, 1.8);
  addTacticalCrate(-22, 0, 4, 1.7);
  addFuelBarrel(-35, 0, -12, true);
  addFuelBarrel(-34, 0, -13, false);
  addFuelBarrel(-21, 0, -13, true);

  // --- 6. Site B: East Helipad & Watchtower (x: 15..44, z: -24..18) ---
  // Watchtower Deck (x: 34..42, z: 8..16, y = 2.8)
  addSolidBox(38, 2.65, 12, 8.0, 0.3, 8.0, mats.concreteWall, { minimap: false });
  [34.5, 41.5].forEach((tx) => {
    [8.5, 15.5].forEach((tz) => {
      addSolidBox(tx, 1.3, tz, 0.75, 2.6, 0.75, mats.darkSteel);
    });
  });
  // Watchtower chest-high cover walls
  addSolidBox(34.2, 3.3, 12, 0.35, 1.0, 7.6, mats.concreteWall, { minimap: false });
  addSolidBox(38, 3.3, 8.2, 7.6, 1.0, 0.35, mats.concreteWall, { minimap: false });
  // Ramp up to Watchtower from South
  addRamp(35.5, 40.5, 16, 24, 'z', 24, 16, 0, 2.8);

  // Helipad cover crates & containers
  addShippingContainer(28, 0, -17, Math.PI / 2, true);
  addTacticalCrate(21, 0, -1, 1.75);
  addTacticalCrate(21, 0, 1.0, 1.75);
  addTacticalCrate(35, 0, -6, 1.8);
  addFuelBarrel(22, 0, -12, false);
  addFuelBarrel(23.1, 0, -12, true);

  // --- 7. North Underpass / Sniper Alley (z: -43..-24) ---
  addSolidBox(-26, 2.6, -27, 16, 5.2, 2.2, mats.sandstoneWall);
  addSolidBox(26, 2.6, -27, 16, 5.2, 2.2, mats.sandstoneWall);
  // Central North bunker wall + crates
  addSolidBox(0, 2.0, -33, 12, 4.0, 2.2, mats.concreteWall);
  addTacticalCrate(-12, 0, -35, 1.7);
  addTacticalCrate(12, 0, -35, 1.7);
  addFuelBarrel(-5, 0, -30, true);
  addFuelBarrel(5, 0, -30, false);

  // --- 8. Natural Outer Desert Mesa Cliffs & Rock Outcrops (InstancedMesh) ---
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(1, 0));
  const rockCount = 56;
  const rockInst = new THREE.InstancedMesh(rockGeo, mats.mesaRock, rockCount);
  const dummy = new THREE.Object3D();
  const colorTint = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const dist = 56 + Math.random() * 44;
    const sx = 5 + Math.random() * 11;
    const sy = 4 + Math.random() * 14;
    const sz = 5 + Math.random() * 11;
    dummy.position.set(Math.cos(angle) * dist, sy * 0.35 - 0.2, Math.sin(angle) * dist);
    dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    colorTint.setHSL(0.08, 0.32, 0.44 + (Math.random() - 0.5) * 0.12);
    rockInst.setColorAt(i, colorTint);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  rockInst.receiveShadow = true;
  worldGroup.add(rockInst);

  // --- 9. Bomb Sites A & B (Composite C4 Charge Prop + Zone Ring) ---
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

    // Composite 4-part tactical charge case sitting on ground/crate
    const chargeGroup = new THREE.Group();
    chargeGroup.position.set(x, y + 0.04, z);
    const caseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.55, metalness: 0.4 }));
    const ledMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 })
    );
    const pack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.18, 0.38)), caseMat);
    pack.position.y = 0.09;
    const screen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.03, 0.14)), ledMat);
    screen.position.set(0.08, 0.19, 0);
    const antenna = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8)), mats.darkSteel);
    antenna.position.set(-0.2, 0.25, -0.1);
    const beacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 10, 10)), ledMat);
    beacon.position.set(-0.2, 0.43, -0.1);
    chargeGroup.add(pack, screen, antenna, beacon);
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
        roughness: 0.4,
        metalness: 0.25,
        emissive: baseColor,
        emissiveIntensity: 0.2,
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
    new THREE.Vector3(0, 2.6, 0), // Catwalk center
    new THREE.Vector3(-9, 0, -14),
    new THREE.Vector3(9, 0, -14),
    new THREE.Vector3(-28, 0, -6), // Site A
    new THREE.Vector3(-28, 0, 12),
    new THREE.Vector3(-28, 0, -22),
    new THREE.Vector3(28, 0, -4), // Site B
    new THREE.Vector3(28, 0, 14),
    new THREE.Vector3(28, 0, -22),
    new THREE.Vector3(0, 0, -38), // North Alley
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
    minimapWalls,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
