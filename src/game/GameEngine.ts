import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tacticalAudio } from './audio';
import { BotManager, collidesHorizontal, sampleFloorHeight, updateBots } from './bots';
import { buildCompoundMap, BuiltCompoundMap, EnvLightFixture } from './mapBuilder';
import { createTacticalMaterials, TacticalMaterials } from './textures';
import { GameMode, GamePhase, HudSnapshot, KillFeedEntry, MinimapBlip, WeaponId } from './types';
import { createWeaponViewModelRig, WEAPON_SPECS, WeaponViewModelRig } from './weapons';

interface ActiveTracer {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

interface PooledFlashLight {
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  peakIntensity: number;
}

interface EnvPointLightEntry {
  light: THREE.PointLight;
  fixture: EnvLightFixture;
  phase: number;
}

const EYE_STAND = 1.68;
const EYE_CROUCH = 1.15;
const PLAYER_RADIUS = 0.42;

// Module-level scratch vectors (zero GC in loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _assistPos = new THREE.Vector3();
const _assistDir = new THREE.Vector3();
const _sparkPos = new THREE.Vector3();

export class GameEngine {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private isSoftwareGl = false;
  private materials!: TacticalMaterials;
  private map!: BuiltCompoundMap;
  private botManager!: BotManager;
  private weaponRig!: WeaponViewModelRig;

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private hudEmitTimer = 0;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  // Game state
  private phase: GamePhase = 'menu';
  private mode: GameMode = 'skirmish';
  private score = 0;
  private kills = 0;
  private headshots = 0;
  private wave = 1;
  private waveTransitionTimer = 0;
  private roundMessage: string | null = null;
  private roundMessageTimer = 0;

  // Defusal mode state
  private activeSite: 'A' | 'B' = 'A';
  private bombTimer = 45;
  private bombBeepAcc = 0;
  private defuseProgress = 0;
  private isDefusing = false;

  // Player state
  private playerPos = new THREE.Vector3(0, 0, 38);
  private playerVelY = 0;
  private onGround = true;
  private yaw = 0;
  private pitch = 0;
  private currentEyeHeight = EYE_STAND;
  private health = 100;
  private armor = 100;
  private sensitivity = 0.0021;
  private stepAcc = 0;
  private damageFlash = 0;
  private damageDirectionAngle: number | null = null;
  private damageDirTimer = 0;
  private timeSinceDamage = 10;

  // Weapon state
  private weaponId: WeaponId = 'ak47';
  private ammoState: Record<WeaponId, { mag: number; reserve: number }> = {
    ak47: { mag: 30, reserve: 120 },
    m4s: { mag: 30, reserve: 120 },
    awp: { mag: 8, reserve: 32 },
  };
  private lastFireTime = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private isFiringHeld = false;
  private isScoped = false;
  private recoilOffsetPitch = 0;
  private recoilOffsetYaw = 0;
  private weaponKickZ = 0;
  private muzzleFlashTimer = 0;
  private walkBobPhase = 0;
  private hitMarker: 'none' | 'body' | 'head' = 'none';
  private hitMarkerTimer = 0;
  private currentSpreadVisual = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFiring = false;
  private touchDefusing = false;

  // Visual FX & Dynamic Point Light pools
  private envPointLights: EnvPointLightEntry[] = [];
  private c4PointLight!: THREE.PointLight;
  private flashLightPool: PooledFlashLight[] = [];
  private flashPoolCursor = 0;
  private tracers: ActiveTracer[] = [];
  private particles: ImpactParticle[] = [];
  private shellCasings: ShellCasing[] = [];
  private bulletDecals: THREE.Mesh[] = [];
  private decalIndex = 0;
  private decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
  private shellGeo = new THREE.CylinderGeometry(0.006, 0.007, 0.028, 6);
  private shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a036, roughness: 0.25, metalness: 0.88 });
  private particleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  private particleMat = new THREE.MeshBasicMaterial({ color: 0xe7c998 });
  private bloodParticleMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private raycaster = new THREE.Raycaster();
  private killFeed: KillFeedEntry[] = [];
  private nextKillId = 1;
  private webglError: string | null = null;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.initScene();
    this.bindEvents();
    this.emitHud();
    this.tick();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglError = 'WebGL is unavailable in this browser context.';
      return;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, this.isTouchDevice() ? 1.5 : 2)
    );
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xd9ccb8);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xd9ccb8, 0.0068);

    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(74, aspect, 0.08, 280);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Studio environment reflection kept subtle (0.28) so outdoor shadows stay crisp & deep
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    pmrem.dispose();

    // High-contrast Golden-Hour Sun vs Cool Sky-Blue Shadow Fill
    const hemiLight = new THREE.HemisphereLight(0x88b8e8, 0x70583c, 0.44);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe5b4, 2.75);
    sunLight.position.set(42, 64, 34);
    sunLight.castShadow = !this.isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 165;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.radius = 2.2;
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.32);
    rimLight.position.set(-40, 28, -45);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materials = createTacticalMaterials(maxAniso);
    this.map = buildCompoundMap(this.materials);
    this.scene.add(this.map.worldGroup);

    this.initDynamicPointLights();

    this.botManager = new BotManager(this.scene, this.materials.contactShadowMat);

    // Attach first-person weapon viewmodel to camera
    this.weaponRig = createWeaponViewModelRig();
    this.camera.add(this.weaponRig.root);

    // Preview camera pose for the menu backdrop
    this.camera.position.set(16, 8.5, 28);
    this.camera.lookAt(0, 1.5, -2);
    this.weaponRig.root.visible = false;

    // Pre-spawn ambient squad so menu backdrop shows live tactical compound
    this.botManager.spawnWave(4, this.map.botSpawnPoints, this.map.waypoints, 1);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initDynamicPointLights(): void {
    // Pre-allocate environmental fixture point lights (warehouse sodium lamps, sconce, helipad beacon)
    this.map.envLightFixtures.forEach((fixture, idx) => {
      const light = new THREE.PointLight(fixture.color, fixture.baseIntensity, fixture.distance, 2);
      light.position.copy(fixture.position);
      this.scene.add(light);
      this.envPointLights.push({
        light,
        fixture,
        phase: idx * 1.9,
      });
    });

    // Pre-allocated C4 bomb site pulse light (inactive unless in Defusal mode)
    this.c4PointLight = new THREE.PointLight(0xff3b30, 0, 13, 2);
    this.scene.add(this.c4PointLight);

    // Fixed pool of transient combat point lights for muzzle flashes & bullet impact sparks
    // Avoids runtime shader recompilation by keeping light count fixed in scene graph
    const poolSize = this.isSoftwareGl ? 2 : 4;
    for (let i = 0; i < poolSize; i++) {
      const light = new THREE.PointLight(0xffc864, 0, 14, 2);
      this.scene.add(light);
      this.flashLightPool.push({
        light,
        life: 0,
        maxLife: 0.07,
        peakIntensity: 0,
      });
    }
  }

  private spawnFlashLight(
    pos: THREE.Vector3,
    color: number,
    intensity: number,
    duration = 0.065,
    distance = 14
  ): void {
    if (this.flashLightPool.length === 0) return;
    // Prefer an expired slot; otherwise overwrite oldest cursor
    let slot = this.flashLightPool.find((s) => s.life <= 0);
    if (!slot) {
      slot = this.flashLightPool[this.flashPoolCursor % this.flashLightPool.length];
      this.flashPoolCursor++;
    }
    slot.light.position.copy(pos);
    slot.light.color.setHex(color);
    slot.light.distance = distance;
    slot.light.intensity = intensity;
    slot.peakIntensity = intensity;
    slot.life = duration;
    slot.maxLife = duration;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    if (this.renderer?.domElement) {
      this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.webglError = 'WebGL rendering context was interrupted. Attempting recovery...';
    this.emitHud();
  };

  private handleContextRestored = (): void => {
    this.webglError = null;
    this.emitHud();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer?.domElement;
    if (!this.pointerLocked && this.phase === 'playing' && !this.isTouchDevice()) {
      // Allow user to pause cleanly if Escape unlocked pointer
      this.phase = 'paused';
      this.isFiringHeld = false;
      this.isScoped = false;
    }
    this.emitHud();
  };

  private isTouchDevice(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (this.phase !== 'playing') return;

    if (e.code === 'Digit1') this.switchWeapon('ak47');
    else if (e.code === 'Digit2') this.switchWeapon('m4s');
    else if (e.code === 'Digit3') this.switchWeapon('awp');
    else if (e.code === 'KeyR') this.startReload();
    else if (e.code === 'Space' && this.onGround) {
      this.playerVelY = 6.9;
      this.onGround = false;
    } else if (e.code === 'KeyP') {
      this.pauseGame();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || !this.pointerLocked) return;
    const sens = this.isScoped ? this.sensitivity * 0.42 : this.sensitivity;
    this.yaw -= e.movementX * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens, -1.45, 1.45);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    tacticalAudio.unlock();

    if (!this.pointerLocked && !this.isTouchDevice() && e.target === this.renderer?.domElement) {
      this.requestPointerLock();
      return;
    }

    if (this.pointerLocked) {
      if (e.button === 0) {
        this.isFiringHeld = true;
        this.tryFireWeapon();
      } else if (e.button === 2) {
        this.toggleScope();
      }
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isFiringHeld = false;
    }
  };

  public requestPointerLock(): void {
    try {
      this.renderer?.domElement?.requestPointerLock();
    } catch {
      // Ignore in sandboxed contexts if denied
    }
  }

  public startGame(mode: GameMode): void {
    tacticalAudio.unlock();
    this.mode = mode;
    this.phase = 'playing';
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.wave = 1;
    this.waveTransitionTimer = 0;
    this.killFeed = [];

    this.resetPlayer();
    this.resetRoundWorld();

    if (!this.isTouchDevice()) {
      this.requestPointerLock();
    }
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    tacticalAudio.unlock();
    this.phase = 'playing';
    if (!this.isTouchDevice()) {
      this.requestPointerLock();
    }
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.isFiringHeld = false;
    this.isScoped = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  public returnToMenu(): void {
    this.phase = 'menu';
    this.isFiringHeld = false;
    this.isScoped = false;
    this.weaponRig.root.visible = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  public setSensitivity(val: number): void {
    this.sensitivity = val;
  }

  public setTouchMove(x: number, y: number): void {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    const sens = this.isScoped ? this.sensitivity * 0.65 : this.sensitivity * 1.45;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.45, 1.45);
  }

  public setTouchFire(firing: boolean): void {
    tacticalAudio.unlock();
    this.touchFiring = firing;
    if (firing && this.phase === 'playing') {
      this.tryFireWeapon();
    }
  }

  public setTouchDefuse(defusing: boolean): void {
    this.touchDefusing = defusing;
  }

  public triggerTouchJump(): void {
    if (this.phase === 'playing' && this.onGround) {
      this.playerVelY = 6.9;
      this.onGround = false;
    }
  }

  public triggerReload(): void {
    if (this.phase === 'playing') this.startReload();
  }

  public toggleScope(): void {
    if (this.phase !== 'playing' || this.isReloading) return;
    this.isScoped = !this.isScoped;
    this.emitHud();
  }

  public cycleWeapon(): void {
    const order: WeaponId[] = ['ak47', 'm4s', 'awp'];
    const next = order[(order.indexOf(this.weaponId) + 1) % order.length];
    this.switchWeapon(next);
  }

  public switchWeapon(id: WeaponId): void {
    if (this.weaponId === id) return;
    this.weaponId = id;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.isScoped = false;
    (Object.keys(this.weaponRig.models) as WeaponId[]).forEach((k) => {
      this.weaponRig.models[k].visible = k === id;
    });
    this.weaponRig.root.position.y = -0.32;
    this.emitHud();
  }

  private resetPlayer(): void {
    this.playerPos.copy(this.map.playerSpawn);
    this.playerVelY = 0;
    this.onGround = true;
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.armor = 100;
    this.damageFlash = 0;
    this.damageDirectionAngle = null;
    this.timeSinceDamage = 10;
    this.recoilOffsetPitch = 0;
    this.recoilOffsetYaw = 0;
    this.isScoped = false;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.ammoState = {
      ak47: { mag: 30, reserve: 120 },
      m4s: { mag: 30, reserve: 120 },
      awp: { mag: 8, reserve: 32 },
    };
    this.switchWeapon('ak47');
    this.weaponRig.root.visible = true;
  }

  private resetRoundWorld(): void {
    this.map.pickups.forEach((p) => {
      p.active = true;
      p.mesh.visible = true;
      p.respawnTimer = 0;
    });

    if (this.mode === 'casual') {
      this.map.bombSites.A.chargeGroup.visible = false;
      this.map.bombSites.B.chargeGroup.visible = false;
      if (this.c4PointLight) this.c4PointLight.intensity = 0;
      const count = Math.min(4 + Math.floor((this.wave - 1) * 1.5), 8);
      this.botManager.spawnWave(count, this.map.botSpawnPoints, this.map.waypoints, 0.55);
      this.showRoundMessage(`Casual Wave ${this.wave} · ${count} Easy Targets`, 2.6);
    } else if (this.mode === 'skirmish') {
      this.map.bombSites.A.chargeGroup.visible = false;
      this.map.bombSites.B.chargeGroup.visible = false;
      if (this.c4PointLight) this.c4PointLight.intensity = 0;
      const count = Math.min(4 + (this.wave - 1) * 2, 10);
      this.botManager.spawnWave(count, this.map.botSpawnPoints, this.map.waypoints, 1 + (this.wave - 1) * 0.08);
      this.showRoundMessage(`Wave ${this.wave} · ${count} Hostiles Inbound`, 2.6);
    } else {
      this.activeSite = Math.random() < 0.5 ? 'A' : 'B';
      this.bombTimer = 45;
      this.bombBeepAcc = 0;
      this.defuseProgress = 0;
      this.map.bombSites.A.chargeGroup.visible = this.activeSite === 'A';
      this.map.bombSites.B.chargeGroup.visible = this.activeSite === 'B';
      const sitePos = this.map.bombSites[this.activeSite].position;
      if (this.c4PointLight) {
        this.c4PointLight.position.set(sitePos.x, sitePos.y + 0.72, sitePos.z);
      }
      this.botManager.spawnWave(6, this.map.botSpawnPoints, this.map.waypoints, 1.0, sitePos);
      this.showRoundMessage(`Charge Armed at ${this.map.bombSites[this.activeSite].label}`, 3.2);
    }
  }

  private showRoundMessage(msg: string, duration = 2.5): void {
    this.roundMessage = msg;
    this.roundMessageTimer = duration;
  }

  private startReload(): void {
    if (this.isReloading) return;
    const spec = WEAPON_SPECS[this.weaponId];
    const ammo = this.ammoState[this.weaponId];
    if (ammo.mag >= spec.magSize || ammo.reserve <= 0) return;
    this.isReloading = true;
    this.isScoped = false;
    this.reloadTimer = spec.reloadTimeMs / 1000;
    tacticalAudio.playReload();
  }

  private tryFireWeapon(): void {
    if (this.phase !== 'playing' || this.isReloading) return;
    const now = performance.now();
    const spec = WEAPON_SPECS[this.weaponId];
    if (now - this.lastFireTime < spec.fireRateMs) return;

    const ammo = this.ammoState[this.weaponId];
    if (ammo.mag <= 0) {
      this.startReload();
      return;
    }

    this.lastFireTime = now;
    ammo.mag--;
    tacticalAudio.playGunshot(this.weaponId);

    // Muzzle flash & recoil kick
    this.muzzleFlashTimer = 0.045;
    this.weaponRig.muzzleFlash.visible = true;
    this.weaponRig.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.weaponRig.muzzleLight.intensity = 4.2;
    this.weaponKickZ = 0.065;

    const isCasual = this.mode === 'casual';
    const moveSpeed = Math.hypot(
      (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0) + this.touchMoveX,
      (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0) + this.touchMoveY
    );
    const crouchBonus = this.keys['KeyC'] || this.keys['ControlLeft'] ? 0.55 : 1.0;
    const scopeBonus = this.isScoped ? 0.25 : 1.0;
    const modeSpreadScale = isCasual ? 0.4 : 1.0;
    const spread = (spec.spreadBase + Math.min(1, moveSpeed) * spec.spreadMove) * crouchBonus * scopeBonus * modeSpreadScale;

    _rayOrigin.copy(this.camera.position);
    this.camera.getWorldDirection(_rayDir);

    // Subtle forgiving bullet magnetism inside a ~5-degree crosshair cone in Casual mode
    if (isCasual) {
      let bestDot = 0.9958;
      let assistAimFound = false;
      for (const b of this.botManager.bots) {
        if (!b.alive) continue;
        // Aim toward upper torso / head center
        _assistPos.set(b.position.x, b.position.y + 1.38, b.position.z);
        _assistDir.subVectors(_assistPos, _rayOrigin);
        const dist = _assistDir.length();
        if (dist < 0.8 || dist > 65) continue;
        _assistDir.divideScalar(dist);
        const dot = _rayDir.dot(_assistDir);
        if (dot > bestDot) {
          this.raycaster.set(_rayOrigin, _assistDir);
          this.raycaster.far = dist - 0.35;
          if (this.raycaster.intersectObjects(this.map.raycastTargets, false).length === 0) {
            bestDot = dot;
            _rayDir.lerp(_assistDir, 0.72).normalize();
            assistAimFound = true;
          }
        }
      }
      if (!assistAimFound) {
        _rayDir.x += (Math.random() - 0.5) * spread * 2;
        _rayDir.y += (Math.random() - 0.5) * spread * 2;
        _rayDir.z += (Math.random() - 0.5) * spread * 2;
        _rayDir.normalize();
      }
    } else {
      _rayDir.x += (Math.random() - 0.5) * spread * 2;
      _rayDir.y += (Math.random() - 0.5) * spread * 2;
      _rayDir.z += (Math.random() - 0.5) * spread * 2;
      _rayDir.normalize();
    }

    const recoilScale = isCasual ? 0.45 : 1.0;
    this.recoilOffsetPitch += spec.recoilPitch * recoilScale;
    this.recoilOffsetYaw += (Math.random() - 0.5) * spec.recoilYaw * 2 * recoilScale;
    this.currentSpreadVisual = Math.min(1.6, this.currentSpreadVisual + (isCasual ? 0.18 : 0.35));

    // Raycast against world geometry + bot hitboxes
    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = 140;

    const worldHits = this.raycaster.intersectObjects(this.map.raycastTargets, false);
    const botHits = this.raycaster.intersectObjects(this.botManager.getAllHitMeshes(), false);

    const worldDist = worldHits.length > 0 ? worldHits[0].distance : 140;
    const botHit = botHits.length > 0 && botHits[0].distance < worldDist ? botHits[0] : null;

    let hitPoint = _rayOrigin.clone().addScaledVector(_rayDir, worldDist);
    if (botHit) {
      hitPoint = botHit.point.clone();
      const { botId, hitZone } = botHit.object.userData as { botId: number; hitZone: 'head' | 'body' };
      const isHead = hitZone === 'head';
      const dmg = Math.round(spec.damage * (isHead ? spec.headshotMult : 1) * (isCasual ? 1.25 : 1));
      const res = this.botManager.damageBot(botId, dmg);

      this.hitMarker = isHead ? 'head' : 'body';
      this.hitMarkerTimer = 0.16;
      tacticalAudio.playHitMarker(isHead);
      this.spawnImpactParticles(hitPoint, true);

      if (res.killed && res.bot) {
        this.kills++;
        if (isHead) this.headshots++;
        this.score += isHead ? 150 : 100;
        this.killFeed.unshift({
          id: this.nextKillId++,
          killer: 'You',
          victim: res.bot.name,
          weapon: spec.name,
          headshot: isHead,
          timestamp: performance.now(),
        });
        if (this.killFeed.length > 4) this.killFeed.pop();
      }
    } else if (worldHits.length > 0) {
      this.spawnImpactParticles(hitPoint, false);
      _sparkPos.copy(hitPoint).addScaledVector(_rayDir, -0.2);
      this.spawnFlashLight(_sparkPos, 0xffd580, 5.0, 0.05, 6.5);
      const hit = worldHits[0];
      if (hit.face) {
        this.spawnBulletDecal(hitPoint, hit.face.normal, hit.object);
      }
    }

    // Spawn world-space muzzle flash point light, bullet tracer & eject spinning brass shell casing
    this.weaponRig.muzzleFlash.getWorldPosition(_muzzleWorld);
    this.spawnFlashLight(_muzzleWorld, 0xffc864, this.weaponId === 'm4s' ? 6.5 : 13.5, 0.065, 14);
    this.spawnTracer(_muzzleWorld, hitPoint, spec.tracerColor);
    this.spawnShellCasing();

    if (ammo.mag === 0 && ammo.reserve > 0) {
      this.startReload();
    }
    if (!spec.automatic) {
      this.isFiringHeld = false;
      this.touchFiring = false;
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, color: number): void {
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, mat, life: 0.08, maxLife: 0.08 });
  }

  private spawnImpactParticles(pos: THREE.Vector3, isBlood: boolean): void {
    const count = isBlood ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, isBlood ? this.bloodParticleMat : this.particleMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4.5, Math.random() * 3.5 + 0.5, (Math.random() - 0.5) * 4.5),
        life: 0.32,
      });
    }
  }

  private spawnBulletDecal(pos: THREE.Vector3, localNormal: THREE.Vector3, targetObj: THREE.Object3D): void {
    const worldNormal = localNormal.clone().transformDirection(targetObj.matrixWorld).normalize();
    let decal: THREE.Mesh;
    if (this.bulletDecals.length < 36) {
      decal = new THREE.Mesh(this.decalGeo, this.materials.bulletDecalMat);
      this.scene.add(decal);
      this.bulletDecals.push(decal);
    } else {
      decal = this.bulletDecals[this.decalIndex % 36];
      this.decalIndex++;
    }
    decal.position.copy(pos).addScaledVector(worldNormal, 0.018);
    decal.lookAt(pos.x + worldNormal.x, pos.y + worldNormal.y, pos.z + worldNormal.z);
    decal.rotateZ(Math.random() * Math.PI * 2);
  }

  private spawnShellCasing(): void {
    if (this.shellCasings.length > 18) return;
    const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    mesh.position
      .copy(this.camera.position)
      .addScaledVector(camRight, 0.24)
      .addScaledVector(camUp, -0.15)
      .addScaledVector(camFwd, 0.32);

    const vel = new THREE.Vector3()
      .addScaledVector(camRight, 2.2 + Math.random() * 0.8)
      .addScaledVector(camUp, 1.4 + Math.random() * 0.6)
      .addScaledVector(camFwd, (Math.random() - 0.5) * 0.6);

    this.scene.add(mesh);
    this.shellCasings.push({
      mesh,
      vel,
      rotVel: new THREE.Vector3(14 + Math.random() * 10, 12, 16),
      life: 0.75,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.phase === 'menu') {
      // Gentle orbital flyby around the sunlit compound
      const t = this.clock.getElapsedTime() * 0.14;
      this.camera.position.set(Math.sin(t) * 28, 10.5, Math.cos(t) * 28);
      this.camera.lookAt(0, 1.4, -2);
      this.sunLight.target.position.set(0, 0, 0);
      this.sunLight.position.set(42, 64, 34);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
      // Snap directional shadow camera around player for ultra-crisp local shadows
      const sx = Math.round(this.playerPos.x * 2) / 2;
      const sz = Math.round(this.playerPos.z * 2) / 2;
      this.sunLight.target.position.set(sx, 0, sz);
      this.sunLight.position.set(sx + 42, 64, sz + 34);
    }

    this.updateFX(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updatePlaying(dt: number): void {
    const spec = WEAPON_SPECS[this.weaponId];

    // Automatic fire
    if ((this.isFiringHeld || this.touchFiring) && spec.automatic) {
      this.tryFireWeapon();
    }

    // Reload timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const ammo = this.ammoState[this.weaponId];
        const needed = spec.magSize - ammo.mag;
        const load = Math.min(needed, ammo.reserve);
        ammo.mag += load;
        ammo.reserve -= load;
        this.isReloading = false;
        this.reloadTimer = 0;
      }
    }

    // Smooth camera FOV zoom (ADS/Scope)
    const targetFov = this.isScoped ? spec.adsFov : 74;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    // Recoil spring recovery
    this.recoilOffsetPitch = THREE.MathUtils.damp(this.recoilOffsetPitch, 0, 12, dt);
    this.recoilOffsetYaw = THREE.MathUtils.damp(this.recoilOffsetYaw, 0, 12, dt);
    this.currentSpreadVisual = THREE.MathUtils.damp(this.currentSpreadVisual, 0, 9, dt);

    // Player movement vector
    const inForward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0) + this.touchMoveY;
    const inStrafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0) + this.touchMoveX;
    const isCrouching = Boolean(this.keys['KeyC'] || this.keys['ControlLeft']);
    const isWalking = Boolean(this.keys['ShiftLeft']);

    let moveSpeed = 7.4;
    if (isCrouching) moveSpeed = 4.0;
    else if (isWalking || this.isScoped) moveSpeed = 4.5;

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _wishDir.set(0, 0, 0).addScaledVector(_forward, inForward).addScaledVector(_right, inStrafe);
    if (_wishDir.lengthSq() > 1) _wishDir.normalize();

    const stepX = _wishDir.x * moveSpeed * dt;
    const stepZ = _wishDir.z * moveSpeed * dt;
    const playerHeight = isCrouching ? 1.28 : 1.82;

    if (!collidesHorizontal(this.playerPos.x + stepX, this.playerPos.y, this.playerPos.z, PLAYER_RADIUS, playerHeight, this.map.colliders)) {
      this.playerPos.x += stepX;
    }
    if (!collidesHorizontal(this.playerPos.x, this.playerPos.y, this.playerPos.z + stepZ, PLAYER_RADIUS, playerHeight, this.map.colliders)) {
      this.playerPos.z += stepZ;
    }

    // Vertical gravity & ramp climbing
    this.playerVelY -= 19.5 * dt;
    this.playerPos.y += this.playerVelY * dt;
    const floorY = sampleFloorHeight(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.map.colliders, this.map.ramps);
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVelY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Crouch eye height smoothing
    const targetEye = isCrouching ? EYE_CROUCH : EYE_STAND;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 14, dt);

    // Footsteps & weapon walk bob
    const horizSpeed = _wishDir.length() * moveSpeed;
    if (this.onGround && horizSpeed > 1.2) {
      this.walkBobPhase += dt * horizSpeed * 1.45;
      this.stepAcc += dt * horizSpeed;
      if (this.stepAcc > 2.8 && !isWalking) {
        this.stepAcc = 0;
        tacticalAudio.playFootstep();
      }
    } else {
      this.walkBobPhase = THREE.MathUtils.damp(this.walkBobPhase, 0, 8, dt);
    }

    // Apply camera transform
    this.camera.position.set(this.playerPos.x, this.playerPos.y + this.currentEyeHeight, this.playerPos.z);
    this.camera.rotation.y = this.yaw + this.recoilOffsetYaw;
    this.camera.rotation.x = THREE.MathUtils.clamp(this.pitch + this.recoilOffsetPitch, -1.48, 1.48);

    // Viewmodel pose (hide gun body if AWP sniper scope overlay is active)
    this.weaponRig.root.visible = !(this.isScoped && spec.hasScopeOverlay);
    this.weaponKickZ = THREE.MathUtils.damp(this.weaponKickZ, 0, 16, dt);
    const targetRigX = this.isScoped ? 0.0 : 0.24;
    const targetRigY = this.isReloading ? -0.34 : this.isScoped ? -0.15 : -0.22;
    const bobX = Math.cos(this.walkBobPhase) * 0.011 * Math.min(1, horizSpeed / 7);
    const bobY = Math.abs(Math.sin(this.walkBobPhase)) * 0.013 * Math.min(1, horizSpeed / 7);
    this.weaponRig.root.position.x = THREE.MathUtils.damp(this.weaponRig.root.position.x, targetRigX + bobX, 14, dt);
    this.weaponRig.root.position.y = THREE.MathUtils.damp(this.weaponRig.root.position.y, targetRigY - bobY, 14, dt);
    this.weaponRig.root.position.z = -0.44 + this.weaponKickZ;
    this.weaponRig.root.rotation.x = this.isReloading ? -0.45 : this.weaponKickZ * 1.2;

    // Update pickups
    this.map.pickups.forEach((p) => {
      if (p.active) {
        p.mesh.rotation.y += dt * 1.8;
        p.mesh.position.y = p.position.y + 0.45 + Math.sin(this.clock.getElapsedTime() * 3) * 0.08;
        if (this.playerPos.distanceTo(p.position) < 1.75) {
          if (p.type === 'medkit' && this.health < 100) {
            this.health = Math.min(100, this.health + 45);
            this.armor = Math.min(100, this.armor + 25);
            p.active = false;
            p.mesh.visible = false;
            p.respawnTimer = 18;
            tacticalAudio.playPickup();
          } else if (p.type === 'ammo') {
            this.ammoState.ak47.reserve = WEAPON_SPECS.ak47.reserveMax;
            this.ammoState.m4s.reserve = WEAPON_SPECS.m4s.reserveMax;
            this.ammoState.awp.reserve = WEAPON_SPECS.awp.reserveMax;
            p.active = false;
            p.mesh.visible = false;
            p.respawnTimer = 16;
            tacticalAudio.playPickup();
          }
        }
      } else {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.active = true;
          p.mesh.visible = true;
        }
      }
    });

    // Passive shield & health regeneration in Casual mode when out of fire
    this.timeSinceDamage += dt;
    if (this.mode === 'casual' && this.timeSinceDamage > 2.2) {
      if (this.health < 100) this.health = Math.min(100, this.health + dt * 11);
      if (this.armor < 100) this.armor = Math.min(100, this.armor + dt * 6);
    }

    // Update bots AI with mode-appropriate lethality
    const botOpts =
      this.mode === 'casual'
        ? {
            difficultyFireScale: 0.25,
            burstPauseScale: 1.9,
            minDamage: 3,
            maxDamage: 5,
            strafeSpeedScale: 0.65,
          }
        : this.mode === 'skirmish'
        ? {
            difficultyFireScale: 0.85 + this.wave * 0.08,
            burstPauseScale: 1.0,
            minDamage: 9,
            maxDamage: 13,
            strafeSpeedScale: 1.0,
          }
        : {
            difficultyFireScale: 1.0,
            burstPauseScale: 1.0,
            minDamage: 9,
            maxDamage: 14,
            strafeSpeedScale: 1.0,
          };

    updateBots(
      dt,
      this.botManager,
      this.playerPos,
      this.currentEyeHeight,
      this.map.colliders,
      this.map.ramps,
      this.map.raycastTargets,
      this.map.waypoints,
      botOpts,
      (muzzlePos, targetPos, hitsPlayer, damage, angleFromPlayer) => {
        tacticalAudio.playGunshot('ak47', 0.35);
        this.spawnTracer(muzzlePos, targetPos, 0xff7b54);
        this.spawnFlashLight(muzzlePos, 0xff9a44, 11.5, 0.065, 13);
        if (hitsPlayer && this.phase === 'playing') {
          this.applyPlayerDamage(damage, angleFromPlayer);
        }
      }
    );

    // Check mode win / wave progression
    const botsAlive = this.botManager.bots.filter((b) => b.alive).length;
    if (this.mode === 'casual' || this.mode === 'skirmish') {
      if (botsAlive === 0) {
        if (this.waveTransitionTimer <= 0) {
          this.waveTransitionTimer = 2.6;
          this.showRoundMessage(`Wave ${this.wave} Cleared · Resupplying`, 2.5);
          const healAmt = this.mode === 'casual' ? 50 : 25;
          this.health = Math.min(100, this.health + healAmt);
          this.armor = Math.min(100, this.armor + healAmt);
          tacticalAudio.playRoundEnd(true);
        } else {
          this.waveTransitionTimer -= dt;
          if (this.waveTransitionTimer <= 0) {
            this.wave++;
            this.resetRoundWorld();
          }
        }
      }
    } else {
      // Defusal mode timer & charge disarming
      this.bombTimer -= dt;
      this.bombBeepAcc += dt;
      const beepInterval = this.bombTimer < 10 ? 0.35 : this.bombTimer < 20 ? 0.65 : 1.0;
      if (this.bombBeepAcc >= beepInterval) {
        this.bombBeepAcc = 0;
        tacticalAudio.playBombBeep(this.bombTimer < 10);
      }

      const site = this.map.bombSites[this.activeSite];
      const nearSite = this.playerPos.distanceTo(site.position) <= site.radius;
      const wantDefuse = Boolean(this.keys['KeyE'] || this.touchDefusing);
      this.isDefusing = nearSite && wantDefuse;

      if (this.isDefusing) {
        this.defuseProgress += dt / 3.2;
        if (this.defuseProgress >= 1) {
          this.defuseProgress = 1;
          this.score += 500;
          this.endMatch('victory', 'Charge Disarmed · Sector Secured');
          return;
        }
      } else {
        this.defuseProgress = Math.max(0, this.defuseProgress - dt * 1.5);
      }

      if (botsAlive === 0 && this.bombTimer > 0) {
        if (!this.roundMessage && !nearSite) {
          this.showRoundMessage(`Squad Eliminated · Defuse Charge at Site ${this.activeSite}`, 3.0);
        }
      }

      if (this.bombTimer <= 0) {
        this.bombTimer = 0;
        this.endMatch('defeat', 'Charge Detonated · Objective Lost');
        return;
      }
    }

    // Decay transient visual timers
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) this.hitMarker = 'none';
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    }
    if (this.damageDirTimer > 0) {
      this.damageDirTimer -= dt;
      if (this.damageDirTimer <= 0) this.damageDirectionAngle = null;
    }
    if (this.roundMessageTimer > 0) {
      this.roundMessageTimer -= dt;
      if (this.roundMessageTimer <= 0) this.roundMessage = null;
    }

    // Throttled HUD snapshot push (~24Hz)
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.042) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private applyPlayerDamage(amount: number, sourceAngleWorld: number): void {
    tacticalAudio.playPlayerHurt();
    this.timeSinceDamage = 0;
    this.damageFlash = 0.85;
    // Relative angle for directional damage arc
    this.damageDirectionAngle = sourceAngleWorld - this.yaw;
    this.damageDirTimer = 1.1;

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, Math.round(amount * 0.45));
      this.armor -= absorbed;
      this.health -= amount - absorbed;
    } else {
      this.health -= amount;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.endMatch('defeat', 'Operative Down · Mission Failed');
    }
  }

  private endMatch(outcome: 'victory' | 'defeat', msg: string): void {
    this.phase = outcome;
    this.isFiringHeld = false;
    this.touchFiring = false;
    this.isScoped = false;
    this.roundMessage = msg;
    tacticalAudio.playRoundEnd(outcome === 'victory');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  private updateFX(dt: number): void {
    const elapsed = this.clock.getElapsedTime();

    // Animate environmental fixture point lights (warehouse hum, steady sconce, helipad strobe)
    for (let i = 0; i < this.envPointLights.length; i++) {
      const entry = this.envPointLights[i];
      if (entry.fixture.kind === 'warehouse') {
        const flicker = 0.94 + Math.sin(elapsed * 19 + entry.phase) * 0.03 + Math.sin(elapsed * 43 + entry.phase) * 0.03;
        entry.light.intensity = entry.fixture.baseIntensity * flicker;
        entry.fixture.bulbMat.emissiveIntensity = 2.1 * flicker;
      } else if (entry.fixture.kind === 'beacon') {
        const pulse = Math.pow(Math.max(0, Math.sin(elapsed * 3.4 + entry.phase)), 2);
        entry.light.intensity = entry.fixture.baseIntensity * (0.25 + pulse * 0.95);
        entry.fixture.bulbMat.emissiveIntensity = 0.7 + pulse * 2.2;
      }
    }

    // Pulse red C4 charge beacon point light in Defusal mode
    if (this.c4PointLight) {
      if (this.mode === 'defusal' && this.phase === 'playing') {
        const rate = this.bombTimer < 10 ? 12 : this.bombTimer < 20 ? 6.5 : 3.5;
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(elapsed * rate), 2);
        this.c4PointLight.intensity = 1.2 + pulse * 6.5;
      } else {
        this.c4PointLight.intensity = 0;
      }
    }

    // Decay pooled combat flash point lights (muzzle flashes & impact sparks)
    for (let i = 0; i < this.flashLightPool.length; i++) {
      const slot = this.flashLightPool[i];
      if (slot.life > 0) {
        slot.life -= dt;
        if (slot.life <= 0) {
          slot.life = 0;
          slot.light.intensity = 0;
        } else {
          const ratio = slot.life / slot.maxLife;
          slot.light.intensity = slot.peakIntensity * ratio * ratio;
        }
      }
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.weaponRig.muzzleFlash.visible = false;
        this.weaponRig.muzzleLight.intensity = 0;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.mat.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mat.opacity = (t.life / t.maxLife) * 0.85;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      } else {
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(p.life / 0.32);
      }
    }

    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const s = this.shellCasings[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shellCasings.splice(i, 1);
      } else {
        s.vel.y -= 13.5 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.x += s.rotVel.x * dt;
        s.mesh.rotation.y += s.rotVel.y * dt;
        s.mesh.rotation.z += s.rotVel.z * dt;
      }
    }
  }

  public getMinimapWalls(): Array<{ x: number; z: number; w: number; d: number }> {
    return this.map?.minimapWalls ?? [];
  }

  private emitHud(): void {
    const spec = WEAPON_SPECS[this.weaponId];
    const ammo = this.ammoState[this.weaponId];
    const botsAlive = this.botManager ? this.botManager.bots.filter((b) => b.alive).length : 0;
    const botsTotal = this.botManager ? this.botManager.bots.length : 0;
    const site = this.map?.bombSites[this.activeSite];
    const nearBombSite = Boolean(this.mode === 'defusal' && site && this.playerPos.distanceTo(site.position) <= site.radius);

    const blips: MinimapBlip[] = [];
    if (this.botManager) {
      for (const b of this.botManager.bots) {
        if (b.alive && (b.awareOfPlayer || b.position.distanceTo(this.playerPos) < 22)) {
          blips.push({ x: b.position.x, z: b.position.z, type: 'bot' });
        }
      }
    }
    if (this.mode === 'defusal' && site) {
      blips.push({ x: site.position.x, z: site.position.z, type: 'objective' });
    }
    if (this.map) {
      for (const p of this.map.pickups) {
        if (p.active) blips.push({ x: p.position.x, z: p.position.z, type: 'pickup' });
      }
    }

    const now = performance.now();
    this.killFeed = this.killFeed.filter((k) => now - k.timestamp < 5500);

    this.onHudUpdate({
      phase: this.phase,
      mode: this.mode,
      health: Math.ceil(this.health),
      armor: Math.ceil(this.armor),
      weaponId: this.weaponId,
      weaponName: spec.name,
      ammoInMag: ammo.mag,
      ammoReserve: ammo.reserve,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / (spec.reloadTimeMs / 1000) : 0,
      isScoped: this.isScoped,
      crosshairSpread: this.currentSpreadVisual,
      hitMarker: this.hitMarker,
      damageDirectionAngle: this.damageDirectionAngle,
      damageFlash: this.damageFlash,
      score: this.score,
      kills: this.kills,
      headshots: this.headshots,
      wave: this.wave,
      botsAlive,
      botsTotal,
      bombTimer: this.bombTimer,
      activeSite: this.activeSite,
      nearBombSite,
      defuseProgress: this.defuseProgress,
      roundMessage: this.roundMessage,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.yaw,
      minimapBlips: blips,
      killFeed: [...this.killFeed],
      pointerLocked: this.pointerLocked,
      webglError: this.webglError,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    this.tracers.forEach((t) => {
      t.line.geometry.dispose();
      t.mat.dispose();
    });
    this.bulletDecals.forEach((d) => this.scene.remove(d));
    this.shellCasings.forEach((s) => this.scene.remove(s.mesh));
    this.decalGeo.dispose();
    this.shellGeo.dispose();
    this.shellMat.dispose();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.bloodParticleMat.dispose();

    this.botManager?.dispose();
    this.weaponRig?.dispose();
    this.map?.dispose();
    this.materials?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
