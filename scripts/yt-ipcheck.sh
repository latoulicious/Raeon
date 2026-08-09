#!/usr/bin/env bash
# Probe YouTube's innertube player API as each client youtube-source uses.
# Run on the VPS and on a home connection; compare playabilityStatus.
VIDEO="${1:-RAnmdRgqpD4}"
API="https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false"

echo "ip: $(curl -s https://ifconfig.co)"
echo "video: $VIDEO"
echo

probe() {
  local label="$1" ctx="$2"
  local body="{\"context\":{\"client\":$ctx},\"racyCheckOk\":true,\"contentCheckOk\":true,\"videoId\":\"$VIDEO\",\"playbackContext\":{\"contentPlaybackContext\":{\"signatureTimestamp\":\"20668\"}},\"params\":\"2AMB\"}"
  printf '%-16s ' "$label"
  curl -s -X POST "$API" -H "Content-Type: application/json" -d "$body" \
    | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print('unparseable response'); raise SystemExit
ps=d.get('playabilityStatus',{})
n=len(d.get('streamingData',{}).get('adaptiveFormats',[]))
print(f\"{ps.get('status')}  {ps.get('reason') or ''}  (formats: {n})\")"
}

probe MWEB           '{"clientName":"MWEB","clientVersion":"2.20240726.11.00"}'
probe WEB            '{"clientName":"WEB","clientVersion":"2.20260806.01.00"}'
probe ANDROID_VR     '{"clientName":"ANDROID_VR","clientVersion":"1.60.19","androidSdkVersion":32}'
probe TVHTML5        '{"clientName":"TVHTML5","clientVersion":"7.20250319.10.00"}'
probe TVHTML5_SIMPLY '{"clientName":"TVHTML5_SIMPLY","clientVersion":"1.0"}'
