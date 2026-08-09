#!/usr/bin/env bash
# Probe innertube with a poToken/visitorData pair. Compare against yt-ipcheck.sh
# (same probe, no token) to isolate what the token actually buys on this IP.
: "${POT:?set POT}"; : "${VD:?set VD}"
VIDEO="${1:-RAnmdRgqpD4}"
API="https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false"

echo "ip: $(curl -s https://ifconfig.co)"
echo "video: $VIDEO"
echo

probe() {
  local label="$1" name="$2" ver="$3" extra="$4"
  local body
  body=$(python3 -c "
import json,sys
c={'clientName':sys.argv[1],'clientVersion':sys.argv[2],'visitorData':sys.argv[3]}
if sys.argv[5]: c.update(json.loads(sys.argv[5]))
print(json.dumps({
  'context':{'client':c},
  'racyCheckOk':True,'contentCheckOk':True,'videoId':sys.argv[6],
  'playbackContext':{'contentPlaybackContext':{'signatureTimestamp':'20668'}},
  'serviceIntegrityDimensions':{'poToken':sys.argv[4]},
  'params':'2AMB'}))" "$name" "$ver" "$VD" "$POT" "$extra" "$VIDEO")
  printf '%-14s ' "$label"
  curl -s -X POST "$API" -H "Content-Type: application/json" -d "$body" \
    | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print('unparseable'); raise SystemExit
ps=d.get('playabilityStatus',{})
n=len(d.get('streamingData',{}).get('adaptiveFormats',[]))
print(f\"{ps.get('status')}  {ps.get('reason') or ''}  (formats: {n})\")"
}

probe MWEB       MWEB 2.20240726.11.00 ''
probe WEB        WEB  2.20260806.01.00 ''
probe WEBEMBED   WEB_EMBEDDED_PLAYER 1.20250401.01.00 '{"clientScreen":"EMBED"}'
