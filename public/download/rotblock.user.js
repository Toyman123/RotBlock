// ==UserScript==
// @name         RotBlock
// @description  Hides Shorts, Reels and endless feeds on YouTube, Instagram and LinkedIn.
// @version      1.1.0
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
// @updateURL    https://rotblock.vercel.app/rotblock.user.js
// @downloadURL  https://rotblock.vercel.app/rotblock.user.js
// ==/UserScript==

(function () {
  var VERSION = '1.1.0';
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

  var host = location.hostname.replace(/^(www|m)\./, '');

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
  var DEFAULTS = {"youtube":{"enabled":true,"css":"ytm-mealbar-promo-renderer,\nytm-statement-banner-renderer,\nytm-promoted-sparkles-web-renderer,\nytm-companion-ad-renderer { display: none !important; }\nytm-reel-shelf-renderer,\nytd-reel-shelf-renderer,\nytd-rich-shelf-renderer[is-shorts],\nytm-shorts-lockup-view-model,\nytm-shorts-lockup-view-model-v2,\nytm-rich-section-renderer:has(ytm-shorts-lockup-view-model),\nytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2),\nytm-rich-item-renderer:has(a[href^=\"/shorts\"]),\nytm-video-with-context-renderer:has(a[href^=\"/shorts\"]),\nytm-compact-video-renderer:has(a[href^=\"/shorts\"]),\nytm-pivot-bar-item-renderer:has(.pivot-shorts),\nytd-guide-entry-renderer:has(a[title=\"Shorts\"]),\nytd-mini-guide-entry-renderer[aria-label=\"Shorts\"],\nyt-chip-cloud-chip-renderer:has([title=\"Shorts\"]) { display: none !important; }\nhtml.rb-ov ytm-browse ytm-rich-grid-renderer, html.rb-ov ytm-browse ytm-section-list-renderer { display: none !important; }\n","redirects":[{"from":"^/shorts/([^/?#]+).*$","to":"/watch?v=$1","rule":"Shorts"}],"overlays":[{"when":"^/$","rule":"Home feed","title":"What did you come here for?","body":"The homepage feed is hidden. Search for something specific.","search":"/results?search_query=%s","links":[{"label":"Subscriptions","href":"/feed/subscriptions"},{"label":"Library","href":"/feed/library"},{"label":"History","href":"/feed/history"}]}],"textHide":[],"overlayTop":48},"instagram":{"enabled":true,"css":"a[href=\"/reels/\"],\na[href^=\"/reels/\"] { display: none !important; }\na[href=\"/explore/\"] { display: none !important; }\n","redirects":[],"overlays":[{"when":"^/reels(/|$)","rule":"Reels","title":"Reels are blocked","body":"No infinite scroll today.","links":[{"label":"Open messages","href":"/direct/inbox/"}]},{"when":"^/explore","rule":"Explore","title":"Explore is blocked","body":"Nothing to discover here but more scrolling.","links":[{"label":"Open messages","href":"/direct/inbox/"}]}],"textHide":[],"overlayTop":0},"linkedin":{"enabled":true,"css":"html.rb-ov .feed-shared-update-v2,\nhtml.rb-ov [data-id^=\"urn:li:activity\"],\nhtml.rb-ov main .scaffold-finite-scroll { display: none !important; }\n","redirects":[],"overlays":[{"when":"^/(feed/?)?$","rule":"Feed","title":"Feed hidden","body":"Here for something specific? Pick it below.","search":"/search/results/all/?keywords=%s","links":[{"label":"Messages","href":"/messaging/"},{"label":"Jobs","href":"/jobs/"},{"label":"My network","href":"/mynetwork/"},{"label":"Notifications","href":"/notifications/"}]}],"textHide":[{"selector":".feed-shared-update-v2, [data-id^=\"urn:li:activity\"], article","contains":"Promoted","rule":"Promoted"}],"overlayTop":0}};
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
      saved && saved.enabled === false ? 'RotBlock is paused' : 'RotBlock is on \u2713');
    document.body.appendChild(tag);
    requestAnimationFrame(function () { tag.style.opacity = '1'; tag.style.transform = 'translate(-50%,0)'; });
    setTimeout(function () { tag.style.opacity = '0'; setTimeout(function () { tag.remove(); }, 400); }, 2200);
  });

  // ── Sign-in prompt when you're signed out (YouTube, Instagram).
  // LinkedIn already sends signed-out visitors to its own login page.
  function signedOut() {
    var c = document.cookie;
    if (id === 'youtube') return !/(^|; )(SAPISID|__Secure-3PAPISID)=/.test(c);
    if (id === 'instagram') return !/(^|; )ds_user_id=/.test(c) && location.pathname.indexOf('/accounts/') !== 0 && location.pathname.indexOf('/challenge') !== 0;
    return false;
  }
  function loginUrl() {
    if (id === 'youtube') return 'https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://m.youtube.com/');
    return 'https://www.instagram.com/accounts/login/?next=' + encodeURIComponent(location.pathname + location.search);
  }
  function showLogin() {
    try { if (sessionStorage.getItem('rotblock:login-skip')) return; } catch (e) {}
    if (!signedOut() || document.getElementById('rb-login')) return;
    var name = id === 'youtube' ? 'YouTube' : 'Instagram';
    var wrap = el('div', FONT + 'position:fixed;inset:0;z-index:2147483647;background:rgba(13,13,16,.4);display:flex;align-items:flex-end;justify-content:center');
    wrap.id = 'rb-login';
    var sheet = el('div', 'width:100%;max-width:520px;background:#fff;border-radius:24px 24px 0 0;padding:24px 22px calc(env(safe-area-inset-bottom,0px) + 22px);box-sizing:border-box');
    sheet.appendChild(el('div', 'font-size:13px;color:#5E5E66;font-weight:500', 'RotBlock'));
    sheet.appendChild(el('div', 'font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.8px;color:#0D0D10;margin:4px 0 8px', 'Sign in to ' + name));
    sheet.appendChild(el('div', 'font-size:15px;line-height:1.45;color:#5E5E66;margin-bottom:20px', (id === 'youtube' ? 'You\u2019re signed out, so your subscriptions and history won\u2019t show.' : 'You\u2019re signed out, so your messages won\u2019t show.') + ' Your filters work either way.'));
    var go = el('a', 'display:block;text-align:center;background:#0D0D10;color:#fff;text-decoration:none;font-size:17px;font-weight:700;padding:17px;border-radius:999px', 'Sign in');
    go.href = loginUrl();
    var skip = el('button', 'display:block;width:100%;margin-top:10px;background:none;border:0;color:#5E5E66;font-size:15px;font-weight:500;padding:12px', 'Not now');
    skip.addEventListener('click', function () {
      try { sessionStorage.setItem('rotblock:login-skip', '1'); } catch (e) {}
      wrap.remove();
    });
    sheet.appendChild(go); sheet.appendChild(skip); wrap.appendChild(sheet);
    document.body.appendChild(wrap);
  }
  // Give the page a moment so cookies set during load are visible.
  whenBody(function () { setTimeout(showLogin, 1200); });


(function () {
  var cfg = saved;
  if (window.__rb) { window.__rb.update(cfg); return; }

  var BASE = [
    '#rb-ov{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#FAFAF8;color:#0D0D10;',
    'display:flex;align-items:center;justify-content:center;padding:28px;box-sizing:border-box;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:rbIn .35s ease-out}',
    '@keyframes rbIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '#rb-ov .rb-card{width:100%;max-width:420px;text-align:center}',
    '#rb-ov .rb-badge{width:64px;height:64px;border-radius:20px;margin:0 auto 22px;background:#0D0D10;',
    'display:flex;align-items:center;justify-content:center}',
    '#rb-ov h1{font-size:26px;line-height:1.15;margin:0 0 10px;font-weight:700;letter-spacing:-1px}',
    '#rb-ov p{font-size:15px;color:#5E5E66;margin:0 0 24px;line-height:1.45}',
    '#rb-ov form{display:flex;gap:8px;margin:0 0 18px}',
    '#rb-ov input{flex:1;min-width:0;background:#FFFFFF;border:1px solid #ECECEA;color:#0D0D10;border-radius:999px;padding:14px 18px;font-size:16px;outline:none}',
    '#rb-ov input:focus{border-color:#0D0D10}',
    '#rb-ov button{background:#0D0D10;color:#FFFFFF;border:0;border-radius:999px;padding:0 20px;font-weight:600;font-size:15px}',
    '#rb-ov .rb-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
    '#rb-ov .rb-links a{color:#0D0D10;text-decoration:none;border:1px solid #ECECEA;background:#FFFFFF;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600}',
    '#rb-ov .rb-links a:active,#rb-ov button:active{transform:scale(.96)}',
    '#rb-ov .rb-foot{margin-top:28px;font-size:11px;letter-spacing:2px;color:#A3A3AB;font-weight:700}'
  ].join('');

  var lastOverlay = null;
  var lastPath = null;

  function post(m) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
    // Safari userscript build defines __rbReport to count blocks.
    try { if (typeof __rbReport === "function") __rbReport(m); } catch (e) {}
  }

  function ensureStyle() {
    var root = document.head || document.documentElement;
    if (!root) return;
    var s = document.getElementById('rb-style');
    if (!s) { s = document.createElement('style'); s.id = 'rb-style'; root.appendChild(s); }
    var css = BASE + (cfg.enabled ? cfg.css : '');
    if (s.textContent !== css) s.textContent = css;
  }

  // Built with DOM calls, not innerHTML: YouTube enforces Trusted Types,
  // which rejects HTML strings.
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function badge() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "30"); svg.setAttribute("height", "30"); svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "#FFFFFF"); svg.setAttribute("stroke-width", "2.6");
    svg.setAttribute("stroke-linecap", "round");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M6 6l12 12M18 6L6 18");
    svg.appendChild(p);
    var b = h("div", "rb-badge");
    b.appendChild(svg);
    return b;
  }

  function showOverlay(o) {
    var el = document.getElementById("rb-ov");
    if (el && lastOverlay === o.title) return;
    if (el) el.remove();
    lastOverlay = o.title;
    if (!document.body) return;
    el = h("div");
    el.id = "rb-ov";
    el.style.top = (cfg.overlayTop || 0) + "px";
    var card = h("div", "rb-card");
    card.appendChild(badge());
    card.appendChild(h("h1", null, o.title));
    card.appendChild(h("p", null, o.body));
    if (o.search) {
      var form = h("form");
      var input = h("input");
      input.type = "search"; input.placeholder = "Search…"; input.setAttribute("enterkeyhint", "search");
      var btn = h("button", null, "Go");
      btn.type = "submit";
      form.appendChild(input); form.appendChild(btn);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (q) location.href = o.search.replace("%s", encodeURIComponent(q));
      });
      card.appendChild(form);
    }
    var links = h("div", "rb-links");
    for (var i = 0; i < o.links.length; i++) {
      var a = h("a", null, o.links[i].label);
      a.href = o.links[i].href;
      links.appendChild(a);
    }
    card.appendChild(links);
    card.appendChild(h("div", "rb-foot", "BLOCKED BY ROTBLOCK"));
    el.appendChild(card);
    document.body.appendChild(el);
    document.documentElement.classList.add("rb-ov");
    post({ type: "blocked", rule: o.rule });
  }

  function hideOverlay() {
    var el = document.getElementById('rb-ov');
    if (el) el.remove();
    lastOverlay = null;
    document.documentElement && document.documentElement.classList.remove('rb-ov');
  }

  function check() {
    ensureStyle();
    if (!cfg.enabled) { hideOverlay(); return; }
    var p = location.pathname;
    var i, re;

    for (i = 0; i < cfg.redirects.length; i++) {
      var r = cfg.redirects[i];
      re = new RegExp(r.from);
      if (re.test(p)) {
        var to = p.replace(re, r.to);
        if (to !== p && to !== p + location.search) {
          post({ type: 'blocked', rule: r.rule });
          location.replace(to);
          return;
        }
      }
    }

    var hit = null;
    for (i = 0; i < cfg.overlays.length; i++) {
      if (new RegExp(cfg.overlays[i].when).test(p)) { hit = cfg.overlays[i]; break; }
    }
    if (hit) showOverlay(hit); else hideOverlay();

    for (i = 0; i < cfg.textHide.length; i++) {
      var t = cfg.textHide[i];
      var nodes = document.querySelectorAll(t.selector);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.__rbChecked) continue;
        var txt = n.innerText || '';
        if (txt.length > 40) n.__rbChecked = true;
        if (txt.indexOf(t.contains) !== -1) {
          n.style.setProperty('display', 'none', 'important');
          n.__rbChecked = true;
          post({ type: 'blocked', rule: t.rule });
        }
      }
    }

    if (p !== lastPath) { lastPath = p; post({ type: 'nav', path: p }); }
  }

  ['pushState', 'replaceState'].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var res = orig.apply(this, arguments); setTimeout(check, 0); return res; };
  });
  window.addEventListener('popstate', check);
  document.addEventListener('DOMContentLoaded', check);
  setInterval(check, 500);

  window.__rb = { update: function (c) { cfg = c; lastOverlay = null; check(); } };
  check();
})();
true;

})();
