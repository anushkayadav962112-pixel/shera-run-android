import { createInitialMissions } from '../data/gameData';
import { GraphicsQuality, PlayerSaveData, WorldId } from '../types/game';

const STORAGE_KEY = 'shera_run_save_v1';

const VALID_WORLDS: WorldId[] = ['clouds', 'lava', 'crystal', 'dragon', 'frozen'];

function normalizeWorldId(id: string | undefined): WorldId {
  if (id === 'trains') return 'crystal';
  if (id === 'forest') return 'dragon';
  if (id === 'desert') return 'frozen';
  if (id && VALID_WORLDS.includes(id as WorldId)) return id as WorldId;
  return 'clouds';
}

function normalizeGraphicsQuality(q: string | undefined): GraphicsQuality {
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  if (q === 'balanced') return 'medium';
  return 'high';
}

export function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function getWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function xpRequiredForLevel(level: number): number {
  return 200 + (level - 1) * 140;
}

export function createDefaultSaveData(): PlayerSaveData {
  return {
    playerName: 'SheraPlayer',
    playerLevel: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    coins: 2500,
    gems: 50,
    highScore: 0,
    worldHighScores: {
      clouds: 0,
      lava: 0,
      crystal: 0,
      dragon: 0,
      frozen: 0,
    },
    totalDistance: 0,
    totalCoins: 0,
    totalRuns: 0,
    totalJumps: 0,
    totalSlides: 0,
    totalPowerUps: 0,
    highestGameLevel: 1,
    selectedGameLevel: 1,
    selectedWorld: 'clouds',
    unlockedWorlds: ['clouds'],
    selectedOutfit: 'royal_white',
    unlockedOutfits: ['royal_white', 'golden_hero'],
    selectedHoverboard: 'golden_sovereign',
    unlockedHoverboards: ['golden_sovereign'],
    powerUpInventory: {
      magnet: 3,
      shield: 2,
      rocket: 3,
      speedBoost: 2,
      doubleCoins: 2,
      invincibility: 1,
      hoverboard: 2,
      superJump: 1,
    },
    powerUpLevels: {
      magnet: 1,
      shield: 1,
      rocket: 1,
      speedBoost: 1,
      doubleCoins: 1,
      invincibility: 1,
      hoverboard: 1,
      superJump: 1,
    },
    missions: createInitialMissions(),
    lastDailyReset: getTodayKey(),
    lastWeeklyReset: getWeekKey(),
    dailyRewardDay: 1,
    lastDailyClaimDate: null,
    lastSpinDate: null,
    freeSpinsAvailable: 1,
    claimedAchievements: [],
    vipActive: false,
    removeAds: false,
    starterPackPurchased: false,
    purchaseHistory: [],
    adsConsentStatus: 'unknown',
    worldRotationEnabled: true,
    revivesUsedTotal: 0,
    coinContinuesTotal: 0,
    soundEnabled: true,
    musicEnabled: true,
    showTouchControls: false,
    graphicsQuality: 'high',
    adTestBannerEnabled: false,
  };
}

export function loadSaveData(): PlayerSaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createDefaultSaveData();
      saveGameData(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerSaveData> & {
      worldHighScores?: Record<string, number>;
    };
    const defaults = createDefaultSaveData();

    const rawScores: Record<string, number> = parsed.worldHighScores || {};
    const worldHighScores: Record<WorldId, number> = {
      clouds: rawScores.clouds || 0,
      lava: rawScores.lava || 0,
      crystal: rawScores.crystal ?? rawScores.trains ?? 0,
      dragon: rawScores.dragon ?? rawScores.forest ?? 0,
      frozen: rawScores.frozen ?? rawScores.desert ?? 0,
    };

    const rawUnlockedWorlds = Array.isArray(parsed.unlockedWorlds)
      ? Array.from(new Set(parsed.unlockedWorlds.map((w) => normalizeWorldId(w))))
      : defaults.unlockedWorlds;
    if (!rawUnlockedWorlds.includes('clouds')) rawUnlockedWorlds.unshift('clouds');

    const merged: PlayerSaveData = {
      ...defaults,
      ...parsed,
      coins: Math.max(0, Number(parsed.coins ?? defaults.coins)),
      gems: Math.max(0, Number(parsed.gems ?? defaults.gems)),
      selectedWorld: normalizeWorldId(parsed.selectedWorld),
      unlockedWorlds: rawUnlockedWorlds,
      graphicsQuality: normalizeGraphicsQuality(parsed.graphicsQuality),
      worldHighScores,
      powerUpInventory: { ...defaults.powerUpInventory, ...(parsed.powerUpInventory || {}) },
      powerUpLevels: { ...defaults.powerUpLevels, ...(parsed.powerUpLevels || {}) },
      missions: Array.isArray(parsed.missions) && parsed.missions.length > 0 ? parsed.missions : defaults.missions,
      unlockedOutfits: Array.isArray(parsed.unlockedOutfits)
        ? Array.from(new Set(['golden_hero', 'royal_white', ...parsed.unlockedOutfits]))
        : defaults.unlockedOutfits,
      unlockedHoverboards: Array.isArray(parsed.unlockedHoverboards)
        ? parsed.unlockedHoverboards
        : defaults.unlockedHoverboards,
      claimedAchievements: Array.isArray(parsed.claimedAchievements) ? parsed.claimedAchievements : [],
      purchaseHistory: Array.isArray(parsed.purchaseHistory) ? parsed.purchaseHistory : [],
      removeAds: Boolean(parsed.removeAds || parsed.vipActive),
      worldRotationEnabled: parsed.worldRotationEnabled !== false,
    };

    const today = getTodayKey();
    const currentWeek = getWeekKey();
    const freshMissions = createInitialMissions();

    if (merged.lastDailyReset !== today) {
      merged.lastDailyReset = today;
      merged.freeSpinsAvailable = Math.max(merged.freeSpinsAvailable, 1);
      merged.missions = merged.missions.map((m) => {
        if (m.category === 'daily') {
          const template = freshMissions.find((fm) => fm.id === m.id);
          return template ? { ...template } : { ...m, progress: 0, claimed: false };
        }
        return m;
      });
    }

    if (merged.lastWeeklyReset !== currentWeek) {
      merged.lastWeeklyReset = currentWeek;
      merged.missions = merged.missions.map((m) => {
        if (m.category === 'weekly') {
          const template = freshMissions.find((fm) => fm.id === m.id);
          return template ? { ...template } : { ...m, progress: 0, claimed: false };
        }
        return m;
      });
    }

    return merged;
  } catch {
    return createDefaultSaveData();
  }
}

export function saveGameData(data: PlayerSaveData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function grantXp(
  save: PlayerSaveData,
  amount: number
): { playerLevel: number; xp: number; xpToNext: number; leveledUp: boolean } {
  let level = save.playerLevel;
  let xp = save.xp + Math.max(0, Math.round(amount));
  let xpToNext = save.xpToNext || xpRequiredForLevel(level);
  let leveledUp = false;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = xpRequiredForLevel(level);
    leveledUp = true;
  }

  return { playerLevel: level, xp, xpToNext, leveledUp };
}

export function getWorldHighScore(save: PlayerSaveData, worldId: WorldId): number {
  return save.worldHighScores[worldId] || 0;
}
