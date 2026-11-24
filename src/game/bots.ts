import * as THREE from 'three';
import { AABBCollider, RampSurface } from './types';

export interface TacticalBot {
  id: number;
  name: string;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
  hitMeshes: THREE.Object3D[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  alive: boolean;
  deathTimer: number;
  hitFlashTimer: number;
  targetWaypoint: THREE.Vector3;
  strafeDir: number;
  strafeTimer: number;
  fireCooldown: number;
  burstRemaining: number;
  walkPhase: number;
  awareOfPlayer: boolean;
  alertTimer: number;
  bodyMat: THREE.MeshStandardMaterial;
  visorMat: THREE.MeshStandardMaterial;
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

export class BotManager {
  public bots: TacticalBot[] = [];
  private sharedGeos: THREE.BufferGeometry[] = [];
  private sharedMats: THREE.Material[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.sharedGeos.push(g);
    return g;
  }

  private createBotMesh(id: number, name: string): TacticalBot {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.72, metalness: 0.18 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.78, metalness: 0.1 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.35, metalness: 0.8 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.5,
    });
    this.sharedMats.push(bodyMat, armorMat, gunMat, visorMat);

    // Grounded at y = 0 (legs 0..0.75, torso 0.75..1.42, head 1.44..1.80)
    const legGeo = this.trackGeo(new THREE.BoxGeometry(0.22, 0.74, 0.24));
    const leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.15, 0.37, 0);
    leftLeg.castShadow = true;

    const rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.15, 0.37, 0);
    rightLeg.castShadow = true;

    // Armored Torso
    const torso = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.56, 0.68, 0.32)), armorMat);
    torso.position.set(0, 1.09, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;

    // Tactical chest rig plate
    const rig = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.48, 0.42, 0.36)), bodyMat);
    rig.position.set(0, 1.12, 0.01);

    // Shoulder pads (left & right)
    const padGeo = this.trackGeo(new THREE.BoxGeometry(0.18, 0.22, 0.26));
    const leftPad = new THREE.Mesh(padGeo, armorMat);
    leftPad.position.set(-0.36, 1.31, 0);
    const rightPad = new THREE.Mesh(padGeo, armorMat);
    rightPad.position.set(0.36, 1.31, 0);

    // Helmeted Head (distinct hitbox for 2.5x headshots!)
    const headMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.32, 0.32, 0.34)), bodyMat);
    headMesh.position.set(0, 1.62, 0);
    headMesh.castShadow = true;

    // Glowing Visor slit
    const visor = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.26, 0.08, 0.04)), visorMat);
    visor.position.set(0, 1.63, 0.175);

    // Held Rifle (receiver + barrel)
    const rifleBody = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.07, 0.11, 0.65)), gunMat);
    rifleBody.position.set(0.24, 1.12, 0.36);
    rifleBody.castShadow = true;

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0.24, 1.14, 0.72);

    group.add(leftLeg, rightLeg, torso, rig, leftPad, rightPad, headMesh, visor, rifleBody, muzzlePoint);

    // Tag meshes for fast raycast hit detection
    const hitMeshes = [headMesh, visor, torso, rig, leftLeg, rightLeg, leftPad, rightPad];
    headMesh.userData = { botId: id, hitZone: 'head' };
    visor.userData = { botId: id, hitZone: 'head' };
    [torso, rig, leftLeg, rightLeg, leftPad, rightPad].forEach((m) => {
      m.userData = { botId: id, hitZone: 'body' };
    });

    this.scene.add(group);

    return {
      id,
      name,
      group,
      headMesh,
      leftLeg,
      rightLeg,
      muzzlePoint,
      hitMeshes,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      health: 100,
      maxHealth: 100,
      alive: true,
      deathTimer: 0,
      hitFlashTimer: 0,
      targetWaypoint: new THREE.Vector3(),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1.2 + Math.random(),
      fireCooldown: 0.8 + Math.random() * 0.8,
      burstRemaining: 0,
      walkPhase: Math.random() * Math.PI * 2,
      awareOfPlayer: false,
      alertTimer: 0,
      bodyMat,
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
    bot.awareOfPlayer = true;
    bot.alertTimer = 8;

    if (bot.health <= 0) {
      bot.alive = false;
      bot.deathTimer = 0;
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
    this.sharedGeos = [];
    this.sharedMats = [];
  }
}

// Reusable scratch vectors (zero GC in loop)
const _toPlayer = new THREE.Vector3();
const _eyeOrigin = new THREE.Vector3();
const _playerEye = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export function updateBots(
  dt: number,
  botManager: BotManager,
  playerPos: THREE.Vector3,
  playerEyeHeight: number,
  colliders: AABBCollider[],
  ramps: RampSurface[],
  worldRaycastTargets: THREE.Object3D[],
  waypoints: THREE.Vector3[],
  difficultyFireScale: number,
  onBotFire: (muzzleWorldPos: THREE.Vector3, targetPos: THREE.Vector3, hitsPlayer: boolean, damage: number, angleToPlayer: number) => void
): void {
  _playerEye.set(playerPos.x, playerPos.y + playerEyeHeight - 0.15, playerPos.z);

  for (const bot of botManager.bots) {
    if (!bot.alive) {
      // Quick fall-over knockdown animation
      bot.deathTimer = Math.min(1, bot.deathTimer + dt * 4.5);
      bot.group.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, bot.deathTimer);
      bot.group.position.y = bot.position.y + THREE.MathUtils.lerp(0, 0.22, bot.deathTimer);
      if (bot.deathTimer >= 1 && bot.group.visible) {
        bot.group.visible = false;
      }
      continue;
    }

    // Hit flash recovery
    if (bot.hitFlashTimer > 0) {
      bot.hitFlashTimer -= dt;
      bot.bodyMat.emissive.setHex(0x991b1b);
      bot.bodyMat.emissiveIntensity = 0.8;
    } else {
      bot.bodyMat.emissive.setHex(0x000000);
      bot.bodyMat.emissiveIntensity = 0;
    }

    // Line-of-sight check to player
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

    let speed = 3.2;
    _moveDir.set(0, 0, 0);

    if (hasLOS) {
      // Face player smoothly
      const targetYaw = Math.atan2(playerPos.x - bot.position.x, playerPos.z - bot.position.z);
      bot.group.rotation.y = targetYaw;

      // Strafe tactically + maintain mid engagement range
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = 0.9 + Math.random() * 1.1;
      }
      _rightVec.set(Math.cos(targetYaw), 0, -Math.sin(targetYaw));
      _moveDir.addScaledVector(_rightVec, bot.strafeDir * 0.85);
      if (distToPlayer > 18) {
        _moveDir.x += Math.sin(targetYaw) * 0.55;
        _moveDir.z += Math.cos(targetYaw) * 0.55;
      } else if (distToPlayer < 7.5) {
        _moveDir.x -= Math.sin(targetYaw) * 0.65;
        _moveDir.z -= Math.cos(targetYaw) * 0.65;
      }
      speed = 3.6;

      // Burst fire logic
      bot.fireCooldown -= dt;
      if (bot.fireCooldown <= 0) {
        if (bot.burstRemaining <= 0) {
          bot.burstRemaining = 3;
        }
        const muzzleWorld = new THREE.Vector3();
        bot.muzzlePoint.getWorldPosition(muzzleWorld);

        // Accuracy scales cleanly with distance
        const hitChance = THREE.MathUtils.clamp(0.58 - distToPlayer * 0.011, 0.14, 0.56) * difficultyFireScale;
        const hitsPlayer = Math.random() < hitChance;
        const aimOffset = hitsPlayer
          ? new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2)
          : new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.2);
        const shotTarget = _playerEye.clone().add(aimOffset);

        const angleFromPlayer = Math.atan2(bot.position.x - playerPos.x, bot.position.z - playerPos.z);
        onBotFire(muzzleWorld, shotTarget, hitsPlayer, 9 + Math.floor(Math.random() * 5), angleFromPlayer);

        bot.burstRemaining--;
        bot.fireCooldown = bot.burstRemaining > 0 ? 0.16 : 0.95 + Math.random() * 0.7;
      }
    } else {
      // Patrol waypoints (or pursue last known player area if alerted)
      const target = bot.awareOfPlayer ? playerPos : bot.targetWaypoint;
      const dx = target.x - bot.position.x;
      const dz = target.z - bot.position.z;
      const distSq = dx * dx + dz * dz;

      if (!bot.awareOfPlayer && distSq < 2.2) {
        bot.targetWaypoint.copy(waypoints[Math.floor(Math.random() * waypoints.length)]);
      } else if (distSq > 0.2) {
        const len = Math.sqrt(distSq);
        _moveDir.set(dx / len, 0, dz / len);
        bot.group.rotation.y = Math.atan2(_moveDir.x, _moveDir.z);
      }
    }

    // Move + slide against AABB colliders
    if (_moveDir.lengthSq() > 0.001) {
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

      bot.walkPhase += dt * speed * 3.0;
      bot.leftLeg.rotation.x = Math.sin(bot.walkPhase) * 0.48;
      bot.rightLeg.rotation.x = -Math.sin(bot.walkPhase) * 0.48;
    } else {
      bot.leftLeg.rotation.x *= 0.85;
      bot.rightLeg.rotation.x *= 0.85;
    }

    // Ground & ramp elevation for bots
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
