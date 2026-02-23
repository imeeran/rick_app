#!/bin/bash
# Configures Java 21 for Android build (required by Capacitor).
# Run once from project root: ./android/setup-java.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "Error: Homebrew is required. Install from https://brew.sh"
    exit 1
fi

# Install OpenJDK 21 if not present
if ! brew list openjdk@21 &>/dev/null; then
    echo "Installing OpenJDK 21..."
    brew install openjdk@21
fi

JAVA_HOME_PATH="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"

# Update gradle.properties
if [ -f gradle.properties ]; then
    if grep -q "org.gradle.java.home" gradle.properties; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i.bak "s|org.gradle.java.home=.*|org.gradle.java.home=$JAVA_HOME_PATH|" gradle.properties
            rm -f gradle.properties.bak
        else
            sed -i "s|org.gradle.java.home=.*|org.gradle.java.home=$JAVA_HOME_PATH|" gradle.properties
        fi
    else
        echo "" >> gradle.properties
        echo "# Java 21 for Android build (required by Capacitor) - added by setup-java.sh" >> gradle.properties
        echo "org.gradle.java.home=$JAVA_HOME_PATH" >> gradle.properties
    fi
    echo "Java 21 configured in gradle.properties"
else
    echo "Error: gradle.properties not found"
    exit 1
fi

echo ""
echo "Setup complete. You can now build the Android app."
echo "See README.md for build commands."
