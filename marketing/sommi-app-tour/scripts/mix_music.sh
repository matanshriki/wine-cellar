#!/bin/bash
# Lay a low, warm music bed under each locale's voiceover → audio/{loc}/mix.mp3.
# Music: "Bossa Antigua" by Kevin MacLeod (incompetech.com), CC BY 3.0 — credit required.
set -e
cd "$(dirname "$0")/.."
MUSIC=assets/music/bossa-antigua.mp3
MUSIC_OFFSET=1.6   # skip the silent intro
MUSIC_GAIN=0.32    # bed level before ducking

for loc in ${@:-en he}; do
  vo="audio/$loc/vo.mp3"
  total=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$vo")
  fade_out_start=$(python3 -c "print(max(0, $total - 3))")
  ffmpeg -v error -y -i "$vo" -ss "$MUSIC_OFFSET" -i "$MUSIC" -filter_complex "
    [0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[vo][key];
    [1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:$total,asetpts=N/SR/TB,
         volume=$MUSIC_GAIN,afade=t=in:d=1.5,afade=t=out:st=$fade_out_start:d=3[bed];
    [bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=60:release=600[ducked];
    [vo][ducked]amix=inputs=2:normalize=0,atrim=0:$total,loudnorm=I=-16:TP=-1.5:LRA=11[out]" \
    -map "[out]" -ar 48000 -c:a libmp3lame -b:a 192k "audio/$loc/mix.mp3"
  echo "mixed audio/$loc/mix.mp3 (${total}s)"
done
