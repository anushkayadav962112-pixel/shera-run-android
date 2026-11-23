import * as THREE from 'three';
import { WorldId } from '../types/game';

export interface ProceduralTextureSet {
  trackTextures: Record<WorldId, THREE.CanvasTexture>;
  trackBumpTextures: Record<WorldId, THREE.CanvasTexture>;
  furAlbedo: THREE.CanvasTexture;
  furBump: THREE.CanvasTexture;
  furAo: THREE.CanvasTexture;
  suitAlbedo: THREE.CanvasTexture;
  suitBump: THREE.CanvasTexture;
  crateTexture: THREE.CanvasTexture;
  barrierTexture: THREE.CanvasTexture;
  rampTexture: THREE.CanvasTexture;
  coinTexture: THREE.CanvasTexture;
  lavaFlowTexture: THREE.CanvasTexture;
  waterfallTexture: THREE.CanvasTexture;
  shadowTexture: THREE.CanvasTexture;
  particleTexture: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildFurTextures(anisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [ac, actx] = makeCanvas(256, 256);
  const [bc, bctx] = makeCanvas(256, 256);
  const [oc, octx] = makeCanvas(256, 256);

  // Neutral-warm luminance base so material.color (white-cream or golden-brown) tints crisply without washout
  actx.fillStyle = '#efe9df';
  actx.fillRect(0, 0, 256, 256);

  bctx.fillStyle = '#747474';
  bctx.fillRect(0, 0, 256, 256);

  // Baked root-to-tip lock ambient occlusion gradient + micro-strand depth
  const aoGrad = octx.createLinearGradient(0, 0, 0, 256);
  aoGrad.addColorStop(0, '#8d8d8d');
  aoGrad.addColorStop(0.45, '#ececec');
  aoGrad.addColorStop(1, '#c5c5c5');
  octx.fillStyle = aoGrad;
  octx.fillRect(0, 0, 256, 256);

  // Rich directional fur tuft clumping & silky hair strands
  for (let i = 0; i < 4200; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    const len = 11 + (i % 15);
    const dx = ((i % 5) - 2) * 0.85;
    const isShadowLock = i % 4 === 0;
    const shade = isShadowLock ? 186 + (i % 18) : 232 + (i % 20);
    actx.strokeStyle = `rgb(${shade}, ${shade - 5}, ${shade - 12})`;
    actx.lineWidth = isShadowLock ? 2.0 : 1.15;
    actx.beginPath();
    actx.moveTo(x, y);
    actx.lineTo(x + dx, y + len);
    actx.stroke();

    const bVal = isShadowLock ? 52 + (i % 34) : 148 + (i % 102);
    bctx.strokeStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bctx.lineWidth = 1.45;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + dx, y + len);
    bctx.stroke();

    if (i % 3 === 0) {
      const oVal = isShadowLock ? 132 : 242;
      octx.strokeStyle = `rgb(${oVal}, ${oVal}, ${oVal})`;
      octx.lineWidth = 1.25;
      octx.beginPath();
      octx.moveTo(x, y);
      octx.lineTo(x + dx, y + len);
      octx.stroke();
    }
  }

  return {
    albedo: finalizeTexture(ac, anisotropy, true, 2, 2),
    bump: finalizeTexture(bc, anisotropy, false, 2, 2),
    ao: finalizeTexture(oc, anisotropy, false, 1, 1),
  };
}

function buildSuitTextures(anisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [ac, actx] = makeCanvas(256, 256);
  const [bc, bctx] = makeCanvas(256, 256);

  // Subtle luxury wool twill fabric variation (never flat #ffffff)
  actx.fillStyle = '#eceef4';
  actx.fillRect(0, 0, 256, 256);
  bctx.fillStyle = '#7e7e7e';
  bctx.fillRect(0, 0, 256, 256);

  for (let i = -256; i < 512; i += 4) {
    actx.strokeStyle = i % 8 === 0 ? 'rgba(205, 212, 224, 0.35)' : 'rgba(255, 255, 255, 0.38)';
    actx.lineWidth = 1.2;
    actx.beginPath();
    actx.moveTo(i, 0);
    actx.lineTo(i + 256, 256);
    actx.stroke();

    bctx.strokeStyle = i % 8 === 0 ? '#6e6e6e' : '#9c9c9c';
    bctx.lineWidth = 1.1;
    bctx.beginPath();
    bctx.moveTo(i, 0);
    bctx.lineTo(i + 256, 256);
    bctx.stroke();
  }

  return {
    albedo: finalizeTexture(ac, anisotropy, true, 3, 3),
    bump: finalizeTexture(bc, anisotropy, false, 4, 4),
  };
}

function drawRailsOverlay(
  ctx: CanvasRenderingContext2D,
  bctx: CanvasRenderingContext2D,
  tieDark: string,
  tieLight: string,
  railBase: string,
  railShine: string
): void {
  const laneCenters = [88, 256, 424];
  for (let y = 0; y < 512; y += 42) {
    laneCenters.forEach((cx) => {
      ctx.fillStyle = tieDark;
      ctx.fillRect(cx - 66, y + 6, 132, 20);
      ctx.fillStyle = tieLight;
      ctx.fillRect(cx - 64, y + 8, 128, 7);

      bctx.fillStyle = '#c4c4c4';
      bctx.fillRect(cx - 66, y + 6, 132, 20);
    });
  }

  laneCenters.forEach((cx) => {
    [-42, 42].forEach((offset) => {
      ctx.fillStyle = railBase;
      ctx.fillRect(cx + offset - 7, 0, 14, 512);
      ctx.fillStyle = railShine;
      ctx.fillRect(cx + offset - 3, 0, 6, 512);
      bctx.fillStyle = '#ffffff';
      bctx.fillRect(cx + offset - 6, 0, 12, 512);
    });
  });
}

function drawCarvedStoneTiles(
  ctx: CanvasRenderingContext2D,
  bctx: CanvasRenderingContext2D,
  baseR: number,
  baseG: number,
  baseB: number,
  highlightStyle: string,
  shadowStyle: string,
  withCracks = true
): void {
  for (let y = 0; y < 512; y += 64) {
    const offset = (y / 64) % 2 === 0 ? 0 : 32;
    for (let x = -32; x < 512; x += 64) {
      const tone = ((x * 7 + y * 13) % 26) - 13;
      const rx = x + offset + 4;
      const ry = y + 4;
      ctx.fillStyle = `rgb(${baseR + tone},${baseG + tone},${baseB + tone})`;
      ctx.fillRect(rx, ry, 56, 56);

      // Subtle bevel rim top/left & bottom/right shadow
      ctx.fillStyle = highlightStyle;
      ctx.fillRect(rx, ry, 56, 4);
      ctx.fillRect(rx, ry, 4, 56);
      ctx.fillStyle = shadowStyle;
      ctx.fillRect(rx, ry + 50, 56, 6);
      ctx.fillRect(rx + 50, ry, 6, 56);

      if (withCracks && (x + y) % 128 === 0) {
        ctx.strokeStyle = shadowStyle;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rx + 12, ry + 14);
        ctx.lineTo(rx + 28, ry + 26);
        ctx.lineTo(rx + 40, ry + 22);
        ctx.stroke();
      }

      // Micro stone speckles
      for (let s = 0; s < 6; s++) {
        const sx = rx + ((s * 17 + x) % 46) + 5;
        const sy = ry + ((s * 23 + y) % 46) + 5;
        ctx.fillStyle = s % 2 === 0 ? highlightStyle : shadowStyle;
        ctx.fillRect(sx, sy, 3, 2);
      }

      bctx.fillStyle = '#bababa';
      bctx.fillRect(rx, ry, 56, 56);
      bctx.fillStyle = '#e5e5e5';
      bctx.fillRect(rx + 4, ry + 4, 48, 48);
    }
  }
}

function drawClearLaneBorders(
  ctx: CanvasRenderingContext2D,
  outerColor: string,
  innerGlow: string
): void {
  [168, 340].forEach((lx) => {
    ctx.fillStyle = outerColor;
    ctx.fillRect(lx - 6, 0, 12, 512);
    ctx.fillStyle = innerGlow;
    ctx.fillRect(lx - 2, 0, 4, 512);
    // Dashed bright royal dashes along lane seam for unmistakable 3-lane readability
    ctx.fillStyle = '#ffffffcc';
    for (let dy = 10; dy < 512; dy += 64) {
      ctx.fillRect(lx - 2, dy, 4, 34);
    }
  });
}

function buildTrackAlbedoAndBump(
  worldId: WorldId,
  anisotropy: number
): { albedo: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  if (worldId === 'clouds') {
    ctx.fillStyle = '#382e26';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#202020';
    bctx.fillRect(0, 0, 512, 512);

    drawCarvedStoneTiles(ctx, bctx, 136, 122, 106, 'rgba(255, 240, 200, 0.24)', 'rgba(30, 22, 16, 0.48)');

    // Subtle sunlit warm sandstone center strip variation for strong speed sensation
    ctx.fillStyle = 'rgba(253, 224, 150, 0.08)';
    ctx.fillRect(216, 0, 80, 512);
    ctx.fillRect(54, 0, 68, 512);
    ctx.fillRect(390, 0, 68, 512);

    const goldGrad = ctx.createLinearGradient(0, 0, 32, 0);
    goldGrad.addColorStop(0, '#78350f');
    goldGrad.addColorStop(0.5, '#facc15');
    goldGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 0, 30, 512);
    ctx.fillRect(482, 0, 30, 512);

    drawClearLaneBorders(ctx, 'rgba(180, 115, 20, 0.94)', '#fde047');
  } else if (worldId === 'lava') {
    ctx.fillStyle = '#180907';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#1c1c1c';
    bctx.fillRect(0, 0, 512, 512);

    drawCarvedStoneTiles(ctx, bctx, 52, 40, 40, 'rgba(255, 110, 40, 0.24)', 'rgba(14, 6, 4, 0.6)');

    const magmaGlow = ctx.createLinearGradient(0, 0, 512, 512);
    magmaGlow.addColorStop(0, '#ffae00');
    magmaGlow.addColorStop(0.5, '#ff4d00');
    magmaGlow.addColorStop(1, '#ff9100');
    ctx.strokeStyle = magmaGlow;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(45, 0);
    ctx.lineTo(118, 170);
    ctx.lineTo(72, 340);
    ctx.lineTo(125, 512);
    ctx.moveTo(395, 0);
    ctx.lineTo(350, 210);
    ctx.lineTo(432, 395);
    ctx.lineTo(385, 512);
    ctx.stroke();

    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 26, 512);
    ctx.fillRect(486, 0, 26, 512);
    drawClearLaneBorders(ctx, 'rgba(185, 55, 10, 0.95)', '#fb923c');
  } else if (worldId === 'crystal') {
    ctx.fillStyle = '#1d2942';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#2d2d2d';
    bctx.fillRect(0, 0, 512, 512);

    drawCarvedStoneTiles(ctx, bctx, 54, 72, 104, 'rgba(125, 211, 252, 0.22)', 'rgba(12, 18, 34, 0.5)', false);
    drawRailsOverlay(ctx, bctx, '#3b295e', '#6d4c9c', '#1e293b', '#7dd3fc');
    drawClearLaneBorders(ctx, 'rgba(8, 145, 178, 0.95)', '#67e8f9');

    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, 0, 20, 512);
    ctx.fillRect(492, 0, 20, 512);
  } else if (worldId === 'dragon') {
    ctx.fillStyle = '#162822';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#282828';
    bctx.fillRect(0, 0, 512, 512);

    drawCarvedStoneTiles(ctx, bctx, 84, 74, 60, 'rgba(110, 231, 183, 0.24)', 'rgba(18, 28, 24, 0.48)');

    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 26, 512);
    ctx.fillRect(486, 0, 26, 512);
    drawClearLaneBorders(ctx, 'rgba(5, 150, 105, 0.95)', '#6ee7b7');
  } else {
    ctx.fillStyle = '#243c59';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#2e2e2e';
    bctx.fillRect(0, 0, 512, 512);

    drawCarvedStoneTiles(ctx, bctx, 144, 182, 216, 'rgba(240, 249, 255, 0.42)', 'rgba(30, 58, 95, 0.42)');
    drawRailsOverlay(ctx, bctx, '#1e3a5f', '#3b82f6', '#475569', '#e0f2fe');
    drawClearLaneBorders(ctx, 'rgba(37, 99, 235, 0.95)', '#bae6fd');

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 22, 512);
    ctx.fillRect(490, 0, 22, 512);
  }

  return {
    albedo: finalizeTexture(c, anisotropy, true, 1, 2),
    bump: finalizeTexture(bc, anisotropy, false, 1, 2),
  };
}

function buildCrateTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#995c22';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#6c3c13';
  for (let i = 0; i < 256; i += 42) {
    ctx.fillRect(0, i, 256, 5);
  }

  ctx.strokeStyle = '#d99a26';
  ctx.lineWidth = 24;
  ctx.strokeRect(12, 12, 232, 232);

  ctx.strokeStyle = '#5c310e';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(24, 24);
  ctx.lineTo(232, 232);
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(128, 128, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(96, 152);
  ctx.lineTo(90, 108);
  ctx.lineTo(112, 124);
  ctx.lineTo(128, 96);
  ctx.lineTo(144, 124);
  ctx.lineTo(166, 108);
  ctx.lineTo(160, 152);
  ctx.closePath();
  ctx.fill();

  return finalizeTexture(c, anisotropy, true);
}

function buildBarrierTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#dc2626';
  for (let x = -128; x < 384; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 96, 128);
    ctx.lineTo(x + 64, 128);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, 256, 128);
  return finalizeTexture(c, anisotropy, true);
}

function buildRampTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#0f285e');
  bg.addColorStop(1, '#091433');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 32; y < 240; y += 64) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, y + 34);
    ctx.lineTo(128, y);
    ctx.lineTo(212, y + 34);
    ctx.stroke();

    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 244);
  return finalizeTexture(c, anisotropy, true);
}

function buildCoinTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 126);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.55, '#f59e0b');
  grad.addColorStop(0.88, '#d97706');
  grad.addColorStop(1, '#92400e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.arc(128, 138, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(128, 138, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(86, 114);
  ctx.lineTo(80, 74);
  ctx.lineTo(108, 92);
  ctx.lineTo(128, 62);
  ctx.lineTo(148, 92);
  ctx.lineTo(176, 74);
  ctx.lineTo(170, 114);
  ctx.closePath();
  ctx.fill();

  return finalizeTexture(c, anisotropy, true);
}

function buildLavaFlowTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, '#dc2626');
  g.addColorStop(0.5, '#f97316');
  g.addColorStop(1, '#ea580c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 65; i++) {
    const x = (i * 89) % 512;
    const y = (i * 149) % 512;
    const r = 18 + (i % 34);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(253, 224, 71, 0.55)' : 'rgba(72, 16, 6, 0.68)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r * 0.7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(c, anisotropy, true, 4, 5);
}

function buildWaterfallTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 256);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(37, 99, 235, 0.55)');
  g.addColorStop(0.5, 'rgba(224, 242, 254, 0.9)');
  g.addColorStop(1, 'rgba(37, 99, 235, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let i = 0; i < 24; i++) {
    const x = (i * 19) % 118;
    const y = (i * 47) % 220;
    ctx.fillRect(x, y, 5, 36);
  }
  return finalizeTexture(c, anisotropy, true, 1, 2);
}

function buildShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function buildParticleTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 26);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 248, 225, 0.85)');
  grad.addColorStop(0.7, 'rgba(255, 232, 175, 0.28)');
  grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const clouds = buildTrackAlbedoAndBump('clouds', anisotropy);
  const lava = buildTrackAlbedoAndBump('lava', anisotropy);
  const crystal = buildTrackAlbedoAndBump('crystal', anisotropy);
  const dragon = buildTrackAlbedoAndBump('dragon', anisotropy);
  const frozen = buildTrackAlbedoAndBump('frozen', anisotropy);
  const fur = buildFurTextures(anisotropy);
  const suit = buildSuitTextures(anisotropy);

  const trackTextures: Record<WorldId, THREE.CanvasTexture> = {
    clouds: clouds.albedo,
    lava: lava.albedo,
    crystal: crystal.albedo,
    dragon: dragon.albedo,
    frozen: frozen.albedo,
  };
  const trackBumpTextures: Record<WorldId, THREE.CanvasTexture> = {
    clouds: clouds.bump,
    lava: lava.bump,
    crystal: crystal.bump,
    dragon: dragon.bump,
    frozen: frozen.bump,
  };

  const crateTexture = buildCrateTexture(anisotropy);
  const barrierTexture = buildBarrierTexture(anisotropy);
  const rampTexture = buildRampTexture(anisotropy);
  const coinTexture = buildCoinTexture(anisotropy);
  const lavaFlowTexture = buildLavaFlowTexture(anisotropy);
  const waterfallTexture = buildWaterfallTexture(anisotropy);
  const shadowTexture = buildShadowTexture();
  const particleTexture = buildParticleTexture();

  return {
    trackTextures,
    trackBumpTextures,
    furAlbedo: fur.albedo,
    furBump: fur.bump,
    furAo: fur.ao,
    suitAlbedo: suit.albedo,
    suitBump: suit.bump,
    crateTexture,
    barrierTexture,
    rampTexture,
    coinTexture,
    lavaFlowTexture,
    waterfallTexture,
    shadowTexture,
    particleTexture,
    dispose: () => {
      Object.values(trackTextures).forEach((t) => t.dispose());
      Object.values(trackBumpTextures).forEach((t) => t.dispose());
      fur.albedo.dispose();
      fur.bump.dispose();
      fur.ao.dispose();
      suit.albedo.dispose();
      suit.bump.dispose();
      crateTexture.dispose();
      barrierTexture.dispose();
      rampTexture.dispose();
      coinTexture.dispose();
      lavaFlowTexture.dispose();
      waterfallTexture.dispose();
      shadowTexture.dispose();
      particleTexture.dispose();
    },
  };
}
