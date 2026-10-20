# Product tour video

`client/public/media/trustvault-tour.mp4` (60 s, shown on the landing page and on `/tutorial`) is rendered from code.
It follows the **explainer-default** skill from [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) (MIT):
one HTML page draws any frame for a time `t` (`window.seek(t)`), and `render.mjs` films it into an MP4.

- `tour.src.html`: the video. The beat sheet is at the top of its script; the soundtrack is synthesised in `buildAudio`.
- `fonts.mjs`: downloads Inter, Inter Tight and JetBrains Mono and writes them as base64 into `fonts.css`.
- `render.mjs`: the skill's renderer, adapted to use the installed Chrome and `ffmpeg-static`.

## Re-render

```bash
cd docs/video
npm init -y && npm install playwright-core ffmpeg-static
node fonts.mjs
node -e "const fs=require('fs');fs.writeFileSync('tour.html',fs.readFileSync('tour.src.html','utf8').replace('/*FONTS*/',fs.readFileSync('fonts.css','utf8')))"
node render.mjs tour.html check.png --stills 3,12,26,40,48,55   # contact sheet to check frames
node render.mjs tour.html tour.mp4 30 3 8                       # final: 30 fps, motion blur, 8 workers
```

Then make the web copy (1280 px, about 4 MB) and replace `client/public/media/trustvault-tour.mp4`:

```bash
node_modules/ffmpeg-static/ffmpeg -i tour.mp4 -vf scale=1280:-2 -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -c:a aac -ar 48000 -b:a 128k -movflags +faststart trustvault-tour.mp4
```

`render.mjs` expects Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; change `executablePath` on other systems.

## 15-second reel

`client/public/media/trustvault-reel.mp4` (shown on the landing page, muted on a loop with a sound toggle) is rendered the same way from `reel.src.html`: one canvas, every frame drawn from the time, 120 BPM with cuts on the beat, soundtrack synthesised in `buildAudio`.

```bash
node -e "const fs=require('fs');fs.writeFileSync('reel.html',fs.readFileSync('reel.src.html','utf8').replace('/*FONTS*/',fs.readFileSync('fonts.css','utf8')))"
node render.mjs reel.html reel.mp4 30 3 8
node_modules/ffmpeg-static/ffmpeg -i reel.mp4 -vf scale=1280:-2 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart trustvault-reel.mp4
```
