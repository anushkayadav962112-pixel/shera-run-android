import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Crown,
  Gift,
  Music,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  Trophy,
  Tv,
  Volume2,
} from 'lucide-react';
import {
  ACHIEVEMENTS_DATA,
  BASE_LEADERBOARD,
  DAILY_REWARDS,
  SPIN_PRIZES,
  WORLDS,
} from '../data/gameData';
import { ADMOB_TEST_AD_UNITS, MonetizationService } from '../services/monetization';
import { getTodayKey, grantXp } from '../services/storage';
import { LeaderboardEntry, ModalType, PlayerSaveData, WorldId } from '../types/game';
import { ModalShell } from './ProgressionModals';
import { CoinIcon, GemIcon } from './SheraBadges';

interface FeatureModalsProps {
  modal: ModalType;
  save: PlayerSaveData;
  onClose: () => void;
  onOpenModal: (m: ModalType) => void;
  onUpdateSave: (updater: (prev: PlayerSaveData) => PlayerSaveData) => void;
  onSelectWorldAndPlay: (worldId: WorldId) => void;
  onResetSave: () => void;
}

export const FeatureModals: React.FC<FeatureModalsProps> = ({
  modal,
  save,
  onClose,
  onOpenModal,
  onUpdateSave,
  onSelectWorldAndPlay,
  onResetSave,
}) => {
  const [spinDeg, setSpinDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const [missionTab, setMissionTab] = useState<'missions' | 'achievements'>('missions');
  const [nameInput, setNameInput] = useState(save.playerName);

  const today = getTodayKey();

  if (modal === 'daily_reward') {
    const canClaim = save.lastDailyClaimDate !== today;
    const currentDay = ((save.dailyRewardDay - 1) % 7) + 1;

    return (
      <ModalShell title="ROYAL DAILY REWARDS" subtitle="7-Day Sovereign Login Calendar" onClose={onClose}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DAILY_REWARDS.map((r) => {
            const isPast = r.day < currentDay || (r.day === currentDay && !canClaim);
            const isToday = r.day === currentDay && canClaim;

            return (
              <div
                key={r.day}
                className={`rounded-2xl p-3 border-2 text-center flex flex-col items-center justify-between ${
                  isToday
                    ? 'bg-amber-950/75 border-amber-300 ring-2 ring-amber-400/50'
                    : isPast
                    ? 'bg-emerald-950/45 border-emerald-500/50 opacity-75'
                    : 'bg-slate-900/90 border-slate-700'
                }`}
              >
                <span className="text-[11px] font-black text-amber-300">DAY {r.day}</span>
                <div className="my-2">
                  {r.coins > 0 ? <CoinIcon className="w-8 h-8 mx-auto" /> : <GemIcon className="w-8 h-8 mx-auto" />}
                </div>
                <div className="text-xs font-extrabold text-white">{r.label}</div>
                {r.powerUp && (
                  <div className="text-[10px] font-bold text-sky-300 mt-0.5">+1 {r.powerUp}</div>
                )}
                {isPast && (
                  <span className="mt-2 text-[10px] font-black text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
          <button
            type="button"
            disabled={!canClaim}
            onClick={() => {
              const reward = DAILY_REWARDS[currentDay - 1];
              onUpdateSave((s) => ({
                ...s,
                coins: s.coins + reward.coins,
                gems: s.gems + reward.gems,
                powerUpInventory: reward.powerUp
                  ? {
                      ...s.powerUpInventory,
                      [reward.powerUp]: (s.powerUpInventory[reward.powerUp] || 0) + 1,
                    }
                  : s.powerUpInventory,
                lastDailyClaimDate: today,
                dailyRewardDay: currentDay >= 7 ? 1 : currentDay + 1,
              }));
            }}
            className={`min-h-[44px] w-full py-3.5 rounded-2xl font-black text-sm transition ${
              canClaim
                ? 'bg-gradient-to-b from-amber-300 to-amber-600 text-slate-950 shadow-lg hover:brightness-110'
                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {canClaim ? `CLAIM DAY ${currentDay}` : 'CLAIMED TODAY'}
          </button>

          <button
            type="button"
            disabled={!canClaim}
            onClick={async () => {
              if (!canClaim) return;
              const res = await MonetizationService.requestRewardedAd('double_daily_reward');
              if (res.status === 'rewarded') {
                const reward = DAILY_REWARDS[currentDay - 1];
                onUpdateSave((s) => ({
                  ...s,
                  coins: s.coins + reward.coins * 2,
                  gems: s.gems + reward.gems * 2,
                  powerUpInventory: reward.powerUp
                    ? {
                        ...s.powerUpInventory,
                        [reward.powerUp]: (s.powerUpInventory[reward.powerUp] || 0) + 2,
                      }
                    : s.powerUpInventory,
                  lastDailyClaimDate: today,
                  dailyRewardDay: currentDay >= 7 ? 1 : currentDay + 1,
                }));
              }
              setAdNotice(res.message);
            }}
            className={`min-h-[44px] w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
              canClaim
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>{canClaim ? 'WATCH AD FOR 2X REWARD' : 'COME BACK TOMORROW'}</span>
          </button>
        </div>

        {adNotice && (
          <div className="mt-3 rounded-xl bg-amber-950/70 border border-amber-500/50 p-2.5 text-xs text-amber-200">
            {adNotice}
          </div>
        )}
      </ModalShell>
    );
  }

  if (modal === 'lucky_spin') {
    const hasFreeSpin = save.freeSpinsAvailable > 0 || save.lastSpinDate !== today;
    const gemSpinCost = 25;

    const triggerSpin = (useGems: boolean) => {
      if (spinning) return;
      if (useGems && save.gems < gemSpinCost) return;

      const prizeIdx = Math.floor(Math.random() * SPIN_PRIZES.length);
      const prize = SPIN_PRIZES[prizeIdx];
      const segmentAngle = 360 / SPIN_PRIZES.length;
      const targetDeg = spinDeg + 1440 + (360 - prizeIdx * segmentAngle);

      setSpinning(true);
      setSpinResult(null);
      setSpinDeg(targetDeg);

      window.setTimeout(() => {
        setSpinning(false);
        setSpinResult(`Won ${prize.label}!`);
        onUpdateSave((s) => ({
          ...s,
          coins: s.coins + prize.coins,
          gems: s.gems - (useGems ? gemSpinCost : 0) + prize.gems,
          powerUpInventory: prize.powerUp
            ? {
                ...s.powerUpInventory,
                [prize.powerUp]: (s.powerUpInventory[prize.powerUp] || 0) + (prize.qty || 1),
              }
            : s.powerUpInventory,
          lastSpinDate: today,
          freeSpinsAvailable: useGems ? s.freeSpinsAvailable : Math.max(0, s.freeSpinsAvailable - 1),
        }));
      }, 2400);
    };

    return (
      <ModalShell title="ROYAL LUCKY SPIN" subtitle="Spin the Wheel of Five Kingdoms" onClose={onClose}>
        <div className="flex flex-col items-center">
          <div className="relative w-60 h-60 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Top Pointer */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow" />

            {/* Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)] relative overflow-hidden"
              style={{
                transform: `rotate(${spinDeg}deg)`,
                transition: spinning ? 'transform 2.3s cubic-bezier(0.12, 0.85, 0.22, 1)' : 'none',
                background:
                  'conic-gradient(#f59e0b 0deg 45deg, #a855f7 45deg 90deg, #eab308 90deg 135deg, #3b82f6 135deg 180deg, #c026d3 180deg 225deg, #ef4444 225deg 270deg, #f97316 270deg 315deg, #06b6d4 315deg 360deg)',
              }}
            >
              {SPIN_PRIZES.map((p, idx) => (
                <div
                  key={p.id}
                  className="absolute inset-0 flex justify-center pt-4"
                  style={{ transform: `rotate(${idx * 45 + 22.5}deg)` }}
                >
                  <span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {p.label}
                  </span>
                </div>
              ))}
              <div className="absolute inset-[38%] rounded-full bg-[#0b132b] border-4 border-amber-300 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
            </div>
          </div>

          {spinResult && (
            <div className="mt-4 px-4 py-1.5 rounded-full bg-emerald-600 text-white font-black text-sm">
              {spinResult}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 w-full mt-5">
            <button
              type="button"
              disabled={!hasFreeSpin || spinning}
              onClick={() => triggerSpin(false)}
              className={`py-3 rounded-2xl font-black text-xs sm:text-sm ${
                hasFreeSpin && !spinning
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {hasFreeSpin ? 'FREE DAILY SPIN' : 'FREE SPIN USED'}
            </button>

            <button
              type="button"
              disabled={save.gems < gemSpinCost || spinning}
              onClick={() => triggerSpin(true)}
              className={`py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 ${
                save.gems >= gemSpinCost && !spinning
                  ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <GemIcon className="w-4 h-4" />
              <span>SPIN ({gemSpinCost} GEMS)</span>
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  if (modal === 'free_coins') {
    const canClaimGift = save.lastDailyClaimDate !== today;
    return (
      <ModalShell title="FREE TREASURY COINS" subtitle="Daily Chest & Rewarded Ad Slot" onClose={onClose}>
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900/90 border border-amber-400/50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Gift className="w-9 h-9 text-amber-300 shrink-0" />
              <div>
                <h3 className="font-black text-white text-sm">Daily Royal Tribute</h3>
                <p className="text-xs text-slate-400">Open your Daily Reward Calendar to claim today&apos;s tribute.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenModal('daily_reward')}
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shrink-0"
            >
              {canClaimGift ? 'Open Now' : 'View Calendar'}
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/90 border border-emerald-400/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Tv className="w-9 h-9 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-black text-white text-sm">Rewarded Ad Bonus (+1,000 Coins)</h3>
                  <p className="text-xs text-slate-400">
                    Connects to Google AdMob Rewarded Ad SDK on Android APK builds.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await MonetizationService.requestRewardedAd('free_coins');
                  if (res.status === 'rewarded') {
                    onUpdateSave((s) => ({ ...s, coins: s.coins + 1000 }));
                  }
                  setAdNotice(res.message);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shrink-0"
              >
                Watch Ad
              </button>
            </div>
            {adNotice && (
              <div className="mt-3 rounded-xl bg-amber-950/70 border border-amber-500/50 p-2.5 text-xs text-amber-200">
                {adNotice}
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  if (modal === 'missions') {
    const getAchievementProgress = (metric: string): number => {
      switch (metric) {
        case 'totalDistance':
          return save.totalDistance;
        case 'totalCoins':
          return save.totalCoins;
        case 'highScore':
          return save.highScore;
        case 'worldsUnlocked':
          return save.unlockedWorlds.length;
        case 'playerLevel':
          return save.playerLevel;
        default:
          return save.totalRuns;
      }
    };

    return (
      <ModalShell title="MISSIONS & ACHIEVEMENTS" subtitle="Complete Goals for Coins, Gems & XP" onClose={onClose}>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMissionTab('missions')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black ${
              missionTab === 'missions' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            Daily & Weekly
          </button>
          <button
            type="button"
            onClick={() => setMissionTab('achievements')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black ${
              missionTab === 'achievements' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            Achievements
          </button>
        </div>

        {missionTab === 'missions' ? (
          <div className="space-y-2.5">
            {save.missions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              const ready = !m.claimed && m.progress >= m.target;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          m.category === 'daily' ? 'bg-sky-700 text-white' : 'bg-purple-700 text-white'
                        }`}
                      >
                        {m.category}
                      </span>
                      <h4 className="font-black text-white text-sm">{m.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 tabular-nums">
                        {Math.min(m.progress, m.target)}/{m.target}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() =>
                        onUpdateSave((s) => {
                          const xpRes = grantXp(s, m.rewardXp);
                          return {
                            ...s,
                            coins: s.coins + m.rewardCoins,
                            gems: s.gems + m.rewardGems,
                            playerLevel: xpRes.playerLevel,
                            xp: xpRes.xp,
                            xpToNext: xpRes.xpToNext,
                            missions: s.missions.map((item) =>
                              item.id === m.id ? { ...item, claimed: true } : item
                            ),
                          };
                        })
                      }
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl font-black text-xs shrink-0 ${
                        m.claimed
                          ? 'bg-slate-800 text-emerald-400'
                          : ready
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {m.claimed ? 'Claimed' : ready ? 'CLAIM' : `+${m.rewardCoins}c`}
                    </button>

                    {ready && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await MonetizationService.requestRewardedAd('double_mission_reward');
                          if (res.status === 'rewarded') {
                            onUpdateSave((s) => {
                              const xpRes = grantXp(s, m.rewardXp * 2);
                              return {
                                ...s,
                                coins: s.coins + m.rewardCoins * 2,
                                gems: s.gems + m.rewardGems * 2,
                                playerLevel: xpRes.playerLevel,
                                xp: xpRes.xp,
                                xpToNext: xpRes.xpToNext,
                                missions: s.missions.map((item) =>
                                  item.id === m.id ? { ...item, claimed: true } : item
                                ),
                              };
                            });
                          }
                          setAdNotice(res.message);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-black text-[10px] flex items-center justify-center gap-1"
                      >
                        <Tv className="w-3 h-3" /> 2x Ad
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {adNotice && (
              <div className="mt-2 rounded-xl bg-amber-950/70 border border-amber-500/50 p-2.5 text-xs text-amber-200">
                {adNotice}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {ACHIEVEMENTS_DATA.map((a) => {
              const prog = getAchievementProgress(a.metric);
              const claimed = save.claimedAchievements.includes(a.id);
              const ready = !claimed && prog >= a.target;
              return (
                <div
                  key={a.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-300" />
                      <h4 className="font-black text-white text-sm">{a.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                    <p className="text-[11px] font-bold text-amber-200 mt-1 tabular-nums">
                      Progress: {Math.min(prog, a.target).toLocaleString()} / {a.target.toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() =>
                      onUpdateSave((s) => ({
                        ...s,
                        coins: s.coins + a.rewardCoins,
                        gems: s.gems + a.rewardGems,
                        claimedAchievements: [...s.claimedAchievements, a.id],
                      }))
                    }
                    className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 ${
                      claimed
                        ? 'bg-slate-800 text-emerald-400'
                        : ready
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {claimed ? 'Done' : ready ? 'CLAIM' : `+${a.rewardGems}g`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ModalShell>
    );
  }

  if (modal === 'vip_pass' || modal === 'starter_pack') {
    const isVip = modal === 'vip_pass';
    const alreadyOwned = isVip ? save.vipActive : save.starterPackPurchased;
    const gemUnlockCost = isVip ? 120 : 60;

    return (
      <ModalShell
        title={isVip ? 'ROYAL VIP CROWN PASS' : 'ROYAL STARTER PACK (SALE)'}
        subtitle={isVip ? '2x XP, Daily Bonus & Ad-Free Experience' : '15,000 Coins + 150 Gems + Starter Boosts'}
        onClose={onClose}
      >
        <div className="rounded-2xl bg-gradient-to-br from-[#192854] to-[#0b132b] border border-amber-400/60 p-5 text-center">
          <Crown className="w-12 h-12 text-amber-300 mx-auto mb-2" />
          <h3 className="text-xl font-black text-white">
            {isVip ? 'Become a Royal VIP Lion' : '80% OFF Royal Starter Bundle'}
          </h3>
          <p className="text-xs text-slate-300 mt-1.5 max-w-md mx-auto">
            {isVip
              ? 'Grants permanent VIP Crown badge, +5,000 Coins, +100 Gems, 2x Run XP, and disables interstitial ads.'
              : 'Instant +15,000 Gold Coins, +150 Gems, and +3 Magnet, +3 Shield, +3 Rocket Boosts!'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              disabled={alreadyOwned || save.gems < gemUnlockCost}
              onClick={() =>
                onUpdateSave((s) => ({
                  ...s,
                  gems: s.gems - gemUnlockCost + (isVip ? 100 : 150),
                  coins: s.coins + (isVip ? 5000 : 15000),
                  vipActive: isVip ? true : s.vipActive,
                  removeAds: isVip ? true : s.removeAds,
                  starterPackPurchased: !isVip ? true : s.starterPackPurchased,
                  purchaseHistory: [
                    ...s.purchaseHistory,
                    {
                      sku: isVip ? 'shera_vip_monthly' : 'shera_starter_pack',
                      title: isVip ? 'Royal VIP Crown Pass' : 'Royal Starter Pack',
                      purchasedAt: new Date().toISOString(),
                      source: 'gems',
                    },
                  ],
                  powerUpInventory: !isVip
                    ? {
                        ...s.powerUpInventory,
                        magnet: s.powerUpInventory.magnet + 3,
                        shield: s.powerUpInventory.shield + 3,
                        rocket: s.powerUpInventory.rocket + 3,
                      }
                    : s.powerUpInventory,
                }))
              }
              className={`min-h-[44px] py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 ${
                alreadyOwned
                  ? 'bg-emerald-900/60 text-emerald-300'
                  : save.gems >= gemUnlockCost
                  ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <GemIcon className="w-4 h-4" />
              <span>{alreadyOwned ? 'ACTIVE / CLAIMED' : `Unlock with ${gemUnlockCost} Gems`}</span>
            </button>

            <button
              type="button"
              disabled={alreadyOwned}
              onClick={async () => {
                const sku = isVip ? 'shera_vip_monthly' : 'shera_starter_pack';
                const res = await MonetizationService.purchaseIap(sku);
                if (res.status === 'purchased') {
                  onUpdateSave((s) => ({
                    ...s,
                    coins: s.coins + (isVip ? 5000 : 15000),
                    gems: s.gems + (isVip ? 100 : 150),
                    vipActive: isVip ? true : s.vipActive,
                    removeAds: isVip ? true : s.removeAds,
                    starterPackPurchased: !isVip ? true : s.starterPackPurchased,
                    purchaseHistory: [
                      ...s.purchaseHistory,
                      {
                        sku,
                        title: isVip ? 'Royal VIP Crown Pass' : 'Royal Starter Pack',
                        purchasedAt: new Date().toISOString(),
                        source: 'google_play',
                        transactionId: res.transactionId,
                      },
                    ],
                  }));
                }
                setAdNotice(res.message);
              }}
              className="min-h-[44px] py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
            >
              {alreadyOwned ? 'OWNED' : isVip ? 'Store IAP ($4.99)' : 'Store IAP ($2.99)'}
            </button>
          </div>
          {adNotice && <p className="mt-3 text-xs text-amber-200">{adNotice}</p>}
        </div>
      </ModalShell>
    );
  }

  if (modal === 'events') {
    const events: { title: string; worldId: WorldId; reward: string; desc: string }[] = [
      {
        title: 'Cloud Citadel Cup',
        worldId: 'clouds',
        reward: '2x Score Bonus',
        desc: 'Sprint across sunlit sky bridges, waterfalls & cherry blossoms.',
      },
      {
        title: 'Volcanic Magma Rush',
        worldId: 'lava',
        reward: '+500 Bonus Coins',
        desc: 'Brave swinging molten wrecking balls and blazing braziers in the Lava Kingdom.',
      },
      {
        title: 'Crystal Express Challenge',
        worldId: 'crystal',
        reward: '+15 Bonus Gems',
        desc: 'Weave between speeding Royal Express locomotives amidst amethyst crystals!',
      },
      {
        title: 'Ancient Dragon Trial',
        worldId: 'dragon',
        reward: '+20 Bonus Gems',
        desc: 'Slide beneath swooping wyverns along ancient stone temple bridges.',
      },
      {
        title: 'Frozen Kingdom Grand Prix',
        worldId: 'frozen',
        reward: '+1,500 Bonus Coins',
        desc: 'Outrun Frost Express trains past glowing ice castles and snowy mountain peaks.',
      },
    ];

    return (
      <ModalShell title="ROYAL KINGDOM EVENTS" subtitle="Featured Kingdom Challenges" onClose={onClose}>
        <div className="space-y-3">
          {events.map((ev) => {
            const unlocked = save.unlockedWorlds.includes(ev.worldId);
            const w = WORLDS.find((x) => x.id === ev.worldId)!;
            return (
              <div
                key={ev.title}
                className="rounded-2xl bg-slate-900/90 border border-slate-700 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-orange-400" />
                    <h3 className="font-black text-white text-sm">{ev.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{ev.desc}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                    {w.name} · {ev.reward}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (unlocked) {
                      onSelectWorldAndPlay(ev.worldId);
                    } else {
                      onOpenModal('worlds');
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0"
                >
                  {unlocked ? 'PLAY' : 'UNLOCK'}
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  if (modal === 'leaderboard') {
    const combined: Omit<LeaderboardEntry, 'rank'>[] = [
      ...BASE_LEADERBOARD,
      {
        name: save.playerName,
        level: save.playerLevel,
        score: save.highScore,
        world: save.selectedWorld,
        isPlayer: true,
      },
    ].sort((a, b) => b.score - a.score);

    return (
      <ModalShell title="ROYAL LEADERBOARD" subtitle="Top Runners Across the Five Kingdoms" onClose={onClose}>
        <div className="space-y-2">
          {combined.map((entry, idx) => (
            <div
              key={`${entry.name}-${idx}`}
              className={`rounded-2xl px-4 py-3 border flex items-center justify-between ${
                entry.isPlayer
                  ? 'bg-sky-950/85 border-amber-400'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950'
                      : idx === 1
                      ? 'bg-slate-300 text-slate-950'
                      : idx === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {idx + 1}
                </span>
                <div>
                  <div className="font-black text-white text-sm flex items-center gap-1.5">
                    <span>{entry.name}</span>
                    {entry.isPlayer && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Lv. {entry.level} · {WORLDS.find((w) => w.id === entry.world)?.name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-black text-amber-300 text-sm tabular-nums">
                <Trophy className="w-4 h-4" />
                <span>{entry.score.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (modal === 'profile') {
    return (
      <ModalShell title="PLAYER PROFILE" subtitle="Royal Career Statistics" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/90 border border-slate-700 p-4">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Sovereign Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={18}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-600 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = nameInput.trim() || 'SheraPlayer';
                  onUpdateSave((s) => ({ ...s, playerName: clean }));
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs"
              >
                Save Name
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { label: 'Best Score', val: save.highScore.toLocaleString() },
              { label: 'Highest Stage', val: `${save.highestGameLevel} / 150` },
              { label: 'Total Distance', val: `${save.totalDistance.toLocaleString()}m` },
              { label: 'Total Coins', val: save.totalCoins.toLocaleString() },
              { label: 'Total Runs', val: save.totalRuns.toLocaleString() },
              { label: 'Worlds Unlocked', val: `${save.unlockedWorlds.length} / 5` },
            ].map((st) => (
              <div key={st.label} className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">{st.label}</div>
                <div className="text-base font-black text-amber-300 mt-0.5 tabular-nums">{st.val}</div>
              </div>
            ))}
          </div>
        </div>
      </ModalShell>
    );
  }

  if (modal === 'settings') {
    return (
      <ModalShell title="SETTINGS & PACKAGING" subtitle="Audio, Controls, Graphics & Android Build" onClose={onClose}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUpdateSave((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
              className={`p-3 rounded-2xl border font-bold text-xs flex items-center justify-between ${
                save.soundEnabled ? 'bg-emerald-950/60 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Sound FX</span>
              <span>{save.soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSave((s) => ({ ...s, musicEnabled: !s.musicEnabled }))}
              className={`p-3 rounded-2xl border font-bold text-xs flex items-center justify-between ${
                save.musicEnabled ? 'bg-sky-950/60 border-sky-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2"><Music className="w-4 h-4" /> Music</span>
              <span>{save.musicEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSave((s) => ({ ...s, showTouchControls: !s.showTouchControls }))}
            className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" /> On-Screen Touch Buttons (Accessibility)
            </span>
            <span className={save.showTouchControls ? 'text-emerald-400' : 'text-slate-400'}>
              {save.showTouchControls ? 'ENABLED' : 'SWIPE ONLY'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSave((s) => ({
                ...s,
                graphicsQuality:
                  s.graphicsQuality === 'low'
                    ? 'medium'
                    : s.graphicsQuality === 'medium'
                    ? 'high'
                    : 'low',
              }))
            }
            className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white"
          >
            <span>3D Rendering Quality</span>
            <span className="text-amber-300 uppercase">
              {save.graphicsQuality === 'high'
                ? 'HIGH (2X + ULTRA SHADOWS)'
                : save.graphicsQuality === 'medium'
                ? 'MEDIUM (SHADOWS)'
                : 'LOW (BATTERY SAVER)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSave((s) => ({ ...s, worldRotationEnabled: !s.worldRotationEnabled }))}
            className="w-full min-h-[44px] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white"
          >
            <span>Endless 4-World Rotation (Every 2 Min)</span>
            <span className={save.worldRotationEnabled ? 'text-emerald-400' : 'text-slate-400'}>
              {save.worldRotationEnabled ? 'ENABLED' : 'SINGLE REALM'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSave((s) => ({
                ...s,
                adsConsentStatus:
                  s.adsConsentStatus === 'personalized' ? 'non_personalized' : 'personalized',
              }))
            }
            className="w-full min-h-[44px] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white"
          >
            <span>Privacy &amp; AdMob Consent (UMP)</span>
            <span className="text-sky-300 uppercase">
              {save.adsConsentStatus === 'personalized' ? 'PERSONALIZED' : 'NON-PERSONALIZED'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSave((s) => ({ ...s, adTestBannerEnabled: !s.adTestBannerEnabled }))}
            className="w-full min-h-[44px] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white"
          >
            <span>AdMob Banner Layout Preview (Dev)</span>
            <span className={save.adTestBannerEnabled ? 'text-amber-300' : 'text-slate-400'}>
              {save.adTestBannerEnabled ? 'VISIBLE' : 'HIDDEN'}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const res = await MonetizationService.restorePurchases();
              if (res.status === 'restored' && res.restoredSkus.length > 0) {
                onUpdateSave((s) => ({
                  ...s,
                  removeAds:
                    s.removeAds ||
                    res.restoredSkus.includes('shera_remove_ads') ||
                    res.restoredSkus.includes('shera_vip_monthly'),
                  vipActive: s.vipActive || res.restoredSkus.includes('shera_vip_monthly'),
                  starterPackPurchased:
                    s.starterPackPurchased || res.restoredSkus.includes('shera_starter_pack'),
                }));
              }
              setAdNotice(res.message);
            }}
            className="w-full min-h-[44px] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs font-bold text-white hover:border-amber-300"
          >
            <span>Restore Google Play Purchases</span>
            <span className="text-amber-300">
              {save.removeAds || save.vipActive ? 'AD-FREE ACTIVE' : 'CHECK'}
            </span>
          </button>

          {adNotice && (
            <div className="rounded-xl bg-amber-950/70 border border-amber-500/50 p-2.5 text-xs text-amber-200">
              {adNotice}
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpenModal('apk_guide')}
            className="w-full min-h-[44px] p-3.5 rounded-2xl bg-sky-950/70 border border-sky-400/60 flex items-center justify-between text-xs font-extrabold text-sky-200 hover:border-sky-300"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Android APK &amp; Play Store Readiness Checklist
            </span>
            <span>OPEN →</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onResetSave();
              onClose();
            }}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold text-xs"
          >
            Reset Local Save Progress
          </button>
        </div>
      </ModalShell>
    );
  }

  if (modal === 'apk_guide') {
    return (
      <ModalShell
        title="ANDROID APK & PLAY STORE GUIDE"
        subtitle="Capacitor Packaging, Official AdMob Test IDs & Play Billing Bridge"
        onClose={onClose}
      >
        <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
          <div className="rounded-2xl bg-slate-900 border border-slate-700 p-3.5">
            <h4 className="font-black text-amber-300 mb-1">1. Build Web Bundle &amp; Wrap with Capacitor</h4>
            <code className="block bg-slate-950 p-2 rounded text-[11px] text-emerald-300 font-mono">
              npm run build &amp;&amp; npx cap init &quot;SHERA RUN&quot; com.shera.run --web-dir=dist &amp;&amp; npx cap add android &amp;&amp; npx cap sync android
            </code>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-700 p-3.5">
            <h4 className="font-black text-amber-300 mb-1">2. Configured Official Google AdMob Android Test Unit IDs</h4>
            <ul className="space-y-1 font-mono text-[11px] text-sky-200">
              <li>App ID: {ADMOB_TEST_AD_UNITS.androidAppId}</li>
              <li>Banner: {ADMOB_TEST_AD_UNITS.androidBanner}</li>
              <li>Interstitial: {ADMOB_TEST_AD_UNITS.androidInterstitial}</li>
              <li>Rewarded: {ADMOB_TEST_AD_UNITS.androidRewarded}</li>
            </ul>
            <p className="mt-2 text-slate-300">
              Attach <code>window.SheraAndroidAdBridge</code> &amp; <code>window.SheraAndroidBillingBridge</code> in native Android code. Swap test IDs for production Play Console IDs before release signing.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-700 p-3.5">
            <h4 className="font-black text-amber-300 mb-1">3. Play Store Production Requirements (Native Step)</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              <li>Portrait orientation locked in AndroidManifest.xml (<code>screenOrientation=&quot;portrait&quot;</code>)</li>
              <li>Signed AAB generated with Play App Signing keystore (<code>./gradlew bundleRelease</code>)</li>
              <li>Google Play Billing v6+ SKUs configured in Play Console + UMP consent SDK</li>
              <li>Adaptive Launcher Icon (512×512 PNG) + Feature Graphic (1024×500) + Privacy Policy URL</li>
            </ul>
          </div>
        </div>
      </ModalShell>
    );
  }

  return null;
};
