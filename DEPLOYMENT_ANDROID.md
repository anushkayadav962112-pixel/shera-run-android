# SHERA RUN – Run, Android APK Build & Play Store Guide

## 1. Run Locally (Web & Mobile Browser)
```bash
npm install
npm run dev
```
Open `http://localhost:3000` (best tested in portrait mobile viewport or desktop browser with Arrow keys / WASD + Space).

## 2. Production Build
```bash
npm run build
```
Outputs optimized production assets into `dist/`.

## 3. Build an Android APK / AAB (Capacitor)
1. Install Capacitor CLI & Android platform:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "SHERA RUN" com.shera.run --web-dir=dist
   npm run build
   npx cap add android
   npx cap sync android
   ```
2. Lock portrait orientation in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <activity android:name=".MainActivity" android:screenOrientation="portrait" ... />
   ```
3. Wire Native Monetization Bridges (before Play Store release):
   - Attach `window.SheraAndroidAdBridge` (Google Mobile Ads SDK + UMP Consent SDK for Banner, Interstitial, Rewarded) in your Capacitor plugin / Android WebView bridge.
   - Attach `window.SheraAndroidBillingBridge` (Google Play Billing v6+) for IAP SKUs (`shera_remove_ads`, `shera_starter_pack`, `shera_vip_monthly`, `shera_gems_*`) defined in `src/services/monetization.ts`.
4. Build APK / Signed Release Bundle:
   ```bash
   cd android
   ./gradlew assembleDebug    # Debug APK: android/app/build/outputs/apk/debug/app-debug.apk
   ./gradlew bundleRelease    # Play Store AAB: android/app/build/outputs/bundle/release/app-release.aab
   ```

## 4. Google Play Store Preparation Checklist
- [ ] Package ID (`com.shera.run`) finalized and signed with Upload Key / Play App Signing.
- [ ] Replace official test unit IDs (`ADMOB_TEST_AD_UNITS` — `ca-app-pub-3940256099942544/...`) in `src/services/monetization.ts` with production AdMob IDs and add `com.google.android.gms.ads.APPLICATION_ID` to `AndroidManifest.xml`.
- [ ] Configure Google Play Console In-App Products & Subscriptions matching SKUs in `IAP_PRODUCTS` (`shera_remove_ads`, `shera_starter_pack`, `shera_vip_monthly`, `shera_gems_*`) and test `restorePurchases()`.
- [ ] Provide App Icon (512×512 PNG), Feature Graphic (1024×500 PNG), and Portrait Gameplay Screenshots.
- [ ] Complete Google Play Data Safety form (disclosing local save storage, UMP consent choices, and AdMob SDK identifiers).
- [ ] Host Privacy Policy URL and set target API level to Android 14+ (API 34+).
