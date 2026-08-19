import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const reviews = JSON.parse(await readFile(new URL('../reviews.json', import.meta.url), 'utf8'));
const scheduleEvents = [...html.matchAll(/<article class="date-row" data-schedule-event data-event-date="([^"]+)">([\s\S]*?)<\/article>/g)]
  .map(([, date, markup]) => ({ date, markup }));
const scheduleMarkup = scheduleEvents.map(({ markup }) => markup).join('\n');
const expectedDates = [
  '2026-08-22', '2026-08-28', '2026-08-29', '2026-09-06', '2026-09-18',
  '2026-10-01', '2026-10-22', '2026-11-06', '2026-11-12', '2026-12-10'
];

test('uses one apex canonical and truthful Morgantown positioning', () => {
  assert.match(html, /rel="canonical" href="https:\/\/djvato\.com\/"/);
  assert.match(html, /Morgantown, West Virginia/);
  assert.match(html, /not an established North Carolina office/i);
});

test('keeps approved public pricing and does not expose a private floor', () => {
  assert.match(html, /Nightlife \+ College[\s\S]*Custom/);
  assert.match(html, /Private Events[\s\S]*Starting at<\/sup>\$500/);
  assert.match(html, /Wedding Reception[\s\S]*Starting at<\/sup>\$1,000/);
  assert.match(html, /Full Wedding[\s\S]*Starting at<\/sup>\$1,500/);
  assert.match(html, /Large-Scale \/ Production-Heavy[\s\S]*Custom/);
  assert.doesNotMatch(html, /\$400/);
  assert.doesNotMatch(html, /\$600|\$900/);
});

test('provides mobile, reduced-motion, and keyboard gallery behavior', () => {
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(html, /<dialog class="lightbox"/);
});

test('publishes exactly the ten verified public dates in chronological order', () => {
  assert.equal(scheduleEvents.length, 10);
  assert.deepEqual(scheduleEvents.map(({ date }) => date), expectedDates);
  assert.equal((scheduleMarkup.match(/Ivy Nightclub/g) || []).length, 2);
  assert.equal((scheduleMarkup.match(/Joe Mama's/g) || []).length, 8);
  assert.doesNotMatch(scheduleMarkup, /Dick(?:'|&rsquo;)s Sporting Goods/i);
  assert.doesNotMatch(scheduleMarkup, /private/i);
  assert.doesNotMatch(scheduleMarkup, /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:a\.?m\.?|p\.?m\.?)\b/i);
});

test('progressively enhances the schedule without hiding dates from source HTML', () => {
  assert.match(html, /href="#dates">Dates<\/a>/);
  assert.match(html, /aria-controls="dates-upcoming-list" aria-expanded="false" data-dates-toggle hidden/);
  assert.match(html, /View full fall schedule/);
  assert.match(html, /Show fewer dates|data-dates-toggle-label/);
  assert.match(html, /New public dates will be posted here as they are confirmed\./);
  assert.equal((html.match(/data-recent-event/g) || []).length, 3);
  assert.match(script, /event\.dataset\.eventDate < todayKey/);
  assert.match(script, /event\.dataset\.eventDate === todayKey/);
  assert.match(script, /index >= 3/);
  assert.match(script, /dates_schedule_toggle/);
  assert.match(script, /setAttribute\('aria-expanded'/);
});

test('implements the single-subject hero and scroll-led narrative as progressive enhancement', () => {
  assert.match(html, /class="hero-subject"/);
  assert.doesNotMatch(html, /class="hero-crowd"|class="hero-decks"/);
  assert.match(html, /data-story-stage/);
  assert.match(html, /data-media-journey/);
  assert.match(css, /min-height:165svh/);
  assert.match(css, /position: sticky/);
  assert.match(script, /setStoryIndex/);
  assert.match(script, /--media-x/);
  assert.doesNotMatch(html, /mix-manifesto|04 \/ Live mixing|Watch\.<br>Adjust\. Mix\.|LISTEN<\/span><span>READ/);
  assert.doesNotMatch(script, /mixSection|--mix-shift|--mix-scale/);
});

test('keeps the refined palette restrained and the service proof image properly selected', () => {
  assert.doesNotMatch(css, /#d7ff38|215\s*,\s*255\s*,\s*56/i);
  assert.match(css, /\.type-river \{[^}]*background: #0b0a11/);
  assert.match(html, /class="spectrum-visual reveal"[\s\S]*ivy-vato-led-1536\.jpg/);
});

test('uses curated responsive media without exposing source or blocked files', () => {
  assert.match(html, /assets\/media\/hero-ivy-live-1560\.jpg/);
  assert.match(html, /srcset="assets\/media\/hero-ivy-live-960\.jpg 960w/);
  assert.match(html, /assets\/media\/ivy-live-mixing-clean-1024\.jpg/);
  assert.match(html, /assets\/media\/mebane-room-1152\.jpg/);
  assert.match(html, /assets\/media\/mebane-booth-1152\.jpg/);
  assert.doesNotMatch(html, /media-input\//);
  for (const blockedId of ['1E7C5999', '83ACB0C2', 'E4EC9E30']) {
    assert.doesNotMatch(`${html}\n${script}`, new RegExp(blockedId, 'i'));
  }
});

test('routes booking through the existing inquiry form without publishing an unapproved email', () => {
  assert.match(html, /action="https:\/\/formspree\.io\/f\/xlgyeqkq"/);
  assert.doesNotMatch(html, /mailto:/i);
  assert.doesNotMatch(html, /bookings@djvato\.com/i);
});

test('retains production analytics, media, and public trust routes', () => {
  assert.match(html, /G-1SQVER0811/);
  assert.match(html, /https:\/\/g\.page\/r\/CR0kMmEMyEyyEBM\/review/);
  assert.match(html, /assets\/media\/ivy-live-mixing-clean-1024\.jpg/);
  assert.match(html, /https:\/\/instagram\.com\/vince_w29/);
});

test('renders only available review records', () => {
  assert.equal(reviews.length, 4);
  for (const review of reviews) {
    assert.ok(review.name);
    assert.ok(review.excerpt);
    assert.ok(review.source);
    assert.ok(Number.isInteger(review.rating));
  }
});
