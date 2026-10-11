// Assemble dist-artifact/pixel-gambit.html: one self-contained page for claude.ai.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.artifact.config.ts', { stdio: 'inherit' });

const dir = 'dist-artifact';
const js = readFileSync(`${dir}/game.js`, 'utf8');
const cssFile = readdirSync(dir).find((f) => f.endsWith('.css'));
const css = readFileSync(`${dir}/${cssFile}`, 'utf8');

// Keep inline code from closing its own tag.
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const safeCss = css.replace(/<\/style/gi, '<\\/style');

const html = `<title>Пиксельный гамбит</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;600&family=Tiny5&display=swap">
<style>${safeCss}</style>
<div id="app"></div>
<script>${safeJs}</script>
`;
writeFileSync(`${dir}/pixel-gambit.html`, html);
console.log(`Wrote ${dir}/pixel-gambit.html (${(html.length / 1024).toFixed(1)} KB)`);
