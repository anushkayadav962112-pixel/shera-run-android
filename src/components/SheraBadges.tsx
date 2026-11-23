import React, { useId } from 'react';
import { Crown, FastForward, Flame, Magnet, Rocket, Shield, Sparkles, Zap } from 'lucide-react';
import { PowerUpType } from '../types/game';

export const SheraLogoLockup: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const uid = useId().replace(/:/g, '');
  const goldId = `goldGrad_${uid}`;
  const wingId = `wingGrad_${uid}`;

  return (
    <div className={`flex flex-col items-center select-none pointer-events-none ${compact ? 'scale-90' : ''}`}>
      <svg
        viewBox="0 0 320 124"
        className="w-[230px] sm:w-[300px] h-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.88)]"
        aria-label="SHERA RUN"
      >
        <defs>
          <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff9d6" />
            <stop offset="45%" stopColor="#ffd13b" />
            <stop offset="100%" stopColor="#c46b00" />
          </linearGradient>
          <linearGradient id={wingId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe580" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        <path d="M58 58 L10 40 L32 62 L14 69 L48 77 Z" fill={`url(#${wingId})`} stroke="#451a03" strokeWidth="2.5" />
        <path d="M262 58 L310 40 L288 62 L306 69 L272 77 Z" fill={`url(#${wingId})`} stroke="#451a03" strokeWidth="2.5" />

        <path
          d="M116 34 L110 13 L135 26 L160 5 L185 26 L210 13 L204 34 Z"
          fill={`url(#${goldId})`}
          stroke="#451a03"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="160" cy="6" r="4.5" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5" />
        <circle cx="110" cy="13" r="3.5" fill="#38bdf8" />
        <circle cx="210" cy="13" r="3.5" fill="#38bdf8" />

        <text
          x="160"
          y="74"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontSize="50"
          fontWeight="900"
          letterSpacing="2"
          fill={`url(#${goldId})`}
          stroke="#2a1202"
          strokeWidth="7"
          paintOrder="stroke"
        >
          SHERA
        </text>

        <text
          x="160"
          y="112"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontSize="38"
          fontWeight="900"
          letterSpacing="5"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="6.5"
          paintOrder="stroke"
        >
          RUN
        </text>
      </svg>
    </div>
  );
};

export const SheraAvatarBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  const dim = size === 'sm' ? 'w-11 h-11' : 'w-14 h-14';
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 p-[3px] shadow-[0_3px_10px_rgba(0,0,0,0.65)] shrink-0`}
    >
      <div className="w-full h-full rounded-full bg-[#131d3b] flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 64 64" className="w-full h-full">
          <circle cx="32" cy="34" r="24" fill="#f8fafc" />
          <path d="M10 22 L19 8 L32 13 L45 8 L54 22 L58 37 L48 54 L16 54 L6 37 Z" fill="#e2e8f0" />
          <ellipse cx="32" cy="35" rx="14" ry="15" fill="#fffaf0" />
          <rect x="17" y="26" width="13" height="8" rx="2.5" fill="#090d16" stroke="#f59e0b" strokeWidth="1.2" />
          <rect x="34" y="26" width="13" height="8" rx="2.5" fill="#090d16" stroke="#f59e0b" strokeWidth="1.2" />
          <line x1="30" y1="30" x2="34" y2="30" stroke="#f59e0b" strokeWidth="1.8" />
          <polygon points="29,39 35,39 32,43" fill="#3b2626" />
          <path d="M14 54 L32 47 L50 54 L50 64 L14 64 Z" fill="#ffffff" />
          <path d="M23 51 Q32 60 41 51" fill="none" stroke="#f59e0b" strokeWidth="3.5" />
        </svg>
      </div>
    </div>
  );
};

export const CoinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={`${className} shrink-0`}>
    <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fef08a" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="10" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
    <path d="M11 20 L10 13 L13 15 L16 11 L19 15 L22 13 L21 20 Z" fill="#78350f" />
  </svg>
);

export const GemIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={`${className} shrink-0`}>
    <polygon points="16,2 28,11 23,29 9,29 4,11" fill="#c026d3" stroke="#f5d0fe" strokeWidth="2" />
    <polygon points="16,2 23,11 16,29 9,11" fill="#e879f9" opacity="0.75" />
  </svg>
);

/* Glossy Multi-Color Mobile Game Icons matching Reference Screenshot 1 */
export const DailyRewardGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <rect x="6" y="10" width="36" height="32" rx="7" fill="#f8fafc" stroke="#1e293b" strokeWidth="2.5" />
    <path d="M6 17 C6 12 9 10 13 10 L35 10 C39 10 42 12 42 17 L42 20 L6 20 Z" fill="#ef4444" />
    <rect x="14" y="6" width="5" height="9" rx="2.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
    <rect x="29" y="6" width="5" height="9" rx="2.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
    <path d="M16 30 L22 36 L33 24" fill="none" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LuckySpinGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <circle cx="24" cy="24" r="19" fill="#fbbf24" stroke="#451a03" strokeWidth="2.5" />
    <path d="M24 24 L24 7 A17 17 0 0 1 41 24 Z" fill="#ef4444" />
    <path d="M24 24 L41 24 A17 17 0 0 1 24 41 Z" fill="#38bdf8" />
    <path d="M24 24 L24 41 A17 17 0 0 1 7 24 Z" fill="#22c55e" />
    <path d="M24 24 L7 24 A17 17 0 0 1 24 7 Z" fill="#a855f7" />
    <circle cx="24" cy="24" r="6" fill="#fef08a" stroke="#78350f" strokeWidth="2" />
    <polygon points="24,2 28,9 20,9" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
  </svg>
);

export const ChestGameIcon: React.FC<{ className?: string; gem?: boolean }> = ({
  className = 'w-9 h-9',
  gem = false,
}) => (
  <svg viewBox="0 0 48 48" className={className}>
    <rect x="7" y="18" width="34" height="22" rx="5" fill="#b45309" stroke="#fef08a" strokeWidth="2" />
    <path d="M7 20 C7 12 13 9 24 9 C35 9 41 12 41 20 Z" fill="#d97706" stroke="#fde047" strokeWidth="2" />
    <rect x="7" y="21" width="34" height="5" fill="#fbbf24" />
    <rect x="20" y="18" width="8" height="11" rx="2" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
    {gem ? (
      <polygon points="24,5 30,11 27,18 21,18 18,11" fill="#e879f9" stroke="#ffffff" strokeWidth="1.5" />
    ) : (
      <>
        <circle cx="17" cy="14" r="4" fill="#fde047" stroke="#92400e" strokeWidth="1" />
        <circle cx="31" cy="14" r="4" fill="#fde047" stroke="#92400e" strokeWidth="1" />
      </>
    )}
  </svg>
);

export const MissionsGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <rect x="9" y="8" width="30" height="34" rx="5" fill="#fef3c7" stroke="#78350f" strokeWidth="2.5" />
    <rect x="17" y="4" width="14" height="7" rx="3" fill="#f59e0b" stroke="#78350f" strokeWidth="1.8" />
    <line x1="15" y1="20" x2="33" y2="20" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
    <line x1="15" y1="27" x2="33" y2="27" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
    <line x1="15" y1="34" x2="26" y2="34" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
    <circle cx="33" cy="34" r="5" fill="#22c55e" />
  </svg>
);

export const CrownGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <path
      d="M6 34 L4 15 L15 24 L24 9 L33 24 L44 15 L42 34 Z"
      fill="#fbbf24"
      stroke="#fef08a"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <rect x="6" y="34" width="36" height="6" rx="2" fill="#d97706" stroke="#fef08a" strokeWidth="1.5" />
    <circle cx="24" cy="9" r="3.5" fill="#ef4444" />
    <circle cx="4" cy="15" r="3" fill="#38bdf8" />
    <circle cx="44" cy="15" r="3" fill="#38bdf8" />
  </svg>
);

export const TicketGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <rect
      x="6"
      y="13"
      width="36"
      height="22"
      rx="5"
      transform="rotate(-12 24 24)"
      fill="#f97316"
      stroke="#fef08a"
      strokeWidth="2.2"
    />
    <polygon
      points="24,16 26.5,21 32,21.8 28,25.5 29,31 24,28.2 19,31 20,25.5 16,21.8 21.5,21"
      fill="#fef08a"
    />
  </svg>
);

export const TrophyGameIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <path d="M14 9 L34 9 L32 24 C31 30 17 30 16 24 Z" fill="#fbbf24" stroke="#fef08a" strokeWidth="2" />
    <path d="M14 12 L7 12 C7 20 12 22 15 22" fill="none" stroke="#f59e0b" strokeWidth="3.5" />
    <path d="M34 12 L41 12 C41 20 36 22 33 22" fill="none" stroke="#f59e0b" strokeWidth="3.5" />
    <rect x="21" y="27" width="6" height="8" fill="#d97706" />
    <rect x="14" y="35" width="20" height="6" rx="2" fill="#92400e" stroke="#fbbf24" strokeWidth="1.5" />
  </svg>
);

export const CharactersLionIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <polygon points="24,4 32,9 41,9 44,18 42,27 38,37 24,44 10,37 6,27 4,18 7,9 16,9" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
    <circle cx="24" cy="25" r="11" fill="#fef3c7" />
    <rect x="15" y="20" width="8" height="5" rx="1.5" fill="#0f172a" />
    <rect x="25" y="20" width="8" height="5" rx="1.5" fill="#0f172a" />
    <polygon points="22,28 26,28 24,31" fill="#78350f" />
  </svg>
);

export const HoverboardGameIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <ellipse cx="24" cy="25" rx="19" ry="7" transform="rotate(-18 24 25)" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.8" />
    <ellipse cx="24" cy="25" rx="12" ry="3.5" transform="rotate(-18 24 25)" fill="#fbbf24" />
  </svg>
);

export const WorldsCastleIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <path d="M8 29 L40 29 L30 43 L18 43 Z" fill="#78350f" />
    <ellipse cx="24" cy="28" rx="17" ry="4" fill="#22c55e" />
    <rect x="16" y="15" width="16" height="13" fill="#fef3c7" />
    <rect x="12" y="18" width="5" height="10" fill="#fde68a" />
    <rect x="31" y="18" width="5" height="10" fill="#fde68a" />
    <polygon points="24,6 30,15 18,15" fill="#f59e0b" />
    <polygon points="14.5,12 18,18 11,18" fill="#ef4444" />
    <polygon points="33.5,12 37,18 30,18" fill="#ef4444" />
    <rect x="22" y="28" width="4" height="14" fill="#38bdf8" />
  </svg>
);

export const ShopAwningIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className}>
    <rect x="9" y="20" width="30" height="20" rx="3" fill="#fef3c7" stroke="#92400e" strokeWidth="2" />
    <path d="M6 12 L42 12 L44 22 L4 22 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.5" />
    <rect x="13" y="12" width="6" height="10" fill="#ffffff" />
    <rect x="25" y="12" width="6" height="10" fill="#ffffff" />
    <rect x="19" y="27" width="10" height="13" rx="2" fill="#f59e0b" />
  </svg>
);

export const PowerUpIcon: React.FC<{ type: PowerUpType; className?: string }> = ({
  type,
  className = 'w-6 h-6',
}) => {
  switch (type) {
    case 'magnet':
      return <Magnet className={`${className} text-red-400`} />;
    case 'shield':
      return <Shield className={`${className} text-sky-400`} />;
    case 'rocket':
      return <Rocket className={`${className} text-orange-400`} />;
    case 'speedBoost':
      return <FastForward className={`${className} text-amber-400`} />;
    case 'doubleCoins':
      return <Sparkles className={`${className} text-yellow-300`} />;
    case 'invincibility':
      return <Crown className={`${className} text-rose-400`} />;
    case 'hoverboard':
      return <Zap className={`${className} text-cyan-300`} />;
    case 'superJump':
      return <Flame className={`${className} text-purple-400`} />;
  }
};
