import React from 'react';
import {
  Backpack,
  Compass,
  Flame,
  Hand,
  Heart,
  Map as MapIcon,
  Save,
  Settings,
  Sun,
  Zap,
} from 'lucide-react';
import { FloatingDamageNumber, HudSnapshot } from '../types/game';
import { WORLD_HALF } from '../game/terrainMath';

interface GameHudProps {
  hud: HudSnapshot;
  damageNumbers: FloatingDamageNumber[];
  touchActive: boolean;
  onOpenInventory: () => void;
  onOpenMap: () => void;
  onQuickSave: () => void;
  onOpenSettings: () => void;
  onInteractClick: () => void;
  onRespawn: () => void;
  onSkillClick: (slot: 1 | 2 | 3) => void;
}

function formatClock(hourFloat: number): string {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.floor((hourFloat - Math.floor(hourFloat)) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getQuestText(hud: HudSnapshot): { title: string; detail: string } {
  if (hud.questStage === 'talk_lyra') {
    return {
      title: 'Penjaga Api Sanctuary',
      detail: 'Temui Lyra di dekat api unggun untuk memulai perjalanan.',
    };
  }
  if (hud.questStage === 'activate_shrines') {
    return {
      title: 'Kebangkitan Tiga Kuil',
      detail: `Aktifkan Ancient Sun Shrines (${hud.activatedShrines.length}/3)`,
    };
  }
  if (hud.questStage === 'defeat_boss') {
    return {
      title: 'Benteng Obsidian Utara',
      detail: 'Tantang dan kalahkan Obsidian Colossus di puncak utara.',
    };
  }
  return {
    title: 'Penyelamat Aethelgard',
    detail: 'Dunia kembali damai. Lanjutkan penjelajahan bebas.',
  };
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  damageNumbers,
  touchActive,
  onOpenInventory,
  onOpenMap,
  onQuickSave,
  onOpenSettings,
  onInteractClick,
  onRespawn,
  onSkillClick,
}) => {
  const quest = getQuestText(hud);
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (hud.mana / hud.maxMana) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Top Bar: Status, Quest, Actions */}
      <div
        className="flex items-start justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {/* Left: Player Vital Bars */}
        <div className="pointer-events-auto bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 w-[205px] sm:w-[270px]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-semibold text-amber-300 tracking-wide">
              Lv.{hud.level} Wanderer
            </span>
            <span className="font-mono-num text-[11px] text-slate-300">
              {hud.fps} FPS
            </span>
          </div>

          {/* HP */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-rose-300 font-medium">HP</span>
              <span className="font-mono-num text-slate-200">
                {hud.hp} / {hud.maxHp}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-900/90 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Mana & Stamina */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-sky-300">Mana</span>
                <span className="font-mono-num text-slate-300">{hud.mana}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900/90 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-150"
                  style={{ width: `${mpPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-emerald-300">Stamina</span>
                <span className="font-mono-num text-slate-300">{hud.stamina}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900/90 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-100"
                  style={{ width: `${stamPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center: Region & Quest Tracker (Hidden on very small screens to keep viewport clear) */}
        <div className="hidden md:flex flex-col items-center bg-black/45 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 max-w-sm text-center">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span className="font-medium text-amber-300">{hud.regionName}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono-num">
              <Sun className="w-3 h-3 text-amber-300" />
              {formatClock(hud.timeOfDay)}
            </span>
          </div>
          <p className="text-xs font-semibold text-white mt-0.5">{quest.title}</p>
          <p className="text-[11px] text-slate-300 leading-snug">{quest.detail}</p>
        </div>

        {/* Right: Quick Action Menu Buttons (>= 44x44px hitboxes for touch!) */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenInventory}
            className="min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-black/50 hover:bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            aria-label="Inventaris"
          >
            <Backpack className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Tas</span>
          </button>

          <button
            type="button"
            onClick={onOpenMap}
            className="min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-black/50 hover:bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            aria-label="Peta Dunia"
          >
            <MapIcon className="w-4 h-4 text-sky-300" />
            <span className="hidden sm:inline">Peta</span>
          </button>

          <button
            type="button"
            onClick={onQuickSave}
            className="min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-black/50 hover:bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            aria-label="Simpan Progres"
          >
            <Save className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Simpan</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-black/50 hover:bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            aria-label="Pengaturan"
          >
            <Settings className="w-4 h-4 text-slate-200" />
            <span className="hidden sm:inline">Atur</span>
          </button>
        </div>
      </div>

      {/* Boss Health Bar */}
      {hud.boss.active && !hud.boss.defeated && (
        <div className="mx-auto mt-3 max-w-lg px-4">
          <div className="bg-black/60 backdrop-blur-md border border-amber-500/30 rounded-xl px-4 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-amber-200">
                  {hud.boss.name}
                </h2>
                <p className="text-[11px] text-slate-300">{hud.boss.subtitle}</p>
              </div>
              <span className="font-mono-num text-xs text-rose-300 font-semibold">
                {hud.boss.hp} / {hud.boss.maxHp}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 transition-all duration-150"
                style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3D Projected Lock-On Reticle */}
      {hud.lockReticle.visible && (
        <div
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${hud.lockReticle.x}px`, top: `${hud.lockReticle.y}px` }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-amber-400/90 shadow-lg shadow-amber-500/30 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-amber-300" />
          </div>
          <div className="mt-1 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] text-white whitespace-nowrap">
            {hud.lockReticle.targetName} · {hud.lockReticle.hpPercent}%
          </div>
        </div>
      )}

      {/* Floating Damage Numbers */}
      {damageNumbers.map((d) => {
        const colorCls =
          d.type === 'crit'
            ? 'text-amber-300 text-xl font-bold'
            : d.type === 'magic'
              ? 'text-sky-300 text-lg font-bold'
              : d.type === 'heal'
                ? 'text-emerald-300 text-base font-bold'
                : d.type === 'parry'
                  ? 'text-cyan-200 text-base font-bold'
                  : d.type === 'playerHit'
                    ? 'text-rose-400 text-base font-semibold'
                    : 'text-white text-base font-semibold';
        return (
          <div
            key={d.id}
            className={`fixed pointer-events-none font-mono-num drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] animate-float-damage ${colorCls}`}
            style={{ left: `${d.x}px`, top: `${d.y}px` }}
          >
            {d.type === 'parry'
              ? 'PARRY!'
              : d.type === 'heal'
                ? `+${d.value}`
                : d.type === 'playerHit'
                  ? `-${d.value}`
                  : d.value}
          </div>
        );
      })}

      {/* Desktop-Only Skill Bar & Interact Prompt (Touch mode renders these in TouchControls thumb arc) */}
      {!touchActive && (
        <>
          {hud.interaction && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={onInteractClick}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 transition-colors"
              >
                <Hand className="w-4 h-4" />
                <span>[E] {hud.interaction.actionLabel} — {hud.interaction.title}</span>
              </button>
            </div>
          )}

          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="pointer-events-auto flex items-center gap-2 bg-black/55 backdrop-blur-md border border-white/10 rounded-2xl p-2">
              <button
                type="button"
                onClick={() => onSkillClick(1)}
                className="relative px-3 py-2 rounded-xl bg-sky-950/70 hover:bg-sky-900/80 border border-sky-400/30 text-left min-w-[110px]"
              >
                <div className="flex items-center justify-between text-xs text-sky-200 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Arcane
                  </span>
                  <span className="font-mono-num text-[10px] text-sky-300">[1]</span>
                </div>
                <div className="font-mono-num text-[10px] text-slate-300 mt-0.5">
                  {hud.skills.arcaneWave > 0.05 ? `${hud.skills.arcaneWave.toFixed(1)}s` : '20 MP'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSkillClick(2)}
                className="relative px-3 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-400/30 text-left min-w-[110px]"
              >
                <div className="flex items-center justify-between text-xs text-amber-200 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Solar
                  </span>
                  <span className="font-mono-num text-[10px] text-amber-300">[2]</span>
                </div>
                <div className="font-mono-num text-[10px] text-slate-300 mt-0.5">
                  {hud.skills.solarJudgment > 0.05 ? `${hud.skills.solarJudgment.toFixed(1)}s` : '38 MP'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSkillClick(3)}
                className="relative px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-400/30 text-left min-w-[110px]"
              >
                <div className="flex items-center justify-between text-xs text-emerald-200 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" /> Pulih
                  </span>
                  <span className="font-mono-num text-[10px] text-emerald-300">[3]</span>
                </div>
                <div className="font-mono-num text-[10px] text-slate-300 mt-0.5">
                  {hud.skills.vitalityMend > 0.05 ? `${hud.skills.vitalityMend.toFixed(1)}s` : '28 MP'}
                </div>
              </button>
            </div>

            <p className="text-[11px] text-slate-300/85 bg-black/40 px-3 py-1 rounded-lg border border-white/5 whitespace-nowrap">
              WASD Gerak · Shift Lari · Klik Kiri Serang · Klik Kanan Perisai · C Dodge · Q Kunci Target · E Interaksi
            </p>
          </div>
        </>
      )}

      {/* Compact Minimap Radar (Top-left below vital bars on touchscreens, bottom-right on desktop) */}
      <div
        className={`fixed ${
          touchActive ? 'top-[132px] left-3 hidden sm:block' : 'bottom-5 right-5'
        } pointer-events-auto`}
      >
        <button
          type="button"
          onClick={onOpenMap}
          className="relative w-28 h-28 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/15 overflow-hidden shadow-lg"
          aria-label="Buka Peta Dunia"
        >
          <div className="absolute inset-2 rounded-full border border-white/10" />
          <Compass className="w-3.5 h-3.5 text-amber-300/70 absolute top-1.5 left-1/2 -translate-x-1/2" />
          {/* Boss Marker */}
          <div
            className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${
              hud.bossDefeated ? 'bg-slate-500' : 'bg-rose-500'
            }`}
            style={{
              left: `${50 + (0 / WORLD_HALF) * 44}%`,
              top: `${50 - (126 / WORLD_HALF) * 44}%`,
            }}
          />
          {/* Enemy dots */}
          {hud.enemyDots.map((dot, idx) => (
            <div
              key={idx}
              className="absolute w-1.5 h-1.5 rounded-full bg-rose-400/80 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${50 + (dot.x / WORLD_HALF) * 44}%`,
                top: `${50 - (dot.z / WORLD_HALF) * 44}%`,
              }}
            />
          ))}
          {/* Player dot */}
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-amber-300 border border-slate-950 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${50 + (hud.playerX / WORLD_HALF) * 44}%`,
              top: `${50 - (hud.playerZ / WORLD_HALF) * 44}%`,
            }}
          />
        </button>
      </div>

      {/* Defeat Overlay */}
      {hud.isDead && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-sm w-full bg-slate-950/90 border border-rose-500/30 rounded-2xl p-6 text-center">
            <h2 className="font-display text-2xl font-bold text-rose-300">Anda Gugur</h2>
            <p className="text-sm text-slate-300 mt-2">
              Api Sanctuary akan memulihkan kekuatan Anda untuk melanjutkan petualangan.
            </p>
            <button
              type="button"
              onClick={onRespawn}
              className="mt-5 w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              Bangkit di Sanctuary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
