"use strict";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const filters = document.querySelector(".filters");
const works = [...document.querySelectorAll(".work")];
const filterStatus = document.querySelector("#filter-status");
let visibleWorks = works;
filters.hidden = false;

filters.addEventListener("click", (event) => {
  const selected = event.target.closest("button[data-filter]");
  if (!selected || selected.getAttribute("aria-pressed") === "true") return;

  for (const button of filters.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button === selected));
  }

  const filter = selected.dataset.filter;
  visibleWorks = works.filter((work) => {
    work.hidden = filter !== "all" && work.dataset.style !== filter;
    return !work.hidden;
  });
  filterStatus.textContent = `Показано примеров: ${visibleWorks.length}`;
});

for (const photo of document.querySelectorAll(".photo")) {
  const markUnavailable = () => {
    photo.dataset.unavailable = "";
  };

  photo.addEventListener("error", markUnavailable);
  if (photo.complete && !photo.naturalWidth) markUnavailable();
}

const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const lightboxCount = document.querySelector("#lightbox-count");
const lightboxError = document.querySelector("#lightbox-error");
const closeLightbox = document.querySelector("#close-lightbox");
const previousPhoto = document.querySelector("#previous-photo");
const nextPhoto = document.querySelector("#next-photo");
let currentPhoto = 0;
let lightboxTrigger;

function showPhoto(index) {
  currentPhoto = (index + visibleWorks.length) % visibleWorks.length;
  const work = visibleWorks[currentPhoto];
  const photo = work.querySelector("img");
  lightboxCaption.textContent = photo.alt;
  lightboxCount.textContent = `${currentPhoto + 1} / ${visibleWorks.length}`;
  previousPhoto.disabled = nextPhoto.disabled = visibleWorks.length === 1;
  lightboxError.hidden = true;
  lightboxImage.hidden = false;
  lightboxImage.alt = photo.alt;
  lightboxImage.src = photo.src;
}

lightboxImage.addEventListener("error", () => {
  lightboxImage.hidden = true;
  lightboxError.hidden = false;
});

for (const work of works) {
  const link = work.querySelector(".work-image");
  link.addEventListener("click", (event) => {
    if (typeof lightbox.showModal !== "function" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    lightboxTrigger = link;
    showPhoto(visibleWorks.indexOf(work));
    lightbox.showModal();
  });
}

previousPhoto.addEventListener("click", () => showPhoto(currentPhoto - 1));
nextPhoto.addEventListener("click", () => showPhoto(currentPhoto + 1));
closeLightbox.addEventListener("click", () => lightbox.close());
lightbox.addEventListener("close", () => lightboxTrigger?.focus({ preventScroll: true }));

lightbox.addEventListener("keydown", (event) => {
  if (visibleWorks.length < 2) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showPhoto(currentPhoto + (event.key === "ArrowLeft" ? -1 : 1));
  }
});

const service = document.querySelector("#service");
const price = document.querySelector("#price");
const sendConfig = document.querySelector("#send-config");
const fallback = document.querySelector(".copy-fallback");
const manualCopy = document.querySelector("#manual-copy");
const toast = document.querySelector("#toast");
let toastTimer;
let copyAttempt = 0;

for (const category of document.querySelectorAll("#price-list section")) {
  const group = document.createElement("optgroup");
  group.label = category.querySelector("h3").textContent;
  for (const row of category.querySelectorAll("dl > div")) {
    group.append(new Option(row.querySelector("dt").textContent, row.querySelector("dd").textContent));
  }
  service.append(group);
}
service.closest(".calculator").hidden = false;

function updateEstimate() {
  price.value = service.value;
  fallback.hidden = true;
  copyAttempt++;
}

service.addEventListener("change", updateEstimate);
updateEstimate();
window.addEventListener("pageshow", updateEstimate);

function notify(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 5000);
}

function copyWithSelection(value) {
  const input = document.createElement("textarea");
  input.value = value;
  input.readOnly = true;
  input.style.cssText = "position: fixed; inset: 0 auto auto 0; opacity: 0; pointer-events: none;";
  const focused = document.activeElement;
  document.body.append(input);
  input.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    focused?.focus({ preventScroll: true });
  }
}

async function copyParameters(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return copyWithSelection(value);
    }
  }
  return copyWithSelection(value);
}

sendConfig.addEventListener("click", async () => {
  const attempt = ++copyAttempt;
  const message = [
    "Здравствуйте! Хочу уточнить позицию из прайса.",
    `Позиция: ${service.selectedOptions[0].textContent}`,
    `Стоимость по прайсу: ${price.value}`,
  ].join("\n");

  const copied = await copyParameters(message);
  if (attempt !== copyAttempt) return;

  fallback.hidden = copied;
  if (!copied) manualCopy.value = message;
  notify(copied ? "Параметры скопированы. Вставьте их в сообщение в ВК." : "Копирование недоступно. Параметры можно выделить вручную.");
});

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

const privacy = document.querySelector("#privacy");
document.querySelector("#privacy-open").addEventListener("click", () => privacy.showModal());
privacy.querySelector(".privacy-close").addEventListener("click", () => privacy.close());
privacy.addEventListener("click", (event) => {
  if (event.target !== privacy) return;
  const {left, right, top, bottom} = privacy.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
    privacy.close();
  }
});

if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-revealed");
      reveal.unobserve(entry.target);
    }
  }, {threshold: 0.15});
  for (const element of document.querySelectorAll("main .section h2, .work, .step, .estimate-shell, .contact-panel")) {
    reveal.observe(element);
  }
}
