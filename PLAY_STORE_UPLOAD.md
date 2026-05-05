# Play Store: production build & signed AAB

## Before each release

1. **`src/environments/environment.prod.ts`** — set production API URLs and keys (`apiUrl`, `backendUrl`, etc.).
2. **`android/app/build.gradle`** — increase **`versionCode`** (required for every Play upload) and update **`versionName`** (user-visible version).

## One-time: signing

1. Create a keystore (save file + passwords securely):

   ```bash
   keytool -genkey -v -keystore ricklimo-release.keystore -alias ricklimo -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add **`android/keystore.properties`** (do not commit):

   ```properties
   storePassword=YOUR_STORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=ricklimo
   storeFile=../ricklimo-release.keystore
   ```

   Use an absolute `storeFile` path if the keystore is outside the repo.

3. Signing is already wired in **`android/app/build.gradle`** when `keystore.properties` exists. **`android/keystore.properties`** and **`*.keystore`** should stay in **`.gitignore`**.

## Build (signed release AAB)

Requires **Java 21** for Android (see **`README.md`** / `./android/setup-java.sh` if needed).

From the **project root**:

```bash
npm run build
npx cap sync android
cd android 
./gradlew bundleRelease

./gradlew assembleRelease    # For internal testing debug release

./gradlew assembleDebug      # For internal testing apk
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

Signing applies when **`android/keystore.properties`** exists and paths/passwords are correct. Verify: `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab`

## Upload

[Google Play Console](https://play.google.com/console) → your app → **Release** → create release → upload **`app-release.aab`** → release notes → review → rollout.

## Checklist

- [ ] `environment.prod.ts` updated for production
- [ ] `versionCode` / `versionName` bumped in `android/app/build.gradle`
- [ ] `npm run build` → `npx cap sync android` → `./gradlew bundleRelease`
- [ ] Upload `app-release.aab` in Play Console
