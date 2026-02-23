# Upload Ricklimo Driver App to Google Play Console

Follow these steps to publish your app on the Google Play Store.

---

## 1. Prepare for production

### 1.1 Use real API (no dummy data)
- Open **`src/environments/environment.prod.ts`**
- Ensure **`useDummyData: false`** (production build uses this file)

### 1.2 Bump version for each release
- Open **`android/app/build.gradle`**
- Update:
  - **`versionCode`** – integer, must increase every upload (e.g. 1 → 2 → 3)
  - **`versionName`** – user-visible version (e.g. `"1.0"` → `"1.0.1"`)

```gradle
versionCode 2
versionName "1.0.1"
```

---

## 2. Create a release keystore (one-time)

You need a keystore to sign the Android app. Keep the file and passwords safe; you need them for all future updates.

Run in terminal (from project root):

```bash
keytool -genkey -v -keystore ricklimo-release.keystore -alias ricklimo -keyalg RSA -keysize 2048 -validity 10000
```

- Store **`ricklimo-release.keystore`** in a safe place (e.g. secure drive or password manager backup).
- Save the **keystore password** and **key alias password**; you will need them to sign every release.

---

## 3. Configure signing in Android project

1. Create **`android/keystore.properties`** (do **not** commit this file to public git):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=ricklimo
storeFile=../ricklimo-release.keystore
```

Replace `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` with the passwords you set when creating the keystore.  
If the keystore file is not in the project, use an absolute path for `storeFile`.

2. In **`android/app/build.gradle`**, add before the `android {` block:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

3. Inside `android { }`, add a `signingConfigs` block and use it in `buildTypes`:

```gradle
android {
    namespace "app.ricklimo.driver"
    compileSdk rootProject.ext.compileSdkVersion

    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }

    defaultConfig {
        applicationId "app.ricklimo.driver"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 2
        versionName "1.0.1"
        // ... rest unchanged
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

Add **`keystore.properties`** to **`.gitignore`** so it is never committed.

---

## 4. Build the release AAB

### Prerequisite: Java 21

The Android build requires **Java 21**. Run once from project root:

```bash
./android/setup-java.sh
```

This installs OpenJDK 21 (via Homebrew) and configures Gradle. See [README.md](README.md) for details.

### Build steps

From the project root:

```bash
# 1. Production Angular build (uses environment.prod.ts)
npm run build

# 2. Copy web build into Android project
npx cap sync android

# 3. Build release bundle
cd android
./gradlew bundleRelease
```

The **Android App Bundle (AAB)** will be at:

**`android/app/build/outputs/bundle/release/app-release.aab`**

Use this file to upload to Play Console (Google prefers AAB over APK).

---

## 5. Google Play Console setup

### 5.1 Create / open app
1. Go to [Google Play Console](https://play.google.com/console).
2. Sign in with your Google account (you need a **developer account** – one-time $25 registration fee).
3. **Create app** (or select existing): name “Ricklimo Driver”, default language, app or game, free/paid.

### 5.2 Complete “Set up your app”
- **App access**: say if login is required and provide test credentials if needed.
- **Ads**: declare if the app contains ads.
- **Content rating**: complete the questionnaire and get a rating.
- **Target audience**: select age groups.
- **News app**: declare if it’s a news app.
- **COVID-19 contact tracing / status**: answer as applicable.
- **Data safety**: declare what data you collect and how it’s used (e.g. location, account info if you use login).

### 5.3 Store listing
- **Short description** (max 80 chars).
- **Full description** (max 4000 chars).
- **App icon**: 512 x 512 px.
- **Feature graphic**: 1024 x 500 px.
- **Screenshots**: at least 2 phone screenshots (e.g. 1080 x 1920 or similar).

---

## 6. Upload the AAB and publish

1. In Play Console go to **Release** → **Production** (or **Testing** → **Internal/Closed** for testing first).
2. **Create new release**.
3. **Upload** the file:  
   `android/app/build/outputs/bundle/release/app-release.aab`
4. Add **Release name** (e.g. “1.0.1”) and **Release notes** (what’s new for users).
5. **Save** and then **Review release**.
6. Fix any errors (e.g. policy, permissions, signing).
7. **Start rollout to Production** (or to your test track).

After review, Google will make the app available on the Play Store (can take from hours to a few days).

---

## Quick checklist

- [ ] Java 21 configured (`./android/setup-java.sh`)
- [ ] `environment.prod.ts` has `useDummyData: false`
- [ ] `versionCode` and `versionName` updated in `android/app/build.gradle`
- [ ] Keystore created and stored safely
- [ ] `keystore.properties` created and in `.gitignore`
- [ ] `./gradlew bundleRelease` runs and produces `app-release.aab`
- [ ] Play Console: app created, store listing and policy sections completed
- [ ] AAB uploaded to Production (or test track) and rollout started

---

## Optional: add signing to `.gitignore`

In **`.gitignore`** add:

```
# Android signing (never commit)
keystore.properties
*.keystore
!debug.keystore
```

This keeps your release keystore and passwords out of version control.
