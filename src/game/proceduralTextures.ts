import { DynamicTexture, Scene, Texture } from '@babylonjs/core';

export interface ProceduralTexturePack {
  waterBump: Texture;
  terrainNormal: Texture;
  terrainDetail: Texture;
  stoneAlbedo: Texture;
  stoneNormal: Texture;
  stoneEmissive: Texture;
  woodAlbedo: Texture;
  particleGlow: Texture;
}

function tileableHash(x: number, y: number, period: number): number {
  const px = ((x % period) + period) % period;
  const py = ((y % period) + period) % period;
  const n = Math.sin(px * 127.1 + py * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function tileableNoise(x: number, y: number, period: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = tileableHash(ix, iy, period);
  const b = tileableHash(ix + 1, iy, period);
  const c = tileableHash(ix, iy + 1, period);
  const d = tileableHash(ix + 1, iy + 1, period);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function tileableFbm(u: number, v: number, baseFreq: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileableNoise(u * freq, v * freq, freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function heightFieldToNormalTexture(
  name: string,
  size: number,
  heights: Float32Array,
  strength: number,
  scene: Scene,
  uScale = 1,
  vScale = 1
): Texture {
  const dyn = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = dyn.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const ym1 = (y - 1 + size) % size;
    const yp1 = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm1 = (x - 1 + size) % size;
      const xp1 = (x + 1) % size;

      const hL = heights[y * size + xm1];
      const hR = heights[y * size + xp1];
      const hU = heights[ym1 * size + x];
      const hD = heights[yp1 * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  dyn.update(true);
  dyn.wrapU = Texture.WRAP_ADDRESSMODE;
  dyn.wrapV = Texture.WRAP_ADDRESSMODE;
  dyn.uScale = uScale;
  dyn.vScale = vScale;
  return dyn;
}

export function createProceduralTexturePack(scene: Scene): ProceduralTexturePack {
  // 1. Water normal map (seamless multi-directional ripples)
  const waterSize = 256;
  const waterHeights = new Float32Array(waterSize * waterSize);
  for (let y = 0; y < waterSize; y++) {
    for (let x = 0; x < waterSize; x++) {
      const u = x / waterSize;
      const v = y / waterSize;
      const wave1 = Math.sin((u * 4 + v * 2) * Math.PI * 2) * 0.16;
      const wave2 = Math.cos((u * 3 - v * 5) * Math.PI * 2) * 0.12;
      const fbm = tileableFbm(u, v, 8, 4) * 0.72;
      waterHeights[y * waterSize + x] = wave1 + wave2 + fbm;
    }
  }
  const waterBump = heightFieldToNormalTexture('waterBumpTex', waterSize, waterHeights, 3.8, scene, 1, 1);

  // 2. Terrain micro-detail albedo + normal map
  const tSize = 256;
  const terrainHeights = new Float32Array(tSize * tSize);
  const terrainDetail = new DynamicTexture('terrainDetailTex', { width: tSize, height: tSize }, scene, true);
  const tCtx = terrainDetail.getContext() as unknown as CanvasRenderingContext2D;
  const tImg = tCtx.createImageData(tSize, tSize);

  for (let y = 0; y < tSize; y++) {
    for (let x = 0; x < tSize; x++) {
      const u = x / tSize;
      const v = y / tSize;
      const n1 = tileableFbm(u, v, 8, 4);
      const n2 = tileableFbm(u + 0.37, v + 0.19, 16, 3);
      terrainHeights[y * tSize + x] = n1 * 0.65 + n2 * 0.35;

      const shade = Math.round(210 + (n1 - 0.5) * 65 + (n2 - 0.5) * 35);
      const clamped = Math.max(150, Math.min(255, shade));
      const idx = (y * tSize + x) * 4;
      tImg.data[idx] = clamped;
      tImg.data[idx + 1] = clamped;
      tImg.data[idx + 2] = Math.max(145, clamped - 4);
      tImg.data[idx + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);
  terrainDetail.update(true);
  terrainDetail.wrapU = Texture.WRAP_ADDRESSMODE;
  terrainDetail.wrapV = Texture.WRAP_ADDRESSMODE;
  terrainDetail.uScale = 34;
  terrainDetail.vScale = 34;

  const terrainNormal = heightFieldToNormalTexture('terrainNormalTex', tSize, terrainHeights, 4.4, scene, 34, 34);

  // 3. Ancient Carved Stone (albedo + normal + glowing runic seams)
  const sSize = 256;
  const stoneHeights = new Float32Array(sSize * sSize);
  const stoneAlbedo = new DynamicTexture('stoneAlbedoTex', { width: sSize, height: sSize }, scene, true);
  const stoneEmissive = new DynamicTexture('stoneEmissiveTex', { width: sSize, height: sSize }, scene, true);
  const sCtx = stoneAlbedo.getContext() as unknown as CanvasRenderingContext2D;
  const eCtx = stoneEmissive.getContext() as unknown as CanvasRenderingContext2D;
  const sImg = sCtx.createImageData(sSize, sSize);
  const eImg = eCtx.createImageData(sSize, sSize);

  for (let y = 0; y < sSize; y++) {
    for (let x = 0; x < sSize; x++) {
      const u = x / sSize;
      const v = y / sSize;
      const grain = tileableFbm(u, v, 8, 4);
      // Ashlar stone blocks grid
      const row = Math.floor(v * 4);
      const offsetU = (u + (row % 2) * 0.5) % 1;
      const seamX = Math.min(offsetU * 2 % 1, 1 - (offsetU * 2 % 1));
      const seamY = Math.min(v * 4 % 1, 1 - (v * 4 % 1));
      const isMortar = seamX < 0.035 || seamY < 0.04;

      const runeBand = Math.abs(v - 0.5) < 0.03 && Math.sin(u * Math.PI * 16) > 0.25;
      const h = isMortar ? grain * 0.2 : 0.4 + grain * 0.6;
      stoneHeights[y * sSize + x] = h;

      const base = isMortar ? 48 : 88 + grain * 52;
      const moss = grain > 0.62 && !isMortar ? (grain - 0.62) * 65 : 0;
      const idx = (y * sSize + x) * 4;
      sImg.data[idx] = Math.min(255, Math.round(base - moss * 0.35));
      sImg.data[idx + 1] = Math.min(255, Math.round(base + moss * 0.45));
      sImg.data[idx + 2] = Math.min(255, Math.round(base + 4 - moss * 0.2));
      sImg.data[idx + 3] = 255;

      if (runeBand) {
        eImg.data[idx] = 240;
        eImg.data[idx + 1] = 175;
        eImg.data[idx + 2] = 60;
        eImg.data[idx + 3] = 255;
      } else {
        eImg.data[idx] = 0;
        eImg.data[idx + 1] = 0;
        eImg.data[idx + 2] = 0;
        eImg.data[idx + 3] = 255;
      }
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  eCtx.putImageData(eImg, 0, 0);
  stoneAlbedo.update(true);
  stoneEmissive.update(true);
  stoneAlbedo.wrapU = Texture.WRAP_ADDRESSMODE;
  stoneAlbedo.wrapV = Texture.WRAP_ADDRESSMODE;
  stoneEmissive.wrapU = Texture.WRAP_ADDRESSMODE;
  stoneEmissive.wrapV = Texture.WRAP_ADDRESSMODE;

  const stoneNormal = heightFieldToNormalTexture('stoneNormalTex', sSize, stoneHeights, 5.2, scene, 1, 1);

  // 4. Wood bark texture
  const wSize = 128;
  const woodAlbedo = new DynamicTexture('woodAlbedoTex', { width: wSize, height: wSize }, scene, true);
  const wCtx = woodAlbedo.getContext() as unknown as CanvasRenderingContext2D;
  const wImg = wCtx.createImageData(wSize, wSize);
  for (let y = 0; y < wSize; y++) {
    for (let x = 0; x < wSize; x++) {
      const u = x / wSize;
      const v = y / wSize;
      const streak = tileableFbm(u * 3, v * 0.5, 8, 3);
      const idx = (y * wSize + x) * 4;
      wImg.data[idx] = Math.round(58 + streak * 44);
      wImg.data[idx + 1] = Math.round(42 + streak * 32);
      wImg.data[idx + 2] = Math.round(28 + streak * 22);
      wImg.data[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  woodAlbedo.update(true);
  woodAlbedo.wrapU = Texture.WRAP_ADDRESSMODE;
  woodAlbedo.wrapV = Texture.WRAP_ADDRESSMODE;

  // 5. Soft radial glow particle texture
  const pSize = 64;
  const particleGlow = new DynamicTexture('particleGlowTex', { width: pSize, height: pSize }, scene, false);
  const pCtx = particleGlow.getContext();
  const grad = pCtx.createRadialGradient(pSize / 2, pSize / 2, 1, pSize / 2, pSize / 2, pSize / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 245, 220, 0.78)');
  grad.addColorStop(0.75, 'rgba(255, 220, 160, 0.2)');
  grad.addColorStop(1, 'rgba(255, 200, 120, 0)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, pSize, pSize);
  particleGlow.update(false);
  particleGlow.hasAlpha = true;

  return {
    waterBump,
    terrainNormal,
    terrainDetail,
    stoneAlbedo,
    stoneNormal,
    stoneEmissive,
    woodAlbedo,
    particleGlow,
  };
}
