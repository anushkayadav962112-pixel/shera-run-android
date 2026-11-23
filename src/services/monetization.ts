// Modular AdMob & Google Play Billing v6+ Bridge for SHERA RUN
// Uses official Google AdMob Android Test Ad Unit IDs in dev/testing mode.
// Never simulates fake ad completions or fake Play Store purchases when native SDKs are absent.

import { AdsConsentStatus } from '../types/game';

export type RewardedPlacement =
  | 'revive'
  | 'free_coins'
  | 'double_run_coins'
  | 'double_daily_reward'
  | 'double_mission_reward';

export interface AdSdkBridge {
  initialize?: (options: { appId: string; nonPersonalizedAdsOnly: boolean }) => Promise<void>;
  showBanner?: (adUnitId: string, nonPersonalized: boolean) => void;
  hideBanner?: () => void;
  showInterstitial?: (adUnitId: string, nonPersonalized: boolean) => Promise<boolean>;
  showRewarded?: (
    adUnitId: string,
    placement: RewardedPlacement,
    nonPersonalized: boolean
  ) => Promise<{ rewarded: boolean; cancelled?: boolean }>;
  requestConsentForm?: () => Promise<{ status: AdsConsentStatus }>;
}

export interface BillingPurchaseResult {
  status: 'purchased' | 'pending' | 'cancelled' | 'failed';
  transactionId?: string;
  message?: string;
}

export interface BillingRestoreResult {
  status: 'restored' | 'none' | 'failed';
  restoredSkus: string[];
  message?: string;
}

export interface BillingSdkBridge {
  purchaseProduct?: (sku: string) => Promise<BillingPurchaseResult>;
  restorePurchases?: () => Promise<BillingRestoreResult>;
}

declare global {
  interface Window {
    SheraAndroidAdBridge?: AdSdkBridge;
    SheraAndroidBillingBridge?: BillingSdkBridge;
  }
}

/**
 * Official Google AdMob Android Test Ad Unit IDs (safe for development & Play Console pre-launch).
 * Replace with your live AdMob App & Unit IDs only during release signing.
 */
export const ADMOB_TEST_AD_UNITS = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  androidBanner: 'ca-app-pub-3940256099942544/6300978111',
  androidInterstitial: 'ca-app-pub-3940256099942544/1033173712',
  androidRewarded: 'ca-app-pub-3940256099942544/5224354917',
};

// Exported alias for backward compatibility
export const AD_UNIT_IDS = {
  androidBanner: ADMOB_TEST_AD_UNITS.androidBanner,
  androidInterstitial: ADMOB_TEST_AD_UNITS.androidInterstitial,
  androidRewardedRevive: ADMOB_TEST_AD_UNITS.androidRewarded,
  androidRewardedCoins: ADMOB_TEST_AD_UNITS.androidRewarded,
};

export interface IapProduct {
  sku: string;
  title: string;
  priceDisplay: string;
  coins?: number;
  gems?: number;
  vip?: boolean;
  removeAds?: boolean;
  starterPack?: boolean;
  badge?: string;
}

export const IAP_PRODUCTS: IapProduct[] = [
  {
    sku: 'shera_remove_ads',
    title: 'Remove Interstitial & Banner Ads',
    priceDisplay: '$2.99',
    gems: 50,
    removeAds: true,
    badge: 'AD-FREE',
  },
  {
    sku: 'shera_starter_pack',
    title: 'Royal Starter Pack',
    priceDisplay: '$2.99',
    coins: 15000,
    gems: 150,
    starterPack: true,
    badge: '80% OFF',
  },
  {
    sku: 'shera_vip_monthly',
    title: 'Royal VIP Crown Pass',
    priceDisplay: '$4.99 / mo',
    gems: 100,
    coins: 5000,
    vip: true,
    removeAds: true,
    badge: '2x XP + No Ads',
  },
  {
    sku: 'shera_coins_pouch',
    title: 'Pouch of Gold Coins',
    priceDisplay: '$0.99',
    coins: 5000,
  },
  {
    sku: 'shera_coins_chest',
    title: 'Royal Treasury Chest',
    priceDisplay: '$4.99',
    coins: 32000,
    badge: 'POPULAR',
  },
  {
    sku: 'shera_gems_handful',
    title: 'Sovereign Gem Pack',
    priceDisplay: '$1.99',
    gems: 120,
  },
  {
    sku: 'shera_gems_vault',
    title: 'Emperor Gem Vault',
    priceDisplay: '$9.99',
    gems: 750,
    badge: 'BEST VALUE',
  },
];

// Interstitial frequency cap state (never mid-gameplay, max once per >=2 runs and >=90s)
const INTERSTITIAL_MIN_RUNS = 2;
const INTERSTITIAL_COOLDOWN_MS = 90_000;
let runsSinceLastInterstitial = 0;
let lastInterstitialTimestamp = 0;
let consentStatus: AdsConsentStatus = 'unknown';

export const MonetizationService = {
  isAdSdkConnected(): boolean {
    return typeof window !== 'undefined' && Boolean(window.SheraAndroidAdBridge?.showRewarded);
  },

  isBillingSdkConnected(): boolean {
    return typeof window !== 'undefined' && Boolean(window.SheraAndroidBillingBridge?.purchaseProduct);
  },

  setConsentStatus(status: AdsConsentStatus): void {
    consentStatus = status;
  },

  getConsentStatus(): AdsConsentStatus {
    return consentStatus;
  },

  isNonPersonalizedAdsOnly(): boolean {
    return consentStatus !== 'personalized';
  },

  recordCompletedRun(): void {
    runsSinceLastInterstitial += 1;
  },

  canShowInterstitial(adsDisabled: boolean): boolean {
    if (adsDisabled) return false;
    const now = Date.now();
    return (
      runsSinceLastInterstitial >= INTERSTITIAL_MIN_RUNS &&
      now - lastInterstitialTimestamp >= INTERSTITIAL_COOLDOWN_MS
    );
  },

  async requestConsentForm(): Promise<{ status: AdsConsentStatus; message: string }> {
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidAdBridge : undefined;
    if (bridge?.requestConsentForm) {
      const res = await bridge.requestConsentForm();
      consentStatus = res.status;
      return { status: res.status, message: `UMP consent updated: ${res.status}` };
    }
    return {
      status: consentStatus,
      message: 'Native UMP Consent SDK is not present in browser preview; preference saved locally.',
    };
  },

  syncBannerVisibility(show: boolean, adsDisabled: boolean): void {
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidAdBridge : undefined;
    if (!bridge) return;
    if (show && !adsDisabled) {
      bridge.showBanner?.(ADMOB_TEST_AD_UNITS.androidBanner, this.isNonPersonalizedAdsOnly());
    } else {
      bridge.hideBanner?.();
    }
  },

  async requestRewardedAd(
    placement: RewardedPlacement
  ): Promise<{ status: 'rewarded' | 'sdk_unavailable' | 'cancelled'; message: string }> {
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidAdBridge : undefined;
    if (bridge?.showRewarded) {
      try {
        const result = await bridge.showRewarded(
          ADMOB_TEST_AD_UNITS.androidRewarded,
          placement,
          this.isNonPersonalizedAdsOnly()
        );
        return result.rewarded
          ? { status: 'rewarded', message: 'Reward verified by AdMob SDK.' }
          : { status: 'cancelled', message: 'Ad closed before reward completion.' };
      } catch {
        return { status: 'cancelled', message: 'AdMob failed to display rewarded video.' };
      }
    }

    return {
      status: 'sdk_unavailable',
      message: `AdMob Rewarded SDK is not connected in browser preview (Test Unit ${ADMOB_TEST_AD_UNITS.androidRewarded}). Connect window.SheraAndroidAdBridge in Capacitor Android.`,
    };
  },

  async triggerInterstitialIfAllowed(adsDisabled: boolean): Promise<boolean> {
    if (!this.canShowInterstitial(adsDisabled)) return false;
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidAdBridge : undefined;
    if (!bridge?.showInterstitial) return false;
    try {
      const shown = await bridge.showInterstitial(
        ADMOB_TEST_AD_UNITS.androidInterstitial,
        this.isNonPersonalizedAdsOnly()
      );
      if (shown) {
        runsSinceLastInterstitial = 0;
        lastInterstitialTimestamp = Date.now();
      }
      return shown;
    } catch {
      return false;
    }
  },

  // Backward-compatible wrapper
  async triggerInterstitialIfConnected(vipActive: boolean): Promise<boolean> {
    return this.triggerInterstitialIfAllowed(vipActive);
  },

  async purchaseIap(
    sku: string
  ): Promise<{
    status: 'purchased' | 'pending' | 'cancelled' | 'failed' | 'sdk_unavailable';
    transactionId?: string;
    message: string;
  }> {
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidBillingBridge : undefined;
    if (bridge?.purchaseProduct) {
      try {
        const res = await bridge.purchaseProduct(sku);
        if (res.status === 'purchased') {
          return {
            status: 'purchased',
            transactionId: res.transactionId,
            message: 'Google Play Billing purchase verified.',
          };
        }
        if (res.status === 'pending') {
          return {
            status: 'pending',
            transactionId: res.transactionId,
            message: res.message || 'Purchase is pending authorization in Google Play.',
          };
        }
        if (res.status === 'cancelled') {
          return {
            status: 'cancelled',
            message: res.message || 'Purchase cancelled before checkout.',
          };
        }
        return {
          status: 'failed',
          message: res.message || 'Google Play purchase failed.',
        };
      } catch {
        return {
          status: 'failed',
          message: 'Unexpected error communicating with Google Play Billing bridge.',
        };
      }
    }
    return {
      status: 'sdk_unavailable',
      message:
        'Google Play Billing SDK is not connected in browser preview. Connect window.SheraAndroidBillingBridge in your Android release wrapper.',
    };
  },

  async restorePurchases(): Promise<{
    status: 'restored' | 'none' | 'failed' | 'sdk_unavailable';
    restoredSkus: string[];
    message: string;
  }> {
    const bridge = typeof window !== 'undefined' ? window.SheraAndroidBillingBridge : undefined;
    if (bridge?.restorePurchases) {
      try {
        const res = await bridge.restorePurchases();
        return {
          status: res.status,
          restoredSkus: res.restoredSkus || [],
          message:
            res.message ||
            (res.restoredSkus?.length
              ? `Restored ${res.restoredSkus.length} Google Play entitlement(s).`
              : 'No previous non-consumable Google Play purchases found.'),
        };
      } catch {
        return {
          status: 'failed',
          restoredSkus: [],
          message: 'Failed to query Google Play purchase history.',
        };
      }
    }
    return {
      status: 'sdk_unavailable',
      restoredSkus: [],
      message:
        'Google Play Billing restore requires the native Android billing bridge (SheraAndroidBillingBridge).',
    };
  },
};
