# Android device test — 26 October 2026

Local development-signed APK for an authorized OPPO CPH2687, Android 16,
arm64-v8a. The package is `com.dziri.messenger`; Consumer remains a separate
package. This is not a store build or a production release.

## Native configuration

- Launcher label: **DM**. In-app Messenger branding and the package, slug,
  deep-link scheme, backend and secure-storage namespace remain unchanged.
- `plugins/with-launcher-icon.cjs` runs after Expo's generated resources and
  applies an 18dp inset to both adaptive launcher icons. The approved PNG stays
  byte-for-byte intact. The black background matches that PNG, avoiding a
  visible rectangle around the inset foreground.
- Android's adaptive layer is 108dp, with a centered 66dp safe zone. The
  approved PNG already contains margins; the inset brings its ring into that
  zone. See [Android's adaptive-icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
- `expo-system-ui` uses Expo's compatible version for automatic native theme
  handling. Image Picker no longer blocks `RECORD_AUDIO` globally, which had
  overridden the voice-message module's microphone permission. The compiled
  APK declares camera and microphone permissions; recording still requires
  the user's runtime permission.

## Build and verification

The first complete build passed `:app:assembleRelease`, including Android's
vital lint checks. It contained only arm64-v8a native libraries and bundled
Hermes app code pointing to the canonical Dziri backend. APK identity and v2
signature verification passed before installation.

The phone installed Messenger successfully, then accepted the DM/icon update
with the same certificate using an in-place installation. A signed-in Profile settings
screen rendered live account details; a signed-in conversation was visible after
the update. No credentials were copied from Consumer,
and verification did not send messages, record media, change privacy switches
or install packs. Cold launch completed in approximately one second; session
restoration without intervening user interaction remains unverified. A reconnecting
banner was visible on the conversation's warm resume; sustained connectivity,
two-account delivery and push/calls were not exercised.

The final APK's compiled resources confirm the DM label and equal 18dp foreground
insets on all four sides, for both normal and round adaptive icons. The phone
disconnected from USB before the final Android app-details/launcher screenshot,
so physical launcher rendering remains for visual review.

Final artifact: `DM-0.1.0-arm64-local.apk` (48,181,295 bytes), SHA-256
`101d91fdb112b1c7ccb079791ed8bff66d3853a165858dae2a12d560409171d6`.
The adjacent `verification.json` records the checks and their limits.

Source tests (39), typecheck, lint, design-contract and runtime-consistency
checks passed. Final web, Android and iOS exports passed. Final APK and
device evidence are retained under
`D:/codex-artifacts/dziri-messenger-device-20261026/`; build logs and official
tool-download checksums are under the ignored `.codex/` directory.

The Android variant uses the template's development signing key. It must not
be presented as store-signed. iOS launcher naming is configured but has not
been checked on a physical iPhone.

## Local build environment

The successful build used Gradle 9.3.1, JDK 17, Android SDK/build tools 36,
NDK 27.1.12297006 and CMake 3.22.1. SDK archives were checked against Google's
repository metadata; the Gradle archive matched its official SHA-256.

On this Windows host, Java's default Unix-domain socket temporary directory
caused `Unable to establish loopback connection`. A dedicated short directory,
set through per-process `JAVA_TOOL_OPTIONS` (`jdk.net.unixdomain.tmpdir` and
`java.io.tmpdir`), passed a Java selector probe and allowed compilation. No
global Java settings, shared ADB server or unrelated build processes were changed.

Use the repository's package manager, run `sync:inbox`, and generate Android
with `expo prebuild --platform android --no-install` before a native build.
Provide the installed SDK through `ANDROID_HOME`, then run:

```powershell
./android/gradlew.bat -p android :app:assembleRelease --console=plain --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
```

Verify the resulting package and signing certificate before updating the phone
with `adb -s <authorized-device> install -r <verified-apk>`. Never uninstall an
existing app or clear its data to resolve a signature mismatch.

Consumer's installation timestamp changed independently during the long build.
This task issued installation commands only for Messenger; it does not claim
that other ongoing work left the entire phone unchanged.
