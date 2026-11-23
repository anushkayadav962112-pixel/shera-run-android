import * as THREE from 'three';
import { CharacterOutfit, HoverboardItem } from '../types/game';
import { ProceduralTextureSet } from './textures';

export type SheraAnimState =
  | 'throne'
  | 'idle'
  | 'run'
  | 'jump'
  | 'doubleJump'
  | 'slide'
  | 'hoverboard'
  | 'rocket'
  | 'speedBoost'
  | 'stumble'
  | 'collide'
  | 'victory';

export interface SheraRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  maneGroup: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  tailBase: THREE.Group;
  tailTip: THREE.Group;
  hoverboardGroup: THREE.Group;
  hoverGlowMesh: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  rocketGroup: THREE.Group;
  rocketFlames: THREE.Mesh[];
  magnetHalo: THREE.Mesh;
  invincibleAura: THREE.Mesh;
  sunglassesGroup: THREE.Group;
  applyOutfit: (outfit: CharacterOutfit) => void;
  applyHoverboard: (board: HoverboardItem) => void;
  updateAnimation: (
    state: SheraAnimState,
    time: number,
    dt: number,
    speed: number,
    laneTilt: number,
    squashY: number,
    doubleJumpSpin?: number
  ) => void;
  dispose: () => void;
}

function ensureUv2<T extends THREE.BufferGeometry>(geo: T): T {
  const uv = geo.getAttribute('uv');
  if (uv && !geo.getAttribute('uv2')) {
    geo.setAttribute('uv2', uv);
  }
  return geo;
}

/**
 * Builds a plush, softly rounded curl bolster via LatheGeometry with a blunt rounded tip
 * (never a sharp cone or porcupine spike), gently arched backward along Z.
 */
function createRoundedManeLobeGeometry(
  maxRadius: number,
  length: number,
  bendZ: number,
  radialSegments = 12
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Smooth teardrop cushion that swells across the body and closes with a rounded dome tip
    const dome = Math.sin(Math.PI * (0.14 + t * 0.86));
    const r = Math.max(0.004, maxRadius * (0.35 + 0.65 * dome) * (1 - t * 0.22));
    pts.push(new THREE.Vector2(r, t * length));
  }
  pts.push(new THREE.Vector2(0.001, length * 1.01));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / length;
    pos.setZ(i, pos.getZ(i) + bendZ * t * t);
  }
  geo.computeVertexNormals();
  return ensureUv2(geo);
}

/**
 * Builds a swept, flattened-oval lion mane lock tapering smoothly to a feathered tip
 * (zero spherical pillow look, zero sharp porcupine spikes).
 */
function createSweptLockGeometry(
  baseWidth: number,
  baseThickness: number,
  length: number,
  curveBack: number
): THREE.BufferGeometry {
  const segsY = 12;
  const segsR = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segsY; iy++) {
    const t = iy / segsY;
    // Full plush swell across the mid-section tapering smoothly to a soft feathered curl tip (no sharp needle tips)
    const belly = Math.sin(Math.PI * (0.1 + t * 0.86));
    const taper = (0.45 + 0.58 * belly) * Math.pow(Math.max(0.06, 1 - t * 0.88), 0.45);
    const rx = baseWidth * taper;
    const rz = baseThickness * taper;
    const y = t * length;
    const cz = curveBack * t * t;

    for (let ir = 0; ir <= segsR; ir++) {
      const ang = (ir / segsR) * Math.PI * 2;
      const vx = Math.cos(ang) * rx;
      const vz = cz + Math.sin(ang) * rz;
      positions.push(vx, y, vz);
      uvs.push(ir / segsR, t);
    }
  }

  const row = segsR + 1;
  for (let iy = 0; iy < segsY; iy++) {
    for (let ir = 0; ir < segsR; ir++) {
      const a = iy * row + ir;
      const b = a + 1;
      const c = (iy + 1) * row + ir;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureUv2(geo);
}

/**
 * Creates a smooth beveled ExtrudeGeometry from a 2D silhouette.
 */
function createBeveledShapeGeo(
  points: [number, number][],
  depth: number,
  bevelSize = 0.014,
  bevelThickness = 0.014
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize,
    bevelThickness,
  });
  geo.center();
  return ensureUv2(geo);
}

export function createSheraRig(
  initialOutfit: CharacterOutfit,
  initialBoard: HoverboardItem,
  textures?: ProceduralTextureSet
): SheraRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ensureUv2(g);
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const initFur = initialOutfit.furColor ?? 0xf4efe7;
  const initSnout = initialOutfit.snoutColor ?? 0xfdf5e6;
  const initManeOuter = initialOutfit.maneOuterColor ?? 0xf4eee4;
  const initManeInner = initialOutfit.maneInnerColor ?? 0xe2d9cc;

  // --- CALIBRATED PBR MATERIALS ---
  const furMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initFur,
      map: textures?.furAlbedo || null,
      bumpMap: textures?.furBump || null,
      bumpScale: 0.036,
      aoMap: textures?.furAo || null,
      aoMapIntensity: 0.55,
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.3,
    })
  );
  const maneOuterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initManeOuter,
      map: textures?.furAlbedo || null,
      bumpMap: textures?.furBump || null,
      bumpScale: 0.054,
      aoMap: textures?.furAo || null,
      aoMapIntensity: 0.78,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.3,
    })
  );
  const maneInnerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initManeInner,
      map: textures?.furAlbedo || null,
      bumpMap: textures?.furBump || null,
      bumpScale: 0.048,
      aoMap: textures?.furAo || null,
      aoMapIntensity: 0.9,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.22,
    })
  );
  const snoutMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initSnout,
      bumpMap: textures?.furBump || null,
      bumpScale: 0.02,
      roughness: 0.76,
      metalness: 0.02,
      envMapIntensity: 0.32,
    })
  );
  const earInnerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9967e,
      roughness: 0.74,
      metalness: 0.02,
      envMapIntensity: 0.25,
    })
  );
  const noseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x241212,
      roughness: 0.3,
      metalness: 0.08,
      envMapIntensity: 0.65,
    })
  );
  const scleraMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbf8f0,
      roughness: 0.22,
      metalness: 0.02,
    })
  );
  const eyeAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.16,
      metalness: 0.08,
      emissive: 0x92400e,
      emissiveIntensity: 0.22,
    })
  );
  const pupilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090a0d,
      roughness: 0.08,
    })
  );
  const eyeShineMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    })
  );
  const suitMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialOutfit.suitColor,
      map: textures?.suitAlbedo || null,
      bumpMap: textures?.suitBump || null,
      bumpScale: 0.02,
      roughness: 0.52,
      metalness: 0.05,
      envMapIntensity: 0.4,
    })
  );
  const lapelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialOutfit.lapelColor,
      map: textures?.suitAlbedo || null,
      bumpMap: textures?.suitBump || null,
      bumpScale: 0.014,
      roughness: 0.38,
      metalness: 0.1,
      envMapIntensity: 0.45,
    })
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xebeef5,
      roughness: 0.64,
      metalness: 0.02,
      envMapIntensity: 0.32,
    })
  );
  const tieMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialOutfit.tieColor,
      roughness: 0.28,
      metalness: 0.16,
      envMapIntensity: 0.55,
    })
  );
  const goldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: initialOutfit.trimColor,
      metalness: 0.88,
      roughness: 0.25,
      clearcoat: 0.3,
      envMapIntensity: 0.82,
    })
  );
  const sunglassesMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: initialOutfit.sunglassesTint,
      metalness: 0.24,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.25,
    })
  );
  const frameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b0d12,
      roughness: 0.2,
      metalness: 0.45,
      envMapIntensity: 0.9,
    })
  );
  const sneakerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeef1f7,
      bumpMap: textures?.suitBump || null,
      bumpScale: 0.01,
      roughness: 0.38,
      metalness: 0.05,
      envMapIntensity: 0.45,
    })
  );
  const soleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9b190,
      roughness: 0.8,
      metalness: 0.02,
      envMapIntensity: 0.25,
    })
  );
  const clawMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x33221c,
      roughness: 0.45,
      metalness: 0.1,
    })
  );

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // --- ATHLETIC LION TORSO & ROYAL TAILORED JACKET ---
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.05, 0);
  bodyPivot.add(torsoGroup);

  const torsoProfile = [
    new THREE.Vector2(0.01, -0.08),
    new THREE.Vector2(0.265, -0.05),
    new THREE.Vector2(0.245, 0.14),
    new THREE.Vector2(0.32, 0.38),
    new THREE.Vector2(0.39, 0.6),
    new THREE.Vector2(0.28, 0.72),
    new THREE.Vector2(0.01, 0.74),
  ];
  const torsoGeo = trackGeo(new THREE.LatheGeometry(torsoProfile, 22));
  torsoGeo.scale(1.04, 1.0, 0.58);
  const chest = new THREE.Mesh(torsoGeo, suitMat);
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Sculpted rear tailored center seam, back vent & crisp shoulder yoke for third-person chase silhouette
  const backSeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.44, 0.024)), lapelMat);
  backSeam.position.set(0, 0.22, -0.172);
  torsoGroup.add(backSeam);

  const shoulderYoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.04, 0.03)), lapelMat);
  shoulderYoke.position.set(0, 0.56, -0.182);
  torsoGroup.add(shoulderYoke);

  const backVentL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.115, 0.2, 0.03)), suitMat);
  backVentL.position.set(-0.072, -0.04, -0.176);
  backVentL.rotation.z = -0.07;
  torsoGroup.add(backVentL);

  const backVentR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.115, 0.2, 0.03)), suitMat);
  backVentR.position.set(0.072, -0.04, -0.176);
  backVentR.rotation.z = 0.07;
  torsoGroup.add(backVentR);

  // Muscular fur neck pillar connecting shoulders cleanly into head & mane
  const neckPillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.165, 0.21, 0.22, 14)), furMat);
  neckPillar.position.set(0, 0.75, 0.02);
  torsoGroup.add(neckPillar);

  // Sculpted shoulder pads
  [-0.365, 0.365].forEach((sx) => {
    const pad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.145, 14, 12)), suitMat);
    pad.position.set(sx, 0.61, 0);
    pad.scale.set(1.14, 0.84, 0.94);
    pad.castShadow = true;
    torsoGroup.add(pad);
  });

  // Tailored contoured jacket hem tapering smoothly over the hips
  const hemGeo = trackGeo(new THREE.CylinderGeometry(0.268, 0.288, 0.22, 20));
  hemGeo.scale(1.02, 1, 0.62);
  const jacketHem = new THREE.Mesh(hemGeo, suitMat);
  jacketHem.position.set(0, -0.045, 0);
  jacketHem.castShadow = true;
  torsoGroup.add(jacketHem);

  // Tailored suit collar wrapping neck
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.14, 0.64, 0.16),
    new THREE.Vector3(-0.18, 0.7, 0.02),
    new THREE.Vector3(0, 0.72, -0.14),
    new THREE.Vector3(0.18, 0.7, 0.02),
    new THREE.Vector3(0.14, 0.64, 0.16),
  ]);
  const collarMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(collarCurve, 16, 0.042, 8, false)),
    lapelMat
  );
  torsoGroup.add(collarMesh);

  // Crisp V-front Dress Shirt & Beveled Peak Lapels
  const shirtGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.14, 0.25],
        [0.14, 0.25],
        [0.01, -0.22],
      ],
      0.04,
      0.01,
      0.01
    )
  );
  const shirtFront = new THREE.Mesh(shirtGeo, shirtMat);
  shirtFront.position.set(0, 0.46, 0.228);
  torsoGroup.add(shirtFront);

  const lapelShapeGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.07, 0.23],
        [0.03, 0.24],
        [0.08, 0.06],
        [0.01, -0.24],
        [-0.05, -0.18],
      ],
      0.032,
      0.012,
      0.012
    )
  );
  const lapelL = new THREE.Mesh(lapelShapeGeo, lapelMat);
  lapelL.position.set(-0.135, 0.45, 0.248);
  lapelL.rotation.z = -0.22;
  lapelL.rotation.y = 0.2;
  torsoGroup.add(lapelL);

  const lapelR = new THREE.Mesh(lapelShapeGeo, lapelMat);
  lapelR.position.set(0.135, 0.45, 0.248);
  lapelR.scale.x = -1;
  lapelR.rotation.z = 0.22;
  lapelR.rotation.y = -0.2;
  torsoGroup.add(lapelR);

  // Gold Suit Buttons
  [0.24, 0.14].forEach((by) => {
    const btn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 12)), goldMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.02, by, 0.232);
    torsoGroup.add(btn);
  });

  // Silk Tie + Sculpted Windsor Knot + Gold Tie Bar
  const tieKnotGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.045, 0.042],
        [0.045, 0.042],
        [0.025, -0.042],
        [-0.025, -0.042],
      ],
      0.032,
      0.012,
      0.012
    )
  );
  const tieKnot = new THREE.Mesh(tieKnotGeo, tieMat);
  tieKnot.position.set(0, 0.62, 0.262);
  torsoGroup.add(tieKnot);

  const tieBladeGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.026, 0.18],
        [0.026, 0.18],
        [0.045, -0.12],
        [0, -0.19],
        [-0.045, -0.12],
      ],
      0.018,
      0.006,
      0.006
    )
  );
  const tieBlade = new THREE.Mesh(tieBladeGeo, tieMat);
  tieBlade.position.set(0, 0.42, 0.262);
  torsoGroup.add(tieBlade);

  const tieClip = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.01, 0.068, 4, 8)), goldMat);
  tieClip.rotation.z = Math.PI / 2;
  tieClip.position.set(0, 0.42, 0.276);
  torsoGroup.add(tieClip);

  // Thick Sculpted Double-Strand Cuban Golden Chain seated flush along lapels + Lion Crest Medallion
  const chainArc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.142, 0.645, 0.165),
    new THREE.Vector3(-0.122, 0.515, 0.242),
    new THREE.Vector3(0, 0.415, 0.278),
    new THREE.Vector3(0.122, 0.515, 0.242),
    new THREE.Vector3(0.142, 0.645, 0.165),
  ]);
  const chainRope = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(chainArc, 26, 0.028, 12, false)),
    goldMat
  );
  torsoGroup.add(chainRope);

  const chainOuterArc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.158, 0.635, 0.16),
    new THREE.Vector3(-0.138, 0.495, 0.246),
    new THREE.Vector3(0, 0.382, 0.284),
    new THREE.Vector3(0.138, 0.495, 0.246),
    new THREE.Vector3(0.158, 0.635, 0.16),
  ]);
  const chainOuterRope = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(chainOuterArc, 26, 0.017, 10, false)),
    goldMat
  );
  torsoGroup.add(chainOuterRope);

  const chainMedallion = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 18)), goldMat);
  chainMedallion.position.set(0, 0.365, 0.28);
  chainMedallion.rotation.x = Math.PI / 2;
  torsoGroup.add(chainMedallion);

  const medallionRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.05, 0.011, 8, 18)), goldMat);
  medallionRing.position.set(0, 0.365, 0.288);
  torsoGroup.add(medallionRing);

  const medallionCrest = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.028, 10, 8)), goldMat);
  medallionCrest.position.set(0, 0.365, 0.286);
  medallionCrest.scale.set(1, 1, 0.45);
  torsoGroup.add(medallionCrest);

  const brooch = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.038, 1)), goldMat);
  brooch.position.set(0.19, 0.5, 0.268);
  brooch.scale.set(1.0, 1.1, 0.5);
  torsoGroup.add(brooch);

  // Belt & Beveled Golden Lion Buckle
  const belt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.285, 0.295, 0.082, 18)), tieMat);
  belt.scale.set(1.04, 1, 0.65);
  belt.position.set(0, 0.05, 0);
  torsoGroup.add(belt);

  const buckleGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.065, 0.048],
        [0.065, 0.048],
        [0.072, 0],
        [0.065, -0.048],
        [-0.065, -0.048],
        [-0.072, 0],
      ],
      0.032,
      0.012,
      0.012
    )
  );
  const beltBuckle = new THREE.Mesh(buckleGeo, goldMat);
  beltBuckle.position.set(0, 0.05, 0.215);
  torsoGroup.add(beltBuckle);

  const pelvis = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.28, 14, 12)), suitMat);
  pelvis.scale.set(1.05, 0.55, 0.72);
  pelvis.position.set(0, -0.08, 0);
  torsoGroup.add(pelvis);

  // --- LONG CURVED LION TAIL WITH SOFT ROUNDED TEARDROP TUFT ---
  const tailBase = new THREE.Group();
  tailBase.position.set(0, -0.02, -0.18);
  torsoGroup.add(tailBase);

  const tailCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.12, -0.22),
    new THREE.Vector3(0.02, -0.26, -0.38),
  ]);
  const tailMesh1 = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(tailCurve1, 10, 0.042, 8, false)), furMat);
  tailMesh1.castShadow = true;
  tailBase.add(tailMesh1);

  const tailTip = new THREE.Group();
  tailTip.position.set(0.02, -0.26, -0.38);
  tailBase.add(tailTip);

  const tailCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.1, -0.16),
    new THREE.Vector3(0, -0.16, -0.32),
  ]);
  const tailMesh2 = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(tailCurve2, 8, 0.032, 8, false)), furMat);
  tailTip.add(tailMesh2);

  const tailTuftGeo = trackGeo(createSweptLockGeometry(0.062, 0.056, 0.25, -0.02));
  const tuft1 = new THREE.Mesh(tailTuftGeo, maneOuterMat);
  tuft1.position.set(0, -0.155, -0.31);
  tuft1.rotation.x = -1.68;
  tailTip.add(tuft1);

  // --- REALISTIC LION HEAD, PROPORTIONAL RATIO, AND LAYERED SWEPT MANE ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.82, 0.03);
  // Athletic proportional head-to-body ratio (~1:6.3 hero scale so mane & head never look oversized)
  headGroup.scale.setScalar(0.84);
  torsoGroup.add(headGroup);

  // Anatomical Lion Cranium (broad cheekbones + warm forehead)
  const headMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.265, 24, 20)), furMat);
  headMesh.scale.set(1.0, 1.02, 1.05);
  headMesh.position.y = 0.14;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Upper cheek & zygomatic fullness so the face reads distinctly feline
  [-0.145, 0.145].forEach((cx) => {
    const zygoma = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.125, 14, 12)), furMat);
    zygoma.position.set(cx, 0.095, 0.16);
    zygoma.scale.set(1.05, 0.85, 0.95);
    headGroup.add(zygoma);
  });

  // Articulated Sculpted Eyebrows (visible & animated!)
  const browGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.068, 0.018],
        [0.058, 0.024],
        [0.072, -0.008],
        [-0.062, -0.018],
      ],
      0.03,
      0.012,
      0.012
    )
  );
  const browL = new THREE.Mesh(browGeo, maneOuterMat);
  browL.position.set(-0.105, 0.26, 0.265);
  browL.rotation.set(0.08, -0.18, -0.12);
  headGroup.add(browL);

  const browR = new THREE.Mesh(browGeo, maneOuterMat);
  browR.position.set(0.105, 0.26, 0.265);
  browR.scale.x = -1;
  browR.rotation.set(0.08, 0.18, 0.12);
  headGroup.add(browR);

  // Expressive Lion Eyes (sclera + glowing amber iris + dark vertical feline pupil + white specular catchlight)
  [-1, 1].forEach((side) => {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.104, 0.192, 0.242);
    eyeSocket.rotation.y = side * 0.18;
    headGroup.add(eyeSocket);

    const rim = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.049, 12, 10)), noseMat);
    rim.scale.set(1.12, 0.92, 0.52);
    eyeSocket.add(rim);

    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.044, 14, 12)), scleraMat);
    sclera.position.z = 0.008;
    sclera.scale.set(1.08, 0.86, 0.56);
    eyeSocket.add(sclera);

    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 14, 12)), eyeAmberMat);
    iris.position.set(-side * 0.004, 0.0, 0.024);
    iris.scale.set(0.95, 0.95, 0.45);
    eyeSocket.add(iris);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.018, 12, 10)), pupilMat);
    pupil.position.set(-side * 0.004, 0.0, 0.034);
    pupil.scale.set(0.68, 1.05, 0.4);
    eyeSocket.add(pupil);

    const catchlight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.007, 8, 8)), eyeShineMat);
    catchlight.position.set(0.011, 0.013, 0.04);
    eyeSocket.add(catchlight);
  });

  // Soft warm cheek fullness blending smoothly into the upper muzzle
  [-0.165, 0.165].forEach((cx) => {
    const cheek = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 14, 12)), furMat);
    cheek.position.set(cx, 0.055, 0.11);
    cheek.scale.set(1.0, 0.92, 0.88);
    headGroup.add(cheek);
  });

  // Broad Lion Nose Bridge & Fleshy Muzzle Pads
  const bridge = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.072, 0.12, 8, 14)), furMat);
  bridge.position.set(0, 0.145, 0.258);
  bridge.rotation.x = 0.78;
  bridge.scale.set(0.98, 1.0, 0.86);
  headGroup.add(bridge);

  const padGeo = trackGeo(new THREE.SphereGeometry(0.104, 16, 14));
  const padL = new THREE.Mesh(padGeo, snoutMat);
  padL.position.set(-0.076, 0.048, 0.302);
  padL.scale.set(1.08, 0.88, 1.15);
  headGroup.add(padL);

  const padR = padL.clone();
  padR.position.x = 0.076;
  headGroup.add(padR);

  // Lion whiskers
  const whiskerGeo = trackGeo(new THREE.CylinderGeometry(0.0038, 0.0016, 0.16, 6));
  [-1, 1].forEach((side) => {
    [-0.02, 0.015].forEach((wy) => {
      const w = new THREE.Mesh(whiskerGeo, snoutMat);
      w.position.set(side * 0.16, 0.05 + wy, 0.315);
      w.rotation.z = side * (1.42 + wy * 3);
      w.rotation.y = side * -0.22;
      headGroup.add(w);
    });
  });

  // Sculpted Triangular Lion Nose with Nostril Relief
  const noseGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.064, 0.028],
        [0.064, 0.028],
        [0.042, -0.034],
        [0, -0.048],
        [-0.042, -0.034],
      ],
      0.045,
      0.016,
      0.016
    )
  );
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.108, 0.382);
  headGroup.add(nose);

  // Confident Feline Smile & Rounded Chin
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.062, 0.012, 0.358),
    new THREE.Vector3(0, -0.01, 0.372),
    new THREE.Vector3(0.062, 0.012, 0.358),
  ]);
  const mouthLine = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(mouthCurve, 10, 0.01, 6, false)), noseMat);
  headGroup.add(mouthLine);

  const chin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.105, 14, 12)), snoutMat);
  chin.scale.set(1.16, 0.84, 1.05);
  chin.position.set(0, -0.045, 0.268);
  headGroup.add(chin);

  // Rounded Lion Ears peeking cleanly out of the top mane silhouette
  [-1, 1].forEach((side) => {
    const earOuter = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.098, 14, 12)), furMat);
    earOuter.position.set(side * 0.255, 0.375, 0.04);
    earOuter.scale.set(0.98, 1.1, 0.56);
    earOuter.rotation.z = side * -0.22;
    headGroup.add(earOuter);

    const earInner = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 10, 8)), earInnerMat);
    earInner.position.set(side * 0.255, 0.375, 0.072);
    earInner.scale.set(0.85, 0.96, 0.34);
    earInner.rotation.z = side * -0.22;
    headGroup.add(earInner);
  });

  // Optional Sunglasses Group (Shown on White King & Midnight Tux, hidden on Golden Hero)
  const sunglassesGroup = new THREE.Group();
  sunglassesGroup.visible = Boolean(initialOutfit.hasSunglasses);
  headGroup.add(sunglassesGroup);

  const lensShapeGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.094, 0.044],
        [0.092, 0.044],
        [0.08, -0.036],
        [0.018, -0.046],
        [-0.072, -0.04],
      ],
      0.016,
      0.008,
      0.008
    )
  );
  const lensL = new THREE.Mesh(lensShapeGeo, sunglassesMat);
  lensL.position.set(-0.112, 0.194, 0.308);
  lensL.rotation.y = -0.16;
  sunglassesGroup.add(lensL);

  const lensR = new THREE.Mesh(lensShapeGeo, sunglassesMat);
  lensR.position.set(0.112, 0.194, 0.308);
  lensR.scale.x = -1;
  lensR.rotation.y = 0.16;
  sunglassesGroup.add(lensR);

  const frameRimCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.205, 0.232, 0.286),
    new THREE.Vector3(-0.042, 0.236, 0.316),
    new THREE.Vector3(0.042, 0.236, 0.316),
    new THREE.Vector3(0.205, 0.232, 0.286),
  ]);
  const topFrame = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(frameRimCurve, 16, 0.012, 8, false)),
    frameMat
  );
  sunglassesGroup.add(topFrame);

  const glassBridge = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.008, 0.048, 4, 8)), goldMat);
  glassBridge.rotation.z = Math.PI / 2;
  glassBridge.position.set(0, 0.222, 0.316);
  sunglassesGroup.add(glassBridge);

  [-1, 1].forEach((side) => {
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.202, 0.218, 0.286),
      new THREE.Vector3(side * 0.224, 0.21, 0.16),
      new THREE.Vector3(side * 0.212, 0.18, 0.04),
    ]);
    const temple = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(templeCurve, 10, 0.011, 6, false)),
      frameMat
    );
    sunglassesGroup.add(temple);

    const hinge = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.013, 0.013, 0.032, 8)), goldMat);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(side * 0.202, 0.216, 0.282);
    sunglassesGroup.add(hinge);
  });

  // --- LAYERED, FLOWING SCULPTED LION MANE (CONSISTENT FRONT & REAR, NO SPIKES OR PILLOWS) ---
  const maneGroup = new THREE.Group();
  maneGroup.position.set(0, 0.13, -0.04);
  headGroup.add(maneGroup);

  // Cohesive sculpted crown + tapered rear nape mantle so the back reads like lush layered fur instead of separated scales
  const crownBolster = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.288, 22, 18)), maneOuterMat);
  crownBolster.position.set(0, 0.035, -0.055);
  crownBolster.scale.set(1.06, 1.0, 0.92);
  crownBolster.castShadow = true;
  maneGroup.add(crownBolster);

  const napeMantleGeo = trackGeo(createRoundedManeLobeGeometry(0.255, 0.44, -0.05, 16));
  const napeMantle = new THREE.Mesh(napeMantleGeo, maneOuterMat);
  napeMantle.position.set(0, 0.03, -0.14);
  napeMantle.rotation.x = 2.92;
  napeMantle.scale.set(1.14, 1.0, 0.72);
  napeMantle.castShadow = true;
  maneGroup.add(napeMantle);

  // Plush curved swept lock geometries (rounded feathered ends hugging head & cascading down collar)
  const faceLockGeo = trackGeo(createSweptLockGeometry(0.095, 0.052, 0.21, -0.11));
  const cheekLockGeo = trackGeo(createSweptLockGeometry(0.102, 0.054, 0.24, -0.12));
  const midLockGeo = trackGeo(createSweptLockGeometry(0.108, 0.056, 0.26, -0.13));
  const backCascadeGeo = trackGeo(createSweptLockGeometry(0.115, 0.056, 0.3, -0.05));
  const crestLockGeo = trackGeo(createSweptLockGeometry(0.092, 0.05, 0.2, -0.11));

  // Tier 1: Facial ruff framing forehead (swept up-back) and cheeks (curving gently downward & back)
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (sinA < -0.62) continue; // Keep chin, black tie & gold chain cleanly visible
    const isTop = sinA > 0.38;
    const isCheek = sinA <= 0.38;
    const lobe = new THREE.Mesh(
      isTop ? crestLockGeo : cheekLockGeo,
      i % 4 === 0 ? maneInnerMat : maneOuterMat
    );
    lobe.position.set(cosA * 0.215, sinA * 0.215 + 0.025, 0.012);
    // Top locks sweep smoothly back over crown; side cheek locks curve gently downward along jaw instead of sticking straight out!
    lobe.rotation.z = isCheek ? angle - Math.PI / 2 + (cosA > 0 ? -0.45 : 0.45) : angle - Math.PI / 2;
    lobe.rotation.x = isTop ? -1.36 : -1.78;
    lobe.castShadow = true;
    maneGroup.add(lobe);
  }

  // Tier 2: Crown & outer ruff swept backward smoothly to unify front and rear silhouette
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + 0.19;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (sinA < -0.58) continue;
    const lobe = new THREE.Mesh(
      sinA < 0.2 ? faceLockGeo : midLockGeo,
      i % 5 === 0 ? maneInnerMat : maneOuterMat
    );
    lobe.position.set(cosA * 0.245, sinA * 0.245 + 0.02, -0.05);
    lobe.rotation.z = sinA < 0.25 ? angle - Math.PI / 2 + (cosA > 0 ? -0.4 : 0.4) : angle - Math.PI / 2;
    lobe.rotation.x = -1.72;
    lobe.castShadow = true;
    maneGroup.add(lobe);
  }

  // Tier 3: Lush Rear Cascading V-Tapered Locks hugging the nape smoothly down onto the upper jacket
  const backRows: { y: number; z: number; xs: number[]; scale: number; tiltX: number }[] = [
    { y: 0.23, z: -0.11, xs: [-0.15, -0.05, 0.05, 0.15], scale: 0.96, tiltX: -2.42 },
    { y: 0.09, z: -0.15, xs: [-0.21, -0.11, 0, 0.11, 0.21], scale: 1.04, tiltX: -2.74 },
    { y: -0.06, z: -0.16, xs: [-0.16, -0.08, 0, 0.08, 0.16], scale: 1.0, tiltX: -2.92 },
    { y: -0.19, z: -0.14, xs: [-0.085, 0, 0.085], scale: 0.9, tiltX: -3.02 },
  ];
  backRows.forEach((row, rIdx) => {
    row.xs.forEach((bx, cIdx) => {
      const lock = new THREE.Mesh(
        backCascadeGeo,
        (rIdx + cIdx) % 4 === 1 ? maneInnerMat : maneOuterMat
      );
      lock.position.set(bx, row.y, row.z);
      lock.scale.setScalar(row.scale);
      lock.rotation.x = row.tiltX;
      lock.rotation.z = -bx * 1.1;
      lock.rotation.y = bx * 0.3;
      lock.castShadow = true;
      maneGroup.add(lock);
    });
  });

  // --- ARMS, LUXURY GOLD WRISTWATCH & ARTICULATED LION PAWS ---
  function buildArm(side: -1 | 1): [THREE.Group, THREE.Group] {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.425, 0.61, 0);
    torsoGroup.add(shoulder);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.112, 0.098, 0.36, 14)),
      suitMat
    );
    upperArm.position.y = -0.16;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.34, 0);
    shoulder.add(forearm);

    // Smooth elbow sphere preventing cylinder crease notches when bent
    const elbowJoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.098, 12, 10)), suitMat);
    elbowJoint.castShadow = true;
    forearm.add(elbowJoint);

    const sleeve = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.098, 0.088, 0.32, 14)),
      suitMat
    );
    sleeve.position.y = -0.15;
    sleeve.castShadow = true;
    forearm.add(sleeve);

    for (let b = 0; b < 3; b++) {
      const cuffBtn = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 8, 8)), goldMat);
      cuffBtn.position.set(side * 0.086, -0.18 - b * 0.032, -0.025);
      forearm.add(cuffBtn);
    }

    const goldCuff = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.096, 0.096, 0.084, 16)),
      goldMat
    );
    goldCuff.position.y = -0.285;
    forearm.add(goldCuff);

    const watchBezel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 16)),
      goldMat
    );
    watchBezel.position.set(side * 0.082, -0.285, 0.012);
    watchBezel.rotation.z = Math.PI / 2;
    forearm.add(watchBezel);

    const watchFace = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.034, 16)),
      frameMat
    );
    watchFace.position.set(side * 0.085, -0.285, 0.012);
    watchFace.rotation.z = Math.PI / 2;
    forearm.add(watchFace);

    // Articulated Lion Paw
    const pawPalm = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.088, 12, 10)), furMat);
    pawPalm.position.y = -0.375;
    pawPalm.scale.set(0.98, 1.05, 0.85);
    forearm.add(pawPalm);

    const digitGeo = trackGeo(new THREE.CapsuleGeometry(0.019, 0.044, 4, 8));
    [-0.046, -0.015, 0.016, 0.046].forEach((fx) => {
      const finger = new THREE.Mesh(digitGeo, furMat);
      finger.position.set(fx, -0.452, 0.015);
      finger.rotation.x = 0.28;
      forearm.add(finger);

      const claw = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.011, 6, 6)), clawMat);
      claw.position.set(fx, -0.482, 0.026);
      claw.scale.set(0.8, 1.3, 0.8);
      forearm.add(claw);
    });

    const thumb = new THREE.Mesh(digitGeo, furMat);
    thumb.position.set(-side * 0.068, -0.4, 0.045);
    thumb.rotation.z = side * 0.55;
    forearm.add(thumb);

    return [shoulder, forearm];
  }

  const [armL, forearmL] = buildArm(-1);
  const [armR, forearmR] = buildArm(1);

  // --- LEGS & SCULPTED AERODYNAMIC LUXURY SNEAKERS ---
  const sneakerBodyGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.17, -0.01],
        [0.14, -0.01],
        [0.19, 0.035],
        [0.09, 0.09],
        [-0.06, 0.125],
        [-0.17, 0.115],
      ],
      0.165,
      0.018,
      0.018
    )
  );
  sneakerBodyGeo.rotateY(-Math.PI / 2);

  const sneakerSoleGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.18, -0.025],
        [0.19, -0.025],
        [0.195, 0.025],
        [-0.18, 0.025],
      ],
      0.185,
      0.01,
      0.01
    )
  );
  sneakerSoleGeo.rotateY(-Math.PI / 2);

  function buildLeg(side: -1 | 1): [THREE.Group, THREE.Group] {
    const hip = new THREE.Group();
    hip.position.set(side * 0.158, 0.91, 0);
    bodyPivot.add(hip);

    const hipJoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.125, 12, 10)), suitMat);
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.128, 0.104, 0.46, 14)),
      suitMat
    );
    thigh.position.y = -0.23;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.46, 0);
    hip.add(shin);

    // Smooth knee joint sphere preventing cylinder seams in sitting/running strides
    const kneeJoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.104, 12, 10)), suitMat);
    kneeJoint.castShadow = true;
    shin.add(kneeJoint);

    const calf = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.104, 0.082, 0.43, 14)),
      suitMat
    );
    calf.position.y = -0.215;
    calf.castShadow = true;
    shin.add(calf);

    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.425, 0.04);
    shin.add(shoeGroup);

    const shoeBody = new THREE.Mesh(sneakerBodyGeo, sneakerMat);
    shoeBody.position.set(0, 0.035, 0.01);
    shoeBody.castShadow = true;
    shoeGroup.add(shoeBody);

    const shoeSole = new THREE.Mesh(sneakerSoleGeo, soleMat);
    shoeSole.position.set(0, -0.042, 0.01);
    shoeGroup.add(shoeSole);

    const tongue = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.05, 0.045, 4, 8)),
      goldMat
    );
    tongue.position.set(0, 0.1, 0.055);
    tongue.rotation.x = -0.4;
    tongue.scale.set(1.1, 0.8, 0.5);
    shoeGroup.add(tongue);

    const heelCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.088, 0.022, 8, 14, Math.PI)),
      goldMat
    );
    heelCollar.position.set(0, 0.065, -0.11);
    heelCollar.rotation.x = Math.PI / 2;
    shoeGroup.add(heelCollar);

    return [hip, shin];
  }

  const [legL, shinL] = buildLeg(-1);
  const [legR, shinR] = buildLeg(1);

  // --- SLEEK HOVERBOARD RIG ---
  const hoverboardGroup = new THREE.Group();
  hoverboardGroup.visible = false;
  bodyPivot.add(hoverboardGroup);

  const boardDeckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialBoard.primaryColor,
      roughness: 0.28,
      metalness: 0.55,
      envMapIntensity: 0.9,
    })
  );
  const boardTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialBoard.accentColor,
      roughness: 0.18,
      metalness: 0.9,
      envMapIntensity: 1.1,
    })
  );
  const boardGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialBoard.glowColor,
      emissive: initialBoard.glowColor,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    })
  );

  const deckShapeGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.36, -0.78],
        [0.36, -0.78],
        [0.42, 0],
        [0.32, 0.84],
        [0, 1.02],
        [-0.32, 0.84],
        [-0.42, 0],
      ],
      0.065,
      0.015,
      0.015
    )
  );
  deckShapeGeo.rotateX(Math.PI / 2);
  const deck = new THREE.Mesh(deckShapeGeo, boardDeckMat);
  deck.position.y = 0.04;
  deck.castShadow = true;
  hoverboardGroup.add(deck);

  const deckTrim = new THREE.Mesh(deckShapeGeo, boardTrimMat);
  deckTrim.position.y = 0.036;
  deckTrim.scale.set(1.07, 0.72, 0.92);
  hoverboardGroup.add(deckTrim);

  const hoverGlowMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.2, 0.34, 0.12, 16)),
    boardGlowMat
  );
  hoverGlowMesh.position.set(0, -0.04, -0.68);
  hoverboardGroup.add(hoverGlowMesh);

  // --- SHIELD ENERGY BUBBLE ---
  const shieldGeo = trackGeo(new THREE.SphereGeometry(1.42, 24, 18));
  const shieldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.26,
      roughness: 0.12,
      metalness: 0.2,
      depthWrite: false,
    })
  );
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.position.y = 1.15;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  // --- ROYAL INVINCIBILITY STAR AURA ---
  const invincibleAura = new THREE.Mesh(
    trackGeo(new THREE.TorusKnotGeometry(1.05, 0.045, 48, 8, 2, 3)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xd97706,
        emissiveIntensity: 0.95,
        transparent: true,
        opacity: 0.82,
      })
    )
  );
  invincibleAura.position.y = 1.18;
  invincibleAura.visible = false;
  root.add(invincibleAura);

  // --- MAGNET HALO ---
  const magnetHalo = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.98, 0.046, 8, 28)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.76,
      })
    )
  );
  magnetHalo.rotation.x = Math.PI / 2;
  magnetHalo.position.y = 1.2;
  magnetHalo.visible = false;
  root.add(magnetHalo);

  // --- ROCKET JETPACK ---
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0, 0.36, -0.26);
  rocketGroup.visible = false;
  torsoGroup.add(rocketGroup);

  const jetMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.28, metalness: 0.65 })
  );
  const flameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    })
  );

  const rocketFlames: THREE.Mesh[] = [];
  const flameGeo = trackGeo(createRoundedManeLobeGeometry(0.088, 0.48, 0, 10));
  [-0.14, 0.14].forEach((rx) => {
    const pod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.088, 0.098, 0.54, 12)), jetMat);
    pod.position.set(rx, 0, 0);
    rocketGroup.add(pod);

    const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.09, 10, 8)), goldMat);
    cap.position.set(rx, 0.28, 0);
    cap.scale.set(1, 1.4, 1);
    rocketGroup.add(cap);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(rx, -0.24, 0);
    flame.rotation.x = Math.PI;
    rocketGroup.add(flame);
    rocketFlames.push(flame);
  });

  function applyOutfit(outfit: CharacterOutfit): void {
    suitMat.color.setHex(outfit.suitColor);
    lapelMat.color.setHex(outfit.lapelColor);
    tieMat.color.setHex(outfit.tieColor);
    goldMat.color.setHex(outfit.trimColor);
    sunglassesMat.color.setHex(outfit.sunglassesTint);
    furMat.color.setHex(outfit.furColor ?? 0xf4efe7);
    snoutMat.color.setHex(outfit.snoutColor ?? 0xfdf5e6);
    maneOuterMat.color.setHex(outfit.maneOuterColor ?? 0xf4eee4);
    maneInnerMat.color.setHex(outfit.maneInnerColor ?? 0xe2d9cc);
    sunglassesGroup.visible = Boolean(outfit.hasSunglasses);
  }

  function applyHoverboard(board: HoverboardItem): void {
    boardDeckMat.color.setHex(board.primaryColor);
    boardTrimMat.color.setHex(board.accentColor);
    boardGlowMat.color.setHex(board.glowColor);
    boardGlowMat.emissive.setHex(board.glowColor);
  }

  function resetPose(): void {
    bodyPivot.position.set(0, 0, 0);
    bodyPivot.rotation.set(0, 0, 0);
    bodyPivot.scale.set(1, 1, 1);
    torsoGroup.position.set(0, 1.05, 0);
    torsoGroup.rotation.set(0, 0, 0);
    torsoGroup.scale.set(1, 1, 1);
    headGroup.rotation.set(0, 0, 0);
    maneGroup.rotation.set(0, 0, 0);
    browL.position.y = 0.26;
    browR.position.y = 0.26;
    browL.rotation.z = -0.12;
    browR.rotation.z = 0.12;
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);
    forearmL.rotation.set(0, 0, 0);
    forearmR.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    shinL.rotation.set(0, 0, 0);
    shinR.rotation.set(0, 0, 0);
    tailBase.rotation.set(0, 0, 0);
    tailTip.rotation.set(0, 0, 0);
  }

  // Smooth damped pose helper for fluid transitions between running, jumping, sliding, and landing
  let lastState: SheraAnimState = 'throne';

  function blendRotation(
    obj: THREE.Object3D,
    tx: number,
    ty: number,
    tz: number,
    rate: number,
    dt: number
  ): void {
    obj.rotation.x = THREE.MathUtils.damp(obj.rotation.x, tx, rate, dt);
    obj.rotation.y = THREE.MathUtils.damp(obj.rotation.y, ty, rate, dt);
    obj.rotation.z = THREE.MathUtils.damp(obj.rotation.z, tz, rate, dt);
  }

  function updateAnimation(
    state: SheraAnimState,
    time: number,
    dt: number,
    speed: number,
    laneTilt: number,
    squashY: number,
    doubleJumpSpin = 0
  ): void {
    const isDiscrete = state === 'throne' || state === 'idle' || state === 'victory';
    if (isDiscrete || lastState === 'throne' || lastState === 'idle') {
      resetPose();
    }
    lastState = state;

    const invSq = 1 / Math.max(0.7, Math.sqrt(squashY));
    bodyPivot.scale.set(invSq, squashY, invSq);

    if (state === 'throne') {
      const breath = Math.sin(time * 1.85);
      bodyPivot.position.set(0, 0.34, 0.14);
      torsoGroup.rotation.set(-0.12 + breath * 0.016, 0.04, 0);
      torsoGroup.scale.set(1 + breath * 0.015, 1 + breath * 0.01, 1 + breath * 0.016);
      headGroup.rotation.set(0.03 + Math.sin(time * 1.2) * 0.025, -0.04 + Math.sin(time * 0.65) * 0.05, 0);
      browL.position.y = 0.264 + breath * 0.004;
      browR.position.y = 0.264 + breath * 0.004;

      // Confident Royal King Armrest Pose: both forearms draped naturally over the velvet armrests
      armR.rotation.set(-0.56, -0.1, 0.44);
      forearmR.rotation.set(-0.78 + Math.sin(time * 1.3) * 0.02, 0.1, -0.2);

      armL.rotation.set(-0.56, 0.1, -0.44);
      forearmL.rotation.set(-0.78 - Math.sin(time * 1.3) * 0.02, -0.1, 0.2);

      legL.rotation.set(-1.42, 0.24, -0.12);
      shinL.rotation.set(1.36, 0, 0);
      legR.rotation.set(-1.38, -0.45, -0.38);
      shinR.rotation.set(1.05, 0.18, 0.55);

      tailBase.rotation.set(0.3, Math.sin(time * 2.0) * 0.22, 0);
      return;
    }

    if (state === 'idle') {
      torsoGroup.position.y = 1.02 + Math.sin(time * 2.5) * 0.025;
      armL.rotation.z = -0.15;
      armR.rotation.z = 0.15;
      tailBase.rotation.y = Math.sin(time * 2.5) * 0.25;
      return;
    }

    if (state === 'victory') {
      bodyPivot.position.y = Math.abs(Math.sin(time * 8)) * 0.36;
      bodyPivot.rotation.y = Math.sin(time * 3.5) * 0.3;
      armL.rotation.set(-2.45, 0, -0.35);
      armR.rotation.set(-2.45, 0, 0.35);
      browL.position.y = 0.275;
      browR.position.y = 0.275;
      tailBase.rotation.y = Math.sin(time * 8) * 0.45;
      return;
    }

    const blend = 18;
    const safeDt = Math.max(dt, 0.001);

    if (state === 'run' || state === 'speedBoost') {
      const freq = (state === 'speedBoost' ? 12.6 : 9.6) + (speed - 24) * 0.2;
      const phase = time * freq;
      const s = Math.sin(phase);
      const c = Math.cos(phase);

      // Natural stride bounce keeping grounded feet cleanly planted on the stone bridge
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, Math.abs(c) * 0.036, blend, safeDt);
      blendRotation(bodyPivot, 0, 0, laneTilt * 0.34, blend, safeDt);

      torsoGroup.position.y = THREE.MathUtils.damp(torsoGroup.position.y, 1.03 + Math.abs(c) * 0.025, blend, safeDt);
      blendRotation(
        torsoGroup,
        state === 'speedBoost' ? 0.34 : 0.24,
        s * 0.13 + laneTilt * 0.18,
        -laneTilt * 0.06,
        blend,
        safeDt
      );

      blendRotation(headGroup, -0.18, -s * 0.08 - laneTilt * 0.2, 0, blend, safeDt);
      maneGroup.rotation.x = Math.sin(phase * 2) * 0.04;
      maneGroup.rotation.z = -laneTilt * 0.08;
      browL.position.y = 0.256;
      browR.position.y = 0.256;
      browL.rotation.z = -0.18;
      browR.rotation.z = 0.18;

      // Athletic stride with realistic forward knee drive and rear kick bend
      blendRotation(legL, s * 0.98, 0, 0, 26, safeDt);
      blendRotation(legR, -s * 0.98, 0, 0, 26, safeDt);
      const kneeBendL = Math.max(0.08, -c * 0.85 + 0.42 + Math.max(0, -s) * 0.35);
      const kneeBendR = Math.max(0.08, c * 0.85 + 0.42 + Math.max(0, s) * 0.35);
      shinL.rotation.x = THREE.MathUtils.damp(shinL.rotation.x, kneeBendL, 26, safeDt);
      shinR.rotation.x = THREE.MathUtils.damp(shinR.rotation.x, kneeBendR, 26, safeDt);

      blendRotation(
        armL,
        -s * 0.92,
        0,
        -0.2 - Math.max(0, laneTilt) * 0.22,
        24,
        safeDt
      );
      blendRotation(
        armR,
        s * 0.92,
        0,
        0.2 - Math.min(0, laneTilt) * 0.22,
        24,
        safeDt
      );
      blendRotation(forearmL, -1.12 + s * 0.18, 0, 0, 24, safeDt);
      blendRotation(forearmR, -1.12 - s * 0.18, 0, 0, 24, safeDt);

      tailBase.rotation.x = 0.28 + Math.sin(phase * 2) * 0.09;
      tailBase.rotation.y = -s * 0.38;
      tailTip.rotation.y = -c * 0.32;
      return;
    }

    if (state === 'jump') {
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, 0, blend, safeDt);
      blendRotation(bodyPivot, 0, 0, laneTilt * 0.32, blend, safeDt);
      torsoGroup.position.y = THREE.MathUtils.damp(torsoGroup.position.y, 1.05, blend, safeDt);
      blendRotation(torsoGroup, 0.14, 0, 0, blend, safeDt);
      blendRotation(headGroup, -0.1, -laneTilt * 0.2, 0, blend, safeDt);
      browL.position.y = 0.274;
      browR.position.y = 0.274;
      blendRotation(armL, -1.35, 0, -0.44, 20, safeDt);
      blendRotation(armR, -0.95, 0, 0.44, 20, safeDt);
      blendRotation(forearmL, -0.48, 0, 0, 20, safeDt);
      blendRotation(forearmR, -0.58, 0, 0, 20, safeDt);
      blendRotation(legL, -0.66, 0, 0, 20, safeDt);
      shinL.rotation.x = THREE.MathUtils.damp(shinL.rotation.x, 1.06, 20, safeDt);
      blendRotation(legR, 0.36, 0, 0, 20, safeDt);
      shinR.rotation.x = THREE.MathUtils.damp(shinR.rotation.x, 0.44, 20, safeDt);
      tailBase.rotation.x = 0.54;
      return;
    }

    if (state === 'doubleJump') {
      bodyPivot.position.y = 1.05;
      bodyPivot.rotation.set(doubleJumpSpin, 0, laneTilt * 0.25);
      torsoGroup.position.y = 0.0;
      torsoGroup.rotation.set(0, 0, 0);
      armL.rotation.set(-1.6, 0, -0.5);
      armR.rotation.set(-1.6, 0, 0.5);
      legL.rotation.set(-1.1, 0, 0);
      shinL.rotation.x = 1.6;
      legR.rotation.set(-1.1, 0, 0);
      shinR.rotation.x = 1.6;
      return;
    }

    if (state === 'slide') {
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, 0.0, 24, safeDt);
      blendRotation(bodyPivot, 0, 0, laneTilt * 0.22, 24, safeDt);
      torsoGroup.position.y = THREE.MathUtils.damp(torsoGroup.position.y, 0.26, 24, safeDt);
      blendRotation(torsoGroup, -1.3, 0, 0, 24, safeDt);
      blendRotation(headGroup, 0.72, 0, 0, 24, safeDt);
      blendRotation(armL, 0.45, 0, -0.78, 24, safeDt);
      blendRotation(armR, 0.45, 0, 0.78, 24, safeDt);
      blendRotation(forearmL, -0.35, 0, 0, 24, safeDt);
      blendRotation(forearmR, -0.35, 0, 0, 24, safeDt);
      blendRotation(legL, -1.46, 0, -0.1, 24, safeDt);
      shinL.rotation.x = THREE.MathUtils.damp(shinL.rotation.x, 0.12, 24, safeDt);
      blendRotation(legR, -0.54, 0, 0.22, 24, safeDt);
      shinR.rotation.x = THREE.MathUtils.damp(shinR.rotation.x, 1.44, 24, safeDt);
      tailBase.rotation.x = -0.35;
      return;
    }

    if (state === 'hoverboard') {
      bodyPivot.position.y = 0.24 + Math.sin(time * 7) * 0.05;
      blendRotation(bodyPivot, 0, 0, laneTilt * 0.46, blend, safeDt);
      torsoGroup.position.y = 1.02;
      blendRotation(torsoGroup, 0.12, 0.42, 0, blend, safeDt);
      blendRotation(headGroup, 0, -0.35, 0, blend, safeDt);
      blendRotation(armL, -0.3, 0, -0.78, blend, safeDt);
      blendRotation(armR, 0.2, 0, 0.78, blend, safeDt);
      blendRotation(legL, -0.22, 0, -0.14, blend, safeDt);
      shinL.rotation.x = 0.42;
      blendRotation(legR, 0.18, 0, 0.14, blend, safeDt);
      shinR.rotation.x = 0.38;
      tailBase.rotation.y = Math.sin(time * 5) * 0.3;
      hoverboardGroup.rotation.y = 0.15;
      hoverGlowMesh.scale.y = 1 + Math.sin(time * 24) * 0.25;
      return;
    }

    if (state === 'rocket') {
      bodyPivot.position.y = 0.4;
      blendRotation(bodyPivot, 1.15, 0, laneTilt * 0.55, blend, safeDt);
      torsoGroup.position.y = 1.02;
      blendRotation(headGroup, -0.85, 0, 0, blend, safeDt);
      blendRotation(armL, -2.6, 0, -0.15, blend, safeDt);
      blendRotation(armR, -2.6, 0, 0.15, blend, safeDt);
      legL.rotation.set(0.12, 0, 0);
      legR.rotation.set(-0.12, 0, 0);
      tailBase.rotation.x = 0.6;
      rocketFlames.forEach((f, idx) => {
        f.scale.set(1, 0.8 + Math.sin(time * 38 + idx) * 0.35, 1);
      });
      return;
    }

    if (state === 'stumble') {
      bodyPivot.position.y = 0.08;
      bodyPivot.rotation.set(-0.22, 0, Math.sin(time * 32) * 0.24);
      headGroup.rotation.set(0, Math.sin(time * 28) * 0.32, 0);
      browL.position.y = 0.278;
      browR.position.y = 0.278;
      armL.rotation.set(-0.6, 0, -0.65);
      armR.rotation.set(-0.6, 0, 0.65);
      return;
    }

    if (state === 'collide') {
      bodyPivot.position.y = 0.12;
      bodyPivot.rotation.set(-0.68, 0, Math.sin(time * 18) * 0.28);
      headGroup.rotation.set(0, Math.sin(time * 24) * 0.4, 0);
      browL.position.y = 0.28;
      browR.position.y = 0.28;
      armL.rotation.set(-1.1, 0, -0.85);
      armR.rotation.set(-1.1, 0, 0.85);
    }
  }

  return {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    maneGroup,
    armL,
    armR,
    forearmL,
    forearmR,
    legL,
    legR,
    shinL,
    shinR,
    tailBase,
    tailTip,
    hoverboardGroup,
    hoverGlowMesh,
    shieldMesh,
    rocketGroup,
    rocketFlames,
    magnetHalo,
    invincibleAura,
    sunglassesGroup,
    applyOutfit,
    applyHoverboard,
    updateAnimation,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function createRoyalThrone(): { group: THREE.Group; dispose: () => void } {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ensureUv2(g);
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const goldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4b926,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.7,
      envMapIntensity: 1.2,
    })
  );
  const goldDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb97b14,
      metalness: 0.88,
      roughness: 0.26,
      envMapIntensity: 0.95,
    })
  );
  const velvetMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x990f26,
      roughness: 0.86,
      metalness: 0.03,
      envMapIntensity: 0.28,
    })
  );
  const velvetDeepMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b091a,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.2,
    })
  );
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x41485c,
      roughness: 0.66,
      metalness: 0.14,
      envMapIntensity: 0.36,
    })
  );
  const marbleStepMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c3346,
      roughness: 0.56,
      metalness: 0.16,
      envMapIntensity: 0.4,
    })
  );
  const runeGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    })
  );
  const amberEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 1.05,
    })
  );

  const group = new THREE.Group();

  // Grand Stepped Stone & Gold Dais
  const daisLower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.4, 3.85, 0.3, 40)), marbleStepMat);
  daisLower.position.y = -0.34;
  daisLower.receiveShadow = true;
  group.add(daisLower);

  const daisUpper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.65, 2.95, 0.24, 40)), stoneMat);
  daisUpper.position.y = -0.11;
  daisUpper.receiveShadow = true;
  group.add(daisUpper);

  const daisGoldRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.68, 0.075, 12, 48)), goldMat);
  daisGoldRing.rotation.x = Math.PI / 2;
  daisGoldRing.position.y = 0.015;
  group.add(daisGoldRing);

  const daisRuneRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.38, 0.045, 10, 48)), runeGlowMat);
  daisRuneRing.rotation.x = Math.PI / 2;
  daisRuneRing.position.y = -0.18;
  group.add(daisRuneRing);

  // Carved Throne Base & Plush Velvet Cushion
  const throneBaseGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.92, -0.3],
        [0.92, -0.3],
        [0.98, 0.3],
        [-0.98, 0.3],
      ],
      1.42,
      0.045,
      0.045
    )
  );
  const throneBase = new THREE.Mesh(throneBaseGeo, goldMat);
  throneBase.position.set(0, 0.3, -0.05);
  throneBase.castShadow = true;
  throneBase.receiveShadow = true;
  group.add(throneBase);

  const plinthTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.04, 0.14, 1.54)), goldDarkMat);
  plinthTrim.position.set(0, 0.07, -0.05);
  plinthTrim.castShadow = true;
  group.add(plinthTrim);

  const cushionGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.68, -0.12],
        [0.68, -0.12],
        [0.68, 0.12],
        [-0.68, 0.12],
      ],
      1.16,
      0.06,
      0.06
    )
  );
  const cushion = new THREE.Mesh(cushionGeo, velvetMat);
  cushion.position.set(0, 0.67, 0.05);
  group.add(cushion);

  // Tufted vertical velvet backrest bolsters & diamond gold buttons
  const backFrameGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.88, -1.12],
        [0.88, -1.12],
        [0.92, 0.88],
        [0.48, 1.24],
        [0, 1.36],
        [-0.48, 1.24],
        [-0.92, 0.88],
      ],
      0.24,
      0.05,
      0.05
    )
  );
  const backrestFrame = new THREE.Mesh(backFrameGeo, goldMat);
  backrestFrame.position.set(0, 1.66, -0.6);
  backrestFrame.castShadow = true;
  group.add(backrestFrame);

  const backVelvetGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.68, -0.94],
        [0.68, -0.94],
        [0.68, 0.76],
        [0.36, 1.04],
        [0, 1.14],
        [-0.36, 1.04],
        [-0.68, 0.76],
      ],
      0.13,
      0.045,
      0.045
    )
  );
  const backrestVelvet = new THREE.Mesh(backVelvetGeo, velvetDeepMat);
  backrestVelvet.position.set(0, 1.6, -0.47);
  group.add(backrestVelvet);

  // Plush Tufted Cushion Channels + Gold Tuft Buttons on Backrest
  [-0.4, -0.13, 0.13, 0.4].forEach((bx) => {
    const channel = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.115, 1.35, 6, 10)),
      velvetMat
    );
    channel.position.set(bx, 1.58, -0.41);
    channel.scale.set(1.0, 1.0, 0.55);
    group.add(channel);
  });

  [1.15, 1.62, 2.08].forEach((by) => {
    [-0.26, 0, 0.26].forEach((bx) => {
      const stud = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.026, 8, 8)), goldMat);
      stud.position.set(bx, by, -0.35);
      group.add(stud);
    });
  });

  // Ornate Side Spire Columns flanking Backrest
  [-0.92, 0.92].forEach((sx) => {
    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 12)), goldDarkMat);
    col.position.set(sx, 1.6, -0.58);
    group.add(col);
    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 12, 10)), goldMat);
    finial.position.set(sx, 2.75, -0.58);
    group.add(finial);
  });

  // Low Ornate Golden Filigree Arch Crest atop Throne Backrest (frames behind head cleanly without cylinder silhouette)
  const crestArch = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.42, 0.055, 10, 20, Math.PI)),
    goldMat
  );
  crestArch.position.set(0, 2.86, -0.58);
  group.add(crestArch);
  const crownGem = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.11, 0)), runeGlowMat);
  crownGem.position.set(0, 3.05, -0.56);
  group.add(crownGem);

  // Armrests with Plush Velvet & Sculpted Rounded-Mane Gold Lion Heads
  const lionLockGeo = trackGeo(createRoundedManeLobeGeometry(0.09, 0.14, -0.04, 10));
  const armBlockGeo = trackGeo(
    createBeveledShapeGeo(
      [
        [-0.15, -0.38],
        [0.15, -0.38],
        [0.17, 0.38],
        [-0.17, 0.38],
      ],
      1.26,
      0.038,
      0.038
    )
  );

  [-0.84, 0.84].forEach((ax) => {
    const armBlock = new THREE.Mesh(armBlockGeo, goldMat);
    armBlock.position.set(ax, 0.9, 0.02);
    armBlock.castShadow = true;
    group.add(armBlock);

    const armPad = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.12, 0.78, 6, 12)),
      velvetMat
    );
    armPad.rotation.x = Math.PI / 2;
    armPad.position.set(ax, 1.3, 0.0);
    group.add(armPad);

    const lionHeadGroup = new THREE.Group();
    lionHeadGroup.position.set(ax, 1.14, 0.72);
    group.add(lionHeadGroup);

    const lionManeCollar = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.245, 14, 12)), goldDarkMat);
    lionManeCollar.position.z = -0.05;
    lionManeCollar.scale.set(1.06, 1.06, 0.75);
    lionHeadGroup.add(lionManeCollar);

    const lionCranium = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.205, 14, 12)), goldMat);
    lionHeadGroup.add(lionCranium);

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const lock = new THREE.Mesh(lionLockGeo, goldMat);
      lock.position.set(Math.cos(ang) * 0.165, Math.sin(ang) * 0.165, -0.03);
      lock.rotation.z = ang - Math.PI / 2;
      lock.rotation.x = -1.36;
      lionHeadGroup.add(lock);
    }

    const lionMuzzle = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.115, 10, 8)), goldMat);
    lionMuzzle.position.set(0, -0.04, 0.16);
    lionMuzzle.scale.set(1.06, 0.85, 1.0);
    lionHeadGroup.add(lionMuzzle);

    [-0.062, 0.062].forEach((ex) => {
      const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.026, 8, 8)), amberEyeMat);
      eye.position.set(ex, 0.06, 0.185);
      lionHeadGroup.add(eye);
    });
  });

  return {
    group,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
