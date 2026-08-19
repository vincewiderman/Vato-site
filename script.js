const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const mobileLayout = window.matchMedia('(max-width: 820px)');
const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

const track = (eventName, parameters = {}) => {
  if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters);
};

document.querySelector('[data-year]').textContent = new Date().getFullYear();

const header = document.querySelector('[data-header]');
const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 18);
syncHeader();

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
  };

  datesToggle.addEventListener('click', () => {
    setScheduleExpanded(datesToggle.getAttribute('aria-expanded') !== 'true', true);
  });
  datesSection.refreshDates = refreshDates;
  refreshDates();
}

const revealItems = [...document.querySelectorAll('.reveal')];
const setupReveals = () => {
  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
  revealItems.forEach((item) => observer.observe(item));
};
setupReveals();

const hero = document.querySelector('[data-hero]');
const story = document.querySelector('[data-story]');
const storyStage = document.querySelector('[data-story-stage]');
const storyImages = [...document.querySelectorAll('[data-story-image]')];
const storySteps = [...document.querySelectorAll('[data-story-step]')];
const storyNumber = document.querySelector('[data-story-number]');
const typeRiver = document.querySelector('[data-type-river]');
const mediaJourney = document.querySelector('[data-media-journey]');
const mediaViewport = document.querySelector('[data-media-viewport]');
const mediaTrack = document.querySelector('[data-media-track]');
let activeStoryIndex = 0;
let scrollFrame = 0;

const setStoryIndex = (index) => {
  if (index === activeStoryIndex && story.dataset.active !== undefined) return;
  activeStoryIndex = index;
  story.dataset.active = String(index);
  storyStage.dataset.active = String(index);
  story.style.setProperty('--story-index', String(index));
  storyImages.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
  storySteps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === index));
  storyNumber.textContent = String(index + 1).padStart(2, '0');
};

const sectionProgress = (element) => {
  const rect = element.getBoundingClientRect();
  const distance = Math.max(1, rect.height - window.innerHeight);
  return clamp(-rect.top / distance);
};

const updateExperience = () => {
  scrollFrame = 0;
  syncHeader();

  if (prefersReducedMotion.matches) {
    hero.style.removeProperty('--hero-scroll-y');
    typeRiver.style.removeProperty('--river-x');
    mediaTrack.style.removeProperty('--media-x');
    return;
  }

  const heroProgress = clamp(window.scrollY / Math.max(1, hero.offsetHeight));
  hero.style.setProperty('--hero-scroll-y', `${heroProgress * 46}px`);
  hero.style.setProperty('--hero-word-y', `${heroProgress * -34}px`);

  const storyProgress = sectionProgress(story);
  setStoryIndex(Math.min(storySteps.length - 1, Math.floor(storyProgress * storySteps.length)));

  const riverRect = typeRiver.getBoundingClientRect();
  const riverProgress = clamp((window.innerHeight - riverRect.top) / (window.innerHeight + riverRect.height));
  typeRiver.style.setProperty('--river-x', `${-window.innerWidth * (.04 + riverProgress * .32)}px`);

  if (!mobileLayout.matches) {
    const mediaProgress = sectionProgress(mediaJourney);
    const maximumShift = Math.max(0, mediaTrack.scrollWidth - mediaViewport.clientWidth + window.innerWidth * .04);
    mediaTrack.style.setProperty('--media-x', `${-maximumShift * mediaProgress}px`);
    mediaJourney.style.setProperty('--media-progress', `${mediaProgress * 100}%`);
  } else {
    mediaTrack.style.removeProperty('--media-x');
  }
};

const requestExperienceUpdate = () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateExperience);
};
window.addEventListener('scroll', requestExperienceUpdate, { passive: true });
window.addEventListener('resize', requestExperienceUpdate, { passive: true });
prefersReducedMotion.addEventListener('change', requestExperienceUpdate);
mobileLayout.addEventListener('change', requestExperienceUpdate);
setStoryIndex(0);
updateExperience();

const resetHeroPointer = () => {
  hero.style.setProperty('--pointer-x', '0px');
  hero.style.setProperty('--pointer-y', '0px');
  hero.style.setProperty('--pointer-x-soft', '0px');
  hero.style.setProperty('--pointer-y-soft', '0px');
};
const setupHeroPointer = () => {
  hero.onpointermove = null;
  hero.onpointerleave = null;
  resetHeroPointer();
  if (!finePointer.matches || prefersReducedMotion.matches) return;
  hero.onpointermove = (event) => {
    const x = event.clientX / window.innerWidth - .5;
    const y = event.clientY / window.innerHeight - .5;
    hero.style.setProperty('--pointer-x', `${x * 18}px`);
    hero.style.setProperty('--pointer-y', `${y * 14}px`);
    hero.style.setProperty('--pointer-x-soft', `${x * -10}px`);
    hero.style.setProperty('--pointer-y-soft', `${y * -8}px`);
  };
  hero.onpointerleave = resetHeroPointer;
};
setupHeroPointer();
finePointer.addEventListener('change', setupHeroPointer);
prefersReducedMotion.addEventListener('change', setupHeroPointer);

const galleryImages = [
  { src: 'assets/media/ivy-packed-crowd-1152.jpg', alt: 'Packed dance floor at Ivy Nightclub under magenta and blue lighting', caption: 'Room response · Ivy Nightclub, Morgantown' },
  { src: 'assets/media/ivy-vato-led-1536.jpg', alt: 'VATO mixing live beside a large VATO venue LED display', caption: 'Behind the decks · VATO venue identity' },
  { src: 'assets/media/ivy-booth-crowd-1170.jpg', alt: 'VATO performing from the booth toward a packed Ivy Nightclub dance floor', caption: 'Nightlife · In the room at Ivy Nightclub' },
  { src: 'assets/media/ivy-side-performance-1152.jpg', alt: 'VATO working the controls during a live Ivy Nightclub set', caption: 'Behind the decks · Live mixing' },
  { src: 'assets/media/ivy-crowd-decks-1242.jpg', alt: 'Packed Ivy Nightclub crowd seen over illuminated decks', caption: 'Room response · Peak-hour energy' },
  { src: 'assets/media/joe-mamas-live-837.jpg', alt: "VATO performing beneath the Joe Mama's venue logo", caption: "Residency · Joe Mama's" },
  { src: 'assets/media/ivy-vato-wall-828.jpg', alt: 'VATO performing in front of a venue LED wall carrying the VATO mark', caption: 'Live identity · VATO in the venue' },
  { src: 'assets/media/production-controller-1536.jpg', alt: 'Professional DJ controller, decks, and mixer prepared for an event', caption: 'Production · Professional controls and preparation' },
  { src: 'assets/media/mebane-room-1152.jpg', alt: 'Professional VATO sound and DJ setup in the Mebane wedding reception room', caption: 'Wedding proof · Mebane, North Carolina · June 20, 2026' },
  { src: 'assets/media/mebane-booth-1152.jpg', alt: "Mebane wedding reception viewed from VATO's professional DJ booth", caption: 'Wedding proof · Reception room and booth perspective' }
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

const escapeText = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const reviewCards = document.querySelector('#review-cards');
const reviewFallback = document.querySelector('#reviews-fallback');
fetch('reviews.json')
  .then((response) => {
    if (!response.ok) throw new Error('Review request failed');
    return response.json();
  })
  .then((reviews) => {
    if (!Array.isArray(reviews) || !reviews.length) throw new Error('No reviews available');
    reviewCards.innerHTML = reviews.slice(0, 3).map((review) => {
      const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
      const details = [review.event_type, review.source, review.date].filter(Boolean).map(escapeText).join(' · ');
      return `<article class="review-card">
        <div class="review-stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
        <blockquote>${escapeText(review.excerpt)}</blockquote>
        <footer><b>${escapeText(review.name)}</b><span>${details}</span></footer>
      </article>`;
    }).join('');
  })
  .catch(() => { reviewFallback.hidden = false; });

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
