#!/bin/bash
# Alkyon · στιγμιότυπα του Apple Watch στον προσομοιωτή (CI). Δεν αλλάζει τίποτα· μόνο για έλεγχο της εμφάνισης.
set -x
mkdir -p shots
RT=$(xcrun simctl list runtimes | grep -E "watchOS" | grep -v unavailable | tail -1 | grep -oE "com.apple.CoreSimulator.SimRuntime.watchOS-[0-9-]+")
if [ -z "$RT" ]; then xcodebuild -downloadPlatform watchOS || true; RT=$(xcrun simctl list runtimes | grep -E "watchOS" | grep -v unavailable | tail -1 | grep -oE "com.apple.CoreSimulator.SimRuntime.watchOS-[0-9-]+"); fi
[ -z "$RT" ] && { echo "no watchOS runtime"; exit 0; }
DT=$(xcrun simctl list devicetypes | grep -E "Apple Watch Series 1[01] .*46mm|Apple Watch Series 10 \(46mm\)|Apple Watch Ultra 2" | head -1 | grep -oE "com.apple.CoreSimulator.SimDeviceType[^)]+")
UD=$(xcrun simctl create AlkWatch "$DT" "$RT")
xcrun simctl boot "$UD"; sleep 25
APP=$(ls -d ios/App/build/Debug-watchsimulator/AlkyonWatch.app | head -1)
xcrun simctl install "$UD" "$APP"
xcrun simctl privacy "$UD" grant location com.alkyonfishing.app.watchkitapp || true
xcrun simctl location "$UD" set 34.75,32.42 || true
for pg in 0 1 2 3 4 5; do
  xcrun simctl terminate "$UD" com.alkyonfishing.app.watchkitapp 2>/dev/null
  xcrun simctl launch "$UD" com.alkyonfishing.app.watchkitapp -alkPage $pg -alkWel 0 -alkShots 1; sleep 14
  xcrun simctl io "$UD" screenshot "shots/page-$pg.png"
done
for r in log settings depth; do
  xcrun simctl terminate "$UD" com.alkyonfishing.app.watchkitapp 2>/dev/null
  xcrun simctl launch "$UD" com.alkyonfishing.app.watchkitapp -alkPage 0 -alkWel 0 -alkShots 1 -alkRoute $r; sleep 10
  xcrun simctl io "$UD" screenshot "shots/route-$r.png"
done
xcrun simctl terminate "$UD" com.alkyonfishing.app.watchkitapp 2>/dev/null
xcrun simctl launch "$UD" com.alkyonfishing.app.watchkitapp -alkPage 0 -alkShots 1; sleep 10
xcrun simctl io "$UD" screenshot "shots/welcome.png"
