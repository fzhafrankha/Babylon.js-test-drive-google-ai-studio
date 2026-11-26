import React from 'react';
import { FolderOpen, Play, RotateCcw, Settings, Trash2 } from 'lucide-react';
import { SaveSlotData } from '../types/game';

interface TitleScreenProps {
  saveSlots: (SaveSlotData | null)[];
  mostRecentSave: SaveSlotData | null;
  onNewGame: () => void;
  onContinue: (save: SaveSlotData) => void;
  onDeleteSave: (slotIndex: number) => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saveSlots,
  mostRecentSave,
  onNewGame,
  onContinue,
  onDeleteSave,
  onOpenSettings,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent p-6 sm:p-12 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-sm sm:text-base tracking-widest text-amber-300/90 whitespace-nowrap">
          Aethelgard
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-[44px] px-4 rounded-xl bg-black/55 hover:bg-slate-900/80 backdrop-blur-md border border-white/15 text-slate-100 text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <Settings className="w-4 h-4 text-amber-300" />
          <span>Pengaturan Grafis & Sentuh</span>
        </button>
      </div>

      <div className="my-auto max-w-xl py-8">
        <p className="text-xs sm:text-sm text-amber-300/90 font-medium mb-2">
          Open-World Action RPG 3D · Desktop &amp; Layar Sentuh
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-bold text-white leading-tight [text-wrap:balance]">
          Chronicles of the Shattered Sun
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-lg">
          Jelajahi lembah terbuka dengan pencahayaan PBR, air reflektif real-time, siklus siang-malam
          dinamis, serta pertarungan pedang dan sihir melawan penjaga reruntuhan kuno.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {mostRecentSave && (
            <button
              type="button"
              onClick={() => onContinue(mostRecentSave)}
              className="min-h-[48px] px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 shadow-xl shadow-amber-500/25 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Lanjutkan (Lv.{mostRecentSave.level})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewGame}
            className={`min-h-[48px] px-6 rounded-xl font-semibold text-sm inline-flex items-center gap-2 transition-colors ${
              mostRecentSave
                ? 'bg-black/60 hover:bg-slate-900/85 border border-white/20 text-white backdrop-blur-md'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xl shadow-amber-500/25'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Mulai Petualangan Baru</span>
          </button>
        </div>

        {/* Save Slots */}
        {saveSlots.some(Boolean) && (
          <div className="mt-8 bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Slot Penyimpanan</span>
            </h2>
            <div className="space-y-2">
              {saveSlots.map((slot, idx) =>
                slot ? (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => onContinue(slot)}
                      className="text-left flex-1 min-h-[40px]"
                    >
                      <div className="text-xs sm:text-sm font-semibold text-white">
                        Slot {idx + 1} — Lv.{slot.level} · {slot.regionName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-num">
                        Shrine {slot.activatedShrines.length}/3 · {new Date(slot.savedAt).toLocaleString('id-ID')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSave(idx)}
                      className="min-w-[44px] min-h-[44px] rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
                      aria-label={`Hapus Slot ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-300/80 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Desktop: WASD + Mouse + 1/2/3 Sihir</span>
        <span aria-hidden="true">·</span>
        <span>Layar Sentuh: Joystick Kiri + Geser Kamera Kanan + Tombol Aksi</span>
      </div>
    </div>
  );
};
