import React from 'react';
import { Compass, MapPin, Skull, Sparkles, X } from 'lucide-react';
import { WORLD_HALF } from '../game/terrainMath';
import { HudSnapshot, WorldLandmark } from '../types/game';

interface MapModalProps {
  hud: HudSnapshot;
  landmarks: (WorldLandmark & { activated: boolean })[];
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = ({ hud, landmarks, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-xl bg-slate-950/95 border border-white/15 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">Peta Lembah Aethelgard</h2>
            <p className="text-xs text-slate-400 font-mono-num">
              Posisi: ({Math.round(hud.playerX)}, {Math.round(hud.playerZ)}) · {hud.regionName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label="Tutup Peta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Radar Map Canvas */}
        <div className="relative aspect-square w-full max-w-[380px] mx-auto my-4 rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950/35 to-sky-950/45 border border-white/10 overflow-hidden">
          {/* Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_68%,rgba(14,116,144,0.28),transparent_36%)]" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono-num text-slate-400 flex items-center gap-1">
            <Compass className="w-3 h-3 text-amber-300" /> UTARA
          </div>

          {landmarks.map((lm) => {
            const left = `${50 + (lm.x / WORLD_HALF) * 44}%`;
            const top = `${50 - (lm.z / WORLD_HALF) * 44}%`;
            return (
              <div
                key={lm.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left, top }}
                title={lm.name}
              >
                {lm.type === 'boss' ? (
                  <Skull className={`w-5 h-5 ${lm.activated ? 'text-slate-500' : 'text-rose-400'}`} />
                ) : lm.type === 'shrine' ? (
                  <Sparkles className={`w-4 h-4 ${lm.activated ? 'text-amber-300' : 'text-sky-300'}`} />
                ) : lm.type === 'chest' ? (
                  <div
                    className={`w-2.5 h-2.5 rotate-45 border ${
                      lm.activated ? 'bg-slate-600 border-slate-500' : 'bg-amber-400 border-amber-200'
                    }`}
                  />
                ) : (
                  <MapPin className="w-4 h-4 text-emerald-300" />
                )}
                <span className="mt-0.5 text-[9px] text-slate-200/85 whitespace-nowrap bg-black/55 px-1 rounded">
                  {lm.name.split(' ')[0]}
                </span>
              </div>
            );
          })}

          {/* Player Marker */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-lg"
            style={{
              left: `${50 + (hud.playerX / WORLD_HALF) * 44}%`,
              top: `${50 - (hud.playerZ / WORLD_HALF) * 44}%`,
            }}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Posisi Anda
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" /> Sun Shrine ({hud.activatedShrines.length}/3)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Skull className="w-3.5 h-3.5 text-rose-400" /> Boss Citadel
          </span>
        </div>
      </div>
    </div>
  );
};
