// 生成极简 404/200 兜底页：用户直接输入无扩展名路径时，
// 若平台以本文件的 404 兜底，则由这里的脚本把地址纠正到 /xxx/index.html。
// 用法：node scripts/make-fallback.mjs [distDir]，默认 .output/public

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const dist = process.argv[2] ?? '.output/public'

const page = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>TypeWords</title><meta http-equiv="refresh" content="0;url=/">
<script>(function(){var p=location.pathname;if(p==="/"||/\\.[a-z0-9]+$/i.test(p))return;
var t=p+location.search+location.hash;if(!t.endsWith("/"))t+="/";t+="index.html";
var x=new XMLHttpRequest();x.open("HEAD",t,false);try{x.send()}catch(e){}
location.replace(x.status>=200&&x.status<400?t:"/")})()</script></head>
<body>正在跳转…<a href="/">返回首页</a></body></html>`

for (const name of ['404.html', '200.html']) {
  try {
    await readFile(join(dist, name))
    await writeFile(join(dist, name), page)
    console.log(`[make-fallback] rewrote ${name}`)
  } catch {
    console.log(`[make-fallback] skip ${name} (missing)`)
  }
}
