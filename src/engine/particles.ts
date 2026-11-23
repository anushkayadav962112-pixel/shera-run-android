import * as THREE from 'three';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

export interface ParticlePool {
  burst: (x: number, y: number, z: number, colorHex: number, count?: number, spread?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

const MAX_PARTICLES = 180;

export function createParticlePool(scene: THREE.Scene, spriteTex: THREE.Texture): ParticlePool {
  const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    pos: new THREE.Vector3(0, -100, 0),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 0.5,
    color: new THREE.Color(0xffd700),
    size: 0.5,
  }));

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    positions[i * 3 + 1] = -100;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('color', colAttr);

  const material = new THREE.PointsMaterial({
    size: 0.34,
    map: spriteTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;

  function burst(x: number, y: number, z: number, colorHex: number, count = 14, spread = 4.5): void {
    for (let i = 0; i < count; i++) {
      const p = particles[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.pos.set(x, y, z);
      p.vel.set(
        (Math.random() - 0.5) * spread,
        Math.random() * spread * 0.8 + 1.2,
        (Math.random() - 0.5) * spread
      );
      p.maxLife = 0.35 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.color.setHex(colorHex);
    }
  }

  function update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.vel.y -= 9.5 * dt;
      p.pos.addScaledVector(p.vel, dt);

      const alpha = p.life / p.maxLife;
      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;

      colors[i * 3] = p.color.r * alpha;
      colors[i * 3 + 1] = p.color.g * alpha;
      colors[i * 3 + 2] = p.color.b * alpha;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  return {
    burst,
    update,
    dispose: () => {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
