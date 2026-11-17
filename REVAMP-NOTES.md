# djvato.com revamp, 2026-11-17 (for Vince's review, not live)

- **Branch:** `revamp-2026-11-17` (local commit only, nothing pushed).
- **Worktree:** `C:\Users\Vince\Desktop\VATO_Website\vato-revamp-1117`.
- The live site is unchanged: the old design plus current dates (commit f5430ca).
- **Local preview:** `npm run dev`, then open http://127.0.0.1:4173.
- **Screenshots:** phone at 390 px and desktop at 1440 px are in `C:\Users\Vince\Desktop\VATO_Website\revamp-1117-shots`. That folder sits outside the repo so they never get published.

## The clips

His ask: "Just one or two clips", "a stagnant clip", and not "that vibrating style video". The page now has **one clip**, the opener. Nothing is grouped and there are no reels.

### Hero clip: him at the decks

- **Source:** Oct 18 phone clip 1, `OneDrive\TikTok clips\20261018_021103000_iOS.MOV`, 16.0 to 25.2 s.
- **What it shows:** him side-on at the controller, headphones on, nobody else in frame.
- **Why this one:** it's the steadiest window of any footage of him.
  - Motion was measured on every frame. Camera motion is tracked on the background only, so his moving doesn't count.
  - Over these 9 seconds, the booth monitor behind him moves less than 3 px.
- **Not stabilized.** I tried ffmpeg vidstab and a custom lock-off, and both made it worse. The club lights and his movement confuse the trackers. The raw window was already the calmest.
- **Light flashing calmed:**
  - The club lights change colour about twice a second.
  - The clip is graded in a dark violet black-and-white, with brightness smoothing.
  - Brightness flicker dropped from 2.15 to 0.77.
  - Hard brightness jumps dropped from 20 to 1 per clip.
- **Loop:** 9.2 s, with a 0.6 s crossfade at the seam so it never jumps.
- **Files:** no audio track at all (checked by the tests and the validator).
  - Phone: `hero-vato-tall.mp4`, 720x1280, 1.55 MB.
  - Desktop: `hero-vato-desktop.mp4`, 960x1280, 1.72 MB.
  - Each has a matching poster JPG of about 45 KB, shown until the clip plays.
- **Playback rules:**
  - It never plays under "reduce motion" or Data Saver; the photo stays instead.
  - It pauses when scrolled away.
  - It has a pause button.

### Motion scores

Camera shake is the frame-to-frame jitter, as a % of frame width per frame. Lower is steadier.

| Footage | Shake | Drift over clip | Notes |
|---|---|---|---|
| **New hero**, Oct 18 clip 1, 16-25 s, raw phone file | 0.105 | 1.7 % | Background only: 0.087 shake, 0.9 % drift |
| Old "a4" hero, Oct 18 clip 2, 13.5-21 s, "enhanced" file | 0.154 | 3.3 % | The 11-12 video opener. The enhanced file also shimmers |
| TikTok-finished transition reel (11-11 site) | 10.8 | n/a | Built-in shake and zoom effects: this is the "vibrating" style |
| Oct 23 booth cam, best windows | 0.03-0.04 | small | Steadiest camera, but framed too tight (head cut off). It drops to black often, and the BAR TAB banner (with WVU text) is at the edge |
| Sep 12 booth cam, him with friends | 0.09-0.15 | n/a | Camera moves, and the frame is crowded. He disliked shots from this night |
| Sep 26 booth cam, room from the booth | 0.016-0.02 | ~0 | Steadiest of all, but dropped (see below) |

The survey covered both Oct 18 phone clips at every 0.5 s offset, the Oct 23, Sep 12 and Sep 26 booth-cam recordings, and the Oct 30 and earlier phone uploads.

The two columns are measured differently:
- The new-hero and old-a4 rows use one tracker on full frames (540 px).
- The rest of the survey used a coarser 320 px pass. Read those as relative, not exact.

### Second clip: none, on purpose

- I built a calm 10 s loop of the packed Ivy room from the Sep 26 booth cam. It's very steady.
- Up close, it shows:
  - a gold shirt reading "VIRGINIA" front and centre;
  - lots of gold-and-navy WVU gear.
- A crowd that dense also can't be honestly cleared frame by frame for vapes.
- So it's out. The "Mixed live" band uses an already-approved still photo instead: the Ivy booth on desktop, the crowd over the decks on phone.

### Vape check

- I looked at all 277 frames of the hero loop.
- It's only him, hands on the decks or headphones. No device and no exhale.
- A little fog-machine haze drifts in the background around 3-4 s.
- The "hat guy" is not in it. That clip is Sep 26 booth cam 0019; this is Oct 18 phone footage.

## What changed

The whole page was rebuilt from scratch: new HTML, CSS and JS, phone first.

**Look**
- It keeps the "Main Stage" look he picked on 11-12: deep black, one magenta accent, big condensed type.
- It's calmer and more spacious. The 11-11 scroll effects, type ticker and sideways gallery ride are gone.

**Opener**
- Him on video, with VATO, "Vince Widerman / Morgantown, WV", and the Check availability and See dates buttons.
- Phone: the clip fills the screen.
- Desktop: the name is on the left and he's in a tall panel on the right.
- A "Next" line under it reads the first upcoming date straight from the dates list.
  - It shows, for example, "Sat Nov 21 · Ivy Nightclub · 9 PM".
  - On the day of a gig it switches to "Tonight".

**Section order**
1. Dates
2. Residencies (Ivy, Joe Mama's) plus "Also played"
3. The open-format photo band
4. Services
5. Photo strip: swipe through, tap to open full screen, arrow keys work
6. Wedding: the Mebane story with all 4 Google reviews, now written into the page
7. Pricing
8. FAQ
9. Booking
10. Footer

**Added**
- TikTok **@vato.official** (handle from his 11-07 and 11-16 screenshots). It appears in:
  - the phone menu;
  - the booking contact links;
  - the footer;
  - the search-engine profile data.
- Services: "Game days & sports" and "Schools & family events (clean versions only)".
- FAQ: "Can you keep it clean?"
- Booking: a "Sports / game day" option in the event-type list.
  - The form still posts to the same Formspree endpoint.
  - It keeps the same fields, the same thank-you notice and the same "An inquiry does not reserve the date."

**Kept exactly**
- **Dates system:**
  - every date row and its markup (`data-schedule-event` / `data-event-date`);
  - the "Tonight" tag, past dates moving to "Recently played" (3 shown), and the "View full fall schedule" toggle;
  - the no-dates fallback line.
- Pricing: Custom / $500 / $1,000 / $1,500 / Custom.
- The Mebane wording.
- GA4, the Google review link, Instagram and the text number.

**Not added:** the WVU Nov 30 game (no yes yet). No private events are listed anywhere in the dates.

**Housekeeping**
- `assets/media/README.md` now calls the cleaned-up hero photo "retouched". GitHub Pages serves that file publicly.
- The local preview server now streams video properly.

**Weekly dates workflow is unchanged:**
1. Add a `<article class="date-row" data-schedule-event data-event-date="YYYY-MM-DD">` row to `#dates-upcoming-list`.
2. Update `expectedDates` (and the Ivy/Joe's counts and the `timed` list) in `tests/site.test.mjs` and `scripts/validate-site.mjs`.

## Checks

- `node --test tests/site.test.mjs`: **12/12 pass**.
  - The date list, counts and times are unchanged.
  - The design-specific tests were rewritten for the new page.
  - New tests cover:
    - 1-2 clips max, each muted, inline and with no controls;
    - clip files at or under about 2.5 MB, with no audio track;
    - posters present;
    - no WVU colours in the CSS;
    - none of the banned wording on the page;
    - the TikTok link;
    - booking form fields.
- `node scripts/validate-site.mjs`: **passes** (37 files, 2 silent clips, no broken references).
- **Browser check** (headless Chrome):
  - no sideways scrolling at 320 to 1440 px, and no script errors;
  - dates simulated for Nov 16, Nov 21 (Tonight), Nov 22, Dec 10 and Jan 1 (fallback) all behave correctly;
  - under reduced motion the video never loads.
- **Not updated:** `scripts/qualify-browser.mjs`, the old design's optional browser QA. It was already stale before this (it expects 10 dates).
- **Screenshots:** Python Playwright isn't installed, so they were taken with headless Chrome through its DevTools protocol.

## What Vince needs to decide

1. **Opener look.** The clip is graded violet black-and-white so the club lights don't flash.
   - Want it in colour instead? A colour version is ready in `revamp-1117-shots\alt-colour-hero`, a one-step file swap.
   - In colour, the lights change colour about twice a second.
2. **One clip, or a second one?** The best second clip (the packed Ivy room) is out because of the WVU gear in the crowd. A second clip would need different footage.
3. **New services.** Are "Game days & sports" and "Schools & family (clean)", plus the "Sports / game day" form option, OK to show?
4. **Go live?** On his OK:
   1. In the worktree, run `git rm REVAMP-NOTES.md` and commit. GitHub Pages would publish this file otherwise.
   2. Run `git push origin revamp-2026-11-17:main`. It's live in about a minute.
   - Rollback is `f5430ca`.
