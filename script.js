document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === page) link.classList.add("active");
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  menu?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

  // Giveaway lives behind Explore > Giveaway.
  const modal = document.getElementById("giveawayModal");
  const openGiveaway = () => {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };
  const closeGiveaway = () => {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };
  document.querySelectorAll("[data-open-giveaway]").forEach(link => {
    link.addEventListener("click", event => { event.preventDefault(); openGiveaway(); });
  });
  document.querySelectorAll("[data-close-giveaway]").forEach(el => el.addEventListener("click", closeGiveaway));

  // Giveaway countdown. Change only this date for a future giveaway.
  const giveawayEnd = new Date("2026-12-25T23:59:59+05:30").getTime();
  const updateTimer = () => {
    const now = Date.now();
    let diff = Math.max(0, giveawayEnd - now);
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value).padStart(2, "0");
    };
    set("days", d); set("hours", h); set("minutes", m); set("seconds", s);
    const status = document.getElementById("giveawayStatus");
    if (status) status.textContent = diff <= 0 ? "RESULTS SOON" : "COUNTING DOWN";
  };
  if (document.getElementById("timer")) { updateTimer(); setInterval(updateTimer, 1000); }

  // Reveal-on-scroll.
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08 });
    revealItems.forEach(el => observer.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add("visible"));
  }

  initOwnerGallery();
});

function initOwnerGallery() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const empty = document.getElementById("galleryEmpty");
  const moreButton = document.getElementById("galleryMore");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDescription = document.getElementById("lightboxDescription");
  const lightboxIndex = document.getElementById("lightboxIndex");

  const manual = Array.isArray(window.VEIL_GALLERY) ? window.VEIL_GALLERY : [];
  const extensions = ["jpg", "jpeg", "png", "webp"];
  const candidates = [];
  for (let i = 1; i <= 100; i++) {
    for (const ext of extensions) candidates.push({ index: i, src: `assets/gallery/gallery-${String(i).padStart(2, "0")}.${ext}` });
  }

  const titleFromFilename = src => {
    const filename = src.split("/").pop().replace(/\.[^.]+$/, "");
    const clean = filename.replace(/^gallery[-_]?\d+[-_]?/i, "").replace(/[-_]+/g, " ").trim();
    if (!clean) return "A gifting moment";
    return clean.replace(/\b\w/g, c => c.toUpperCase());
  };

  const loadImage = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });

  const discover = async () => {
    // Manual entries are supported for owners who want captions/layout control.
    if (manual.length) return manual.filter(item => item && item.image);

    const found = [];
    // Check all supported names. Missing files are simply ignored.
    for (let i = 0; i < candidates.length; i += 8) {
      const batch = candidates.slice(i, i + 8);
      const results = await Promise.all(batch.map(async candidate => ({
        ...candidate,
        exists: await loadImage(candidate.src)
      })));
      results.forEach(item => {
        if (item.exists) found.push({
          image: item.src,
          title: titleFromFilename(item.src),
          description: "A moment from The Veil Store.",
          size: item.index % 11 === 0 ? "feature" : item.index % 4 === 0 ? "landscape" : item.index % 3 === 0 ? "portrait" : "square"
        });
      });
    }
    return found;
  };

  let items = [];
  let shown = 0;
  const pageSize = 12;
  let activeIndex = 0;

  const openLightbox = index => {
    if (!lightbox || !items.length) return;
    activeIndex = (index + items.length) % items.length;
    const item = items[activeIndex];
    lightboxImage.src = item.image;
    lightboxImage.alt = item.title || "The Veil Store gifting photograph";
    if (lightboxTitle) lightboxTitle.textContent = item.title || "A gifting moment";
    if (lightboxDescription) lightboxDescription.textContent = item.description || "";
    if (lightboxIndex) lightboxIndex.textContent = `${activeIndex + 1} / ${items.length}`;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const renderMore = () => {
    const next = Math.min(shown + pageSize, items.length);
    for (let i = shown; i < next; i++) {
      const item = items[i];
      const card = document.createElement("button");
      card.type = "button";
      card.className = `gallery-card gallery-${item.size || "square"}`;
      card.setAttribute("aria-label", `Open ${item.title || "gifting photograph"}`);
      card.innerHTML = `
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || "The Veil Store gifting photograph")}" loading="lazy">
        <div class="gallery-caption">
          <div><span>THE VEIL STORE</span><strong>${escapeHtml(item.title || "A gifting moment")}</strong></div>
          <small>${escapeHtml(item.description || "")}</small>
        </div>`;
      card.addEventListener("click", () => openLightbox(i));
      card.querySelector("img")?.addEventListener("load", () => card.classList.add("loaded"), { once: true });
      gallery.appendChild(card);
    }
    shown = next;
    if (moreButton) {
      moreButton.hidden = shown >= items.length;
      moreButton.textContent = shown < items.length ? `View more moments · ${items.length - shown} more` : "All moments shown";
    }
  };

  moreButton?.addEventListener("click", renderMore);
  document.querySelectorAll("[data-close-gallery]").forEach(el => el.addEventListener("click", closeLightbox));
  document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => openLightbox(activeIndex - 1));
  document.querySelector("[data-gallery-next]")?.addEventListener("click", () => openLightbox(activeIndex + 1));
  document.addEventListener("keydown", event => {
    if (!lightbox?.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") openLightbox(activeIndex - 1);
    if (event.key === "ArrowRight") openLightbox(activeIndex + 1);
  });

  discover().then(result => {
    items = result;
    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    renderMore();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}
