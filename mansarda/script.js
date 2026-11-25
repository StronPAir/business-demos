"use strict";

const root = document.documentElement;
const header = document.querySelector(".header");
const nav = document.querySelector(".nav");
const navLinks = [...nav.querySelectorAll("a")];
const sections = navLinks.map(link => document.querySelector(link.hash));
const menu = document.querySelector(".menu-toggle");
const themeToggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const mobile = matchMedia("(max-width: 880px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

root.classList.add("js");
menu.hidden = false;
themeToggle.hidden = false;
themeToggle.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
themeToggle.addEventListener("click", () => {
  const dark = root.dataset.theme !== "dark";
  root.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeColor.content = dark ? "#11100E" : "#FBFBF9";
  try {
    localStorage.setItem("mansarda-theme", root.dataset.theme);
  } catch {
    // Theme switching still works when browser storage is disabled.
  }
});

function setMenu(open) {
  nav.classList.toggle("nav-open", open);
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
}

menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") === "false";
  setMenu(open);
  if (open) navLinks[0].focus({ preventScroll: true });
});
mobile.addEventListener("change", () => setMenu(false));
header.addEventListener("keydown", event => {
  if (event.key === "Escape" && nav.classList.contains("nav-open")) {
    setMenu(false);
    menu.focus();
  }
});

function headerOffset() {
  return header.offsetHeight + 16;
}

let scrollFrame = 0;
function updateNavigation() {
  scrollFrame = 0;
  const probe = scrollY + headerOffset() + 12;
  let active = sections.findLastIndex(section => section.getBoundingClientRect().top + scrollY <= probe);
  if (scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2) active = sections.length - 1;
  navLinks.forEach((link, index) => {
    if (index === active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function scheduleNavigation() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateNavigation);
}

window.addEventListener("scroll", scheduleNavigation, { passive: true });
window.addEventListener("resize", scheduleNavigation);
updateNavigation();

document.querySelectorAll('a[href^="#"]:not(.skip)').forEach(link => {
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = document.querySelector(link.hash);
    if (!target) return;
    event.preventDefault();

    const fromMobileMenu = mobile.matches && nav.contains(link);
    setMenu(false);
    if (fromMobileMenu || event.detail === 0) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }

    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    const top = target === document.body ? 0 : target.getBoundingClientRect().top + scrollY - headerOffset();
    window.scrollTo({ top, behavior: reducedMotion.matches ? "instant" : "smooth" });
  });
});

const marquee = document.querySelector(".marquee");
const marqueeToggle = marquee.querySelector("button");
marqueeToggle.hidden = false;
marquee.classList.add("marquee-ready");
marqueeToggle.addEventListener("click", () => {
  const paused = marqueeToggle.getAttribute("aria-pressed") === "true";
  marqueeToggle.setAttribute("aria-pressed", String(!paused));
  marqueeToggle.setAttribute("aria-label", paused ? "Приостановить бегущую строку" : "Возобновить бегущую строку");
});

const gallery = document.querySelector(".gallery");
const track = gallery.querySelector(".gallery-track");
const cards = [...track.querySelectorAll(".gallery-card")];
const filters = [...gallery.querySelectorAll("[data-filter]")];
const count = gallery.querySelector(".gallery-count");
const galleryTools = gallery.querySelector(".gallery-tools");
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector("figcaption");
let visibleCards = cards;
let current = 0;
let lightboxIndex = 0;
let galleryFrame = 0;
let activeFilter = "all";

function cardOffset(card) {
  return card.offsetLeft - 4;
}

function updateArrows(container, index) {
  container.querySelectorAll("[data-step]").forEach(button => {
    const next = index + Number(button.dataset.step);
    button.setAttribute("aria-disabled", String(next < 0 || next >= visibleCards.length));
  });
}

function updateGallery() {
  galleryFrame = 0;
  current = visibleCards.reduce((nearest, card, index) => {
    const distance = Math.abs(cardOffset(card) - track.scrollLeft);
    return distance < Math.abs(cardOffset(visibleCards[nearest]) - track.scrollLeft) ? index : nearest;
  }, 0);

  const label = visibleCards.length ? `${current + 1} / ${visibleCards.length}` : "0 фото";
  if (count.textContent !== label) count.textContent = label;
  updateArrows(gallery, current);
}

function moveGallery(index, animate) {
  const card = visibleCards[index];
  if (!card) return;
  track.scrollTo({ left: cardOffset(card), behavior: animate && !reducedMotion.matches ? "smooth" : "instant" });
}

function filterGallery(filter, reset = true) {
  const available = cards.filter(card => !card.dataset.unavailable);
  const currentCard = visibleCards[current];
  const openPhoto = lightbox.open ? visibleCards[lightboxIndex] : null;

  filters.forEach(button => {
    const zone = button.dataset.filter;
    button.hidden = zone !== "all" && !available.some(card => card.dataset.zones === zone);
  });

  if (filters.find(button => button.dataset.filter === filter)?.hidden) filter = "all";
  activeFilter = filter;
  filters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  cards.forEach(card => {
    card.hidden = Boolean(card.dataset.unavailable) || (filter !== "all" && card.dataset.zones !== filter);
  });
  visibleCards = cards.filter(card => !card.hidden);
  track.hidden = visibleCards.length === 0;
  galleryTools.hidden = available.length === 0;
  const retained = visibleCards.indexOf(currentCard);
  if (reset || retained < 0) moveGallery(0, false);
  else if (retained !== current) moveGallery(retained, false);
  updateGallery();

  if (openPhoto) {
    const index = visibleCards.indexOf(openPhoto);
    if (index < 0) lightbox.close();
    else showPhoto(index);
  }
}

function showPhoto(index) {
  const card = visibleCards[index];
  if (!card) return;
  const source = card.querySelector("img");
  lightboxIndex = index;
  lightboxImage.alt = source.alt;
  if (lightboxImage.src !== source.src) lightboxImage.src = source.src;
  const label = card.querySelector("figcaption strong").textContent;
  lightboxCaption.textContent = `${label} · ${index + 1} / ${visibleCards.length}`;
  updateArrows(lightbox, index);
}

function handleArrows(container, onStep) {
  container.querySelectorAll("[data-step]").forEach(button => {
    button.addEventListener("click", event => {
      if (button.getAttribute("aria-disabled") !== "true") onStep(Number(button.dataset.step), event.detail !== 0);
    });
  });
  container.addEventListener("keydown", event => {
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    onStep(step, false);
  });
}

filters.forEach(button => button.addEventListener("click", () => filterGallery(button.dataset.filter)));
track.addEventListener("scroll", () => {
  if (!galleryFrame) galleryFrame = requestAnimationFrame(updateGallery);
}, { passive: true });
handleArrows(gallery, (step, animate) => moveGallery(current + step, animate));
handleArrows(lightbox, step => showPhoto(lightboxIndex + step));
filterGallery("all");

cards.forEach(card => {
  const link = card.querySelector("a");
  const photo = link.querySelector("img");
  link.setAttribute("aria-haspopup", "dialog");
  function markUnavailable() {
    card.dataset.unavailable = "true";
    filterGallery(activeFilter, false);
  }
  photo.addEventListener("error", markUnavailable);
  if (photo.complete && !photo.naturalWidth) markUnavailable();
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    showPhoto(visibleCards.indexOf(card));
    lightbox.showModal();
  });
});

let touchStart = null;
const lightboxFigure = lightbox.querySelector("figure");
lightboxFigure.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" && event.isPrimary) touchStart = { x: event.clientX, y: event.clientY };
});
lightboxFigure.addEventListener("pointercancel", () => { touchStart = null; });
lightboxFigure.addEventListener("pointerup", event => {
  if (!touchStart || !event.isPrimary) return;
  const x = event.clientX - touchStart.x;
  const y = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(x) > 40 && Math.abs(x) > Math.abs(y) * 1.4) showPhoto(lightboxIndex + (x < 0 ? 1 : -1));
});
lightbox.addEventListener("close", () => { touchStart = null; });

const privacy = document.querySelector("#privacy");
document.querySelector('[data-dialog="privacy"]').addEventListener("click", () => privacy.showModal());
privacy.addEventListener("click", event => {
  if (event.target !== privacy) return;
  const box = privacy.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) privacy.close();
});

const formatPrice = new Intl.NumberFormat("ru-RU");
const calculator = document.querySelector(".calculator");
const cost = calculator.querySelector("#cost");
const rentDay = calculator.querySelector("#rent-day");
const rentPeriod = calculator.querySelector("#rent-period");
const rates = Object.fromEntries([...document.querySelectorAll("[data-rate]")].map(cell => [
  cell.dataset.rate, Number(cell.textContent.replace(/\D/g, ""))
]));

function updateCost() {
  const hours = Number(calculator.querySelector('input[name="duration"]:checked').value);
  const rate = rates[`${hours === 0.5 ? "half-hour" : rentDay.value}-${rentPeriod.value}`];
  const total = hours === 0.5 ? rate : rate * hours;
  cost.value = `${formatPrice.format(total)} ₽`;
}

calculator.addEventListener("change", updateCost);
window.addEventListener("pageshow", updateCost);
updateCost();

const heroTitle = document.querySelector(".hero h1");
const heroSubtitle = document.querySelector(".hero-subtitle");
const heroDescription = document.querySelector(".hero-description");
const heroActions = document.querySelector(".hero-actions");
const heroFrame = document.querySelector(".hero-frame");
const badge = document.querySelector(".rating");
const revealGroups = [...document.querySelectorAll(".gallery-track, .calculator, .rules-list")];
const reveals = group => group.matches("[data-reveal]") ? [group] : [...group.querySelectorAll("[data-reveal]:not([hidden])")];

function startMotion() {
  const gsap = window.gsap;
  if (gsap && window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline({ defaults: { ease: "power3.out", clearProps: "transform,opacity" } })
        .from(heroTitle, { opacity: 0, y: 18, duration: .64 }, 0)
        .from(heroFrame, { opacity: 0, duration: .62 }, 0)
        .from(heroSubtitle, { opacity: 0, y: 12, duration: .56 }, .09)
        .from(heroDescription, { opacity: 0, y: 8, duration: .48 }, .16)
        .from(heroActions, { opacity: 0, y: 6, duration: .46 }, .21)
        .from(badge, { opacity: 0, duration: .38 }, .25);

      revealGroups.forEach(group => {
        window.ScrollTrigger.create({
          trigger: group,
          start: "top 91%",
          once: true,
          onEnter: () => gsap.from(reveals(group), {
            opacity: .35, y: 13, duration: .48, ease: "power3.out",
            stagger: index => Math.min(.19, .23 * (1 - .65 ** index)),
            clearProps: "transform,opacity"
          })
        });
      });
    });
    return;
  }

  if (reducedMotion.matches || !Element.prototype.animate) return;
  root.classList.add("motion-fallback");
  const fallback = [];
  const animateEntrance = (element, distance, delay, duration, opacity = 0) => {
    fallback.push(element.animate(
      [{ opacity, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }],
      { delay, duration, fill: "backwards", easing: "cubic-bezier(.23, 1, .32, 1)" }
    ));
  };

  animateEntrance(heroTitle, 18, 0, 640);
  animateEntrance(heroFrame, 0, 0, 620);
  animateEntrance(heroSubtitle, 12, 90, 560);
  animateEntrance(heroDescription, 8, 160, 480);
  animateEntrance(heroActions, 6, 210, 460);
  animateEntrance(badge, 0, 250, 380);

  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      reveals(entry.target).forEach((element, index) => animateEntrance(element, 13, Math.min(190, 230 * (1 - .65 ** index)), 480, .35));
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -9% 0px" });
  revealGroups.forEach(group => observer.observe(group));
  reducedMotion.addEventListener("change", event => {
    if (!event.matches) return;
    observer.disconnect();
    fallback.forEach(animation => animation.cancel());
  });
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
