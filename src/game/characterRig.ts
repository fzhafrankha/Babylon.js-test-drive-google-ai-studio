import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  TrailMesh,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

export interface PlayerRig {
  root: TransformNode;
  bodyPivot: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftLeg: TransformNode;
  rightLeg: TransformNode;
  capePivot: TransformNode;
  swordMesh: Mesh;
  swordTip: TransformNode;
  swordTrail: TrailMesh;
  shieldMesh: Mesh;
  shieldBubble: Mesh;
  auraLight: PointLight;
  animate: (
    dt: number,
    speed: number,
    isGrounded: boolean,
    attackTimer: number,
    comboStep: number,
    isBlocking: boolean,
    dodgeProgress: number
  ) => void;
}

export interface EnemyRig {
  root: TransformNode;
  bodyPivot: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  coreMat: PBRMaterial;
  telegraphRing?: Mesh;
  animate: (dt: number, time: number, isMoving: boolean, attackWindup: number, hitFlash: number) => void;
}

function makePbr(
  name: string,
  scene: Scene,
  albedo: Color3,
  metallic: number,
  roughness: number,
  emissive?: Color3
): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = albedo;
  mat.metallic = metallic;
  mat.roughness = roughness;
  if (emissive) {
    mat.emissiveColor = emissive;
  }
  return mat;
}

export function createPlayerRig(scene: Scene): PlayerRig {
  const root = new TransformNode('playerRoot', scene);
  const bodyPivot = new TransformNode('playerBodyPivot', scene);
  bodyPivot.parent = root;

  const armorSteel = makePbr('playerArmorSteel', scene, new Color3(0.24, 0.27, 0.34), 0.85, 0.28);
  const armorTrim = makePbr('playerArmorTrim', scene, new Color3(0.86, 0.66, 0.28), 0.92, 0.24);
  const tunicCloth = makePbr('playerTunic', scene, new Color3(0.11, 0.14, 0.22), 0.05, 0.82);
  const visorGlow = makePbr(
    'playerVisor',
    scene,
    new Color3(0.2, 0.8, 1.0),
    0.1,
    0.2,
    new Color3(0.35, 0.85, 1.25)
  );
  const bladeGlow = makePbr(
    'playerBlade',
    scene,
    new Color3(0.88, 0.92, 0.98),
    0.95,
    0.14,
    new Color3(0.45, 0.65, 1.0)
  );

  // Torso
  const torso = MeshBuilder.CreateBox('pTorso', { width: 0.62, height: 0.78, depth: 0.36 }, scene);
  torso.position.y = 1.22;
  torso.material = armorSteel;
  torso.parent = bodyPivot;

  const chestCore = MeshBuilder.CreateBox('pChestCore', { width: 0.22, height: 0.26, depth: 0.4 }, scene);
  chestCore.position.y = 1.28;
  chestCore.material = armorTrim;
  chestCore.parent = bodyPivot;

  // Helmet & Glowing Visor
  const head = MeshBuilder.CreateSphere('pHead', { diameter: 0.44, segments: 14 }, scene);
  head.position.y = 1.82;
  head.material = armorSteel;
  head.parent = bodyPivot;

  const crest = MeshBuilder.CreateBox('pCrest', { width: 0.08, height: 0.18, depth: 0.42 }, scene);
  crest.position.set(0, 2.02, -0.02);
  crest.material = armorTrim;
  crest.parent = bodyPivot;

  const visor = MeshBuilder.CreateBox('pVisor', { width: 0.3, height: 0.09, depth: 0.22 }, scene);
  visor.position.set(0, 1.83, 0.14);
  visor.material = visorGlow;
  visor.parent = bodyPivot;

  // Flowing Cape
  const capePivot = new TransformNode('pCapePivot', scene);
  capePivot.position.set(0, 1.56, -0.2);
  capePivot.parent = bodyPivot;
  const cape = MeshBuilder.CreateBox('pCape', { width: 0.56, height: 1.05, depth: 0.05 }, scene);
  cape.position.y = -0.52;
  cape.material = tunicCloth;
  cape.parent = capePivot;

  // Legs
  const leftLeg = new TransformNode('pLeftLeg', scene);
  leftLeg.position.set(-0.17, 0.84, 0);
  leftLeg.parent = bodyPivot;
  const lLegMesh = MeshBuilder.CreateCapsule('pLLegMesh', { radius: 0.12, height: 0.84 }, scene);
  lLegMesh.position.y = -0.42;
  lLegMesh.material = tunicCloth;
  lLegMesh.parent = leftLeg;

  const rightLeg = new TransformNode('pRightLeg', scene);
  rightLeg.position.set(0.17, 0.84, 0);
  rightLeg.parent = bodyPivot;
  const rLegMesh = MeshBuilder.CreateCapsule('pRLegMesh', { radius: 0.12, height: 0.84 }, scene);
  rLegMesh.position.y = -0.42;
  rLegMesh.material = tunicCloth;
  rLegMesh.parent = rightLeg;

  // Left Arm + Dawncrest Shield
  const leftArm = new TransformNode('pLeftArm', scene);
  leftArm.position.set(-0.42, 1.5, 0);
  leftArm.parent = bodyPivot;
  const lShoulder = MeshBuilder.CreateSphere('pLShoulder', { diameter: 0.28 }, scene);
  lShoulder.material = armorTrim;
  lShoulder.parent = leftArm;
  const lArmMesh = MeshBuilder.CreateCapsule('pLArmMesh', { radius: 0.1, height: 0.65 }, scene);
  lArmMesh.position.y = -0.32;
  lArmMesh.material = armorSteel;
  lArmMesh.parent = leftArm;

  const shieldMesh = MeshBuilder.CreateCylinder('pShield', { diameter: 0.62, height: 0.07, tessellation: 6 }, scene);
  shieldMesh.rotation.z = Math.PI / 2;
  shieldMesh.position.set(-0.14, -0.42, 0.16);
  shieldMesh.material = armorTrim;
  shieldMesh.parent = leftArm;

  // Translucent Magic Shield Barrier when blocking
  const shieldBubble = MeshBuilder.CreateSphere('pShieldBubble', { diameter: 2.1, segments: 18 }, scene);
  shieldBubble.position.y = 1.15;
  const bubbleMat = makePbr(
    'pShieldBubbleMat',
    scene,
    new Color3(0.25, 0.72, 1.0),
    0.1,
    0.1,
    new Color3(0.25, 0.65, 1.1)
  );
  bubbleMat.alpha = 0.28;
  shieldBubble.material = bubbleMat;
  shieldBubble.parent = bodyPivot;
  shieldBubble.setEnabled(false);

  // Right Arm + Rune Sword + TrailMesh
  const rightArm = new TransformNode('pRightArm', scene);
  rightArm.position.set(0.42, 1.5, 0);
  rightArm.parent = bodyPivot;
  const rShoulder = MeshBuilder.CreateSphere('pRShoulder', { diameter: 0.28 }, scene);
  rShoulder.material = armorTrim;
  rShoulder.parent = rightArm;
  const rArmMesh = MeshBuilder.CreateCapsule('pRArmMesh', { radius: 0.1, height: 0.65 }, scene);
  rArmMesh.position.y = -0.32;
  rArmMesh.material = armorSteel;
  rArmMesh.parent = rightArm;

  const swordMesh = MeshBuilder.CreateBox('pSwordBlade', { width: 0.08, height: 1.38, depth: 0.16 }, scene);
  swordMesh.position.set(0.02, -0.62, 0.56);
  swordMesh.rotation.x = Math.PI * 0.42;
  swordMesh.material = bladeGlow;
  swordMesh.parent = rightArm;

  const hilt = MeshBuilder.CreateBox('pSwordHilt', { width: 0.34, height: 0.07, depth: 0.09 }, scene);
  hilt.position.set(0, -0.62, 0);
  hilt.material = armorTrim;
  hilt.parent = swordMesh;

  const swordTip = new TransformNode('pSwordTip', scene);
  swordTip.position.set(0, 0.64, 0);
  swordTip.parent = swordMesh;

  // Weapon ribbon trail
  const swordTrail = new TrailMesh('swordTrail', swordMesh, scene, 0.28, 18, true);
  const trailMat = new PBRMaterial('swordTrailMat', scene);
  trailMat.emissiveColor = new Color3(0.55, 0.85, 1.4);
  trailMat.albedoColor = new Color3(0.7, 0.9, 1.0);
  trailMat.alpha = 0.72;
  trailMat.disableLighting = true;
  swordTrail.material = trailMat;
  swordTrail.stop();

  const auraLight = new PointLight('playerAuraLight', new Vector3(0, 1.5, 0), scene);
  auraLight.diffuse = new Color3(0.95, 0.78, 0.45);
  auraLight.intensity = 0.6;
  auraLight.range = 12;
  auraLight.parent = root;

  let walkPhase = 0;

  const animate = (
    dt: number,
    speed: number,
    isGrounded: boolean,
    attackTimer: number,
    comboStep: number,
    isBlocking: boolean,
    dodgeProgress: number
  ) => {
    if (dodgeProgress > 0) {
      // Forward somersault roll
      bodyPivot.rotation.x = dodgeProgress * Math.PI * 2;
      bodyPivot.position.y = Math.sin(dodgeProgress * Math.PI) * 0.35;
      capePivot.rotation.x = 0.9;
      return;
    }

    bodyPivot.rotation.x = 0;
    bodyPivot.position.y = 0;

    if (speed > 0.4 && isGrounded) {
      walkPhase += dt * (speed > 9 ? 14 : 9.5);
      const swing = Math.sin(walkPhase) * 0.68;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = isBlocking ? -0.95 : -swing * 0.65;
      if (attackTimer <= 0) {
        rightArm.rotation.x = swing * 0.55;
        rightArm.rotation.y = 0;
        rightArm.rotation.z = 0;
      }
      bodyPivot.position.y = Math.abs(Math.cos(walkPhase)) * 0.06;
      capePivot.rotation.x = 0.28 + Math.min(0.65, speed * 0.045) + Math.sin(walkPhase * 2) * 0.08;
    } else {
      walkPhase += dt * 2.2;
      leftLeg.rotation.x *= 0.82;
      rightLeg.rotation.x *= 0.82;
      leftArm.rotation.x = isBlocking ? -1.05 : leftArm.rotation.x * 0.82;
      if (attackTimer <= 0) {
        rightArm.rotation.x = Math.sin(walkPhase) * 0.04;
        rightArm.rotation.y *= 0.82;
        rightArm.rotation.z *= 0.82;
      }
      capePivot.rotation.x = 0.14 + Math.sin(walkPhase) * 0.05;
    }

    // Blocking posture
    leftArm.rotation.y = isBlocking ? 0.68 : 0;
    shieldBubble.setEnabled(isBlocking);
    if (isBlocking) {
      shieldBubble.rotation.y += dt * 1.5;
    }

    // Sword Combo swing choreography
    if (attackTimer > 0) {
      const t = 1 - Math.min(1, attackTimer / 0.32);
      if (comboStep === 1) {
        rightArm.rotation.x = -1.2 + t * 2.2;
        rightArm.rotation.y = 0.7 - t * 1.5;
        rightArm.rotation.z = -0.35;
      } else if (comboStep === 2) {
        rightArm.rotation.x = -0.7 + t * 1.3;
        rightArm.rotation.y = -0.9 + t * 1.9;
        rightArm.rotation.z = 0.45;
      } else {
        // Finisher overhead spin cleave
        rightArm.rotation.x = -2.2 + t * 3.1;
        rightArm.rotation.y = 0;
        bodyPivot.rotation.y = t * Math.PI * 2;
      }
    } else {
      bodyPivot.rotation.y = 0;
    }
  };

  return {
    root,
    bodyPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    capePivot,
    swordMesh,
    swordTip,
    swordTrail,
    shieldMesh,
    shieldBubble,
    auraLight,
    animate,
  };
}

export function createNpcRig(scene: Scene, pos: Vector3): TransformNode {
  const root = new TransformNode('npcLyraRoot', scene);
  root.position.copyFrom(pos);

  const robeMat = makePbr('lyraRobe', scene, new Color3(0.75, 0.62, 0.38), 0.15, 0.65);
  const cloakMat = makePbr('lyraCloak', scene, new Color3(0.18, 0.24, 0.36), 0.1, 0.75);
  const orbMat = makePbr(
    'lyraOrb',
    scene,
    new Color3(1.0, 0.85, 0.4),
    0.2,
    0.15,
    new Color3(1.3, 0.9, 0.3)
  );

  const dress = MeshBuilder.CreateCylinder('lyraDress', { diameterTop: 0.44, diameterBottom: 0.78, height: 1.42 }, scene);
  dress.position.y = 0.71;
  dress.material = robeMat;
  dress.parent = root;

  const shawl = MeshBuilder.CreateCylinder('lyraShawl', { diameterTop: 0.38, diameterBottom: 0.6, height: 0.45 }, scene);
  shawl.position.y = 1.28;
  shawl.material = cloakMat;
  shawl.parent = root;

  const head = MeshBuilder.CreateSphere('lyraHead', { diameter: 0.38 }, scene);
  head.position.y = 1.66;
  head.material = robeMat;
  head.parent = root;

  const staff = MeshBuilder.CreateCylinder('lyraStaff', { diameter: 0.06, height: 1.9 }, scene);
  staff.position.set(0.45, 0.95, 0.15);
  staff.material = cloakMat;
  staff.parent = root;

  const orb = MeshBuilder.CreateSphere('lyraOrbMesh', { diameter: 0.24 }, scene);
  orb.position.set(0.45, 1.98, 0.15);
  orb.material = orbMat;
  orb.parent = root;

  return root;
}

export function createEnemyRig(
  scene: Scene,
  kind: 'stalker' | 'golem' | 'boss',
  id: string
): EnemyRig {
  const root = new TransformNode(`enemy_${id}`, scene);
  const bodyPivot = new TransformNode(`enemyBody_${id}`, scene);
  bodyPivot.parent = root;

  const isBoss = kind === 'boss';
  const isGolem = kind === 'golem';

  const bodyMat = makePbr(
    `enemyBodyMat_${id}`,
    scene,
    isBoss
      ? new Color3(0.08, 0.08, 0.11)
      : isGolem
        ? new Color3(0.28, 0.31, 0.29)
        : new Color3(0.11, 0.09, 0.15),
    isBoss ? 0.65 : 0.25,
    isBoss ? 0.35 : 0.75
  );

  const baseEmissive = isBoss
    ? new Color3(1.5, 0.42, 0.15)
    : isGolem
      ? new Color3(1.1, 0.65, 0.15)
      : new Color3(1.3, 0.18, 0.28);

  const coreMat = makePbr(
    `enemyCoreMat_${id}`,
    scene,
    baseEmissive,
    0.2,
    0.2,
    baseEmissive
  );

  const scale = isBoss ? 2.55 : isGolem ? 1.38 : 0.95;
  bodyPivot.scaling.setAll(scale);

  const torso = MeshBuilder.CreateBox(`eTorso_${id}`, { width: 0.85, height: 1.05, depth: 0.56 }, scene);
  torso.position.y = 1.25;
  torso.material = bodyMat;
  torso.parent = bodyPivot;

  const core = MeshBuilder.CreateSphere(`eCore_${id}`, { diameter: 0.34 }, scene);
  core.position.set(0, 1.28, 0.22);
  core.material = coreMat;
  core.parent = bodyPivot;

  const head = MeshBuilder.CreateBox(`eHead_${id}`, { width: 0.46, height: 0.42, depth: 0.44 }, scene);
  head.position.y = 2.02;
  head.material = bodyMat;
  head.parent = bodyPivot;

  const eyes = MeshBuilder.CreateBox(`eEyes_${id}`, { width: 0.34, height: 0.08, depth: 0.12 }, scene);
  eyes.position.set(0, 2.04, 0.2);
  eyes.material = coreMat;
  eyes.parent = bodyPivot;

  if (isBoss) {
    // Horned obsidian crown
    [-0.24, 0.24].forEach((hx, idx) => {
      const horn = MeshBuilder.CreateCylinder(
        `bossHorn_${id}_${idx}`,
        { diameterTop: 0.03, diameterBottom: 0.15, height: 0.55 },
        scene
      );
      horn.position.set(hx, 2.38, 0);
      horn.rotation.z = hx < 0 ? 0.35 : -0.35;
      horn.material = coreMat;
      horn.parent = bodyPivot;
    });
  }

  const leftArm = new TransformNode(`eLArm_${id}`, scene);
  leftArm.position.set(-0.6, 1.62, 0);
  leftArm.parent = bodyPivot;
  const lArmMesh = MeshBuilder.CreateBox(`eLArmMesh_${id}`, { width: 0.28, height: 0.95, depth: 0.28 }, scene);
  lArmMesh.position.y = -0.42;
  lArmMesh.material = bodyMat;
  lArmMesh.parent = leftArm;

  const rightArm = new TransformNode(`eRArm_${id}`, scene);
  rightArm.position.set(0.6, 1.62, 0);
  rightArm.parent = bodyPivot;
  const rArmMesh = MeshBuilder.CreateBox(`eRArmMesh_${id}`, { width: 0.28, height: 0.95, depth: 0.28 }, scene);
  rArmMesh.position.y = -0.42;
  rArmMesh.material = bodyMat;
  rArmMesh.parent = rightArm;

  if (isBoss) {
    const bossSword = MeshBuilder.CreateBox(`bossSword_${id}`, { width: 0.18, height: 2.2, depth: 0.32 }, scene);
    bossSword.position.set(0, -0.82, 0.95);
    bossSword.rotation.x = Math.PI * 0.45;
    bossSword.material = coreMat;
    bossSword.parent = rightArm;
  }

  let telegraphRing: Mesh | undefined;
  if (isBoss) {
    telegraphRing = MeshBuilder.CreateTorus(
      `bossTelegraph_${id}`,
      { diameter: 14, thickness: 0.22, tessellation: 42 },
      scene
    );
    telegraphRing.position.y = 0.25;
    telegraphRing.material = coreMat;
    telegraphRing.parent = root;
    telegraphRing.setEnabled(false);
  }

  const animate = (
    _dt: number,
    time: number,
    isMoving: boolean,
    attackWindup: number,
    hitFlash: number
  ) => {
    if (hitFlash > 0) {
      coreMat.emissiveColor = new Color3(2.2, 2.2, 2.2);
    } else {
      coreMat.emissiveColor = baseEmissive;
    }

    if (attackWindup > 0) {
      // Raise arms before strike
      rightArm.rotation.x = -2.1 * Math.min(1, attackWindup);
      leftArm.rotation.x = isBoss ? -1.8 * Math.min(1, attackWindup) : -0.4;
    } else if (isMoving) {
      const sway = Math.sin(time * (isBoss ? 4.5 : 7.5)) * 0.55;
      leftArm.rotation.x = sway;
      rightArm.rotation.x = -sway;
      bodyPivot.position.y = Math.abs(Math.cos(time * 4.5)) * 0.08;
    } else {
      leftArm.rotation.x = Math.sin(time * 2) * 0.08;
      rightArm.rotation.x = -Math.sin(time * 2) * 0.08;
      bodyPivot.position.y = Math.sin(time * 2) * 0.04;
    }
  };

  return {
    root,
    bodyPivot,
    leftArm,
    rightArm,
    coreMat,
    telegraphRing,
    animate,
  };
}
