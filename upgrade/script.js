"use strict";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const hoverMotion = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
const byId = (id) => document.getElementById(id);

const marquee = document.querySelector(".marquee");
const marqueeToggle = document.querySelector("[data-marquee]");
marqueeToggle.addEventListener("click", () => {
  const paused = marquee.classList.toggle("is-paused");
  marqueeToggle.setAttribute("aria-pressed", String(paused));
  marqueeToggle.setAttribute("aria-label", paused ? "Запустить бегущую строку" : "Приостановить бегущую строку");
  marqueeToggle.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
});

const track = byId("gallery-track");
const cards = [...track.querySelectorAll(".photo-card")];
const filters = [...document.querySelectorAll("[data-filter]")];
const galleryCount = byId("gallery-count");
const galleryProgress = byId("gallery-progress");
const [galleryBack, galleryNext] = document.querySelectorAll("[data-gallery-step]");
const lightbox = byId("lightbox");
const lightboxImage = byId("lightbox-image");
const lightboxError = byId("lightbox-error");
const lightboxOriginal = byId("lightbox-original");
const lightboxCount = byId("lightbox-count");
const lightboxStage = lightbox.querySelector(".lightbox-stage");

let visibleCards = cards;
let activeIndex = 0;
let requestedIndex = null;
let lightboxIndex = 0;
let positions = [];
let scrollFrame = 0;

function updateGalleryControls(index) {
  activeIndex = index;
  const count = visibleCards.length;
  galleryBack.disabled = index === 0;
  galleryNext.disabled = index === count - 1;
  const label = `${index + 1} / ${count}`;
  if (galleryCount.value !== label) galleryCount.value = label;
  galleryProgress.max = count;
  galleryProgress.value = index + 1;
}

function measureCards() {
  const origin = visibleCards[0].offsetLeft;
  positions = visibleCards.map((card) => card.offsetLeft - origin);
}

function jumpToCard(index, animate = false) {
  const destination = Math.max(0, Math.min(visibleCards.length - 1, index));
  const behavior = animate && !reduceMotion.matches ? "smooth" : "instant";
  requestedIndex = behavior === "smooth" ? destination : null;
  track.scrollTo({left: positions[destination], behavior});
  updateGalleryControls(destination);
}

function setFilter(category) {
  visibleCards = cards.filter((card) => category === "all" || card.dataset.category === category);
  for (const card of cards) card.hidden = !visibleCards.includes(card);
  for (const filter of filters) filter.setAttribute("aria-pressed", String(filter.dataset.filter === category));
  measureCards();
  jumpToCard(0);
}

function syncGallery() {
  scrollFrame = 0;
  if (requestedIndex !== null) return;
  const offset = track.scrollLeft;
  const nearest = positions.reduce((best, position, index) => {
    return Math.abs(position - offset) < Math.abs(positions[best] - offset) ? index : best;
  }, 0);
  updateGalleryControls(nearest);
}

function queueGallerySync() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncGallery);
}

for (const filter of filters) {
  filter.addEventListener("click", () => setFilter(filter.dataset.filter));
}
for (const tile of document.querySelectorAll("[data-direction]")) {
  tile.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    setFilter(tile.dataset.direction);
  });
}
for (const control of [galleryBack, galleryNext]) {
  control.addEventListener("click", () => jumpToCard(activeIndex + Number(control.dataset.galleryStep), true));
}
track.addEventListener("scroll", queueGallerySync, {passive: true});
track.addEventListener("scrollend", () => {
  requestedIndex = null;
  queueGallerySync();
});
for (const event of ["pointerdown", "wheel"]) {
  track.addEventListener(event, () => { requestedIndex = null; }, {passive: true});
}
track.addEventListener("keydown", (event) => {
  if (event.target !== track) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    jumpToCard(activeIndex + (event.key === "ArrowLeft" ? -1 : 1));
  }
});
new ResizeObserver(() => {
  measureCards();
  jumpToCard(activeIndex);
}).observe(track);
setFilter("all");

function showLightboxPhoto(index) {
  const count = visibleCards.length;
  lightboxIndex = (index + count) % count;
  const image = visibleCards[lightboxIndex].querySelector("img");
  lightboxImage.hidden = false;
  lightboxError.hidden = true;
  lightboxImage.alt = image.alt;
  lightboxImage.src = image.src;
  lightboxOriginal.href = image.src;
  lightboxCount.value = `${lightboxIndex + 1} / ${count}`;
  if (lightboxImage.complete && lightboxImage.naturalWidth === 0) displayLightboxError();
}

function displayLightboxError() {
  lightboxImage.hidden = true;
  lightboxError.hidden = false;
}

lightboxImage.addEventListener("error", displayLightboxError);
lightboxImage.addEventListener("load", () => {
  lightboxImage.hidden = false;
  lightboxError.hidden = true;
});

for (const image of document.querySelectorAll(".photo-card img")) {
  const showError = () => image.parentElement.classList.add("is-unavailable");
  image.addEventListener("error", showError);
  if (image.complete && image.naturalWidth === 0) showError();
}

for (const card of cards) {
  card.addEventListener("click", () => {
    showLightboxPhoto(visibleCards.indexOf(card));
    lightbox.showModal();
  });
}
for (const control of lightbox.querySelectorAll("[data-lightbox-step]")) {
  control.addEventListener("click", () => showLightboxPhoto(lightboxIndex + Number(control.dataset.lightboxStep)));
}
lightbox.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  showLightboxPhoto(lightboxIndex + (event.key === "ArrowLeft" ? -1 : 1));
});

let swipeStart = null;
lightboxStage.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  swipeStart = event.touches.length === 1 ? {x: touch.clientX, y: touch.clientY} : null;
}, {passive: true});
lightboxStage.addEventListener("touchcancel", () => { swipeStart = null; });
lightboxStage.addEventListener("touchend", (event) => {
  if (!swipeStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.25) {
    showLightboxPhoto(lightboxIndex + (dx < 0 ? 1 : -1));
  }
}, {passive: true});

const privacy = byId("privacy");
byId("privacy-open").addEventListener("click", () => privacy.showModal());
privacy.addEventListener("click", (event) => {
  if (event.target !== privacy) return;
  const rect = privacy.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) privacy.close();
});
for (const closer of document.querySelectorAll("[data-close]")) {
  closer.addEventListener("click", () => closer.closest("dialog").close());
}

const service = byId("service");
const quote = byId("quote");

for (const category of document.querySelectorAll("#price-list section")) {
  const group = document.createElement("optgroup");
  group.label = category.querySelector("h3").textContent;
  for (const row of category.querySelectorAll("dl > div")) {
    group.append(new Option(row.querySelector("dt").textContent, row.querySelector("dd").textContent));
  }
  service.append(group);
}
service.closest(".calculator").hidden = false;

function updateQuote() {
  quote.value = service.value;
}

service.addEventListener("change", updateQuote);
window.addEventListener("pageshow", updateQuote);
updateQuote();

const scene = document.querySelector("[data-tilt]");
const emblem = scene.querySelector(".brand-emblem");

function moveEmblem(event) {
  if (reduceMotion.matches || !event.isPrimary) return;
  const {left, top, width, height} = scene.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - left) / width));
  const y = Math.max(0, Math.min(1, (event.clientY - top) / height));
  emblem.style.setProperty("--tilt-x", `${(0.5 - y) * 20}deg`);
  emblem.style.setProperty("--tilt-y", `${(x - 0.5) * 24}deg`);
  emblem.style.setProperty("--glare-x", `${x * 100}%`);
  emblem.style.setProperty("--glare-y", `${y * 100}%`);
  scene.classList.add("is-lit");
}

function resetEmblem() {
  scene.classList.remove("is-lit");
}

scene.addEventListener("pointerdown", moveEmblem);
scene.addEventListener("pointermove", moveEmblem);
for (const event of ["pointerleave", "pointercancel", "lostpointercapture"]) {
  scene.addEventListener(event, resetEmblem);
}
scene.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "mouse") resetEmblem();
});
reduceMotion.addEventListener("change", resetEmblem);

for (const card of document.querySelectorAll("[data-glow]")) {
  const glow = document.createElement("span");
  glow.className = "glow";
  glow.setAttribute("aria-hidden", "true");
  card.prepend(glow);
  let frame = 0;

  card.addEventListener("pointermove", (event) => {
    if (!hoverMotion.matches || event.pointerType !== "mouse") return;
    cancelAnimationFrame(frame);
    const {clientX, clientY} = event;
    frame = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      glow.style.transform = `translate3d(${clientX - rect.left - 170}px, ${clientY - rect.top - 170}px, 0)`;
      card.classList.add("is-lit");
    });
  });
  card.addEventListener("pointerleave", () => {
    cancelAnimationFrame(frame);
    card.classList.remove("is-lit");
  });
}

let scrollMotionLoaded = false;
function initScrollMotion() {
  const {gsap, ScrollTrigger} = window;
  if (scrollMotionLoaded || !gsap || !ScrollTrigger) return;
  scrollMotionLoaded = true;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const group = document.querySelector("[data-reveal-group]");
    gsap.from(group.querySelectorAll(".method"), {
      y: 23,
      opacity: 0.25,
      ease: "power3.out",
      duration: 0.55,
      stagger: {amount: 0.18, ease: "power2.out"},
      scrollTrigger: {trigger: group, start: "top 94%", once: true}
    });
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
for (const id of ["gsap-cdn", "scrolltrigger-cdn"]) {
  byId(id).addEventListener("load", initScrollMotion);
}
initScrollMotion();
