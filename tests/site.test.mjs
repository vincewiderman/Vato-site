import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
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
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-22', '2026-10-23',
  '2026-10-28', '2026-10-30', '2026-10-31', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
  '2026-11-12', '2026-11-14', '2026-11-15', '2026-11-21', '2026-12-10', '2026-12-31'
];
const videoTags = [...html.matchAll(/<video\b[^>]*>/g)].map(([tag]) => tag);
const videoFiles = [...html.matchAll(/data-src(?:-tall|-wide)?="([^"]+\.mp4)"/g)].map(([, path]) => path);
const visibleText = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ');

// An MP4 carries a sound track only if one of its 'hdlr' boxes has handler type 'soun'.
const hasSoundTrack = (buffer) => {
  for (let index = buffer.indexOf('hdlr'); index !== -1; index = buffer.indexOf('hdlr', index + 4)) {
    if (buffer.toString('latin1', index + 12, index + 16) === 'soun') return true;
  }
  return false;
};

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

test('publishes exactly the verified public dates in chronological order', () => {
  assert.equal(scheduleEvents.length, expectedDates.length);
  assert.deepEqual(scheduleEvents.map(({ date }) => date), expectedDates);
  assert.equal((scheduleMarkup.match(/Ivy Nightclub/g) || []).length, 11);
  assert.equal((scheduleMarkup.match(/Joe Mama's/g) || []).length, 10);
  assert.equal((scheduleMarkup.match(/WVU Volleyball/g) || []).length, 2);
  assert.equal((scheduleMarkup.match(/123 Pleasant Street|Yellow Banana/g) || []).length, 2);
  assert.doesNotMatch(scheduleMarkup, /Dick(?:'|&rsquo;)s Sporting Goods/i);
  assert.doesNotMatch(scheduleMarkup, /private/i);
  const timed = scheduleEvents.filter(({ markup }) => /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:a\.?m\.?|p\.?m\.?)\b/i.test(markup));
  assert.deepEqual(timed.map(({ date }) => date), ['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-21']);   // only the times Vince gave (11-06) + Ivy 9 PM he gave and the WVU official 12:30 PM (11-11)
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
  for (const { markup } of scheduleEvents) assert.match(markup, /<span class="date-tonight" data-tonight hidden>Tonight<\/span>/);
});

test('opens on one steady clip of him and uses at most one more clip on the page', () => {
  assert.ok(videoTags.length >= 1 && videoTags.length <= 2, `expected 1-2 <video> elements, found ${videoTags.length}`);
  assert.match(html, /data-hero-video/);
  for (const tag of videoTags) {
    assert.match(tag, /\smuted\b/);
    assert.match(tag, /\splaysinline\b/);
    assert.match(tag, /\sloop\b/);
    assert.match(tag, /preload="none"/);
    assert.doesNotMatch(tag, /\scontrols\b|\sautoplay\b/);
  }
  assert.doesNotMatch(html, /<audio\b|<iframe\b|soundcloud|spotify|youtube\.com\/embed/i);
  assert.doesNotMatch(html, /reel-|class="reels|data-reel/);
  assert.match(script, /prefersReducedMotion\.matches && !saveData|!prefersReducedMotion\.matches && !saveData/);
  assert.match(script, /video\.muted = true/);
});

test('ships silent, phone-sized clips with posters', async () => {
  assert.ok(videoFiles.length >= 2, 'hero needs a phone and a desktop rendition');
  for (const path of new Set(videoFiles)) {
    const file = new URL(`../${path}`, import.meta.url);
    const { size } = await stat(file);
    assert.ok(size <= 2.6 * 1024 * 1024, `${path} is ${(size / 1048576).toFixed(2)} MB (limit about 2.5 MB)`);
    assert.equal(hasSoundTrack(await readFile(file)), false, `${path} must not contain an audio track`);
    const poster = path.replace(/\.mp4$/, '.jpg');
    assert.ok((await stat(new URL(`../${poster}`, import.meta.url))).size > 0, `${poster} poster is missing`);
  }
});

test('keeps WVU colors out of the branding and never says AI', () => {
  assert.doesNotMatch(css, /#eaaa00|#002855|#ffc600|#1c2b39/i);
  assert.doesNotMatch(css, /#d7ff38|215\s*,\s*255\s*,\s*56/i);
  assert.doesNotMatch(visibleText, /\bAI\b|artificial intelligence/i);
  assert.doesNotMatch(html, /alt="[^"]*\bAI\b/);
  assert.doesNotMatch(html, /Flying WV|wvu-logo|wvu\.png/i);
});

test('uses curated responsive media without exposing source or blocked files', () => {
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
  assert.match(html, /method="post"/);
  for (const field of ['name="_subject" value="New Booking Inquiry — VATO"', 'name="_next" value="https://djvato.com/?submitted=1#booking"', 'name="_gotcha"',
    'name="name"', 'name="email"', 'name="phone"', 'name="event_type"', 'name="event_date"', 'name="venue_city"', 'name="message"']) {
    assert.ok(html.includes(field), `booking form lost ${field}`);
  }
  assert.match(html, /An inquiry does not reserve the date\./);
  assert.doesNotMatch(html, /mailto:/i);
  assert.doesNotMatch(html, /bookings@djvato\.com/i);
});

test('retains production analytics, media, and public trust routes', () => {
  assert.match(html, /G-1SQVER0811/);
  assert.match(html, /https:\/\/g\.page\/r\/CR0kMmEMyEyyEBM\/review/);
  assert.match(html, /https:\/\/instagram\.com\/vince\.w_/);
  assert.match(html, /https:\/\/www\.tiktok\.com\/@vato\.official/);
  assert.match(html, /sms:\+13362794506/);
});

test('renders only available review records', () => {
  assert.equal(reviews.length, 4);
  for (const review of reviews) {
    assert.ok(review.name);
    assert.ok(review.excerpt);
    assert.ok(review.source);
    assert.ok(Number.isInteger(review.rating));
    assert.ok(html.includes(review.excerpt), `review by ${review.name} is not shown word for word`);
  }
});
