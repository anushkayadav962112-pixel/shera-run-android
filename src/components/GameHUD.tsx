import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause } from 'lucide-react';
import { LEVELS, POWERUP_INFO, WORLDS } from '../data/gameData';
import { PlayerSaveData, PowerUpType, RunHudState } from '../types/game';
import { CoinIcon, GemIcon, PowerUpIcon, SheraAvatarBadge } from './SheraBadges';

interface GameHUDProps {
  save: PlayerSaveData;
  hud: RunHudState;
  onPause: () => void;
  onUsePowerUp: (type: PowerUpType) => void;
  onAction: (action: 'left' | 'right' | 'jump' | 'slide') => void;
}

const POWERUP_ORDER: PowerUpType[] = [
  'magnet',
  'shield',
  'rocket',
  'speedBoost',
  'invincibility',
  'hoverboard',
  'doubleCoins',
  'superJump',
];

function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  save,
  hud,
  onPause,
  onUsePowerUp,
  onAction,
}) => {
  const xpPct = Math.min(100, Math.round((save.xp / Math.max(1, save.xpToNext)) * 100));
  const lvlDef = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, hud.gameLevel - 1))];
  const activeMission = save.missions.find((m) => !m.claimed) || save.missions[0];
  const currentWorldName = WORLDS.find((w) => w.id === hud.worldId)?.name || 'Realm';
  const nextWorldName = hud.nextWorldId ? WORLDS.find((w) => w.id === hud.nextWorldId)?.name : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between safe-area-frame">
      {/* TOP HUD BAR */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Shera Profile & Level */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#0b132b]/92 border border-amber-400/55 rounded-2xl px-2 py-1 shadow-lg">
          <SheraAvatarBadge size="sm" />
          <div className="pr-1">
            <div className="text-[11px] sm:text-xs font-extrabold text-white leading-tight whitespace-nowrap">
              Shera
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-amber-300 tabular-nums whitespace-nowrap">
                Lv. {save.playerLevel}
              </span>
              <div className="w-8 sm:w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Multiplier + Score + Distance/Stage + World Rotation */}
        <div className="flex flex-col items-center min-w-0">
          <div className="flex items-center gap-2 bg-[#0b132b]/92 border-2 border-sky-400/65 rounded-full px-3 sm:px-4 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
            <span className="font-display text-sm sm:text-lg font-black text-amber-400 italic tabular-nums">
              x{hud.multiplier}
            </span>
            <span className="font-display text-base sm:text-2xl font-black text-white tracking-wider tabular-nums">
              {String(hud.score).padStart(6, '0')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 bg-[#070d1f]/90 border border-slate-700/80 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-slate-200 tabular-nums whitespace-nowrap">
            <span>{hud.distance}m</span>
            <span className="text-slate-500">/</span>
            <span className="text-amber-300">
              Stg {hud.gameLevel} ({lvlDef.targetDistance}m)
            </span>
            <div className="hidden sm:block w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-amber-400"
                style={{ width: `${Math.round(hud.levelProgress * 100)}%` }}
              />
            </div>
          </div>
          {hud.worldRotationSecondsRemaining !== null && nextWorldName && (
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#0b132b]/88 border border-sky-400/40 text-[10px] font-bold text-sky-200 tabular-nums whitespace-nowrap">
              <span className="sm:hidden">
                {currentWorldName.replace('Kingdom of ', '').replace(' Kingdom', '')} →{' '}
                {nextWorldName.replace('Kingdom of ', '').replace(' Kingdom', '')} (
                {formatCountdown(hud.worldRotationSecondsRemaining)})
              </span>
              <span className="hidden sm:inline">
                {currentWorldName} • Next: {nextWorldName} (
                {formatCountdown(hud.worldRotationSecondsRemaining)})
              </span>
            </div>
          )}
        </div>

        {/* Top-Right: Coins, Gems, Pause */}
        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-[#0b132b]/92 border border-amber-400/55 rounded-full px-2 py-0.5 shadow">
              <CoinIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-[11px] sm:text-sm font-extrabold text-amber-100 tabular-nums">
                {hud.runCoins.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#0b132b]/92 border border-fuchsia-400/55 rounded-full px-2 py-0.5 shadow">
              <GemIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-[11px] sm:text-sm font-extrabold text-fuchsia-100 tabular-nums">
                {hud.runGems.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Pause Game"
            onClick={onPause}
            className="pointer-events-auto w-11 h-11 rounded-full bg-[#132248]/95 border-2 border-sky-300/75 flex items-center justify-center text-white shadow-lg hover:border-amber-300 active:scale-95 transition"
          >
            <Pause className="w-5 h-5 fill-white" />
          </button>
        </div>
      </div>

      {/* CENTER-TOP ALERTS (Banner & Near Miss) */}
      <div className="flex flex-col items-center gap-1.5 my-1">
        {hud.bannerAlert && (
          <div className="px-3.5 py-1 rounded-full bg-amber-400/95 border-2 border-white text-slate-950 font-black text-[11px] sm:text-sm tracking-wide shadow-xl">
            {hud.bannerAlert}
          </div>
        )}
        {hud.nearMissText && (
          <div className="px-3 py-0.5 rounded-full bg-sky-500/92 border border-white text-white font-extrabold text-[11px] shadow">
            {hud.nearMissText}
          </div>
        )}
      </div>

      {/* MIDDLE ROW: Sleek Compact Power-Up Rail leaving Track & Runner Unobstructed */}
      <div className="flex-1 flex items-center justify-between">
        <div className="pointer-events-auto grid grid-flow-col grid-rows-4 gap-1.5 sm:flex sm:flex-col">
          {POWERUP_ORDER.map((type) => {
            const count = hud.inventory[type] || 0;
            const timer = hud.activeTimers[type] || 0;
            const isActive = timer > 0;
            if (count === 0 && !isActive && !['magnet', 'shield', 'rocket'].includes(type)) {
              return null;
            }
            const info = POWERUP_INFO[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => onUsePowerUp(type)}
                disabled={count <= 0}
                title={`${info.name} (Press ${POWERUP_ORDER.indexOf(type) + 1})`}
                className={`relative w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.65)] transition active:scale-90 ${
                  isActive
                    ? 'bg-sky-900/95 border-amber-300 ring-2 ring-amber-400/80'
                    : count > 0
                    ? 'bg-gradient-to-b from-[#172857]/95 to-[#0b132b]/95 border-sky-300/80 hover:border-amber-300'
                    : 'bg-slate-900/65 border-slate-700/60 opacity-55'
                }`}
              >
                <PowerUpIcon type={type} className="w-5 h-5" />
                {isActive ? (
                  <span className="text-[9px] font-black text-amber-300 tabular-nums leading-none mt-0.5">
                    {Math.ceil(timer)}s
                  </span>
                ) : (
                  <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 border border-amber-400 text-[10px] font-black text-white flex items-center justify-center tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
      </div>

      {/* BOTTOM ROW: Active Mission Tracker & Optional Touch Accessibility Pad */}
      <div className="flex items-end justify-between gap-2">
        {save.showTouchControls ? (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Move Left"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('left');
              }}
              className="w-14 h-14 rounded-2xl bg-[#0c142b]/88 border-2 border-sky-400/70 flex items-center justify-center text-white active:scale-90"
            >
              <ArrowLeft className="w-7 h-7" />
            </button>
            <button
              type="button"
              aria-label="Move Right"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('right');
              }}
              className="w-14 h-14 rounded-2xl bg-[#0c142b]/88 border-2 border-sky-400/70 flex items-center justify-center text-white active:scale-90"
            >
              <ArrowRight className="w-7 h-7" />
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Compact Mission Progress Pill */}
        {activeMission && (
          <div className="bg-[#0b132b]/85 border border-slate-600/70 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold text-slate-200 flex items-center gap-2 shadow">
            <span className="text-emerald-300">{activeMission.title}:</span>
            <span className="tabular-nums text-white">
              {Math.min(
                activeMission.target,
                activeMission.progress +
                  (activeMission.metric === 'distance'
                    ? hud.distance
                    : activeMission.metric === 'coins'
                    ? hud.runCoins
                    : 0)
              )}
              /{activeMission.target}
            </span>
          </div>
        )}

        {save.showTouchControls ? (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Slide"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('slide');
              }}
              className="w-14 h-14 rounded-2xl bg-[#0c142b]/88 border-2 border-amber-400/70 flex items-center justify-center text-white active:scale-90"
            >
              <ArrowDown className="w-7 h-7" />
            </button>
            <button
              type="button"
              aria-label="Jump"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('jump');
              }}
              className="w-14 h-14 rounded-2xl bg-[#0c142b]/88 border-2 border-emerald-400/70 flex items-center justify-center text-white active:scale-90"
            >
              <ArrowUp className="w-7 h-7" />
            </button>
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
};
