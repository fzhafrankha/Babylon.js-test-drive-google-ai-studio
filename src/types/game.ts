export type GraphicsPreset = 'ultra' | 'high' | 'balanced';
export type TouchControlsMode = 'auto' | 'always' | 'off';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  shadowsEnabled: boolean;
  bloomEnabled: boolean;
  godRaysEnabled: boolean;
  waterReflections: boolean;
  fov: number;
  cameraSensitivity: number;
  dayNightCycleSpeed: number;
  reducedMotion: boolean;
  audioVolume: number;
  audioMuted: boolean;
  touchControlsMode: TouchControlsMode;
}

export type ItemCategory = 'weapon' | 'relic' | 'consumable';

export interface GameItem {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  attackBonus?: number;
  defenseBonus?: number;
  maxHpBonus?: number;
  maxManaBonus?: number;
  healHp?: number;
  healMana?: number;
  quantity: number;
}

export interface SkillCooldownState {
  arcaneWave: number;
  arcaneWaveMax: number;
  solarJudgment: number;
  solarJudgmentMax: number;
  vitalityMend: number;
  vitalityMendMax: number;
}

export interface FloatingDamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
  type: 'normal' | 'crit' | 'magic' | 'heal' | 'playerHit' | 'parry';
}

export interface ScreenLockReticle {
  visible: boolean;
  x: number;
  y: number;
  targetName: string;
  hpPercent: number;
}

export interface InteractionPrompt {
  id: string;
  type: 'npc' | 'shrine' | 'chest' | 'campfire';
  title: string;
  actionLabel: string;
}

export interface EnemyMinimapDot {
  x: number;
  z: number;
  isBoss: boolean;
}

export interface WorldLandmark {
  id: string;
  name: string;
  type: 'sanctuary' | 'shrine' | 'chest' | 'boss';
  x: number;
  z: number;
  activated?: boolean;
}

export interface BossHudState {
  active: boolean;
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  defeated: boolean;
}

export interface QuestObjective {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  progressText: string;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  baseAttack: number;
  baseDefense: number;
  totalAttack: number;
  totalDefense: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  cameraYaw: number;
  timeOfDay: number;
  regionName: string;
  isBlocking: boolean;
  isSprinting: boolean;
  isLockedOn: boolean;
  comboStep: number;
  fps: number;
  skills: SkillCooldownState;
  boss: BossHudState;
  interaction: InteractionPrompt | null;
  lockReticle: ScreenLockReticle;
  enemyDots: EnemyMinimapDot[];
  activatedShrines: string[];
  openedChests: string[];
  bossDefeated: boolean;
  questStage: 'talk_lyra' | 'activate_shrines' | 'defeat_boss' | 'victory';
  isDead: boolean;
}

export interface SaveSlotData {
  slotIndex: number;
  savedAt: string;
  level: number;
  regionName: string;
  activatedShrines: string[];
  openedChests: string[];
  bossDefeated: boolean;
  questStage: HudSnapshot['questStage'];
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  xp: number;
  nextLevelXp: number;
  baseAttack: number;
  baseDefense: number;
  playerX: number;
  playerZ: number;
  timeOfDay: number;
  equippedWeaponId: string;
  equippedRelicId: string | null;
  inventory: GameItem[];
}

export interface DialogContent {
  speaker: string;
  role: string;
  lines: string[];
  actionButtonLabel?: string;
  onAction?: () => void;
}

export interface InputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  jumpPressed: boolean;
  attackPressed: boolean;
  dodgePressed: boolean;
  blockHeld: boolean;
  lockOnPressed: boolean;
  interactPressed: boolean;
  skill1Pressed: boolean;
  skill2Pressed: boolean;
  skill3Pressed: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: 'ultra',
  shadowsEnabled: true,
  bloomEnabled: true,
  godRaysEnabled: true,
  waterReflections: true,
  fov: 62,
  cameraSensitivity: 1.0,
  dayNightCycleSpeed: 1.0,
  reducedMotion: false,
  audioVolume: 0.7,
  audioMuted: false,
  touchControlsMode: 'auto',
};

export const INITIAL_ITEMS: GameItem[] = [
  {
    id: 'blade_wanderer',
    name: 'Pedang Pengembara',
    category: 'weapon',
    description: 'Bilah baja tempaan seimbang milik para penjaga perbatasan Aethelgard.',
    attackBonus: 14,
    quantity: 1,
  },
  {
    id: 'elixir_vitality',
    name: 'Ramuan Kehidupan',
    category: 'consumable',
    description: 'Memulihkan 120 HP dan 40 Mana secara seketika di tengah pertempuran.',
    healHp: 120,
    healMana: 40,
    quantity: 3,
  },
];

export const LOOT_TABLE: Record<string, GameItem> = {
  chest_1: {
    id: 'blade_sunforged',
    name: 'Pedang Tempaan Mentari',
    category: 'weapon',
    description: 'Senjata kuno berukir rune emas yang memancarkan panas matahari.',
    attackBonus: 26,
    quantity: 1,
  },
  chest_2: {
    id: 'relic_dawncrest',
    name: 'Jimat Dawncrest',
    category: 'relic',
    description: 'Meningkatkan pertahanan fisik sebesar 10 dan kapasitas HP maksimal sebesar 50.',
    defenseBonus: 10,
    maxHpBonus: 50,
    quantity: 1,
  },
  chest_3: {
    id: 'blade_aether',
    name: 'Pedang Besar Aether',
    category: 'weapon',
    description: 'Bilah kristal biru yang mengalirkan energi astral pada setiap tebasan.',
    attackBonus: 38,
    maxManaBonus: 35,
    quantity: 1,
  },
  chest_4: {
    id: 'relic_heartstone',
    name: 'Batu Jantung Runik',
    category: 'relic',
    description: 'Relik bertuah dari reruntuhan selatan yang memperkuat serangan dan daya tahan.',
    attackBonus: 8,
    defenseBonus: 14,
    maxHpBonus: 80,
    quantity: 1,
  },
  chest_5: {
    id: 'elixir_vitality',
    name: 'Ramuan Kehidupan',
    category: 'consumable',
    description: 'Memulihkan 120 HP dan 40 Mana secara seketika di tengah pertempuran.',
    healHp: 120,
    healMana: 40,
    quantity: 3,
  },
};
