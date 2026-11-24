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
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 bg-[#0b0e12]/75">
      <div className="w-full max-w-2xl max-h-[92dvh] flex flex-col bg-[#11161d]/95 border border-white/15 text-slate-100">
        {/* Header (always visible) */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-7 sm:py-5">
          <div>
            <p className="text-[11px] sm:text-xs font-medium text-amber-400 tracking-wide">
              3D Tactical Compound FPS
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white mt-0.5">
              {isMenu && 'Dustline: Compound Zero'}
              {isPaused && 'Game Paused'}
              {hud.phase === 'victory' && 'Sector Secured'}
              {hud.phase === 'defeat' && 'Mission Failed'}
            </h1>
            {isEnd && hud.roundMessage && (
              <p className="text-xs sm:text-sm text-slate-300 mt-1">{hud.roundMessage}</p>
            )}
          </div>
          {isEnd && (
            <div className="text-right shrink-0">
              <div className="text-[11px] text-slate-400">Score</div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-amber-400 tabular-nums">
                {hud.score}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Middle Body so Start button never goes off-screen on phones */}
        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y px-4 py-3.5 sm:px-7 sm:py-5 space-y-4 sm:space-y-5">
          {/* Post-round stats */}
          {isEnd && (
            <div className="grid grid-cols-3 gap-3 pb-4 border-b border-white/10">
              <div>
                <div className="text-[11px] sm:text-xs text-slate-400">Eliminations</div>
                <div className="font-display text-xl sm:text-2xl font-bold tabular-nums text-white mt-0.5">
                  {hud.kills}
                </div>
              </div>
              <div>
                <div className="text-[11px] sm:text-xs text-slate-400">Headshots</div>
                <div className="font-display text-xl sm:text-2xl font-bold tabular-nums text-red-400 mt-0.5">
                  {hud.headshots}
                </div>
              </div>
              <div>
                <div className="text-[11px] sm:text-xs text-slate-400">
                  {hud.mode === 'defusal' ? 'Time Left' : 'Wave'}
                </div>
                <div className="font-display text-xl sm:text-2xl font-bold tabular-nums text-amber-400 mt-0.5">
                  {hud.mode === 'defusal' ? `${hud.bombTimer.toFixed(1)}s` : hud.wave}
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          {isMenu && (
            <div className="pb-4 border-b border-white/10">
              <div className="text-xs font-medium text-slate-400 mb-2.5">Game Mode</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelectMode('casual')}
                  className={`text-left p-3 border transition-colors ${
                    selectedMode === 'casual'
                      ? 'bg-emerald-500/15 border-emerald-400'
                      : 'bg-[#0b0e12]/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="font-display text-sm sm:text-base font-bold text-white">
                    Casual · Easy
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Low-HP bots, gentle damage, aim assist, and passive health regen.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectMode('skirmish')}
                  className={`text-left p-3 border transition-colors ${
                    selectedMode === 'skirmish'
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-[#0b0e12]/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="font-display text-sm sm:text-base font-bold text-white">
                    Compound Skirmish
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Clear escalating waves of flanking tactical bots across the compound.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectMode('defusal')}
                  className={`text-left p-3 border transition-colors ${
                    selectedMode === 'defusal'
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-[#0b0e12]/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="font-display text-sm sm:text-base font-bold text-white">
                    Site Defusal
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Breach Site A or B within 45 seconds and disarm the planted charge.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Settings & Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                className="w-full h-6 accent-amber-400 cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-300 font-medium">Touch Controls</span>
                <button
                  type="button"
                  onClick={onToggleTouchMode}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
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
              <div className="font-medium text-slate-200 mb-1">
                {touchMode ? 'Phone Touch Controls' : 'Desktop Controls'}
              </div>
              {touchMode ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Move</span>
                    <span className="font-display text-slate-200">Left Thumbstick</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Look / Aim</span>
                    <span className="font-display text-slate-200">Drag Right Side</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Combat</span>
                    <span className="font-display text-slate-200">Fire · Scope · Swap</span>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer inside Modal — Start Game Button ALWAYS Visible & Tappable */}
        <div className="shrink-0 border-t border-white/10 bg-[#0d1117] px-4 py-3.5 sm:px-7 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          {isPaused ? (
            <>
              <button
                type="button"
                onClick={onReturnToMenu}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-300 border border-white/15 hover:border-white/30 transition-colors whitespace-nowrap"
              >
                Main Menu
              </button>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={onStart}
                  className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  Restart
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="min-h-[44px] px-6 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap"
                >
                  Resume
                </button>
              </div>
            </>
          ) : (
            <>
              {isEnd ? (
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-300 border border-white/15 hover:border-white/30 transition-colors whitespace-nowrap"
                >
                  Change Mode
                </button>
              ) : (
                <span className="hidden sm:inline text-xs text-slate-400">
                  AK-47M · M4-S · AWP-Lite
                </span>
              )}
              <button
                type="button"
                onClick={onStart}
                className="w-full sm:w-auto min-h-[48px] px-8 py-3 text-base font-display font-bold tracking-wide bg-amber-500 hover:bg-amber-400 active:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap"
              >
                {isEnd ? 'Play Again' : 'Start Game'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
