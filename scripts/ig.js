#!/usr/bin/env node
// Instagram API (Instagram Login) for @worldbrief_official. Token comes ONLY from the IG_TOKEN environment variable;
// never print it, never write it to a file or commit it.
//
//   node scripts/ig.js me                                   account id + username (checks the token)
//   node scripts/ig.js carousel <caption-file> <url1> <url2> ...   publish a carousel (JPEG URLs, 2-10)
//   node scripts/ig.js reel <caption-file> <mp4-url> [cover-jpg-url] publish a Reel
//   node scripts/ig.js recent [n]                           last n posts with permalink + insights
//   node scripts/ig.js comments [days]                      comments on recent posts that we haven't replied to
//   node scripts/ig.js reply <comment-id> <text-file>       reply to a comment
//   node scripts/ig.js refresh                              refresh the 60-day token (prints only the new expiry)
//   node scripts/ig.js limit                                publishing quota used in the last 24 h
//
// Media URLs must be public (raw.githubusercontent.com links to files pushed to this repo work).
const fs = require('fs');

const VERSION = process.env.IG_API_VERSION || 'v23.0';
const GRAPH = `https://graph.instagram.com/${VERSION}`;
const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) {
  console.error('IG_TOKEN is not set in this environment. Add it in the Claude cloud environment settings.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, params = {}) {
  const url = new URL(path.startsWith('http') ? path : GRAPH + path);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res =
      method === 'GET'
        ? await fetch(`${url}?${body}`)
        : await fetch(url, { method, body });
    if (res.status < 500 && res.status !== 429) break;
    await sleep(3000 * (attempt + 1));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new Error(`Instagram API ${res.status}: ${e.message || 'error'} (code ${e.code || '?'}${e.error_subcode ? '/' + e.error_subcode : ''})`);
  }
  return data;
}

async function me() {
  const p = await call('GET', '/me', { fields: 'user_id,username,account_type,followers_count,media_count' });
  return { id: String(p.user_id || p.id), username: p.username, type: p.account_type, followers: p.followers_count, posts: p.media_count };
}

async function waitAndPublish(igId, containerId) {
  for (let i = 0; i < 60; i++) {
    const s = await call('GET', `/${containerId}`, { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') break;
    if (['ERROR', 'EXPIRED'].includes(s.status_code)) throw new Error(`Media failed: ${s.status_code} ${s.status || ''}`);
    await sleep(5000);
  }
  const d = await call('POST', `/${igId}/media_publish`, { creation_id: containerId });
  const m = await call('GET', `/${d.id}`, { fields: 'permalink,timestamp' }).catch(() => ({}));
  return { mediaId: d.id, permalink: m.permalink || null };
}

const readCaption = (f) => fs.readFileSync(f, 'utf8').trim().slice(0, 2200);

async function carousel(captionFile, urls) {
  if (urls.length < 2 || urls.length > 10) throw new Error('A carousel needs 2-10 image URLs');
  if (urls.some((u) => !/\.jpe?g($|\?)/i.test(u))) throw new Error('Carousel images must be JPEG');
  const { id } = await me();
  const children = [];
  for (const u of urls) children.push((await call('POST', `/${id}/media`, { image_url: u, is_carousel_item: 'true' })).id);
  const c = await call('POST', `/${id}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: readCaption(captionFile) });
  return waitAndPublish(id, c.id);
}

async function reel(captionFile, videoUrl, coverUrl) {
  const { id } = await me();
  const c = await call('POST', `/${id}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: readCaption(captionFile),
    share_to_feed: 'true',
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  });
  return waitAndPublish(id, c.id);
}

async function insights(mediaId, type) {
  const sets = type === 'VIDEO' || type === 'REELS'
    ? ['reach,views,likes,comments,shares,saved,ig_reels_avg_watch_time', 'reach,views,likes,comments,shares,saved']
    : ['reach,views,likes,comments,shares,saved', 'reach,likes,comments,saved'];
  for (const metric of sets) {
    try {
      const rows = (await call('GET', `/${mediaId}/insights`, { metric })).data || [];
      return Object.fromEntries(rows.map((r) => [r.name, r.values?.[0]?.value ?? r.total_value?.value ?? null]));
    } catch (e) { /* try the smaller set */ }
  }
  return {};
}

async function recent(n = 12) {
  const { id } = await me();
  const d = await call('GET', `/${id}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count', limit: String(n) });
  const out = [];
  for (const m of d.data || []) out.push({ id: m.id, when: m.timestamp, type: m.media_product_type || m.media_type, link: m.permalink, title: (m.caption || '').split('\n')[0].slice(0, 80), likes: m.like_count, comments: m.comments_count, ...(await insights(m.id, m.media_product_type || m.media_type)) });
  return out;
}

async function comments(days = 3) {
  const acc = await me();
  const since = Date.now() - days * 864e5;
  const d = await call('GET', `/${acc.id}/media`, { fields: 'id,timestamp,permalink,caption', limit: '25' });
  const todo = [];
  for (const m of (d.data || []).filter((x) => Date.parse(x.timestamp) >= since)) {
    const c = await call('GET', `/${m.id}/comments`, { fields: 'id,text,username,timestamp,replies{id,text,username}', limit: '50' }).catch(() => ({ data: [] }));
    for (const x of c.data || []) {
      if (x.username === acc.username) continue;
      const answered = (x.replies?.data || []).some((r) => r.username === acc.username);
      if (!answered) todo.push({ commentId: x.id, post: m.permalink, postTitle: (m.caption || '').split('\n')[0].slice(0, 60), user: x.username, text: x.text, at: x.timestamp });
    }
  }
  return todo;
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  let out;
  if (cmd === 'me') out = await me();
  else if (cmd === 'carousel') out = await carousel(a[0], a.slice(1));
  else if (cmd === 'reel') out = await reel(a[0], a[1], a[2]);
  else if (cmd === 'recent') out = await recent(Number(a[0] || 12));
  else if (cmd === 'comments') out = await comments(Number(a[0] || 3));
  else if (cmd === 'reply') out = await call('POST', `/${a[0]}/replies`, { message: fs.readFileSync(a[1], 'utf8').trim().slice(0, 2200) });
  else if (cmd === 'limit') {
    const { id } = await me();
    const d = await call('GET', `/${id}/content_publishing_limit`, { fields: 'config,quota_usage' });
    out = { used: d.data?.[0]?.quota_usage, total: d.data?.[0]?.config?.quota_total };
  } else if (cmd === 'refresh') {
    const d = await call('GET', 'https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token' });
    out = { refreshed: true, expiresInDays: Math.round((d.expires_in || 0) / 86400), note: 'Update IG_TOKEN in the cloud environment only if Instagram returned a different token.' };
  } else {
    console.error('Unknown command. See the top of scripts/ig.js.');
    process.exit(2);
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
