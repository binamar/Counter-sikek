import React, { useEffect, useRef } from 'react';
import { Crosshair, Pause, RotateCw, Shield, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, WeaponId } from '../game/types';

interface TacticalHudProps {
  hud: HudSnapshot;
  minimapWalls: Array<{ x: number; z: number; w: number; d: number }>;
  touchMode: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchFire: (firing: boolean) => void;
  onTouchScope: () => void;
  onTouchReload: () => void;
  onTouchJump: () => void;
  onTouchCycleWeapon: () => void;
  onTouchDefuse: (defusing: boolean) => void;
  onRequestLock: () => void;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({
  hud,
  minimapWalls,
  touchMode,
  muted,
  onToggleMute,
  onPause,
  onSwitchWeapon,
  onTouchMove,
  onTouchLookDelta,
  onTouchFire,
  onTouchScope,
  onTouchReload,
  onTouchJump,
  onTouchCycleWeapon,
  onTouchDefuse,
  onRequestLock,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const moveTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Draw crisp 2D tactical radar minimap
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const scale = 1.6;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(11, 14, 18, 0.85)';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(hud.playerYaw);

    ctx.fillStyle = 'rgba(180, 165, 140, 0.48)';
    for (let i = 0; i < minimapWalls.length; i++) {
      const wall = minimapWalls[i];
      const rx = (wall.x - hud.playerX) * scale;
      const rz = (wall.z - hud.playerZ) * scale;
      ctx.fillRect(rx - (wall.w * scale) / 2, rz - (wall.d * scale) / 2, wall.w * scale, wall.d * scale);
    }

    for (const blip of hud.minimapBlips) {
      const bx = (blip.x - hud.playerX) * scale;
      const bz = (blip.z - hud.playerZ) * scale;
      if (Math.hypot(bx, bz) > half - 6) continue;
      if (blip.type === 'bot') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx, bz, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (blip.type === 'objective') {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 4, bz - 4, 8, 8);
      } else {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(bx - 2, bz - 2, 4, 4);
      }
    }
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(half, half - 6);
    ctx.lineTo(half + 4.5, half + 5);
    ctx.lineTo(half, half + 2.5);
    ctx.lineTo(half - 4.5, half + 5);
    ctx.closePath();
    ctx.fill();
  }, [hud.playerX, hud.playerZ, hud.playerYaw, hud.minimapBlips, minimapWalls]);

  // Left virtual thumbstick touch handlers
  const handleStickTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (moveTouchId.current === null) {
        moveTouchId.current = t.identifier;
        updateStickFromTouch(t.clientX, t.clientY);
      }
    }
  };

  const handleStickTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId.current) {
        updateStickFromTouch(t.clientX, t.clientY);
      }
    }
  };

  const handleStickTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === moveTouchId.current) {
        moveTouchId.current = null;
        onTouchMove(0, 0);
        if (stickKnobRef.current) {
          stickKnobRef.current.style.transform = 'translate(0px, 0px)';
        }
      }
    }
  };

  const updateStickFromTouch = (clientX: number, clientY: number) => {
    if (!stickRef.current) return;
    const rect = stickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    onTouchMove(dx / maxR, -dy / maxR);
  };

  // Right look-zone touch handlers
  const handleLookTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (lookTouchId.current === null) {
        lookTouchId.current = t.identifier;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
      }
    }
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        onTouchLookDelta(dx, dy);
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  const spreadPx = 6 + Math.round(hud.crosshairSpread * 16);
  const showSniperScope = hud.isScoped && hud.weaponId === 'awp';

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Damage edge vignette */}
      {hud.damageFlash > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 110px rgba(239, 68, 68, ${hud.damageFlash * 0.72})`,
          }}
        />
      )}

      {/* AWP Sniper Scope Overlay */}
      {showSniperScope && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at center, transparent 0%, transparent 32%, rgba(7, 9, 12, 0.97) 33%, rgba(7, 9, 12, 0.99) 100%)',
            }}
          >
            <div className="relative w-full h-[1px] bg-black/80" />
            <div className="absolute w-[1px] h-full bg-black/80" />
            <div className="absolute w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* Dynamic CS-Style Crosshair */}
      {!showSniperScope && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <span
              className="absolute w-2.5 h-[2px] bg-emerald-400 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
              style={{ transform: `translateX(-${spreadPx}px)` }}
            />
            <span
              className="absolute w-2.5 h-[2px] bg-emerald-400 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
              style={{ transform: `translateX(${spreadPx}px)` }}
            />
            <span
              className="absolute h-2.5 w-[2px] bg-emerald-400 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
              style={{ transform: `translateY(-${spreadPx}px)` }}
            />
            <span
              className="absolute h-2.5 w-[2px] bg-emerald-400 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
              style={{ transform: `translateY(${spreadPx}px)` }}
            />
            <span className="w-[2px] h-[2px] bg-emerald-300" />

            {/* Hit Marker X */}
            {hud.hitMarker !== 'none' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`absolute w-4 h-[2px] rotate-45 ${
                    hud.hitMarker === 'head' ? 'bg-red-500' : 'bg-white'
                  }`}
                />
                <span
                  className={`absolute w-4 h-[2px] -rotate-45 ${
                    hud.hitMarker === 'head' ? 'bg-red-500' : 'bg-white'
                  }`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Directional Damage Indicator */}
      {hud.damageDirectionAngle !== null && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${-hud.damageDirectionAngle}rad)` }}
        >
          <div className="w-40 h-40 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 bg-red-500/85" />
          </div>
        </div>
      )}

      {/* Top-Left: Compact Radar Minimap (+ inline Health/Armor on touch screens so bottom stays clear) */}
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 flex items-start gap-2">
        <div className="border border-white/15 bg-[#0b0e12]/85 p-1">
          <canvas
            ref={radarCanvasRef}
            width={132}
            height={132}
            className="block w-[76px] h-[76px] sm:w-[132px] sm:h-[132px]"
          />
          <div className="mt-0.5 flex items-center justify-between px-0.5 text-[10px] sm:text-[11px] text-slate-300 font-display tracking-wide">
            <span className="hidden sm:inline">COMPOUND ZERO</span>
            <span className="sm:hidden">RADAR</span>
            <span className="tabular-nums text-amber-400">{hud.kills} K</span>
          </div>
        </div>

        {touchMode && (
          <div className="bg-[#0b0e12]/85 border border-white/15 px-2.5 py-1.5 flex items-center gap-3">
            <div>
              <div className="text-[10px] text-slate-400 leading-none">HP</div>
              <div
                className={`font-display text-base font-bold tabular-nums leading-tight ${
                  hud.health <= 30 ? 'text-red-400' : 'text-slate-100'
                }`}
              >
                {hud.health}
              </div>
            </div>
            <div className="h-5 w-[1px] bg-white/15" />
            <div>
              <div className="text-[10px] text-slate-400 leading-none">AP</div>
              <div className="font-display text-base font-bold text-sky-300 tabular-nums leading-tight">
                {hud.armor}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top-Center: Match Timer / Wave & Hostile Counter */}
      <div className="absolute top-2.5 sm:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 sm:gap-4 bg-[#0b0e12]/85 border border-white/15 px-2.5 py-1.5 sm:px-4 sm:py-2">
        {hud.mode !== 'defusal' ? (
          <>
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] text-slate-400 leading-none">
                {hud.mode === 'casual' ? 'Casual' : 'Wave'}
              </div>
              <div className="font-display text-sm sm:text-lg font-bold text-amber-400 tabular-nums leading-tight">
                {hud.wave}
              </div>
            </div>
            <div className="h-5 w-[1px] bg-white/15" />
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] text-slate-400 leading-none">Hostiles</div>
              <div className="font-display text-sm sm:text-lg font-bold text-slate-100 tabular-nums leading-tight">
                {hud.botsAlive}/{hud.botsTotal}
              </div>
            </div>
            <div className="hidden sm:block h-6 w-[1px] bg-white/15" />
            <div className="hidden sm:block text-center">
              <div className="text-[11px] text-slate-400 leading-none">Score</div>
              <div className="font-display text-lg font-bold text-slate-100 tabular-nums leading-tight">
                {hud.score}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] text-slate-400 leading-none">Site {hud.activeSite}</div>
              <div
                className={`font-display text-base sm:text-xl font-bold tabular-nums leading-tight ${
                  hud.bombTimer < 10 ? 'text-red-400' : 'text-amber-400'
                }`}
              >
                {hud.bombTimer.toFixed(1)}s
              </div>
            </div>
            <div className="h-5 w-[1px] bg-white/15" />
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] text-slate-400 leading-none">Defenders</div>
              <div className="font-display text-sm sm:text-lg font-bold text-slate-100 tabular-nums leading-tight">
                {hud.botsAlive}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top-Right: Utility Actions, Mobile Ammo Readout & Kill Feed */}
      <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="h-10 w-10 flex items-center justify-center bg-[#0b0e12]/85 border border-white/15 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="h-10 px-2.5 sm:px-3 flex items-center gap-1.5 bg-[#0b0e12]/85 border border-white/15 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>

        {/* Compact Ammo Readout on Touch Mode right under top-right buttons */}
        {touchMode && (
          <div className="bg-[#0b0e12]/85 border border-white/15 px-2.5 py-1 text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="font-display text-base font-bold text-amber-400 tabular-nums leading-none">
                {hud.ammoInMag}
              </span>
              <span className="font-display text-xs text-slate-400 tabular-nums">/ {hud.ammoReserve}</span>
            </div>
            <div className="text-[10px] font-medium text-slate-300 mt-0.5">{hud.weaponName}</div>
          </div>
        )}

        {/* Kill Feed */}
        <div className="hidden sm:flex flex-col items-end gap-1 mt-1">
          {hud.killFeed.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#0b0e12]/80 border border-white/10 px-2.5 py-1 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="text-emerald-400 font-medium">{entry.killer}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300">{entry.weapon}</span>
              {entry.headshot && <span className="text-red-400 font-semibold">[HS]</span>}
              <span className="text-slate-400">·</span>
              <span className="text-red-300 font-medium">{entry.victim}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round / Wave Announcement Banner */}
      {hud.roundMessage && (
        <div className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 bg-[#0b0e12]/90 border border-amber-500/40 px-4 py-1.5 sm:px-5 sm:py-2 text-center">
          <p className="font-display text-xs sm:text-base font-semibold text-amber-300 tracking-wide whitespace-nowrap">
            {hud.roundMessage}
          </p>
        </div>
      )}

      {/* Pointer Lock Hint on Desktop if unlocked while playing */}
      {!touchMode && !hud.pointerLocked && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onRequestLock}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs px-4 py-2 transition-colors whitespace-nowrap"
          >
            Click Viewport to Lock Aim
          </button>
        </div>
      )}

      {/* Contextual Defuse Prompt / Progress Bar */}
      {hud.mode === 'defusal' && hud.nearBombSite && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-[#0b0e12]/90 border border-amber-500/50 px-4 py-2.5 w-56 sm:w-64 text-center">
          <div className="text-xs font-medium text-amber-300 mb-1.5">
            {hud.defuseProgress > 0
              ? 'Disarming Charge...'
              : touchMode
              ? 'Hold Defuse Button'
              : 'Hold [E] to Disarm Charge'}
          </div>
          <div className="w-full h-2 bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.round(hud.defuseProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Reloading Indicator */}
      {hud.isReloading && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-[#0b0e12]/85 border border-white/15 px-3 py-1.5 w-36">
          <div className="text-[11px] text-slate-300 text-center mb-1">Reloading</div>
          <div className="w-full h-1 bg-slate-800">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Desktop Bottom-Left: Health & Armor */}
      {!touchMode && (
        <div className="absolute bottom-4 left-4 bg-[#0b0e12]/85 border border-white/15 px-4 py-2.5 flex items-center gap-5">
          <div>
            <div className="text-[11px] text-slate-400 leading-none">Health</div>
            <div
              className={`font-display text-2xl font-bold tabular-nums leading-tight ${
                hud.health <= 30 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.health}
            </div>
          </div>
          <div className="h-7 w-[1px] bg-white/15" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[11px] text-slate-400 leading-none">Armor</div>
              <div className="font-display text-xl font-bold text-sky-300 tabular-nums leading-tight">
                {hud.armor}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Bottom-Right: Weapon & Ammo */}
      {!touchMode && (
        <div className="absolute bottom-4 right-4 bg-[#0b0e12]/85 border border-white/15 px-4 py-2.5 text-right">
          <div className="flex items-baseline justify-end gap-2">
            <span className="font-display text-2xl font-bold text-amber-400 tabular-nums leading-none">
              {hud.ammoInMag}
            </span>
            <span className="font-display text-sm text-slate-400 tabular-nums">/ {hud.ammoReserve}</span>
          </div>
          <div className="text-xs font-medium text-slate-200 mt-1">{hud.weaponName}</div>
          <div className="mt-1.5 flex items-center justify-end gap-1 pointer-events-auto">
            {(['ak47', 'm4s', 'awp'] as WeaponId[]).map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => onSwitchWeapon(id)}
                className={`px-2 py-0.5 text-[11px] font-display border transition-colors ${
                  hud.weaponId === id
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {i + 1} · {id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile / Touch Dual-Thumbstick Overlay */}
      {touchMode && (
        <>
          {/* Right half invisible drag-to-aim area */}
          <div
            className="absolute top-14 right-0 bottom-0 left-1/2 pointer-events-auto"
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
          />

          {/* Left Virtual Thumbstick */}
          <div
            ref={stickRef}
            onTouchStart={handleStickTouchStart}
            onTouchMove={handleStickTouchMove}
            onTouchEnd={handleStickTouchEnd}
            onTouchCancel={handleStickTouchEnd}
            className="absolute bottom-4 left-4 w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-white/25 bg-[#0b0e12]/55 pointer-events-auto flex items-center justify-center"
          >
            <div
              ref={stickKnobRef}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400/80 border border-white/40 pointer-events-none"
            />
          </div>

          {/* Right Ergonomic Action Cluster */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
            <div className="flex items-center gap-2">
              {hud.mode === 'defusal' && hud.nearBombSite && (
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onTouchDefuse(true);
                  }}
                  onTouchEnd={() => onTouchDefuse(false)}
                  onTouchCancel={() => onTouchDefuse(false)}
                  className="h-11 px-3.5 bg-amber-500 text-slate-950 font-semibold text-xs border border-amber-300"
                >
                  Hold Defuse
                </button>
              )}
              <button
                type="button"
                onClick={onTouchCycleWeapon}
                className="h-11 px-3 bg-[#0b0e12]/80 border border-white/25 text-xs font-display text-slate-100"
              >
                Swap
              </button>
              <button
                type="button"
                onClick={onTouchReload}
                aria-label="Reload"
                className="h-11 w-11 flex items-center justify-center bg-[#0b0e12]/80 border border-white/25 text-slate-100"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTouchJump}
                className="h-12 px-3.5 bg-[#0b0e12]/80 border border-white/25 text-xs font-medium text-slate-100"
              >
                Jump
              </button>
              <button
                type="button"
                onClick={onTouchScope}
                aria-label="Toggle scope"
                className={`h-12 w-12 flex items-center justify-center border ${
                  hud.isScoped
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-[#0b0e12]/80 border-white/25 text-slate-100'
                }`}
              >
                <Crosshair className="w-5 h-5" />
              </button>
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  onTouchFire(true);
                }}
                onTouchEnd={() => onTouchFire(false)}
                onTouchCancel={() => onTouchFire(false)}
                className="h-14 w-18 sm:h-16 sm:w-20 bg-red-600/90 active:bg-red-500 border-2 border-red-300/60 text-white font-display font-bold text-sm"
              >
                FIRE
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
