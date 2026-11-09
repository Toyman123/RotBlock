import type { FilterConfig } from './platforms';

/**
 * The filter engine is injected into the WebView before the site's own code
 * runs. It keeps a <style> tag in place, guards SPA navigation (redirects and
 * full-screen "blocked" overlays) and reports every block back to the app.
 *
 * NOTE: this must stay a plain string. Hermes strips function source, so
 * Function.toString() can't be used to ship code into the page.
 */
const ENGINE = String.raw`
(function () {
  var cfg = __RB_CFG__;
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
`;

/** Raw engine source with a __RB_CFG__ placeholder (used by the Safari userscript build). */
export const ENGINE_SOURCE = ENGINE;

export function buildInjection(cfg: FilterConfig) {
  const json = JSON.stringify(cfg);
  // function replacer so "$1" inside the config isn't treated as a pattern
  return ENGINE.replace('__RB_CFG__', () => json);
}

export function buildUpdate(cfg: FilterConfig) {
  return `window.__rb && window.__rb.update(${JSON.stringify(cfg)}); true;`;
}
