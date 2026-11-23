import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHARACTER_OUTFITS, HOVERBOARDS, LEVELS, POWERUP_INFO } from '../data/gameData';
import {
  ActivePowerUpTimers,
  GraphicsQuality,
  PowerUpInventory,
  PowerUpType,
  RunHudState,
  RunResult,
  WorldId,
} from '../types/game';
import { soundEngine } from './audio';
import { createObstacleSystem } from './obstacles';
import { createParticlePool } from './particles';
import { createRoyalThrone, createSheraRig, SheraAnimState } from './sheraModel';
import { createProceduralTextures } from './textures';
import { createWorldEnvironment, LANE_WIDTH, ROTATION_WORLD_SEQUENCE } from './worlds';

export type EngineMode = 'home' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface EngineCallbacks {
  onHudUpdate: (hud: RunHudState) => void;
  onGameOver: (result: RunResult) => void;
  onLevelUpMilestone: (levelNum: number) => void;
  onConsumePowerUp: (type: PowerUpType) => void;
  onMetricIncrement: (metric: 'jumps' | 'slides' | 'powerups', amount?: number) => void;
}

// Pre-allocated helpers outside render loop (zero per-frame GC)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const POWERUP_KEYS: PowerUpType[] = [
  'magnet',
  'shield',
  'rocket',
  'speedBoost',
  'doubleCoins',
  'invincibility',
  'hoverboard',
  'superJump',
];
const WORLD_ROTATION_INTERVAL_SEC = 120;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class SheraGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private contextLost = false;
  private graphicsQuality: GraphicsQuality = 'high';
  private envMap: THREE.Texture;

  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  private textures: ReturnType<typeof createProceduralTextures>;
  private worldEnv: ReturnType<typeof createWorldEnvironment>;
  private shera: ReturnType<typeof createSheraRig>;
  private throne: ReturnType<typeof createRoyalThrone>;
  private contactShadow: THREE.Mesh;
  private obstacleSys: ReturnType<typeof createObstacleSystem>;
  private particles: ReturnType<typeof createParticlePool>;

  private frameId = 0;
  private disposed = false;
  private isBackgrounded = false;
  private lastTime = performance.now();
  private totalTime = 0;
  private hudSyncAccum = 0;

  // Game Mode & State
  private mode: EngineMode = 'home';
  private worldId: WorldId = 'clouds';
  private worldRotationEnabled = true;
  private worldRunElapsed = 0;
  private worldsVisited: Set<WorldId> = new Set(['clouds']);
  private gameLevel = 1;
  private outfitScoreBonus = 0;
  private hoverboardBonusSec = 0;
  private powerUpLevels: Record<PowerUpType, number> = {
    magnet: 1,
    shield: 1,
    rocket: 1,
    speedBoost: 1,
    doubleCoins: 1,
    invincibility: 1,
    hoverboard: 1,
    superJump: 1,
  };
  private inventory: PowerUpInventory = {
    magnet: 0,
    shield: 0,
    rocket: 0,
    speedBoost: 0,
    doubleCoins: 0,
    invincibility: 0,
    hoverboard: 0,
    superJump: 0,
  };

  // Player Kinematics
  private playerLane = 0; // -1, 0, 1
  private playerX = 0;
  private playerY = 0;
  private playerVelY = 0;
  private readonly playerZ = 0;
  private isGrounded = true;
  private jumpsUsed = 0;
  private doubleJumpSpin = 0;
  private slideTimer = 0;
  private stumbleTimer = 0;
  private victoryTimer = 0;
  private squashY = 1;
  private invulnTimer = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private footstepTimer = 0;
  private lavaAudioTimer = 0;
  private bufferedAction: 'left' | 'right' | 'jump' | 'slide' | null = null;
  private bufferTimer = 0;

  // Run Stats & Timers
  private speed = 24;
  private baseSpeed = 24;
  private maxSpeed = 42;
  private distance = 0;
  private score = 0;
  private runCoins = 0;
  private runGems = 0;
  private comboCount = 0;
  private comboTimer = 0;
  private revivedCount = 0;
  private adRevivedCount = 0;
  private coinRevivedCount = 0;
  private levelTargetDistance = 300;
  private levelClearedThisRun = false;
  private nearMissText: string | null = null;
  private nearMissTimer = 0;
  private bannerAlert: string | null = null;
  private bannerTimer = 0;
  private activeTimers: ActivePowerUpTimers = {
    magnet: 0,
    shield: 0,
    rocket: 0,
    speedBoost: 0,
    doubleCoins: 0,
    invincibility: 0,
    hoverboard: 0,
    superJump: 0,
  };
  private shieldHitsRemaining = 0;
  private rocketCoinAccum = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      57,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      400
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.4;
    pmrem.dispose();

    // Calibrated 3-Point Warm/Cool Lighting Rig (prevents white blow-out on fur & suit)
    this.hemiLight = new THREE.HemisphereLight(0x8cc8ff, 0x6f5539, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0c8, 1.44);
    this.keyLight.position.set(12, 22, 14);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = this.isSoftwareGl ? 512 : 2048;
    this.keyLight.shadow.mapSize.height = this.isSoftwareGl ? 512 : 2048;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 65;
    const d = 16;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.48);
    this.rimLight.position.set(-10, 12, -16);
    this.scene.add(this.rimLight);

    this.textures = createProceduralTextures(this.renderer);
    this.worldEnv = createWorldEnvironment(this.scene, this.textures, this.hemiLight, this.keyLight);

    this.shera = createSheraRig(CHARACTER_OUTFITS[0], HOVERBOARDS[0], this.textures);
    this.shera.root.scale.setScalar(1.12);
    this.scene.add(this.shera.root);

    // Soft radial contact shadow directly beneath Shera during gameplay runs
    const shadowGeo = new THREE.PlaneGeometry(2.1, 2.1);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadowTexture,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.025;
    this.contactShadow.visible = false;
    this.scene.add(this.contactShadow);

    this.throne = createRoyalThrone();
    this.throne.group.position.set(0, 0, 0);
    this.scene.add(this.throne.group);

    this.obstacleSys = createObstacleSystem(this.scene, this.textures, () => {
      if (this.mode === 'playing') {
        soundEngine.playTrainHorn();
      }
    });

    this.particles = createParticlePool(this.scene, this.textures.particleTexture);

    this.worldEnv.applyWorld('clouds');
    this.setHomeCameraInstant();
    this.shera.updateAnimation('throne', 0, 0.016, 0, 0, 1);

    if (!this.isSoftwareGl) {
      this.worldEnv.preWarmWorlds(this.renderer, this.camera);
    }
    this.renderer.render(this.scene, this.camera);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);
    this.startLoop();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.lastTime = performance.now();
  };

  private getHomeCameraDistance(): { y: number; z: number; lookY: number } {
    const aspect = this.camera.aspect || 1;
    if (aspect < 0.78) {
      return { y: 2.34, z: 6.45, lookY: 1.48 };
    }
    return { y: 2.15, z: 5.15, lookY: 1.46 };
  }

  private setHomeCameraInstant(): void {
    const { y, z, lookY } = this.getHomeCameraDistance();
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, y, z);
    this.camera.lookAt(0, lookY, -0.35);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  public applyCustomization(
    worldId: WorldId,
    outfitId: string,
    hoverboardId: string,
    powerUpLevels: Record<PowerUpType, number>,
    inventory: PowerUpInventory,
    worldRotationEnabled = true
  ): void {
    this.worldRotationEnabled = worldRotationEnabled;
    if (this.mode === 'home') {
      this.worldId = worldId;
      this.worldEnv.applyWorld(worldId);
    }
    const outfit = CHARACTER_OUTFITS.find((o) => o.id === outfitId) || CHARACTER_OUTFITS[0];
    this.outfitScoreBonus = outfit.scoreBonus;
    this.shera.applyOutfit(outfit);

    const board = HOVERBOARDS.find((b) => b.id === hoverboardId) || HOVERBOARDS[0];
    this.hoverboardBonusSec = board.durationBonus;
    this.shera.applyHoverboard(board);

    this.powerUpLevels = { ...powerUpLevels };
    this.inventory = { ...inventory };

    if (this.mode === 'home' && !this.contextLost) {
      this.shera.updateAnimation('throne', this.totalTime, 0.016, 0, 0, 1);
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    this.worldEnv.setQuality(quality);
    if (this.isSoftwareGl) return;
    if (quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
      this.renderer.setPixelRatio(1);
    } else if (quality === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
      if (this.keyLight.shadow.mapSize.width !== 1024) {
        this.keyLight.shadow.mapSize.set(1024, 1024);
        this.keyLight.shadow.map?.dispose();
        this.keyLight.shadow.map = null;
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
      if (this.keyLight.shadow.mapSize.width !== 2048) {
        this.keyLight.shadow.mapSize.set(2048, 2048);
        this.keyLight.shadow.map?.dispose();
        this.keyLight.shadow.map = null;
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  public setAppBackgrounded(hidden: boolean): void {
    if (this.disposed) return;
    if (hidden) {
      this.isBackgrounded = true;
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      if (this.mode === 'playing') {
        this.mode = 'paused';
      }
      soundEngine.suspend();
    } else {
      if (!this.isBackgrounded) return;
      this.isBackgrounded = false;
      this.lastTime = performance.now();
      soundEngine.resume();
      this.scheduleNextTick();
    }
  }

  public enterHome(): void {
    this.mode = 'home';
    soundEngine.stopRewardClip();
    this.obstacleSys.reset();
    this.throne.group.visible = true;
    this.shera.root.position.set(0, 0, 0);
    this.shera.root.rotation.set(0, 0, 0);
    this.shera.root.scale.setScalar(1.12);
    this.shera.hoverboardGroup.visible = false;
    this.shera.shieldMesh.visible = false;
    this.shera.rocketGroup.visible = false;
    this.shera.magnetHalo.visible = false;
    this.shera.invincibleAura.visible = false;
    this.contactShadow.visible = false;
    this.particles.update(5);
    this.worldEnv.applyWorld(this.worldId);
    this.setHomeCameraInstant();
    this.shera.updateAnimation('throne', this.totalTime, 0.016, 0, 0, 1);
    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }
    soundEngine.startMusic('menu');
  }

  public startRun(
    worldId: WorldId,
    gameLevel: number,
    inventory: PowerUpInventory,
    worldRotationEnabled = true
  ): void {
    this.worldId = worldId;
    this.worldRotationEnabled = worldRotationEnabled;
    this.worldRunElapsed = 0;
    this.worldsVisited = new Set([worldId]);
    this.gameLevel = gameLevel;
    this.inventory = { ...inventory };

    const lvlDef = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, gameLevel - 1))];
    this.baseSpeed = lvlDef.baseSpeed;
    this.maxSpeed = lvlDef.maxSpeed;
    this.levelTargetDistance = lvlDef.targetDistance;
    this.levelClearedThisRun = false;

    this.speed = this.baseSpeed;
    this.distance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.runGems = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.revivedCount = 0;
    this.adRevivedCount = 0;
    this.coinRevivedCount = 0;

    this.playerLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.jumpsUsed = 0;
    this.doubleJumpSpin = 0;
    this.slideTimer = 0;
    this.stumbleTimer = 0;
    this.victoryTimer = 0;
    this.squashY = 1;
    this.invulnTimer = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.bufferedAction = null;

    for (let i = 0; i < POWERUP_KEYS.length; i++) {
      this.activeTimers[POWERUP_KEYS[i]] = 0;
    }
    this.shieldHitsRemaining = 0;
    this.nearMissText = null;
    this.bannerAlert = `${lvlDef.title} • Target ${lvlDef.targetDistance}m`;
    this.bannerTimer = 2.6;

    this.throne.group.visible = false;
    this.contactShadow.visible = true;
    this.shera.root.position.set(0, 0, 0);
    // Shera runs toward -Z facing forward into the fantasy track
    this.shera.root.rotation.set(0, Math.PI, 0);
    this.shera.root.scale.setScalar(1.04);
    this.shera.hoverboardGroup.visible = false;
    this.shera.shieldMesh.visible = false;
    this.shera.rocketGroup.visible = false;
    this.shera.magnetHalo.visible = false;
    this.shera.invincibleAura.visible = false;

    this.worldEnv.applyWorld(worldId);
    this.obstacleSys.reset();
    this.particles.update(5);

    this.camera.fov = 57;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 3.45, 6.65);
    this.camera.lookAt(0, 1.52, -15.5);

    this.mode = 'playing';
    this.shera.updateAnimation('run', this.totalTime, 0.016, this.speed, 0, 1);
    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }
    soundEngine.stopRewardClip();
    soundEngine.preloadRewardClip();
    soundEngine.startMusic(worldId);
    this.emitHud();
  }

  public pause(): void {
    if (this.mode === 'playing') {
      this.mode = 'paused';
    }
  }

  public resume(): void {
    if (this.mode === 'paused') {
      this.mode = 'playing';
      this.lastTime = performance.now();
    }
  }

  public revive(source: 'ad' | 'coin' | 'gem' = 'ad'): void {
    if (this.mode !== 'gameover') return;
    this.revivedCount += 1;
    if (source === 'ad') this.adRevivedCount += 1;
    if (source === 'coin') this.coinRevivedCount += 1;
    this.mode = 'playing';
    this.lastTime = performance.now();
    this.invulnTimer = 3.2;
    this.playerY = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.slideTimer = 0;
    this.obstacleSys.clearNearbyObstacles(this.playerZ, 28);
    this.particles.burst(this.playerX, 1.4, this.playerZ, 0x38bdf8, 28, 7);
    this.bannerAlert = 'REVIVED! ROYAL SECOND WIND!';
    this.bannerTimer = 2.2;
    soundEngine.playPowerUp('shield');
    this.emitHud();
  }

  public handleInput(action: 'left' | 'right' | 'jump' | 'slide'): void {
    if (this.mode !== 'playing') return;

    if (action === 'left') {
      if (this.playerLane > -1) {
        this.playerLane -= 1;
        soundEngine.playLaneSwitch();
      }
      return;
    }
    if (action === 'right') {
      if (this.playerLane < 1) {
        this.playerLane += 1;
        soundEngine.playLaneSwitch();
      }
      return;
    }
    if (action === 'jump') {
      if (this.activeTimers.rocket > 0) return;
      if (this.isGrounded) {
        this.triggerJump(false, false);
      } else if (this.jumpsUsed < 2 && this.playerY > 0.22) {
        this.triggerJump(false, true);
      } else {
        this.bufferedAction = 'jump';
        this.bufferTimer = 0.18;
      }
      return;
    }
    if (action === 'slide') {
      if (this.activeTimers.rocket > 0) return;
      if (this.isGrounded) {
        this.triggerSlide();
      } else {
        // Fast-fall slam + immediate slide on landing!
        this.playerVelY = Math.min(this.playerVelY, -28);
        this.bufferedAction = 'slide';
        this.bufferTimer = 0.25;
      }
    }
  }

  private triggerJump(fromRamp: boolean, isDoubleJump = false): void {
    const superJumpActive = this.activeTimers.superJump > 0;
    const jumpPower = fromRamp
      ? 22.5
      : isDoubleJump
      ? superJumpActive
        ? 18.2
        : 14.2
      : superJumpActive
      ? 19.8
      : 15.6;
    this.playerVelY = jumpPower;
    this.isGrounded = false;
    this.jumpsUsed = isDoubleJump ? 2 : 1;
    if (isDoubleJump) {
      this.doubleJumpSpin = 0;
    }
    this.slideTimer = 0;
    this.squashY = 1.24;
    this.particles.burst(
      this.playerX,
      this.playerY + 0.35,
      this.playerZ,
      isDoubleJump ? 0x38bdf8 : superJumpActive ? 0xa855f7 : 0xfef08a,
      isDoubleJump ? 14 : 10,
      isDoubleJump ? 4.2 : 3.2
    );
    if (isDoubleJump) {
      soundEngine.playDoubleJump();
    } else {
      soundEngine.playJump(superJumpActive || fromRamp);
    }
    if (!fromRamp) {
      this.callbacks.onMetricIncrement('jumps', 1);
    }
  }

  private triggerSlide(): void {
    this.slideTimer = 0.72;
    this.squashY = 0.74;
    soundEngine.playSlide();
    this.callbacks.onMetricIncrement('slides', 1);
  }

  public activatePowerUp(type: PowerUpType, fromInventory: boolean): void {
    if (this.mode !== 'playing') return;
    if (fromInventory) {
      if ((this.inventory[type] || 0) <= 0) return;
      this.inventory[type] -= 1;
      this.callbacks.onConsumePowerUp(type);
    }

    const lvl = this.powerUpLevels[type] || 1;
    let duration = POWERUP_INFO[type].baseDuration + (lvl - 1) * 2;
    if (type === 'hoverboard') {
      duration += this.hoverboardBonusSec;
    }

    this.activeTimers[type] = Math.max(this.activeTimers[type], duration);
    if (type === 'shield') {
      this.shieldHitsRemaining = 1;
    }
    if (type === 'rocket') {
      this.isGrounded = false;
      this.slideTimer = 0;
      this.obstacleSys.spawnAerialCoinArc(-35, this.playerLane);
    }

    const burstColor =
      type === 'invincibility'
        ? 0xfde047
        : type === 'speedBoost'
        ? 0xf59e0b
        : 0x38bdf8;
    this.bannerAlert = `${POWERUP_INFO[type].name.toUpperCase()} ACTIVATED!`;
    this.bannerTimer = 1.6;
    this.particles.burst(this.playerX, this.playerY + 1.3, this.playerZ, burstColor, 20, 5.5);
    soundEngine.playPowerUp(type);
    this.callbacks.onMetricIncrement('powerups', 1);
    this.emitHud();
  }

  private updatePlaying(dt: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Power-up timers countdown (zero-allocation static loop)
    for (let i = 0; i < POWERUP_KEYS.length; i++) {
      const k = POWERUP_KEYS[i];
      if (this.activeTimers[k] > 0) {
        this.activeTimers[k] = Math.max(0, this.activeTimers[k] - dt);
      }
    }

    // Continuous Endless 4-World Rotation (seamless transition every 120s, preserves all score/coins/timers)
    if (this.worldRotationEnabled) {
      this.worldRunElapsed += dt;
      if (this.worldRunElapsed >= WORLD_ROTATION_INTERVAL_SEC) {
        this.worldRunElapsed = 0;
        const curIdx = ROTATION_WORLD_SEQUENCE.indexOf(this.worldId);
        const nextWorld =
          curIdx >= 0
            ? ROTATION_WORLD_SEQUENCE[(curIdx + 1) % ROTATION_WORLD_SEQUENCE.length]
            : 'clouds';
        this.worldId = nextWorld;
        this.worldsVisited.add(nextWorld);
        const cfg = this.worldEnv.transitionToWorld(nextWorld);
        this.bannerAlert = `REALM SHIFT: ${cfg.name.toUpperCase()}!`;
        this.bannerTimer = 2.8;
        this.particles.burst(this.playerX, 2.1, this.playerZ - 2, 0xfacc15, 24, 6.5);
        soundEngine.playVictory();
        soundEngine.playCoinRewardClip();
        soundEngine.startMusic(nextWorld);
        this.emitHud();
      }
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
    if (this.nearMissTimer > 0) {
      this.nearMissTimer -= dt;
      if (this.nearMissTimer <= 0) this.nearMissText = null;
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerAlert = null;
    }
    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.bufferTimer <= 0) this.bufferedAction = null;
    }

    // Progressive Speed Ramp
    const difficulty = Math.min(1, this.distance / 2800 + (this.gameLevel - 1) * 0.012);
    const boostMult =
      this.activeTimers.rocket > 0
        ? 1.58
        : this.activeTimers.speedBoost > 0
        ? 1.38
        : this.activeTimers.invincibility > 0
        ? 1.18
        : 1.0;
    const targetSpeed = THREE.MathUtils.lerp(this.baseSpeed, this.maxSpeed, difficulty) * boostMult;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 4.5, dt);

    // Distance & Score
    const stepDist = this.speed * dt;
    this.distance += stepDist;
    const comboMult = 1 + Math.floor(this.comboCount / 8);
    const levelMult = Math.max(1, Math.min(8, 1 + Math.floor((this.gameLevel - 1) / 4)));
    const doubleMult = this.activeTimers.doubleCoins > 0 ? 2 : 1;
    const totalMult = Math.round((levelMult + comboMult - 1) * (1 + this.outfitScoreBonus) * doubleMult);
    this.score += stepDist * 4.5 * totalMult;

    // Check 150-Stage Milestone Target
    if (!this.levelClearedThisRun && this.distance >= this.levelTargetDistance) {
      this.levelClearedThisRun = true;
      this.victoryTimer = 1.6;
      this.bannerAlert = `STAGE ${this.gameLevel} CLEARED! KEEP RUNNING!`;
      this.bannerTimer = 2.8;
      this.particles.burst(this.playerX, 2.2, this.playerZ, 0xffd700, 32, 7.5);
      soundEngine.playVictory();
      soundEngine.playCoinRewardClip();
      this.callbacks.onLevelUpMilestone(this.gameLevel);
    }

    // Smooth Lane Switching
    const targetX = this.playerLane * LANE_WIDTH;
    const prevX = this.playerX;
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 15, dt);
    const laneTilt = THREE.MathUtils.clamp((this.playerX - prevX) / (dt * 12 + 0.0001), -1, 1);

    // Vertical Physics (Rocket vs Normal Jump/DoubleJump/Gravity)
    if (this.activeTimers.rocket > 0) {
      this.playerY = THREE.MathUtils.damp(this.playerY, 5.2, 7, dt);
      this.playerVelY = 0;
      this.isGrounded = false;
      this.jumpsUsed = 0;
      this.rocketCoinAccum += dt;
      if (this.rocketCoinAccum > 0.9) {
        this.rocketCoinAccum = 0;
        this.obstacleSys.spawnAerialCoinArc(-45, this.playerLane);
      }
    } else {
      if (!this.isGrounded) {
        if (this.jumpsUsed >= 2) {
          this.doubleJumpSpin += dt * 12.5;
        }
        this.playerVelY -= 40.5 * dt;
        this.playerY += this.playerVelY * dt;
        if (this.playerY <= 0) {
          this.playerY = 0;
          this.playerVelY = 0;
          this.isGrounded = true;
          this.jumpsUsed = 0;
          this.doubleJumpSpin = 0;
          this.squashY = 0.78;
          this.particles.burst(this.playerX, 0.14, this.playerZ + 0.35, 0xd8c3a5, 5, 2.2);
          soundEngine.playFootstep(this.worldId);
          if (this.bufferedAction === 'jump') {
            this.bufferedAction = null;
            this.triggerJump(false, false);
          } else if (this.bufferedAction === 'slide') {
            this.bufferedAction = null;
            this.triggerSlide();
          }
        }
      }
    }

    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
    }
    if (this.stumbleTimer > 0) {
      this.stumbleTimer = Math.max(0, this.stumbleTimer - dt);
    }
    if (this.victoryTimer > 0) {
      this.victoryTimer = Math.max(0, this.victoryTimer - dt);
    }

    // Squash recovery
    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 14, dt);

    // World & Obstacles Update
    this.worldEnv.update(this.totalTime, dt, this.speed, this.worldId);
    this.obstacleSys.update(dt, this.totalTime, this.speed, this.worldId, difficulty, this.playerZ);

    // Footstep Audio (dust bursts kept to actual jump landings so no bright orb appears under running heels)
    if (this.isGrounded && this.slideTimer <= 0 && this.activeTimers.hoverboard <= 0) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        soundEngine.playFootstep(this.worldId);
        this.footstepTimer = Math.max(0.15, 0.28 - (this.speed - 24) * 0.004);
      }
    }
    if (this.worldId === 'lava') {
      this.lavaAudioTimer -= dt;
      if (this.lavaAudioTimer <= 0) {
        soundEngine.playLavaAmbient();
        this.lavaAudioTimer = 1.6;
      }
    }

    // Collectibles & Magnet Attraction
    const magnetActive = this.activeTimers.magnet > 0;
    const coinDouble = this.activeTimers.doubleCoins > 0 ? 2 : 1;

    for (let i = 0; i < this.obstacleSys.collectibles.length; i++) {
      const c = this.obstacleSys.collectibles[i];
      if (c.collected) continue;

      if (magnetActive && c.kind === 'coin') {
        const dz = this.playerZ - c.z;
        const dx = this.playerX - c.x;
        const distSq = dx * dx + dz * dz;
        if (distSq < 190) {
          c.x = THREE.MathUtils.damp(c.x, this.playerX, 11, dt);
          c.y = THREE.MathUtils.damp(c.y, this.playerY + 1.1, 11, dt);
          c.z = THREE.MathUtils.damp(c.z, this.playerZ, 11, dt);
        }
      }

      const dx = Math.abs(c.x - this.playerX);
      const dy = Math.abs(c.y - (this.playerY + 1.0));
      const dz = Math.abs(c.z - this.playerZ);

      if (dx < 1.25 && dy < 1.45 && dz < 1.55) {
        c.collected = true;
        c.mesh.visible = false;

        if (c.kind === 'coin') {
          this.runCoins += coinDouble;
          this.score += 25 * totalMult;
          this.comboCount += 1;
          this.comboTimer = 2.4;
          this.particles.burst(c.x, c.y, c.z, 0xfacc15, 7, 3.2);
          soundEngine.playCoin(this.comboCount);
          if (this.comboCount > 0 && this.comboCount % 15 === 0) {
            this.bannerAlert = `COIN STREAK x${this.comboCount}! ROYAL BONUS!`;
            this.bannerTimer = 2.0;
            this.particles.burst(this.playerX, 1.8, this.playerZ, 0xfde047, 18, 5.5);
            soundEngine.playCoinRewardClip();
          }
        } else if (c.kind === 'gem') {
          this.runGems += 1;
          this.score += 150 * totalMult;
          this.particles.burst(c.x, c.y, c.z, 0xd946ef, 14, 4.5);
          soundEngine.playGem();
        } else if (c.kind === 'powerup' && c.powerUpType) {
          this.activatePowerUp(c.powerUpType, false);
        }
      }
    }

    // Obstacle Collision Detection (tightly matched to visible 3D meshes & dynamic swing/drop positions)
    const isSliding = this.slideTimer > 0;
    const playerMinY = this.playerY;
    const playerMaxY = this.playerY + (isSliding ? 1.0 : 2.25);
    const playerHalfW = 0.28;

    for (let i = 0; i < this.obstacleSys.obstacles.length; i++) {
      const o = this.obstacleSys.obstacles[i];
      let obsX = o.lane * LANE_WIDTH;
      let halfW = o.width * 0.4;
      const halfD = o.depth * 0.42;
      let obsMinY = o.minY;
      let obsMaxY = o.maxY;

      if (o.kind === 'pendulum') {
        // Compute exact world center of the swinging wrecking ball
        obsX += Math.sin(o.currentSwing) * 3.85;
        const ballY = 5.4 - Math.cos(o.currentSwing) * 3.85;
        obsMinY = Math.max(0, ballY - 0.85);
        obsMaxY = ballY + 0.85;
        halfW = 0.84;
      } else if (o.kind === 'rotating_gate') {
        halfW = Math.max(0.32, Math.abs(Math.cos(o.currentRotY)) * 1.22);
      }

      // Near-miss bonus check
      if (!o.nearMissAwarded && o.kind !== 'ramp' && o.z > this.playerZ - 1.5 && o.z < this.playerZ + 1.5) {
        if (Math.abs(obsX - this.playerX) > halfW && Math.abs(obsX - this.playerX) < 3.45 && this.playerY < 2.2) {
          o.nearMissAwarded = true;
          this.score += 120 * totalMult;
          this.nearMissText = `CLOSE DODGE! +${120 * totalMult}`;
          this.nearMissTimer = 1.1;
        }
      }

      if (Math.abs(obsX - this.playerX) < halfW + playerHalfW && Math.abs(o.z - this.playerZ) < halfD + 0.38) {
        if (o.kind === 'ramp') {
          if (this.playerY < 1.2 && this.playerVelY <= 0) {
            this.triggerJump(true);
            this.nearMissText = 'SPEED RAMP BOOST!';
            this.nearMissTimer = 1.2;
          }
          continue;
        }

        // Fair vertical clearance with slight margin so edge grazing never feels unfair
        const hit = playerMinY < obsMaxY - 0.12 && playerMaxY > obsMinY + 0.08;

        if (hit && this.activeTimers.rocket <= 0) {
          // Royal Invincibility or Speed Boost crate smash
          if (
            this.activeTimers.invincibility > 0 ||
            (this.activeTimers.speedBoost > 0 && o.kind === 'crate')
          ) {
            o.mesh.visible = false;
            o.z = 999;
            this.shakeIntensity = 0.2;
            this.score += 150 * totalMult;
            this.nearMissText = `SMASH! +${150 * totalMult}`;
            this.nearMissTimer = 0.9;
            this.particles.burst(obsX, 1.3, this.playerZ, 0xfde047, 24, 7.5);
            soundEngine.playCollision(true);
            continue;
          }

          if (this.invulnTimer <= 0) {
            // Check Shield or Hoverboard crash protection!
            if (this.shieldHitsRemaining > 0 || this.activeTimers.shield > 0) {
              this.shieldHitsRemaining = 0;
              this.activeTimers.shield = 0;
              this.invulnTimer = 1.8;
              this.stumbleTimer = 0.45;
              this.hitstopTimer = 0.045;
              this.shakeIntensity = 0.24;
              this.obstacleSys.clearNearbyObstacles(this.playerZ, 16);
              this.particles.burst(this.playerX, 1.3, this.playerZ, 0x38bdf8, 26, 7);
              this.bannerAlert = 'SHIELD ABSORBED IMPACT!';
              this.bannerTimer = 1.6;
              soundEngine.playCollision(true);
              break;
            } else if (this.activeTimers.hoverboard > 0) {
              this.activeTimers.hoverboard = 0;
              this.invulnTimer = 1.8;
              this.stumbleTimer = 0.45;
              this.hitstopTimer = 0.045;
              this.shakeIntensity = 0.24;
              this.obstacleSys.clearNearbyObstacles(this.playerZ, 16);
              this.particles.burst(this.playerX, 1.1, this.playerZ, 0x06b6d4, 26, 7);
              this.bannerAlert = 'HOVERBOARD SAVED YOU!';
              this.bannerTimer = 1.6;
              soundEngine.playCollision(true);
              break;
            } else {
              // Game Over Collision!
              this.handleCrash(o.kind);
              return;
            }
          }
        }
      }
    }

    // Update Shera Transform, Visual Accessories & Animation
    this.shera.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.shera.root.visible = true;

    this.shera.hoverboardGroup.visible = this.activeTimers.hoverboard > 0 && this.activeTimers.rocket <= 0;
    this.shera.shieldMesh.visible = this.activeTimers.shield > 0 || this.shieldHitsRemaining > 0 || this.invulnTimer > 0;
    if (this.shera.shieldMesh.visible) {
      this.shera.shieldMesh.rotation.y = this.totalTime * 2.2;
    }
    this.shera.rocketGroup.visible = this.activeTimers.rocket > 0;
    this.shera.magnetHalo.visible = this.activeTimers.magnet > 0;
    if (this.shera.magnetHalo.visible) {
      this.shera.magnetHalo.rotation.z = this.totalTime * 4;
    }
    this.shera.invincibleAura.visible = this.activeTimers.invincibility > 0;
    if (this.shera.invincibleAura.visible) {
      this.shera.invincibleAura.rotation.y = this.totalTime * 3.4;
      this.shera.invincibleAura.rotation.x = Math.sin(this.totalTime * 2.2) * 0.4;
    }

    // Ground Contact Shadow
    this.contactShadow.position.set(this.playerX, 0.025, this.playerZ);
    const shadowScale = Math.max(0.35, 1 - this.playerY * 0.12);
    this.contactShadow.scale.setScalar(shadowScale * 1.05);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.72 * shadowScale;

    let animState: SheraAnimState = 'run';
    if (this.activeTimers.rocket > 0) animState = 'rocket';
    else if (this.stumbleTimer > 0) animState = 'stumble';
    else if (this.activeTimers.hoverboard > 0) animState = 'hoverboard';
    else if (!this.isGrounded) animState = this.jumpsUsed >= 2 ? 'doubleJump' : 'jump';
    else if (this.slideTimer > 0) animState = 'slide';
    else if (this.victoryTimer > 0) animState = 'victory';
    else if (this.activeTimers.speedBoost > 0 || this.activeTimers.invincibility > 0) animState = 'speedBoost';

    this.shera.updateAnimation(
      animState,
      this.totalTime,
      dt,
      this.speed,
      laneTilt,
      this.squashY,
      this.doubleJumpSpin
    );

    // Balanced Third-Person Chase Camera (~30% screen coverage, full silhouette & unobstructed view ahead)
    const targetFov =
      this.activeTimers.rocket > 0 || this.activeTimers.speedBoost > 0 ? 63 : 57;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.8);
    }
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    _camTargetPos.set(this.playerX * 0.68 + shakeX, 3.45 + this.playerY * 0.44 + shakeY, 6.65);
    this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-8.5 * dt));
    _camLookAt.set(this.playerX * 0.44, 1.52 + this.playerY * 0.36, -15.5);
    this.camera.lookAt(_camLookAt);
  }

  private handleCrash(kind: string): void {
    this.mode = 'gameover';
    this.shakeIntensity = 0.32;
    this.shera.root.visible = true;
    this.shera.hoverboardGroup.visible = false;
    this.shera.rocketGroup.visible = false;
    this.shera.shieldMesh.visible = false;
    this.shera.magnetHalo.visible = false;
    this.shera.invincibleAura.visible = false;
    this.particles.burst(this.playerX, this.playerY + 1.2, this.playerZ, 0xf97316, 30, 8);
    soundEngine.playCollision(false);

    const lvlDef = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, this.gameLevel - 1))];
    const xpEarned = Math.round(this.distance * 0.28 + this.runCoins * 1.5 + (this.levelClearedThisRun ? lvlDef.rewardXp : 0));

    const labels: Record<string, string> = {
      train: 'Struck by the Royal Express!',
      pendulum: 'Hit by a Molten Wrecking Ball!',
      spikes: 'Stepped into Floor Spikes!',
      barrier_high: 'Clipped an Overhead Gate!',
      barrier_low: 'Tripped on a Roadblock!',
      crate: 'Crashed into a Lion Crate!',
      roller: 'Hit a Spiked Roller!',
      rotating_gate: 'Struck by a Rotating Barrier!',
      falling_rock: 'Crushed by a Falling Boulder!',
      collapsing_bridge: 'Stumbled on a Collapsing Span!',
      flying_dragon: 'Struck by a Swooping Wyvern!',
    };

    this.emitHud();
    this.callbacks.onGameOver({
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      coins: this.runCoins,
      gems: this.runGems,
      xpEarned,
      isNewBest: false,
      levelCleared: this.levelClearedThisRun,
      clearedLevelNumber: this.gameLevel,
      worldId: this.worldId,
      worldsVisited: Array.from(this.worldsVisited),
      revivedCount: this.revivedCount,
      adRevivedCount: this.adRevivedCount,
      coinRevivedCount: this.coinRevivedCount,
      reason: labels[kind] || 'Obstacle Collision!',
    });
  }

  private getNextRotationWorldId(): WorldId | null {
    if (!this.worldRotationEnabled) return null;
    const idx = ROTATION_WORLD_SEQUENCE.indexOf(this.worldId);
    return idx >= 0
      ? ROTATION_WORLD_SEQUENCE[(idx + 1) % ROTATION_WORLD_SEQUENCE.length]
      : 'clouds';
  }

  private emitHud(): void {
    const comboMult = 1 + Math.floor(this.comboCount / 8);
    const levelMult = Math.max(1, Math.min(8, 1 + Math.floor((this.gameLevel - 1) / 4)));
    const doubleMult = this.activeTimers.doubleCoins > 0 ? 2 : 1;
    const multiplier = Math.round((levelMult + comboMult - 1) * (1 + this.outfitScoreBonus) * doubleMult);

    this.callbacks.onHudUpdate({
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      runCoins: this.runCoins,
      runGems: this.runGems,
      multiplier,
      comboCount: this.comboCount,
      speed: Math.round(this.speed),
      gameLevel: this.gameLevel,
      levelProgress: Math.min(1, this.distance / Math.max(1, this.levelTargetDistance)),
      worldId: this.worldId,
      nextWorldId: this.getNextRotationWorldId(),
      worldRotationSecondsRemaining: this.worldRotationEnabled
        ? Math.max(0, Math.ceil(WORLD_ROTATION_INTERVAL_SEC - this.worldRunElapsed))
        : null,
      activeTimers: { ...this.activeTimers },
      inventory: { ...this.inventory },
      shieldHitsRemaining: this.shieldHitsRemaining,
      nearMissText: this.nearMissText,
      bannerAlert: this.bannerAlert,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed || this.isBackgrounded) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tickFn = (): void => {
    if (this.disposed || this.isBackgrounded) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.totalTime += dt;

    if (this.mode === 'home') {
      this.worldEnv.update(this.totalTime, dt, 3.2, this.worldId);
      this.shera.updateAnimation('throne', this.totalTime, dt, 0, 0, 1);
      const { y, z, lookY } = this.getHomeCameraDistance();
      this.camera.position.set(
        Math.sin(this.totalTime * 0.45) * 0.24,
        y + Math.sin(this.totalTime * 0.6) * 0.05,
        z
      );
      this.camera.lookAt(0, lookY, -0.35);
    } else if (this.mode === 'playing') {
      this.updatePlaying(dt);
      this.particles.update(dt);
      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.065) {
        this.hudSyncAccum = 0;
        this.emitHud();
      }
    } else if (this.mode === 'gameover') {
      this.particles.update(dt);
      this.shera.updateAnimation('collide', this.totalTime, dt, 0, 0, 1);
    }

    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextTick();
  };

  private scheduleNextTick(): void {
    if (this.disposed || this.isBackgrounded) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tickFn);
    } else {
      this.frameId = requestAnimationFrame(this.tickFn);
    }
  }

  private startLoop(): void {
    this.scheduleNextTick();
  }

  public dispose(): void {
    this.disposed = true;
    soundEngine.stopRewardClip();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.shera.dispose();
    this.throne.dispose();
    this.worldEnv.dispose();
    this.obstacleSys.dispose();
    this.particles.dispose();
    this.textures.dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.Material).dispose();
    this.envMap.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
