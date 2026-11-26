#!/bin/bash
# make-reel.sh <slides-dir> <music-file> <out.mp4> [music-start-seconds]
# World Brief Reel: 4:5 slides centred on a 1080x1920 blurred copy, 3.5 s each, 0.5 s crossfades, music fade in/out.
set -e
FF="${FFMPEG:-$(node -e "process.stdout.write(require('ffmpeg-static'))" 2>/dev/null || echo ffmpeg)}"
DIR="$1"; MUSIC="$2"; OUT="$3"; SS="${4:-0}"
SLIDES=($(ls "$DIR"/slide-*.png "$DIR"/slide-*.jpg 2>/dev/null | sort -V)); N=${#SLIDES[@]}
D=3.5; X=0.5; TOTAL=$(awk "BEGIN{print $N*$D-($N-1)*$X}")
IN=(); F=""
for i in "${!SLIDES[@]}"; do
  IN+=(-loop 1 -framerate 30 -t $D -i "${SLIDES[$i]}")
  F+="[$i:v]split[a$i][b$i];[a$i]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.28[bg$i];"
  F+="[b$i]scale=1080:1350[fg$i];[bg$i][fg$i]overlay=0:285,format=yuv420p,settb=AVTB,fps=30[v$i];"
done
PREV="v0"
for ((i=1;i<N;i++)); do OFF=$(awk "BEGIN{print $i*($D-$X)}"); F+="[$PREV][v$i]xfade=transition=fade:duration=$X:offset=$OFF[x$i];"; PREV="x$i"; done
F+="[$N:a]atrim=0:$TOTAL,asetpts=PTS-STARTPTS,afade=t=in:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=$(awk "BEGIN{print $TOTAL-2}"):d=2[aud]"
"$FF" -y -loglevel error "${IN[@]}" -ss "$SS" -i "$MUSIC" -filter_complex "$F" -map "[$PREV]" -map "[aud]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 44100 -movflags +faststart -t "$TOTAL" "$OUT"
echo "$OUT ($TOTAL s)"
