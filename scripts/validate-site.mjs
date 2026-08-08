import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
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

const checks = [
  [html.includes('<link rel="canonical" href="https://djvato.com/">'), 'Canonical URL must be https://djvato.com/.'],
  [html.includes('class="lightbox"'), 'Accessible gallery lightbox is missing.'],
  [html.includes('prefers-reduced-motion') || css.includes('prefers-reduced-motion'), 'Reduced-motion support is missing.'],
  [html.includes('Starting at</sup>$600'), 'Larger-event starting price must remain $600.'],
  [html.includes('Reception from</sup>$900'), 'Wedding reception starting price must remain $900.'],
  [html.includes('anchored at $1,500'), 'Full-wedding anchor must remain $1,500.'],
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
