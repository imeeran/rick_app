# Ricklimo Driver App

Ionic + Angular + Capacitor app for Ricklimo drivers.

---

## Prerequisites

- **Node.js** (v18+)
- **npm**
- **Java 21** (required for Android build)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Java 21 for Android (one-time)

The Android build requires Java 21. Run this once to install and configure it:

```bash
./android/setup-java.sh
```

This script will:
- Install OpenJDK 21 via Homebrew (if not already installed)
- Configure `android/gradle.properties` to use Java 21 for builds

**Alternative (manual):** If you prefer not to run the script:

```bash
# Install Java 21
brew install openjdk@21

# Set JAVA_HOME before each build (or add to ~/.zshrc)
export JAVA_HOME=$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home
```

---

## Development

```bash
# Start dev server
npm start

# Build for production
npm run build

# Lint
npm run lint

# Run tests
npm test
```

---

## Android Build

### Build release AAB (for Play Store)

```bash
# 1. Production build
npm run build

# 2. Sync web assets to Android
npx cap sync android

# 3. Build release bundle
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Build release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### If Java version errors occur

Ensure Java 21 is configured:

```bash
# Re-run setup
./android/setup-java.sh

# Or set JAVA_HOME for this session
export JAVA_HOME=$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home
cd android && ./gradlew bundleRelease
```

---

## Play Store Upload

See **[PLAY_STORE_UPLOAD.md](PLAY_STORE_UPLOAD.md)** for keystore setup, signing, and upload steps.

---

## Quick reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `./android/setup-java.sh` | Configure Java 21 for Android (run once) |
| `npm run build` | Production build |
| `npx cap sync android` | Sync web build to Android |
| `cd android && ./gradlew bundleRelease` | Build AAB for Play Store |
| `cd android && ./gradlew assembleRelease` | Build APK |
| `cd android && ./gradlew assembleDebug ` | Build Debug APK |

<!-- "@types/google.maps": "^3.65.2", -->

## Special notification sound while assgned driver android
Channel ID: 053fa270-1289-4c49-b4f2-d137e76283f5

## Api key
AIzaSyCoJr2F43G2Oh_-R6w8sMUnuwuex1Js1vE


## SHA1 and details
> Task :app:signingReport
Variant: debug
Config: debug
Store: /Users/meeranismail/.android/debug.keystore
Alias: AndroidDebugKey
MD5: 3F:13:83:C7:8E:19:42:E0:B6:62:B2:48:95:0E:65:76
SHA1: 3F:B8:F9:05:8B:1F:7A:84:85:A3:48:9F:A2:D3:A9:5F:A9:71:A7:FA
SHA-256: 46:F9:AF:45:26:6D:A4:DD:40:8B:8E:EB:57:11:05:0C:32:C2:BE:C5:EF:19:E3:31:75:07:A8:5F:5F:B9:E9:77
Valid until: Friday, 11 December, 2054
----------
Variant: release
Config: release
Store: /Users/meeranismail/Desktop/DESKTOP/Projects/UM/Rick/rick-app/android/ricklimo-release.keystore
Alias: ricklimo
MD5: 1A:91:13:E6:DC:60:96:76:11:64:00:07:C4:91:BC:7B
SHA1: FB:97:61:5B:42:06:07:46:BF:02:27:7E:1B:E2:08:73:B8:B0:49:94
SHA-256: F0:23:0F:93:EE:70:AC:73:84:2F:8A:FE:02:EA:A5:05:53:F3:00:AC:94:64:7A:3C:27:F9:59:6C:88:54:29:0B
Valid until: Saturday, 5 July, 2053

