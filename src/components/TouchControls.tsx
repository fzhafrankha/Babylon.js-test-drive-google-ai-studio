import React, { useRef, useState } from 'react';
import { Flame, Hand, Heart, Shield, Sparkles, Sword, Target, ArrowUp, Wind, Zap } from 'lucide-react';
import { InteractionPrompt, SkillCooldownState } from '../types/game';

interface TouchControlsProps {
  visible: boolean;
  isBlocking: boolean;
  isLockedOn: boolean;
  mana: number;
  stamina: number;
  skills: SkillCooldownState;
  interaction: InteractionPrompt | null;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onBlockChange: (held: boolean) => void;
  onAction: (
    action: 'attack' | 'dodge' | 'jump' | 'lockOn' | 'interact' | 'skill1' | 'skill2' | 'skill3'
  ) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  isBlocking,
  isLockedOn,
  mana,
  stamina,
  skills,
  interaction,
  onMove,
  onLookDelta,
  onBlockChange,
  onAction,
}) => {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [sprintLocked, setSprintLocked] = useState(false);
  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });

  const lookPointerId = useRef<number | null>(null);
  const lookLastPos = useRef({ x: 0, y: 0 });

  const prevVisible = useRef(visible);

  React.useEffect(() => {
    if (prevVisible.current && !visible) {
      joyPointerId.current = null;
      lookPointerId.current = null;
      setJoyActive(false);
      setJoyOffset({ x: 0, y: 0 });
      onMove(0, 0, false);
      onBlockChange(false);
    }
    prevVisible.current = visible;
  }, [visible, onMove, onBlockChange]);

  if (!visible) return null;

  const MAX_RADIUS = 44;

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoyActive(true);
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyActive(false);
    setJoyOffset({ x: 0, y: 0 });
    onMove(0, 0, sprintLocked);
  };

  const updateJoyFromPoint = (clientX: number, clientY: number) => {
    const dx = clientX - joyCenter.current.x;
    const dy = clientY - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setJoyOffset({ x: ox, y: oy });

    const normX = ox / MAX_RADIUS;
    const normY = -oy / MAX_RADIUS; // Screen up is +forward
    const autoSprint = clamped / MAX_RADIUS > 0.84;
    onMove(normX, normY, sprintLocked || autoSprint);
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lookLastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lookLastPos.current.x;
    const dy = e.clientY - lookLastPos.current.y;
    lookLastPos.current = { x: e.clientX, y: e.clientY };
    onLookDelta(dx * 1.45, dy * 1.25);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  };

  const renderSkillButton = (
    label: string,
    cost: number,
    cd: number,
    maxCd: number,
    icon: React.ReactNode,
    accentClass: string,
    onPress: () => void
  ) => {
    const ready = cd <= 0.05 && mana >= cost;
    const ratio = maxCd > 0 ? Math.min(1, cd / maxCd) : 0;
    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPress();
        }}
        className={`touch-surface relative w-12 h-12 rounded-2xl border flex flex-col items-center justify-center transition-transform active:scale-90 ${
          ready
            ? `${accentClass} shadow-lg`
            : 'bg-slate-900/75 border-white/10 text-slate-400 opacity-75'
        }`}
        aria-label={label}
      >
        {icon}
        <span className="text-[9px] font-medium leading-none mt-0.5">{label}</span>
        {cd > 0.05 && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex items-center justify-center">
            <span className="font-mono-num text-xs font-semibold text-white">{cd.toFixed(1)}</span>
          </div>
        )}
        {ratio > 0 && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="21"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2.5"
              strokeDasharray={`${(1 - ratio) * 132} 132`}
            />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none touch-surface">
      {/* Right-side invisible camera orbit touch surface */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="absolute top-16 right-0 bottom-0 left-[34%] pointer-events-auto touch-surface"
        aria-label="Area geser kamera"
      />

      {/* Left Bottom: Virtual Analog Joystick + Sprint Button */}
      <div
        className="absolute bottom-5 left-5 flex items-end gap-3 pointer-events-auto touch-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)' }}
      >
        <div
          onPointerDown={handleJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          className={`relative w-32 h-32 rounded-full border-2 backdrop-blur-md flex items-center justify-center transition-colors touch-surface ${
            joyActive
              ? 'bg-slate-900/55 border-amber-400/60'
              : 'bg-slate-950/40 border-white/20'
          }`}
          aria-label="Joystick Gerak"
        >
          <div className="absolute inset-3 rounded-full border border-white/10 pointer-events-none" />
          <div
            className={`w-12 h-12 rounded-full border shadow-lg pointer-events-none transition-colors ${
              joyActive
                ? 'bg-amber-400/90 border-amber-200 shadow-amber-500/30'
                : 'bg-white/25 border-white/40'
            }`}
            style={{
              transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
            }}
          />
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            const next = !sprintLocked;
            setSprintLocked(next);
            if (!joyActive) onMove(0, 0, next);
          }}
          className={`touch-surface w-12 h-12 rounded-full border backdrop-blur-md flex flex-col items-center justify-center transition-transform active:scale-90 ${
            sprintLocked
              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
              : 'bg-slate-950/55 border-white/20 text-slate-200'
          }`}
          aria-label="Toggle Sprint"
        >
          <Wind className="w-4 h-4" />
          <span className="text-[9px] font-medium mt-0.5">Lari</span>
        </button>
      </div>

      {/* Right Bottom: Ergonomic Action & Magic Buttons */}
      <div
        className="absolute bottom-5 right-5 flex flex-col items-end gap-2.5 pointer-events-auto touch-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        {/* Contextual Interact Button */}
        {interaction && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('interact');
            }}
            className="touch-surface mb-1 px-4 min-h-[46px] rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/30 active:scale-95 transition-transform"
          >
            <Hand className="w-4 h-4" />
            <span>{interaction.actionLabel}</span>
          </button>
        )}

        {/* Row 1: 3 Magic Skills */}
        <div className="flex items-center gap-2.5">
          {renderSkillButton(
            'Arcane',
            20,
            skills.arcaneWave,
            skills.arcaneWaveMax,
            <Zap className="w-4 h-4 text-sky-300" />,
            'bg-sky-950/75 border-sky-400/50 text-sky-100',
            () => onAction('skill1')
          )}
          {renderSkillButton(
            'Solar',
            38,
            skills.solarJudgment,
            skills.solarJudgmentMax,
            <Flame className="w-4 h-4 text-amber-300" />,
            'bg-amber-950/75 border-amber-400/50 text-amber-100',
            () => onAction('skill2')
          )}
          {renderSkillButton(
            'Pulih',
            28,
            skills.vitalityMend,
            skills.vitalityMendMax,
            <Heart className="w-4 h-4 text-emerald-300" />,
            'bg-emerald-950/75 border-emerald-400/50 text-emerald-100',
            () => onAction('skill3')
          )}
        </div>

        {/* Row 2: Lock-On + Jump */}
        <div className="flex items-center gap-3 pr-1">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('lockOn');
            }}
            className={`touch-surface w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center active:scale-90 transition-transform ${
              isLockedOn
                ? 'bg-amber-500/35 border-amber-400 text-amber-200'
                : 'bg-slate-950/60 border-white/20 text-slate-200'
            }`}
            aria-label="Kunci Target"
          >
            <Target className="w-4 h-4" />
            <span className="text-[8px] font-medium">Kunci</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('jump');
            }}
            className="touch-surface w-12 h-12 rounded-full bg-slate-950/65 border border-white/25 backdrop-blur-md text-slate-100 flex flex-col items-center justify-center active:scale-90 transition-transform"
            aria-label="Lompat"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="text-[9px] font-medium">Lompat</span>
          </button>
        </div>

        {/* Row 3: Shield (Hold) + Dodge + Primary Attack (64x64) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onBlockChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onBlockChange(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              onBlockChange(false);
            }}
            className={`touch-surface w-12 h-12 rounded-full border backdrop-blur-md flex flex-col items-center justify-center active:scale-90 transition-transform ${
              isBlocking
                ? 'bg-sky-500/40 border-sky-300 text-white'
                : 'bg-slate-950/65 border-white/25 text-slate-100'
            }`}
            aria-label="Perisai"
          >
            <Shield className="w-4 h-4" />
            <span className="text-[9px] font-medium">Perisai</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('dodge');
            }}
            className={`touch-surface w-12 h-12 rounded-full border backdrop-blur-md flex flex-col items-center justify-center active:scale-90 transition-transform ${
              stamina >= 22
                ? 'bg-slate-950/65 border-white/25 text-slate-100'
                : 'bg-slate-950/40 border-white/10 text-slate-500'
            }`}
            aria-label="Dodge Roll"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[9px] font-medium">Dodge</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('attack');
            }}
            className="touch-surface w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-200/80 text-slate-950 font-bold flex flex-col items-center justify-center shadow-xl shadow-amber-500/35 active:scale-90 transition-transform"
            aria-label="Serang"
          >
            <Sword className="w-6 h-6" />
            <span className="text-[10px] font-bold leading-none mt-0.5">Serang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
