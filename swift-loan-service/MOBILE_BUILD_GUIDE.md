# Swift Loan Service — Mobile Build Guide
## Android APK & iOS IPA

---

## 📋 Requirements

### For Android APK:
- **Android Studio** (latest) → https://developer.android.com/studio
- **Java JDK 17+**
- **Node.js 18+**

### For iOS IPA:
- **Mac computer** (required)
- **Xcode 14+** (Mac App Store)
- **Apple Developer Account** (for real device / App Store)
- **CocoaPods** → `sudo gem install cocoapods`

---

## 🚀 Quick Start

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Build web app
```bash
npm run build
```

### Step 3 — Sync to native platforms
```bash
npx cap sync
```

---

## 🤖 Android Build

### Option A: Android Studio (Recommended)
```bash
npx cap open android
```
Then in Android Studio:
1. Wait for Gradle sync to finish
2. Go to **Build → Generate Signed Bundle / APK**
3. Choose **APK**
4. Create or use existing keystore
5. Select **release** build variant
6. Click **Finish** → APK saved in `android/app/release/`

### Option B: Command Line
```bash
cd android
./gradlew assembleRelease
```
APK location: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Sign the APK (required for distribution):
```bash
# Create keystore (one time only)
keytool -genkey -v -keystore swift-loan.keystore -alias swift-loan -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore swift-loan.keystore \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  swift-loan

# Align APK
zipalign -v 4 app-release-unsigned.apk SwiftLoanService.apk
```

---

## 🍎 iOS Build (Mac only)

### Step 1 — Install CocoaPods dependencies
```bash
cd ios/App
pod install
cd ../..
```

### Step 2 — Open in Xcode
```bash
npx cap open ios
```

### Step 3 — In Xcode:
1. Select your **Team** (Apple Developer account) in Signing & Capabilities
2. Set **Bundle Identifier**: `com.swiftloan.service`
3. Connect iPhone or select Simulator
4. Press **▶ Run** for testing
5. For distribution: **Product → Archive → Distribute App**

---

## 🔄 Updating App Content

Whenever you change the web code:
```bash
npm run build
npx cap sync
```
Then rebuild in Android Studio / Xcode.

---

## 📁 Project Structure

```
swift-loan-service/
├── src/                    # React source code
├── dist/                   # Built web assets
├── android/                # Android project (open in Android Studio)
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       └── assets/public/  # Web assets copied here
├── ios/                    # iOS project (open in Xcode)
│   └── App/App/public/     # Web assets copied here
├── capacitor.config.ts     # Capacitor configuration
└── package.json
```

---

## ⚙️ App Details

| Property | Value |
|----------|-------|
| App Name | Swift Loan Service |
| Package ID | com.swiftloan.service |
| Version | 1.0.0 |
| Min Android | API 22 (Android 5.1+) |
| Min iOS | iOS 13+ |

---

## 🔥 Firebase Notes

Firebase Authentication (Google Sign-In) requires extra setup for native apps:

### Android:
1. Go to Firebase Console → Project Settings → Add Android app
2. Package name: `com.swiftloan.service`
3. Download `google-services.json`
4. Place in `android/app/google-services.json`

### iOS:
1. Go to Firebase Console → Project Settings → Add iOS app
2. Bundle ID: `com.swiftloan.service`
3. Download `GoogleService-Info.plist`
4. Add to `ios/App/App/` in Xcode

---

## 📞 Support

Built with React + Capacitor + Firebase
