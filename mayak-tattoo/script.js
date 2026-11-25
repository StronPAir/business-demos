"use strict";

const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const scrollBehavior = () => motionPreference.matches ? "instant" : "smooth";
document.documentElement.classList.add("js");

const header = document.querySelector(".site-header");
const navigation = document.querySelector("#site-nav");
const menu = document.querySelector(".menu-toggle");
const navigationLinks = [...navigation.querySelectorAll("a")];
const sections = navigationLinks.map(link => document.querySelector(link.hash));

function setMenu(open) {
  menu.setAttribute("aria-expanded", String(open));
}

menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") === "false"));
header.addEventListener("keydown", event => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    menu.focus();
  }
});
document.addEventListener("pointerdown", event => {
  if (!header.contains(event.target)) setMenu(false);
});
const mobileNavigation = matchMedia("(max-width: 760px)");
mobileNavigation.addEventListener("change", () => setMenu(false));

function isPlainClick(event) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", event => {
    if (!isPlainClick(event)) return;
    const destination = document.querySelector(link.hash);
    if (!destination) return;
    event.preventDefault();
    setMenu(false);
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);

    const top = destination.id === "top" || destination.id === "main"
      ? 0
      : window.scrollY + destination.getBoundingClientRect().top - header.offsetHeight - 12;
    destination.focus({ preventScroll: true });
    window.scrollTo({ top, behavior: scrollBehavior() });
  });
});

let scrollFrame = 0;
let activeSection;
function updateNavigation() {
  scrollFrame = 0;
  const activationLine = header.offsetHeight + 34;
  let current;
  for (const section of sections) {
    if (section.getBoundingClientRect().top > activationLine) break;
    current = section.id;
  }
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = sections.at(-1).id;
  }
  if (current === activeSection) return;
  activeSection = current;
  for (const link of navigationLinks) {
    if (link.hash === "#" + current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
function requestNavigationUpdate() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateNavigation);
}
window.addEventListener("scroll", requestNavigationUpdate, { passive: true });
window.addEventListener("resize", requestNavigationUpdate);
updateNavigation();

const marquee = document.querySelector(".marquee");
const marqueeToggle = document.querySelector(".marquee-toggle");
marqueeToggle.addEventListener("click", () => {
  const paused = marquee.classList.toggle("is-paused");
  marqueeToggle.setAttribute("aria-pressed", String(paused));
  marqueeToggle.setAttribute("aria-label", paused ? "Продолжить бегущую строку" : "Приостановить бегущую строку");
});

const track = document.querySelector("#gallery-track");
const slides = [...track.querySelectorAll(".slide")];
const filters = [...document.querySelectorAll("[data-filter]")];
const galleryCount = document.querySelector(".gallery-count");
const gallerySteps = [...document.querySelectorAll("[data-gallery-step]")];
const lightbox = document.querySelector("#lightbox");
const fullImage = document.querySelector("#lightbox-image");
const fullCaption = document.querySelector("#lightbox-caption");
const fullCount = document.querySelector("#lightbox-count");
const lightboxSteps = [...lightbox.querySelectorAll("[data-lightbox-step]")];
const validFilters = new Set(filters.map(button => button.dataset.filter));
let visibleSlides = slides;
let activeFilter;
let lightboxIndex = 0;
let galleryFrame = 0;
let lastGalleryTarget = null;

const positionLabel = (position, total) => String(position).padStart(2, "0") + " / " + String(total).padStart(2, "0");

function galleryMetrics() {
  const left = track.scrollLeft;
  const max = Math.max(0, track.scrollWidth - track.clientWidth);
  const positions = visibleSlides.map(slide => Math.min(slide.offsetLeft, max));
  const index = positions.reduce((nearest, position, candidate) =>
    Math.abs(position - left) < Math.abs(positions[nearest] - left) ? candidate : nearest, 0);
  return { left, max, positions, index };
}

function updateGallery() {
  galleryFrame = 0;
  const { left, max, index } = galleryMetrics();
  const label = positionLabel(index + 1, visibleSlides.length);
  if (galleryCount.textContent !== label) galleryCount.textContent = label;
  gallerySteps[0].setAttribute("aria-disabled", String(left <= 1));
  gallerySteps[1].setAttribute("aria-disabled", String(left >= max - 1));
}

function requestGalleryUpdate() {
  if (!galleryFrame) galleryFrame = requestAnimationFrame(updateGallery);
}

function moveGallery(direction) {
  const { left, positions } = galleryMetrics();
  const stops = [...new Set(positions)];
  const current = lastGalleryTarget ?? left;
  const next = direction > 0
    ? stops.find(stop => stop > current + 1)
    : stops.findLast(stop => stop < current - 1);
  if (next === undefined) return;
  lastGalleryTarget = next;
  track.scrollTo({ left: next, behavior: scrollBehavior() });
}

function clearGalleryTarget() {
  lastGalleryTarget = null;
}

track.addEventListener("scroll", requestGalleryUpdate, { passive: true });
for (const eventName of ["scrollend", "pointerdown", "wheel"]) {
  track.addEventListener(eventName, clearGalleryTarget, { passive: true });
}
window.addEventListener("resize", () => {
  clearGalleryTarget();
  requestGalleryUpdate();
});
gallerySteps.forEach(button => button.addEventListener("click", () => {
  if (button.getAttribute("aria-disabled") !== "true") moveGallery(Number(button.dataset.galleryStep));
}));
track.addEventListener("keydown", event => {
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const index = visibleSlides.findIndex(slide => slide.contains(event.target));
    if (index < 0) moveGallery(delta);
    else visibleSlides[index + delta]?.querySelector("a").focus();
  }
});

function setFilter(filter) {
  if (filter === activeFilter) return;
  activeFilter = filter;
  slides.forEach(slide => { slide.hidden = filter !== "all" && slide.dataset.scale !== filter; });
  filters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  visibleSlides = slides.filter(slide => !slide.hidden);
  clearGalleryTarget();
  track.scrollTo({ left: 0, behavior: "instant" });
  updateGallery();
}

function restoreFilter() {
  const filter = new URLSearchParams(location.search).get("scale");
  setFilter(validFilters.has(filter) ? filter : "all");
}
filters.forEach(button => button.addEventListener("click", () => {
  const filter = button.dataset.filter;
  if (filter === activeFilter) return;
  setFilter(filter);
  const url = new URL(location.href);
  if (filter === "all") url.searchParams.delete("scale");
  else url.searchParams.set("scale", filter);
  if (location.protocol !== "file:") history.replaceState(null, "", url);
}));
window.addEventListener("popstate", restoreFilter);
restoreFilter();

function renderLightbox() {
  const slide = visibleSlides[lightboxIndex];
  const thumbnail = slide.querySelector("img");
  fullImage.src = thumbnail.src;
  fullImage.alt = thumbnail.alt;
  fullCaption.textContent = thumbnail.alt;
  fullCount.textContent = positionLabel(lightboxIndex + 1, visibleSlides.length);
  lightboxSteps.forEach(button => {
    button.setAttribute("aria-disabled", String(visibleSlides.length < 2));
  });
}
function moveLightbox(direction) {
  if (visibleSlides.length < 2) return;
  lightboxIndex = (lightboxIndex + direction + visibleSlides.length) % visibleSlides.length;
  renderLightbox();
}
track.addEventListener("click", event => {
  const slide = event.target.closest(".slide-link");
  if (!slide || !isPlainClick(event) || typeof lightbox.showModal !== "function") return;
  event.preventDefault();
  lightboxIndex = visibleSlides.indexOf(slide.closest(".slide"));
  renderLightbox();
  lightbox.showModal();
});
lightboxSteps.forEach(button => button.addEventListener("click", () => moveLightbox(Number(button.dataset.lightboxStep))));
lightbox.addEventListener("keydown", event => {
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(event.key === "ArrowRight" ? 1 : -1);
  }
});
let swipeStart;
const lightboxFigure = lightbox.querySelector("figure");
lightboxFigure.addEventListener("touchstart", event => {
  swipeStart = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });
lightboxFigure.addEventListener("touchend", event => {
  if (!swipeStart || event.touches.length) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.clientX;
  const dy = touch.clientY - swipeStart.clientY;
  swipeStart = null;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) moveLightbox(dx < 0 ? 1 : -1);
}, { passive: true });
lightboxFigure.addEventListener("touchcancel", () => { swipeStart = null; });

const privacy = document.querySelector("#privacy");
document.querySelector("#open-privacy").addEventListener("click", () => privacy.showModal());
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});

const form = document.querySelector("#estimate-form");
const resultPrice = document.querySelector("#result-price");
const resultSummary = document.querySelector("#result-summary");
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const formats = {
  mini: { name: "Мини-тату", price: 4000 },
  medium: { name: "Среднего размера", price: 10000 },
  large: { name: "Крупный проект", price: 15000 }
};

function updateEstimate() {
  const format = form.elements.format.value;
  const { name, price } = formats[format];
  const style = form.elements.style.selectedOptions[0].textContent;
  const zoneField = form.elements.zone;
  const zone = zoneField.value === "undecided" ? "Зона пока не выбрана" : zoneField.selectedOptions[0].textContent;
  const description = "от " + currency.format(price) + (format === "large" ? " за сеанс" : "");
  resultPrice.textContent = description;
  resultPrice.toggleAttribute("data-compact", format === "large");
  resultSummary.textContent = [name, style, zone].join(" · ");
}
form.addEventListener("submit", event => event.preventDefault());
form.addEventListener("change", updateEstimate);
window.addEventListener("pageshow", updateEstimate);
updateEstimate();

const revealGroups = document.querySelectorAll("[data-reveal-group]");
if ("IntersectionObserver" in window) {
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    marquee.classList.toggle("offscreen", !entry.isIntersecting);
  });
  visibilityObserver.observe(marquee);
}

function startMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) {
    document.documentElement.classList.add("motion-css", "reveal-fallback");
    if (!("IntersectionObserver" in window)) return;

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        target.classList.add("is-seen");
        revealObserver.unobserve(target);
      });
    }, { threshold: .15 });
    revealGroups.forEach(group => revealObserver.observe(group));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const hero = gsap.timeline({ defaults: { ease: "power3.out", clearProps: "transform,opacity" } });
    hero
      .from(".hero-line:first-child > span", { yPercent: 65, opacity: .2, duration: .62 }, 0)
      .from(".hero-line:nth-child(2) > span", { yPercent: 53, opacity: .3, duration: .565 }, .095)
      .from(".hero-intro", { y: 12, opacity: .55, duration: .48 }, .16)
      .from(".hero-details", { opacity: .35, duration: .42 }, .195);

    revealGroups.forEach(group => {
      gsap.from(group.querySelectorAll("[data-reveal]"), {
        y: index => index === 0 ? 17 : 10,
        opacity: .55,
        duration: .53,
        ease: "power3.out",
        stagger: .065,
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: group, start: "top 92%", once: true }
      });
    });
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

startMotion();

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
