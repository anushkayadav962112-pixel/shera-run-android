import React from 'react';
import { Globe2, Play, Plus, Settings } from 'lucide-react';
import { WORLDS } from '../data/gameData';
import { getTodayKey } from '../services/storage';
import { ModalType, PlayerSaveData } from '../types/game';
import {
  CharactersLionIcon,
  ChestGameIcon,
  CoinIcon,
  CrownGameIcon,
  DailyRewardGameIcon,
  GemIcon,
  HoverboardGameIcon,
  LuckySpinGameIcon,
  MissionsGameIcon,
  SheraAvatarBadge,
  SheraLogoLockup,
  ShopAwningIcon,
  TicketGameIcon,
  TrophyGameIcon,
  WorldsCastleIcon,
} from './SheraBadges';

interface HomeScreenProps {
  save: PlayerSaveData;
  onPlay: () => void;
  onOpenModal: (modal: ModalType) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ save, onPlay, onOpenModal }) => {
  const today = getTodayKey();
  const canClaimDaily = save.lastDailyClaimDate !== today;
  const claimableMissions = save.missions.filter((m) => !m.claimed && m.progress >= m.target).length;
  const canSpin = save.freeSpinsAvailable > 0 || save.lastSpinDate !== today;
  const currentWorld = WORLDS.find((w) => w.id === save.selectedWorld) || WORLDS[0];
  const xpPct = Math.min(100, Math.round((save.xp / Math.max(1, save.xpToNext)) * 100));

  const leftButtons: {
    id: ModalType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'daily_reward',
      label: 'Daily Reward',
      icon: <DailyRewardGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
      badge: canClaimDaily ? '!' : undefined,
    },
    {
      id: 'lucky_spin',
      label: 'Lucky Spin',
      icon: <LuckySpinGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
      badge: canSpin ? '1' : undefined,
    },
    {
      id: 'free_coins',
      label: 'Free Coins',
      icon: <ChestGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
    },
    {
      id: 'missions',
      label: 'Missions',
      icon: <MissionsGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
      badge: claimableMissions > 0 ? claimableMissions : undefined,
    },
  ];

  const rightButtons: {
    id: ModalType;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    accent?: string;
  }[] = [
    {
      id: 'vip_pass',
      label: 'VIP Pass',
      icon: <CrownGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
      badge: save.vipActive ? 'ON' : undefined,
      accent: 'border-amber-300/80 bg-[#231908]/92',
    },
    {
      id: 'events',
      label: 'Events',
      icon: <TicketGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <TrophyGameIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
    },
    {
      id: 'starter_pack',
      label: 'Starter Pack',
      icon: <ChestGameIcon gem className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow" />,
      badge: save.starterPackPurchased ? undefined : 'SALE',
      accent: 'border-fuchsia-400/80 bg-[#1e1036]/92',
    },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between safe-area-frame">
      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onOpenModal('profile')}
          className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 bg-[#0c1633]/92 border-2 border-amber-400/75 rounded-2xl px-2 sm:px-3 py-1.5 shadow-[0_6px_22px_rgba(0,0,0,0.72)] hover:border-amber-200 transition active:scale-95 min-w-0"
        >
          <SheraAvatarBadge size="sm" />
          <div className="text-left pr-0.5 sm:pr-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-sm font-black text-white tracking-wide max-w-[78px] sm:max-w-[140px] truncate">
                {save.playerName}
              </span>
              {save.vipActive && (
                <span className="px-1 py-0.5 text-[9px] font-black bg-amber-400 text-slate-950 rounded">
                  VIP
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-300 tabular-nums shrink-0">Lv. {save.playerLevel}</span>
              <div className="w-11 sm:w-22 h-2 bg-slate-900 rounded-full overflow-hidden border border-amber-400/40">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400 transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>
        </button>

        {/* Center Crowned SHERA RUN Logo */}
        <div className="hidden md:flex flex-col items-center -mt-1">
          <SheraLogoLockup />
        </div>

        {/* Top-Right Currency Pills + Settings */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenModal('shop')}
            className="flex items-center gap-1 sm:gap-2 bg-[#0c1633]/92 border-2 border-amber-400/75 rounded-full pl-2 sm:pl-2.5 pr-1.5 py-1.5 min-h-[44px] shadow-lg hover:border-amber-200 active:scale-95 transition"
          >
            <CoinIcon className="w-4 h-4 sm:w-6 sm:h-6" />
            <span className="text-[11px] sm:text-base font-black text-amber-100 tabular-nums">
              {save.coins.toLocaleString()}
            </span>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 border border-white/50 flex items-center justify-center text-white shadow">
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('shop')}
            className="flex items-center gap-1 sm:gap-2 bg-[#0c1633]/92 border-2 border-fuchsia-400/75 rounded-full pl-2 sm:pl-2.5 pr-1.5 py-1.5 min-h-[44px] shadow-lg hover:border-fuchsia-200 active:scale-95 transition"
          >
            <GemIcon className="w-4 h-4 sm:w-6 sm:h-6" />
            <span className="text-[11px] sm:text-base font-black text-fuchsia-100 tabular-nums">
              {save.gems.toLocaleString()}
            </span>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 border border-white/50 flex items-center justify-center text-white shadow">
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
            </span>
          </button>

          <button
            type="button"
            aria-label="Settings"
            onClick={() => onOpenModal('settings')}
            className="w-11 h-11 rounded-2xl bg-[#0c1633]/92 border-2 border-sky-400/60 flex items-center justify-center text-white hover:border-amber-300 hover:text-amber-300 shadow-lg active:scale-95 transition shrink-0"
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Logo */}
      <div className="md:hidden flex justify-center -mt-1">
        <SheraLogoLockup compact />
      </div>

      {/* MIDDLE RAILS: Bold Jewel-Beveled Mobile Game Buttons */}
      <div className="flex-1 flex items-center justify-between my-1">
        <div className="pointer-events-auto flex flex-col gap-2 sm:gap-3">
          {leftButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onOpenModal(btn.id)}
              className="relative w-[82px] sm:w-[98px] py-2 sm:py-2.5 px-1.5 rounded-2xl bg-gradient-to-b from-[#172857]/95 to-[#0b132b]/95 border-2 border-sky-300/70 shadow-[0_6px_18px_rgba(0,0,0,0.75)] flex flex-col items-center gap-1 hover:border-amber-300 hover:-translate-y-0.5 active:scale-95 transition"
            >
              {btn.badge !== undefined && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-2 border-white text-[11px] font-black text-white flex items-center justify-center shadow-md">
                  {btn.badge}
                </span>
              )}
              {btn.icon}
              <span className="text-[11px] sm:text-xs font-extrabold text-white drop-shadow leading-tight text-center">
                {btn.label}
              </span>
            </button>
          ))}
        </div>

        {/* Center Unobstructed Space for 3D Shera on Royal Golden Throne */}
        <div className="flex-1" />

        <div className="pointer-events-auto flex flex-col gap-2 sm:gap-3">
          {rightButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onOpenModal(btn.id)}
              className={`relative w-[82px] sm:w-[98px] py-2 sm:py-2.5 px-1.5 rounded-2xl border-2 shadow-[0_6px_18px_rgba(0,0,0,0.75)] flex flex-col items-center gap-1 hover:border-amber-200 hover:-translate-y-0.5 active:scale-95 transition ${
                btn.accent || 'bg-gradient-to-b from-[#172857]/95 to-[#0b132b]/95 border-amber-300/75'
              }`}
            >
              {btn.badge && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-500 border-2 border-white text-[10px] font-black text-white shadow-md">
                  {btn.badge}
                </span>
              )}
              {btn.icon}
              <span className="text-[11px] sm:text-xs font-extrabold text-white drop-shadow leading-tight text-center">
                {btn.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM CLUSTER: Kingdom Pill, Hero PLAY CTA, and Large 4-Tab Bar */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenModal('worlds')}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-[#0b1533]/94 border-2 border-amber-400/75 text-xs sm:text-sm font-extrabold text-amber-200 shadow-lg hover:border-amber-200 transition"
        >
          <Globe2 className="w-4 h-4 text-sky-300 shrink-0" />
          <span>{currentWorld.name}</span>
          <span className="text-slate-400">•</span>
          <span className="text-white tabular-nums">Stage {save.selectedGameLevel}/150</span>
          {save.worldRotationEnabled && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-[10px] font-black text-sky-200">
              ENDLESS TOUR
            </span>
          )}
        </button>

        {/* Heroic Beveled PLAY CTA */}
        <button
          type="button"
          onClick={onPlay}
          className="pointer-events-auto group relative flex items-center justify-center gap-3 w-[256px] sm:w-[310px] min-h-[60px] sm:h-[68px] rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-500 to-orange-600 border-[3px] border-sky-200 shadow-[0_0_26px_rgba(245,158,11,0.65),0_10px_24px_rgba(0,0,0,0.8)] hover:brightness-110 active:scale-95 transition"
        >
          <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          <span className="font-display text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]">
            PLAY
          </span>
        </button>

        {/* Bottom 4 Prominent Navigation Tabs */}
        <div className="pointer-events-auto grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-[580px] bg-gradient-to-b from-[#162552]/96 to-[#091128]/98 border-2 border-amber-400/80 rounded-2xl p-2 shadow-[0_10px_28px_rgba(0,0,0,0.85)]">
          <button
            type="button"
            onClick={() => onOpenModal('characters')}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#101c42] hover:bg-[#1a2c61] border-2 border-amber-400/55 hover:border-amber-300 transition active:scale-95"
          >
            <CharactersLionIcon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow" />
            <span className="text-[11px] sm:text-xs font-black text-white mt-1">Characters</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('hoverboards')}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#101c42] hover:bg-[#1a2c61] border-2 border-sky-400/55 hover:border-sky-300 transition active:scale-95"
          >
            <HoverboardGameIcon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow" />
            <span className="text-[11px] sm:text-xs font-black text-white mt-1">Hoverboards</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('worlds')}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#101c42] hover:bg-[#1a2c61] border-2 border-emerald-400/55 hover:border-emerald-300 transition active:scale-95"
          >
            <WorldsCastleIcon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow" />
            <span className="text-[11px] sm:text-xs font-black text-white mt-1">Worlds</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('shop')}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#101c42] hover:bg-[#1a2c61] border-2 border-fuchsia-400/55 hover:border-fuchsia-300 transition active:scale-95"
          >
            <ShopAwningIcon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow" />
            <span className="text-[11px] sm:text-xs font-black text-white mt-1">Shop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
