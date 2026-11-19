const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wideHero = window.matchMedia('(min-width: 900px) and (orientation: landscape)');
const mobileLayout = window.matchMedia('(max-width: 899px)');
const saveData = Boolean(navigator.connection && navigator.connection.saveData);

const track = (eventName, parameters = {}) => {
  if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters);
};

document.querySelector('[data-year]').textContent = new Date().getFullYear();

/* ---------- Header + menu ---------- */
const header = document.querySelector('[data-header]');
const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const setMenu = (open) => {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  navigation.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
};
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});
mobileLayout.addEventListener('change', ({ matches }) => {
  if (!matches) setMenu(false);
});

document.querySelectorAll('[data-track]').forEach((element) => {
  element.addEventListener('click', () => track('booking_cta_click', { placement: element.dataset.track }));
});

/* ---------- Dates: past dates move to "Recently played", today gets "Tonight" ---------- */
const datesSection = document.querySelector('[data-dates]');
if (datesSection) {
  const upcomingList = datesSection.querySelector('[data-upcoming-list]');
  const recentList = datesSection.querySelector('[data-recent-list]');
  const scheduleEvents = [...datesSection.querySelectorAll('[data-schedule-event]')];
  const seededRecentEvents = [...datesSection.querySelectorAll('[data-recent-event]')];
  const datesToggle = datesSection.querySelector('[data-dates-toggle]');
  const toggleLabel = datesToggle.querySelector('[data-dates-toggle-label]');
  const toggleCount = datesToggle.querySelector('[data-dates-toggle-count]');
  const upcomingCount = datesSection.querySelector('[data-upcoming-count]');
  const datesFallback = datesSection.querySelector('[data-dates-fallback]');
  let currentUpcoming = [];

  const morgantownDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const setScheduleExpanded = (expanded, trackChange = false) => {
    datesToggle.setAttribute('aria-expanded', String(expanded));
    toggleLabel.textContent = expanded ? 'Show fewer dates' : 'View full fall schedule';
    toggleCount.textContent = expanded ? `${currentUpcoming.length} dates shown` : `${Math.max(0, currentUpcoming.length - 4)} more dates`;
    currentUpcoming.forEach((event, index) => { event.hidden = !expanded && index >= 4; });
    if (trackChange) track('dates_schedule_toggle', { expanded });
  };

  const refreshDates = (todayKey = morgantownDateKey()) => {
    currentUpcoming = scheduleEvents
      .filter((event) => event.dataset.eventDate >= todayKey)
      .sort((a, b) => a.dataset.eventDate.localeCompare(b.dataset.eventDate));
    const completed = scheduleEvents.filter((event) => event.dataset.eventDate < todayKey);

    currentUpcoming.forEach((event) => {
      const tonight = event.dataset.eventDate === todayKey;
      event.classList.remove('date-row-recent');
      event.classList.toggle('is-tonight', tonight);
      event.querySelector('[data-tonight]').hidden = !tonight;
      upcomingList.append(event);
    });

    const recentEvents = [...seededRecentEvents, ...completed]
      .sort((a, b) => b.dataset.eventDate.localeCompare(a.dataset.eventDate));
    recentEvents.forEach((event, index) => {
      event.classList.add('date-row-recent');
      event.classList.remove('is-tonight');
      event.querySelector('[data-tonight]')?.setAttribute('hidden', '');
      event.hidden = index >= 3;
      recentList.append(event);
    });

    const remaining = currentUpcoming.length;
    upcomingCount.textContent = `${remaining} confirmed public ${remaining === 1 ? 'date' : 'dates'} remaining`;
    datesFallback.hidden = remaining > 0;
    datesToggle.hidden = remaining <= 4;
    setScheduleExpanded(false);
    updateHeroNext(currentUpcoming[0], todayKey);
  };

  datesToggle.addEventListener('click', () => {
    setScheduleExpanded(datesToggle.getAttribute('aria-expanded') !== 'true', true);
  });
  datesSection.refreshDates = refreshDates;
  refreshDates();
}

/* The hero's "Next" line reads the first upcoming date row, so it never needs its own update. */
function updateHeroNext(event, todayKey) {
  const next = document.querySelector('[data-hero-next]');
  if (!next) return;
  if (!event) { next.hidden = true; return; }
  const day = event.querySelector('time span')?.textContent.trim() || '';
  const date = event.querySelector('time strong')?.textContent.trim() || '';
  const venue = event.querySelector('.date-row-place h3')?.textContent.trim() || '';
  const note = event.querySelector('.date-row-note')?.textContent || '';
  const time = note.includes('·') ? note.split('·').pop().trim() : '';
  const tonight = event.dataset.eventDate === todayKey;
  next.querySelector('[data-hero-next-label]').textContent = tonight ? 'Tonight' : 'Next';
  next.querySelector('[data-hero-next-text]').textContent = [tonight ? '' : `${day} ${date}`, venue, time].filter(Boolean).join(' · ');
  next.classList.toggle('is-tonight', tonight);
  next.hidden = false;
}

/* ---------- Reveal on scroll ---------- */
const revealItems = [...document.querySelectorAll('.reveal')];
if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  document.documentElement.classList.add('has-reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  revealItems.forEach((item) => observer.observe(item));
}

/* ---------- The one silent background clip ----------
   A muted MP4 with no audio track. It never autoplays under reduced motion or Save-Data, loads only when the
   hero is on screen, pauses when it is not, and the poster photo stays until the clip is actually playing. */
const motionAllowed = () => !prefersReducedMotion.matches && !saveData;

const heroSection = document.querySelector('[data-hero]');
const heroVideo = document.querySelector('[data-hero-video]');
const motionToggle = document.querySelector('[data-motion-toggle]');
const motionLabel = document.querySelector('[data-motion-label]');
let userPaused = false;
let heroVisible = true;
/* iPhones in Low Power Mode (and some browsers) refuse to start a video on their own. Then the button shows
   "play", and the clip starts on the visitor's first tap anywhere on the page (a tap is allowed to start it). */
let autoplayBlocked = false;

const tryPlay = (video) => {
  video.muted = true;
  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch((error) => {
      if (!error || error.name !== 'NotAllowedError') return;
      autoplayBlocked = true;
      syncToggle();
      armFirstTap();
    });
  }
};

const syncToggle = () => {
  if (!motionToggle) return;
  const showsPaused = userPaused || autoplayBlocked;
  motionToggle.hidden = !motionAllowed();
  motionToggle.setAttribute('aria-pressed', String(showsPaused));
  motionToggle.classList.toggle('is-paused', showsPaused);
  motionLabel.textContent = showsPaused ? 'Play background video' : 'Pause background video';
};

let firstTapArmed = false;
const armFirstTap = () => {
  if (firstTapArmed) return;
  firstTapArmed = true;
  const onFirstTap = (event) => {
    if (motionToggle && motionToggle.contains(event.target)) return; // the button handles its own tap
    document.removeEventListener('touchend', onFirstTap, true);
    document.removeEventListener('click', onFirstTap, true);
    firstTapArmed = false;
    if (autoplayBlocked && !userPaused && heroVisible && motionAllowed()) tryPlay(heroVideo);
  };
  document.addEventListener('touchend', onFirstTap, { capture: true, passive: true });
  document.addEventListener('click', onFirstTap, { capture: true, passive: true });
};

const syncVideo = () => {
  if (!heroVideo) return;
  if (motionAllowed() && !userPaused && heroVisible) {
    const src = wideHero.matches ? heroVideo.dataset.srcWide : heroVideo.dataset.srcTall;
    if (heroVideo.dataset.loaded !== src) {
      heroVideo.dataset.loaded = src;
      heroVideo.src = src;
      heroVideo.load();
    }
    tryPlay(heroVideo);
  } else {
    heroVideo.pause();
  }
  syncToggle();
};

if (heroVideo) {
  heroVideo.addEventListener('playing', () => {
    heroSection.classList.add('is-playing');
    if (autoplayBlocked) {
      autoplayBlocked = false;
      syncToggle();
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      syncVideo();
    }).observe(heroSection);
  }
  motionToggle?.addEventListener('click', () => {
    if (autoplayBlocked) userPaused = false; // the phone blocked it: this tap starts it
    else userPaused = !userPaused;
    syncVideo();
    track('background_video_toggle', { paused: userPaused });
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? heroVideo.pause() : syncVideo()));
  prefersReducedMotion.addEventListener('change', syncVideo);
  wideHero.addEventListener('change', () => {
    heroSection.classList.remove('is-playing');
    syncVideo();
  });
  syncVideo();
}

/* ---------- Photo lightbox ---------- */
const galleryImages = [
  { src: 'assets/media/ivy-booth-crowd-1170.jpg', alt: 'VATO performing from the booth toward a packed Ivy Nightclub dance floor', caption: 'In the room · Ivy Nightclub, Morgantown' },
  { src: 'assets/media/ivy-side-performance-1152.jpg', alt: 'VATO working the controls during a live Ivy Nightclub set', caption: 'Live mixing · Ivy Nightclub' },
  { src: 'assets/media/ivy-vato-wall-828.jpg', alt: 'VATO performing in front of a venue LED wall carrying the VATO mark', caption: 'VATO on the wall' },
  { src: 'assets/media/production-controller-1536.jpg', alt: 'DJ controller, decks, and mixer set up for an event', caption: 'Prepared to perform' },
  { src: 'assets/media/ivy-live-mixing-clean-1024.jpg', alt: 'Vince Widerman mixing live at Ivy Nightclub', caption: 'Behind the decks' },
  { src: 'assets/media/ivy-vato-led-1536.jpg', alt: 'VATO mixing live beside a large VATO venue LED display', caption: 'Live identity · VATO in the venue' },
  { src: 'assets/media/mebane-room-1152.jpg', alt: 'VATO sound and DJ setup in the Mebane wedding reception room', caption: 'Wedding · Mebane, North Carolina · June 20, 2026' },
  { src: 'assets/media/mebane-booth-1152.jpg', alt: "Mebane wedding reception viewed from VATO's DJ booth", caption: 'Wedding · Reception room from the booth' }
];

const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('figcaption');
let currentGalleryIndex = 0;

const renderLightbox = (index) => {
  currentGalleryIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[currentGalleryIndex];
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = `${String(currentGalleryIndex + 1).padStart(2, '0')} / ${String(galleryImages.length).padStart(2, '0')} — ${image.caption}`;
};
const openLightbox = (index) => {
  renderLightbox(index);
  lightbox.showModal();
  document.body.classList.add('menu-open');
  track('gallery_open', { image: galleryImages[currentGalleryIndex].src });
};
document.querySelectorAll('[data-gallery-index]').forEach((button) => button.addEventListener('click', () => openLightbox(Number(button.dataset.galleryIndex))));
lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.querySelector('.lightbox-prev').addEventListener('click', () => renderLightbox(currentGalleryIndex - 1));
lightbox.querySelector('.lightbox-next').addEventListener('click', () => renderLightbox(currentGalleryIndex + 1));
lightbox.addEventListener('click', (event) => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => document.body.classList.remove('menu-open'));
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') renderLightbox(currentGalleryIndex - 1);
  if (event.key === 'ArrowRight') renderLightbox(currentGalleryIndex + 1);
});

/* Arrow keys also scroll the photo rail when it has focus. */
const photoRail = document.querySelector('.photo-rail');
photoRail?.addEventListener('keydown', (event) => {
  if (event.target !== photoRail) return;
  const step = photoRail.clientWidth * 0.8;
  if (event.key === 'ArrowRight') { photoRail.scrollBy({ left: step, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' }); event.preventDefault(); }
  if (event.key === 'ArrowLeft') { photoRail.scrollBy({ left: -step, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' }); event.preventDefault(); }
});

/* ---------- Booking form (posts to the same Formspree endpoint as before) ---------- */
const form = document.querySelector('#booking-form');
const formNotice = document.querySelector('#form-success');
const requiredFields = [...form.querySelectorAll('[required]')];
let formStarted = false;
const getMessage = (field) => {
  if (field.validity.valueMissing) return 'Please complete this field.';
  if (field.validity.typeMismatch) return 'Enter a valid email address.';
  return 'Check this field and try again.';
};
const showFieldState = (field) => {
  const error = document.querySelector(`#${CSS.escape(field.id)}-error`);
  if (field.validity.valid) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    if (error) error.textContent = '';
    return true;
  }
  field.setAttribute('aria-invalid', 'true');
  if (error) {
    error.textContent = getMessage(field);
    field.setAttribute('aria-describedby', error.id);
  }
  return false;
};
form.addEventListener('focusin', () => {
  if (formStarted) return;
  formStarted = true;
  track('booking_form_start');
}, { once: true });
requiredFields.forEach((field) => {
  field.addEventListener('blur', () => showFieldState(field));
  field.addEventListener('input', () => {
    if (field.hasAttribute('aria-invalid')) showFieldState(field);
  });
});
form.addEventListener('submit', (event) => {
  const valid = requiredFields.map(showFieldState).every(Boolean);
  if (!valid) {
    event.preventDefault();
    form.querySelector('[aria-invalid="true"]')?.focus();
    track('booking_form_error', { reason: 'validation' });
    return;
  }
  track('booking_form_submit', { event_type: form.elements.event_type.value });
});

const parameters = new URLSearchParams(window.location.search);
if (parameters.get('submitted') === '1') {
  formNotice.hidden = false;
  history.replaceState({}, '', `${window.location.pathname}#booking`);
}
