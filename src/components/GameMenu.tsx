import React from 'react';
import { GameMode, HudSnapshot } from '../game/types';

interface GameMenuProps {
  hud: HudSnapshot;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  touchMode: boolean;
  onToggleTouchMode: () => void;
  onStart: () => void;
  onResume: () => void;
  onReturnToMenu: () => void;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  hud,
  selectedMode,
  onSelectMode,
  sensitivity,
  onChangeSensitivity,
  touchMode,
  onToggleTouchMode,
  onStart,
  onResume,
  onReturnToMenu,
}) => {
  if (hud.phase === 'playing') return null;

  const isMenu = hud.phase === 'menu';
  const isPaused = hud.phase === 'paused';
  const isEnd = hud.phase === 'victory' || hud.phase === 'defeat';

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-[#0b0e12]/72">
      <div className="w-full max-w-2xl bg-[#11161d]/95 border border-white/15 p-6 sm:p-8 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-medium text-amber-400 tracking-wide">
              Single-Level Procedural 3D Tactical Shooter
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
              {isMenu && 'Dustline: Compound Zero'}
              {isPaused && 'Mission Paused'}
              {hud.phase === 'victory' && 'Sector Secured'}
              {hud.phase === 'defeat' && 'Mission Failed'}
            </h1>
            {isEnd && hud.roundMessage && (
              <p className="text-sm text-slate-300 mt-1">{hud.roundMessage}</p>
            )}
          </div>
          {isEnd && (
            <div className="text-right">
              <div className="text-xs text-slate-400">Final Score</div>
              <div className="font-display text-3xl font-bold text-amber-400 tabular-nums">
                {hud.score}
              </div>
            </div>
          )}
        </div>

        {/* Post-round stats */}
        {isEnd && (
          <div className="grid grid-cols-3 gap-4 py-5 border-b border-white/10">
            <div>
              <div className="text-xs text-slate-400">Eliminations</div>
              <div className="font-display text-2xl font-bold tabular-nums text-white mt-0.5">
                {hud.kills}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Headshots</div>
              <div className="font-display text-2xl font-bold tabular-nums text-red-400 mt-0.5">
                {hud.headshots}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">
                {hud.mode === 'skirmish' ? 'Wave Reached' : 'Time Left'}
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-amber-400 mt-0.5">
                {hud.mode === 'skirmish' ? hud.wave : `${hud.bombTimer.toFixed(1)}s`}
              </div>
            </div>
          </div>
        )}

        {/* Mode Selection (on Menu) */}
        {isMenu && (
          <div className="py-5 border-b border-white/10">
            <div className="text-xs font-medium text-slate-400 mb-3">Select Operation Mode</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectMode('skirmish')}
                className={`text-left p-4 border transition-colors ${
                  selectedMode === 'skirmish'
                    ? 'bg-amber-500/15 border-amber-400'
                    : 'bg-[#0b0e12]/70 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="font-display text-base font-bold text-white">
                  Compound Skirmish
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Clear escalating waves of flanking tactical bots across the warehouse, catwalk, and helipad.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectMode('defusal')}
                className={`text-left p-4 border transition-colors ${
                  selectedMode === 'defusal'
                    ? 'bg-amber-500/15 border-amber-400'
                    : 'bg-[#0b0e12]/70 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="font-display text-base font-bold text-white">
                  Site Defusal
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Breach Site A or B within 45 seconds, eliminate defenders, and disarm the planted charge.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Controls & Settings */}
        <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-white/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Aim Sensitivity</span>
              <span className="font-display text-amber-400 tabular-nums">
                {(sensitivity * 1000).toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.0008"
              max="0.0045"
              step="0.0001"
              value={sensitivity}
              onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-300 font-medium">On-Screen Touch Controls</span>
              <button
                type="button"
                onClick={onToggleTouchMode}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                  touchMode
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#0b0e12] border-white/15 text-slate-300 hover:border-white/30'
                }`}
              >
                {touchMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-1.5">
            <div className="font-medium text-slate-200 mb-1">Field Controls</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Move / Jump / Crouch</span>
              <span className="font-display text-slate-200">WASD · Space · C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fire / Scope / Reload</span>
              <span className="font-display text-slate-200">LMB · RMB · R</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Weapons / Disarm</span>
              <span className="font-display text-slate-200">1 / 2 / 3 · Hold E</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
          {isPaused ? (
            <>
              <button
                type="button"
                onClick={onReturnToMenu}
                className="px-4 py-2.5 text-xs font-medium text-slate-300 border border-white/15 hover:border-white/30 transition-colors whitespace-nowrap"
              >
                Exit to Briefing
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onStart}
                  className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  Restart Match
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="px-6 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap"
                >
                  Resume Match
                </button>
              </div>
            </>
          ) : (
            <>
              {isEnd ? (
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="px-4 py-2.5 text-xs font-medium text-slate-300 border border-white/15 hover:border-white/30 transition-colors whitespace-nowrap"
                >
                  Change Mode
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  100% Procedural 3D · AK-47M / M4-S / AWP-Lite
                </span>
              )}
              <button
                type="button"
                onClick={onStart}
                className="px-7 py-3 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap"
              >
                {isEnd ? 'Deploy Again' : 'Deploy to Compound'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
