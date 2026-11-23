export type WorldId = 'clouds' | 'lava' | 'crystal' | 'dragon' | 'frozen';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type PowerUpType =
  | 'magnet'
  | 'shield'
  | 'rocket'
  | 'speedBoost'
  | 'doubleCoins'
  | 'invincibility'
  | 'hoverboard'
  | 'superJump';

export type ObstacleKind =
  | 'crate'
  | 'barrier_low'
  | 'barrier_high'
  | 'roller'
  | 'spikes'
  | 'pendulum'
  | 'rotating_gate'
  | 'train'
  | 'ramp'
  | 'falling_rock'
  | 'collapsing_bridge'
  | 'flying_dragon';

export type GameScreen = 'loading' | 'home' | 'playing' | 'paused' | 'gameover' | 'victory';

export type ModalType =
  | null
  | 'daily_reward'
  | 'lucky_spin'
  | 'free_coins'
  | 'missions'
  | 'vip_pass'
  | 'events'
  | 'leaderboard'
  | 'starter_pack'
  | 'characters'
  | 'hoverboards'
  | 'worlds'
  | 'shop'
  | 'settings'
  | 'profile'
  | 'apk_guide';

export interface WorldConfig {
  id: WorldId;
  name: string;
  subtitle: string;
  description: string;
  unlockCostCoins: number;
  unlockCostGems: number;
  requiredLevel: number;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogDensity: number;
  ambientSky: number;
  ambientGround: number;
  keyLightColor: number;
  accentColor: string;
  badgeColor: string;
  levelRange: [number, number];
}

export interface CharacterOutfit {
  id: string;
  name: string;
  subtitle: string;
  suitColor: number;
  lapelColor: number;
  tieColor: number;
  trimColor: number;
  sunglassesTint: number;
  furColor?: number;
  snoutColor?: number;
  maneOuterColor?: number;
  maneInnerColor?: number;
  hasSunglasses?: boolean;
  costCoins: number;
  costGems: number;
  scoreBonus: number;
  perkText: string;
}

export interface HoverboardItem {
  id: string;
  name: string;
  subtitle: string;
  primaryColor: number;
  accentColor: number;
  glowColor: number;
  costCoins: number;
  costGems: number;
  durationBonus: number;
  perkText: string;
}

export interface LevelDefinition {
  level: number;
  worldId: WorldId;
  title: string;
  targetDistance: number;
  targetCoins: number;
  baseSpeed: number;
  maxSpeed: number;
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
}

export interface MissionItem {
  id: string;
  title: string;
  description: string;
  category: 'daily' | 'weekly';
  metric: 'distance' | 'coins' | 'runs' | 'jumps' | 'slides' | 'powerups' | 'score';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
  claimed: boolean;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  metric: 'totalDistance' | 'totalCoins' | 'highScore' | 'worldsUnlocked' | 'totalRuns' | 'playerLevel';
  target: number;
  rewardCoins: number;
  rewardGems: number;
  claimed: boolean;
}

export type PowerUpInventory = Record<PowerUpType, number>;

export type ActivePowerUpTimers = Record<PowerUpType, number>;

export type AdsConsentStatus = 'unknown' | 'personalized' | 'non_personalized';

export interface PurchaseRecord {
  sku: string;
  title: string;
  purchasedAt: string;
  source: 'google_play' | 'gems' | 'coins';
  transactionId?: string;
}

export interface PlayerSaveData {
  playerName: string;
  playerLevel: number;
  xp: number;
  xpToNext: number;
  coins: number;
  gems: number;
  highScore: number;
  worldHighScores: Record<WorldId, number>;
  totalDistance: number;
  totalCoins: number;
  totalRuns: number;
  totalJumps: number;
  totalSlides: number;
  totalPowerUps: number;
  highestGameLevel: number;
  selectedGameLevel: number;
  selectedWorld: WorldId;
  unlockedWorlds: WorldId[];
  selectedOutfit: string;
  unlockedOutfits: string[];
  selectedHoverboard: string;
  unlockedHoverboards: string[];
  powerUpInventory: PowerUpInventory;
  powerUpLevels: Record<PowerUpType, number>;
  missions: MissionItem[];
  lastDailyReset: string;
  lastWeeklyReset: string;
  dailyRewardDay: number;
  lastDailyClaimDate: string | null;
  lastSpinDate: string | null;
  freeSpinsAvailable: number;
  claimedAchievements: string[];
  vipActive: boolean;
  removeAds: boolean;
  starterPackPurchased: boolean;
  purchaseHistory: PurchaseRecord[];
  adsConsentStatus: AdsConsentStatus;
  worldRotationEnabled: boolean;
  revivesUsedTotal: number;
  coinContinuesTotal: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  showTouchControls: boolean;
  graphicsQuality: GraphicsQuality;
  adTestBannerEnabled: boolean;
}

export interface RunHudState {
  score: number;
  distance: number;
  runCoins: number;
  runGems: number;
  multiplier: number;
  comboCount: number;
  speed: number;
  gameLevel: number;
  levelProgress: number; // 0 to 1
  worldId: WorldId;
  nextWorldId: WorldId | null;
  worldRotationSecondsRemaining: number | null;
  activeTimers: ActivePowerUpTimers;
  inventory: PowerUpInventory;
  shieldHitsRemaining: number;
  nearMissText: string | null;
  bannerAlert: string | null;
}

export interface RunResult {
  score: number;
  distance: number;
  coins: number;
  gems: number;
  xpEarned: number;
  isNewBest: boolean;
  levelCleared: boolean;
  clearedLevelNumber: number;
  worldId: WorldId;
  worldsVisited: WorldId[];
  revivedCount: number;
  adRevivedCount: number;
  coinRevivedCount: number;
  reason: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  level: number;
  score: number;
  world: WorldId;
  isPlayer?: boolean;
}
