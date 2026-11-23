import React, { useState } from 'react';
import {
  Award,
  Check,
  Home,
  Music,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MonetizationService } from '../services/monetization';
import { PlayerSaveData, RunResult } from '../types/game';
import { CoinIcon, GemIcon, SheraLogoLockup } from './SheraBadges';

export const LoadingOverlay: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="fixed inset-0 z-50 bg-[#060914] flex flex-col items-center justify-center p-6">
    <SheraLogoLockup />
    <div className="mt-6 w-64 sm:w-80 h-3.5 bg-slate-900 rounded-full border border-amber-500/60 overflow-hidden p-0.5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
    <p className="mt-3 text-xs font-bold tracking-widest text-amber-200 uppercase tabular-nums">
      Pre-Warming Fantasy Kingdoms... {progress}%
    </p>
  </div>
);

interface PauseModalProps {
  save: PlayerSaveData;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  save,
  onResume,
  onRestart,
  onHome,
  onToggleSound,
  onToggleMusic,
}) => (
  <div className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center safe-area-frame">
    <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#111d40] to-[#091128] border-2 border-amber-400/80 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.88)] text-center">
      <h2 className="text-2xl font-black tracking-wide text-amber-300 drop-shadow">GAME PAUSED</h2>
      <p className="text-xs text-slate-300 mt-1">
        4-World Endless Rotation: {save.worldRotationEnabled ? 'ON (2 min / realm)' : 'OFF'}
      </p>

      <div className="grid grid-cols-2 gap-3 my-5">
        <button
          type="button"
          onClick={onToggleSound}
          className={`min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition ${
            save.soundEnabled
              ? 'bg-emerald-950/75 border-emerald-400 text-emerald-200'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          {save.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>SFX {save.soundEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMusic}
          className={`min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition ${
            save.musicEnabled
              ? 'bg-sky-950/75 border-sky-400 text-sky-200'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Music {save.musicEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onResume}
          className="min-h-[48px] flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 border border-amber-200 text-slate-950 font-black text-base shadow-lg hover:brightness-110 active:scale-95 transition"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>RESUME RUN</span>
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="min-h-[44px] flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-sky-700 hover:bg-sky-600 text-white font-extrabold text-sm border border-sky-400/60 active:scale-95 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>RESTART STAGE</span>
        </button>

        <button
          type="button"
          onClick={onHome}
          className="min-h-[44px] flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-600 active:scale-95 transition"
        >
          <Home className="w-4 h-4" />
          <span>RETURN TO THRONE</span>
        </button>
      </div>
    </div>
  </div>
);

interface GameOverModalProps {
  result: RunResult;
  save: PlayerSaveData;
  onRestart: () => void;
  onHome: () => void;
  onReviveWithCoins: (coinCost: number) => void;
  onReviveWithGems: () => void;
  onReviveViaAdSdk: () => void;
  onDoubleRunCoinsViaAd: (bonusCoins: number) => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  save,
  onRestart,
  onHome,
  onReviveWithCoins,
  onReviveWithGems,
  onReviveViaAdSdk,
  onDoubleRunCoinsViaAd,
}) => {
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const [confirmCoinContinue, setConfirmCoinContinue] = useState(false);
  const [coinsDoubled, setCoinsDoubled] = useState(false);

  // Default 1 rewarded ad revive per run
  const adReviveAvailable = result.adRevivedCount < 1;
  const coinContinueCost = 500 * (result.coinRevivedCount + 1);
  const canAffordCoins = save.coins >= coinContinueCost;
  const reviveGemCost = 10 * (result.revivedCount + 1);
  const canAffordGems = save.gems >= reviveGemCost;

  const xpPct = Math.min(100, Math.round((save.xp / Math.max(1, save.xpToNext)) * 100));
  const sdkConnected = MonetizationService.isAdSdkConnected();

  const handleRewardedRevive = async () => {
    if (!adReviveAvailable) return;
    const res = await MonetizationService.requestRewardedAd('revive');
    if (res.status === 'rewarded') {
      onReviveViaAdSdk();
    } else {
      setAdNotice(res.message);
    }
  };

  const handleDoubleCoinsAd = async () => {
    if (coinsDoubled || result.coins <= 0) return;
    const res = await MonetizationService.requestRewardedAd('double_run_coins');
    if (res.status === 'rewarded') {
      setCoinsDoubled(true);
      onDoubleRunCoinsViaAd(result.coins);
    } else {
      setAdNotice(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/88 flex items-center justify-center safe-area-frame">
      <div className="w-full max-w-md max-h-[94vh] overflow-y-auto custom-scroll rounded-3xl bg-gradient-to-b from-[#111d40] to-[#091128] border-2 border-amber-400/85 p-5 sm:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.92)]">
        <div className="text-center">
          {result.isNewBest && (
            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black mb-2">
              <Award className="w-3.5 h-3.5" /> NEW HIGH SCORE!
            </span>
          )}
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow">RUN ENDED</h2>
          <p className="text-xs text-rose-300 font-semibold mt-1">{result.reason}</p>
        </div>

        {/* Score Card */}
        <div className="mt-3.5 rounded-2xl bg-slate-900/95 border border-slate-700 p-3.5 text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Final Score</div>
          <div className="text-4xl font-black text-amber-300 tabular-nums mt-0.5">
            {result.score.toLocaleString()}
          </div>
          <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-400 mt-1 tabular-nums">
            <span>Best: {Math.max(save.highScore, result.score).toLocaleString()}</span>
            {result.worldsVisited.length > 1 && (
              <span className="text-sky-300">• {result.worldsVisited.length} Realms Visited</span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 mt-3">
          <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-2.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Distance</div>
            <div className="text-base font-black text-sky-300 tabular-nums mt-0.5">{result.distance}m</div>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-2.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Coins</div>
            <div className="flex items-center justify-center gap-1 text-base font-black text-amber-300 tabular-nums mt-0.5">
              <CoinIcon className="w-4 h-4" />
              <span>+{coinsDoubled ? result.coins * 2 : result.coins}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-2.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Gems & XP</div>
            <div className="flex items-center justify-center gap-1 text-sm font-black text-fuchsia-300 tabular-nums mt-0.5">
              <GemIcon className="w-3.5 h-3.5" />+{result.gems} · +{result.xpEarned}XP
            </div>
          </div>
        </div>

        {/* Current Player Level & XP Progress Bar */}
        <div className="mt-3 rounded-xl bg-slate-900/90 border border-amber-400/35 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Level {save.playerLevel} Sovereign
            </span>
            <span className="text-slate-300 tabular-nums">
              {save.xp.toLocaleString()} / {save.xpToNext.toLocaleString()} XP
            </span>
          </div>
          <div className="mt-1.5 w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-emerald-400 transition-all duration-300"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {result.levelCleared && (
          <div className="mt-3 rounded-xl bg-emerald-950/75 border border-emerald-400/70 px-3 py-2 text-center text-xs font-extrabold text-emerald-200">
            Stage {result.clearedLevelNumber} Cleared! Stage Rewards Credited!
          </div>
        )}

        {/* REVIVE / CONTINUE OPTIONS */}
        <div className="mt-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/45 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-sky-200">
            <span>CONTINUE THIS RUN?</span>
            <span className="text-slate-400 tabular-nums">
              Balance: {save.coins.toLocaleString()}c · {save.gems.toLocaleString()}g
            </span>
          </div>

          {/* A. Watch Ad to Revive (Max 1 per run) */}
          <button
            type="button"
            disabled={!adReviveAvailable}
            onClick={handleRewardedRevive}
            className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl font-extrabold text-xs border transition ${
              adReviveAvailable
                ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white active:scale-95'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2">
              <Tv className="w-4 h-4 shrink-0" />
              <span>
                {adReviveAvailable
                  ? sdkConnected
                    ? 'Watch Ad to Revive (Free)'
                    : 'Watch Ad to Revive (AdMob SDK)'
                  : 'Ad Revive Used This Run (1/1)'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded bg-black/30 text-[10px]">
              {adReviveAvailable ? '1/1 LEFT' : 'USED'}
            </span>
          </button>

          {/* B. Use Coins to Continue (Confirmed Step + Negative Balance Guard) */}
          {!confirmCoinContinue ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canAffordCoins}
                onClick={() => setConfirmCoinContinue(true)}
                className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-extrabold text-xs border transition ${
                  canAffordCoins
                    ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 active:scale-95'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CoinIcon className="w-4 h-4" />
                <span>Use {coinContinueCost.toLocaleString()} Coins</span>
              </button>

              <button
                type="button"
                disabled={!canAffordGems}
                onClick={onReviveWithGems}
                className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-extrabold text-xs border transition ${
                  canAffordGems
                    ? 'bg-fuchsia-700 hover:bg-fuchsia-600 border-fuchsia-400 text-white active:scale-95'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <GemIcon className="w-4 h-4" />
                <span>Use {reviveGemCost} Gems</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-950/75 border border-amber-400/70 p-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-100">
                Spend {coinContinueCost.toLocaleString()} Coins to revive?
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmCoinContinue(false)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canAffordCoins}
                  onClick={() => {
                    if (canAffordCoins) {
                      setConfirmCoinContinue(false);
                      onReviveWithCoins(coinContinueCost);
                    }
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm
                </button>
              </div>
            </div>
          )}

          {/* Double Coins Rewarded Ad */}
          {result.coins > 0 && (
            <button
              type="button"
              disabled={coinsDoubled}
              onClick={handleDoubleCoinsAd}
              className={`w-full min-h-[44px] flex items-center justify-center gap-2 py-2 rounded-xl font-extrabold text-xs border transition ${
                coinsDoubled
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-sky-900/70 hover:bg-sky-800 border-sky-400/60 text-sky-100'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>
                {coinsDoubled
                  ? `Coins Doubled (+${result.coins} Bonus Credited!)`
                  : `Watch Ad to Double Coins (+${result.coins.toLocaleString()} Bonus)`}
              </span>
            </button>
          )}

          {adNotice && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-950/70 border border-amber-500/50 p-2 text-[11px] text-amber-200 leading-snug">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{adNotice}</span>
            </div>
          )}
        </div>

        {/* C. End Run & Collect Rewards vs Play Again */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            type="button"
            onClick={onHome}
            className="min-h-[48px] flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs sm:text-sm active:scale-95 transition"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>End Run &amp; Collect</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="min-h-[48px] flex items-center justify-center gap-2 py-3 px-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg hover:brightness-110 active:scale-95 transition"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
