import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  Matrix,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PointLight,
  Scene,
  Vector3,
} from '@babylonjs/core';
import { soundEngine } from '../audio/soundEngine';
import {
  BossHudState,
  DEFAULT_GRAPHICS_SETTINGS,
  FloatingDamageNumber,
  GameItem,
  GraphicsSettings,
  HudSnapshot,
  INITIAL_ITEMS,
  InputState,
  InteractionPrompt,
  LOOT_TABLE,
  SaveSlotData,
} from '../types/game';
import { createEnemyRig, createPlayerRig, EnemyRig, PlayerRig } from './characterRig';
import { createGraphicsPipeline, GraphicsController } from './graphicsPipeline';
import { createProceduralTexturePack, ProceduralTexturePack } from './proceduralTextures';
import {
  CAMPFIRE_POSITION,
  getRegionName,
  getTerrainHeight,
  LANDMARKS,
  NPC_POSITION,
  WATER_LEVEL,
  WORLD_HALF,
} from './terrainMath';
import { buildOpenWorld, BuiltWorld } from './worldBuilder';

interface EnemyEntity {
  id: string;
  name: string;
  kind: 'stalker' | 'golem' | 'boss';
  rig: EnemyRig;
  homePos: Vector3;
  pos: Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  xpReward: number;
  dead: boolean;
  respawnTimer: number;
  attackCooldown: number;
  windupTimer: number;
  windupDuration: number;
  isAoeSlam: boolean;
  hitFlashTimer: number;
  staggerTimer: number;
}

interface ArcaneProjectile {
  mesh: Mesh;
  light: PointLight;
  vel: Vector3;
  life: number;
  damage: number;
}

interface SolarPillarVfx {
  mesh: Mesh;
  light: PointLight;
  life: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onDamageNumber: (dmg: FloatingDamageNumber) => void;
  onToast: (message: string, tone?: 'gold' | 'cyan' | 'emerald' | 'crimson') => void;
  onOpenNpcDialog: () => void;
  onShrineActivated: (shrineId: string, totalCount: number) => void;
  onChestLooted: (item: GameItem) => void;
  onVictory: () => void;
  onContextLost: (lost: boolean) => void;
}

export class AethelgardEngine {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private textures: ProceduralTexturePack;
  private graphics: GraphicsController;
  private world: BuiltWorld;
  private playerRig: PlayerRig;
  private callbacks: EngineCallbacks;

  private isPlaying = false;
  private isPaused = false;
  private settings: GraphicsSettings = { ...DEFAULT_GRAPHICS_SETTINGS };

  // Camera state
  private cameraYaw = 0;
  private cameraPitch = 0.34;
  private cameraDist = 7.4;
  private titleOrbitAngle = 0;
  private shakeIntensity = 0;

  // Player state
  private playerPos = new Vector3(0, 4, -20);
  private playerVelY = 0;
  private playerYaw = 0;
  private isGrounded = true;
  private hp = 240;
  private maxHp = 240;
  private mana = 120;
  private maxMana = 120;
  private stamina = 100;
  private maxStamina = 100;
  private level = 1;
  private xp = 0;
  private nextLevelXp = 100;
  private baseAttack = 22;
  private baseDefense = 8;
  private isDead = false;
  private footstepTimer = 0;

  // Combat timers
  private attackTimer = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private attackHitApplied = false;
  private dodgeTimer = 0;
  private dodgeDir = new Vector3(0, 0, 1);
  private blockStartTime = 0;
  private wasBlocking = false;
  private lockedEnemyId: string | null = null;

  // Skills cooldown
  private cdArcane = 0;
  private cdSolar = 0;
  private cdHeal = 0;

  // World & RPG progression
  private timeOfDay = 16.8; // Golden late-afternoon on first load
  private totalTime = 0;
  private activatedShrines = new Set<string>();
  private openedChests = new Set<string>();
  private bossDefeated = false;
  private questStage: HudSnapshot['questStage'] = 'talk_lyra';
  private inventory: GameItem[] = INITIAL_ITEMS.map((i) => ({ ...i }));
  private equippedWeaponId = 'blade_wanderer';
  private equippedRelicId: string | null = null;

  // Entities & VFX
  private enemies: EnemyEntity[] = [];
  private projectiles: ArcaneProjectile[] = [];
  private solarPillars: SolarPillarVfx[] = [];
  private dmgIdCounter = 1;
  private hudSyncAccum = 0;

  // Unified input state (Desktop + Multi-Touch)
  private keys = new Set<string>();
  private touchInput: InputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    jumpPressed: false,
    attackPressed: false,
    dodgePressed: false,
    blockHeld: false,
    lockOnPressed: false,
    interactPressed: false,
    skill1Pressed: false,
    skill2Pressed: false,
    skill3Pressed: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
  };
  private desktopQueued = {
    jump: false,
    attack: false,
    dodge: false,
    lockOn: false,
    interact: false,
    skill1: false,
    skill2: false,
    skill3: false,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    rightMouseHeld: false,
  };

  private disposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks, initialSettings?: GraphicsSettings) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    if (initialSettings) {
      this.settings = { ...initialSettings };
    }

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.scene = new Scene(this.engine);
    this.camera = new FreeCamera('mainCamera', new Vector3(0, 12, -45), this.scene);
    this.camera.minZ = 0.2;
    this.camera.maxZ = 1000;
    this.camera.fov = (this.settings.fov * Math.PI) / 180;

    this.textures = createProceduralTexturePack(this.scene);
    this.graphics = createGraphicsPipeline(this.scene, this.camera, this.settings);
    this.world = buildOpenWorld(this.scene, this.textures, this.graphics);
    this.graphics.applySettings(this.settings, (density) => this.world.setGrassDensity(density));

    this.playerRig = createPlayerRig(this.scene);
    this.playerPos.y = getTerrainHeight(this.playerPos.x, this.playerPos.z);
    this.playerRig.root.position.copyFrom(this.playerPos);
    this.playerRig.root.getChildMeshes().forEach((m) => {
      this.graphics.shadowGenerator.addShadowCaster(m);
    });

    this.spawnWorldEnemies();
    this.bindInputListeners();
    this.bindWebGLContextHandlers();

    this.engine.runRenderLoop(() => {
      if (this.disposed) return;
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
  }

  private spawnWorldEnemies(): void {
    const spawns: { id: string; name: string; kind: 'stalker' | 'golem' | 'boss'; x: number; z: number }[] = [
      { id: 'stalker_1', name: 'Pengintai Bayangan', kind: 'stalker', x: 34, z: 8 },
      { id: 'stalker_2', name: 'Pengintai Bayangan', kind: 'stalker', x: -38, z: 4 },
      { id: 'stalker_3', name: 'Pengintai Bayangan', kind: 'stalker', x: 18, z: -86 },
      { id: 'stalker_4', name: 'Pengintai Bayangan', kind: 'stalker', x: 76, z: 24 },
      { id: 'golem_east', name: 'Golem Penjaga Kristal', kind: 'golem', x: 86, z: 12 },
      { id: 'golem_west', name: 'Golem Lumut Kuno', kind: 'golem', x: -86, z: 14 },
      { id: 'golem_south', name: 'Golem Monolit', kind: 'golem', x: 12, z: -106 },
      { id: 'boss_colossus', name: 'Obsidian Colossus', kind: 'boss', x: 0, z: 126 },
    ];

    for (const sp of spawns) {
      const y = getTerrainHeight(sp.x, sp.z);
      const rig = createEnemyRig(this.scene, sp.kind, sp.id);
      const pos = new Vector3(sp.x, y, sp.z);
      rig.root.position.copyFrom(pos);
      rig.root.getChildMeshes().forEach((m) => this.graphics.shadowGenerator.addShadowCaster(m));

      const isBoss = sp.kind === 'boss';
      const isGolem = sp.kind === 'golem';
      const maxHp = isBoss ? 950 : isGolem ? 240 : 115;

      this.enemies.push({
        id: sp.id,
        name: sp.name,
        kind: sp.kind,
        rig,
        homePos: pos.clone(),
        pos,
        yaw: Math.PI,
        hp: maxHp,
        maxHp,
        attack: isBoss ? 36 : isGolem ? 22 : 13,
        speed: isBoss ? 4.4 : isGolem ? 3.5 : 5.6,
        aggroRange: isBoss ? 27 : 18,
        attackRange: isBoss ? 4.4 : isGolem ? 2.8 : 2.3,
        xpReward: isBoss ? 450 : isGolem ? 95 : 45,
        dead: false,
        respawnTimer: 0,
        attackCooldown: 1.0,
        windupTimer: 0,
        windupDuration: isBoss ? 0.95 : 0.6,
        isAoeSlam: false,
        hitFlashTimer: 0,
        staggerTimer: 0,
      });
    }
  }

  private bindWebGLContextHandlers(): void {
    const onLost = (e: Event) => {
      e.preventDefault();
      this.isPaused = true;
      this.callbacks.onContextLost(true);
    };
    const onRestored = () => {
      this.isPaused = false;
      this.callbacks.onContextLost(false);
    };
    this.canvas.addEventListener('webglcontextlost', onLost);
    this.canvas.addEventListener('webglcontextrestored', onRestored);

    const onResize = () => this.engine.resize();
    window.addEventListener('resize', onResize);

    // Store cleanup hooks on scene dispose
    this.scene.onDisposeObservable.add(() => {
      this.canvas.removeEventListener('webglcontextlost', onLost);
      this.canvas.removeEventListener('webglcontextrestored', onRestored);
      window.removeEventListener('resize', onResize);
    });
  }

  private bindInputListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.isPlaying || this.isPaused) return;
      const code = e.code;
      this.keys.add(code);
      if (code === 'Space') this.desktopQueued.jump = true;
      if (code === 'KeyC' || code === 'ControlLeft') this.desktopQueued.dodge = true;
      if (code === 'KeyQ') this.desktopQueued.lockOn = true;
      if (code === 'KeyE') this.desktopQueued.interact = true;
      if (code === 'Digit1') this.desktopQueued.skill1 = true;
      if (code === 'Digit2') this.desktopQueued.skill2 = true;
      if (code === 'Digit3') this.desktopQueued.skill3 = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!this.isPlaying || this.isPaused) return;
      soundEngine.unlock();
      // Only handle direct canvas clicks (not HUD buttons)
      if (e.target !== this.canvas) return;
      if (e.button === 0) {
        if (!document.pointerLockElement && window.matchMedia('(pointer: fine)').matches) {
          this.canvas.requestPointerLock?.();
        }
        this.desktopQueued.attack = true;
      } else if (e.button === 2) {
        this.desktopQueued.rightMouseHeld = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        this.desktopQueued.rightMouseHeld = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isPlaying || this.isPaused) return;
      if (document.pointerLockElement === this.canvas) {
        this.desktopQueued.mouseDeltaX += e.movementX;
        this.desktopQueued.mouseDeltaY += e.movementY;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!this.isPlaying || this.isPaused) return;
      this.cameraDist = Math.max(4.2, Math.min(13.5, this.cameraDist + e.deltaY * 0.005));
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === this.canvas) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    this.canvas.addEventListener('wheel', onWheel, { passive: true });
    this.canvas.addEventListener('contextmenu', onContextMenu);

    this.scene.onDisposeObservable.add(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      this.canvas.removeEventListener('wheel', onWheel);
      this.canvas.removeEventListener('contextmenu', onContextMenu);
    });
  }

  // Public touchscreen / UI input bridge
  public setTouchMove(x: number, y: number, sprint: boolean): void {
    this.touchInput.moveX = x;
    this.touchInput.moveY = y;
    this.touchInput.sprint = sprint;
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    this.touchInput.lookDeltaX += dx;
    this.touchInput.lookDeltaY += dy;
  }

  public setTouchBlock(held: boolean): void {
    this.touchInput.blockHeld = held;
  }

  public triggerAction(
    action: 'attack' | 'dodge' | 'jump' | 'lockOn' | 'interact' | 'skill1' | 'skill2' | 'skill3'
  ): void {
    soundEngine.unlock();
    if (action === 'attack') this.touchInput.attackPressed = true;
    if (action === 'dodge') this.touchInput.dodgePressed = true;
    if (action === 'jump') this.touchInput.jumpPressed = true;
    if (action === 'lockOn') this.touchInput.lockOnPressed = true;
    if (action === 'interact') this.touchInput.interactPressed = true;
    if (action === 'skill1') this.touchInput.skill1Pressed = true;
    if (action === 'skill2') this.touchInput.skill2Pressed = true;
    if (action === 'skill3') this.touchInput.skill3Pressed = true;
  }

  public startNewGame(): void {
    soundEngine.unlock();
    this.isPlaying = true;
    this.isPaused = false;
    this.isDead = false;
    this.playerPos.set(0, getTerrainHeight(0, -20), -20);
    this.playerVelY = 0;
    this.playerYaw = 0;
    this.cameraYaw = 0;
    this.level = 1;
    this.xp = 0;
    this.nextLevelXp = 100;
    this.baseAttack = 22;
    this.baseDefense = 8;
    this.inventory = INITIAL_ITEMS.map((i) => ({ ...i }));
    this.equippedWeaponId = 'blade_wanderer';
    this.equippedRelicId = null;
    this.recalcDerivedStats(true);
    this.activatedShrines.clear();
    this.openedChests.clear();
    this.bossDefeated = false;
    this.questStage = 'talk_lyra';
    this.timeOfDay = 16.5;

    for (const s of this.world.shrines) {
      s.activated = false;
      s.crystalMat.emissiveColor = new Color3(0.2, 0.65, 1.15);
      s.light.diffuse = new Color3(0.35, 0.8, 1.0);
      s.light.intensity = 3.2;
    }
    for (const c of this.world.chests) {
      c.opened = false;
      c.lidPivot.rotation.x = 0;
      c.glowMat.emissiveColor = new Color3(1.1, 0.72, 0.18);
    }
    for (const e of this.enemies) {
      e.dead = false;
      e.hp = e.maxHp;
      e.pos.copyFrom(e.homePos);
      e.rig.root.position.copyFrom(e.pos);
      e.rig.root.setEnabled(true);
    }
  }

  public loadFromSave(save: SaveSlotData): void {
    soundEngine.unlock();
    this.isPlaying = true;
    this.isPaused = false;
    this.isDead = false;
    this.level = save.level;
    this.xp = save.xp;
    this.nextLevelXp = save.nextLevelXp;
    this.baseAttack = save.baseAttack;
    this.baseDefense = save.baseDefense;
    this.inventory = save.inventory.map((i) => ({ ...i }));
    this.equippedWeaponId = save.equippedWeaponId;
    this.equippedRelicId = save.equippedRelicId;
    this.recalcDerivedStats(false);
    this.hp = Math.min(this.maxHp, Math.max(20, save.hp));
    this.mana = Math.min(this.maxMana, save.mana);
    this.stamina = this.maxStamina;
    this.playerPos.set(save.playerX, getTerrainHeight(save.playerX, save.playerZ), save.playerZ);
    this.timeOfDay = save.timeOfDay;
    this.activatedShrines = new Set(save.activatedShrines);
    this.openedChests = new Set(save.openedChests);
    this.bossDefeated = save.bossDefeated;
    this.questStage = save.questStage;

    for (const s of this.world.shrines) {
      s.activated = this.activatedShrines.has(s.id);
      if (s.activated) {
        s.crystalMat.emissiveColor = new Color3(1.4, 0.95, 0.25);
        s.light.diffuse = new Color3(1.0, 0.8, 0.35);
        s.light.intensity = 7.5;
      }
    }
    for (const c of this.world.chests) {
      c.opened = this.openedChests.has(c.id);
      if (c.opened) {
        c.lidPivot.rotation.x = -1.45;
        c.glowMat.emissiveColor = new Color3(0.15, 0.15, 0.15);
      }
    }
    for (const e of this.enemies) {
      if (e.kind === 'boss' && this.bossDefeated) {
        e.dead = true;
        e.hp = 0;
        e.rig.root.setEnabled(false);
      } else {
        e.dead = false;
        e.hp = e.maxHp;
        e.pos.copyFrom(e.homePos);
        e.rig.root.setEnabled(true);
      }
    }
  }

  public exportSaveData(slotIndex: number): SaveSlotData {
    return {
      slotIndex,
      savedAt: new Date().toISOString(),
      level: this.level,
      regionName: getRegionName(this.playerPos.x, this.playerPos.z),
      activatedShrines: Array.from(this.activatedShrines),
      openedChests: Array.from(this.openedChests),
      bossDefeated: this.bossDefeated,
      questStage: this.questStage,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      mana: Math.round(this.mana),
      maxMana: this.maxMana,
      xp: this.xp,
      nextLevelXp: this.nextLevelXp,
      baseAttack: this.baseAttack,
      baseDefense: this.baseDefense,
      playerX: Number(this.playerPos.x.toFixed(1)),
      playerZ: Number(this.playerPos.z.toFixed(1)),
      timeOfDay: Number(this.timeOfDay.toFixed(2)),
      equippedWeaponId: this.equippedWeaponId,
      equippedRelicId: this.equippedRelicId,
      inventory: this.inventory.map((i) => ({ ...i })),
    };
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.keys.clear();
      this.desktopQueued.rightMouseHeld = false;
      this.touchInput.moveX = 0;
      this.touchInput.moveY = 0;
      this.touchInput.sprint = false;
      this.touchInput.blockHeld = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public applySettings(newSettings: GraphicsSettings): void {
    this.settings = { ...newSettings };
    this.camera.fov = (this.settings.fov * Math.PI) / 180;
    this.graphics.applySettings(this.settings, (density) => this.world.setGrassDensity(density));
    this.world.setWaterReflections(this.settings.waterReflections);
    soundEngine.setVolume(this.settings.audioVolume, this.settings.audioMuted);
  }

  public getInventoryState() {
    return {
      items: this.inventory,
      equippedWeaponId: this.equippedWeaponId,
      equippedRelicId: this.equippedRelicId,
    };
  }

  public equipOrUseItem(itemId: string): void {
    const item = this.inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (item.category === 'weapon') {
      this.equippedWeaponId = item.id;
      this.recalcDerivedStats(false);
      this.callbacks.onToast(`Senjata dipasang: ${item.name}`, 'gold');
    } else if (item.category === 'relic') {
      this.equippedRelicId = this.equippedRelicId === item.id ? null : item.id;
      this.recalcDerivedStats(false);
      this.callbacks.onToast(
        this.equippedRelicId ? `Relik dipasang: ${item.name}` : `Relik dilepas: ${item.name}`,
        'cyan'
      );
    } else if (item.category === 'consumable') {
      if (item.quantity <= 0) return;
      item.quantity -= 1;
      const healHp = item.healHp ?? 100;
      const healMana = item.healMana ?? 30;
      this.hp = Math.min(this.maxHp, this.hp + healHp);
      this.mana = Math.min(this.maxMana, this.mana + healMana);
      soundEngine.playMagicCast('heal');
      this.spawnFloatingNumber(this.playerPos.add(new Vector3(0, 2.2, 0)), healHp, 'heal');
      if (item.quantity <= 0) {
        this.inventory = this.inventory.filter((i) => i.id !== item.id);
      }
    }
  }

  public respawnAtSanctuary(): void {
    this.isDead = false;
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.stamina = this.maxStamina;
    this.playerPos.set(0, getTerrainHeight(0, -20), -20);
    this.playerVelY = 0;
    this.callbacks.onToast('Bangkit kembali di Perkemahan Sanctuary.', 'gold');
  }

  public markLyraSpoken(): void {
    if (this.questStage === 'talk_lyra') {
      this.questStage = 'activate_shrines';
      this.callbacks.onToast('Misi Diperbarui: Aktifkan 3 Sun Shrines!', 'gold');
    }
    // Rest & heal at Sanctuary
    this.hp = this.maxHp;
    this.mana = this.maxMana;
  }

  private getWeaponItem(): GameItem | undefined {
    return this.inventory.find((i) => i.id === this.equippedWeaponId);
  }

  private getRelicItem(): GameItem | undefined {
    return this.equippedRelicId ? this.inventory.find((i) => i.id === this.equippedRelicId) : undefined;
  }

  private getTotalAttack(): number {
    return this.baseAttack + (this.getWeaponItem()?.attackBonus ?? 0) + (this.getRelicItem()?.attackBonus ?? 0);
  }

  private getTotalDefense(): number {
    return this.baseDefense + (this.getRelicItem()?.defenseBonus ?? 0);
  }

  private recalcDerivedStats(refill: boolean): void {
    const relic = this.getRelicItem();
    const weapon = this.getWeaponItem();
    this.maxHp = 220 + (this.level - 1) * 35 + (relic?.maxHpBonus ?? 0);
    this.maxMana = 110 + (this.level - 1) * 15 + (weapon?.maxManaBonus ?? 0) + (relic?.maxManaBonus ?? 0);
    if (refill) {
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      this.stamina = this.maxStamina;
    } else {
      this.hp = Math.min(this.hp, this.maxHp);
      this.mana = Math.min(this.mana, this.maxMana);
    }
  }

  private grantXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.level += 1;
      this.nextLevelXp = Math.round(this.nextLevelXp * 1.45);
      this.baseAttack += 6;
      this.baseDefense += 3;
      this.recalcDerivedStats(true);
      soundEngine.playShrineChime();
      this.spawnBurstParticles(this.playerPos.add(new Vector3(0, 1.2, 0)), new Color4(1.0, 0.85, 0.3, 1), 36);
      this.callbacks.onToast(`Naik Level ${this.level}! Kekuatan & Vitalitas meningkat.`, 'gold');
    }
  }

  private update(dt: number): void {
    this.totalTime += dt;

    // Advance 24h Day-Night Cycle gently
    this.timeOfDay = (this.timeOfDay + dt * 0.08 * this.settings.dayNightCycleSpeed) % 24;

    if (!this.isPlaying) {
      // Title screen live cinematic orbit over the open world
      this.titleOrbitAngle += dt * 0.11;
      const camX = Math.sin(this.titleOrbitAngle) * 58;
      const camZ = Math.cos(this.titleOrbitAngle) * 58 - 18;
      const camY = Math.max(getTerrainHeight(camX, camZ) + 12, 21);
      this.camera.position.set(camX, camY, camZ);
      this.camera.setTarget(new Vector3(0, 5.5, 16));
      this.graphics.updateAtmosphere(this.timeOfDay, this.camera.position);
      this.world.updateWorldVisuals(dt, this.totalTime, new Vector3(0, 4, -20));
      return;
    }

    if (this.isPaused) {
      this.graphics.updateAtmosphere(this.timeOfDay, this.camera.position);
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateSolarPillars(dt);
    this.updateCamera(dt);
    this.graphics.updateAtmosphere(this.timeOfDay, this.camera.position);
    this.world.updateWorldVisuals(dt, this.totalTime, this.playerPos);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.04) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private consumeUnifiedInput(): InputState {
    // Merge keyboard + mouse + touch controls cleanly
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;

    let moveX = kx + this.touchInput.moveX;
    let moveY = ky + this.touchInput.moveY;
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchInput.sprint;
    const blockHeld = this.desktopQueued.rightMouseHeld || this.keys.has('KeyF') || this.touchInput.blockHeld;

    const merged: InputState = {
      moveX,
      moveY,
      sprint,
      jumpPressed: this.desktopQueued.jump || this.touchInput.jumpPressed,
      attackPressed: this.desktopQueued.attack || this.touchInput.attackPressed,
      dodgePressed: this.desktopQueued.dodge || this.touchInput.dodgePressed,
      blockHeld,
      lockOnPressed: this.desktopQueued.lockOn || this.touchInput.lockOnPressed,
      interactPressed: this.desktopQueued.interact || this.touchInput.interactPressed,
      skill1Pressed: this.desktopQueued.skill1 || this.touchInput.skill1Pressed,
      skill2Pressed: this.desktopQueued.skill2 || this.touchInput.skill2Pressed,
      skill3Pressed: this.desktopQueued.skill3 || this.touchInput.skill3Pressed,
      lookDeltaX: this.desktopQueued.mouseDeltaX + this.touchInput.lookDeltaX,
      lookDeltaY: this.desktopQueued.mouseDeltaY + this.touchInput.lookDeltaY,
    };

    // Reset single-frame triggers
    this.desktopQueued.jump = false;
    this.desktopQueued.attack = false;
    this.desktopQueued.dodge = false;
    this.desktopQueued.lockOn = false;
    this.desktopQueued.interact = false;
    this.desktopQueued.skill1 = false;
    this.desktopQueued.skill2 = false;
    this.desktopQueued.skill3 = false;
    this.desktopQueued.mouseDeltaX = 0;
    this.desktopQueued.mouseDeltaY = 0;

    this.touchInput.jumpPressed = false;
    this.touchInput.attackPressed = false;
    this.touchInput.dodgePressed = false;
    this.touchInput.lockOnPressed = false;
    this.touchInput.interactPressed = false;
    this.touchInput.skill1Pressed = false;
    this.touchInput.skill2Pressed = false;
    this.touchInput.skill3Pressed = false;
    this.touchInput.lookDeltaX = 0;
    this.touchInput.lookDeltaY = 0;

    return merged;
  }

  private updatePlayer(dt: number): void {
    const input = this.consumeUnifiedInput();

    if (this.isDead) {
      this.playerRig.animate(dt, 0, true, 0, 0, false, 0);
      return;
    }

    // Passive stamina & mana regeneration
    this.mana = Math.min(this.maxMana, this.mana + dt * 5.2);
    if (!input.sprint && this.dodgeTimer <= 0) {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 22);
    }

    // Cooldowns tick
    this.cdArcane = Math.max(0, this.cdArcane - dt);
    this.cdSolar = Math.max(0, this.cdSolar - dt);
    this.cdHeal = Math.max(0, this.cdHeal - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    if (this.comboResetTimer <= 0) this.comboStep = 0;

    // Camera look input
    const sens = 0.0038 * this.settings.cameraSensitivity;
    this.cameraYaw += input.lookDeltaX * sens;
    this.cameraPitch = Math.max(-0.18, Math.min(1.05, this.cameraPitch + input.lookDeltaY * sens));

    // Lock-On toggle
    if (input.lockOnPressed) {
      if (this.lockedEnemyId) {
        this.lockedEnemyId = null;
      } else {
        let best: EnemyEntity | null = null;
        let bestD = 26;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Vector3.Distance(this.playerPos, e.pos);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        this.lockedEnemyId = best ? best.id : null;
      }
    }

    // Validate lock-on target
    const lockedTarget = this.lockedEnemyId
      ? this.enemies.find((e) => e.id === this.lockedEnemyId && !e.dead && Vector3.Distance(this.playerPos, e.pos) < 32)
      : undefined;
    if (!lockedTarget) this.lockedEnemyId = null;

    // Block parry window tracking
    if (input.blockHeld && !this.wasBlocking) {
      this.blockStartTime = this.totalTime;
    }
    this.wasBlocking = input.blockHeld;

    // Interact trigger (NPC / Shrine / Chest)
    if (input.interactPressed) {
      this.handleInteraction();
    }

    // Movement vector relative to camera yaw
    const forward = new Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const wishDir = forward.scale(input.moveY).add(right.scale(input.moveX));
    const wishMag = wishDir.length();
    if (wishMag > 0.01) wishDir.scaleInPlace(1 / wishMag);

    // Dodge roll
    if (input.dodgePressed && this.dodgeTimer <= 0 && this.stamina >= 22) {
      this.stamina -= 22;
      this.dodgeTimer = 0.42;
      this.dodgeDir = wishMag > 0.1 ? wishDir.clone() : new Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
      this.playerYaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
      soundEngine.playSwordSwing(1);
      this.spawnBurstParticles(this.playerPos.add(new Vector3(0, 0.3, 0)), new Color4(0.8, 0.78, 0.72, 0.7), 12);
    }

    // Sword Attack Combo
    if (input.attackPressed && this.attackTimer <= 0.05 && this.dodgeTimer <= 0) {
      this.comboStep = (this.comboStep % 3) + 1;
      this.attackTimer = 0.32;
      this.comboResetTimer = 1.05;
      this.attackHitApplied = false;
      this.playerRig.swordTrail.start();
      soundEngine.playSwordSwing(this.comboStep);

      // Face locked enemy or movement direction on swing
      if (lockedTarget) {
        const toTarget = lockedTarget.pos.subtract(this.playerPos);
        this.playerYaw = Math.atan2(toTarget.x, toTarget.z);
      }
    }

    // Magic Skills
    if (input.skill1Pressed && this.cdArcane <= 0 && this.mana >= 20) {
      this.castArcaneWave(lockedTarget);
    }
    if (input.skill2Pressed && this.cdSolar <= 0 && this.mana >= 38) {
      this.castSolarJudgment();
    }
    if (input.skill3Pressed && this.cdHeal <= 0 && this.mana >= 28) {
      this.castVitalityMend();
    }

    // Execute dodge or standard movement
    let moveSpeed = 0;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      moveSpeed = 14.5;
      this.playerPos.addInPlace(this.dodgeDir.scale(moveSpeed * dt));
    } else {
      const canSprint = input.sprint && this.stamina > 4 && wishMag > 0.25 && !input.blockHeld;
      if (canSprint) {
        this.stamina = Math.max(0, this.stamina - dt * 18);
      }
      const targetSpeed = input.blockHeld ? 3.8 : canSprint ? 11.4 : 6.8;
      moveSpeed = wishMag * targetSpeed;

      if (wishMag > 0.06) {
        this.playerPos.addInPlace(wishDir.scale(moveSpeed * dt));
        const targetYaw = Math.atan2(wishDir.x, wishDir.z);
        let diff = targetYaw - this.playerYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerYaw += diff * Math.min(1, dt * 12);

        if (this.isGrounded) {
          this.footstepTimer -= dt;
          if (this.footstepTimer <= 0) {
            this.footstepTimer = canSprint ? 0.28 : 0.42;
            soundEngine.playFootstep(this.playerPos.y < WATER_LEVEL + 0.3);
          }
        }
      }
    }

    // Attack hit evaluation mid-swing
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      if (!this.attackHitApplied && this.attackTimer < 0.2) {
        this.attackHitApplied = true;
        this.performMeleeHitCheck();
      }
      if (this.attackTimer <= 0.01) {
        this.playerRig.swordTrail.stop();
      }
    }

    // Jump & Gravity + Heightmap Collision
    if (input.jumpPressed && this.isGrounded && this.dodgeTimer <= 0) {
      this.playerVelY = 9.4;
      this.isGrounded = false;
    }

    this.playerVelY -= 24.5 * dt;
    this.playerPos.y += this.playerVelY * dt;

    // Keep within playable island bounds
    const clampBound = WORLD_HALF - 18;
    this.playerPos.x = Math.max(-clampBound, Math.min(clampBound, this.playerPos.x));
    this.playerPos.z = Math.max(-clampBound, Math.min(clampBound, this.playerPos.z));

    // Resolve cylinder obstacles
    for (const obs of this.world.obstacles) {
      const dx = this.playerPos.x - obs.x;
      const dz = this.playerPos.z - obs.z;
      const minD = obs.radius + 0.55;
      const distSq = dx * dx + dz * dz;
      if (distSq < minD * minD && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (minD - dist) / dist;
        this.playerPos.x += dx * push;
        this.playerPos.z += dz * push;
      }
    }

    const groundY = getTerrainHeight(this.playerPos.x, this.playerPos.z);
    if (this.playerPos.y <= groundY) {
      this.playerPos.y = groundY;
      this.playerVelY = 0;
      this.isGrounded = true;
    }

    // Update rig transform & animations
    this.playerRig.root.position.copyFrom(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    const dodgeProg = this.dodgeTimer > 0 ? 1 - this.dodgeTimer / 0.42 : 0;
    this.playerRig.animate(dt, moveSpeed, this.isGrounded, this.attackTimer, this.comboStep, input.blockHeld, dodgeProg);
  }

  private performMeleeHitCheck(): void {
    const reach = this.comboStep === 3 ? 4.2 : 3.5;
    const forward = new Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
    const dmgMult = this.comboStep === 3 ? 1.55 : this.comboStep === 2 ? 1.2 : 1.0;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const toEnemy = enemy.pos.subtract(this.playerPos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > reach + (enemy.kind === 'boss' ? 1.5 : 0.4)) continue;

      const dir = dist > 0.01 ? toEnemy.scale(1 / dist) : forward;
      const dot = Vector3.Dot(forward, dir);
      if (dot > 0.15 || dist < 1.8) {
        const isCrit = this.comboStep === 3 || Math.random() < 0.18;
        const raw = this.getTotalAttack() * dmgMult * (isCrit ? 1.45 : 1.0) * (0.92 + Math.random() * 0.16);
        this.damageEnemy(enemy, Math.round(raw), isCrit ? 'crit' : 'normal', dir.scale(3.2));
      }
    }
  }

  private castArcaneWave(lockedTarget?: EnemyEntity): void {
    this.mana -= 20;
    this.cdArcane = 3.5;
    soundEngine.playMagicCast('arcane');

    let dir = new Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
    if (lockedTarget) {
      dir = lockedTarget.pos.subtract(this.playerPos);
      dir.y = 0;
      dir.normalize();
      this.playerYaw = Math.atan2(dir.x, dir.z);
    }

    const mesh = MeshBuilder.CreateTorus('arcaneWaveMesh', { diameter: 1.8, thickness: 0.24, tessellation: 18 }, this.scene);
    mesh.position.copyFrom(this.playerPos).addInPlace(new Vector3(dir.x * 1.1, 1.35, dir.z * 1.1));
    mesh.rotation.y = this.playerYaw;
    mesh.scaling.z = 0.35;

    const mat = new PBRMaterial('arcaneWaveMat', this.scene);
    mat.emissiveColor = new Color3(0.35, 0.95, 1.8);
    mat.albedoColor = new Color3(0.25, 0.8, 1.0);
    mesh.material = mat;

    const light = new PointLight('arcaneProjLight', mesh.position.clone(), this.scene);
    light.diffuse = new Color3(0.3, 0.85, 1.0);
    light.intensity = 6.5;
    light.range = 14;

    this.projectiles.push({
      mesh,
      light,
      vel: dir.scale(26),
      life: 1.4,
      damage: Math.round(this.getTotalAttack() * 1.9),
    });
  }

  private castSolarJudgment(): void {
    this.mana -= 38;
    this.cdSolar = 8.0;
    soundEngine.playMagicCast('solar');
    this.addShake(0.32);

    const center = this.playerPos.clone();
    const mesh = MeshBuilder.CreateCylinder('solarPillar', { diameter: 8.5, height: 14, tessellation: 24 }, this.scene);
    mesh.position.set(center.x, center.y + 7, center.z);
    const mat = new PBRMaterial('solarPillarMat', this.scene);
    mat.emissiveColor = new Color3(1.8, 1.15, 0.28);
    mat.albedoColor = new Color3(1.0, 0.8, 0.3);
    mat.alpha = 0.45;
    mesh.material = mat;

    const light = new PointLight('solarLight', new Vector3(center.x, center.y + 3, center.z), this.scene);
    light.diffuse = new Color3(1.0, 0.82, 0.32);
    light.intensity = 16;
    light.range = 28;

    this.solarPillars.push({ mesh, light, life: 0.72 });
    this.spawnBurstParticles(center.add(new Vector3(0, 1.0, 0)), new Color4(1.0, 0.82, 0.28, 1), 45);

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (Vector3.Distance(center, enemy.pos) <= 7.2) {
        const pushDir = enemy.pos.subtract(center);
        pushDir.y = 0;
        if (pushDir.length() > 0.01) pushDir.normalize();
        this.damageEnemy(enemy, Math.round(this.getTotalAttack() * 2.55), 'magic', pushDir.scale(5.5));
      }
    }
  }

  private castVitalityMend(): void {
    this.mana -= 28;
    this.cdHeal = 10.0;
    soundEngine.playMagicCast('heal');

    const healAmt = Math.round(this.maxHp * 0.42);
    this.hp = Math.min(this.maxHp, this.hp + healAmt);
    this.stamina = this.maxStamina;
    this.spawnFloatingNumber(this.playerPos.add(new Vector3(0, 2.3, 0)), healAmt, 'heal');
    this.spawnBurstParticles(this.playerPos.add(new Vector3(0, 1.1, 0)), new Color4(0.25, 0.95, 0.58, 1), 32);
  }

  private damageEnemy(
    enemy: EnemyEntity,
    amount: number,
    dmgType: FloatingDamageNumber['type'],
    knockback: Vector3
  ): void {
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlashTimer = 0.14;
    if (enemy.kind !== 'boss') {
      enemy.staggerTimer = 0.25;
      enemy.pos.addInPlace(knockback.scale(0.18));
    }

    soundEngine.playHitImpact(dmgType === 'crit' || dmgType === 'magic');
    this.addShake(dmgType === 'crit' ? 0.18 : 0.09);
    this.spawnFloatingNumber(enemy.pos.add(new Vector3(0, enemy.kind === 'boss' ? 4.2 : 2.1, 0)), amount, dmgType);
    this.spawnBurstParticles(
      enemy.pos.add(new Vector3(0, 1.3, 0)),
      dmgType === 'magic' ? new Color4(0.4, 0.9, 1, 1) : new Color4(1.0, 0.72, 0.25, 1),
      18
    );

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.respawnTimer = enemy.kind === 'boss' ? 999999 : 28;
      enemy.rig.root.setEnabled(false);
      if (this.lockedEnemyId === enemy.id) this.lockedEnemyId = null;

      this.grantXp(enemy.xpReward);
      this.spawnBurstParticles(enemy.pos.add(new Vector3(0, 1.5, 0)), new Color4(0.85, 0.65, 1.0, 1), 40);

      if (enemy.kind === 'boss') {
        this.bossDefeated = true;
        this.questStage = 'victory';
        soundEngine.playShrineChime();
        this.callbacks.onVictory();
      } else {
        this.callbacks.onToast(`${enemy.name} dikalahkan (+${enemy.xpReward} XP)`, 'emerald');
      }
    }
  }

  private damagePlayer(rawAmount: number, attackerPos: Vector3): void {
    if (this.isDead || this.dodgeTimer > 0.1) return; // i-frames during dodge roll

    // Shield block / perfect parry check
    if (this.wasBlocking) {
      const sinceBlock = this.totalTime - this.blockStartTime;
      if (sinceBlock < 0.28) {
        soundEngine.playParry();
        this.spawnFloatingNumber(this.playerPos.add(new Vector3(0, 2.2, 0)), 0, 'parry');
        this.spawnBurstParticles(this.playerPos.add(new Vector3(0, 1.3, 0)), new Color4(0.4, 0.9, 1, 1), 22);
        return;
      }
      const blockedDmg = Math.max(2, Math.round(rawAmount * 0.22));
      this.hp = Math.max(0, this.hp - blockedDmg);
      this.stamina = Math.max(0, this.stamina - 14);
      soundEngine.playHitImpact(false);
      this.spawnFloatingNumber(this.playerPos.add(new Vector3(0, 2.1, 0)), blockedDmg, 'playerHit');
    } else {
      const reduced = Math.max(3, Math.round(rawAmount - this.getTotalDefense() * 0.45));
      this.hp = Math.max(0, this.hp - reduced);
      soundEngine.playHitImpact(true);
      this.addShake(0.25);
      this.spawnFloatingNumber(this.playerPos.add(new Vector3(0, 2.1, 0)), reduced, 'playerHit');
      const away = this.playerPos.subtract(attackerPos);
      away.y = 0;
      if (away.length() > 0.01) {
        away.normalize();
        this.playerPos.addInPlace(away.scale(0.8));
      }
    }

    if (this.hp <= 0) {
      this.isDead = true;
      this.callbacks.onToast('Anda gugur dalam pertempuran...', 'crimson');
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        if (enemy.kind !== 'boss') {
          enemy.respawnTimer -= dt;
          if (enemy.respawnTimer <= 0) {
            enemy.dead = false;
            enemy.hp = enemy.maxHp;
            enemy.pos.copyFrom(enemy.homePos);
            enemy.rig.root.position.copyFrom(enemy.pos);
            enemy.rig.root.setEnabled(true);
          }
        }
        continue;
      }

      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

      const toPlayer = this.playerPos.subtract(enemy.pos);
      const flatDist = Math.hypot(toPlayer.x, toPlayer.z);
      const fromHome = Vector3.Distance(enemy.pos, enemy.homePos);

      let isMoving = false;
      let windupNorm = 0;

      if (enemy.windupTimer > 0) {
        enemy.windupTimer -= dt;
        windupNorm = 1 - Math.max(0, enemy.windupTimer / enemy.windupDuration);
        if (enemy.rig.telegraphRing && enemy.isAoeSlam) {
          enemy.rig.telegraphRing.setEnabled(true);
          enemy.rig.telegraphRing.scaling.setAll(0.4 + windupNorm * 0.7);
        }

        if (enemy.windupTimer <= 0) {
          if (enemy.rig.telegraphRing) enemy.rig.telegraphRing.setEnabled(false);
          if (enemy.isAoeSlam) {
            soundEngine.playBossSlam();
            this.addShake(0.4);
            this.spawnBurstParticles(enemy.pos.add(new Vector3(0, 0.5, 0)), new Color4(1.0, 0.45, 0.12, 1), 40);
            if (flatDist < 7.8) {
              this.damagePlayer(enemy.attack * 1.45, enemy.pos);
            }
          } else if (flatDist <= enemy.attackRange + 1.1) {
            // Shrine blessing weakens Obsidian Colossus if shrines activated
            const dmgScale = enemy.kind === 'boss' ? Math.max(0.62, 1 - this.activatedShrines.size * 0.12) : 1;
            this.damagePlayer(enemy.attack * dmgScale, enemy.pos);
          }
          enemy.attackCooldown = enemy.kind === 'boss' ? 1.55 : 1.75;
          enemy.isAoeSlam = false;
        }
      } else if (!this.isDead && flatDist < enemy.aggroRange && fromHome < 42 && enemy.staggerTimer <= 0) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        enemy.yaw = targetYaw;

        if (flatDist <= enemy.attackRange) {
          if (enemy.attackCooldown <= 0) {
            enemy.isAoeSlam = enemy.kind === 'boss' && (enemy.hp < enemy.maxHp * 0.65 || Math.random() < 0.35);
            enemy.windupDuration = enemy.isAoeSlam ? 1.2 : enemy.kind === 'boss' ? 0.85 : 0.58;
            enemy.windupTimer = enemy.windupDuration;
          }
        } else {
          isMoving = true;
          const dir = new Vector3(toPlayer.x / flatDist, 0, toPlayer.z / flatDist);
          enemy.pos.addInPlace(dir.scale(enemy.speed * dt));
        }
      } else {
        if (enemy.rig.telegraphRing) enemy.rig.telegraphRing.setEnabled(false);
        // Return gently toward home patrol anchor
        const back = enemy.homePos.subtract(enemy.pos);
        const backDist = Math.hypot(back.x, back.z);
        if (backDist > 1.5) {
          isMoving = true;
          enemy.yaw = Math.atan2(back.x, back.z);
          enemy.pos.addInPlace(new Vector3(back.x / backDist, 0, back.z / backDist).scale(enemy.speed * 0.65 * dt));
        }
      }

      enemy.pos.y = getTerrainHeight(enemy.pos.x, enemy.pos.z);
      enemy.rig.root.position.copyFrom(enemy.pos);
      enemy.rig.root.rotation.y = enemy.yaw;
      enemy.rig.animate(dt, this.totalTime, isMoving, windupNorm, enemy.hitFlashTimer);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addInPlace(p.vel.scale(dt));
      p.light.position.copyFrom(p.mesh.position);
      p.mesh.rotation.z += dt * 10;

      let hit = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Vector3.Distance(p.mesh.position, e.pos.add(new Vector3(0, 1.3, 0)));
        if (d < (e.kind === 'boss' ? 2.8 : 1.7)) {
          this.damageEnemy(e, p.damage, 'magic', p.vel.normalize().scale(4));
          hit = true;
          break;
        }
      }

      if (hit || p.life <= 0) {
        p.mesh.dispose();
        p.light.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateSolarPillars(dt: number): void {
    for (let i = this.solarPillars.length - 1; i >= 0; i--) {
      const s = this.solarPillars[i];
      s.life -= dt;
      const ratio = Math.max(0, s.life / 0.72);
      s.mesh.scaling.x = 1 + (1 - ratio) * 0.35;
      s.mesh.scaling.z = 1 + (1 - ratio) * 0.35;
      (s.mesh.material as PBRMaterial).alpha = ratio * 0.5;
      s.light.intensity = ratio * 16;

      if (s.life <= 0) {
        s.mesh.dispose();
        s.light.dispose();
        this.solarPillars.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number): void {
    // Softly steer camera toward locked enemy
    if (this.lockedEnemyId) {
      const target = this.enemies.find((e) => e.id === this.lockedEnemyId && !e.dead);
      if (target) {
        const toTarget = target.pos.subtract(this.playerPos);
        const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
        let diff = desiredYaw - this.cameraYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.cameraYaw += diff * Math.min(1, dt * 5.5);
      }
    }

    const focus = this.playerPos.add(new Vector3(0, 1.75, 0));
    const horizDist = Math.cos(this.cameraPitch) * this.cameraDist;
    const vertDist = Math.sin(this.cameraPitch) * this.cameraDist;

    let camX = focus.x - Math.sin(this.cameraYaw) * horizDist;
    let camZ = focus.z - Math.cos(this.cameraYaw) * horizDist;
    let camY = focus.y + vertDist;

    // Prevent camera from clipping below terrain
    const groundAtCam = getTerrainHeight(camX, camZ) + 0.9;
    if (camY < groundAtCam) camY = groundAtCam;

    if (this.shakeIntensity > 0.005 && !this.settings.reducedMotion) {
      camX += (Math.random() - 0.5) * this.shakeIntensity;
      camY += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.pow(0.04, dt);
    } else {
      this.shakeIntensity = 0;
    }

    const desiredPos = new Vector3(camX, camY, camZ);
    this.camera.position = Vector3.Lerp(this.camera.position, desiredPos, Math.min(1, dt * 16));
    this.camera.setTarget(focus);

    // Dynamic FOV boost when sprinting or dodging
    const speedBoost = this.dodgeTimer > 0 || (this.keys.has('ShiftLeft') && (this.keys.has('KeyW') || this.touchInput.sprint)) ? 6 : 0;
    const targetFov = ((this.settings.fov + speedBoost) * Math.PI) / 180;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 7);
  }

  private getNearbyInteraction(): InteractionPrompt | null {
    if (Vector3.Distance(this.playerPos, new Vector3(NPC_POSITION.x, this.playerPos.y, NPC_POSITION.z)) < 4.5) {
      return {
        id: 'npc_lyra',
        type: 'npc',
        title: 'Lyra, Penjaga Api',
        actionLabel: 'Bicara',
      };
    }

    for (const s of this.world.shrines) {
      if (!s.activated && Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z) < 5.2) {
        return {
          id: s.id,
          type: 'shrine',
          title: s.name,
          actionLabel: 'Aktifkan Shrine',
        };
      }
    }

    for (const c of this.world.chests) {
      if (!c.opened && Math.hypot(this.playerPos.x - c.x, this.playerPos.z - c.z) < 3.8) {
        return {
          id: c.id,
          type: 'chest',
          title: c.name,
          actionLabel: 'Buka Peti',
        };
      }
    }

    if (Math.hypot(this.playerPos.x - CAMPFIRE_POSITION.x, this.playerPos.z - CAMPFIRE_POSITION.z) < 3.6) {
      return {
        id: 'campfire',
        type: 'campfire',
        title: 'Api Unggun Sanctuary',
        actionLabel: 'Istirahat & Pulih',
      };
    }

    return null;
  }

  private handleInteraction(): void {
    const prompt = this.getNearbyInteraction();
    if (!prompt) return;

    if (prompt.type === 'npc') {
      this.setPaused(true);
      this.callbacks.onOpenNpcDialog();
    } else if (prompt.type === 'campfire') {
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      this.stamina = this.maxStamina;
      soundEngine.playMagicCast('heal');
      this.callbacks.onToast('Vitalitas pulih sepenuhnya di Api Unggun.', 'emerald');
    } else if (prompt.type === 'shrine') {
      const shrine = this.world.shrines.find((s) => s.id === prompt.id);
      if (shrine && !shrine.activated) {
        shrine.activated = true;
        this.activatedShrines.add(shrine.id);
        shrine.crystalMat.emissiveColor = new Color3(1.4, 0.95, 0.25);
        shrine.light.diffuse = new Color3(1.0, 0.8, 0.35);
        shrine.light.intensity = 7.5;
        soundEngine.playShrineChime();
        this.spawnBurstParticles(new Vector3(shrine.x, getTerrainHeight(shrine.x, shrine.z) + 3.2, shrine.z), new Color4(1.0, 0.85, 0.3, 1), 45);
        this.baseAttack += 4;
        this.hp = this.maxHp;
        this.mana = this.maxMana;
        this.grantXp(80);
        if (this.activatedShrines.size >= 3 && !this.bossDefeated) {
          this.questStage = 'defeat_boss';
        } else if (this.questStage === 'talk_lyra') {
          this.questStage = 'activate_shrines';
        }
        this.callbacks.onShrineActivated(shrine.id, this.activatedShrines.size);
      }
    } else if (prompt.type === 'chest') {
      const chest = this.world.chests.find((c) => c.id === prompt.id);
      if (chest && !chest.opened) {
        chest.opened = true;
        this.openedChests.add(chest.id);
        chest.glowMat.emissiveColor = new Color3(0.15, 0.15, 0.15);
        soundEngine.playShrineChime();
        const reward = LOOT_TABLE[chest.id];
        if (reward) {
          const existing = this.inventory.find((i) => i.id === reward.id);
          if (existing && reward.category === 'consumable') {
            existing.quantity += reward.quantity;
          } else if (!existing) {
            this.inventory.push({ ...reward });
          }
          this.callbacks.onChestLooted(reward);
        }
      }
    }
  }

  private addShake(amount: number): void {
    if (!this.settings.reducedMotion) {
      this.shakeIntensity = Math.min(0.65, this.shakeIntensity + amount);
    }
  }

  private spawnFloatingNumber(worldPos: Vector3, value: number, type: FloatingDamageNumber['type']): void {
    const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const projected = Vector3.Project(
      worldPos,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport
    );
    if (projected.z < 0 || projected.z > 1) return;
    const dpr = this.engine.getHardwareScalingLevel();
    this.callbacks.onDamageNumber({
      id: this.dmgIdCounter++,
      x: projected.x * dpr,
      y: projected.y * dpr,
      value,
      type,
    });
  }

  private spawnBurstParticles(pos: Vector3, color: Color4, count: number): void {
    const ps = new ParticleSystem('burstVfx', count, this.scene);
    ps.particleTexture = this.textures.particleGlow;
    ps.emitter = pos.clone();
    ps.minEmitBox = new Vector3(-0.3, -0.2, -0.3);
    ps.maxEmitBox = new Vector3(0.3, 0.4, 0.3);
    ps.color1 = color;
    ps.color2 = new Color4(color.r, color.g, color.b, 0.7);
    ps.colorDead = new Color4(color.r, color.g, color.b, 0);
    ps.minSize = 0.18;
    ps.maxSize = 0.46;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.72;
    ps.manualEmitCount = count;
    ps.minEmitPower = 2.5;
    ps.maxEmitPower = 6.5;
    ps.direction1 = new Vector3(-1, 0.3, -1);
    ps.direction2 = new Vector3(1, 1.5, 1);
    ps.disposeOnStop = true;
    ps.start();
    setTimeout(() => ps.stop(), 180);
  }

  private emitHudSnapshot(): void {
    const bossEntity = this.enemies.find((e) => e.kind === 'boss');
    const bossDist = bossEntity ? Vector3.Distance(this.playerPos, bossEntity.pos) : 999;
    const bossHud: BossHudState = {
      active: Boolean(bossEntity && !bossEntity.dead && bossDist < 36),
      name: 'Obsidian Colossus',
      subtitle:
        this.activatedShrines.size >= 3
          ? 'Pelindung Mentari Terbuka'
          : `Perisai Kuil Aktif (${this.activatedShrines.size}/3 Shrine)`,
      hp: bossEntity ? Math.round(bossEntity.hp) : 0,
      maxHp: bossEntity ? bossEntity.maxHp : 950,
      phase: bossEntity && bossEntity.hp < bossEntity.maxHp * 0.5 ? 2 : 1,
      defeated: this.bossDefeated,
    };

    let lockReticle = { visible: false, x: 0, y: 0, targetName: '', hpPercent: 100 };
    if (this.lockedEnemyId) {
      const target = this.enemies.find((e) => e.id === this.lockedEnemyId && !e.dead);
      if (target) {
        const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
        const proj = Vector3.Project(
          target.pos.add(new Vector3(0, target.kind === 'boss' ? 3.2 : 1.5, 0)),
          Matrix.Identity(),
          this.scene.getTransformMatrix(),
          viewport
        );
        if (proj.z >= 0 && proj.z <= 1) {
          const dpr = this.engine.getHardwareScalingLevel();
          lockReticle = {
            visible: true,
            x: proj.x * dpr,
            y: proj.y * dpr,
            targetName: target.name,
            hpPercent: Math.round((target.hp / target.maxHp) * 100),
          };
        }
      }
    }

    this.callbacks.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      mana: Math.round(this.mana),
      maxMana: this.maxMana,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      level: this.level,
      xp: this.xp,
      nextLevelXp: this.nextLevelXp,
      baseAttack: this.baseAttack,
      baseDefense: this.baseDefense,
      totalAttack: this.getTotalAttack(),
      totalDefense: this.getTotalDefense(),
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      cameraYaw: this.cameraYaw,
      timeOfDay: this.timeOfDay,
      regionName: getRegionName(this.playerPos.x, this.playerPos.z),
      isBlocking: this.wasBlocking,
      isSprinting: this.keys.has('ShiftLeft') || this.touchInput.sprint,
      isLockedOn: Boolean(this.lockedEnemyId),
      comboStep: this.comboStep,
      fps: Math.round(this.engine.getFps()),
      skills: {
        arcaneWave: this.cdArcane,
        arcaneWaveMax: 3.5,
        solarJudgment: this.cdSolar,
        solarJudgmentMax: 8.0,
        vitalityMend: this.cdHeal,
        vitalityMendMax: 10.0,
      },
      boss: bossHud,
      interaction: this.getNearbyInteraction(),
      lockReticle,
      enemyDots: this.enemies
        .filter((e) => !e.dead)
        .map((e) => ({ x: e.pos.x, z: e.pos.z, isBoss: e.kind === 'boss' })),
      activatedShrines: Array.from(this.activatedShrines),
      openedChests: Array.from(this.openedChests),
      bossDefeated: this.bossDefeated,
      questStage: this.questStage,
      isDead: this.isDead,
    });
  }

  public getLandmarksWithState() {
    return LANDMARKS.map((lm) => ({
      ...lm,
      activated:
        lm.type === 'shrine'
          ? this.activatedShrines.has(lm.id)
          : lm.type === 'chest'
            ? this.openedChests.has(lm.id)
            : lm.type === 'boss'
              ? this.bossDefeated
              : true,
    }));
  }

  public dispose(): void {
    this.disposed = true;
    this.graphics.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
