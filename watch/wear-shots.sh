#!/bin/bash
# Alkyon · στιγμιότυπα του ρολογιού Wear OS στον προσομοιωτή (CI). Δεν αλλάζει τίποτα· μόνο για έλεγχο της εμφάνισης.
set -x
P=com.alkyonfishing.app
APK=$(ls apk/*.apk | head -1)
mkdir -p shots
adb install -r "$APK" || exit 1
adb shell pm grant $P android.permission.ACCESS_FINE_LOCATION
adb shell pm grant $P android.permission.POST_NOTIFICATIONS
adb shell wm size
S=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${S%x*}; H=${S#*x}; CX=$((W/2)); CY=$((H/2))
shot(){ sleep "${2:-3}"; adb exec-out screencap -p > "shots/$1.png"; }
adb shell am start -n $P/com.alkyonfishing.app.wear.ui.MainActivity
shot 00-welcome 15
adb shell input tap $CX $CY
shot 01-today 10
for i in 2 3 4 5 6; do adb shell input swipe $CX $((H*3/4)) $CX $((H/4)) 250; shot 0$i-page 4; done
# πίσω στη σελίδα «Έξοδος» και έναρξη εξόδου
for i in 1 2 3 4; do adb shell input swipe $CX $((H/4)) $CX $((H*3/4)) 250; sleep 1; done
shot 07-trip-idle 3
adb shell input tap $CX $((H*58/100))
shot 08-trip-started 3
shot 09-trip-live 4
# μενού καταγραφής (κουμπί ≡ κάτω)
adb shell input tap $CX $((H-16))
shot 10-log-menu 3
adb shell input swipe $CX $((H*3/4)) $CX $((H/4)) 250; shot 11-log-menu-2 2
adb shell input keyevent KEYCODE_BACK; sleep 1
adb logcat -d | grep -iE "alkyon|AndroidRuntime|FATAL" | tail -60 > shots/logcat.txt
