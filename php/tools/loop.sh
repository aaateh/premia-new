#!/bin/bash
# Собирает бесшовный цикл: хвост ролика плавно перетекает в начало.
# usage: loop.sh in.mp4 out.mp4 tail_seconds crf [width]
set -euo pipefail

IN="$1"
OUT="$2"
X="${3:-1.25}"
CRF="${4:-26}"
WIDTH="${5:-}"

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
L=$(python3 -c "print(f'{float($D) - float($X):.6f}')")

SCALE=""
MAP="[out]"
if [ -n "$WIDTH" ]; then
  SCALE=";[out]scale=${WIDTH}:-2:flags=lanczos[scaled]"
  MAP="[scaled]"
fi

ffmpeg -v error -y -i "$IN" -filter_complex "
[0:v]trim=start=0:end=${X},setpts=PTS-STARTPTS[head];
[0:v]trim=start=${L}:end=${D},setpts=PTS-STARTPTS[tail];
[tail][head]xfade=transition=fade:duration=${X}:offset=0[blend];
[0:v]trim=start=${X}:end=${L},setpts=PTS-STARTPTS[body];
[blend][body]concat=n=2:v=1:a=0[out]${SCALE}
" -map "$MAP" -an -c:v libx264 -profile:v high -preset slow -crf "$CRF" \
  -pix_fmt yuv420p -movflags +faststart -map_metadata -1 "$OUT"

echo "$(basename "$OUT"): $(du -h "$OUT" | cut -f1), $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT") s"
