import * as THREE from 'three';

export type GameMode = 'casual' | 'skirmish' | 'defusal';
export type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';
export type WeaponId = 'ak47' | 'm4s' | 'awp';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: number;
  category: string;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  magSize: number;
  reserveMax: number;
  reloadTimeMs: number;
  spreadBase: number;
  spreadMove: number;
  recoilPitch: number;
  recoilYaw: number;
  automatic: boolean;
  adsFov: number;
  hasScopeOverlay: boolean;
  tracerColor: number;
}

export interface AABBCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  startCoord: number;
  endCoord: number;
  startY: number;
  endY: number;
}

export interface PickupItem {
  id: string;
  type: 'medkit' | 'ammo';
  position: THREE.Vector3;
  mesh: THREE.Group;
  active: boolean;
  respawnTimer: number;
}

export interface BombSiteInfo {
  id: 'A' | 'B';
  label: string;
  position: THREE.Vector3;
  radius: number;
  ringMesh: THREE.Mesh;
  chargeGroup: THREE.Group;
}

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  timestamp: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  type: 'bot' | 'objective' | 'pickup';
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  health: number;
  armor: number;
  weaponId: WeaponId;
  weaponName: string;
  ammoInMag: number;
  ammoReserve: number;
  isReloading: boolean;
  reloadProgress: number;
  isScoped: boolean;
  crosshairSpread: number;
  hitMarker: 'none' | 'body' | 'head';
  damageDirectionAngle: number | null;
  damageFlash: number;
  score: number;
  kills: number;
  headshots: number;
  wave: number;
  botsAlive: number;
  botsTotal: number;
  bombTimer: number;
  activeSite: 'A' | 'B';
  nearBombSite: boolean;
  defuseProgress: number;
  roundMessage: string | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  minimapBlips: MinimapBlip[];
  killFeed: KillFeedEntry[];
  pointerLocked: boolean;
  webglError: string | null;
}
