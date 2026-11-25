"use strict";

const select = (selector, scope = document) => scope.querySelector(selector);
const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scrollBehavior = () => reducedMotion.matches ? "instant" : "smooth";
const plainClick = (event) => !event.defaultPrevented && event.button === 0
  && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const serviceSelect = select("#service-option");
const tabs = all("[data-tab]");
const diameterOptions = all("[name=diameter]");
const priceOutput = select("#estimate");
const priceFormat = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0
});
let mode = "tires";

function updateEstimate() {
  const choice = mode === "tires" ? select("[name=diameter]:checked") : serviceSelect.selectedOptions[0];
  const { price, prefix, message } = choice.dataset;
  const result = message ?? [prefix, priceFormat.format(Number(price))].filter(Boolean).join(" ");
  priceOutput.classList.toggle("estimate-note", Boolean(message));
  if (priceOutput.textContent !== result) priceOutput.textContent = result;
}

function setMode(nextMode, choice) {
  mode = nextMode;
  for (const tab of tabs) {
    const selected = tab.dataset.tab === mode;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  if (mode === "service" && [...serviceSelect.options].some((option) => option.value === choice)) {
    serviceSelect.value = choice;
  }
  if (mode === "tires") {
    const diameter = diameterOptions.find((option) => option.value === choice);
    if (diameter) diameter.checked = true;
  }
  updateEstimate();
}

function estimateURL() {
  const url = new URL(location.href);
  const choice = mode === "tires" ? select("[name=diameter]:checked").value : serviceSelect.value;
  url.searchParams.set("mode", mode);
  url.searchParams.set("choice", choice);
  return url;
}

function readEstimateURL() {
  const query = new URLSearchParams(location.search);
  diameterOptions[0].checked = true;
  serviceSelect.selectedIndex = 0;
  setMode(query.get("mode") === "service" ? "service" : "tires", query.get("choice"));
}

function writeURL(url, method) {
  if (url.href === location.href) return;
  try {
    history[method](null, "", url);
  } catch (error) {
    if (error.name !== "SecurityError" || location.protocol !== "file:") throw error;
  }
}

function saveEstimate() {
  updateEstimate();
  writeURL(estimateURL(), "replaceState");
}

readEstimateURL();
window.addEventListener("popstate", readEstimateURL);
serviceSelect.addEventListener("change", saveEstimate);
diameterOptions.forEach((option) => option.addEventListener("change", saveEstimate));
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    setMode(tab.dataset.tab);
    saveEstimate();
  });
  tab.addEventListener("keydown", (event) => {
    const next = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
});

const header = select(".site-header");
const navigation = all(".main-nav a");
const sections = navigation.map((link) => document.getElementById(link.hash.slice(1)));
let sectionOffsets = [];
let headerOffset = 0;
let pageEnd = 0;
let activeSection = -1;
let navFrame = 0;

function refreshOffsets() {
  headerOffset = header.getBoundingClientRect().height + 16;
  sectionOffsets = sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
  pageEnd = document.documentElement.scrollHeight - window.innerHeight;
  updateNavigation();
}

function updateNavigation() {
  navFrame = 0;
  const position = window.scrollY;
  const next = position > 0 && position >= pageEnd - 2
    ? sections.length - 1
    : sectionOffsets.findLastIndex((offset) => offset <= position + headerOffset + 8);
  if (next === activeSection) return;
  navigation[activeSection]?.removeAttribute("aria-current");
  navigation[next]?.setAttribute("aria-current", "location");
  activeSection = next;
}

window.addEventListener("scroll", () => {
  if (!navFrame) navFrame = requestAnimationFrame(updateNavigation);
}, { passive: true });
window.addEventListener("resize", refreshOffsets, { passive: true });
if ("ResizeObserver" in window) {
  const layoutObserver = new ResizeObserver(refreshOffsets);
  [header, ...sections].forEach((element) => layoutObserver.observe(element));
}
refreshOffsets();

for (const link of all('a[href^="#"]:not([data-open-privacy])')) {
  link.addEventListener("click", (event) => {
    if (!plainClick(event)) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const { mode: targetMode, choice } = link.dataset;
    if (targetMode) setMode(targetMode, choice);
    const url = targetMode ? estimateURL() : new URL(location.href);
    url.hash = link.hash;
    writeURL(url, "pushState");

    const top = target.id === "main" ? 0
      : target.getBoundingClientRect().top + window.scrollY - headerOffset;
    const heading = target === select("main") ? target : select("h2", target);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top, behavior: scrollBehavior() });
  });
}

const marquee = select(".marquee");
const marqueeToggle = select(".marquee-toggle");
let marqueePaused = false;

function syncMarquee() {
  marquee.classList.add("marquee-ready");
  marqueeToggle.hidden = reducedMotion.matches;
}

marqueeToggle.addEventListener("click", () => {
  marqueePaused = !marqueePaused;
  marquee.classList.toggle("paused", marqueePaused);
  marqueeToggle.setAttribute("aria-label", marqueePaused ? "Запустить бегущую строку" : "Остановить бегущую строку");
  select("use", marqueeToggle).setAttribute("href", marqueePaused ? "#i-play" : "#i-pause");
});
reducedMotion.addEventListener("change", syncMarquee);
syncMarquee();

if ("IntersectionObserver" in window) {
  const marqueeObserver = new IntersectionObserver(([entry]) => {
    marquee.classList.toggle("offscreen", !entry.isIntersecting);
  });
  marqueeObserver.observe(marquee);
}

const heroLogo = document.querySelector("[data-tilt]");

function tiltLogo(event) {
  if (!event.isPrimary || reducedMotion.matches) return;
  const { left, top, width, height } = heroLogo.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - left) / width));
  const y = Math.max(0, Math.min(1, (event.clientY - top) / height));
  heroLogo.style.setProperty("--tilt-x", (0.5 - y) * 22 + "deg");
  heroLogo.style.setProperty("--tilt-y", (x - 0.5) * 26 + "deg");
  heroLogo.style.setProperty("--shine-x", x * 100 + "%");
  heroLogo.style.setProperty("--shine-y", y * 100 + "%");
  heroLogo.classList.add("is-tilted");
}

for (const type of ["pointermove", "pointerdown"]) {
  heroLogo.addEventListener(type, tiltLogo);
}
for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
  heroLogo.addEventListener(type, () => heroLogo.classList.remove("is-tilted"));
}

const track = select(".gallery-track");
const slides = all(".gallery-slide", track);
const pagination = select(".gallery-pagination");
const galleryCount = select(".gallery-count");
const lightbox = select(".lightbox");
const lightboxImage = select(".lightbox-image");
const lightboxFigure = select(".lightbox-figure");
const lightboxCaption = select(".lightbox-caption");
const lightboxCount = select(".lightbox-count");
let galleryIndex = 0;
let queuedIndex = null;
let lightboxIndex = 0;
let slideOffsets = [];
let galleryFrame = 0;
let galleryScrollTimer = 0;
const counterFormat = new Intl.NumberFormat("ru-RU", { minimumIntegerDigits: 2, useGrouping: false });
const counterText = (index) => `${counterFormat.format(index + 1)} / ${counterFormat.format(slides.length)}`;
const wrapIndex = (index) => (index + slides.length) % slides.length;

const paginationButtons = slides.map((slide, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Фото ${index + 1}. ${slide.dataset.caption}`);
  button.addEventListener("click", () => showSlide(index));
  pagination.append(button);
  return button;
});

function renderGalleryIndex(index) {
  galleryIndex = index;
  galleryCount.textContent = counterText(index);
  paginationButtons.forEach((button, position) => {
    if (position === index) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
}

function refreshSlideOffsets() {
  const first = slides[0].offsetLeft;
  const maxScroll = track.scrollWidth - track.clientWidth;
  slideOffsets = slides.map((slide) => Math.min(slide.offsetLeft - first, maxScroll));
}

function showSlide(index, behavior = scrollBehavior()) {
  const next = wrapIndex(index);
  queuedIndex = next;
  renderGalleryIndex(next);
  const isWrap = Math.abs(next - index) === slides.length;
  track.scrollTo({ left: slideOffsets[next], behavior: isWrap ? "instant" : behavior });
  settleGalleryScroll();
}

function settleGalleryScroll() {
  clearTimeout(galleryScrollTimer);
  if (queuedIndex === null) return;
  galleryScrollTimer = setTimeout(() => {
    queuedIndex = null;
    readGalleryScroll();
  }, 140);
}

function readGalleryScroll() {
  galleryFrame = 0;
  if (queuedIndex !== null) return;
  const offset = track.scrollLeft;
  const nearest = slideOffsets.reduce((best, value, index) => (
    Math.abs(value - offset) < Math.abs(slideOffsets[best] - offset) ? index : best
  ), 0);
  if (nearest !== galleryIndex) renderGalleryIndex(nearest);
}

track.addEventListener("scroll", () => {
  if (!galleryFrame) galleryFrame = requestAnimationFrame(readGalleryScroll);
  settleGalleryScroll();
}, { passive: true });
for (const type of ["pointerdown", "wheel"]) {
  track.addEventListener(type, () => { queuedIndex = null; }, { passive: true });
}
track.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  showSlide(galleryIndex + (event.key === "ArrowRight" ? 1 : -1));
  slides[galleryIndex].focus({ preventScroll: true });
});

all("[data-gallery-step]").forEach((button) => button.addEventListener("click", () => {
  showSlide(galleryIndex + Number(button.dataset.galleryStep));
}));

function showPhoto(index) {
  lightboxIndex = wrapIndex(index);
  const slide = slides[lightboxIndex];
  const photo = select("img", slide);
  lightboxFigure.classList.toggle("is-unavailable", slide.classList.contains("is-unavailable"));
  lightboxImage.alt = photo.alt;
  lightboxImage.src = slide.href;
  lightboxCaption.textContent = slide.dataset.caption;
  lightboxCount.textContent = counterText(lightboxIndex);
}

const markLightboxPhoto = () => lightboxFigure.classList.toggle("is-unavailable", !lightboxImage.naturalWidth);
lightboxImage.addEventListener("load", markLightboxPhoto);
lightboxImage.addEventListener("error", markLightboxPhoto);

slides.forEach((slide, index) => {
  const photo = select("img", slide);
  const markPhoto = () => slide.classList.toggle("is-unavailable", !photo.naturalWidth);
  photo.addEventListener("error", markPhoto);
  photo.addEventListener("load", markPhoto);
  if (photo.complete) markPhoto();
  slide.addEventListener("click", (event) => {
    if (!plainClick(event) || typeof lightbox.showModal !== "function") return;
    event.preventDefault();
    showPhoto(index);
    lightbox.showModal();
  });
});

all("[data-lightbox-step]").forEach((button) => button.addEventListener("click", () => {
  showPhoto(lightboxIndex + Number(button.dataset.lightboxStep));
}));
lightbox.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  showPhoto(lightboxIndex + (event.key === "ArrowRight" ? 1 : -1));
});

let touchStart = null;
lightboxFigure.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || !event.isPrimary) return;
  touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  lightboxFigure.setPointerCapture(event.pointerId);
});
lightboxFigure.addEventListener("pointercancel", () => { touchStart = null; });
lightboxFigure.addEventListener("pointerup", (event) => {
  if (touchStart?.id !== event.pointerId) return;
  const x = event.clientX - touchStart.x;
  const y = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(x) >= 48 && Math.abs(x) > 1.35 * Math.abs(y)) showPhoto(lightboxIndex + (x < 0 ? 1 : -1));
});

track.classList.add("has-pagination");
pagination.hidden = false;
refreshSlideOffsets();
renderGalleryIndex(0);
window.addEventListener("resize", () => {
  refreshSlideOffsets();
  track.scrollTo({ left: slideOffsets[galleryIndex], behavior: "instant" });
}, { passive: true });

const privacy = select("#privacy");
select("[data-open-privacy]").addEventListener("click", (event) => {
  if (!plainClick(event) || typeof privacy.showModal !== "function") return;
  event.preventDefault();
  privacy.showModal();
});
privacy.addEventListener("click", (event) => {
  if (event.target !== privacy) return;
  const box = privacy.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom) privacy.close();
});

function configureMotion() {
  const hero = select(".hero");
  const groups = all("[data-reveal-group]");
  const { gsap, ScrollTrigger } = window;

  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      const rise = { opacity: .25, ease: "power3.out", clearProps: "transform,opacity" };
      if (hero.getBoundingClientRect().top < window.innerHeight) {
        gsap.timeline()
          .from(".hero h1", { ...rise, opacity: .58, y: 21, duration: .58 }, 0)
          .from(".hero-description", { ...rise, opacity: .58, y: 13, duration: .52 }, .105)
          .from(".hero-actions", { ...rise, opacity: .72, y: 9, duration: .43 }, .175)
          .from(".hero-rating", { ...rise, opacity: .58, duration: .37 }, .225);
      }

      if (document.documentElement.clientWidth > 760) {
        gsap.to(".tire-pattern", {
          x: -15, y: -12, ease: "none",
          scrollTrigger: { trigger: ".service-tires", start: "top bottom", end: "bottom top", scrub: true }
        });
      }
      for (const group of groups) {
        const beats = [0, .075, .13, .165];
        const timeline = gsap.timeline({
          scrollTrigger: { trigger: group, start: "top 88%", once: true }
        });
        all("[data-reveal]", group).forEach((item, index) => {
          timeline.from(item, { ...rise, y: 16 - index * 2, duration: .54 }, beats[index]);
        });
      }
    });
    return;
  }

  if (hero.getBoundingClientRect().top < window.innerHeight) hero.classList.add("hero-fallback");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("reveal-fallback");
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .12 });
    groups.forEach((group) => revealObserver.observe(group));
  }
}

configureMotion();
