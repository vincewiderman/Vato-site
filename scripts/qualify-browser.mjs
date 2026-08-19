import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const chromePath = chromePaths.find((path) => {
  try { return Boolean(process.getBuiltinModule('node:fs').statSync(path)); } catch { return false; }
});
if (!chromePath) throw new Error('Google Chrome or Microsoft Edge is required for browser qualification.');

const outputDir = process.env.VATO_QA_OUTPUT || join(process.cwd(), 'qa-output');
const siteUrl = new URL(process.env.VATO_QA_BASE_URL || 'http://127.0.0.1:4173/');
await mkdir(outputDir, { recursive: true });
const profileDir = await mkdtemp(join(tmpdir(), 'vato-site-qa-'));
const browser = spawn(chromePath, [
  '--headless=new', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
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
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error([details.text, details.exception?.description, details.url && `${details.url}:${details.lineNumber + 1}`].filter(Boolean).join(' | '));
  }
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

const widths = [320, 360, 375, 390, 393, 430, 768, 1366, 1440];
const baselineScrollHeights = new Map([
  [320, 9985], [360, 10699], [375, 10141], [390, 10267], [393, 10299],
  [430, 10537], [768, 10634], [1366, 14618], [1440, 14769]
]);
const viewportResults = [];
for (const width of widths) {
  const height = width === 320 ? 700 : width === 375 ? 812 : width === 390 ? 844 : width === 393 ? 852 : width === 430 ? 932 : width < 1000 ? 1024 : 900;
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
      heroSubjectLoaded: document.querySelector('.hero-subject img').complete && document.querySelector('.hero-subject img').naturalWidth > 0,
      remainingDates: document.querySelectorAll('[data-upcoming-list] [data-schedule-event]').length,
      visibleDates: [...document.querySelectorAll('[data-upcoming-list] [data-schedule-event]')].filter((event) => !event.hidden).length,
      datesHeight: document.querySelector('#dates').offsetHeight,
      dateRowsReadable: [...document.querySelectorAll('[data-upcoming-list] [data-schedule-event]')].filter((event) => !event.hidden).every((event) => {
        const rect = event.getBoundingClientRect();
        return rect.width > 0 && rect.height >= 60 && event.querySelector('.date-row-place h3').getBoundingClientRect().width > 0;
      })
    };
  })()`);
  viewportResults.push(metrics);
  if (metrics.scrollWidth > width + 1 || metrics.scrollHeight > baselineScrollHeights.get(width) || !metrics.heroVisible || !metrics.heroSubjectLoaded || metrics.visibleDates !== Math.min(4, metrics.remainingDates) || !metrics.dateRowsReadable) {
    throw new Error(`Viewport qualification failed at ${width}px: ${JSON.stringify(metrics)}`);
  }
  await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const dates = document.querySelector('#dates');
    scrollTo(0, Math.max(0, dates.getBoundingClientRect().top + scrollY - 76));
    dates.querySelector('.dates-heading')?.classList.add('is-visible');
  })()`);
  await wait(250);
  const datesScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(join(outputDir, `viewport-${width}-dates.png`), Buffer.from(datesScreenshot.data, 'base64'));
}

await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
await load();
const datesInteraction = await evaluate(`(() => {
  const section = document.querySelector('[data-dates]');
  const toggle = section.querySelector('[data-dates-toggle]');
  const visibleUpcoming = () => [...section.querySelectorAll('[data-upcoming-list] [data-schedule-event]')].filter((event) => !event.hidden);
  const visibleRecent = () => [...section.querySelectorAll('[data-recent-list] .date-row')].filter((event) => !event.hidden);
  const analytics = [];
  window.gtag = (...args) => analytics.push(args);

  section.refreshDates('2026-08-18');
  const initial = {
    remaining: section.querySelectorAll('[data-upcoming-list] [data-schedule-event]').length,
    visible: visibleUpcoming().length,
    expanded: toggle.getAttribute('aria-expanded'),
    label: toggle.querySelector('[data-dates-toggle-label]').textContent
  };
  toggle.click();
  const expanded = {
    visible: visibleUpcoming().length,
    expanded: toggle.getAttribute('aria-expanded'),
    label: toggle.querySelector('[data-dates-toggle-label]').textContent
  };
  toggle.click();
  const collapsed = {
    visible: visibleUpcoming().length,
    expanded: toggle.getAttribute('aria-expanded'),
    label: toggle.querySelector('[data-dates-toggle-label]').textContent
  };

  section.refreshDates('2026-08-22');
  const tonight = [...section.querySelectorAll('.is-tonight')].map((event) => event.dataset.eventDate);
  section.refreshDates('2026-08-23');
  const expired = {
    remaining: section.querySelectorAll('[data-upcoming-list] [data-schedule-event]').length,
    recent: visibleRecent().map((event) => event.dataset.eventDate)
  };
  section.refreshDates('2027-01-01');
  const noFuture = {
    remaining: section.querySelectorAll('[data-upcoming-list] [data-schedule-event]').length,
    fallbackVisible: !section.querySelector('[data-dates-fallback]').hidden,
    recentCount: visibleRecent().length
  };
  section.refreshDates('2026-08-18');

  return { initial, expanded, collapsed, tonight, expired, noFuture, analytics };
})()`);
const validDatesInteraction =
  datesInteraction.initial.remaining === 10 && datesInteraction.initial.visible === 4 && datesInteraction.initial.expanded === 'false' &&
  datesInteraction.expanded.visible === 10 && datesInteraction.expanded.expanded === 'true' && datesInteraction.expanded.label === 'Show fewer dates' &&
  datesInteraction.collapsed.visible === 4 && datesInteraction.collapsed.expanded === 'false' && datesInteraction.collapsed.label === 'View full fall schedule' &&
  datesInteraction.tonight.length === 1 && datesInteraction.tonight[0] === '2026-08-22' &&
  datesInteraction.expired.remaining === 9 && datesInteraction.expired.recent.length === 3 && datesInteraction.expired.recent[0] === '2026-08-22' &&
  datesInteraction.noFuture.remaining === 0 && datesInteraction.noFuture.fallbackVisible && datesInteraction.noFuture.recentCount === 3 &&
  datesInteraction.analytics.length === 2 && datesInteraction.analytics.every((entry) => entry[0] === 'event' && entry[1] === 'dates_schedule_toggle');
if (!validDatesInteraction) throw new Error(`Dates interaction qualification failed: ${JSON.stringify(datesInteraction)}`);

await evaluate(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const story = document.querySelector('.residency-story');
  const storyTop = story.getBoundingClientRect().top + scrollY;
  scrollTo(0, storyTop + Math.max(0, story.offsetHeight - innerHeight) * .7);
  dispatchEvent(new Event('scroll'));
  if (typeof updateExperience === 'function') updateExperience();
})()`);
await wait(400);
const storyInteraction = await evaluate(`({
  activeIndex: Number(document.querySelector('.residency-story').dataset.active),
  activeFrames: document.querySelectorAll('.story-frame.is-active').length,
  activeSteps: document.querySelectorAll('.story-step.is-active').length,
  stagePosition: getComputedStyle(document.querySelector('.story-pin')).position,
  stageTop: document.querySelector('.story-pin').getBoundingClientRect().top,
  scrollY,
  storyTop: document.querySelector('.residency-story').getBoundingClientRect().top,
  storyHeight: document.querySelector('.residency-story').offsetHeight,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
})`);
if (storyInteraction.activeIndex < 1 || storyInteraction.activeFrames !== 1 || storyInteraction.activeSteps !== 1 || storyInteraction.stagePosition !== 'sticky' || Math.abs(storyInteraction.stageTop) > 2) {
  throw new Error(`Scroll story qualification failed: ${JSON.stringify(storyInteraction)}`);
}

await evaluate(`(() => {
  const journey = document.querySelector('.media-journey');
  const journeyTop = journey.getBoundingClientRect().top + scrollY;
  scrollTo(0, journeyTop + Math.max(0, journey.offsetHeight - innerHeight) * .7);
  dispatchEvent(new Event('scroll'));
  if (typeof updateExperience === 'function') updateExperience();
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
  const datesLink = document.querySelector('.site-nav a[href="#dates"]');
  const datesInMenu = Boolean(datesLink) && datesLink.getBoundingClientRect().height > 0;
  document.querySelector('.menu-toggle').click();
  document.querySelector('[data-gallery-index="0"]').click();
  const lightboxOpen = document.querySelector('.lightbox').open;
  document.querySelector('.lightbox-close').click();
  document.querySelector('#booking-form').requestSubmit();
  const invalidFields = document.querySelectorAll('#booking-form [aria-invalid="true"]').length;
  const firstFaq = document.querySelector('.faq details');
  firstFaq.querySelector('summary').click();
  const mediaViewport = document.querySelector('.media-viewport');
  return { menuOpen, datesInMenu, lightboxOpen, invalidFields, faqOpen: firstFaq.open, mediaScrollable: mediaViewport.scrollWidth > mediaViewport.clientWidth };
})()`);
if (!mobileInteractions.menuOpen || !mobileInteractions.datesInMenu || !mobileInteractions.lightboxOpen || mobileInteractions.invalidFields < 5 || !mobileInteractions.faqOpen || !mobileInteractions.mediaScrollable) {
  throw new Error(`Mobile interaction qualification failed: ${JSON.stringify(mobileInteractions)}`);
}
const mobilePerformance = await evaluate(`(() => {
  const resources = performance.getEntriesByType('resource');
  return {
    heroCurrentSrc: document.querySelector('.hero-subject img').currentSrc,
    desktopHeroBackgroundRequested: resources.some((entry) => entry.name.includes('hero-ivy-live')),
    resourceCount: resources.length,
    transferredBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    scriptBytes: resources.filter((entry) => entry.initiatorType === 'script').reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
    cssBytes: resources.filter((entry) => entry.initiatorType === 'link' && entry.name.endsWith('.css')).reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0)
  };
})()`);
if (!mobilePerformance.heroCurrentSrc.endsWith('ivy-live-mixing-clean-640.jpg') || mobilePerformance.desktopHeroBackgroundRequested) {
  throw new Error(`Mobile performance qualification failed: ${JSON.stringify(mobilePerformance)}`);
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

await send('Emulation.setScriptExecutionDisabled', { value: true });
await load();
const noJavaScriptSchedule = await evaluate(`({
  scheduleEntries: document.querySelectorAll('[data-schedule-event]').length,
  visibleScheduleEntries: [...document.querySelectorAll('[data-schedule-event]')].filter((event) => getComputedStyle(event).display !== 'none').length,
  recentEntries: document.querySelectorAll('[data-recent-event]').length,
  toggleHidden: document.querySelector('[data-dates-toggle]').hidden,
  heading: document.querySelector('#dates-title').textContent.replace(/\s+/g, ' ').trim()
})`);
if (noJavaScriptSchedule.scheduleEntries !== 10 || noJavaScriptSchedule.visibleScheduleEntries !== 10 || noJavaScriptSchedule.recentEntries !== 3 || !noJavaScriptSchedule.toggleHidden || !noJavaScriptSchedule.heading.includes('In Morgantown.')) {
  throw new Error(`No-JavaScript schedule qualification failed: ${JSON.stringify(noJavaScriptSchedule)}`);
}
await send('Emulation.setScriptExecutionDisabled', { value: false });
await load();

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
  const hiddenReveals = await evaluate(`(() => {
    const hidden = [...document.querySelectorAll('.reveal:not(.gallery-item)')].filter((element) => !element.classList.contains('is-visible'));
    hidden.forEach((element) => element.classList.add('is-visible'));
    return hidden.length;
  })()`);
  const captures = [
    ['top', '#top'],
    ['story', '.residency-story'],
    ['dates', '#dates'],
    ['dates-expanded', '#dates'],
    ['services', '#services'],
    ['service-image', '.spectrum-visual'],
    ['gallery', '#gallery'],
    ['wedding', '.wedding-proof'],
    ['wedding-media', '.wedding-collage'],
    ['pricing', '#pricing'],
    ['pricing-rows', '.scope-list'],
    ['faq', '#faq'],
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
    if (name === 'dates-expanded') {
      await evaluate(`(() => {
        const toggle = document.querySelector('[data-dates-toggle]');
        if (toggle && !toggle.hidden && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
      })()`);
    }
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
    if (name === 'dates-expanded') await evaluate(`document.querySelector('[data-dates-toggle]')?.click()`);
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
  productionIdentity.prices.some((price) => price.includes('Nightlife + College') && price.includes('Custom')) &&
  productionIdentity.prices.some((price) => price.includes('Private Events') && price.includes('$500')) &&
  productionIdentity.prices.some((price) => price.includes('Wedding Reception') && price.includes('$1,000')) &&
  productionIdentity.prices.some((price) => price.includes('Full Wedding') && price.includes('$1,500')) &&
  productionIdentity.prices.some((price) => price.includes('Large-Scale / Production-Heavy') && price.includes('Custom')) &&
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
console.log(JSON.stringify({ siteUrl: siteUrl.href, viewportResults, datesInteraction, storyInteraction, mediaInteraction, mobileInteractions, mobilePerformance, reducedMotion, noJavaScriptSchedule, contactRouting, productionIdentity, localChecks, screenshots: outputDir }, null, 2));
