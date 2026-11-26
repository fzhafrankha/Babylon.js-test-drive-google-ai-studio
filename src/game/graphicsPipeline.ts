import {
  Camera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  PointsCloudSystem,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  VolumetricLightScatteringPostProcess,
} from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';
import { GraphicsSettings } from '../types/game';

export interface GraphicsController {
  skyMesh: Mesh;
  skyMaterial: SkyMaterial;
  sunDisc: Mesh;
  sunLight: DirectionalLight;
  hemiLight: HemisphericLight;
  shadowGenerator: CascadedShadowGenerator;
  pipeline: DefaultRenderingPipeline;
  godRays: VolumetricLightScatteringPostProcess | null;
  reflectionProbe: ReflectionProbe;
  starCloud: PointsCloudSystem;
  updateAtmosphere: (timeOfDay: number, cameraPos: Vector3) => void;
  applySettings: (settings: GraphicsSettings, onGrassDensityChange?: (density: number) => void) => void;
  dispose: () => void;
}

function lerpColor3(a: Color3, b: Color3, t: number): Color3 {
  const k = Math.max(0, Math.min(1, t));
  return new Color3(
    a.r + (b.r - a.r) * k,
    a.g + (b.g - a.g) * k,
    a.b + (b.b - a.b) * k
  );
}

export function createGraphicsPipeline(
  scene: Scene,
  camera: Camera,
  initialSettings: GraphicsSettings
): GraphicsController {
  // Exponential distance fog matching atmospheric horizon
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0028;
  scene.fogColor = new Color3(0.58, 0.66, 0.78);
  scene.clearColor = new Color4(0.06, 0.08, 0.14, 1);

  // Physically based SkyMaterial (Rayleigh + Mie atmospheric scattering)
  const skyMesh = MeshBuilder.CreateBox('skyBox', { size: 920 }, scene);
  skyMesh.infiniteDistance = true;
  skyMesh.isPickable = false;

  const skyMaterial = new SkyMaterial('skyMaterial', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.turbidity = 4.5;
  skyMaterial.luminance = 1.05;
  skyMaterial.rayleigh = 2.2;
  skyMaterial.mieCoefficient = 0.0055;
  skyMaterial.mieDirectionalG = 0.82;
  skyMaterial.useSunPosition = true;
  skyMaterial.sunPosition = new Vector3(120, 95, 110);
  skyMesh.material = skyMaterial;

  // Starfield PointsCloudSystem visible at dusk & night
  const starCloud = new PointsCloudSystem('starField', 2, scene);
  starCloud.addPoints(1100, (particle: { position: Vector3; color: Color4 }) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85 + 0.15);
    const r = 420;
    particle.position = new Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    const tint = 0.82 + Math.random() * 0.18;
    particle.color = new Color4(tint, tint * 0.96, 1, 0.9);
  });
  let starMesh: Mesh | null = null;
  void starCloud.buildMeshAsync().then((mesh) => {
    starMesh = mesh;
    starMesh.isPickable = false;
    starMesh.infiniteDistance = true;
  });

  // Glowing Sun Disc for Volumetric Light Scattering (God Rays)
  const sunDisc = MeshBuilder.CreateSphere('sunDisc', { diameter: 26, segments: 16 }, scene);
  sunDisc.isPickable = false;
  const sunMat = new StandardMaterial('sunDiscMat', scene);
  sunMat.emissiveColor = new Color3(1.0, 0.84, 0.56);
  sunMat.disableLighting = true;
  sunDisc.material = sunMat;

  // Main Directional Sunlight + Ambient Hemisphere Fill
  const sunLight = new DirectionalLight('sunLight', new Vector3(-0.5, -0.75, -0.45), scene);
  sunLight.position = new Vector3(120, 180, 100);
  sunLight.intensity = 2.8;
  sunLight.shadowMinZ = 2;
  sunLight.shadowMaxZ = 340;

  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.68;
  hemiLight.diffuse = new Color3(0.75, 0.84, 0.98);
  hemiLight.groundColor = new Color3(0.18, 0.16, 0.14);

  // Cascaded Shadow Generator for sharp near shadows + wide terrain shadows
  const shadowGenerator = new CascadedShadowGenerator(2048, sunLight);
  shadowGenerator.numCascades = 3;
  shadowGenerator.lambda = 0.72;
  shadowGenerator.cascadeBlendPercentage = 0.08;
  shadowGenerator.stabilizeCascades = true;
  shadowGenerator.shadowMaxZ = 220;
  shadowGenerator.bias = 0.004;
  shadowGenerator.normalBias = 0.02;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadowGenerator.autoCalcDepthBounds = true;

  // Periodic PBR ReflectionProbe capturing sky + landscape for realistic armor/sword/stone speculars
  const reflectionProbe = new ReflectionProbe('envProbe', 128, scene, true);
  if (reflectionProbe.renderList) {
    reflectionProbe.renderList.push(skyMesh);
  }
  reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  scene.environmentTexture = reflectionProbe.cubeTexture;
  scene.environmentIntensity = 0.85;

  // HDR Default Rendering Pipeline (ACES Filmic Tone Mapping + Bloom + FXAA + Vignette)
  const pipeline = new DefaultRenderingPipeline('hdrPipeline', true, scene, [camera]);
  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.14;
  pipeline.imageProcessing.contrast = 1.18;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.35;
  pipeline.imageProcessing.vignetteColor = new Color4(0.02, 0.025, 0.04, 1);

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.78;
  pipeline.bloomWeight = 0.42;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.22;

  // Volumetric God Rays attached to sun disc
  let godRays: VolumetricLightScatteringPostProcess | null = null;
  const createGodRays = () => {
    if (godRays) return;
    godRays = new VolumetricLightScatteringPostProcess(
      'godRays',
      1.0,
      camera,
      sunDisc,
      65,
      undefined,
      scene.getEngine(),
      false
    );
    godRays.exposure = 0.24;
    godRays.decay = 0.968;
    godRays.weight = 0.52;
    godRays.density = 0.88;
    godRays.useDiffuseColor = false;
  };

  const disposeGodRays = () => {
    if (godRays) {
      godRays.dispose(camera);
      godRays = null;
    }
  };

  let probeFrameCounter = 0;

  const updateAtmosphere = (timeOfDay: number, cameraPos: Vector3) => {
    // 6:00 sunrise, 12:00 zenith, 18:00 sunset, 0:00 midnight
    const sunAngle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 0.85;
    const sunZ = 0.42;

    const sunDir = new Vector3(sunX, sunY, sunZ).normalize();
    const skySunPos = sunDir.scale(350);
    skyMaterial.sunPosition = skySunPos;
    sunDisc.position = cameraPos.add(sunDir.scale(380));

    const isDay = sunY > -0.05;
    const lightDir = isDay ? sunDir : new Vector3(-sunX, Math.abs(sunY) + 0.25, -sunZ).normalize();
    sunLight.direction = lightDir.scale(-1);
    sunLight.position = cameraPos.add(lightDir.scale(150));

    // Smooth atmospheric color curves
    const dayFactor = Math.max(0, Math.min(1, (sunY + 0.1) / 0.55));
    const goldenFactor = Math.max(0, 1 - Math.abs(sunY - 0.08) / 0.28);

    const nightColor = new Color3(0.28, 0.42, 0.72);
    const goldenColor = new Color3(1.0, 0.62, 0.34);
    const noonColor = new Color3(1.0, 0.96, 0.88);

    let sunCol = lerpColor3(nightColor, noonColor, dayFactor);
    sunCol = lerpColor3(sunCol, goldenColor, goldenFactor * 0.75);
    sunLight.diffuse = sunCol;
    sunLight.specular = sunCol;
    sunLight.intensity = 0.55 + dayFactor * 2.45 + goldenFactor * 0.35;

    // Sky Material parameters
    skyMaterial.rayleigh = 1.3 + goldenFactor * 2.1 + (1 - dayFactor) * 0.6;
    skyMaterial.turbidity = 3.2 + goldenFactor * 5.2;
    skyMaterial.luminance = 0.22 + dayFactor * 0.88;

    // Hemisphere ambient fill
    const hemiNight = new Color3(0.18, 0.26, 0.48);
    const hemiDay = new Color3(0.72, 0.84, 1.0);
    hemiLight.diffuse = lerpColor3(hemiNight, hemiDay, dayFactor);
    hemiLight.intensity = 0.38 + dayFactor * 0.42;

    // Fog color synchronized with horizon
    const fogNight = new Color3(0.05, 0.08, 0.16);
    const fogGolden = new Color3(0.74, 0.48, 0.35);
    const fogDay = new Color3(0.56, 0.69, 0.84);
    let fogCol = lerpColor3(fogNight, fogDay, dayFactor);
    fogCol = lerpColor3(fogCol, fogGolden, goldenFactor * 0.68);
    scene.fogColor = fogCol;
    scene.fogDensity = 0.0024 + (1 - dayFactor) * 0.0014 + goldenFactor * 0.0005;

    // Sun disc visibility & god rays intensity
    sunDisc.setEnabled(sunY > -0.06);
    if (godRays) {
      godRays.exposure = Math.max(0.02, (dayFactor * 0.22 + goldenFactor * 0.16) * (sunY > 0 ? 1 : 0));
    }

    // Starfield fade in at night
    if (starMesh) {
      const nightVis = Math.max(0, 1 - dayFactor * 1.4);
      starMesh.visibility = nightVis;
      starMesh.setEnabled(nightVis > 0.03);
    }

    // Periodically refresh PBR environment reflection probe for sky shifts
    probeFrameCounter++;
    if (probeFrameCounter % 90 === 0) {
      reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }
  };

  const applySettings = (
    settings: GraphicsSettings,
    onGrassDensityChange?: (density: number) => void
  ) => {
    const engine = scene.getEngine();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (settings.preset === 'ultra') {
      engine.setHardwareScalingLevel(1 / Math.min(dpr, 1.75));
      pipeline.samples = 4;
      pipeline.fxaaEnabled = true;
      pipeline.sharpenEnabled = true;
      shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
      onGrassDensityChange?.(1.0);
    } else if (settings.preset === 'high') {
      engine.setHardwareScalingLevel(1 / Math.min(dpr, 1.25));
      pipeline.samples = 2;
      pipeline.fxaaEnabled = true;
      pipeline.sharpenEnabled = true;
      shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      onGrassDensityChange?.(0.65);
    } else {
      engine.setHardwareScalingLevel(1.0);
      pipeline.samples = 1;
      pipeline.fxaaEnabled = true;
      pipeline.sharpenEnabled = false;
      shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
      onGrassDensityChange?.(0.32);
    }

    pipeline.bloomEnabled = settings.bloomEnabled;
    sunLight.shadowEnabled = settings.shadowsEnabled;

    if (settings.godRaysEnabled && settings.preset !== 'balanced') {
      createGodRays();
    } else {
      disposeGodRays();
    }
  };

  applySettings(initialSettings);

  return {
    skyMesh,
    skyMaterial,
    sunDisc,
    sunLight,
    hemiLight,
    shadowGenerator,
    pipeline,
    godRays,
    reflectionProbe,
    starCloud,
    updateAtmosphere,
    applySettings,
    dispose: () => {
      disposeGodRays();
      pipeline.dispose();
      reflectionProbe.dispose();
      shadowGenerator.dispose();
      starCloud.dispose();
    },
  };
}
