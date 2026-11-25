import { readFileSync, statSync } from 'node:fs';

// An MP4 carries a sound track only if one of its 'hdlr' boxes has handler type 'soun'.
const hasSoundTrack = (buffer) => {
  for (let index = buffer.indexOf('hdlr'); index !== -1; index = buffer.indexOf('hdlr', index + 4)) {
    if (buffer.toString('latin1', index + 12, index + 16) === 'soun') return true;
  }
  return false;
};

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const script = readFileSync('script.js', 'utf8');
const reviews = JSON.parse(readFileSync('reviews.json', 'utf8'));
const manifest = JSON.parse(readFileSync('site.webmanifest', 'utf8'));
const requiredFiles = [
  'index.html', 'styles.css', 'script.js', 'reviews.json', 'robots.txt', 'sitemap.xml',
  'site.webmanifest', 'CNAME', 'logo.png', 'assets/vato-share-card.png', 'assets/media/vato-wordmark-480.png',
  'assets/media/hero-vato-tall.mp4', 'assets/media/hero-vato-tall.jpg',
  'assets/media/hero-vato-desktop.mp4', 'assets/media/hero-vato-desktop.jpg',
  'assets/media/hero-ivy-live-960.jpg', 'assets/media/hero-ivy-live-1560.jpg',
  'assets/media/ivy-packed-crowd-640.jpg', 'assets/media/ivy-packed-crowd-1152.jpg',
  'assets/media/ivy-vato-led-640.jpg', 'assets/media/ivy-vato-led-1536.jpg',
  'assets/media/ivy-live-mixing-clean-640.jpg', 'assets/media/ivy-live-mixing-clean-1024.jpg',
  'assets/media/ivy-booth-crowd-640.jpg', 'assets/media/ivy-booth-crowd-1170.jpg',
  'assets/media/ivy-side-performance-640.jpg', 'assets/media/ivy-side-performance-1152.jpg',
  'assets/media/ivy-crowd-decks-640.jpg', 'assets/media/ivy-crowd-decks-1242.jpg',
  'assets/media/joe-mamas-live-640.jpg', 'assets/media/joe-mamas-live-837.jpg',
  'assets/media/ivy-vato-wall-640.jpg', 'assets/media/ivy-vato-wall-828.jpg',
  'assets/media/mebane-room-640.jpg', 'assets/media/mebane-room-1152.jpg',
  'assets/media/mebane-booth-640.jpg', 'assets/media/mebane-booth-1152.jpg'
];

const failures = [];
for (const path of requiredFiles) {
  try { statSync(path); } catch { failures.push(`Missing required file: ${path}`); }
}

const videoTags = [...html.matchAll(/<video\b[^>]*>/g)].map(([tag]) => tag);
const videoFiles = [...new Set([...html.matchAll(/data-src(?:-tall|-wide)?="([^"]+\.mp4)"/g)].map(([, path]) => path))];
for (const path of videoFiles) {
  try {
    const buffer = readFileSync(path);
    if (buffer.length > 2.6 * 1024 * 1024) failures.push(`${path} is ${(buffer.length / 1048576).toFixed(2)} MB; keep clips at or under about 2.5 MB.`);
    if (hasSoundTrack(buffer)) failures.push(`${path} has an audio track; clips must be silent files.`);
  } catch { failures.push(`Missing clip: ${path}`); }
}

const scheduleEvents = [...html.matchAll(/<article class="date-row" data-schedule-event data-event-date="([^"]+)">([\s\S]*?)<\/article>/g)]
  .map(([, date, markup]) => ({ date, markup }));
const expectedDates = [
  '2026-08-22', '2026-08-28', '2026-08-29', '2026-09-06', '2026-09-18',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-22', '2026-10-23',
  '2026-10-28', '2026-10-30', '2026-10-31', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
  '2026-11-12', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-30', '2026-12-10', '2026-12-31'
];
const publicVenues = ['Ivy Nightclub', "Joe Mama's", '123 Pleasant Street', 'Yellow Banana', 'WVU Volleyball', 'WVU Women&rsquo;s Basketball'];
const scheduleMarkup = scheduleEvents.map(({ markup }) => markup).join('\n');
const scheduleVenues = scheduleEvents.map(({ markup }) => markup.match(/<h3>([^<]+)<\/h3>/)?.[1]);

const checks = [
  [html.includes('<link rel="canonical" href="https://djvato.com/">'), 'Canonical URL must be https://djvato.com/.'],
  [html.includes('class="lightbox"'), 'Accessible gallery lightbox is missing.'],
  [html.includes('prefers-reduced-motion') || css.includes('prefers-reduced-motion'), 'Reduced-motion support is missing.'],
  [html.includes('Nightlife + College') && html.includes('Custom'), 'Nightlife and college pricing must be custom.'],
  [html.includes('Private Events') && html.includes('Starting at</sup>$500'), 'Private events must start at $500.'],
  [html.includes('Wedding Reception') && html.includes('Starting at</sup>$1,000'), 'Wedding receptions must start at $1,000.'],
  [html.includes('Full Wedding') && html.includes('Starting at</sup>$1,500'), 'Full weddings must start at $1,500.'],
  [html.includes('Large-Scale / Production-Heavy'), 'Large-scale production-heavy events must be custom quoted.'],
  [JSON.stringify(scheduleEvents.map(({ date }) => date)) === JSON.stringify(expectedDates), 'The verified fall schedule must contain exactly the confirmed dates, in chronological order.'],
  [scheduleVenues.every((venue) => publicVenues.includes(venue)), `Only ${publicVenues.join(', ')} may appear in the public schedule.`],
  [!scheduleMarkup.match(/Dick(?:'|&rsquo;)s Sporting Goods|private/i), 'Unconfirmed or private bookings must not appear in the public schedule.'],
  [html.includes('href="#dates">Dates</a>') && html.includes('aria-controls="dates-upcoming-list"') && html.includes('aria-expanded="false"'), 'Accessible Dates navigation and schedule controls are required.'],
  [html.includes('New public dates will be posted here as they are confirmed.'), 'The no-future-dates fallback is missing.'],
  [(html.match(/data-recent-event/g) || []).length === 3, 'Exactly three initial recently played entries are required.'],
  [script.includes('dates_schedule_toggle') && script.includes("setAttribute('aria-expanded'"), 'Schedule toggle analytics or accessibility state handling is missing.'],
  [script.includes('event.dataset.eventDate < todayKey') && script.includes('event.dataset.eventDate === todayKey') && script.includes('index >= 3'), 'Expired, Tonight, or recent-date limiting logic is missing.'],
  [!html.includes('mix-manifesto') && !html.includes('04 / Live mixing') && !script.includes('mixSection'), 'The replaced live-mixing scene must not remain.'],
  [html.includes('data-hero-video') && html.includes('assets/media/hero-vato-tall.jpg'), 'The hero clip of Vince and its poster are missing.'],
  [videoTags.length >= 1 && videoTags.length <= 2, `Use one or two clips on the page, not ${videoTags.length}.`],
  [videoTags.every((tag) => / muted\b/.test(tag) && / playsinline\b/.test(tag) && !/ controls\b| autoplay\b/.test(tag)), 'Every clip must be muted, inline, with no controls or autoplay attribute.'],
  [!/<audio\b|<iframe\b/i.test(html), 'No audio players or embeds: the site carries no music.'],
  [!/\bAI\b/.test(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')), 'The word AI must not appear on the page.'],
  [html.includes('https://www.tiktok.com/@vato.official'), 'TikTok link is missing.'],
  [html.includes('assets/media/mebane-room-1152.jpg') && html.includes('assets/media/mebane-booth-1152.jpg'), 'Mebane wedding proof media is incomplete.'],
  [!html.includes('media-input/'), 'Source media must never be referenced by the public page.'],
  [!html.includes('YOUR_FORM_ID') && !html.includes('EDIT_your'), 'Unresolved production placeholders remain.'],
  [Array.isArray(reviews) && reviews.length > 0, 'At least one legitimate review is required.'],
  [manifest.start_url === '/', 'Manifest start URL must stay at the domain root.']
];
for (const [passed, message] of checks) if (!passed) failures.push(message);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) failures.push(`Duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);

const localReferences = [...html.matchAll(/(?:src|href)="(?!https?:|mailto:|sms:|#)([^"?]+)"/g)]
  .map((match) => match[1])
  .filter((path) => !path.startsWith('data:'));
const srcsetReferences = [...html.matchAll(/srcset="([^"]+)"/g)]
  .flatMap((match) => match[1].split(',').map((candidate) => candidate.trim().split(/\s+/)[0]));
for (const path of [...new Set([...localReferences, ...srcsetReferences])]) {
  try { statSync(path); } catch { failures.push(`Broken local reference: ${path}`); }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${requiredFiles.length} required files, ${ids.length} unique IDs, ${localReferences.length} local references, ${videoFiles.length} silent clips, and ${reviews.length} reviews.`);
