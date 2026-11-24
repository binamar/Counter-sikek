/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameMenu } from './components/GameMenu';
import { TacticalHud } from './components/TacticalHud';
import { tacticalAudio } from './game/audio';
import { GameEngine } from './game/GameEngine';
import { GameMode, HudSnapshot, WeaponId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  mode: 'skirmish',
  health: 100,
  armor: 100,
  weaponId: 'ak47',
  weaponName: 'AK-47M Tactical',
  ammoInMag: 30,
  ammoReserve: 120,
  isReloading: false,
  reloadProgress: 0,
  isScoped: false,
  crosshairSpread: 0,
  hitMarker: 'none',
  damageDirectionAngle: null,
  damageFlash: 0,
  score: 0,
  kills: 0,
  headshots: 0,
  wave: 1,
  botsAlive: 0,
  botsTotal: 0,
  bombTimer: 45,
  activeSite: 'A',
  nearBombSite: false,
  defuseProgress: 0,
  roundMessage: null,
  playerX: 0,
  playerZ: 38,
  playerYaw: 0,
  minimapBlips: [],
  killFeed: [],
  pointerLocked: false,
  webglError: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [minimapWalls, setMinimapWalls] = useState<Array<{ x: number; z: number; w: number; d: number }>>([]);
  const [selectedMode, setSelectedMode] = useState<GameMode>('skirmish');
  const [sensitivity, setSensitivity] = useState<number>(0.0021);
  const [muted, setMuted] = useState<boolean>(false);
  const [touchMode, setTouchMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new GameEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    setMinimapWalls(engine.getMinimapWalls());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame(selectedMode);
  }, [selectedMode]);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleReturnToMenu = useCallback(() => {
    engineRef.current?.returnToMenu();
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      tacticalAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleSwitchWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.switchWeapon(id);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0e12]">
      {/* Isolated WebGL viewport mount container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Graceful WebGL fallback notice if hardware/context fails */}
      {hud.webglError && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0e12] p-6">
          <div className="max-w-md border border-white/15 bg-[#11161d] p-6 text-center">
            <h2 className="font-display text-xl font-bold text-white">3D Viewport Unavailable</h2>
            <p className="text-sm text-slate-300 mt-2">{hud.webglError}</p>
          </div>
        </div>
      )}

      {/* Live Gameplay HUD */}
      {hud.phase === 'playing' && (
        <TacticalHud
          hud={hud}
          minimapWalls={minimapWalls}
          touchMode={touchMode}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onSwitchWeapon={handleSwitchWeapon}
          onTouchMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
          onTouchLookDelta={(dx, dy) => engineRef.current?.addTouchLookDelta(dx, dy)}
          onTouchFire={(f) => engineRef.current?.setTouchFire(f)}
          onTouchScope={() => engineRef.current?.toggleScope()}
          onTouchReload={() => engineRef.current?.triggerReload()}
          onTouchJump={() => engineRef.current?.triggerTouchJump()}
          onTouchCycleWeapon={() => engineRef.current?.cycleWeapon()}
          onTouchDefuse={(d) => engineRef.current?.setTouchDefuse(d)}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
        />
      )}

      {/* Briefing / Pause / Post-Match Overlay */}
      <GameMenu
        hud={hud}
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        sensitivity={sensitivity}
        onChangeSensitivity={handleSensitivityChange}
        touchMode={touchMode}
        onToggleTouchMode={() => setTouchMode((t) => !t)}
        onStart={handleStart}
        onResume={handleResume}
        onReturnToMenu={handleReturnToMenu}
      />
    </div>
  );
}
