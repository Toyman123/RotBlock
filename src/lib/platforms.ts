import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type AppId = 'youtube' | 'instagram' | 'linkedin';

export type Rule = {
  key: string;
  label: string;
  /** Short name shown struck-through on the home card. */
  short: string;
  description: string;
  default: boolean;
};

/** Config consumed by the in-page filter engine (see engine.ts). */
export type FilterConfig = {
  enabled: boolean;
  css: string;
  redirects: { from: string; to: string; rule: string }[];
  overlays: {
    when: string;
    rule: string;
    title: string;
    body: string;
    search?: string; // path template with %s
    links: { label: string; href: string }[];
  }[];
  textHide: { selector: string; contains: string; rule: string }[];
  overlayTop: number;
};

export type Platform = {
  id: AppId;
  name: string;
  tagline: string;
  url: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Card / header colour for this app. */
  color: string;
  rules: Rule[];
  build: (r: Record<string, boolean>) => Omit<FilterConfig, 'enabled'>;
};

const sel = (...s: string[]) => s.join(',\n');
const hide = (selectors: string) => `${selectors} { display: none !important; }\n`;

export const PLATFORMS: Record<AppId, Platform> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    tagline: 'Search & subscriptions only',
    url: 'https://m.youtube.com/',
    icon: 'logo-youtube',
    color: '#D9432A',
    rules: [
      { key: 'hideShorts', label: 'Block Shorts', short: 'Shorts', description: 'Removes the Shorts tab, shelves and links. Shorts open as normal videos.', default: true },
      { key: 'hideHome', label: 'Hide home feed', short: 'Home feed', description: 'Replaces the algorithmic homepage with a search box.', default: true },
      { key: 'hideRecommended', label: 'Hide recommendations', short: 'Up next', description: 'Removes "Up next" and end-screen suggestions under videos.', default: false },
      { key: 'hideComments', label: 'Hide comments', short: 'Comments', description: 'Removes the comment section on videos.', default: false },
    ],
    build: (r) => {
      let css = hide(sel('ytm-mealbar-promo-renderer', 'ytm-statement-banner-renderer', 'ytm-promoted-sparkles-web-renderer', 'ytm-companion-ad-renderer'));
      const redirects: FilterConfig['redirects'] = [];
      const overlays: FilterConfig['overlays'] = [];
      if (r.hideShorts) {
        css += hide(sel(
          'ytm-reel-shelf-renderer', 'ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]',
          'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
          'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
          'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2)',
          'ytm-rich-item-renderer:has(a[href^="/shorts"])',
          'ytm-video-with-context-renderer:has(a[href^="/shorts"])',
          'ytm-compact-video-renderer:has(a[href^="/shorts"])',
          'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
          'ytd-guide-entry-renderer:has(a[title="Shorts"])',
          'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
          'yt-chip-cloud-chip-renderer:has([title="Shorts"])',
        ));
        redirects.push({ from: '^/shorts/([^/?#]+).*$', to: '/watch?v=$1', rule: 'Shorts' });
      }
      if (r.hideHome) {
        css += hide('html.rb-ov ytm-browse ytm-rich-grid-renderer, html.rb-ov ytm-browse ytm-section-list-renderer');
        overlays.push({
          when: '^/$',
          rule: 'Home feed',
          title: 'What did you come here for?',
          body: 'The homepage feed is hidden. Search for something specific.',
          search: '/results?search_query=%s',
          links: [
            { label: 'Subscriptions', href: '/feed/subscriptions' },
            { label: 'Library', href: '/feed/library' },
            { label: 'History', href: '/feed/history' },
          ],
        });
      }
      if (r.hideRecommended) {
        css += hide(sel(
          'ytm-item-section-renderer[section-identifier="related-items"]',
          'ytm-single-column-watch-next-results-renderer ytm-item-section-renderer:not(:first-child)',
          'ytd-watch-next-secondary-results-renderer', '#related',
          '.ytp-endscreen-content', '.ytp-ce-element', '.videowall-endscreen', 'ytm-autonav-bar',
        ));
      }
      if (r.hideComments) {
        css += hide(sel('ytm-comments-entry-point-header-renderer', 'ytm-comment-section-renderer', 'ytd-comments', '#comments', 'ytm-engagement-panel-section-list-renderer[target-id*="comment"]'));
      }
      return { css, redirects, overlays, textHide: [], overlayTop: 48 };
    },
  },

  instagram: {
    id: 'instagram',
    name: 'Instagram',
    tagline: 'Messages without the Reels',
    url: 'https://www.instagram.com/',
    icon: 'logo-instagram',
    color: '#8A2F6E',
    rules: [
      { key: 'messagesOnly', label: 'Messages only', short: 'All but DMs', description: 'Locks Instagram to your DMs. Everything else is off-limits.', default: false },
      { key: 'hideReels', label: 'Block Reels tab', short: 'Reels', description: 'Removes the Reels tab and blocks the endless Reels feed.', default: true },
      { key: 'blockSharedReels', label: 'Block shared Reels too', short: 'Shared Reels', description: 'Also blocks individual Reels friends send you.', default: false },
      { key: 'hideExplore', label: 'Block Explore', short: 'Explore', description: 'Removes the Explore / search grid.', default: true },
      { key: 'hideFeed', label: 'Hide home feed', short: 'Feed', description: 'Hides the scrolling home feed.', default: false },
    ],
    build: (r) => {
      let css = '';
      const redirects: FilterConfig['redirects'] = [];
      const overlays: FilterConfig['overlays'] = [];
      const dmLinks = [{ label: 'Open messages', href: '/direct/inbox/' }];
      if (r.messagesOnly) {
        redirects.push({
          from: '^(?!/direct|/accounts|/challenge|/api|/oauth|/emails|/legal|/privacy|/auth_platform).*$',
          to: '/direct/inbox/',
          rule: 'Messages only',
        });
        css += hide(sel('a[href="/"]', 'a[href="/explore/"]', 'a[href="/reels/"]', 'a[href^="/reels"]', 'a[href="#"][role="link"]:has(svg[aria-label="New post"])', 'svg[aria-label="New post"]'));
      }
      if (r.hideReels || r.messagesOnly) {
        css += hide(sel('a[href="/reels/"]', 'a[href^="/reels/"]'));
        overlays.push({ when: '^/reels(/|$)', rule: 'Reels', title: 'Reels are blocked', body: 'No infinite scroll today.', links: dmLinks });
      }
      if (r.blockSharedReels) {
        overlays.push({ when: '^/reels?/', rule: 'Reels', title: 'Reels are blocked', body: 'Even the ones friends send you.', links: dmLinks });
      }
      if (r.hideExplore) {
        css += hide('a[href="/explore/"]');
        overlays.push({ when: '^/explore', rule: 'Explore', title: 'Explore is blocked', body: 'Nothing to discover here but more scrolling.', links: dmLinks });
      }
      if (r.hideFeed) {
        css += hide('html.rb-ov main article');
        overlays.push({ when: '^/$', rule: 'Home feed', title: 'Feed hidden', body: 'Go talk to people instead.', links: [...dmLinks, { label: 'Notifications', href: '/accounts/activity/' }] });
      }
      return { css, redirects, overlays, textHide: [], overlayTop: 0 };
    },
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    tagline: 'Network, jobs & DMs — no feed',
    url: 'https://www.linkedin.com/',
    icon: 'logo-linkedin',
    color: '#2D4FA1',
    rules: [
      { key: 'hideFeed', label: 'Hide feed', short: 'Feed', description: 'Hides the home feed. Messages, jobs and your network still work.', default: true },
      { key: 'hidePromoted', label: 'Hide promoted posts', short: 'Ads', description: 'Removes sponsored posts wherever they appear.', default: true },
      { key: 'hideBadges', label: 'Hide red badges', short: 'Badges', description: 'Removes notification counters that pull you back in.', default: false },
      { key: 'messagesOnly', label: 'Messages only', short: 'All but DMs', description: 'Locks LinkedIn to your inbox.', default: false },
    ],
    build: (r) => {
      let css = '';
      const redirects: FilterConfig['redirects'] = [];
      const overlays: FilterConfig['overlays'] = [];
      const textHide: FilterConfig['textHide'] = [];
      if (r.messagesOnly) {
        redirects.push({
          from: '^(?!/messaging|/login|/checkpoint|/uas|/authwall|/signup|/oauth|/legal|/psettings).*$',
          to: '/messaging/',
          rule: 'Messages only',
        });
      }
      if (r.hideFeed) {
        css += hide(sel('html.rb-ov .feed-shared-update-v2', 'html.rb-ov [data-id^="urn:li:activity"]', 'html.rb-ov main .scaffold-finite-scroll'));
        overlays.push({
          when: '^/(feed/?)?$',
          rule: 'Feed',
          title: 'Feed hidden',
          body: 'Here for something specific? Pick it below.',
          search: '/search/results/all/?keywords=%s',
          links: [
            { label: 'Messages', href: '/messaging/' },
            { label: 'Jobs', href: '/jobs/' },
            { label: 'My network', href: '/mynetwork/' },
            { label: 'Notifications', href: '/notifications/' },
          ],
        });
      }
      if (r.hidePromoted) {
        textHide.push({ selector: '.feed-shared-update-v2, [data-id^="urn:li:activity"], article', contains: 'Promoted', rule: 'Promoted' });
      }
      if (r.hideBadges) {
        css += hide(sel('.notification-badge', '.nav-item__badge', '[class*="badge-count"]', '[data-test-notification-badge]'));
      }
      return { css, redirects, overlays, textHide, overlayTop: 0 };
    },
  },
};

export const PLATFORM_LIST: Platform[] = [PLATFORMS.youtube, PLATFORMS.instagram, PLATFORMS.linkedin];

export const defaultRules = (p: Platform) =>
  Object.fromEntries(p.rules.map((r) => [r.key, r.default])) as Record<string, boolean>;
