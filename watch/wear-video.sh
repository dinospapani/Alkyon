#!/bin/bash
# Alkyon · βίντεο του ρολογιού Wear OS στον προσομοιωτή (CI) για τη δήλωση «foreground service» στο Play.
# Δείχνει: έναρξη εξόδου → μόνιμη ειδοποίηση καταγραφής → η καταγραφή συνεχίζει εκτός εφαρμογής → τέλος εξόδου → η ειδοποίηση φεύγει.
set -x
P=com.alkyonfishing.app
APK=$(ls apk/*.apk | head -1)
mkdir -p video/frames
adb install -r "$APK" || exit 1
adb shell pm grant $P android.permission.ACCESS_FINE_LOCATION
adb shell pm grant $P android.permission.POST_NOTIFICATIONS
adb shell settings put system screen_off_timeout 1800000
adb shell dumpsys battery unplug
adb shell settings put system show_touches 1
S=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${S%x*}; H=${S#*x}; CX=$((W/2)); CY=$((H/2))
LOG=video/steps.txt; say(){ echo "$(date +%T) $*" | tee -a $LOG; }
adb shell settings put secure doze_always_on 0
adb shell settings put global ambient_enabled 0
# η οθόνη μένει ξύπνια σε όλη την εγγραφή
( while true; do adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1; sleep 4; done ) &
WK=$!
# θέση σκάφους που κινείται αργά (ανοιχτά της Λεμεσού)· ξεκινά αφού φορτώσει η πρόγνωση
geo(){ ( i=0; while [ $i -lt 400 ]; do adb emu geo fix $(python3 -c "print(33.05+$i*0.00004)") $(python3 -c "print(34.63+$i*0.00002)") >/dev/null 2>&1; i=$((i+1)); sleep 1; done ) & GEO=$!; }
has(){ dump; grep -q "$1" /tmp/u.xml; }
dump(){ adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb exec-out cat /sdcard/u.xml > /tmp/u.xml 2>/dev/null; }
# πάτημα πάνω σε κείμενο· επιστρέφει 1 αν δεν βρέθηκε
tapText(){ dump; XY=$(python3 - "$1" <<'PY'
import re,sys
try: x=open('/tmp/u.xml',encoding='utf-8',errors='ignore').read()
except Exception: x=''
for m in re.finditer(r'<node[^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',x):
    if sys.argv[1] in m.group(1):
        a,b,c,d=map(int,m.groups()[1:]); print((a+c)//2,(b+d)//2); break
PY
); [ -z "$XY" ] && return 1; adb shell input tap $XY; say "tap '$1' at $XY"; return 0; }
texts(){ dump; python3 -c "
import re
try: x=open('/tmp/u.xml',encoding='utf-8',errors='ignore').read()
except Exception: x=''
print(' | '.join(t for t in re.findall(r'text=\"([^\"]+)\"',x)))" | tee -a $LOG; }
shot(){ adb exec-out screencap -p > "video/$1.png"; }
focusApp(){ adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | grep -q alkyonfishing; }

adb shell input keyevent KEYCODE_WAKEUP; sleep 3
for t in 1 2 3 4 5 6; do adb shell am start -W -n $P/com.alkyonfishing.app.wear.ui.MainActivity; sleep 8; focusApp && break; done
sleep 6; texts
# αν το ρολόι δείχνει την οθόνη φόρτισης/αδράνειας, ένα σύρσιμο προς τα κάτω τη διώχνει (στην 1η σελίδα δεν αλλάζει τίποτα)
for t in 1 2 3 4 5 6; do has "Welcome" && break; has "ALKYON" && break; has "TODAY" && break
  adb shell input keyevent KEYCODE_WAKEUP; adb shell input swipe $CX $((H/4)) $CX $((H*3/4)) 300; sleep 3; done; texts
tapText "OK"; sleep 3; texts
# περιμένω να φορτώσει η πρόγνωση (έως 2 λεπτά)
for t in $(seq 1 24); do has "/100" && break; sleep 5; done; texts
for i in 1 2 3; do adb shell input swipe $CX $((H/4)) $CX $((H*3/4)) 300; sleep 1; done
geo; sleep 4

# ---- εγγραφή: βίντεο οθόνης + καρέ ως εφεδρεία ----
adb shell screenrecord --time-limit 110 --bit-rate 3000000 /sdcard/trip.mp4 &
REC=$!
( n=0; while [ $n -lt 150 ]; do adb exec-out screencap -p > $(printf "video/frames/f%04d.png" $n) 2>/dev/null; n=$((n+1)); sleep 0.5; done ) &
FR=$!
sleep 3
# σελίδα «Έξοδος» και έναρξη
OK=0
for i in 1 2 3 4 5; do if tapText "Start trip"; then OK=1; break; fi; adb shell input swipe $CX $((H*3/4)) $CX $((H/4)) 300; sleep 2; done
[ $OK = 0 ] && say "Start trip not found"
sleep 9; texts; shot 1-trip-live
adb shell dumpsys activity services $P | grep -E "isForeground|foregroundServiceType|GpsService" | head -5 | tee -a $LOG
# έξω από την εφαρμογή: watch face και ειδοποιήσεις
adb shell input keyevent KEYCODE_HOME; sleep 5; shot 2-watchface
adb shell input swipe $CX $((H-8)) $CX $((H/5)) 300; sleep 5; texts; shot 3-notification
adb shell dumpsys notification --noredact | grep -A3 "pkg=$P" | grep -E "pkg=|android.text|android.title" | head -6 | tee -a $LOG
adb shell input keyevent KEYCODE_HOME; sleep 2
# πίσω στην εφαρμογή: η έξοδος συνεχίζει να μετρά
adb shell am start -W -n $P/com.alkyonfishing.app.wear.ui.MainActivity; sleep 6; texts; shot 4-trip-continues
# μενού → Τέλος εξόδου → ✓
adb shell input tap $CX $((H-16)); sleep 3; texts
OK=0
for i in 1 2 3 4 5 6; do if tapText "End trip"; then OK=1; break; fi; adb shell input swipe $CX $((H*3/4)) $CX $((H*2/5)) 300; sleep 2; done
[ $OK = 0 ] && say "End trip not found"
sleep 3; texts; shot 5-confirm
tapText "✓" || say "confirm not found"
sleep 5; texts; shot 6-ended
adb shell dumpsys activity services $P | grep -E "isForeground|GpsService" | head -3 | tee -a $LOG
adb shell input keyevent KEYCODE_HOME; sleep 3
adb shell input swipe $CX $((H-8)) $CX $((H/5)) 300; sleep 5; texts; shot 7-notification-gone
adb shell input keyevent KEYCODE_HOME; sleep 2
kill $FR 2>/dev/null
adb shell pkill -2 screenrecord; sleep 4; wait $REC 2>/dev/null
adb pull /sdcard/trip.mp4 video/trip-raw.mp4 || say "no screenrecord file"
kill $GEO $WK 2>/dev/null
adb logcat -d | grep -iE "alkyon|AndroidRuntime|FATAL" | tail -60 > video/logcat.txt
ls -la video | tee -a $LOG
exit 0
