"use strict";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const header = document.querySelector(".header");
const nav = document.querySelector(".site-nav");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = [...nav.querySelectorAll("a")];
const navSections = navLinks.map((link) => document.getElementById(link.hash.slice(1)));
const scrollBehavior = () => reduceMotion.matches ? "instant" : "smooth";

document.documentElement.classList.add("js");
menuToggle.hidden = false;

function toggleMenu(open) {
  nav.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  menuToggle.querySelector("use").setAttribute("href", open ? "#icon-close" : "#icon-menu");
}

menuToggle.addEventListener("click", () => toggleMenu(!nav.classList.contains("is-open")));
header.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("is-open")) {
    toggleMenu(false);
    menuToggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!header.contains(event.target)) toggleMenu(false);
});

function plainClick(event) {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

for (const link of document.querySelectorAll("[data-scroll]")) {
  link.addEventListener("click", (event) => {
    if (!plainClick(event)) return;
    const section = document.getElementById(link.hash.slice(1));
    if (!section) return;
    event.preventDefault();
    toggleMenu(false);

    const top = section.id === "top" ? 0 :
      section.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 16;
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    section.querySelector("h1, h2")?.focus({ preventScroll: true });
    window.scrollTo({ top, behavior: scrollBehavior() });
  });
}

let navigationPending = false;
let currentSection = -1;
function updateNavigation() {
  if (navigationPending) return;
  navigationPending = true;
  requestAnimationFrame(() => {
    navigationPending = false;
    const line = header.offsetHeight + 54;
    let active = navSections.findLastIndex((section) => section.getBoundingClientRect().top <= line);
    if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2) {
      active = navSections.length - 1;
    }
    if (active === currentSection) return;
    navLinks[currentSection]?.removeAttribute("aria-current");
    navLinks[active]?.setAttribute("aria-current", "location");
    currentSection = active;
  });
}

window.addEventListener("scroll", updateNavigation, { passive: true });
window.addEventListener("resize", updateNavigation);
updateNavigation();

const marquee = document.querySelector(".marquee");
const marqueeToggle = marquee.querySelector("button");
let marqueePaused = false;
marqueeToggle.hidden = false;

function updateMarquee() {
  const paused = marqueePaused || reduceMotion.matches;
  marquee.classList.toggle("is-running", !paused);
  marquee.classList.toggle("is-paused", paused);
  marqueeToggle.setAttribute("aria-label", paused ? "Запустить бегущую строку" : "Приостановить бегущую строку");
  marqueeToggle.querySelector("use").setAttribute("href", paused ? "#icon-play" : "#icon-pause");
}

marqueeToggle.addEventListener("click", () => {
  marqueePaused = !marqueePaused;
  updateMarquee();
});
reduceMotion.addEventListener("change", updateMarquee);
updateMarquee();

const toolbar = document.querySelector(".gallery-toolbar");
const strip = document.querySelector(".filmstrip");
const filters = [...toolbar.querySelectorAll("[data-filter]")];
const frames = [...strip.querySelectorAll(".frame")];
const counter = toolbar.querySelector(".frame-count");
const lightbox = document.querySelector(".lightbox");
const lightboxPhoto = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector(".lightbox__caption");
const lightboxCounter = lightbox.querySelector(".frame-count");
const frameNumbers = new Intl.NumberFormat("ru", { minimumIntegerDigits: 2 });
const framePosition = (index, total) => frameNumbers.format(index + 1) + " / " + frameNumbers.format(total);
let visibleFrames = frames;
let slideIndex = 0;
let lightboxIndex = 0;
let pendingSlide = null;
let settleTimer;
let scrollFrame = 0;

toolbar.hidden = false;

function renderCounter() {
  const position = framePosition(slideIndex, visibleFrames.length);
  if (counter.textContent !== position) counter.textContent = position;
}

function readStripPosition() {
  const left = strip.scrollLeft;
  const start = visibleFrames[0].offsetLeft;
  let closest = Infinity;
  visibleFrames.forEach((frame, index) => {
    const distance = Math.abs(frame.offsetLeft - start - left);
    if (distance < closest) {
      closest = distance;
      slideIndex = index;
    }
  });
  renderCounter();
}

function finishStripScroll() {
  pendingSlide = null;
  readStripPosition();
}

function moveStrip(index, behavior) {
  pendingSlide = index;
  strip.scrollTo({
    left: visibleFrames[index].offsetLeft - visibleFrames[0].offsetLeft,
    behavior,
  });
  clearTimeout(settleTimer);
  settleTimer = setTimeout(finishStripScroll, 700);
}

function cycle(index, direction) {
  return (index + direction + visibleFrames.length) % visibleFrames.length;
}

strip.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    readStripPosition();
  });
}, { passive: true });
strip.addEventListener("scrollend", () => {
  if (pendingSlide === null ||
      Math.abs(strip.scrollLeft - (visibleFrames[pendingSlide].offsetLeft - visibleFrames[0].offsetLeft)) < 2) {
    clearTimeout(settleTimer);
    finishStripScroll();
  }
});
strip.addEventListener("pointerdown", () => { pendingSlide = null; }, { passive: true });

function filterFrames(category, updateURL = false) {
  const active = filters.find((button) => button.dataset.filter === category) || filters[0];
  const selected = active.dataset.filter;
  filters.forEach((button) => button.setAttribute("aria-pressed", String(button === active)));
  frames.forEach((frame) => { frame.hidden = selected !== "all" && frame.dataset.category !== selected; });
  visibleFrames = frames.filter((frame) => !frame.hidden);
  slideIndex = 0;
  renderCounter();
  moveStrip(0, "instant");
  if (updateURL) {
    const url = new URL(location.href);
    if (selected === "all") url.searchParams.delete("gallery");
    else url.searchParams.set("gallery", selected);
    history.replaceState(history.state, "", url);
  }
  window.ScrollTrigger?.refresh();
}

const readFilter = () => new URLSearchParams(location.search).get("gallery") || "all";
filters.forEach((button) => button.addEventListener("click", () => filterFrames(button.dataset.filter, true)));
window.addEventListener("popstate", () => {
  if (filters.find((button) => button.getAttribute("aria-pressed") === "true").dataset.filter !== readFilter()) {
    filterFrames(readFilter());
  }
});
if (readFilter() !== "all") filterFrames(readFilter());

function renderLightbox(index) {
  lightboxIndex = index;
  const frame = visibleFrames[index];
  const photo = frame.querySelector("img");
  lightboxPhoto.classList.remove("media-unavailable");
  lightboxPhoto.alt = photo.alt;
  lightboxPhoto.src = frame.querySelector("a").href;
  lightboxCaption.textContent = frame.querySelector(".frame__title").textContent;
  lightboxCounter.textContent = framePosition(index, visibleFrames.length);
}

function moveGallery(direction, behavior = scrollBehavior()) {
  if (lightbox.open) renderLightbox(cycle(lightboxIndex, direction));
  else moveStrip(cycle(pendingSlide ?? slideIndex, direction), behavior);
}

for (const button of document.querySelectorAll("[data-gallery-step]")) {
  button.addEventListener("click", (event) => {
    moveGallery(Number(button.dataset.galleryStep), event.detail === 0 ? "instant" : scrollBehavior());
  });
}

function galleryKeys(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!direction) return;
  event.preventDefault();
  moveGallery(direction, "instant");
}

strip.addEventListener("keydown", galleryKeys);
lightbox.addEventListener("keydown", galleryKeys);

strip.addEventListener("click", (event) => {
  const link = event.target.closest(".frame__image");
  if (!link || !plainClick(event) || typeof lightbox.showModal !== "function") return;
  event.preventDefault();
  renderLightbox(visibleFrames.indexOf(link.closest(".frame")));
  lightbox.showModal();
});
lightbox.addEventListener("close", () => {
  moveStrip(lightboxIndex, "instant");
  visibleFrames[lightboxIndex].querySelector("a").focus({ preventScroll: true });
});

let touchStart;
lightbox.addEventListener("touchstart", (event) => {
  touchStart = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });
lightbox.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
lightbox.addEventListener("touchend", (event) => {
  if (!touchStart || event.touches.length) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.clientX;
  const dy = touch.clientY - touchStart.clientY;
  touchStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) moveGallery(dx < 0 ? 1 : -1);
}, { passive: true });

const shootForm = document.querySelector(".shoot-form");
const brief = [...document.querySelectorAll("[data-summary]")];
function updateBrief() {
  const values = new FormData(shootForm);
  brief.forEach((field) => {
    const value = values.get(field.dataset.summary);
    if (field.textContent !== value) field.textContent = value;
  });
}
shootForm.addEventListener("change", updateBrief);
window.addEventListener("pageshow", updateBrief);
updateBrief();

const privacy = document.querySelector(".privacy");
const privacyToggle = document.querySelector("[data-privacy]");
privacyToggle.hidden = typeof privacy.showModal !== "function";
privacyToggle.addEventListener("click", () => privacy.showModal());
privacy.addEventListener("click", (event) => {
  if (event.target !== privacy) return;
  const bounds = privacy.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) privacy.close();
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

function markUnavailable(image) {
  image.classList.add("media-unavailable");
  if (image === lightboxPhoto) lightboxCaption.textContent += " · Изображение недоступно";
  image.closest(".about__photo")?.classList.add("photo-unavailable");
}
for (const image of document.images) {
  image.addEventListener("error", () => markUnavailable(image));
  if (image.currentSrc && image.complete && !image.naturalWidth) markUnavailable(image);
}

const heroBeats = [
  ["#hero-title", 0, .62, 22],
  [".hero__description", .11, .51, 12],
  [".hero__actions", .19, .48, 8],
  [".rating", .24, .38, 0],
];
const firstFrames = () => visibleFrames.slice(0, 3).map((frame) => frame.querySelector(".frame__image"));
const canAnimate = !location.hash || location.hash === "#top";

if (window.gsap && window.ScrollTrigger) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    if (canAnimate && window.scrollY < 100) {
      const entrance = gsap.timeline({ defaults: { ease: "power3.out", clearProps: "transform,opacity" } });
      heroBeats.forEach(([selector, delay, duration, y]) => {
        entrance.from(selector, { y, duration, opacity: .32 }, delay);
      });
    }
    const reveal = gsap.timeline({
      scrollTrigger: { trigger: strip, start: "top 91%", once: true },
      defaults: { ease: "power3.out", clearProps: "transform,opacity" },
    });
    firstFrames().forEach((frame, index) => {
      reveal.from(frame, { y: [14, 11, 8][index], opacity: .35, duration: [.54, .49, .45][index] }, [0, .07, .12][index]);
    });
  });
} else if (!reduceMotion.matches && typeof Element.prototype.animate === "function") {
  const running = [];
  function rise(element, delay, duration, y) {
    running.push(element.animate([
      { opacity: .35, transform: "translateY(" + y + "px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], { delay, duration, easing: "cubic-bezier(.23, 1, .32, 1)", fill: "backwards" }));
  }
  if (canAnimate && window.scrollY < 100) {
    heroBeats.forEach(([selector, delay, duration, y]) => rise(document.querySelector(selector), delay * 1000, duration * 1000, y));
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (!reduceMotion.matches) firstFrames().forEach((frame, index) => rise(frame, [0, 70, 120][index], 500, 12));
    }, { rootMargin: "0px 0px -8% 0px" });
    observer.observe(strip);
  }
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) running.forEach((animation) => animation.cancel());
  });
}

const heroEmblem = document.querySelector("[data-hero-emblem]");

function tiltEmblem(event) {
  const bounds = heroEmblem.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
  heroEmblem.style.setProperty("--shine-x", `${x * 100}%`);
  heroEmblem.style.setProperty("--shine-y", `${y * 100}%`);
  heroEmblem.style.setProperty("--tilt-x", `${(0.5 - y) * 16}deg`);
  heroEmblem.style.setProperty("--tilt-y", `${(x - 0.5) * 16}deg`);
  heroEmblem.dataset.active = "";
}

function resetEmblem() {
  delete heroEmblem.dataset.active;
  heroEmblem.style.removeProperty("--tilt-x");
  heroEmblem.style.removeProperty("--tilt-y");
}

for (const type of ["pointerdown", "pointermove"]) {
  heroEmblem.addEventListener(type, tiltEmblem, { passive: true });
}
for (const type of ["pointerleave", "pointercancel", "lostpointercapture"]) {
  heroEmblem.addEventListener(type, resetEmblem);
}
heroEmblem.addEventListener("pointerup", event => {
  if (event.pointerType !== "mouse") resetEmblem();
});
