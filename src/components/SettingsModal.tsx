import React from 'react';
import { Monitor, Sliders, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { GraphicsPreset, GraphicsSettings, TouchControlsMode } from '../types/game';

interface SettingsModalProps {
  settings: GraphicsSettings;
  onChange: (next: GraphicsSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onChange, onClose }) => {
  const applyPreset = (preset: GraphicsPreset) => {
    if (preset === 'ultra') {
      onChange({
        ...settings,
        preset,
        shadowsEnabled: true,
        bloomEnabled: true,
        godRaysEnabled: true,
        waterReflections: true,
      });
    } else if (preset === 'high') {
      onChange({
        ...settings,
        preset,
        shadowsEnabled: true,
        bloomEnabled: true,
        godRaysEnabled: true,
        waterReflections: true,
      });
    } else {
      onChange({
        ...settings,
        preset,
        shadowsEnabled: true,
        bloomEnabled: true,
        godRaysEnabled: false,
        waterReflections: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border border-white/15 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-300" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Pengaturan Grafis &amp; Kontrol
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label="Tutup Pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 mt-5">
          {/* Touchscreen Controls Mode */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Smartphone className="w-4 h-4 text-amber-300" />
              <span>Tombol Kontrol Layar Sentuh</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'auto', label: 'Otomatis' },
                  { id: 'always', label: 'Selalu Tampilkan' },
                  { id: 'off', label: 'Nonaktif' },
                ] as { id: TouchControlsMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...settings, touchControlsMode: opt.id })}
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                    settings.touchControlsMode === opt.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Pilih &quot;Selalu Tampilkan&quot; untuk menguji joystick dan tombol sentuh di layar mana saja.
            </p>
          </div>

          {/* Graphics Preset */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Monitor className="w-4 h-4 text-sky-300" />
              <span>Preset Kualitas Grafis Babylon.js</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'ultra', label: 'Ultra' },
                  { id: 'high', label: 'Tinggi' },
                  { id: 'balanced', label: 'Seimbang' },
                ] as { id: GraphicsPreset; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                    settings.preset === p.id
                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                      : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Effect Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                { key: 'shadowsEnabled', label: 'Bayangan Kaskade (CSM)' },
                { key: 'bloomEnabled', label: 'HDR Bloom Sihir' },
                { key: 'godRaysEnabled', label: 'Volumetric God Rays' },
                { key: 'waterReflections', label: 'Refleksi Air Real-Time' },
                { key: 'reducedMotion', label: 'Kurangi Guncangan Kamera' },
              ] as { key: keyof GraphicsSettings; label: string }[]
            ).map((item) => {
              const checked = Boolean(settings[item.key]);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange({ ...settings, [item.key]: !checked })}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-medium hover:bg-white/10"
                >
                  <span>{item.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      checked ? 'bg-emerald-500/25 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {checked ? 'Aktif' : 'Mati'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sliders */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Sudut Pandang (FOV)</span>
                <span className="font-mono-num text-amber-300">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min={50}
                max={82}
                value={settings.fov}
                onChange={(e) => onChange({ ...settings, fov: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Sensitivitas Kamera</span>
                <span className="font-mono-num text-amber-300">{settings.cameraSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.2}
                step={0.1}
                value={settings.cameraSensitivity}
                onChange={(e) => onChange({ ...settings, cameraSensitivity: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Kecepatan Siklus Siang-Malam</span>
                <span className="font-mono-num text-amber-300">{settings.dayNightCycleSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.5}
                value={settings.dayNightCycleSpeed}
                onChange={(e) => onChange({ ...settings, dayNightCycleSpeed: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onChange({ ...settings, audioMuted: !settings.audioMuted })}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-200"
                aria-label="Bisukan Audio"
              >
                {settings.audioMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
              </button>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Volume Audio</span>
                  <span className="font-mono-num text-amber-300">{Math.round(settings.audioVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.audioVolume}
                  onChange={(e) => onChange({ ...settings, audioVolume: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
        >
          Simpan &amp; Tutup
        </button>
      </div>
    </div>
  );
};
