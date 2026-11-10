/**
 * Builds public/rotblock.user.js — the Safari "Userscripts" add-on that does
 * RotBlock's blocking on iPhone, where the web app can't filter other sites.
 *
 * Uses the exact same engine + filter rules as the native app. On top of the
 * engine it adds, for the iPhone setup:
 *  - a sign-in prompt on YouTube when you're signed out
 *  - a brief "RotBlock is on" tag so you can see the blocker is running
 *  - block counts, shared with the RotBlock app via the add-on's storage
 *  - a marker on the RotBlock site so the app can show "Blocker: active"
 *
 * Run: node scripts/build-userscript.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ENGINE_SOURCE } from '../src/lib/engine.ts';
import { PLATFORM_LIST, defaultRules } from '../src/lib/platforms.ts';

const defaults = Object.fromEntries(
  PLATFORM_LIST.map((p) => [p.id, { enabled: true, ...p.build(defaultRules(p)) }]),
);

const VERSION = '1.2.0';
const SITE = 'https://rotblock.vercel.app';

const script = `// ==UserScript==
// @name         RotBlock
// @description  Hides Shorts, Reels and endless feeds on YouTube, Instagram and LinkedIn.
// @version      ${VERSION}
// @match        *://m.youtube.com/*
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @match        *://www.instagram.com/*
// @match        *://instagram.com/*
// @match        *://www.linkedin.com/*
// @match        *://linkedin.com/*
// @match        *://rotblock.vercel.app/*
// @match        *://localhost/*
// @run-at       document-start
// @inject-into  content
// @grant        GM.getValue
// @grant        GM.setValue
// @updateURL    ${SITE}/rotblock.user.js
// @downloadURL  ${SITE}/rotblock.user.js
// ==/UserScript==

(function () {
  var VERSION = '${VERSION}';
  var STATS_KEY = 'rotblock:stats';
  var hasGM = typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function';
  function today() { return new Date().toISOString().slice(0, 10); }
  function zero() { return { youtube: 0, instagram: 0, linkedin: 0 }; }
  function emptyStats() { return { day: today(), total: 0, today: 0, byApp: zero(), todayByApp: zero() }; }
  function loadStats() {
    if (!hasGM) return Promise.resolve(emptyStats());
    return Promise.resolve(GM.getValue(STATS_KEY, null)).then(function (raw) {
      var s = null;
      try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
      if (!s || !s.byApp) s = emptyStats();
      if (s.day !== today()) { s.day = today(); s.today = 0; s.todayByApp = zero(); }
      return s;
    }).catch(function () { return emptyStats(); });
  }

  var host = location.hostname.replace(/^(www|m)\\./, '');

  // ── On the RotBlock site: tell the app the blocker is installed, and hand it the counts.
  if (host === 'rotblock.vercel.app' || host === 'localhost') {
    var mark = function (stats) {
      var root = document.documentElement;
      if (!root) return;
      root.setAttribute('data-rotblock-blocker', VERSION);
      if (stats) root.setAttribute('data-rotblock-stats', JSON.stringify(stats));
    };
    mark(null);
    loadStats().then(mark);
    // Refresh when you come back to RotBlock from another tab.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') loadStats().then(mark);
    });
    return;
  }

  var id = host.indexOf('youtube') === 0 ? 'youtube' : host.indexOf('instagram') === 0 ? 'instagram' : host.indexOf('linkedin') === 0 ? 'linkedin' : null;
  if (!id) return;

  // ── Count blocks (the engine calls __rbReport). Queue writes so they don't race.
  var writing = Promise.resolve();
  function __rbReport(m) {
    if (!m || m.type !== 'blocked' || !hasGM) return;
    writing = writing.then(function () {
      return loadStats().then(function (s) {
        s.total++; s.today++;
        s.byApp[id] = (s.byApp[id] || 0) + 1;
        s.todayByApp[id] = (s.todayByApp[id] || 0) + 1;
        return GM.setValue(STATS_KEY, JSON.stringify(s));
      });
    }).catch(function () {});
  }

  // ── Filters: from the RotBlock link (#rb=...), else last saved, else defaults.
  var DEFAULTS = ${JSON.stringify(defaults)};
  var KEY = 'rotblock:cfg';
  var saved = null;
  var m = location.hash.match(/[#&]rb=([^&]+)/);
  if (m) {
    try {
      saved = JSON.parse(decodeURIComponent(m[1]));
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch (e) {}
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  }
  if (!saved) { try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} }
  if (!saved) saved = DEFAULTS[id];

  // ── UI helpers (DOM calls only — YouTube rejects HTML strings).
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function whenBody(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  var FONT = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  // ── "RotBlock is on" tag, once per tab, so you can see the blocker running.
  whenBody(function () {
    try { if (sessionStorage.getItem('rotblock:tag')) return; sessionStorage.setItem('rotblock:tag', '1'); } catch (e) {}
    var tag = el('div', FONT + 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translate(-50%,-8px);' +
      'z-index:2147483647;background:#0D0D10;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:999px;' +
      'opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.25)',
      saved && saved.enabled === false ? 'RotBlock is paused' : 'RotBlock is on \\u2713');
    document.body.appendChild(tag);
    requestAnimationFrame(function () { tag.style.opacity = '1'; tag.style.transform = 'translate(-50%,0)'; });
    setTimeout(function () { tag.style.opacity = '0'; setTimeout(function () { tag.remove(); }, 400); }, 2200);
  });

  // ── Sign-in prompt, YouTube only. Instagram and LinkedIn already show their
  // own login screen when you're signed out.
  //
  // Signed-in state comes from YouTube's own page data ("LOGGED_IN": true/false
  // in an inline script), not cookies: YouTube's sign-in cookies aren't always
  // visible to scripts, which made the old check say "signed out" when you
  // weren't. If the flag can't be found, stay quiet rather than guess.
  var SKIP_KEY = 'rotblock:login-skip-until';
  function youtubeSignedOut() {
    var scripts = document.querySelectorAll('script:not([src])');
    for (var i = 0; i < scripts.length; i++) {
      var hit = (scripts[i].textContent || '').match(/"LOGGED_IN"\\s*:\\s*(true|false)/);
      if (hit) return hit[1] === 'false';
    }
    return false;
  }
  function skipped() {
    try { return Number(localStorage.getItem(SKIP_KEY) || 0) > Date.now(); } catch (e) { return false; }
  }
  function loginUrl() {
    return 'https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://m.youtube.com/');
  }
  function showLogin() {
    if (id !== 'youtube' || skipped() || !youtubeSignedOut() || document.getElementById('rb-login')) return;
    var name = 'YouTube';
    var wrap = el('div', FONT + 'position:fixed;inset:0;z-index:2147483647;background:rgba(13,13,16,.4);display:flex;align-items:flex-end;justify-content:center');
    wrap.id = 'rb-login';
    var sheet = el('div', 'width:100%;max-width:520px;background:#fff;border-radius:24px 24px 0 0;padding:24px 22px calc(env(safe-area-inset-bottom,0px) + 22px);box-sizing:border-box');
    sheet.appendChild(el('div', 'font-size:13px;color:#5E5E66;font-weight:500', 'RotBlock'));
    sheet.appendChild(el('div', 'font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.8px;color:#0D0D10;margin:4px 0 8px', 'Sign in to ' + name));
    sheet.appendChild(el('div', 'font-size:15px;line-height:1.45;color:#5E5E66;margin-bottom:20px', (id === 'youtube' ? 'You\\u2019re signed out, so your subscriptions and history won\\u2019t show.' : 'You\\u2019re signed out, so your messages won\\u2019t show.') + ' Your filters work either way.'));
    var go = el('a', 'display:block;text-align:center;background:#0D0D10;color:#fff;text-decoration:none;font-size:17px;font-weight:700;padding:17px;border-radius:999px', 'Sign in');
    go.href = loginUrl();
    var skip = el('button', 'display:block;width:100%;margin-top:10px;background:none;border:0;color:#5E5E66;font-size:15px;font-weight:500;padding:12px', 'Not now');
    skip.addEventListener('click', function () {
      // Don't ask again for a week.
      try { localStorage.setItem(SKIP_KEY, String(Date.now() + 7 * 24 * 3600 * 1000)); } catch (e) {}
      wrap.remove();
    });
    sheet.appendChild(go); sheet.appendChild(skip); wrap.appendChild(sheet);
    document.body.appendChild(wrap);
  }
  // Wait for the page's own data to load before checking.
  whenBody(function () { setTimeout(showLogin, 1500); });

${ENGINE_SOURCE.replace('__RB_CFG__', () => 'saved')}
})();
`;

writeFileSync(new URL('../public/rotblock.user.js', import.meta.url), script);
// Same file under /download/, served as an attachment (see public/vercel.json)
// so iPhone Safari saves it straight to Downloads instead of showing code.
mkdirSync(new URL('../public/download/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/download/rotblock.user.js', import.meta.url), script);
console.log(`wrote public/rotblock.user.js v${VERSION} (${(script.length / 1024).toFixed(1)} KB)`);
