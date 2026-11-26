import React from 'react';
import { DialogContent } from '../types/game';

interface DialogModalProps {
  dialog: DialogContent;
  onClose: () => void;
}

export const DialogModal: React.FC<DialogModalProps> = ({ dialog, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-xl bg-slate-950/95 border border-amber-400/30 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl">
        <div className="mb-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-amber-300">{dialog.speaker}</h2>
          <p className="text-xs text-slate-400">{dialog.role}</p>
        </div>

        <div className="space-y-2.5 text-sm text-slate-200 leading-relaxed">
          {dialog.lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          {dialog.actionButtonLabel && dialog.onAction && (
            <button
              type="button"
              onClick={dialog.onAction}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              {dialog.actionButtonLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
