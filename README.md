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
