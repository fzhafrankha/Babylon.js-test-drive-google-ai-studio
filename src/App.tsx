import { useCallback, useEffect, useRef, useState } from 'react';
import { DialogModal } from './components/DialogModal';
import { GameHud } from './components/GameHud';
import { InventoryModal } from './components/InventoryModal';
import { MapModal } from './components/MapModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { AethelgardEngine } from './game/gameEngine';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  DialogContent,
  FloatingDamageNumber,
  GraphicsSettings,
  HudSnapshot,
  SaveSlotData,
} from './types/game';
import {
  deleteSaveSlot,
  getMostRecentSave,
  loadAllSaveSlots,
  saveToSlot,
} from './utils/saveSystem';

interface ToastItem {
  id: number;
  text: string;
  tone: 'gold' | 'cyan' | 'emerald' | 'crimson';
}

const INITIAL_HUD: HudSnapshot = {
  hp: 240,
  maxHp: 240,
  mana: 120,
  maxMana: 120,
  stamina: 100,
  maxStamina: 100,
  level: 1,
  xp: 0,
  nextLevelXp: 100,
  baseAttack: 22,
  baseDefense: 8,
  totalAttack: 36,
  totalDefense: 8,
  playerX: 0,
  playerZ: -20,
  playerYaw: 0,
  cameraYaw: 0,
  timeOfDay: 16.5,
  regionName: 'Perkemahan Sanctuary',
  isBlocking: false,
  isSprinting: false,
  isLockedOn: false,
  comboStep: 0,
  fps: 60,
  skills: {
    arcaneWave: 0,
    arcaneWaveMax: 3.5,
    solarJudgment: 0,
    solarJudgmentMax: 8.0,
    vitalityMend: 0,
    vitalityMendMax: 10.0,
  },
  boss: {
    active: false,
    name: 'Obsidian Colossus',
    subtitle: '',
    hp: 950,
    maxHp: 950,
    phase: 1,
    defeated: false,
  },
  interaction: null,
  lockReticle: { visible: false, x: 0, y: 0, targetName: '', hpPercent: 100 },
  enemyDots: [],
  activatedShrines: [],
  openedChests: [],
  bossDefeated: false,
  questStage: 'talk_lyra',
  isDead: false,
};

function detectTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AethelgardEngine | null>(null);

  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<GraphicsSettings>(DEFAULT_GRAPHICS_SETTINGS);
  const [saveSlots, setSaveSlots] = useState<(SaveSlotData | null)[]>(() => loadAllSaveSlots());

  const [hasTouchDevice, setHasTouchDevice] = useState<boolean>(() => detectTouchCapable());
  const [webglLost, setWebglLost] = useState(false);
  const [webglUnsupported, setWebglUnsupported] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogContent | null>(null);

  const [damageNumbers, setDamageNumbers] = useState<FloatingDamageNumber[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'gold') => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  // Automatically reveal touchscreen buttons if user taps via touch on hybrid laptops
  useEffect(() => {
    const onFirstTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setHasTouchDevice(true);
      }
    };
    window.addEventListener('pointerdown', onFirstTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onFirstTouch);
  }, []);

  // Pause 3D simulation loop when modals are open
  useEffect(() => {
    const anyModal = showSettings || showInventory || showMap || activeDialog !== null;
    engineRef.current?.setPaused(anyModal);
  }, [showSettings, showInventory, showMap, activeDialog]);

  // Keyboard shortcuts for Inventory (Tab/I), Map (M), Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === 'Tab' || e.code === 'KeyI') {
        e.preventDefault();
        setShowInventory((v) => !v);
        setShowMap(false);
        setShowSettings(false);
      } else if (e.code === 'KeyM') {
        setShowMap((v) => !v);
        setShowInventory(false);
        setShowSettings(false);
      } else if (e.code === 'Escape') {
        setShowInventory(false);
        setShowMap(false);
        setShowSettings(false);
        setActiveDialog(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  // Mount Babylon.js Engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      setWebglUnsupported(true);
      return;
    }

    const engine = new AethelgardEngine(
      canvas,
      {
        onHudUpdate: (snap) => setHud(snap),
        onDamageNumber: (dmg) => {
          setDamageNumbers((prev) => [...prev.slice(-14), dmg]);
          setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((d) => d.id !== dmg.id));
          }, 950);
        },
        onToast: (msg, tone) => pushToast(msg, tone),
        onOpenNpcDialog: () => {
          const snap = engineRef.current;
          setActiveDialog({
            speaker: 'Lyra, Penjaga Api',
            role: 'Penjaga Sanctuary Aethelgard',
            lines: [
              'Selamat datang kembali di Sanctuary, Pengembara. Matahari Aethelgard telah retak oleh kebangkitan Obsidian Colossus di benteng utara.',
              'Temukan dan aktifkan tiga Ancient Sun Shrines di Timur, Barat, dan Danau Selatan untuk melemahkan perisai raksasa itu serta menambah kekuatanmu.',
              'Beristirahatlah di api unggun kapan pun kamu terluka. Semoga cahaya mentari menyertaimu.',
            ],
            actionButtonLabel: 'Terima Berkah & Pulih',
            onAction: () => {
              snap?.markLyraSpoken();
              setActiveDialog(null);
            },
          });
        },
        onShrineActivated: (_shrineId, total) => {
          pushToast(`Sun Shrine diaktifkan (${total}/3)! Serangan +4 & Vitalitas Pulih.`, 'gold');
          if (engineRef.current) {
            saveToSlot(0, engineRef.current.exportSaveData(0));
            setSaveSlots(loadAllSaveSlots());
          }
        },
        onChestLooted: (item) => {
          pushToast(`Menemukan ${item.name}!`, 'cyan');
        },
        onVictory: () => {
          setActiveDialog({
            speaker: 'Obsidian Colossus Ditaklukkan',
            role: 'Kemenangan Aethelgard',
            lines: [
              'Raksasa obsidian hancur menjadi debu bintang. Sinar matahari kembali menyinari lembah, danau, serta kuil kuno Aethelgard.',
              'Kamu telah menyelesaikan tantangan utama! Kamu dapat terus menjelajahi lembah atau memulai petualangan baru.',
            ],
          });
          if (engineRef.current) {
            saveToSlot(0, engineRef.current.exportSaveData(0));
            setSaveSlots(loadAllSaveSlots());
          }
        },
        onContextLost: (lost) => setWebglLost(lost),
      },
      settings
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = (next: GraphicsSettings) => {
    setSettings(next);
    engineRef.current?.applySettings(next);
  };

  const handleNewGame = () => {
    engineRef.current?.startNewGame();
    setStarted(true);
    pushToast('Petualangan dimulai. Temui Lyra di dekat api unggun!', 'gold');
  };

  const handleContinue = (save: SaveSlotData) => {
    engineRef.current?.loadFromSave(save);
    setStarted(true);
    pushToast(`Memuat Slot ${save.slotIndex + 1} · Lv.${save.level}`, 'emerald');
  };

  const handleSaveSlot = (slotIndex: number) => {
    if (!engineRef.current) return;
    const data = engineRef.current.exportSaveData(slotIndex);
    if (saveToSlot(slotIndex, data)) {
      setSaveSlots(loadAllSaveSlots());
      pushToast(`Progres disimpan ke Slot ${slotIndex + 1}.`, 'emerald');
    }
  };

  const handleDeleteSave = (slotIndex: number) => {
    deleteSaveSlot(slotIndex);
    setSaveSlots(loadAllSaveSlots());
  };

  const touchControlsVisible =
    started &&
    !showSettings &&
    !showInventory &&
    !showMap &&
    !activeDialog &&
    !hud.isDead &&
    (settings.touchControlsMode === 'always' ||
      (settings.touchControlsMode === 'auto' && hasTouchDevice));

  if (webglUnsupported) {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-slate-900 border border-white/10 rounded-2xl p-6">
          <h1 className="font-display text-2xl font-bold text-amber-300">WebGL Tidak Tersedia</h1>
          <p className="text-sm text-slate-300 mt-2">
            Peramban atau perangkat ini tidak mengaktifkan akselerasi grafis WebGL yang dibutuhkan oleh
            mesin 3D Babylon.js.
          </p>
        </div>
      </div>
    );
  }

  const invState = engineRef.current?.getInventoryState() ?? {
    items: [],
    equippedWeaponId: 'blade_wanderer',
    equippedRelicId: null,
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-950 touch-surface">
      <canvas
        ref={canvasRef}
        className="w-full h-full block outline-none touch-surface"
        aria-label="Dunia 3D Aethelgard"
      />

      {webglLost && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm bg-slate-900 border border-white/15 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold text-amber-300">Memulihkan Grafis 3D</h2>
            <p className="text-xs text-slate-300 mt-2">
              Konteks WebGL terhenti sementara dan sedang dimuat ulang secara otomatis.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-medium text-white shadow-xl"
          >
            {t.text}
          </div>
        ))}
      </div>

      {!started && (
        <TitleScreen
          saveSlots={saveSlots}
          mostRecentSave={getMostRecentSave()}
          onNewGame={handleNewGame}
          onContinue={handleContinue}
          onDeleteSave={handleDeleteSave}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {started && (
        <>
          <GameHud
            hud={hud}
            damageNumbers={damageNumbers}
            touchActive={touchControlsVisible}
            onOpenInventory={() => setShowInventory(true)}
            onOpenMap={() => setShowMap(true)}
            onQuickSave={() => handleSaveSlot(0)}
            onOpenSettings={() => setShowSettings(true)}
            onInteractClick={() => engineRef.current?.triggerAction('interact')}
            onRespawn={() => engineRef.current?.respawnAtSanctuary()}
            onSkillClick={(slot) =>
              engineRef.current?.triggerAction(
                slot === 1 ? 'skill1' : slot === 2 ? 'skill2' : 'skill3'
              )
            }
          />

          <TouchControls
            visible={touchControlsVisible}
            isBlocking={hud.isBlocking}
            isLockedOn={hud.isLockedOn}
            mana={hud.mana}
            stamina={hud.stamina}
            skills={hud.skills}
            interaction={hud.interaction}
            onMove={(x, y, sprint) => engineRef.current?.setTouchMove(x, y, sprint)}
            onLookDelta={(dx, dy) => engineRef.current?.addTouchLookDelta(dx, dy)}
            onBlockChange={(held) => engineRef.current?.setTouchBlock(held)}
            onAction={(act) => engineRef.current?.triggerAction(act)}
          />
        </>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showInventory && started && (
        <InventoryModal
          hud={hud}
          items={invState.items}
          equippedWeaponId={invState.equippedWeaponId}
          equippedRelicId={invState.equippedRelicId}
          onUseOrEquip={(id) => {
            engineRef.current?.equipOrUseItem(id);
            // Force HUD refresh on inventory change
            setHud((h) => ({ ...h }));
          }}
          onSaveToSlot={handleSaveSlot}
          onClose={() => setShowInventory(false)}
        />
      )}

      {showMap && started && engineRef.current && (
        <MapModal
          hud={hud}
          landmarks={engineRef.current.getLandmarksWithState()}
          onClose={() => setShowMap(false)}
        />
      )}

      {activeDialog && (
        <DialogModal
          dialog={activeDialog}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </div>
  );
}
