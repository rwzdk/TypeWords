// Qoder Sites 静态托管适配脚本（构建后处理）。
// 平台两个既定行为决定了这个脚本的存在：
//   1. 不解析目录索引：/about 返回 404 或落到首页，只有 /about/index.html 能直接命中
//   2. 未知路径回落到首页 HTML
// 处理：把站内链接改写为 /xxx/index.html，并在每页注入一段重定向脚本
//（用户直接输入 /about/ 时，首页里的脚本会把地址纠正到 /about/index.html）。
// 用法：node scripts/prepare-qoder-deploy.mjs [distDir]，默认 .output/public

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const dist = process.argv[2] ?? '.output/public'

// 平台把 /xxx 落到首页，所以要先跳到 /xxx/index.html 才能拿到正确 HTML；
// 但 Nuxt 路由只认 /xxx，因此进入 index.html 后必须在应用启动前把地址还原成 /xxx。
const SNIPPET = `<script>(function(){var p=location.pathname;if(/\\/index\\.html$/.test(p)){history.replaceState(null,"",p.slice(0,-11)+location.search+location.hash);return}if(p==="/"||/\\.[a-z0-9]+$/i.test(p))return;var s=p+location.search+location.hash;if(!s.endsWith("/"))s+="/";s+="index.html";location.replace(s)})()</script>`

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

// 从目录结构推导所有可用的路由段：/about → /about/index.html
const routes = new Set()
const htmlFiles = []
for await (const file of walk(dist)) {
  if (file.endsWith('.html')) {
    htmlFiles.push(file)
    const rel = relative(dist, file).replace(/\\/g, '/')
    if (rel.endsWith('/index.html')) routes.add('/' + rel.slice(0, -'/index.html'.length))
  }
}

let filesTouched = 0
let linksRewritten = 0
for (const file of htmlFiles) {
  let html = await readFile(file, 'utf8')
  const before = html
  for (const route of routes) {
    if (route === '/') continue
    const bare = new RegExp(`(href="${route})/?"(?!index)`, 'g')
    html = html.replace(bare, `$1/index.html"`)
  }
  if (!html.includes(SNIPPET)) html = html.replace('<head>', `<head>${SNIPPET}`)
  if (html !== before) {
    linksRewritten +=
      (html.match(/index\.html/g) ?? []).length - (before.match(/index\.html/g) ?? []).length
    await writeFile(file, html)
    filesTouched++
  }
}

console.log(
  `[prepare-qoder-deploy] routes=${routes.size} html=${htmlFiles.length} touched=${filesTouched} linksRewritten=${linksRewritten}`,
)
