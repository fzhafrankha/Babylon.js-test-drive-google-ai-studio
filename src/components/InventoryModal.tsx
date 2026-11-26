import React from 'react';
import { Backpack, Check, Shield, Sparkles, Sword, X } from 'lucide-react';
import { GameItem, HudSnapshot } from '../types/game';

interface InventoryModalProps {
  hud: HudSnapshot;
  items: GameItem[];
  equippedWeaponId: string;
  equippedRelicId: string | null;
  onUseOrEquip: (itemId: string) => void;
  onSaveToSlot: (slotIndex: number) => void;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  items,
  equippedWeaponId,
  equippedRelicId,
  onUseOrEquip,
  onSaveToSlot,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-slate-950/95 border-t sm:border border-white/15 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Backpack className="w-5 h-5 text-amber-300" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Karakter &amp; Inventaris
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label="Tutup Inventaris"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Character Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Level · XP</div>
            <div className="font-mono-num text-sm font-semibold text-amber-300 mt-0.5">
              Lv.{hud.level} ({hud.xp}/{hud.nextLevelXp})
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Serangan Total</div>
            <div className="font-mono-num text-sm font-semibold text-white mt-0.5 flex items-center gap-1">
              <Sword className="w-3.5 h-3.5 text-rose-300" />
              {hud.totalAttack}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Pertahanan</div>
            <div className="font-mono-num text-sm font-semibold text-white mt-0.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-sky-300" />
              {hud.totalDefense}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Sun Shrines</div>
            <div className="font-mono-num text-sm font-semibold text-emerald-300 mt-0.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {hud.activatedShrines.length} / 3
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Perlengkapan &amp; Ramuan</h3>
          <div className="space-y-2">
            {items.map((item) => {
              const isEquipped = item.id === equippedWeaponId || item.id === equippedRelicId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border px-3.5 py-3 flex items-center justify-between gap-3 ${
                    isEquipped
                      ? 'bg-amber-500/10 border-amber-400/40'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span className="truncate">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="font-mono-num text-xs text-amber-300">×{item.quantity}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{item.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUseOrEquip(item.id)}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                      isEquipped
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {isEquipped && <Check className="w-3.5 h-3.5" />}
                    <span>
                      {item.category === 'consumable'
                        ? 'Gunakan'
                        : isEquipped
                          ? 'Terpasang'
                          : 'Pasang'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Slots */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Simpan Progres ke Slot</h3>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((slotIdx) => (
              <button
                key={slotIdx}
                type="button"
                onClick={() => onSaveToSlot(slotIdx)}
                className="min-h-[44px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-xs font-semibold transition-colors"
              >
                Simpan Slot {slotIdx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
