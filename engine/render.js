// World Brief renderer. Usage: OUT=<dir> [POST=<key>] [REEL=1] [JPG=1] node engine/render.js
// Edit the `posts` object (one key per post, slides = HTML strings). Photos: put licensed JPGs in ./img and use img('file.jpg').
// World Brief carousel renderer: 1080x1350 PNGs, one folder per post.
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const OUT = process.env.OUT;
const img = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'img', f)).toString('base64');
const DATE = process.env.DATE || new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).toUpperCase();

const css = (t) => `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:${t.bg};--a:${t.a};--b:${t.b};--c:${t.c};--acc:${t.acc};--acc2:${t.acc2};--ink:#F7F5F0;--mut:#B9B6C8}
html,body{width:1080px;height:1350px}
body{font-family:'Manrope',sans-serif;color:var(--ink);background:var(--bg);overflow:hidden;position:relative}
.mesh{position:absolute;inset:-20%;background:
 radial-gradient(42% 34% at 88% 8%,var(--a) 0%,transparent 70%),
 radial-gradient(38% 30% at 6% 62%,var(--b) 0%,transparent 72%),
 radial-gradient(46% 36% at 92% 96%,var(--c) 0%,transparent 70%);filter:blur(30px);opacity:.85}
.vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 40%,rgba(0,0,0,.55) 100%)}
.noise{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:90px 90px;mask-image:linear-gradient(180deg,#000 0%,transparent 55%)}
.top{position:absolute;top:58px;left:76px;right:76px}
.mast{display:flex;align-items:baseline;justify-content:space-between}
.brand{font-family:'Fraunces',serif;font-style:italic;font-weight:800;font-size:40px;letter-spacing:-.01em}
.brand b{font-style:normal;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;color:transparent}
.meta{font-family:'JetBrains Mono',monospace;font-size:21px;letter-spacing:.12em;color:var(--mut);text-transform:uppercase}
.rule{height:2px;margin-top:20px;background:linear-gradient(90deg,var(--acc),rgba(255,255,255,.12) 40%,rgba(255,255,255,.04))}
.cat{display:inline-block;margin-top:22px;font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;letter-spacing:.2em;color:var(--acc);border:1.5px solid var(--acc);padding:9px 16px;border-radius:6px}
.wm{position:absolute;right:40px;bottom:120px;font-family:'Fraunces',serif;font-weight:900;font-size:520px;line-height:.8;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.06);letter-spacing:-.05em}
.main{position:absolute;left:76px;right:76px;top:250px;bottom:190px;display:flex;flex-direction:column;justify-content:center}
.kicker{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--acc);letter-spacing:.16em;text-transform:uppercase;margin-bottom:30px;display:flex;align-items:center;gap:16px}
.kicker:before{content:'';width:44px;height:3px;background:var(--acc)}
h1{font-family:'Fraunces',serif;font-size:112px;line-height:.98;font-weight:800;letter-spacing:-.008em;word-spacing:.06em;font-variation-settings:'opsz' 144}
h2{font-family:'Fraunces',serif;font-size:80px;line-height:1.02;font-weight:750;letter-spacing:-.005em;word-spacing:.05em;font-variation-settings:'opsz' 144}
.hl{font-style:italic;background:linear-gradient(95deg,var(--acc) 10%,var(--acc2) 90%);-webkit-background-clip:text;color:transparent;padding-right:.08em}
.big{font-family:'Fraunces',serif;font-size:230px;font-weight:900;letter-spacing:-.02em;line-height:.9;background:linear-gradient(160deg,#fff 15%,var(--acc) 60%,var(--acc2));-webkit-background-clip:text;color:transparent}
p.body{font-size:42px;line-height:1.34;color:#DCD9E6;margin-top:34px;font-weight:500;max-width:900px}
p.body b{color:#fff;font-weight:800}
.foot{position:absolute;left:76px;right:76px;bottom:58px;display:flex;justify-content:space-between;align-items:center}
.src{font-family:'JetBrains Mono',monospace;font-size:19px;color:#9693A8;letter-spacing:.04em}
.dots{display:flex;gap:10px;align-items:center}
.dots i{width:12px;height:12px;border-radius:99px;background:rgba(255,255,255,.22)}
.dots i.on{width:40px;background:var(--acc)}
.swipe{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--acc);letter-spacing:.14em;margin-left:18px}
.card{background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:46px 50px;backdrop-filter:blur(8px);box-shadow:0 30px 80px rgba(0,0,0,.35)}
.why{border-left:6px solid var(--acc);padding-left:40px}
.flags{display:flex;gap:-20px;margin-bottom:56px}
.flag{width:200px;height:200px;border-radius:50%;display:grid;place-items:center;font-size:128px;background:rgba(0,0,0,.35);border:3px solid rgba(255,255,255,.18);margin-right:-26px;box-shadow:0 20px 50px rgba(0,0,0,.45)}
.bar{height:26px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:44px}
.bar>i{display:block;height:100%;width:70%;background:linear-gradient(90deg,var(--acc2),var(--acc));border-radius:999px;box-shadow:0 0 30px var(--acc)}
.cta{margin-top:60px;display:inline-flex;align-items:center;gap:16px;font-weight:800;font-size:36px;color:var(--bg);background:linear-gradient(95deg,var(--acc),var(--acc2));padding:24px 40px;border-radius:999px;align-self:flex-start;box-shadow:0 18px 50px rgba(0,0,0,.4)}
.photo{position:absolute;left:0;right:0;top:0;height:900px;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.15) brightness(.9)}
.photo .tint{position:absolute;inset:0;background:linear-gradient(160deg,#9F1239 0%,#7C2D12 55%,#B45309 100%);mix-blend-mode:color;opacity:.75}
.photo .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,7,9,.78) 0%,rgba(15,7,9,.1) 24%,rgba(15,7,9,.25) 50%,rgba(15,7,9,.85) 78%,var(--bg) 100%)}
.top,.foot{z-index:5}.main{z-index:4}
.credit{z-index:5;position:absolute;right:76px;top:178px;font-family:'JetBrains Mono',monospace;font-size:16px;color:rgba(255,255,255,.55);letter-spacing:.04em;text-align:right}
.main.low{top:auto;bottom:170px;justify-content:flex-end}
.faces{position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center}
.face{width:330px;height:420px;border-radius:200px 200px 28px 28px;overflow:hidden;margin:0 -14px;border:3px solid rgba(247,200,107,.55);box-shadow:0 30px 70px rgba(0,0,0,.55);position:relative;background:#000}
.face img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;filter:saturate(.85) contrast(1.05)}
.face span{position:absolute;left:0;right:0;bottom:0;padding:14px 0 12px;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;letter-spacing:.18em;color:#F7C86B;background:linear-gradient(0deg,rgba(15,7,9,.95),rgba(15,7,9,0))}
.x{display:flex;flex-direction:column;gap:6px}
.x div{font-family:'Fraunces',serif;font-size:76px;font-weight:750;letter-spacing:0;display:flex;align-items:center;gap:22px}
.x span{font-family:'Manrope';font-size:40px;font-weight:800;width:62px;height:62px;border-radius:14px;display:grid;place-items:center;background:rgba(255,80,80,.16);color:#FF6B6B;border:1.5px solid rgba(255,107,107,.5)}
`;

const shell = (t, cat, n, total, source, inner) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600..900;1,9..144,600..900&family=Manrope:wght@500;700;800&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet">
<style>${css(t)}</style></head><body>
<div class="mesh"></div><div class="grid"></div><div class="vig"></div>
<svg class="noise" width="1080" height="1350"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="wm">0${n}</div>
<div class="top"><div class="mast"><div class="brand">World <b>Brief</b></div><div class="meta">${DATE} · Edition 01</div></div><div class="rule"></div><span class="cat">${cat}</span></div>
${inner.startsWith("<!--L-->")?inner.split("<!--M-->")[0]+'<div class="main low">'+inner.split("<!--M-->")[1]+"</div>":'<div class="main">'+inner+"</div>"}
<div class="foot"><span class="src">${source}</span><span class="dots">${Array.from({length:total},(_,i)=>'<i class="'+(i+1===n?'on':'')+'"></i>').join('')}${n<total?(process.env.REEL ? '' : '<span class="swipe">SWIPE →</span>'):''}</span></div>
</body></html>`;

// Anthropic price path (reported points, not a full tick chart)
const chart = (() => {
  const pts = [['IPO', 83], ['1st trade', 111.5], ['Day-1 close', 97.17], ['Day 2', 85], ['Week low', 73.85]];
  const W = 936, H = 560, x0 = 40, y = (v) => 40 + (120 - v) * (H - 120) / 60;
  const xs = pts.map((_, i) => x0 + i * ((W - 120) / (pts.length - 1)));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs[i]},${y(p[1])}`).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<line x1="20" x2="${W - 20}" y1="${y(83)}" y2="${y(83)}" stroke="#93A0BC" stroke-dasharray="10 10" stroke-width="3"/>
<text x="${W - 20}" y="${y(83) - 14}" fill="#93A0BC" font-size="26" text-anchor="end" font-weight="700">IPO price $83</text>
<path d="${line} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z" fill="url(#g)" opacity=".35"/>
<path d="${line}" fill="none" stroke="var(--acc)" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff" style="stop-color:var(--acc)"/><stop offset="1" stop-color="#ffffff" style="stop-color:var(--acc)" stop-opacity="0"/></linearGradient></defs>
${pts.map((p, i) => `<circle cx="${xs[i]}" cy="${y(p[1])}" r="14" fill="var(--bg)" stroke="var(--acc)" stroke-width="7"/>
<text x="${xs[i]}" y="${y(p[1]) - 32}" fill="#fff" font-size="34" font-weight="800" text-anchor="middle">$${p[1]}</text>
<text x="${xs[i]}" y="${H - 8}" fill="#93A0BC" font-size="24" font-weight="600" text-anchor="middle">${p[0]}</text>`).join('')}
</svg>`;
})();

const tunnel = `<svg width="936" height="430" viewBox="0 0 936 430">
<defs><linearGradient id="m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#E8EEF8"/><stop offset=".25" stop-color="#7C8DB0"/><stop offset="1" stop-color="#1C2E57"/></linearGradient></defs>
<path d="M0,430 L150,170 L230,230 L380,40 L520,210 L600,140 L760,300 L840,230 L936,330 L936,430 Z" fill="url(#m)"/>
<path d="M360,95 L380,40 L402,92 L388,84 L374,100 Z" fill="#fff"/>
<line x1="60" y1="360" x2="880" y2="360" stroke="rgba(255,255,255,.25)" stroke-width="18" stroke-linecap="round"/>
<line x1="60" y1="360" x2="634" y2="360" stroke="var(--acc)" stroke-width="18" stroke-linecap="round"/>
<circle cx="634" cy="360" r="20" fill="var(--acc)"/>
<text x="60" y="410" fill="#D5DBE8" font-size="28" font-weight="700">Kashmir side</text>
<text x="880" y="410" fill="#D5DBE8" font-size="28" font-weight="700" text-anchor="end">Ladakh side</text>
</svg>`;

const THEMES = {
 ai:{bg:'#0B0718',a:'#5B2EFF',b:'#B0249F',c:'#0EA5B7',acc:'#C4B5FD',acc2:'#F0ABFC'},
 geo:{bg:'#0F0709',a:'#9F1239',b:'#1E3A8A',c:'#B45309',acc:'#F7C86B',acc2:'#FF8A5B'},
 in:{bg:'#04141A',a:'#0F766E',b:'#C2410C',c:'#15803D',acc:'#FFB347',acc2:'#FF7A1A'},
};
const posts = {
  '1-anthropic-ipo': { t: THEMES.geo, cat: 'AI · MARKETS', src: 'Source: Yahoo Finance, StockTitan, Blockonomi', slides: [
    `<!--L--><div class="photo"><img src="${img('nasdaq.jpg')}"><div class="tint"></div><div class="shade"></div></div><div class="credit">Photo: ajay_suresh / Wikimedia Commons, CC BY 2.0</div><!--M--><div class="kicker">The Claude maker went public</div><h1>Anthropic hit Wall Street.<br><span class="hl">Then it slipped.</span></h1><p class="body">The AI IPO of the year, in 60 seconds.</p>`,
    `<div class="kicker">IPO price · 19 Nov · Nasdaq: ANT</div><div class="big">$83</div><p class="body">Priced <b>above</b> its own $70–78 range. Demand was huge.</p>`,
    `<div class="kicker">First trade</div><div class="big">+34%</div><p class="body">Opened at <b>$111.50</b>. At the peak, Anthropic was worth <b>over $2 trillion</b>.</p>`,
    `<div class="kicker">One week later</div><div style="margin-top:10px">${chart}</div><p class="body" style="font-size:36px">Back near, then below, its IPO price.</p>`,
    `<div class="kicker">Why it matters for India</div><div class="why"><h2>AI is now the world's biggest money bet.</h2><p class="body">Indian IT giants and AI startups are priced against these numbers. Boom or bubble? Comment below.</p></div><div class="cta">Follow World Brief →</div>`,
  ] },
  '2-shenzhen-summit': { t: THEMES.geo, cat: 'GEOPOLITICS', src: 'Source: RFE/RL, Foreign Policy, NPR', slides: [
    `<!--L--><div class="faces"><div class="face"><img src="${img('trump.jpg')}"><span>TRUMP</span></div><div class="face" style="z-index:2;transform:translateY(-30px)"><img src="${img('xi.jpg')}"><span>XI</span></div><div class="face"><img src="${img('putin.jpg')}"><span>PUTIN</span></div></div><div class="credit" style="top:700px">Photos: White House (public domain); Kremlin.ru, CC BY 4.0</div><!--M--><h1>Trump. Xi. Putin.<br><span class="hl">One room.</span></h1><p class="body">The first-ever three-way summit.</p>`,
    `<div class="kicker">Where</div><h2>Shenzhen, China</h2><p class="body">On the sidelines of the <b>APEC summit</b>. About <b>80–90 minutes</b> together.</p>`,
    `<div class="kicker">What they agreed</div><div class="card"><div class="x"><div><span>✕</span>Ukraine</div><div><span>✕</span>Iran</div><div><span>✕</span>Nuclear cuts</div></div><p class="body">Only one thing: to <b>start talks</b> on nuclear arms.</p></div>`,
    `<div class="kicker">The Musk factor</div><h2>Elon Musk flew with Trump for the China leg.</h2><p class="body">But he was <b>not</b> in the summit room.</p>`,
    `<div class="kicker">Why it matters for India</div><div class="why"><h2>Russia's oil. China's border.</h2><p class="body">If the big three get closer, India's oil deals and border talks feel it first.</p></div><div class="cta">Follow World Brief →</div>`,
  ] },
  '3-zojila-tunnel': { t: THEMES.geo, cat: 'INDIA', src: 'Source: Indian Opinion, 25 Nov 2026', slides: [
    `<!--L--><div class="photo"><img src="${img('zojila.jpg')}"><div class="tint"></div><div class="shade"></div></div><div class="credit">Photo: Zojila road, Wikimedia Commons (public domain)</div><!--M--><div class="kicker">Built under the Himalayas</div><h1>India's toughest tunnel is <span class="hl">70% done.</span></h1><div class="bar"><i></i></div><p class="body" style="font-size:34px">Zojila Tunnel · 6–8 months to go</p>`,
    `<div class="kicker">The tunnel</div><div style="margin-bottom:20px">${tunnel}</div><h2>~14 km through the mountains, Kashmir to Ladakh.</h2>`,
    `<div class="kicker">Travel time</div><h2 style="font-size:92px">3+ hours<br><span class="hl">→ ~15 min</span></h2><p class="body">No more crossing the dangerous Zojila pass.</p>`,
    `<div class="kicker">All-weather</div><h2>Snow used to cut Ladakh off for months.</h2><p class="body">The tunnel stays open <b>all year</b>.</p>`,
    `<div class="kicker">Why it matters</div><div class="why"><h2>Supplies, soldiers and families, every day of the year.</h2></div><div class="cta">Follow World Brief →</div>`,
  ] },
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  for (const [dir, p] of Object.entries(posts).filter(([d]) => !process.env.POST || d === process.env.POST)) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (let i = 0; i < p.slides.length; i++) {
      await page.setContent(shell(p.t, p.cat, i + 1, p.slides.length, p.src, p.slides[i]), { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(['800 40px Fraunces','italic 800 40px Fraunces','500 20px Manrope','700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f))); });
      await page.screenshot(process.env.JPG ? { path: path.join(OUT, dir, `slide-${i + 1}.jpg`), type: 'jpeg', quality: 92 } : { path: path.join(OUT, dir, `slide-${i + 1}.png`) });
    }
  }
  await browser.close();
  console.log('done');
})();
