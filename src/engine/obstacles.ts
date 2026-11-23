import * as THREE from 'three';
import { ObstacleKind, PowerUpType, WorldId } from '../types/game';
import { ProceduralTextureSet } from './textures';
import { LANE_WIDTH } from './worlds';

export interface ActiveObstacle {
  id: number;
  kind: ObstacleKind;
  lane: number;
  z: number;
  y: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  depth: number;
  speedOffset: number;
  passed: boolean;
  nearMissAwarded: boolean;
  mesh: THREE.Group;
  phase: number;
  currentSwing: number;
  currentRotY: number;
  currentBoulderY: number;
  hornPlayed?: boolean;
}

export interface ActiveCollectible {
  id: number;
  kind: 'coin' | 'gem' | 'powerup';
  powerUpType?: PowerUpType;
  lane: number;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  mesh: THREE.Group;
}

export interface ObstacleSystem {
  group: THREE.Group;
  obstacles: ActiveObstacle[];
  collectibles: ActiveCollectible[];
  reset: () => void;
  update: (
    dt: number,
    time: number,
    speed: number,
    worldId: WorldId,
    difficulty: number,
    playerZ: number
  ) => void;
  spawnAerialCoinArc: (startZ: number, lane: number) => void;
  clearNearbyObstacles: (centerZ: number, radius: number) => void;
  dispose: () => void;
}

const POWERUP_COLORS: Record<PowerUpType, number> = {
  magnet: 0xef4444,
  shield: 0x3b82f6,
  rocket: 0xf97316,
  speedBoost: 0xfbbf24,
  doubleCoins: 0xeab308,
  invincibility: 0xf43f5e,
  hoverboard: 0x06b6d4,
  superJump: 0xa855f7,
};

export function createObstacleSystem(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  onTrainApproach: () => void
): ObstacleSystem {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const group = new THREE.Group();
  scene.add(group);

  const crateGeo = trackGeo(new THREE.BoxGeometry(1.74, 1.54, 1.74));
  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.crateTexture, roughness: 0.58, metalness: 0.08 })
  );

  const barrierBarGeo = trackGeo(new THREE.BoxGeometry(2.45, 0.54, 0.44));
  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.barrierTexture, roughness: 0.44, metalness: 0.1 })
  );
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 10));
  const metalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.82, roughness: 0.25 }));
  const goldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf8c02c,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.55,
      envMapIntensity: 1.15,
    })
  );
  const spikeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.18 }));
  const magmaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.lavaFlowTexture,
      color: 0x3b1812,
      emissive: 0xff4d00,
      emissiveMap: textures.lavaFlowTexture,
      emissiveIntensity: 1.25,
      roughness: 0.55,
    })
  );
  const rampGeo = trackGeo(new THREE.BoxGeometry(2.35, 0.36, 3.6));
  const rampMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.rampTexture,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.5,
      roughness: 0.28,
    })
  );

  // Sculpted Golden Lion Coins (inner embossed disc + raised beveled torus rim) & Gems
  const coinDiscGeo = trackGeo(new THREE.CylinderGeometry(0.47, 0.47, 0.11, 22));
  const coinRimGeo = trackGeo(new THREE.TorusGeometry(0.48, 0.065, 10, 24));
  const coinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.coinTexture,
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 0.6,
      emissive: 0x92400e,
      emissiveIntensity: 0.18,
      envMapIntensity: 1.2,
    })
  );
  const coinRimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfde047,
      metalness: 0.94,
      roughness: 0.12,
      clearcoat: 0.7,
      envMapIntensity: 1.25,
    })
  );
  const gemGeo = trackGeo(new THREE.OctahedronGeometry(0.48, 0));
  const gemMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe879f9,
      emissive: 0x86198f,
      emissiveIntensity: 0.52,
      metalness: 0.18,
      roughness: 0.08,
      clearcoat: 1.0,
      envMapIntensity: 1.1,
    })
  );

  // Train Materials (Crimson Royal Express + Frost-Blue Ice Express)
  const trainRedMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xc81e1e, roughness: 0.28, metalness: 0.42, clearcoat: 0.5 })
  );
  const trainFrostMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0x0284c7, roughness: 0.18, metalness: 0.65, clearcoat: 0.75 })
  );
  const trainCreamMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48 }));
  const trainDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52, metalness: 0.48 }));
  const windowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xd97706, emissiveIntensity: 0.6, roughness: 0.15 })
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfacc15, emissiveIntensity: 1.25 })
  );
  const wyvernMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.42, metalness: 0.28 })
  );

  let nextId = 1;
  let nextSpawnZ = -52;
  let lastSafeLane = 0;
  const obstacles: ActiveObstacle[] = [];
  const collectibles: ActiveCollectible[] = [];

  const obsPool = new Map<ObstacleKind, THREE.Group[]>();
  const coinPool: THREE.Group[] = [];
  const gemPool: THREE.Group[] = [];
  const powerUpPool = new Map<PowerUpType, THREE.Group[]>();

  const powerUpCoreGeo = trackGeo(new THREE.OctahedronGeometry(0.56, 0));
  const powerUpRingGeo = trackGeo(new THREE.TorusGeometry(0.78, 0.085, 8, 24));
  const powerUpMaterials = {} as Record<PowerUpType, THREE.MeshStandardMaterial>;
  (Object.keys(POWERUP_COLORS) as PowerUpType[]).forEach((pKey) => {
    const col = POWERUP_COLORS[pKey];
    powerUpMaterials[pKey] = trackMat(
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 1.2,
        roughness: 0.18,
        metalness: 0.35,
      })
    );
  });

  const obsShadowGeo = trackGeo(new THREE.PlaneGeometry(2.55, 2.15));
  const obsShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.shadowTexture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );

  function addContactPad(g: THREE.Group, sx = 1, sz = 1): void {
    const pad = new THREE.Mesh(obsShadowGeo, obsShadowMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.018;
    pad.scale.set(sx, sz, 1);
    g.add(pad);
  }

  function buildObstacleMesh(kind: ObstacleKind): THREE.Group {
    const g = new THREE.Group();

    if (kind === 'crate') {
      addContactPad(g, 0.92, 1.0);
      const m = new THREE.Mesh(crateGeo, crateMat);
      m.position.y = 0.77;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      const topTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.86, 0.14, 1.86)), goldMat);
      topTrim.position.y = 1.54;
      g.add(topTrim);
      const baseTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.84, 0.12, 1.84)), goldMat);
      baseTrim.position.y = 0.06;
      g.add(baseTrim);
    } else if (kind === 'barrier_low') {
      addContactPad(g, 1.05, 0.6);
      const bar = new THREE.Mesh(barrierBarGeo, barrierMat);
      bar.position.y = 0.84;
      bar.castShadow = true;
      g.add(bar);
      [-1.02, 1.02].forEach((lx) => {
        const leg = new THREE.Mesh(legGeo, goldMat);
        leg.position.set(lx, 0.55, 0);
        leg.castShadow = true;
        g.add(leg);
        const foot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.1, 0.48)), metalMat);
        foot.position.set(lx, 0.05, 0);
        g.add(foot);
      });
    } else if (kind === 'barrier_high') {
      addContactPad(g, 1.15, 0.65);
      // Positioned so bottom is cleanly at y=1.58m (sliding clears with wide visual gap!)
      const topBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.92, 0.52)), barrierMat);
      topBar.position.y = 2.04;
      topBar.castShadow = true;
      g.add(topBar);
      const topCrest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.74, 0.16, 0.62)), goldMat);
      topCrest.position.y = 2.54;
      g.add(topCrest);
      [-1.24, 1.24].forEach((lx) => {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 2.58, 10)), goldMat);
        post.position.set(lx, 1.29, 0);
        post.castShadow = true;
        g.add(post);
      });
    } else if (kind === 'roller') {
      addContactPad(g, 1.05, 0.85);
      const rollerPivot = new THREE.Group();
      rollerPivot.position.y = 0.62;
      g.add(rollerPivot);

      const drum = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 16)), metalMat);
      drum.rotation.z = Math.PI / 2;
      drum.castShadow = true;
      rollerPivot.add(drum);

      [-1.12, 1.12].forEach((cx) => {
        const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.64, 0.64, 0.14, 16)), goldMat);
        cap.rotation.z = Math.PI / 2;
        cap.position.x = cx;
        rollerPivot.add(cap);
      });

      const spikeGeo = trackGeo(new THREE.ConeGeometry(0.14, 0.36, 6));
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        [-0.62, 0, 0.62].forEach((sx) => {
          const sp = new THREE.Mesh(spikeGeo, spikeMat);
          sp.position.set(sx, Math.sin(ang) * 0.62, Math.cos(ang) * 0.62);
          sp.rotation.x = Math.PI / 2 - ang;
          rollerPivot.add(sp);
        });
      }
      g.userData.spinTarget = rollerPivot;
    } else if (kind === 'spikes') {
      addContactPad(g, 1.0, 0.95);
      const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.42, 0.18, 1.98)), metalMat);
      base.position.y = 0.09;
      g.add(base);
      const spGeo = trackGeo(new THREE.ConeGeometry(0.19, 0.76, 8));
      [-0.78, 0, 0.78].forEach((sx) => {
        [-0.5, 0.5].forEach((sz) => {
          const sp = new THREE.Mesh(spGeo, spikeMat);
          sp.position.set(sx, 0.47, sz);
          sp.castShadow = true;
          g.add(sp);
        });
      });
    } else if (kind === 'pendulum') {
      const pivot = new THREE.Group();
      pivot.position.y = 5.4;
      const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 3.8, 8)), metalMat);
      chain.position.y = -1.9;
      pivot.add(chain);
      const ball = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.92, 16, 14)), magmaMat);
      ball.position.y = -3.85;
      ball.castShadow = true;
      pivot.add(ball);
      const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.92, 0.08, 8, 18)), goldMat);
      ring.position.y = -3.85;
      pivot.add(ring);
      g.add(pivot);
      g.userData.swingPivot = pivot;
    } else if (kind === 'rotating_gate') {
      addContactPad(g, 0.85, 0.65);
      const centerPost = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 1.55, 10)), goldMat);
      centerPost.position.y = 0.77;
      g.add(centerPost);
      const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.65, 0.34, 0.34)), barrierMat);
      arm.position.y = 1.05;
      arm.castShadow = true;
      g.add(arm);
      g.userData.spinTarget = arm;
    } else if (kind === 'falling_rock') {
      const boulder = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(1.02, 1)), magmaMat);
      boulder.position.y = 1.02;
      boulder.castShadow = true;
      g.add(boulder);
      g.userData.boulder = boulder;
    } else if (kind === 'collapsing_bridge') {
      const slab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.75, 0.34, 3.0)), magmaMat);
      slab.position.y = 0.1;
      g.add(slab);
      const crackTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 0.1, 3.06)), goldMat);
      crackTrim.position.y = 0.24;
      g.add(crackTrim);
      g.userData.slab = slab;
    } else if (kind === 'flying_dragon') {
      // Positioned cleanly at y=2.02m so sliding underneath avoids reliably!
      const wyvern = new THREE.Group();
      wyvern.position.y = 2.02;
      const wBody = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.42, 2.2, 8)), wyvernMat);
      wBody.rotation.x = Math.PI / 2;
      wBody.castShadow = true;
      wyvern.add(wBody);
      const wingL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 0.08, 0.72)), wyvernMat);
      wingL.position.set(-0.82, 0.1, 0);
      wyvern.add(wingL);
      const wingR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 0.08, 0.72)), wyvernMat);
      wingR.position.set(0.82, 0.1, 0);
      wyvern.add(wingR);
      const eyeGlow = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 8, 8)), headlightMat);
      eyeGlow.position.set(0, 0.1, 1.0);
      wyvern.add(eyeGlow);
      g.add(wyvern);
      g.userData.wyvern = wyvern;
      g.userData.wingL = wingL;
      g.userData.wingR = wingR;
    } else if (kind === 'ramp') {
      addContactPad(g, 1.0, 1.65);
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      ramp.position.set(0, 0.62, 0);
      ramp.rotation.x = 0.32;
      ramp.receiveShadow = true;
      g.add(ramp);
    } else if (kind === 'train') {
      const bodyParts: THREE.Mesh[] = [];
      const loco = new THREE.Group();
      const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.64, 0.72, 8.2)), trainDarkMat);
      chassis.position.y = 0.6;
      loco.add(chassis);

      const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.54, 2.15, 7.8)), trainRedMat);
      body.position.y = 1.98;
      body.castShadow = true;
      loco.add(body);
      bodyParts.push(body);

      const cabUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.48, 0.88, 6.4)), trainCreamMat);
      cabUpper.position.set(0, 2.38, -0.3);
      loco.add(cabUpper);

      const roof = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.22, 1.38, 7.6, 12)), trainDarkMat);
      roof.rotation.x = Math.PI / 2;
      roof.scale.set(1, 1, 0.38);
      roof.position.y = 3.18;
      loco.add(roof);

      const goldBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.16, 7.85)), goldMat);
      goldBand.position.y = 1.55;
      loco.add(goldBand);

      const cowcatcher = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.4, 1.28, 1.05, 4)), goldMat);
      cowcatcher.rotation.y = Math.PI / 4;
      cowcatcher.rotation.x = 0.4;
      cowcatcher.position.set(0, 0.58, 4.18);
      loco.add(cowcatcher);

      const lionMane = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.68, 14, 12)), goldMat);
      lionMane.position.set(0, 1.8, 4.02);
      lionMane.scale.set(1.12, 1.12, 0.45);
      loco.add(lionMane);

      const lionFace = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 12, 10)), goldMat);
      lionFace.position.set(0, 1.8, 4.22);
      loco.add(lionFace);

      const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.95, 0.65, 0.1)), windowMat);
      windshield.position.set(0, 2.6, 3.92);
      loco.add(windshield);

      [-0.78, 0.78].forEach((hx) => {
        const hl = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.25, 10, 10)), headlightMat);
        hl.position.set(hx, 1.35, 4.02);
        loco.add(hl);
      });
      const topLight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.3, 10, 10)), headlightMat);
      topLight.position.set(0, 3.4, 3.72);
      loco.add(topLight);

      g.add(loco);

      for (let c = 1; c <= 2; c++) {
        const carZ = -c * 8.6;
        const car = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.5, 2.55, 7.8)), trainRedMat);
        car.position.set(0, 1.88, carZ);
        car.castShadow = true;
        g.add(car);
        bodyParts.push(car);

        const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.56, 0.78, 7.84)), trainCreamMat);
        stripe.position.set(0, 2.18, carZ);
        g.add(stripe);

        const winBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.58, 0.48, 6.6)), windowMat);
        winBand.position.set(0, 2.22, carZ);
        g.add(winBand);

        const carRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.34, 0.36, 7.7)), trainDarkMat);
        carRoof.position.set(0, 3.28, carZ);
        g.add(carRoof);
      }
      g.userData.trainBodies = bodyParts;
    }

    return g;
  }

  function acquireObstacleMesh(kind: ObstacleKind): THREE.Group {
    const list = obsPool.get(kind);
    if (list && list.length > 0) {
      const m = list.pop()!;
      m.visible = true;
      return m;
    }
    const fresh = buildObstacleMesh(kind);
    group.add(fresh);
    return fresh;
  }

  function releaseObstacleMesh(kind: ObstacleKind, mesh: THREE.Group): void {
    mesh.visible = false;
    if (!obsPool.has(kind)) obsPool.set(kind, []);
    obsPool.get(kind)!.push(mesh);
  }

  function acquireCoinMesh(): THREE.Group {
    if (coinPool.length > 0) {
      const m = coinPool.pop()!;
      m.visible = true;
      return m;
    }
    const g = new THREE.Group();
    const disc = new THREE.Mesh(coinDiscGeo, coinMat);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    g.add(disc);
    const rim = new THREE.Mesh(coinRimGeo, coinRimMat);
    g.add(rim);
    group.add(g);
    return g;
  }

  function acquireGemMesh(): THREE.Group {
    if (gemPool.length > 0) {
      const m = gemPool.pop()!;
      m.visible = true;
      return m;
    }
    const g = new THREE.Group();
    const m = new THREE.Mesh(gemGeo, gemMat);
    m.scale.set(0.95, 1.38, 0.95);
    g.add(m);
    group.add(g);
    return g;
  }

  function acquirePowerUpMesh(type: PowerUpType): THREE.Group {
    const list = powerUpPool.get(type);
    if (list && list.length > 0) {
      const m = list.pop()!;
      m.visible = true;
      return m;
    }
    const g = new THREE.Group();
    const core = new THREE.Mesh(powerUpCoreGeo, powerUpMaterials[type]);
    g.add(core);
    const ring = new THREE.Mesh(powerUpRingGeo, goldMat);
    ring.rotation.x = Math.PI / 3;
    g.add(ring);
    group.add(g);
    return g;
  }

  function releasePowerUpMesh(type: PowerUpType | undefined, mesh: THREE.Group): void {
    mesh.visible = false;
    if (!type) {
      group.remove(mesh);
      return;
    }
    if (!powerUpPool.has(type)) powerUpPool.set(type, []);
    powerUpPool.get(type)!.push(mesh);
  }

  function spawnObstacle(kind: ObstacleKind, lane: number, z: number, worldId: WorldId): void {
    const mesh = acquireObstacleMesh(kind);
    mesh.position.set(lane * LANE_WIDTH, 0, z);

    if (kind === 'train' && Array.isArray(mesh.userData.trainBodies)) {
      const mat = worldId === 'frozen' ? trainFrostMat : trainRedMat;
      (mesh.userData.trainBodies as THREE.Mesh[]).forEach((bm) => {
        bm.material = mat;
      });
    }

    let width = 1.75;
    let height = 1.54;
    let minY = 0;
    let maxY = 1.54;
    let depth = 1.75;
    let speedOffset = 0;

    if (kind === 'barrier_low') {
      width = 2.25;
      height = 1.12;
      minY = 0;
      maxY = 1.12;
      depth = 0.65;
    } else if (kind === 'barrier_high') {
      width = 2.38;
      height = 2.58;
      minY = 1.48;
      maxY = 2.6;
      depth = 0.85;
    } else if (kind === 'flying_dragon') {
      width = 2.3;
      height = 2.52;
      minY = 1.52;
      maxY = 2.52;
      depth = 1.25;
      speedOffset = 8;
    } else if (kind === 'roller') {
      width = 2.15;
      height = 1.24;
      minY = 0;
      maxY = 1.24;
      depth = 1.22;
    } else if (kind === 'spikes') {
      width = 2.12;
      height = 0.85;
      minY = 0;
      maxY = 0.85;
      depth = 1.8;
    } else if (kind === 'pendulum') {
      width = 1.8;
      height = 2.55;
      minY = 0.6;
      maxY = 2.5;
      depth = 1.8;
    } else if (kind === 'rotating_gate') {
      width = 2.45;
      height = 1.28;
      minY = 0;
      maxY = 1.28;
      depth = 0.65;
    } else if (kind === 'falling_rock') {
      width = 1.9;
      height = 2.02;
      minY = 0;
      maxY = 2.02;
      depth = 1.9;
    } else if (kind === 'collapsing_bridge') {
      // Exact visual height of slab (previous height=1.5 caused invisible mid-air collisions!)
      width = 2.55;
      height = 0.36;
      minY = 0;
      maxY = 0.36;
      depth = 2.85;
    } else if (kind === 'ramp') {
      width = 2.3;
      height = 1.2;
      minY = 0;
      maxY = 1.2;
      depth = 3.6;
    } else if (kind === 'train') {
      width = 2.42;
      height = 3.32;
      minY = 0;
      maxY = 3.32;
      depth = 24.5;
      speedOffset = 18;
    }

    obstacles.push({
      id: nextId++,
      kind,
      lane,
      z,
      y: 0,
      minY,
      maxY,
      width,
      height,
      depth,
      speedOffset,
      passed: false,
      nearMissAwarded: false,
      mesh,
      phase: Math.random() * Math.PI * 2,
      currentSwing: 0,
      currentRotY: 0,
      currentBoulderY: 1.02,
    });
  }

  function spawnCoinLine(lane: number, startZ: number, count: number, arcHeight = 0): void {
    for (let i = 0; i < count; i++) {
      const z = startZ - i * 2.5;
      const t = count > 1 ? i / (count - 1) : 0;
      const y = 1.05 + Math.sin(t * Math.PI) * arcHeight;
      const mesh = acquireCoinMesh();
      mesh.position.set(lane * LANE_WIDTH, y, z);
      collectibles.push({
        id: nextId++,
        kind: 'coin',
        lane,
        x: lane * LANE_WIDTH,
        y,
        z,
        collected: false,
        mesh,
      });
    }
  }

  function spawnGem(lane: number, z: number, y = 1.35): void {
    const mesh = acquireGemMesh();
    mesh.position.set(lane * LANE_WIDTH, y, z);
    collectibles.push({
      id: nextId++,
      kind: 'gem',
      lane,
      x: lane * LANE_WIDTH,
      y,
      z,
      collected: false,
      mesh,
    });
  }

  function spawnPowerUp(lane: number, z: number): void {
    const types: PowerUpType[] = [
      'magnet',
      'shield',
      'rocket',
      'speedBoost',
      'doubleCoins',
      'invincibility',
      'hoverboard',
      'superJump',
    ];
    const pType = types[Math.floor(Math.random() * types.length)];
    const mesh = acquirePowerUpMesh(pType);
    mesh.position.set(lane * LANE_WIDTH, 1.35, z);
    collectibles.push({
      id: nextId++,
      kind: 'powerup',
      powerUpType: pType,
      lane,
      x: lane * LANE_WIDTH,
      y: 1.35,
      z,
      collected: false,
      mesh,
    });
  }

  /**
   * Projects whether a lane will have a moving obstacle (train) overlapping
   * `[targetZ - margin, targetZ + margin]` when the pattern reaches the player!
   */
  function getLaneThreatenedByTrain(targetZ: number, speed: number): Set<number> {
    const threatened = new Set<number>();
    const arrivalTime = Math.max(0.1, -targetZ / Math.max(12, speed));
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.kind !== 'train') continue;
      // Check current span AND projected span when targetZ arrives at playerZ=0
      const projCenter = o.z + (speed + o.speedOffset) * arrivalTime;
      const halfSpan = o.depth * 0.5 + 10;
      if (Math.abs(projCenter) < halfSpan || Math.abs(o.z - targetZ) < halfSpan + 12) {
        threatened.add(o.lane);
      }
    }
    return threatened;
  }

  function spawnPattern(z: number, worldId: WorldId, difficulty: number, speed: number): void {
    const lanes = [-1, 0, 1];
    const trainThreatLanes = getLaneThreatenedByTrain(z, speed);
    const openCandidates = lanes.filter((l) => !trainThreatLanes.has(l));
    const reachableCandidates = openCandidates.filter((l) => Math.abs(l - lastSafeLane) <= 1);
    const safePool =
      reachableCandidates.length > 0
        ? reachableCandidates
        : openCandidates.length > 0
        ? openCandidates
        : lanes;
    const safeLane = safePool[Math.floor(Math.random() * safePool.length)];
    lastSafeLane = safeLane;
    const otherLanes = lanes.filter((l) => l !== safeLane);

    const worldPool: Record<WorldId, ObstacleKind[]> = {
      clouds: ['crate', 'barrier_low', 'barrier_high', 'roller', 'rotating_gate', 'ramp'],
      lava: ['crate', 'spikes', 'pendulum', 'falling_rock', 'collapsing_bridge', 'barrier_high', 'ramp'],
      crystal: ['crate', 'barrier_low', 'barrier_high', 'roller', 'ramp'],
      dragon: ['flying_dragon', 'crate', 'barrier_low', 'barrier_high', 'rotating_gate', 'collapsing_bridge', 'ramp'],
      frozen: ['crate', 'barrier_low', 'roller', 'rotating_gate', 'ramp'],
    };
    const pool = worldPool[worldId];

    // Moving Royal Express Trains in Crystal Forest & Frost Express in Frozen Kingdom
    // Never spawn a second overlapping train corridor if another train already occupies a lane nearby.
    if ((worldId === 'crystal' || worldId === 'frozen') && trainThreatLanes.size === 0 && Math.random() < 0.42) {
      const trainLane = otherLanes[0];
      spawnObstacle('train', trainLane, z - 16, worldId);
      // Leave safeLane 100% open & readable beside the train
      if (Math.random() < 0.35 + difficulty * 0.2) {
        spawnObstacle('barrier_low', otherLanes[1], z, worldId);
      }
      spawnCoinLine(safeLane, z + 2, 6, 0);
      return;
    }

    // If a train is already roaring through another lane, keep safeLane 100% clear
    const maxBlock = trainThreatLanes.size > 0 ? 1 : 2;
    const blockBothOther = maxBlock === 2 && Math.random() < 0.38 + difficulty * 0.32;
    const lanesToFill = blockBothOther
      ? otherLanes
      : [otherLanes[Math.floor(Math.random() * otherLanes.length)]];

    let hasAdjacentPendulum = false;
    lanesToFill.forEach((ln) => {
      if (trainThreatLanes.has(ln)) return;
      const kind = pool[Math.floor(Math.random() * pool.length)];
      if (kind === 'pendulum' && Math.abs(ln - safeLane) === 1) {
        hasAdjacentPendulum = true;
      }
      spawnObstacle(kind, ln, z, worldId);
      if (kind === 'ramp') {
        spawnCoinLine(ln, z - 4, 5, 3.2);
      }
    });

    // Safe lane either stays unobstructed OR has a clean single jumpable/slideable skill obstacle
    // (never add a safe-lane hazard if a train OR adjacent pendulum could overlap timing)
    if (trainThreatLanes.size === 0 && !hasAdjacentPendulum && Math.random() < 0.32) {
      const actionKind: ObstacleKind =
        worldId === 'dragon' && Math.random() < 0.5
          ? 'flying_dragon'
          : Math.random() < 0.55
          ? 'barrier_low'
          : 'barrier_high';
      spawnObstacle(actionKind, safeLane, z, worldId);
      spawnCoinLine(safeLane, z + 3, 5, actionKind === 'barrier_low' ? 2.4 : 0);
    } else {
      spawnCoinLine(safeLane, z + 2, 5, 0);
    }

    const roll = Math.random();
    if (roll < 0.16) {
      spawnPowerUp(safeLane, z - 12);
    } else if (roll < 0.34) {
      spawnGem(safeLane, z - 12);
    }
  }

  function spawnAerialCoinArc(startZ: number, lane: number): void {
    for (let i = 0; i < 8; i++) {
      const z = startZ - i * 3.0;
      const mesh = acquireCoinMesh();
      mesh.position.set(lane * LANE_WIDTH, 6.2, z);
      collectibles.push({
        id: nextId++,
        kind: 'coin',
        lane,
        x: lane * LANE_WIDTH,
        y: 6.2,
        z,
        collected: false,
        mesh,
      });
    }
  }

  function reset(): void {
    while (obstacles.length > 0) {
      const o = obstacles.pop()!;
      releaseObstacleMesh(o.kind, o.mesh);
    }
    while (collectibles.length > 0) {
      const c = collectibles.pop()!;
      if (c.kind === 'coin') {
        c.mesh.visible = false;
        coinPool.push(c.mesh);
      } else if (c.kind === 'gem') {
        c.mesh.visible = false;
        gemPool.push(c.mesh);
      } else {
        releasePowerUpMesh(c.powerUpType, c.mesh);
      }
    }
    nextSpawnZ = -52;
    lastSafeLane = 0;
  }

  function clearNearbyObstacles(centerZ: number, radius: number): void {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (Math.abs(o.z - centerZ) <= radius) {
        releaseObstacleMesh(o.kind, o.mesh);
        obstacles.splice(i, 1);
      }
    }
  }

  function update(
    dt: number,
    time: number,
    speed: number,
    worldId: WorldId,
    difficulty: number,
    playerZ: number
  ): void {
    while (nextSpawnZ > -165) {
      spawnPattern(nextSpawnZ, worldId, difficulty, speed);
      // Fair reaction spacing >= ~0.95s scaled with current speed
      const spacing = Math.max(26, speed * 0.96 - difficulty * 2.2);
      nextSpawnZ -= spacing;
    }
    nextSpawnZ += speed * dt;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.z += (speed + o.speedOffset) * dt;
      o.mesh.position.z = o.z;

      if (o.kind === 'roller' && o.mesh.userData.spinTarget) {
        o.mesh.userData.spinTarget.rotation.x += dt * 7.5;
      } else if (o.kind === 'rotating_gate' && o.mesh.userData.spinTarget) {
        o.currentRotY = time * 2.6 + o.phase;
        o.mesh.userData.spinTarget.rotation.y = o.currentRotY;
      } else if (o.kind === 'pendulum' && o.mesh.userData.swingPivot) {
        const swing = Math.sin(time * 3.1 + o.phase) * 0.55;
        o.currentSwing = swing;
        o.mesh.userData.swingPivot.rotation.z = swing;
      } else if (o.kind === 'falling_rock' && o.mesh.userData.boulder) {
        // Lands squarely on track by z = -26 so players have clear visual warning & timing
        const dist = Math.max(0, -o.z - 26);
        const dropY = Math.min(6.5, dist * 0.2);
        const by = 1.02 + dropY;
        o.currentBoulderY = by;
        o.minY = Math.max(0, by - 0.95);
        o.maxY = by + 0.95;
        o.mesh.userData.boulder.position.y = by;
        o.mesh.userData.boulder.rotation.x += dt * 3;
      } else if (o.kind === 'collapsing_bridge' && o.mesh.userData.slab) {
        if (o.z > -12) {
          o.mesh.userData.slab.position.y = Math.max(-0.55, 0.1 - (o.z + 12) * 0.045);
        } else {
          o.mesh.userData.slab.position.y = 0.1;
        }
      } else if (o.kind === 'flying_dragon' && o.mesh.userData.wingL && o.mesh.userData.wingR) {
        const flap = Math.sin(time * 14 + o.phase) * 0.55;
        const bob = Math.sin(time * 5 + o.phase) * 0.12;
        o.mesh.userData.wingL.rotation.z = flap;
        o.mesh.userData.wingR.rotation.z = -flap;
        o.mesh.userData.wyvern.position.y = 2.02 + bob;
        o.minY = 1.52 + bob;
        o.maxY = 2.52 + bob;
      } else if (o.kind === 'train' && !o.hornPlayed && o.z > -62 && o.z < -20) {
        o.hornPlayed = true;
        onTrainApproach();
      }

      if (o.z > playerZ + 28) {
        releaseObstacleMesh(o.kind, o.mesh);
        obstacles.splice(i, 1);
      }
    }

    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      c.z += speed * dt;
      c.mesh.position.set(c.x, c.y + Math.sin(time * 4 + c.id) * 0.12, c.z);
      c.mesh.rotation.y = time * 3.2 + c.id * 0.3;

      if (c.collected || c.z > playerZ + 12) {
        if (c.kind === 'coin') {
          c.mesh.visible = false;
          coinPool.push(c.mesh);
        } else if (c.kind === 'gem') {
          c.mesh.visible = false;
          gemPool.push(c.mesh);
        } else {
          releasePowerUpMesh(c.powerUpType, c.mesh);
        }
        collectibles.splice(i, 1);
      }
    }
  }

  return {
    group,
    obstacles,
    collectibles,
    reset,
    update,
    spawnAerialCoinArc,
    clearNearbyObstacles,
    dispose: () => {
      scene.remove(group);
      disposables.forEach((d) => d.dispose());
    },
  };
}
