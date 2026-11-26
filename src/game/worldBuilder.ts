import {
  CascadedShadowGenerator,
  Color3,
  Color4,
  Matrix,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PointLight,
  Quaternion,
  Scene,
  TransformNode,
  Vector2,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials';
import { createNpcRig } from './characterRig';
import { GraphicsController } from './graphicsPipeline';
import { ProceduralTexturePack } from './proceduralTextures';
import {
  CAMPFIRE_POSITION,
  fbm2D,
  getTerrainHeight,
  getTerrainSlope,
  LANDMARKS,
  NPC_POSITION,
  WATER_LEVEL,
  WORLD_SIZE,
} from './terrainMath';

export interface ObstacleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface ShrineVisual {
  id: string;
  name: string;
  x: number;
  z: number;
  ring: Mesh;
  crystalMat: PBRMaterial;
  light: PointLight;
  activated: boolean;
}

export interface ChestVisual {
  id: string;
  name: string;
  x: number;
  z: number;
  lidPivot: TransformNode;
  glowMat: PBRMaterial;
  opened: boolean;
}

export interface BuiltWorld {
  terrain: Mesh;
  waterMesh: Mesh;
  waterMaterial: WaterMaterial;
  npcRoot: TransformNode;
  shrines: ShrineVisual[];
  chests: ChestVisual[];
  obstacles: ObstacleCollider[];
  grassMaster: Mesh;
  maxGrassCount: number;
  campfireLight: PointLight;
  updateWorldVisuals: (dt: number, totalTime: number, playerPos: Vector3) => void;
  setGrassDensity: (ratio: number) => void;
  setWaterReflections: (enabled: boolean) => void;
}

export function buildOpenWorld(
  scene: Scene,
  textures: ProceduralTexturePack,
  graphics: GraphicsController
): BuiltWorld {
  const obstacles: ObstacleCollider[] = [];
  const shadows: CascadedShadowGenerator = graphics.shadowGenerator;

  // 1. Subdivided Vertex-Colored PBR Terrain (180x180 grid across 400x400m)
  const segs = 164;
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  for (let iz = 0; iz <= segs; iz++) {
    const v = iz / segs;
    const z = (v - 0.5) * WORLD_SIZE;
    for (let ix = 0; ix <= segs; ix++) {
      const u = ix / segs;
      const x = (u - 0.5) * WORLD_SIZE;
      const y = getTerrainHeight(x, z);
      const slope = getTerrainSlope(x, z);

      positions.push(x, y, z);
      uvs.push(u, v);

      // Biome vertex coloring
      let r = 0.22;
      let g = 0.42;
      let b = 0.2;

      const nearRoad = Math.abs(x) < 12 && z > 8 && z < 112;
      const inCitadel = Math.hypot(x, z - 126) < 26;

      if (y < WATER_LEVEL + 0.95) {
        // Warm river sand & wet pebbles
        r = 0.58;
        g = 0.52;
        b = 0.39;
      } else if (inCitadel) {
        // Obsidian slate plaza
        r = 0.18;
        g = 0.19;
        b = 0.23;
      } else if (slope > 0.72 || y > 15.5) {
        // Exposed granite cliff rock
        const rockTone = 0.32 + fbm2D(x * 0.08, z * 0.08, 2) * 0.08;
        r = rockTone;
        g = rockTone * 0.98;
        b = rockTone * 1.03;
      } else if (nearRoad) {
        // Packed earth & ancient cobblestone path
        r = 0.42;
        g = 0.36;
        b = 0.27;
      } else {
        // Lush emerald & golden-tipped meadow grass
        const patch = fbm2D(x * 0.045, z * 0.045, 3);
        r = 0.18 + Math.max(0, patch) * 0.16;
        g = 0.39 + patch * 0.08;
        b = 0.17 + Math.max(0, -patch) * 0.06;
      }

      colors.push(r, g, b, 1);
    }
  }

  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * (segs + 1) + ix;
      const b = a + 1;
      const c = a + (segs + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const terrain = new Mesh('worldTerrain', scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.colors = colors;
  vertexData.applyToMesh(terrain);
  terrain.receiveShadows = true;

  const terrainMat = new PBRMaterial('terrainPbrMat', scene);
  terrainMat.albedoTexture = textures.terrainDetail;
  terrainMat.bumpTexture = textures.terrainNormal;
  terrainMat.bumpTexture.level = 0.75;
  terrainMat.metallic = 0.02;
  terrainMat.roughness = 0.88;
  terrain.material = terrainMat;

  // 2. Real-time Reflective WaterMaterial Lake
  const waterMesh = MeshBuilder.CreateGround('waterLake', { width: 220, height: 220, subdivisions: 24 }, scene);
  waterMesh.position.set(0, WATER_LEVEL, -68);
  waterMesh.isPickable = false;

  const waterMaterial = new WaterMaterial('waterMat', scene);
  waterMaterial.bumpTexture = textures.waterBump;
  waterMaterial.windForce = -6;
  waterMaterial.waveHeight = 0.18;
  waterMaterial.bumpHeight = 0.14;
  waterMaterial.waveLength = 0.18;
  waterMaterial.waveSpeed = 14;
  waterMaterial.colorBlendFactor = 0.32;
  waterMaterial.waterColor = new Color3(0.06, 0.24, 0.34);
  waterMaterial.windDirection = new Vector2(0.8, 0.5);
  waterMaterial.addToRenderList(graphics.skyMesh);
  waterMaterial.addToRenderList(terrain);
  waterMesh.material = waterMaterial;

  // Stone material shared by ruins, shrines, citadel
  const ruinMat = new PBRMaterial('ruinStoneMat', scene);
  ruinMat.albedoTexture = textures.stoneAlbedo;
  ruinMat.bumpTexture = textures.stoneNormal;
  ruinMat.emissiveTexture = textures.stoneEmissive;
  ruinMat.emissiveColor = new Color3(0.45, 0.35, 0.15);
  ruinMat.metallic = 0.12;
  ruinMat.roughness = 0.74;

  const goldMat = new PBRMaterial('goldTrimMat', scene);
  goldMat.albedoColor = new Color3(0.88, 0.68, 0.28);
  goldMat.metallic = 0.92;
  goldMat.roughness = 0.24;

  // 3. Sanctuary Camp (NPC Lyra, Pavilion, Campfire)
  const campY = getTerrainHeight(CAMPFIRE_POSITION.x, CAMPFIRE_POSITION.z);
  const firePitRing = MeshBuilder.CreateTorus('campFireRing', { diameter: 2.0, thickness: 0.34, tessellation: 14 }, scene);
  firePitRing.position.set(CAMPFIRE_POSITION.x, campY + 0.12, CAMPFIRE_POSITION.z);
  firePitRing.material = ruinMat;
  firePitRing.receiveShadows = true;
  obstacles.push({ x: CAMPFIRE_POSITION.x, z: CAMPFIRE_POSITION.z, radius: 1.1 });

  const campfireLight = new PointLight('campfireLight', new Vector3(CAMPFIRE_POSITION.x, campY + 1.3, CAMPFIRE_POSITION.z), scene);
  campfireLight.diffuse = new Color3(1.0, 0.58, 0.22);
  campfireLight.intensity = 6.5;
  campfireLight.range = 24;

  const fireParticles = new ParticleSystem('campFireParticles', 80, scene);
  fireParticles.particleTexture = textures.particleGlow;
  fireParticles.emitter = new Vector3(CAMPFIRE_POSITION.x, campY + 0.35, CAMPFIRE_POSITION.z);
  fireParticles.minEmitBox = new Vector3(-0.25, 0, -0.25);
  fireParticles.maxEmitBox = new Vector3(0.25, 0.15, 0.25);
  fireParticles.color1 = new Color4(1.0, 0.75, 0.22, 1.0);
  fireParticles.color2 = new Color4(1.0, 0.35, 0.08, 0.9);
  fireParticles.colorDead = new Color4(0.2, 0.05, 0.02, 0);
  fireParticles.minSize = 0.22;
  fireParticles.maxSize = 0.65;
  fireParticles.minLifeTime = 0.5;
  fireParticles.maxLifeTime = 1.25;
  fireParticles.emitRate = 38;
  fireParticles.direction1 = new Vector3(-0.3, 1.8, -0.3);
  fireParticles.direction2 = new Vector3(0.3, 3.0, 0.3);
  fireParticles.start();

  // Sanctuary wooden banner pillars
  const woodMat = new PBRMaterial('woodMat', scene);
  woodMat.albedoTexture = textures.woodAlbedo;
  woodMat.metallic = 0.04;
  woodMat.roughness = 0.85;

  [
    { x: -6, z: -31 },
    { x: 6, z: -31 },
    { x: 6.5, z: -21 },
  ].forEach((p, idx) => {
    const py = getTerrainHeight(p.x, p.z);
    const post = MeshBuilder.CreateCylinder(`campPost_${idx}`, { diameter: 0.42, height: 4.8 }, scene);
    post.position.set(p.x, py + 2.3, p.z);
    post.material = woodMat;
    shadows.addShadowCaster(post);
    obstacles.push({ x: p.x, z: p.z, radius: 0.45 });

    const lantern = MeshBuilder.CreateSphere(`campLantern_${idx}`, { diameter: 0.36 }, scene);
    lantern.position.set(p.x, py + 4.4, p.z);
    lantern.material = goldMat;
  });

  // NPC Lyra
  const npcY = getTerrainHeight(NPC_POSITION.x, NPC_POSITION.z);
  const npcRoot = createNpcRig(scene, new Vector3(NPC_POSITION.x, npcY, NPC_POSITION.z));
  npcRoot.rotation.y = 0.6;
  npcRoot.getChildMeshes().forEach((m) => shadows.addShadowCaster(m));
  obstacles.push({ x: NPC_POSITION.x, z: NPC_POSITION.z, radius: 0.8 });

  // 4. Three Ancient Sun Shrines
  const shrines: ShrineVisual[] = [];
  LANDMARKS.filter((l) => l.type === 'shrine').forEach((lm) => {
    const sy = getTerrainHeight(lm.x, lm.z);

    const base = MeshBuilder.CreateCylinder(`shrineBase_${lm.id}`, { diameter: 7.4, height: 0.7, tessellation: 8 }, scene);
    base.position.set(lm.x, sy + 0.3, lm.z);
    base.material = ruinMat;
    base.receiveShadows = true;
    shadows.addShadowCaster(base);

    const obelisk = MeshBuilder.CreateCylinder(
      `shrineObelisk_${lm.id}`,
      { diameterTop: 0.7, diameterBottom: 1.5, height: 6.4, tessellation: 4 },
      scene
    );
    obelisk.position.set(lm.x, sy + 3.5, lm.z);
    obelisk.material = ruinMat;
    shadows.addShadowCaster(obelisk);
    waterMaterial.addToRenderList(obelisk);
    obstacles.push({ x: lm.x, z: lm.z, radius: 1.15 });

    const crystalMat = new PBRMaterial(`shrineCrystalMat_${lm.id}`, scene);
    crystalMat.albedoColor = new Color3(0.25, 0.72, 1.0);
    crystalMat.emissiveColor = new Color3(0.2, 0.65, 1.15);
    crystalMat.metallic = 0.15;
    crystalMat.roughness = 0.18;

    const ring = MeshBuilder.CreateTorus(`shrineRing_${lm.id}`, { diameter: 3.1, thickness: 0.2, tessellation: 28 }, scene);
    ring.position.set(lm.x, sy + 5.2, lm.z);
    ring.material = crystalMat;

    const light = new PointLight(`shrineLight_${lm.id}`, new Vector3(lm.x, sy + 5.4, lm.z), scene);
    light.diffuse = new Color3(0.35, 0.8, 1.0);
    light.intensity = 3.2;
    light.range = 24;

    shrines.push({
      id: lm.id,
      name: lm.name,
      x: lm.x,
      z: lm.z,
      ring,
      crystalMat,
      light,
      activated: false,
    });
  });

  // 5. Five Relic Chests
  const chests: ChestVisual[] = [];
  LANDMARKS.filter((l) => l.type === 'chest').forEach((lm) => {
    const cy = getTerrainHeight(lm.x, lm.z);
    const chestRoot = new TransformNode(`chest_${lm.id}`, scene);
    chestRoot.position.set(lm.x, cy, lm.z);

    const body = MeshBuilder.CreateBox(`chestBody_${lm.id}`, { width: 1.3, height: 0.68, depth: 0.86 }, scene);
    body.position.y = 0.34;
    body.material = woodMat;
    body.parent = chestRoot;
    shadows.addShadowCaster(body);

    const trim = MeshBuilder.CreateBox(`chestTrim_${lm.id}`, { width: 1.36, height: 0.14, depth: 0.92 }, scene);
    trim.position.y = 0.64;
    trim.material = goldMat;
    trim.parent = chestRoot;

    const lidPivot = new TransformNode(`chestLidPivot_${lm.id}`, scene);
    lidPivot.position.set(0, 0.68, -0.42);
    lidPivot.parent = chestRoot;

    const glowMat = new PBRMaterial(`chestGlow_${lm.id}`, scene);
    glowMat.albedoColor = new Color3(1.0, 0.82, 0.3);
    glowMat.emissiveColor = new Color3(1.1, 0.72, 0.18);
    glowMat.metallic = 0.6;
    glowMat.roughness = 0.25;

    const lid = MeshBuilder.CreateBox(`chestLid_${lm.id}`, { width: 1.32, height: 0.26, depth: 0.88 }, scene);
    lid.position.set(0, 0.12, 0.42);
    lid.material = glowMat;
    lid.parent = lidPivot;

    obstacles.push({ x: lm.x, z: lm.z, radius: 0.85 });

    chests.push({
      id: lm.id,
      name: lm.name,
      x: lm.x,
      z: lm.z,
      lidPivot,
      glowMat,
      opened: false,
    });
  });

  // 6. Northern Obsidian Boss Citadel Arena
  const bossLm = LANDMARKS.find((l) => l.type === 'boss')!;
  const by = getTerrainHeight(bossLm.x, bossLm.z);
  const arenaRing = MeshBuilder.CreateTorus('bossArenaRing', { diameter: 34, thickness: 0.65, tessellation: 48 }, scene);
  arenaRing.position.set(bossLm.x, by + 0.15, bossLm.z);
  arenaRing.material = ruinMat;
  arenaRing.receiveShadows = true;

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    if (Math.abs(Math.sin(ang) + 1) < 0.25) continue; // Leave southern entrance open
    const px = bossLm.x + Math.cos(ang) * 19;
    const pz = bossLm.z + Math.sin(ang) * 19;
    const py = getTerrainHeight(px, pz);
    const colH = 7.5 + (i % 2) * 2.5;
    const pillar = MeshBuilder.CreateCylinder(`citadelPillar_${i}`, { diameter: 1.85, height: colH, tessellation: 8 }, scene);
    pillar.position.set(px, py + colH / 2 - 0.3, pz);
    pillar.material = ruinMat;
    shadows.addShadowCaster(pillar);
    waterMaterial.addToRenderList(pillar);
    obstacles.push({ x: px, z: pz, radius: 1.1 });

    if (i % 2 === 0) {
      const brazier = MeshBuilder.CreateSphere(`citadelFlame_${i}`, { diameter: 0.72 }, scene);
      brazier.position.set(px, py + colH + 0.1, pz);
      const flameMat = new PBRMaterial(`brazierMat_${i}`, scene);
      flameMat.emissiveColor = new Color3(1.6, 0.55, 0.12);
      flameMat.albedoColor = new Color3(1.0, 0.5, 0.1);
      brazier.material = flameMat;
    }
  }

  // 7. ThinInstance Forests (Trunks + Multi-Tier Canopies) & Boulders & Aether Crystals
  const trunkMaster = MeshBuilder.CreateCylinder('treeTrunkMaster', { diameterTop: 0.42, diameterBottom: 0.75, height: 4.5, tessellation: 7 }, scene);
  trunkMaster.material = woodMat;
  trunkMaster.receiveShadows = true;
  shadows.addShadowCaster(trunkMaster);

  const canopyMat = new PBRMaterial('treeCanopyMat', scene);
  canopyMat.albedoColor = new Color3(0.14, 0.34, 0.17);
  canopyMat.metallic = 0.02;
  canopyMat.roughness = 0.82;
  const canopyMaster = MeshBuilder.CreateCylinder('treeCanopyMaster', { diameterTop: 0.1, diameterBottom: 4.2, height: 5.4, tessellation: 7 }, scene);
  canopyMaster.material = canopyMat;
  canopyMaster.receiveShadows = true;
  shadows.addShadowCaster(canopyMaster);
  waterMaterial.addToRenderList(canopyMaster);

  const trunkMatrices: number[] = [];
  const canopyMatrices: number[] = [];

  for (let i = 0; i < 155; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const radius = 22 + ((i * 37) % 138);
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    const ty = getTerrainHeight(tx, tz);
    const slope = getTerrainSlope(tx, tz);

    if (ty < WATER_LEVEL + 1.0 || slope > 0.65) continue;
    // Keep clear of landmarks & main northern road
    if (Math.abs(tx) < 12 && tz > -20 && tz < 145) continue;
    if (LANDMARKS.some((lm) => Math.hypot(tx - lm.x, tz - lm.z) < 16)) continue;

    const sc = 0.85 + ((i * 19) % 10) * 0.065;
    const rotY = (i * 1.13) % (Math.PI * 2);

    const tMat = Matrix.Compose(
      new Vector3(sc, sc, sc),
      Quaternion.RotationAxis(Vector3.Up(), rotY),
      new Vector3(tx, ty + 2.1 * sc, tz)
    );
    tMat.copyToArray(trunkMatrices, trunkMatrices.length);

    const cMat = Matrix.Compose(
      new Vector3(sc, sc, sc),
      Quaternion.RotationAxis(Vector3.Up(), rotY),
      new Vector3(tx, ty + 5.8 * sc, tz)
    );
    cMat.copyToArray(canopyMatrices, canopyMatrices.length);

    obstacles.push({ x: tx, z: tz, radius: 0.55 * sc });
  }

  if (trunkMatrices.length > 0) {
    trunkMaster.thinInstanceSetBuffer('matrix', new Float32Array(trunkMatrices), 16, true);
    canopyMaster.thinInstanceSetBuffer('matrix', new Float32Array(canopyMatrices), 16, true);
  }

  // Boulders ThinInstance
  const rockMat = new PBRMaterial('boulderMat', scene);
  rockMat.albedoTexture = textures.stoneAlbedo;
  rockMat.bumpTexture = textures.stoneNormal;
  rockMat.metallic = 0.06;
  rockMat.roughness = 0.88;
  const rockMaster = MeshBuilder.CreatePolyhedron('rockMaster', { type: 1, size: 1.5 }, scene);
  rockMaster.material = rockMat;
  rockMaster.receiveShadows = true;
  shadows.addShadowCaster(rockMaster);

  const rockMatrices: number[] = [];
  for (let i = 0; i < 85; i++) {
    const rx = Math.sin(i * 19.7) * 142;
    const rz = Math.cos(i * 13.3) * 142;
    const ry = getTerrainHeight(rx, rz);
    if (ry < WATER_LEVEL + 0.2) continue;
    if (LANDMARKS.some((lm) => Math.hypot(rx - lm.x, rz - lm.z) < 14)) continue;
    const sx = 0.9 + (i % 5) * 0.35;
    const sy = 0.7 + (i % 3) * 0.3;
    const mat = Matrix.Compose(
      new Vector3(sx, sy, sx * 0.9),
      Quaternion.RotationAxis(Vector3.Up(), i * 0.9),
      new Vector3(rx, ry + sy * 0.45, rz)
    );
    mat.copyToArray(rockMatrices, rockMatrices.length);
    obstacles.push({ x: rx, z: rz, radius: 1.2 * sx });
  }
  if (rockMatrices.length > 0) {
    rockMaster.thinInstanceSetBuffer('matrix', new Float32Array(rockMatrices), 16, true);
  }

  // Glowing Aether Crystal Clusters near Eastern Grove & Lakeshore
  const crystalClusterMat = new PBRMaterial('aetherClusterMat', scene);
  crystalClusterMat.albedoColor = new Color3(0.25, 0.78, 1.0);
  crystalClusterMat.emissiveColor = new Color3(0.28, 0.82, 1.35);
  crystalClusterMat.metallic = 0.25;
  crystalClusterMat.roughness = 0.15;
  const crystalMaster = MeshBuilder.CreateCylinder(
    'crystalMaster',
    { diameterTop: 0.05, diameterBottom: 0.75, height: 2.6, tessellation: 5 },
    scene
  );
  crystalMaster.material = crystalClusterMat;

  const crystalMatrices: number[] = [];
  for (let i = 0; i < 36; i++) {
    const cx = 85 + Math.cos(i * 1.4) * (10 + (i % 6) * 5);
    const cz = 16 + Math.sin(i * 1.4) * (10 + (i % 5) * 5);
    const cy = getTerrainHeight(cx, cz);
    const sc = 0.7 + (i % 4) * 0.25;
    const mat = Matrix.Compose(
      new Vector3(sc, sc * 1.2, sc),
      Quaternion.RotationYawPitchRoll(i, (i % 3) * 0.14, ((i + 1) % 3) * 0.12),
      new Vector3(cx, cy + sc * 0.9, cz)
    );
    mat.copyToArray(crystalMatrices, crystalMatrices.length);
  }
  if (crystalMatrices.length > 0) {
    crystalMaster.thinInstanceSetBuffer('matrix', new Float32Array(crystalMatrices), 16, true);
  }

  // 8. ThinInstance Valley Grass Tufts (Scalable by graphics preset)
  const grassMat = new PBRMaterial('grassBladeMat', scene);
  grassMat.albedoColor = new Color3(0.24, 0.5, 0.2);
  grassMat.metallic = 0.0;
  grassMat.roughness = 0.85;
  grassMat.backFaceCulling = false;

  const grassMaster = MeshBuilder.CreatePlane('grassTuft', { width: 0.65, height: 0.72 }, scene);
  grassMaster.material = grassMat;
  grassMaster.isPickable = false;

  const maxGrassCount = 2800;
  const grassMatrices: number[] = [];
  for (let i = 0; i < maxGrassCount; i++) {
    const gx = Math.sin(i * 12.9898) * 145;
    const gz = Math.cos(i * 78.233) * 145;
    const gy = getTerrainHeight(gx, gz);
    const slope = getTerrainSlope(gx, gz);
    if (gy < WATER_LEVEL + 0.95 || slope > 0.6 || gy > 14.5) continue;
    if (Math.hypot(gx, gz - 126) < 22) continue;

    const sc = 0.75 + (i % 5) * 0.16;
    const m = Matrix.Compose(
      new Vector3(sc, sc, sc),
      Quaternion.RotationAxis(Vector3.Up(), (i * 0.77) % (Math.PI * 2)),
      new Vector3(gx, gy + 0.3 * sc, gz)
    );
    m.copyToArray(grassMatrices, grassMatrices.length);
  }
  const actualGrassCount = grassMatrices.length / 16;
  if (actualGrassCount > 0) {
    grassMaster.thinInstanceSetBuffer('matrix', new Float32Array(grassMatrices), 16, true);
  }

  // 9. Atmospheric Fireflies / Sun Spores ParticleSystem following player area
  const fireflyEmitter = new TransformNode('fireflyEmitter', scene);
  const fireflies = new ParticleSystem('worldFireflies', 90, scene);
  fireflies.particleTexture = textures.particleGlow;
  fireflies.emitter = fireflyEmitter as unknown as Mesh;
  fireflies.minEmitBox = new Vector3(-22, 0.4, -22);
  fireflies.maxEmitBox = new Vector3(22, 5.5, 22);
  fireflies.color1 = new Color4(1.0, 0.88, 0.45, 0.75);
  fireflies.color2 = new Color4(0.45, 0.88, 1.0, 0.75);
  fireflies.colorDead = new Color4(0.4, 0.8, 1.0, 0);
  fireflies.minSize = 0.12;
  fireflies.maxSize = 0.28;
  fireflies.minLifeTime = 2.4;
  fireflies.maxLifeTime = 4.5;
  fireflies.emitRate = 22;
  fireflies.direction1 = new Vector3(-0.35, 0.18, -0.35);
  fireflies.direction2 = new Vector3(0.35, 0.48, 0.35);
  fireflies.start();

  const updateWorldVisuals = (dt: number, totalTime: number, playerPos: Vector3) => {
    fireflyEmitter.position.copyFrom(playerPos);
    campfireLight.intensity = 6.2 + Math.sin(totalTime * 14) * 1.1 + Math.cos(totalTime * 23) * 0.6;

    for (const s of shrines) {
      s.ring.rotation.y += dt * (s.activated ? 2.4 : 0.65);
      s.ring.rotation.x = Math.sin(totalTime * 1.4) * 0.24;
    }

    for (const c of chests) {
      if (c.opened && c.lidPivot.rotation.x > -1.4) {
        c.lidPivot.rotation.x = Math.max(-1.45, c.lidPivot.rotation.x - dt * 4.5);
      }
    }
  };

  const setGrassDensity = (ratio: number) => {
    const count = Math.floor(actualGrassCount * Math.max(0.1, Math.min(1, ratio)));
    grassMaster.thinInstanceCount = count;
  };

  const setWaterReflections = (enabled: boolean) => {
    if (enabled) {
      waterMaterial.bumpHeight = 0.14;
      waterMaterial.colorBlendFactor = 0.32;
      if (waterMaterial.reflectionTexture) {
        waterMaterial.reflectionTexture.refreshRate = 1;
      }
    } else {
      waterMaterial.bumpHeight = 0.05;
      waterMaterial.colorBlendFactor = 0.72;
      if (waterMaterial.reflectionTexture) {
        waterMaterial.reflectionTexture.refreshRate = 0;
      }
    }
  };

  return {
    terrain,
    waterMesh,
    waterMaterial,
    npcRoot,
    shrines,
    chests,
    obstacles,
    grassMaster,
    maxGrassCount: actualGrassCount,
    campfireLight,
    updateWorldVisuals,
    setGrassDensity,
    setWaterReflections,
  };
}
