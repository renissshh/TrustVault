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

## 24-second showreel (live on the site)

The showreel is code, not a video file: `client/src/lib/showreel.js` draws any frame for a time `t` on a canvas, and the main page plays it live (`components/app/live-showreel.jsx`): 60 fps, sharp at any size, paused off screen, sound synthesised in the browser on request. It combines the tour and the earlier 15-second reel, in the format of the "showreel" prompts on prompt-motion.com: product UI, kinetic type, 120 BPM with every cut on the beat, in the Electric Night colours.

`showreel.src.html` imports the same module, so an MP4 can still be filmed when needed (for social posts):

```bash
node -e "const fs=require('fs');fs.writeFileSync('showreel.html',fs.readFileSync('showreel.src.html','utf8').replace('/*FONTS*/',fs.readFileSync('fonts.css','utf8')))"
node render.mjs showreel.html showreel.mp4 30 3 8
```
