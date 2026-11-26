import { WorldLandmark } from '../types/game';

export const WORLD_SIZE = 400;
export const WORLD_HALF = WORLD_SIZE / 2;
export const WATER_LEVEL = 0.35;

export const LANDMARKS: WorldLandmark[] = [
  { id: 'sanctuary', name: 'Perkemahan Sanctuary', type: 'sanctuary', x: 0, z: -26 },
  { id: 'shrine_east', name: 'Kuil Kristal Timur', type: 'shrine', x: 94, z: 16 },
  { id: 'shrine_west', name: 'Kuil Rawa Barat', type: 'shrine', x: -96, z: 12 },
  { id: 'shrine_south', name: 'Monolit Danau Selatan', type: 'shrine', x: 10, z: -116 },
  { id: 'boss_citadel', name: 'Benteng Obsidian Utara', type: 'boss', x: 0, z: 126 },
  { id: 'chest_1', name: 'Peti Tebing Timur', type: 'chest', x: 64, z: -56 },
  { id: 'chest_2', name: 'Peti Pulau Barat', type: 'chest', x: -64, z: -68 },
  { id: 'chest_3', name: 'Peti Ngarai Aether', type: 'chest', x: 112, z: 72 },
  { id: 'chest_4', name: 'Peti Hutan Lumut', type: 'chest', x: -102, z: 74 },
  { id: 'chest_5', name: 'Peti Altar Utara', type: 'chest', x: 24, z: 102 },
];

export const NPC_POSITION = { x: -4.5, z: -23.5 };
export const CAMPFIRE_POSITION = { x: 0, z: -26 };

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (smoothNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amplitude *= 0.48;
  }
  return value;
}

function smoothPlateauBlend(x: number, z: number, cx: number, cz: number, targetH: number, innerR: number, outerR: number, currentH: number): number {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= outerR) return currentH;
  if (d <= innerR) return targetH;
  const t = (d - innerR) / (outerR - innerR);
  const s = t * t * (3 - 2 * t);
  return targetH * (1 - s) + currentH * s;
}

export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Rolling valley + dramatic outer mountain ridge ring
  const largeHills = fbm2D(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) * 14.5;
  const mediumDetail = fbm2D(x * 0.036 - 4.2, z * 0.036 + 5.8, 3) * 3.8;
  const microBump = fbm2D(x * 0.11, z * 0.11, 2) * 0.65;

  let h = 4.2 + largeHills + mediumDetail + microBump;

  // Scenic lake basin in the south-west & south-east curve
  const lakeDist1 = Math.hypot(x + 36, z + 78);
  if (lakeDist1 < 54) {
    const k = 1 - lakeDist1 / 54;
    h -= k * k * 9.8;
  }

  const lakeDist2 = Math.hypot(x - 42, z + 68);
  if (lakeDist2 < 40) {
    const k = 1 - lakeDist2 / 40;
    h -= k * k * 6.5;
  }

  // Outer perimeter natural mountain boundary so player stays in an organic valley
  if (distFromCenter > 152) {
    const rim = (distFromCenter - 152) / 48;
    h += rim * rim * 34;
  }

  // Flatten playable plateaus for landmarks
  h = smoothPlateauBlend(x, z, 0, -26, 3.8, 12, 26, h); // Sanctuary Camp
  h = smoothPlateauBlend(x, z, 94, 16, 7.2, 10, 22, h); // East Crystal Shrine
  h = smoothPlateauBlend(x, z, -96, 12, 5.4, 10, 22, h); // West Sunken Shrine
  h = smoothPlateauBlend(x, z, 10, -116, 2.8, 10, 22, h); // South Lakeside Shrine
  h = smoothPlateauBlend(x, z, 0, 126, 11.8, 22, 38, h); // Northern Boss Citadel Arena

  // Gentle pathway corridor leading north toward Boss Citadel
  if (Math.abs(x) < 16 && z > 10 && z < 110) {
    const pathT = Math.abs(x) / 16;
    const roadH = 4.5 + ((z - 10) / 100) * 7.3;
    const blend = pathT * pathT;
    h = roadH * (1 - blend) + h * blend;
  }

  return h;
}

export function getTerrainSlope(x: number, z: number): number {
  const eps = 1.2;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  return Math.sqrt(dx * dx + dz * dz);
}

export function getRegionName(x: number, z: number): string {
  if (Math.hypot(x, z - 126) < 34) return 'Benteng Obsidian Utara';
  if (Math.hypot(x, z + 26) < 24) return 'Perkemahan Sanctuary';
  if (Math.hypot(x - 94, z - 16) < 30) return 'Hutan Kristal Timur';
  if (Math.hypot(x + 96, z - 12) < 30) return 'Reruntuhan Rawa Barat';
  if (Math.hypot(x - 10, z + 116) < 28) return 'Monolit Danau Selatan';
  if (getTerrainHeight(x, z) < WATER_LEVEL + 0.5) return 'Danau Cermin Aether';
  return 'Lembah Aethelgard';
}
