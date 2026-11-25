"use strict";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scrollBehavior = () => reducedMotion.matches ? "instant" : "smooth";
const themeToggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.firstElementChild.textContent = dark ? "☀" : "☾";
  themeColor.content = dark ? "#1c1716" : "#FAF8F5";
}

try {
  applyTheme(localStorage.getItem("theme") === "dark");
} catch {
  applyTheme(false);
}

themeToggle.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  applyTheme(dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // The current page still uses the selected theme when storage is unavailable.
  }
});

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

const header = document.querySelector(".site-header");
const nav = header.querySelector(".nav");
const indicator = nav.querySelector(".nav-indicator");
const navItems = [...nav.querySelectorAll("a")].map(link => ({
  link,
  section: document.getElementById(link.hash.slice(1))
}));

function isPlainClick(event) {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

let activeNav;
let headerHeight;
let navigationFrame;

function positionIndicator(item) {
  indicator.style.transform = "translateX(" + item.left + "px) scaleX(" + item.width + ")";
}

function updateNavigation() {
  navigationFrame = undefined;
  const position = window.scrollY;
  const readingLine = position + headerHeight + 32;
  const bottom = position > 0 && position + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const active = bottom ? navItems.at(-1) : navItems.findLast(item => readingLine >= item.top);

  if (active === activeNav) return;
  activeNav?.link.removeAttribute("aria-current");
  activeNav = active;
  if (active) {
    active.link.setAttribute("aria-current", "location");
    positionIndicator(active);
  }
  indicator.style.opacity = active ? "1" : "0";
}

function queueNavigationUpdate() {
  if (navigationFrame === undefined) navigationFrame = requestAnimationFrame(updateNavigation);
}

function measureNavigation() {
  headerHeight = header.getBoundingClientRect().height;
  for (const item of navItems) {
    item.top = item.section.getBoundingClientRect().top + window.scrollY;
    item.left = item.link.offsetLeft;
    item.width = item.link.offsetWidth;
  }
  if (activeNav) positionIndicator(activeNav);
  queueNavigationUpdate();
}

for (const image of document.images) {
  image.addEventListener("error", () => image.setAttribute("data-unavailable", ""));
  image.addEventListener("load", () => image.removeAttribute("data-unavailable"));
  if (image.getAttribute("src") && image.complete && !image.naturalWidth) {
    image.setAttribute("data-unavailable", "");
  }
}

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener("click", event => {
    if (!isPlainClick(event)) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();

    const top = target === document.body ? 0 :
      target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    if (target !== document.body) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    window.scrollTo({ top: Math.max(0, top), behavior: scrollBehavior() });
  });
}

window.addEventListener("scroll", queueNavigationUpdate, { passive: true });
window.addEventListener("resize", measureNavigation);
if ("ResizeObserver" in window) {
  const observer = new ResizeObserver(measureNavigation);
  observer.observe(header);
  observer.observe(document.body);
}
document.fonts?.ready.then(measureNavigation);

const marquee = document.querySelector(".marquee");
const marqueeToggle = marquee.querySelector(".marquee-toggle");
marqueeToggle.addEventListener("click", () => {
  const paused = marquee.toggleAttribute("data-paused");
  marqueeToggle.setAttribute("aria-label", paused ? "Возобновить бегущую строку" : "Остановить бегущую строку");
});

const track = document.querySelector(".gallery-track");
const gallery = track.closest(".gallery");
const slides = [...track.querySelectorAll(".gallery-slide")];
const filters = [...gallery.querySelectorAll("[data-filter]")];
const galleryCounter = gallery.querySelector(".gallery-counter");
const gallerySteps = [...gallery.querySelectorAll("[data-step]")];
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxTitle = lightbox.querySelector("figcaption");
const lightboxCounter = lightbox.querySelector(".lightbox-counter");
const lightboxSteps = [...lightbox.querySelectorAll("[data-step]")];
let visibleSlides = slides;
let currentSlide = 0;
let lightboxIndex = 0;
let galleryFrame;
let userScrolling = false;
let scrollIdle;

const countFormatter = new Intl.NumberFormat("ru-RU", { minimumIntegerDigits: 2 });
const countText = index => countFormatter.format(index + 1) + " / " + countFormatter.format(visibleSlides.length);

function updateGallery(index) {
  currentSlide = index;
  const text = countText(index);
  if (galleryCounter.textContent !== text) galleryCounter.textContent = text;
  for (const [position, slide] of visibleSlides.entries()) slide.toggleAttribute("data-current", position === index);
  for (const button of gallerySteps) button.disabled = !visibleSlides[index + Number(button.dataset.step)];
}

function galleryStart() {
  return track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).scrollPaddingLeft);
}

function goToSlide(index, behavior = scrollBehavior()) {
  const slide = visibleSlides[index];
  if (!slide) return;
  userScrolling = false;
  const left = track.scrollLeft + slide.getBoundingClientRect().left - galleryStart();
  updateGallery(index);
  track.scrollTo({ left, behavior });
}

function syncGalleryScroll() {
  galleryFrame = undefined;
  if (!userScrolling || track.scrollWidth <= track.clientWidth) return;
  if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) {
    updateGallery(visibleSlides.length - 1);
    return;
  }

  const start = galleryStart();
  let nearest = currentSlide;
  let distance = Infinity;
  for (const [index, slide] of visibleSlides.entries()) {
    const nextDistance = Math.abs(slide.getBoundingClientRect().left - start);
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = index;
    }
  }
  if (nearest !== currentSlide) updateGallery(nearest);
}

track.addEventListener("pointerdown", () => { userScrolling = true; }, { passive: true });
track.addEventListener("wheel", () => { userScrolling = true; }, { passive: true });
track.addEventListener("focusin", event => {
  const slide = event.target.closest(".gallery-slide");
  if (slide) updateGallery(visibleSlides.indexOf(slide));
});
track.addEventListener("scroll", () => {
  if (galleryFrame === undefined) galleryFrame = requestAnimationFrame(syncGalleryScroll);
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => { userScrolling = false; }, 160);
}, { passive: true });

function arrowDirection(event) {
  if (event.key === "ArrowLeft") return -1;
  if (event.key === "ArrowRight") return 1;
  return 0;
}

track.addEventListener("keydown", event => {
  const direction = arrowDirection(event);
  if (!direction) return;
  event.preventDefault();
  goToSlide(currentSlide + direction, "instant");
});

for (const button of gallerySteps) {
  button.addEventListener("click", () => goToSlide(currentSlide + Number(button.dataset.step)));
}

function applyFilter(category) {
  const chosenFilter = filters.find(button => button.dataset.filter === category);
  const selected = chosenFilter?.dataset.filter ?? "all";
  for (const button of filters) button.setAttribute("aria-pressed", String(button.dataset.filter === selected));
  for (const slide of slides) {
    slide.hidden = selected !== "all" && slide.dataset.category !== selected;
    slide.removeAttribute("data-current");
  }
  visibleSlides = slides.filter(slide => !slide.hidden);
  goToSlide(0, "instant");
}

function categoryFromLocation() {
  return new URLSearchParams(location.search).get("gallery") ?? "all";
}

for (const button of filters) {
  button.addEventListener("click", () => {
    const url = new URL(location.href);
    const category = button.dataset.filter;
    if (category === "all") url.searchParams.delete("gallery");
    else url.searchParams.set("gallery", category);
    if (url.href !== location.href) history.replaceState(null, "", url);
    applyFilter(category);
  });
}
window.addEventListener("popstate", () => {
  const category = categoryFromLocation();
  if (gallery.querySelector('[aria-pressed="true"]').dataset.filter !== category) applyFilter(category);
});

function showLightboxPhoto(index) {
  lightboxIndex = (index + visibleSlides.length) % visibleSlides.length;
  const slide = visibleSlides[lightboxIndex];
  lightboxImage.alt = slide.querySelector("img").alt;
  lightboxImage.src = slide.querySelector("a").href;
  lightboxTitle.textContent = slide.querySelector(".slide-title").textContent;
  lightboxCounter.textContent = countText(lightboxIndex);
}

for (const slide of slides) {
  slide.querySelector("a").addEventListener("click", event => {
    if (!isPlainClick(event) || typeof lightbox.showModal !== "function") return;
    event.preventDefault();
    showLightboxPhoto(visibleSlides.indexOf(slide));
    lightbox.showModal();
  });
}

for (const button of lightboxSteps) {
  button.addEventListener("click", () => showLightboxPhoto(lightboxIndex + Number(button.dataset.step)));
}
lightbox.addEventListener("keydown", event => {
  const direction = arrowDirection(event);
  if (direction) {
    event.preventDefault();
    showLightboxPhoto(lightboxIndex + direction);
  }
});

let lightboxTouch;
const lightboxMedia = lightbox.querySelector(".lightbox-media");
lightboxMedia.addEventListener("pointerdown", event => {
  if (event.pointerType !== "touch" || !event.isPrimary) return;
  lightboxTouch = { x: event.clientX, y: event.clientY };
  lightboxMedia.setPointerCapture(event.pointerId);
});
lightboxMedia.addEventListener("pointerup", event => {
  if (!lightboxTouch || !event.isPrimary) return;
  const x = event.clientX - lightboxTouch.x;
  const y = event.clientY - lightboxTouch.y;
  lightboxTouch = undefined;
  if (Math.abs(x) > 40 && Math.abs(x) > Math.abs(y) * 1.4) showLightboxPhoto(lightboxIndex + (x < 0 ? 1 : -1));
});
lightboxMedia.addEventListener("pointercancel", () => { lightboxTouch = undefined; });

const service = document.querySelector("#service");
const lengthField = document.querySelector(".length");
const lengthNote = lengthField.querySelector(".length-note");
const estimate = document.querySelector("#estimate");
function updateEstimate() {
  const { price, ...pricesByLength } = service.selectedOptions[0].dataset;
  const length = lengthField.querySelector(":checked").value;
  lengthField.disabled = Boolean(price);
  lengthNote.hidden = !price;
  estimate.textContent = price ?? pricesByLength[length];
}

service.addEventListener("change", updateEstimate);
lengthField.addEventListener("change", updateEstimate);
window.addEventListener("pageshow", updateEstimate);

const privacy = document.querySelector(".privacy");
document.querySelector("[data-open-policy]").addEventListener("click", () => privacy.showModal());
for (const dialog of [lightbox, privacy]) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
}
privacy.addEventListener("click", event => {
  if (event.target !== privacy) return;
  const { left, right, top, bottom } = privacy.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) privacy.close();
});

function initScrollMotion() {
  const groups = [...document.querySelectorAll("[data-reveal-group]")];
  const photos = [...document.querySelectorAll("[data-parallax]")];
  const { gsap, ScrollTrigger } = window;
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      for (const group of groups) {
        gsap.from(group.children, {
          opacity: .28,
          y: 12,
          ease: "power3.out",
          duration: .55,
          stagger: { amount: .17, ease: "power2.out" },
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: group, start: "top 90%", once: true }
        });
      }
      for (const image of photos) {
        gsap.fromTo(image, { yPercent: -2, scale: 1.065 }, {
          yPercent: 2,
          scale: 1.065,
          ease: "none",
          scrollTrigger: { trigger: image.parentElement, start: "top bottom", end: "bottom top", scrub: true }
        });
      }
    });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return;
  }

  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("scroll-motion-fallback");
  const observer = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (!reducedMotion.matches) target.classList.add("reveal-fallback");
    }
  }, { threshold: .12 });
  for (const group of groups) observer.observe(group);
}

document.documentElement.classList.add("enhanced");
applyFilter(categoryFromLocation());
updateEstimate();
measureNavigation();
initScrollMotion();
