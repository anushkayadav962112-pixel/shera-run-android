import * as THREE from 'three';
import { WORLDS } from '../data/gameData';
import { GraphicsQuality, WorldConfig, WorldId } from '../types/game';
import { ProceduralTextureSet } from './textures';

export const CHUNK_LENGTH = 36;
export const CHUNK_COUNT = 6;
export const TRACK_WIDTH = 9.6;
export const LANE_WIDTH = 3.2;

export const ROTATION_WORLD_SEQUENCE: WorldId[] = ['clouds', 'lava', 'crystal', 'dragon'];

// Pre-allocated color helpers for zero-GC world transitions
const _targetFogColor = new THREE.Color();
const _targetBgColor = new THREE.Color();
const _targetSkyColor = new THREE.Color();
const _targetGroundColor = new THREE.Color();
const _targetKeyColor = new THREE.Color();
const _targetParticleColor = new THREE.Color();

export interface WorldEnvironment {
  group: THREE.Group;
  chunks: THREE.Group[];
  dragons: { group: THREE.Group; baseAngle: number; radius: number; height: number; speed: number }[];
  waterfalls: THREE.Mesh[];
  lavaRiver: THREE.Mesh;
  frozenLake: THREE.Mesh;
  portalArch: THREE.Group;
  lavaFortress: THREE.Group;
  dragonCave: THREE.Group;
  frozenCitadel: THREE.Group;
  ambientParticles: THREE.Points;
  applyWorld: (worldId: WorldId) => WorldConfig;
  transitionToWorld: (worldId: WorldId) => WorldConfig;
  setQuality: (quality: GraphicsQuality) => void;
  preWarmWorlds: (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => void;
  update: (time: number, dt: number, speed: number, worldId: WorldId) => void;
  dispose: () => void;
}

function createSkyDomeTexture(worldId: WorldId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (worldId === 'clouds') {
    grad.addColorStop(0, '#092475');
    grad.addColorStop(0.36, '#1a5bd1');
    grad.addColorStop(0.66, '#489ee8');
    grad.addColorStop(0.88, '#c7b8d8');
    grad.addColorStop(1, '#f4c082');
  } else if (worldId === 'lava') {
    grad.addColorStop(0, '#10040f');
    grad.addColorStop(0.38, '#4a101d');
    grad.addColorStop(0.68, '#a62b12');
    grad.addColorStop(0.88, '#e85d1a');
    grad.addColorStop(1, '#f59e0b');
  } else if (worldId === 'crystal') {
    grad.addColorStop(0, '#09134f');
    grad.addColorStop(0.36, '#1842a8');
    grad.addColorStop(0.68, '#289ad6');
    grad.addColorStop(0.88, '#7dd3fc');
    grad.addColorStop(1, '#c084fc');
  } else if (worldId === 'dragon') {
    grad.addColorStop(0, '#061a18');
    grad.addColorStop(0.38, '#0f443c');
    grad.addColorStop(0.68, '#1e6e58');
    grad.addColorStop(0.88, '#4fd1a5');
    grad.addColorStop(1, '#fde68a');
  } else {
    // Frozen Kingdom — crisp arctic sapphire & aurora twilight
    grad.addColorStop(0, '#091d4a');
    grad.addColorStop(0.38, '#194d96');
    grad.addColorStop(0.68, '#3b88c9');
    grad.addColorStop(0.88, '#7dd3fc');
    grad.addColorStop(1, '#bae6fd');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Calibrated Sun / Aurora Disc
  const sunX = 256;
  const sunY = worldId === 'lava' ? 290 : worldId === 'frozen' ? 225 : 212;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 128);
  sunGlow.addColorStop(
    0,
    worldId === 'crystal'
      ? 'rgba(186,245,255,0.88)'
      : worldId === 'dragon'
      ? 'rgba(167,243,208,0.88)'
      : worldId === 'frozen'
      ? 'rgba(224,242,254,0.9)'
      : 'rgba(255,244,200,0.9)'
  );
  sunGlow.addColorStop(
    0.35,
    worldId === 'lava'
      ? 'rgba(255,110,30,0.45)'
      : worldId === 'crystal'
      ? 'rgba(168,85,247,0.38)'
      : worldId === 'frozen'
      ? 'rgba(56,189,248,0.42)'
      : 'rgba(255,205,110,0.36)'
  );
  sunGlow.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle Painted Sky Clouds / Aurora Ribbons
  for (let i = 0; i < 24; i++) {
    const cx = (i * 89) % 512;
    const cy = 155 + ((i * 37) % 165);
    const rw = 42 + (i % 5) * 16;
    const rh = 14 + (i % 3) * 7;
    ctx.fillStyle =
      worldId === 'lava'
        ? 'rgba(255, 120, 65, 0.18)'
        : worldId === 'frozen'
        ? 'rgba(186, 230, 253, 0.28)'
        : worldId === 'dragon'
        ? 'rgba(110, 231, 183, 0.18)'
        : 'rgba(235, 245, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createWorldEnvironment(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  hemiLight: THREE.HemisphereLight,
  keyLight: THREE.DirectionalLight
): WorldEnvironment {
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

  // Sky Dome
  const skyGeo = trackGeo(new THREE.SphereGeometry(295, 28, 18));
  const skyTextures: Record<WorldId, THREE.CanvasTexture> = {
    clouds: createSkyDomeTexture('clouds'),
    lava: createSkyDomeTexture('lava'),
    crystal: createSkyDomeTexture('crystal'),
    dragon: createSkyDomeTexture('dragon'),
    frozen: createSkyDomeTexture('frozen'),
  };
  Object.values(skyTextures).forEach((t) => disposables.push(t));

  const skyMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: skyTextures.clouds,
      side: THREE.BackSide,
      fog: false,
    })
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // Shared Calibrated PBR Materials (matte stone/foliage/clouds keep low envMapIntensity to stop washout)
  const trackMatPbr = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.trackTextures.clouds,
      bumpMap: textures.trackBumpTextures.clouds,
      bumpScale: 0.052,
      roughness: 0.74,
      metalness: 0.08,
      envMapIntensity: 0.32,
    })
  );
  const stoneWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x9b9285, roughness: 0.78, metalness: 0.04, envMapIntensity: 0.28 })
  );
  const darkBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x261918, roughness: 0.88, metalness: 0.08, envMapIntensity: 0.25 })
  );
  const mountainSlateMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b4d63, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.25 })
  );
  const snowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdce8f5, roughness: 0.76, metalness: 0.02, envMapIntensity: 0.3 })
  );
  const cloudBankMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xbdd0ea, roughness: 0.94, metalness: 0.0, envMapIntensity: 0.16 })
  );
  const cloudCrownMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xedf2fa, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.2 })
  );
  const goldTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4b926,
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.5,
      envMapIntensity: 1.1,
    })
  );
  const bannerRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.25 })
  );
  const whiteStatueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.68, metalness: 0.04, envMapIntensity: 0.3 })
  );
  const cliffSlateMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x647087, roughness: 0.86, metalness: 0.04, envMapIntensity: 0.22 })
  );
  const cherryLeafMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.74, envMapIntensity: 0.25 })
  );
  const cherryLightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.72, envMapIntensity: 0.25 })
  );
  const forestLeafMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.74, envMapIntensity: 0.25 })
  );
  const pineLeafMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.78, envMapIntensity: 0.22 })
  );
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4f321f, roughness: 0.9, envMapIntensity: 0.2 })
  );
  const iceMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.12,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.05,
    })
  );
  const crystalCyanMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      clearcoat: 1.0,
      envMapIntensity: 1.1,
    })
  );
  const crystalAmethystMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd946ef,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.65,
      roughness: 0.14,
      clearcoat: 1.0,
      envMapIntensity: 1.1,
    })
  );
  const crystalGoldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.5,
      roughness: 0.18,
      clearcoat: 1.0,
      envMapIntensity: 1.1,
    })
  );
  const fireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff5a00,
      emissiveIntensity: 1.45,
      roughness: 0.25,
    })
  );
  const dragonScaleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45, metalness: 0.25 })
  );
  const emeraldRuneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    })
  );
  const waterfallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.waterfallTexture,
      color: 0x93c5fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
      roughness: 0.12,
      side: THREE.DoubleSide,
    })
  );

  // Flowing Molten Lava River (World 2)
  const lavaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.lavaFlowTexture,
      color: 0xff6a00,
      emissive: 0xea3c00,
      emissiveMap: textures.lavaFlowTexture,
      emissiveIntensity: 1.15,
      roughness: 0.35,
    })
  );
  const lavaRiver = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(240, 300)), lavaMat);
  lavaRiver.rotation.x = -Math.PI / 2;
  lavaRiver.position.set(0, -6.2, -90);
  lavaRiver.visible = false;
  group.add(lavaRiver);

  // Shimmering Frozen Ice Lake (World 5)
  const frozenLakeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1d5b96,
      roughness: 0.12,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.9,
    })
  );
  const frozenLake = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(240, 300)), frozenLakeMat);
  frozenLake.rotation.x = -Math.PI / 2;
  frozenLake.position.set(0, -6.4, -90);
  frozenLake.visible = false;
  group.add(frozenLake);

  // Helper Builders for Multi-Part Props
  function buildCrownedLionStatue(statueMat: THREE.Material): THREE.Group {
    const sg = new THREE.Group();
    const ped = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 2.9, 2.6)), stoneWallMat);
    ped.position.y = 1.45;
    sg.add(ped);
    const pedTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.9, 0.32, 2.9)), goldTrimMat);
    pedTrim.position.y = 3.0;
    sg.add(pedTrim);

    const lionHaunch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.35, 1.45, 1.95)), statueMat);
    lionHaunch.position.set(0, 3.82, -0.1);
    sg.add(lionHaunch);
    const lionChest = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.74, 0.92, 1.65, 10)), statueMat);
    lionChest.position.set(0, 4.35, 0.58);
    sg.add(lionChest);
    const lionMane = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.98, 1)), statueMat);
    lionMane.position.set(0, 5.12, 0.72);
    lionMane.scale.set(1.06, 1.12, 0.88);
    sg.add(lionMane);
    const lionHead = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.62, 1)), statueMat);
    lionHead.position.set(0, 5.18, 1.12);
    sg.add(lionHead);
    const lionMuzzle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 0.38, 0.52)), statueMat);
    lionMuzzle.position.set(0, 5.0, 1.56);
    sg.add(lionMuzzle);
    [-0.42, 0.42].forEach((ex) => {
      const ear = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 8)), statueMat);
      ear.rotation.x = Math.PI / 2;
      ear.position.set(ex, 5.66, 1.0);
      sg.add(ear);
    });
    const crown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.36, 0.48, 8)), goldTrimMat);
    crown.position.set(0, 5.95, 1.02);
    sg.add(crown);
    return sg;
  }

  function buildMultiClusterTree(
    canopyMatA: THREE.Material,
    canopyMatB: THREE.Material,
    scale = 1.0
  ): THREE.Group {
    const tg = new THREE.Group();
    tg.scale.setScalar(scale);
    const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.72, 4.9, 8)), trunkMat);
    trunk.position.y = 2.45;
    tg.add(trunk);

    const branchL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.28, 2.2, 6)), trunkMat);
    branchL.position.set(-0.7, 4.1, 0.25);
    branchL.rotation.z = 0.55;
    tg.add(branchL);

    const branchR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.28, 2.1, 6)), trunkMat);
    branchR.position.set(0.68, 4.2, -0.2);
    branchR.rotation.z = -0.52;
    tg.add(branchR);

    const offsets: [number, number, number, number, number][] = [
      [0, 5.5, 0, 2.05, 0.85],
      [-1.45, 4.65, 0.55, 1.48, 0.82],
      [1.4, 4.8, -0.45, 1.52, 0.84],
      [-0.55, 6.2, -0.65, 1.38, 0.86],
      [0.65, 6.1, 0.55, 1.34, 0.82],
    ];
    offsets.forEach(([ox, oy, oz, rad, sy], idx) => {
      const puff = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(rad, 1)),
        idx % 2 === 0 ? canopyMatA : canopyMatB
      );
      puff.position.set(ox, oy, oz);
      puff.scale.set(1.12, sy, 1.06);
      puff.rotation.y = idx * 0.7;
      tg.add(puff);
    });
    return tg;
  }

  function buildCloudBank(scale = 1.0): THREE.Group {
    const cg = new THREE.Group();
    cg.scale.setScalar(scale);
    // Volumetric two-tone cloud puffs: shaded blue-lavender underbelly + warm sunlit crown
    const underPuffs: [number, number, number, number][] = [
      [0, -0.35, 0, 2.9],
      [-2.5, -0.6, 0.35, 2.15],
      [2.6, -0.55, -0.3, 2.25],
      [-1.3, -0.45, -1.2, 1.9],
    ];
    underPuffs.forEach(([px, py, pz, r]) => {
      const sp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(r, 12, 10)), cloudBankMat);
      sp.position.set(px, py, pz);
      sp.scale.set(1.32, 0.62, 1.12);
      cg.add(sp);
    });
    const crownPuffs: [number, number, number, number][] = [
      [0, 0.45, 0.1, 2.35],
      [-1.55, 0.28, 0.25, 1.75],
      [1.65, 0.32, -0.15, 1.8],
    ];
    crownPuffs.forEach(([px, py, pz, r]) => {
      const sp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(r, 12, 10)), cloudCrownMat);
      sp.position.set(px, py, pz);
      sp.scale.set(1.22, 0.68, 1.08);
      cg.add(sp);
    });
    return cg;
  }

  // Modular Track Chunks
  const chunks: THREE.Group[] = [];
  const deckGeo = trackGeo(new THREE.BoxGeometry(TRACK_WIDTH, 1.0, CHUNK_LENGTH));
  const curbGeo = trackGeo(new THREE.BoxGeometry(0.7, 1.35, CHUNK_LENGTH));
  const railBarGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.24, CHUNK_LENGTH));
  const balusterGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.16, 1.15, 8));
  const pillarGeo = trackGeo(new THREE.BoxGeometry(1.15, 4.6, 1.15));
  const bannerGeo = trackGeo(new THREE.PlaneGeometry(1.0, 2.35));
  const volcanoGeo = trackGeo(new THREE.ConeGeometry(9.5, 19, 8));
  const snowPeakGeo = trackGeo(new THREE.ConeGeometry(9.2, 22, 7));

  const bridgeSubPierGeo = trackGeo(new THREE.BoxGeometry(TRACK_WIDTH + 0.6, 7.5, 2.6));
  const _balDummy = new THREE.Object3D();

  for (let i = 0; i < CHUNK_COUNT; i++) {
    const chunk = new THREE.Group();
    chunk.position.z = -i * CHUNK_LENGTH;

    const deck = new THREE.Mesh(deckGeo, trackMatPbr);
    deck.position.y = -0.5;
    deck.receiveShadow = true;
    chunk.add(deck);

    // Sculpted under-bridge sky pier so the bridge spans cleanly across the clouds
    const subPier = new THREE.Mesh(bridgeSubPierGeo, stoneWallMat);
    subPier.position.set(0, -4.6, 0);
    chunk.add(subPier);

    [-TRACK_WIDTH / 2 - 0.32, TRACK_WIDTH / 2 + 0.32].forEach((cx) => {
      const curb = new THREE.Mesh(curbGeo, stoneWallMat);
      curb.position.set(cx, -0.15, 0);
      curb.receiveShadow = true;
      chunk.add(curb);
    });

    const pClouds = new THREE.Group();
    const pLava = new THREE.Group();
    const pCrystal = new THREE.Group();
    const pDragon = new THREE.Group();
    const pFrozen = new THREE.Group();
    chunk.userData = {
      clouds: pClouds,
      lava: pLava,
      crystal: pCrystal,
      dragon: pDragon,
      frozen: pFrozen,
    };
    chunk.add(pClouds, pLava, pCrystal, pDragon, pFrozen);

    // Instanced stone balusters for Kingdom of Clouds (1 draw call per chunk vs 10 separate meshes)
    const balInstanced = new THREE.InstancedMesh(balusterGeo, stoneWallMat, 10);
    let bIdx = 0;
    [-1, 1].forEach((side) => {
      for (let b = -14; b <= 14; b += 7) {
        _balDummy.position.set(side * (TRACK_WIDTH / 2 + 0.34), 0.78, b);
        _balDummy.updateMatrix();
        balInstanced.setMatrixAt(bIdx++, _balDummy.matrix);
      }
    });
    balInstanced.instanceMatrix.needsUpdate = true;
    balInstanced.computeBoundingSphere();
    pClouds.add(balInstanced);

    [-1, 1].forEach((side) => {
      const px = side * (TRACK_WIDTH / 2 + 1.15);

      // 1. KINGDOM OF CLOUDS (Carved stone balustrades, golden caps, blossom & green trees, cloud banks, lion statues)
      const railTop = new THREE.Mesh(railBarGeo, stoneWallMat);
      railTop.position.set(side * (TRACK_WIDTH / 2 + 0.34), 1.45, 0);
      pClouds.add(railTop);
      const railGold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.08, CHUNK_LENGTH)), goldTrimMat);
      railGold.position.set(side * (TRACK_WIDTH / 2 + 0.34), 1.59, 0);
      pClouds.add(railGold);

      const pillarC = new THREE.Mesh(pillarGeo, stoneWallMat);
      pillarC.position.set(px, 1.9, 0);
      pClouds.add(pillarC);
      const capC = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.48, 0.38, 1.48)), goldTrimMat);
      capC.position.set(px, 4.3, 0);
      pClouds.add(capC);
      const finialC = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.42, 0)), goldTrimMat);
      finialC.position.set(px, 4.78, 0);
      pClouds.add(finialC);
      const bannerC = new THREE.Mesh(bannerGeo, bannerRedMat);
      bannerC.position.set(px - side * 0.65, 2.6, 0);
      bannerC.rotation.y = side * (Math.PI / 2);
      pClouds.add(bannerC);

      // Multi-cluster pink cherry blossoms & vibrant green trees flanking sky piers
      if (i % 2 === 1) {
        const blossomTree = buildMultiClusterTree(cherryLeafMat, cherryLightMat, 1.05);
        blossomTree.position.set(side * 9.6, -0.4, 9);
        pClouds.add(blossomTree);
      } else {
        const greenTree = buildMultiClusterTree(forestLeafMat, pineLeafMat, 0.96);
        greenTree.position.set(side * 9.8, -0.5, -12);
        pClouds.add(greenTree);
      }

      // Layered 3D Cloud Banks drifting beneath and beside the bridge at staggered depths
      const cloudNear = buildCloudBank(1.25 + (i % 2) * 0.32);
      cloudNear.position.set(side * (16 + (i % 3) * 3.5), -3.8 - (i % 2) * 1.4, -6);
      pClouds.add(cloudNear);
      const cloudDeep = buildCloudBank(1.65);
      cloudDeep.position.set(side * (28 + (i % 2) * 5), -6.2, 8);
      pClouds.add(cloudDeep);

      if (i % 2 === 0 && side === -1) {
        const statue = buildCrownedLionStatue(stoneWallMat);
        statue.position.set(-9.4, -0.8, -11);
        statue.rotation.y = 0.55;
        pClouds.add(statue);
      }
      if (side === 1) {
        for (let k = 0; k < 3; k++) {
          const cry = new THREE.Mesh(
            trackGeo(new THREE.ConeGeometry(0.42 + k * 0.1, 1.4 + k * 0.45, 5)),
            crystalGoldMat
          );
          cry.position.set(px + 0.45 + (k - 1) * 0.35, 0.6 + k * 0.25, -12 + k * 0.3);
          cry.rotation.z = (k - 1) * 0.22;
          pClouds.add(cry);
        }
      }

      // 2. LAVA KINGDOM
      const pillarL = new THREE.Mesh(pillarGeo, darkBasaltMat);
      pillarL.position.set(px, 1.9, 0);
      pLava.add(pillarL);
      const brazierBowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.85, 0.45, 0.45, 10)), goldTrimMat);
      brazierBowl.position.set(px, 4.25, 0);
      pLava.add(brazierBowl);
      const brazierFlame = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.62, 1.3, 8)), fireMat);
      brazierFlame.position.set(px, 5.05, 0);
      pLava.add(brazierFlame);
      const bannerL = new THREE.Mesh(bannerGeo, bannerRedMat);
      bannerL.position.set(px - side * 0.65, 2.5, 0);
      bannerL.rotation.y = side * (Math.PI / 2);
      pLava.add(bannerL);
      if (i % 2 === 0 && side === 1) {
        const lavaLion = buildCrownedLionStatue(darkBasaltMat);
        lavaLion.position.set(9.0, -0.8, 10);
        lavaLion.rotation.y = -0.55;
        pLava.add(lavaLion);
      }
      if (i % 2 === 1) {
        const volc = new THREE.Mesh(volcanoGeo, darkBasaltMat);
        volc.position.set(side * 23, -3.5, -14);
        pLava.add(volc);
        const lavaFall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.6, 15)), fireMat);
        lavaFall.position.set(side * 16.5, 0.5, -14);
        lavaFall.rotation.y = -side * 0.6;
        pLava.add(lavaFall);
      }

      // 3. CRYSTAL FOREST (Giant colorful crystals, multi-cluster glowing trees, waterfalls, railway arches)
      const cliff = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 8.8, CHUNK_LENGTH * 0.96)), stoneWallMat);
      cliff.position.set(side * 10.8, 1.6, 0);
      pCrystal.add(cliff);
      for (let k = 0; k < 4; k++) {
        const cryMat = k % 2 === 0 ? crystalCyanMat : crystalAmethystMat;
        const cry = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.75 + k * 0.14, 3.0 + k * 0.95, 5)), cryMat);
        cry.position.set(side * (7.0 + k * 0.55), 1.6 + k * 0.45, -10 + k * 3.8);
        cry.rotation.z = side * -0.22;
        pCrystal.add(cry);
      }
      const mTree = buildMultiClusterTree(
        i % 2 === 0 ? forestLeafMat : cherryLeafMat,
        crystalCyanMat,
        0.92
      );
      mTree.position.set(side * 8.9, 5.2, 9);
      pCrystal.add(mTree);

      if (i % 2 === 0) {
        const wfC = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.5, 11)), waterfallMat);
        wfC.position.set(side * 8.2, 3.5, 0);
        wfC.rotation.y = -side * (Math.PI / 2);
        pCrystal.add(wfC);
      }
      if (i % 2 === 0 && side === 1) {
        const archTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(19, 1.8, 2.5)), stoneWallMat);
        archTop.position.set(0, 9.8, -14);
        pCrystal.add(archTop);
        const archCrystal = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(1.1, 0)), crystalAmethystMat);
        archCrystal.position.set(0, 11.4, -14);
        pCrystal.add(archCrystal);
      }

      // 4. DRAGON KINGDOM (Stone temples, alpine mountain peaks, emerald fire torches, multi-cluster trees)
      const templePillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 7.2, 1.5)), stoneWallMat);
      templePillar.position.set(px + side * 0.3, 3.1, 0);
      pDragon.add(templePillar);
      const templeTorch = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.65, 0)), emeraldRuneMat);
      templeTorch.position.set(px + side * 0.3, 7.2, 0);
      pDragon.add(templeTorch);
      const dTree = buildMultiClusterTree(forestLeafMat, pineLeafMat, 1.25);
      dTree.position.set(side * 10.8, 0.2, -8);
      pDragon.add(dTree);

      if (i % 2 === 1 && side === -1) {
        const templeGate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 2.2, 2.6)), stoneWallMat);
        templeGate.position.set(0, 9.4, -12);
        pDragon.add(templeGate);
        const hornL = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.8, 3.2, 6)), dragonScaleMat);
        hornL.position.set(-7.5, 11.6, -12);
        hornL.rotation.z = 0.25;
        pDragon.add(hornL);
        const hornR = hornL.clone();
        hornR.position.x = 7.5;
        hornR.rotation.z = -0.25;
        pDragon.add(hornR);
      }

      // 5. FROZEN KINGDOM (Ice crystal pillars, snow-capped peaks, frosted pines, glowing ice spires)
      const icePillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.58, 0.78, 5.6, 6)), snowMat);
      icePillar.position.set(px + side * 0.3, 2.3, 0);
      pFrozen.add(icePillar);
      const iceSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.75, 2.4, 6)), iceMat);
      iceSpire.position.set(px + side * 0.3, 6.2, 0);
      pFrozen.add(iceSpire);

      const snowMtn = new THREE.Mesh(snowPeakGeo, mountainSlateMat);
      snowMtn.position.set(side * 22, -1.8, -10);
      pFrozen.add(snowMtn);
      const snowCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(4.4, 10.5, 7)), snowMat);
      snowCap.position.set(side * 22, 4.2, -10);
      pFrozen.add(snowCap);

      if (i % 2 === 0) {
        const pTrunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.48, 3.8, 7)), trunkMat);
        pTrunk.position.set(side * 8.6, 1.2, 10);
        pFrozen.add(pTrunk);
        const pineLower = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.1, 3.4, 7)), pineLeafMat);
        pineLower.position.set(side * 8.6, 3.4, 10);
        pFrozen.add(pineLower);
        const pineUpper = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.45, 2.6, 7)), snowMat);
        pineUpper.position.set(side * 8.6, 4.9, 10);
        pFrozen.add(pineUpper);
      }
    });

    chunks.push(chunk);
    group.add(chunk);
  }

  // --- DISTANT FLOATING FANTASY CASTLES, VIADUCTS & CRYSTAL ISLANDS ---
  const distantGroup = new THREE.Group();
  group.add(distantGroup);

  const castleRoofBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.38, metalness: 0.28, envMapIntensity: 0.6 })
  );
  const castleWindowGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );

  const waterfalls: THREE.Mesh[] = [];
  function addFloatingIsland(x: number, y: number, z: number, scale: number, crystalTheme = false): void {
    const island = new THREE.Group();
    island.position.set(x, y, z);
    island.scale.setScalar(scale);

    // Multi-tiered faceted cliff underside (organic floating mountain spire)
    const rockMain = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(9.6, 14, 7)), cliffSlateMat);
    rockMain.rotation.x = Math.PI;
    rockMain.position.y = -6.6;
    island.add(rockMain);

    const rockLeft = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(5.2, 9.5, 6)), cliffSlateMat);
    rockLeft.rotation.x = Math.PI;
    rockLeft.position.set(-4.2, -5.6, 2.2);
    island.add(rockLeft);

    const rockRight = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(4.8, 8.8, 6)), cliffSlateMat);
    rockRight.rotation.x = Math.PI;
    rockRight.position.set(4.5, -5.2, -1.8);
    island.add(rockRight);

    const cliffRim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(9.4, 8.8, 1.1, 10)), stoneWallMat);
    cliffRim.position.y = -0.5;
    island.add(cliffRim);

    const grassTop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(9.2, 9.1, 0.9, 10)), forestLeafMat);
    grassTop.position.y = 0.45;
    island.add(grassTop);

    const wallMat = crystalTheme ? crystalCyanMat : whiteStatueMat;
    const roofMat = crystalTheme ? crystalAmethystMat : castleRoofBlueMat;

    // Outer Castle Curtain Wall, Gold Molding & Battlements
    const curtainWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 2.7, 8.8)), wallMat);
    curtainWall.position.y = 2.0;
    island.add(curtainWall);

    const wallBelt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.1, 0.28, 9.1)), goldTrimMat);
    wallBelt.position.y = 3.4;
    island.add(wallBelt);

    for (let m = -4.5; m <= 4.5; m += 1.5) {
      const merlon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.72, 0.65)), wallMat);
      merlon.position.set(m, 3.85, 4.15);
      island.add(merlon);
    }

    // Grand Central Keep + Glowing Arched Gatehouse Window
    const castleKeep = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 6.4, 6.2)), wallMat);
    castleKeep.position.y = 4.4;
    island.add(castleKeep);

    const archWindow = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.85, 1.35, 4, 8)), castleWindowGlowMat);
    archWindow.position.set(0, 4.8, 3.16);
    island.add(archWindow);

    // Central Royal Spire + 4 Corner Castle Towers + Pennants
    const towerSpecs: [number, number, number, number][] = [
      [0, -0.4, 12.2, 1.55],
      [-4.6, 3.6, 8.8, 1.05],
      [4.6, 3.6, 8.8, 1.05],
      [-4.6, -3.6, 8.4, 1.0],
      [4.6, -3.6, 8.4, 1.0],
    ];
    towerSpecs.forEach(([tx, tz, h, rad], idx) => {
      const tower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(rad * 0.92, rad, h, 10)), wallMat);
      tower.position.set(tx, h * 0.5 + 0.6, tz);
      island.add(tower);

      const towerCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(rad * 1.08, rad * 1.02, 0.35, 10)), goldTrimMat);
      towerCollar.position.set(tx, h + 0.5, tz);
      island.add(towerCollar);

      const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(rad * 1.28, h * 0.36, 10)), roofMat);
      spire.position.set(tx, h + h * 0.18 + 0.55, tz);
      island.add(spire);

      const goldTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.28, 8, 8)), goldTrimMat);
      goldTip.position.set(tx, h + h * 0.36 + 0.62, tz);
      island.add(goldTip);

      if (idx <= 2) {
        const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.95, 0.2)), castleWindowGlowMat);
        win.position.set(tx, h * 0.65, tz + rad * 0.92);
        island.add(win);
      }

      if (idx === 0 || idx === 1) {
        const pennant = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.5, 0.72)), bannerRedMat);
        pennant.position.set(tx + 0.85, h + h * 0.36 + 0.32, tz);
        island.add(pennant);
      }
    });

    // Cherry Blossom & Emerald Gardens flanking Keep
    const blossomL = buildMultiClusterTree(cherryLeafMat, cherryLightMat, 0.65);
    blossomL.position.set(-6.4, 0.8, 2.2);
    island.add(blossomL);

    const greenR = buildMultiClusterTree(forestLeafMat, pineLeafMat, 0.62);
    greenR.position.set(6.4, 0.8, 1.8);
    island.add(greenR);

    // Multi-stream Waterfall cascading off Floating Cliff
    const wf = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.4, 24)), waterfallMat);
    wf.position.set(0, -9, 5.2);
    island.add(wf);
    waterfalls.push(wf);

    distantGroup.add(island);
  }

  // Framing Fantasy Castles positioned to create layered depth on both Home Screen and Gameplay
  addFloatingIsland(-24, 13.5, -72, 1.15, false);
  addFloatingIsland(25, 16.0, -86, 1.32, false);
  addFloatingIsland(-35, 19.5, -124, 1.38, true);
  // Horizon Grand Sky Citadel anchoring the distant cloud horizon directly behind the portal
  addFloatingIsland(0, 14.5, -158, 1.45, false);

  // Distant Arched Royal Viaduct Bridge spanning the sky canyon
  const viaductGroup = new THREE.Group();
  viaductGroup.position.set(0, 2.5, -96);
  const viaductSpan = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(78, 1.8, 3.2)), stoneWallMat);
  viaductSpan.position.y = 4.2;
  viaductGroup.add(viaductSpan);
  const viaductTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(78, 0.32, 3.4)), goldTrimMat);
  viaductTrim.position.y = 5.25;
  viaductGroup.add(viaductTrim);
  for (let vx = -30; vx <= 30; vx += 12) {
    const pier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 14, 3.0)), stoneWallMat);
    pier.position.set(vx, -2.5, 0);
    viaductGroup.add(pier);
    if (vx < 30) {
      const archRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(4.8, 0.8, 6, 12, Math.PI)), stoneWallMat);
      archRing.position.set(vx + 6, 1.6, 0);
      viaductGroup.add(archRing);
    }
  }
  distantGroup.add(viaductGroup);

  // Rainbow-Cyan Sky Portal Arch (World 1)
  const portalArch = new THREE.Group();
  portalArch.position.set(0, 6.2, -138);
  const portalOuter = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(9.2, 1.15, 12, 36)), goldTrimMat);
  portalArch.add(portalOuter);
  const portalInner = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(8.2, 32)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, side: THREE.DoubleSide }))
  );
  portalArch.add(portalInner);
  group.add(portalArch);

  // Roaring Lava Lion Fortress Gate (World 2)
  const lavaFortress = new THREE.Group();
  lavaFortress.position.set(0, 12, -155);
  const fortWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(46, 26, 8)), darkBasaltMat);
  lavaFortress.add(fortWall);
  const fortLion = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(11, 1)), darkBasaltMat);
  fortLion.position.set(0, 4, 4);
  lavaFortress.add(fortLion);
  [-4.2, 4.2].forEach((ex) => {
    const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1.3, 10, 10)), fireMat);
    eye.position.set(ex, 7.5, 13.5);
    lavaFortress.add(eye);
  });
  const mouthGate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8, 10, 4)), fireMat);
  mouthGate.position.set(0, -4, 6);
  lavaFortress.add(mouthGate);
  lavaFortress.visible = false;
  group.add(lavaFortress);

  // Ancient Dragon Cave Horizon Temple (World 4)
  const dragonCave = new THREE.Group();
  dragonCave.position.set(0, 11, -150);
  const caveArch = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(13, 3.4, 8, 18, Math.PI)), stoneWallMat);
  dragonCave.add(caveArch);
  const caveGlow = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(10, 20)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 }))
  );
  dragonCave.add(caveGlow);
  dragonCave.visible = false;
  group.add(dragonCave);

  // Frozen Ice Castle Citadel Horizon (World 5)
  const frozenCitadel = new THREE.Group();
  frozenCitadel.position.set(0, 2, -155);
  const iceKeep = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(16, 20, 20, 8)), iceMat);
  iceKeep.position.y = 8;
  frozenCitadel.add(iceKeep);
  [-12, -5, 0, 5, 12].forEach((tx, idx) => {
    const h = idx === 2 ? 32 : idx === 1 || idx === 3 ? 24 : 18;
    const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(3.8, h, 6)), iceMat);
    spire.position.set(tx, h * 0.5 + 4, idx === 2 ? -2 : 4);
    frozenCitadel.add(spire);
  });
  frozenCitadel.visible = false;
  group.add(frozenCitadel);

  // Flying Dragons in the Sky (Clouds & Dragon Worlds)
  const dragons: WorldEnvironment['dragons'] = [];
  const dragonBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 }));
  for (let d = 0; d < 2; d++) {
    const dg = new THREE.Group();
    const dBody = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.7, 3.8, 6)), dragonBodyMat);
    dBody.rotation.x = Math.PI / 2;
    dg.add(dBody);
    const wingGeo = trackGeo(new THREE.BoxGeometry(4.6, 0.08, 1.4));
    const wingL = new THREE.Mesh(wingGeo, dragonBodyMat);
    wingL.position.set(-2.3, 0.2, 0);
    dg.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, dragonBodyMat);
    wingR.position.set(2.3, 0.2, 0);
    dg.add(wingR);
    dg.userData = { wingL, wingR };
    group.add(dg);
    dragons.push({
      group: dg,
      baseAngle: d * Math.PI,
      radius: 26 + d * 12,
      height: 19 + d * 5,
      speed: 0.44 + d * 0.14,
    });
  }

  // Soft Circular Atmospheric Motes (Bokeh Sparkles / Embers / Crystal Dust / Falling Snow)
  // Uses circular sprite texture + alphaTest to strictly eliminate any square pixel artifacts.
  const particleCount = 120;
  const pPos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 34;
    pPos[i * 3 + 1] = 1.5 + Math.random() * 14;
    pPos[i * 3 + 2] = -Math.random() * 140;
  }
  const pGeo = trackGeo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xfef08a,
      map: textures.particleTexture,
      size: 0.42,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      opacity: 0.72,
    })
  );
  const ambientParticles = new THREE.Points(pGeo, pMat);
  group.add(ambientParticles);

  let targetFogDensity = 0.0055;
  let targetParticleOpacity = 0.45;
  let isTransitioning = false;
  let currentQuality: GraphicsQuality = 'high';

  const WORLD_PARTICLE_COLORS: Record<WorldId, { color: number; opacity: number }> = {
    clouds: { color: 0xffffff, opacity: 0.45 },
    lava: { color: 0xff7700, opacity: 0.85 },
    crystal: { color: 0x67e8f9, opacity: 0.8 },
    dragon: { color: 0x6ee7b7, opacity: 0.82 },
    frozen: { color: 0xe0f2fe, opacity: 0.88 },
  };

  function setWorldVisibility(worldId: WorldId): void {
    skyMat.map = skyTextures[worldId];
    skyMat.needsUpdate = true;

    trackMatPbr.map = textures.trackTextures[worldId];
    trackMatPbr.bumpMap = textures.trackBumpTextures[worldId];
    trackMatPbr.needsUpdate = true;

    lavaRiver.visible = worldId === 'lava';
    lavaFortress.visible = worldId === 'lava';
    frozenLake.visible = worldId === 'frozen';
    frozenCitadel.visible = worldId === 'frozen';
    distantGroup.visible = worldId === 'clouds' || worldId === 'crystal';
    portalArch.visible = worldId === 'clouds';
    dragonCave.visible = worldId === 'dragon';

    chunks.forEach((chunk) => {
      chunk.userData.clouds.visible = worldId === 'clouds';
      chunk.userData.lava.visible = worldId === 'lava';
      chunk.userData.crystal.visible = worldId === 'crystal';
      chunk.userData.dragon.visible = worldId === 'dragon';
      chunk.userData.frozen.visible = worldId === 'frozen';
    });
  }

  function applyWorld(worldId: WorldId): WorldConfig {
    const cfg = WORLDS.find((w) => w.id === worldId) || WORLDS[0];
    setWorldVisibility(worldId);

    scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    scene.background = new THREE.Color(cfg.fogColor);
    targetFogDensity = cfg.fogDensity;
    _targetFogColor.set(cfg.fogColor);
    _targetBgColor.set(cfg.fogColor);
    _targetSkyColor.setHex(cfg.ambientSky);
    _targetGroundColor.setHex(cfg.ambientGround);
    _targetKeyColor.setHex(cfg.keyLightColor);

    hemiLight.color.setHex(cfg.ambientSky);
    hemiLight.groundColor.setHex(cfg.ambientGround);
    keyLight.color.setHex(cfg.keyLightColor);

    const wp = WORLD_PARTICLE_COLORS[worldId];
    _targetParticleColor.setHex(wp.color);
    targetParticleOpacity = wp.opacity;
    pMat.color.setHex(wp.color);
    pMat.opacity = wp.opacity;
    isTransitioning = false;

    return cfg;
  }

  function transitionToWorld(worldId: WorldId): WorldConfig {
    const cfg = WORLDS.find((w) => w.id === worldId) || WORLDS[0];
    setWorldVisibility(worldId);

    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    }
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = new THREE.Color(cfg.fogColor);
    }

    _targetFogColor.set(cfg.fogColor);
    _targetBgColor.set(cfg.fogColor);
    targetFogDensity = cfg.fogDensity;
    _targetSkyColor.setHex(cfg.ambientSky);
    _targetGroundColor.setHex(cfg.ambientGround);
    _targetKeyColor.setHex(cfg.keyLightColor);

    const wp = WORLD_PARTICLE_COLORS[worldId];
    _targetParticleColor.setHex(wp.color);
    targetParticleOpacity = wp.opacity;
    isTransitioning = true;

    return cfg;
  }

  function setQuality(quality: GraphicsQuality): void {
    currentQuality = quality;
    const drawCount = quality === 'low' ? 45 : quality === 'medium' ? 85 : particleCount;
    pGeo.setDrawRange(0, drawCount);
    dragons.forEach((d, idx) => {
      d.group.visible = quality === 'low' ? idx === 0 : true;
    });
  }

  function preWarmWorlds(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const prevStates = {
      lavaRiver: lavaRiver.visible,
      lavaFortress: lavaFortress.visible,
      frozenLake: frozenLake.visible,
      frozenCitadel: frozenCitadel.visible,
      distantGroup: distantGroup.visible,
      portalArch: portalArch.visible,
      dragonCave: dragonCave.visible,
    };
    const chunkStates = chunks.map((c) => ({
      clouds: c.userData.clouds.visible,
      lava: c.userData.lava.visible,
      crystal: c.userData.crystal.visible,
      dragon: c.userData.dragon.visible,
      frozen: c.userData.frozen.visible,
    }));

    lavaRiver.visible = true;
    lavaFortress.visible = true;
    frozenLake.visible = true;
    frozenCitadel.visible = true;
    distantGroup.visible = true;
    portalArch.visible = true;
    dragonCave.visible = true;
    chunks.forEach((c) => {
      c.userData.clouds.visible = true;
      c.userData.lava.visible = true;
      c.userData.crystal.visible = true;
      c.userData.dragon.visible = true;
      c.userData.frozen.visible = true;
    });

    renderer.compile(scene, camera);

    lavaRiver.visible = prevStates.lavaRiver;
    lavaFortress.visible = prevStates.lavaFortress;
    frozenLake.visible = prevStates.frozenLake;
    frozenCitadel.visible = prevStates.frozenCitadel;
    distantGroup.visible = prevStates.distantGroup;
    portalArch.visible = prevStates.portalArch;
    dragonCave.visible = prevStates.dragonCave;
    chunks.forEach((c, idx) => {
      const s = chunkStates[idx];
      c.userData.clouds.visible = s.clouds;
      c.userData.lava.visible = s.lava;
      c.userData.crystal.visible = s.crystal;
      c.userData.dragon.visible = s.dragon;
      c.userData.frozen.visible = s.frozen;
    });
  }

  function update(time: number, dt: number, speed: number, worldId: WorldId): void {
    const moveZ = speed * dt;
    const totalLen = CHUNK_COUNT * CHUNK_LENGTH;

    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      ch.position.z += moveZ;
      if (ch.position.z > CHUNK_LENGTH) {
        ch.position.z -= totalLen;
      }
    }

    if (worldId === 'clouds' || worldId === 'crystal') {
      textures.waterfallTexture.offset.y -= dt * 0.9;
    }
    if (worldId === 'lava') {
      textures.lavaFlowTexture.offset.y += dt * 0.18;
    }

    if (isTransitioning) {
      const alpha = 1 - Math.exp(-3.2 * dt);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_targetFogColor, alpha);
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFogDensity, alpha);
      }
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_targetBgColor, alpha);
      }
      hemiLight.color.lerp(_targetSkyColor, alpha);
      hemiLight.groundColor.lerp(_targetGroundColor, alpha);
      keyLight.color.lerp(_targetKeyColor, alpha);
      pMat.color.lerp(_targetParticleColor, alpha);
      pMat.opacity = THREE.MathUtils.lerp(pMat.opacity, targetParticleOpacity, alpha);

      const keyDiff =
        (keyLight.color.r - _targetKeyColor.r) ** 2 +
        (keyLight.color.g - _targetKeyColor.g) ** 2 +
        (keyLight.color.b - _targetKeyColor.b) ** 2;
      if (
        scene.fog instanceof THREE.FogExp2 &&
        Math.abs(scene.fog.density - targetFogDensity) < 0.00005 &&
        keyDiff < 0.0002
      ) {
        isTransitioning = false;
      }
    }

    for (let idx = 0; idx < dragons.length; idx++) {
      const d = dragons[idx];
      if (!d.group.visible && currentQuality === 'low') continue;
      const ang = d.baseAngle + time * d.speed;
      d.group.position.set(
        Math.cos(ang) * d.radius,
        d.height + Math.sin(time * 1.8 + idx) * 1.6,
        -75 + Math.sin(ang) * 24
      );
      d.group.rotation.y = -ang + Math.PI / 2;
      const flap = Math.sin(time * 9 + idx * 2) * 0.48;
      d.group.userData.wingL.rotation.z = flap;
      d.group.userData.wingR.rotation.z = -flap;
    }

    if (portalArch.visible) {
      portalArch.rotation.z = Math.sin(time * 0.5) * 0.05;
    }

    if (worldId === 'lava' && lavaRiver.visible) {
      lavaMat.emissiveIntensity = 1.0 + Math.sin(time * 3.5) * 0.22;
    }

    if (worldId === 'frozen') {
      ambientParticles.position.y = -((time * 2.2) % 6) + 2;
      ambientParticles.position.x = Math.sin(time * 1.4) * 1.6;
    } else {
      ambientParticles.position.y = Math.sin(time * 1.6) * 0.55;
      ambientParticles.position.x = 0;
    }
  }

  return {
    group,
    chunks,
    dragons,
    waterfalls,
    lavaRiver,
    frozenLake,
    portalArch,
    lavaFortress,
    dragonCave,
    frozenCitadel,
    ambientParticles,
    applyWorld,
    transitionToWorld,
    setQuality,
    preWarmWorlds,
    update,
    dispose: () => {
      scene.remove(group);
      Object.values(skyTextures).forEach((t) => t.dispose());
      disposables.forEach((d) => d.dispose());
    },
  };
}
