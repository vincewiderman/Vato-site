import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const reviews = JSON.parse(await readFile(new URL('../reviews.json', import.meta.url), 'utf8'));

test('uses one apex canonical and truthful Morgantown positioning', () => {
  assert.match(html, /rel="canonical" href="https:\/\/djvato\.com\/"/);
  assert.match(html, /Morgantown, West Virginia/);
  assert.match(html, /not an established North Carolina office/i);
});

test('keeps approved public pricing and does not expose a private floor', () => {
  assert.match(html, /Starting at<\/sup>\$600/);
  assert.match(html, /Reception from<\/sup>\$900/);
  assert.match(html, /anchored at \$1,500/);
  assert.doesNotMatch(html, /\$400/);
});

test('provides mobile, reduced-motion, and keyboard gallery behavior', () => {
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(html, /<dialog class="lightbox"/);
});

test('implements the layered hero and scroll-led narrative as progressive enhancement', () => {
  assert.match(html, /class="hero-subject"/);
  assert.match(html, /data-story-stage/);
  assert.match(html, /data-media-journey/);
  assert.match(css, /min-height: 340svh/);
  assert.match(css, /position: sticky/);
  assert.match(script, /setStoryIndex/);
  assert.match(script, /--media-x/);
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

test('renders only available review records', () => {
  assert.equal(reviews.length, 4);
  for (const review of reviews) {
    assert.ok(review.name);
    assert.ok(review.excerpt);
    assert.ok(review.source);
    assert.ok(Number.isInteger(review.rating));
  }
});
