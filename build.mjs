import {build} from 'esbuild';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
const bundle=await build({entryPoints:['src/stone-renderer.js'],bundle:true,minify:true,format:'iife',globalName:'StoneMatrix3D',write:false,legalComments:'inline',target:'es2022'});
const code=bundle.outputFiles[0].text.replaceAll('</script','<\\/script');
const fragment=(await readFile('src/game.html','utf8')).replace('<!-- STONE_RENDERER -->',()=>`<script>${code}</script>`);
const icon=encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#17201f"/><path d="M32 9 54 21 32 34 10 21Z" fill="#edcd91"/><path d="M10 21 32 34 32 57 10 44Z" fill="#92723e"/><path d="M32 34 54 21 54 44 32 57Z" fill="#c4a15f"/></svg>');
const html=`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="飛行石矩陣 3D：旋轉立體石室，點選底面與側牆下注，觀看光柱穿透懸浮岩石並結算模擬點數。">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data:;connect-src 'none';object-src 'none';base-uri 'none';form-action 'none'">
<link rel="icon" href="data:image/svg+xml,${icon}">
<title>Stone Matrix｜飛行石矩陣 3D</title>
<style>html{color-scheme:light dark;background:light-dark(#f9f8f2,#121918)}body{margin:0;padding:16px}#stone-matrix-draft .cursor-interaction{cursor:pointer}#stone-matrix-draft button:disabled{cursor:default}@media(max-width:480px){body{padding:8px}}</style>
</head>
<body>${fragment}</body>
</html>`;
await writeFile('index.html',html);
await copyFile('node_modules/three/LICENSE','THREE-LICENSE.txt');
console.log(`Built standalone 3D game: ${Buffer.byteLength(html)} bytes`);
