import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const chromePath = chromePaths.find((path) => {
  try { return Boolean(process.getBuiltinModule('node:fs').statSync(path)); } catch { return false; }
});
if (!chromePath) throw new Error('Google Chrome is required for browser qualification.');

const outputDir = process.env.VATO_QA_OUTPUT || join(process.cwd(), 'qa-output');
const siteUrl = new URL(process.env.VATO_QA_BASE_URL || 'http://127.0.0.1:4173/');
await mkdir(outputDir, { recursive: true });
const profileDir = await mkdtemp(join(tmpdir(), 'vato-site-qa-'));
const browser = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer',
  '--disable-features=Vulkan,UseSkiaRenderer,SkiaGraphite,DawnGraphite',
  '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
  '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
const stopBrowserOnExit = () => {
  if (!browser.killed) browser.kill();
};
process.once('exit', stopBrowserOnExit);
let chromeStderr = '';
browser.stderr.setEncoding('utf8');
browser.stderr.on('data', (chunk) => {
  chromeStderr = `${chromeStderr}${chunk}`.slice(-6000);
});

const endpoint = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Chrome debugging endpoint timed out.')), 15000);
  browser.stderr.on('data', (chunk) => {
    const match = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (!match) return;
    clearTimeout(timer);
    resolve(match[1]);
  });
  browser.once('exit', (code) => reject(new Error(`Chrome exited before startup (${code}).`)));
});

const debugOrigin = endpoint.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
const targets = await fetch(`${debugOrigin}/json/list`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === 'page');
if (!target) throw new Error('Chrome did not expose an initial page target.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let requestId = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.message}: ${message.error.data || ''}`));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) {
    const text = message.params.entry.text;
    if (!text.includes('googletagmanager') && !text.includes('fonts.googleapis')) browserErrors.push(text);
  }
});
socket.addEventListener('close', () => {
  const diagnostic = chromeStderr.trim().replaceAll('\n', ' | ');
  for (const { reject } of pending.values()) reject(new Error(`Chrome target closed before the QA command completed.${diagnostic ? ` ${diagnostic}` : ''}`));
  pending.clear();
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`Chrome DevTools command timed out: ${method}`));
  }, 15000);
  pending.set(id, {
    resolve: (value) => { clearTimeout(timer); resolve(value); },
    reject: (error) => { clearTimeout(timer); reject(error); }
  });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const load = async (url = siteUrl.href) => {
  await send('Page.navigate', { url });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate('document.readyState') === 'complete') break;
    await wait(100);
  }
  await wait(900);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const widths = [320, 360, 390, 430, 768, 1366, 1440];
const viewportResults = [];
for (const width of widths) {
  const height = width < 600 ? 844 : width < 1000 ? 1024 : 900;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await load();
  const metrics = await evaluate(`(() => {
    const overflow = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).slice(0, 8).map((element) => element.tagName.toLowerCase() + '.' + [...element.classList].join('.'));
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflow,
      title: document.title,
      heroVisible: (() => {
        const hero = document.querySelector('.hero-content');
        const rect = hero.getBoundingClientRect();
        return getComputedStyle(hero).visibility !== 'hidden' && rect.bottom > 0 && rect.top < innerHeight;
      })(),
      heroSubjectLoaded: document.querySelector('.hero-subject img').complete && document.querySelector('.hero-subject img').naturalWidth > 0
    };
  })()`);
  viewportResults.push(metrics);
  if (metrics.scrollWidth > width + 1 || !metrics.heroVisible || !metrics.heroSubjectLoaded) {
    throw new Error(`Horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`);
  }
}

await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
await load();
await evaluate(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const story = document.querySelector('.residency-story');
  scrollTo(0, story.offsetTop + innerHeight * 2.15);
})()`);
await wait(400);
const storyInteraction = await evaluate(`({
  activeIndex: Number(document.querySelector('.residency-story').dataset.active),
  activeFrames: document.querySelectorAll('.story-frame.is-active').length,
  activeSteps: document.querySelectorAll('.story-step.is-active').length,
  stagePosition: getComputedStyle(document.querySelector('.story-pin')).position,
  stageTop: document.querySelector('.story-pin').getBoundingClientRect().top
})`);
if (storyInteraction.activeIndex < 1 || storyInteraction.activeFrames !== 1 || storyInteraction.activeSteps !== 1 || storyInteraction.stagePosition !== 'sticky' || Math.abs(storyInteraction.stageTop) > 2) {
  throw new Error(`Scroll story qualification failed: ${JSON.stringify(storyInteraction)}`);
}

await evaluate(`(() => {
  const journey = document.querySelector('.media-journey');
  scrollTo(0, journey.offsetTop + innerHeight * 1.5);
})()`);
await wait(400);
const mediaInteraction = await evaluate(`({
  transform: getComputedStyle(document.querySelector('.media-track')).transform,
  progress: getComputedStyle(document.querySelector('.media-journey')).getPropertyValue('--media-progress').trim()
})`);
if (mediaInteraction.transform === 'none' || !mediaInteraction.progress || mediaInteraction.progress === '0%') {
  throw new Error(`Scroll media qualification failed: ${JSON.stringify(mediaInteraction)}`);
}

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await load();
const mobileInteractions = await evaluate(`(async () => {
  document.querySelector('.menu-toggle').click();
  const menuOpen = document.querySelector('.site-nav').classList.contains('is-open') && document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'true';
  document.querySelector('.menu-toggle').click();
  document.querySelector('[data-gallery-index="0"]').click();
  const lightboxOpen = document.querySelector('.lightbox').open;
  document.querySelector('.lightbox-close').click();
  document.querySelector('#booking-form').requestSubmit();
  const invalidFields = document.querySelectorAll('#booking-form [aria-invalid="true"]').length;
  const firstFaq = document.querySelector('.faq details');
  firstFaq.querySelector('summary').click();
  const mediaViewport = document.querySelector('.media-viewport');
  return { menuOpen, lightboxOpen, invalidFields, faqOpen: firstFaq.open, mediaScrollable: mediaViewport.scrollWidth > mediaViewport.clientWidth };
})()`);
if (!mobileInteractions.menuOpen || !mobileInteractions.lightboxOpen || mobileInteractions.invalidFields < 5 || !mobileInteractions.faqOpen || !mobileInteractions.mediaScrollable) {
  throw new Error(`Mobile interaction qualification failed: ${JSON.stringify(mobileInteractions)}`);
}

await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await load();
const reducedMotion = await evaluate(`({
  requested: matchMedia('(prefers-reduced-motion: reduce)').matches,
  revealsVisible: [...document.querySelectorAll('.reveal')].every((element) => getComputedStyle(element).opacity === '1'),
  mediaTransform: getComputedStyle(document.querySelector('.media-track')).transform,
  storyPosition: getComputedStyle(document.querySelector('.story-pin')).position,
  storyContentVisible: [...document.querySelectorAll('.story-step')].every((element) => getComputedStyle(element).opacity === '1')
})`);
if (!reducedMotion.requested || !reducedMotion.revealsVisible || reducedMotion.mediaTransform !== 'none' || reducedMotion.storyPosition !== 'relative' || !reducedMotion.storyContentVisible) {
  throw new Error(`Reduced-motion qualification failed: ${JSON.stringify(reducedMotion)}`);
}

const captureSet = async (width, height, prefix) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await load();
  await evaluate(`(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const reveals = [...document.querySelectorAll('.reveal:not(.gallery-item)')];
    for (const element of reveals) {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 800));
  })()`);
  const hiddenReveals = await evaluate(`[...document.querySelectorAll('.reveal:not(.gallery-item)')].filter((element) => !element.classList.contains('is-visible')).length`);
  if (hiddenReveals) throw new Error(`${hiddenReveals} reveal elements did not activate before screenshot capture.`);
  const captures = [
    ['top', '#top'],
    ['story', '.residency-story'],
    ['services', '#services'],
    ['service-image', '.spectrum-visual'],
    ['mix', '.mix-manifesto'],
    ['gallery', '#gallery'],
    ['wedding', '.wedding-proof'],
    ['wedding-media', '.wedding-collage'],
    ['pricing', '#pricing'],
    ['pricing-rows', '.scope-list'],
    ['booking', '#booking'],
    ['booking-form', '#booking-form']
  ];
  for (const [name, selector] of captures) {
    const exists = await evaluate(`Boolean(document.querySelector('${selector}'))`);
    if (!exists) continue;
    await evaluate(`(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const target = document.querySelector('${selector}');
      const targetTop = target.getBoundingClientRect().top + scrollY;
      const storyOffset = '${name}' === 'story'
        ? Math.max(0, target.offsetHeight - innerHeight) * .46
        : 0;
      scrollTo(0, Math.max(0, targetTop + storyOffset - 76));
    })()`);
    if (name === 'story') {
      await evaluate(`(async () => {
        const image = document.querySelector('.story-frame.is-active img');
        if (image && !image.complete) await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }));
        if (image?.decode) await image.decode().catch(() => {});
      })()`);
    }
    await wait(name === 'story' ? 500 : 200);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    await writeFile(join(outputDir, `${prefix}-${name}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  // Sticky scroll scenes intentionally consume several viewports. Capture the
  // complete page in its first-class reduced-motion mode so the evidence shows
  // the entire narrative instead of empty sticky-scroll travel.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load();
  await evaluate(`(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((image) => { image.loading = 'eager'; });
    const step = Math.max(500, innerHeight * .8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {}) ?? Promise.resolve()));
    scrollTo(0, 0);
  })()`);
  await wait(500);
  await evaluate(`(() => {
    const target = document.querySelector('.residency-story');
    scrollTo(0, Math.max(0, target.getBoundingClientRect().top + scrollY - 76));
  })()`);
  await wait(250);
  const reducedStory = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(join(outputDir, `${prefix}-story-reduced.png`), Buffer.from(reducedStory.data, 'base64'));
  await evaluate(`scrollTo(0, 0)`);
  await wait(250);
  const fullPage = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, captureBeyondViewport: true, fromSurface: true });
  await writeFile(join(outputDir, `${prefix}-full-page.jpg`), Buffer.from(fullPage.data, 'base64'));
};
await captureSet(390, 844, 'vato-after-mobile');
await captureSet(1440, 900, 'vato-after-desktop');

const contactRouting = await evaluate(`({
  formAction: document.querySelector('#booking-form').action,
  mailtoLinks: document.querySelectorAll('a[href^="mailto:"]').length,
  publishedBookingEmail: document.body.innerText.includes('bookings@djvato.com')
})`);
if (contactRouting.formAction !== 'https://formspree.io/f/xlgyeqkq' || contactRouting.mailtoLinks !== 0 || contactRouting.publishedBookingEmail) {
  throw new Error(`Booking contact qualification failed: ${JSON.stringify(contactRouting)}`);
}

const productionIdentity = await evaluate(`({
  heroImage: document.querySelector('.hero-subject img')?.getAttribute('src'),
  serviceImage: document.querySelector('.spectrum-visual img')?.getAttribute('src'),
  prices: [...document.querySelectorAll('.scope-row')].map((row) => row.innerText.replaceAll('\\n', ' ').replace(/\\s+/g, ' ').trim()),
  sms: document.querySelector('a[href^="sms:"]')?.getAttribute('href'),
  instagram: document.querySelector('a[href*="instagram.com"]')?.getAttribute('href')
})`);
const productionIdentityValid =
  productionIdentity.heroImage === 'assets/media/ivy-live-mixing-clean-1024.jpg' &&
  productionIdentity.serviceImage === 'assets/media/ivy-vato-led-1536.jpg' &&
  productionIdentity.prices.some((price) => price.includes('Nightclub / Bar') && price.includes('Custom')) &&
  productionIdentity.prices.some((price) => price.includes('College / Private') && price.includes('Custom')) &&
  productionIdentity.prices.some((price) => price.includes('Larger Private Events') && price.includes('$600')) &&
  productionIdentity.prices.some((price) => price.includes('Wedding Reception') && price.includes('$900') && price.includes('$1,500')) &&
  productionIdentity.sms === 'sms:+13362794506' &&
  productionIdentity.instagram === 'https://instagram.com/vince_w29';
if (!productionIdentityValid) {
  throw new Error(`Production identity qualification failed: ${JSON.stringify(productionIdentity)}`);
}

const localLinks = await evaluate(`[...new Set([...document.querySelectorAll('[href], [src]')]
  .flatMap((element) => [element.getAttribute('href'), element.getAttribute('src')])
  .filter((value) => value && !value.startsWith('#') && !/^(https?:|mailto:|sms:|data:)/.test(value)))]`);
const localChecks = [];
for (const path of localLinks) {
  const response = await fetch(new URL(path, siteUrl));
  localChecks.push({ path, status: response.status });
  if (!response.ok) throw new Error(`Broken local link: ${path} (${response.status})`);
}

socket.close();
const browserExit = new Promise((resolve) => browser.once('exit', resolve));
browser.kill();
await Promise.race([browserExit, wait(3000)]);
await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
process.removeListener('exit', stopBrowserOnExit);

if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`);
console.log(JSON.stringify({ siteUrl: siteUrl.href, viewportResults, storyInteraction, mediaInteraction, mobileInteractions, reducedMotion, contactRouting, productionIdentity, localChecks, screenshots: outputDir }, null, 2));
