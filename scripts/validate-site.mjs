import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const script = readFileSync('script.js', 'utf8');
const reviews = JSON.parse(readFileSync('reviews.json', 'utf8'));
const manifest = JSON.parse(readFileSync('site.webmanifest', 'utf8'));
const requiredFiles = [
  'index.html', 'styles.css', 'script.js', 'reviews.json', 'robots.txt', 'sitemap.xml',
  'site.webmanifest', 'CNAME', 'logo.png', 'assets/vato-share-card.png',
  'assets/media/hero-ivy-live-960.jpg', 'assets/media/hero-ivy-live-1560.jpg',
  'assets/media/ivy-packed-crowd-640.jpg', 'assets/media/ivy-packed-crowd-1152.jpg',
  'assets/media/ivy-vato-led-640.jpg', 'assets/media/ivy-vato-led-1536.jpg',
  'assets/media/ivy-live-mixing-640.jpg', 'assets/media/ivy-live-mixing-1152.jpg',
  'assets/media/ivy-booth-crowd-640.jpg', 'assets/media/ivy-booth-crowd-1170.jpg',
  'assets/media/ivy-side-performance-640.jpg', 'assets/media/ivy-side-performance-1152.jpg',
  'assets/media/ivy-crowd-decks-640.jpg', 'assets/media/ivy-crowd-decks-1242.jpg',
  'assets/media/joe-mamas-live-640.jpg', 'assets/media/joe-mamas-live-837.jpg',
  'assets/media/ivy-vato-wall-640.jpg', 'assets/media/ivy-vato-wall-828.jpg',
  'assets/media/production-controller-640.jpg', 'assets/media/production-controller-1536.jpg',
  'assets/media/mebane-room-640.jpg', 'assets/media/mebane-room-1152.jpg',
  'assets/media/mebane-booth-640.jpg', 'assets/media/mebane-booth-1152.jpg'
];

const failures = [];
for (const path of requiredFiles) {
  try { statSync(path); } catch { failures.push(`Missing required file: ${path}`); }
}

const scheduleEvents = [...html.matchAll(/<article class="date-row" data-schedule-event data-event-date="([^"]+)">([\s\S]*?)<\/article>/g)]
  .map(([, date, markup]) => ({ date, markup }));
const expectedDates = [
  '2026-08-22', '2026-08-28', '2026-08-29', '2026-09-06', '2026-09-18',
  '2026-10-01', '2026-10-22', '2026-11-06', '2026-11-12', '2026-12-10'
];
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
  [JSON.stringify(scheduleEvents.map(({ date }) => date)) === JSON.stringify(expectedDates), 'The verified fall schedule must contain exactly ten chronologically ordered dates.'],
  [scheduleVenues.every((venue) => venue === 'Ivy Nightclub' || venue === "Joe Mama's"), 'Only Ivy Nightclub and Joe Mama\'s may appear in the public schedule.'],
  [!scheduleMarkup.match(/Dick(?:'|&rsquo;)s Sporting Goods|private/i), 'Unconfirmed or private bookings must not appear in the public schedule.'],
  [html.includes('href="#dates">Dates</a>') && html.includes('aria-controls="dates-upcoming-list"') && html.includes('aria-expanded="false"'), 'Accessible Dates navigation and schedule controls are required.'],
  [html.includes('New public dates will be posted here as they are confirmed.'), 'The no-future-dates fallback is missing.'],
  [(html.match(/data-recent-event/g) || []).length === 3, 'Exactly three initial recently played entries are required.'],
  [script.includes('dates_schedule_toggle') && script.includes("setAttribute('aria-expanded'"), 'Schedule toggle analytics or accessibility state handling is missing.'],
  [script.includes('event.dataset.eventDate < todayKey') && script.includes('event.dataset.eventDate === todayKey') && script.includes('index >= 3'), 'Expired, Tonight, or recent-date limiting logic is missing.'],
  [!html.includes('mix-manifesto') && !html.includes('04 / Live mixing') && !script.includes('mixSection'), 'The replaced live-mixing scene must not remain.'],
  [html.includes('assets/media/hero-ivy-live-1560.jpg'), 'Curated nightlife hero is missing.'],
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

console.log(`Validated ${requiredFiles.length} required files, ${ids.length} unique IDs, ${localReferences.length} local references, and ${reviews.length} reviews.`);
