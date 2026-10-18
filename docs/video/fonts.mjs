// Downloads the site's fonts (latin) from Google Fonts and writes them as base64 @font-face rules.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const families = ['Inter:wght@400..700', 'Inter+Tight:wght@600..800', 'JetBrains+Mono:wght@500..600'];
let out = '';
for (const f of families) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${f}&display=block`, { headers: { 'User-Agent': UA } })).text();
  for (const block of css.split('/* ').filter((b) => b.startsWith('latin */'))) {
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const b64 = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('base64');
    out += block.slice(block.indexOf('@font-face')).replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${b64}) format('woff2');`) + '\n';
  }
}
fs.writeFileSync('fonts.css', out);
console.log('fonts.css', (out.length / 1024).toFixed(0), 'KB,', (out.match(/@font-face/g) || []).length, 'faces');
