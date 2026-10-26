import { layoutMosaic } from "./mosaic-layout.js?v=20261026-jobs-v16";
import { isInstagramLink } from "./link-metadata.js?v=20261026-jobs-v16";
import { api } from "./api.js?v=20261026-jobs-v16";
import { Feature } from "./feature.js?v=20261026-jobs-v16";
import {
  state,
  els,
  GLOBE_ICON,
  escapeHtml,
  normalizeUrl,
  defaultTileLabel,
  displayText,
  tileColor,
} from "./context.js?v=20261026-jobs-v16";

export class ContentBoard extends Feature {
  constructor(services) {
    super(services);
    this.layoutFrame = undefined;
  }

  renderTags() {
    const tab = this.services.tabs.current;
    const filters = ["All", ...(tab.filters || [])];
    els.tagList.innerHTML = filters
      .map(
        (tag) =>
          `<button class="tag-btn ${state.tag === tag ? "is-active" : ""}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span>↗</span></button>`,
      )
      .join("");
    if (!tab.metadataFilters) return;
    const metadataTags = [
      ...new Set(
        this.services.tabs.items.flatMap((tile) => tile.metadataTags || []),
      ),
    ].filter(
      (tag) =>
        !filters.some((preset) => preset.toLowerCase() === tag.toLowerCase()),
    );
    if (metadataTags.length)
      els.tagList.innerHTML += `<div class="metadata-filter-row"><span class="metadata-label">File metadata</span>${metadataTags.map((tag) => `<button type="button" class="tag-btn metadata-filter ${state.tag === tag ? "is-active" : ""}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span>↗</span></button>`).join("")}</div>`;
  }

  tileMatches(tile) {
    return this.services.tabs.matches(tile);
  }

  siteFaviconUrl(value) {
    try {
      const url = new URL(normalizeUrl(value));
      return ["http:", "https:"].includes(url.protocol)
        ? `${url.origin}/favicon.ico`
        : "";
    } catch {
      return "";
    }
  }

  defaultUrlBackground(tile = {}) {
    const backgrounds = state.urlBackgrounds || [];
    if (!backgrounds.length) return "";
    const index =
      [...String(tile.id || "")].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0,
      ) % backgrounds.length;
    return backgrounds[index];
  }

  urlBackgroundPickerMarkup() {
    const selected =
      state.pendingDrop.urlBackground ||
      this.defaultUrlBackground(state.pendingDrop);
    return `<div class="tile-background-picker">${this.services.editor.singleImagePickerMarkup()}<button type="button" id="retrieveLinkThumbnail" class="icon-btn retrieve-link-thumbnail" data-tooltip="Retrieve Link Thumbnail" aria-label="Retrieve Link Thumbnail" ${!state.pendingDrop?.url || state.savingContent ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17H5a4 4 0 0 1-.4-8A6 6 0 0 1 16 6a4 4 0 0 1 3 7.8M12 10v11m-4-4 4 4 4-4"/></svg></button><div class="url-background-options" role="group" aria-label="Link backgrounds">${(state.urlBackgrounds || []).map((src, i) => `<button type="button" class="tile-color-option url-background-option" data-url-background="${escapeHtml(src)}" aria-label="Link background ${i + 1}" aria-pressed="${!state.pendingThumbnail && selected === src}"><img src="${escapeHtml(src)}" alt="" /></button>`).join("")}</div></div><small>Choose one thumbnail or a background image.</small>`;
  }

  isYoutubeLink(tile) {
    if (tile.type !== "link") return false;
    try {
      return /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(
        new URL(normalizeUrl(tile.url)).hostname,
      );
    } catch {
      return false;
    }
  }

  tileMedia(tile) {
    if (tile.type === "entry")
      return tile.thumbnail
        ? `<img src="${escapeHtml(tile.thumbnail)}" alt="" loading="lazy">`
        : `<div class="watchlist-cover" style="background:${tileColor(tile)}"><span>${escapeHtml(tile.mediaType || "Media")}</span><strong>${escapeHtml(tile.label)}</strong><small>${escapeHtml(tile.author || "")}</small></div>`;
    if (tile.type === "text") {
      const s = tile.textStyle || {};
      const over = !!tile.thumbnail;
      const textHtml = `<div class="text-tile${over ? " text-tile--over" : ""}" style="background-color:${tileColor(tile)};font-family:${escapeHtml(s.font || "inherit")};font-size:${Number(s.fontSize || 28)}px;font-weight:${s.bold ? 700 : 500};font-style:${s.italic ? "italic" : "normal"};text-decoration:${s.underline ? "underline" : "none"};text-align:${escapeHtml(s.align || "left")}"><span class="text-content">${escapeHtml(displayText(tile))}</span></div>`;
      return over
        ? `<div class="text-thumb"><img class="cover" src="${escapeHtml(tile.thumbnail)}" alt="" />${textHtml}</div>`
        : textHtml;
    }
    if (tile.type === "image" && tile.files?.length) {
      const previewFiles = tile.files.slice(0, 4);
      const imgs = previewFiles
        .slice(0, 4)
        .map(
          (src, i) =>
            `<img src="${escapeHtml(src)}" alt="${escapeHtml(tile.label || `Image ${i + 1}`)}" />`,
        )
        .join("");
      return `<div class="gallery gallery--${previewFiles.length}">${imgs}</div>${tile.files.length > 1 ? `<span class="gallery-count" aria-label="${tile.files.length} images">+${tile.files.length}</span>` : ""}`;
    }
    if (tile.type === "video" && tile.files?.[0])
      return `<video src="${escapeHtml(tile.files[0])}"${tile.thumbnail ? ` poster="${escapeHtml(tile.thumbnail)}"` : ""} muted loop playsinline preload="${tile.thumbnail ? "metadata" : "auto"}"></video><span class="video-tile-play" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/><path d="m19 14 15 10-15 10z"/></svg></span>`;
    if (
      (tile.type === "audio" || tile.type === "file" || tile.type === "font") &&
      tile.thumbnail
    )
      return `<img class="cover" src="${escapeHtml(tile.thumbnail)}" alt="" />`;
    if (tile.type === "link") {
      const background =
        tile.thumbnail || tile.urlBackground || this.defaultUrlBackground(tile);
      const icon = tile.faviconUrl || this.siteFaviconUrl(tile.url);
      return `<div class="link-preview link-preview--site">${background ? `<img class="link-thumbnail${tile.thumbnail && this.isYoutubeLink(tile) ? " link-thumbnail--youtube" : ""}" src="${escapeHtml(background)}" alt="" />` : ""}<span class="link-site-icon" aria-label="Website"><span class="link-globe">${GLOBE_ICON}</span>${icon ? `<img class="link-favicon" data-link-favicon src="${escapeHtml(icon)}" alt="" referrerpolicy="no-referrer" />` : ""}</span></div>`;
    }
    return `<div class="file-symbol">${tile.type === "audio" ? "♪" : tile.type === "font" ? "Aa" : "↗"}</div>`;
  }

  pendingTileMarkup(item) {
    const percent = Math.round(Math.max(0, Math.min(1, item.progress)) * 100);
    const orientation = this.services.tabs.current.orientation || "landscape";
    let host = item.url;
    try {
      host = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {}
    return `<article class="tile tile--medium tile--${escapeHtml(orientation)} tile--pending" data-pending-link="${escapeHtml(item.id)}" aria-busy="true" aria-label="Adding ${escapeHtml(host)}"><div class="tile-media"><div class="link-preview link-preview--site">${item.background ? `<img class="link-thumbnail" src="${escapeHtml(item.background)}" alt="" />` : ""}</div></div><div class="tile-gradient"></div><div class="tile-content"><h3>${escapeHtml(host)}</h3><p data-pending-message>${escapeHtml(item.message)}</p></div><div class="pending-bar" role="progressbar" aria-label="Adding link" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div></article>`;
  }

  // Update one in-progress tile without rebuilding the whole grid.
  updatePendingTile(item) {
    const el = els.tileGrid.querySelector(
      `[data-pending-link="${CSS.escape(item.id)}"]`,
    );
    if (!el) return;
    const percent = Math.round(Math.max(0, Math.min(1, item.progress)) * 100);
    el.querySelector(".pending-bar span").style.width = `${percent}%`;
    el.querySelector(".pending-bar").setAttribute("aria-valuenow", String(percent));
    el.querySelector("[data-pending-message]").textContent = item.message;
  }

  renderTiles() {
    const filterKey = JSON.stringify([state.section, state.tag, state.query, state.genreFilters, state.activeCollectionId, state.activeHistoryMonth, state.settings.resultsPerPage]);
    if (this.filterKey !== filterKey) state.page = 1;
    this.filterKey = filterKey;
    const all = [...(state.pendingLinks || []), ...state.tiles].filter(this.tileMatches).sort((a, b) => this.createdTime(b) - this.createdTime(a));
    const perPage = Math.max(1, Math.min(50, Number(state.settings.resultsPerPage) || 25));
    const pages = Math.max(1, Math.ceil(all.length / perPage));
    state.page = Math.max(1, Math.min(state.page || 1, pages));
    const offset = (state.page - 1) * perPage;
    const items = all.slice(offset, offset + perPage);
    const boundary = state.lastVisit && !state.activeHistoryMonth && !state.activeCollectionId
      ? all.findIndex((tile) => this.createdTime(tile) <= state.lastVisit) : -1;
    // A separator belongs immediately before the first previously seen result.
    this.seenIndex = boundary > 0 && boundary >= offset && boundary < offset + items.length ? boundary - offset : -1;
    if (boundary === -1 && all.length && state.lastVisit && this.createdTime(all.at(-1)) > state.lastVisit && state.page === pages && !state.activeHistoryMonth && !state.activeCollectionId) this.seenIndex = items.length;
    document.getElementById("pageNav").innerHTML = `<button type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>&lt;</button><span aria-live="polite">${state.page} / ${pages}</span><button type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pages ? "disabled" : ""}>&gt;</button>`;
    if (this.services.tabs.view === "list") {
      this.resetTileLayout();
      this.services.tabs.renderList(items);
      this.insertSeenDivider();
      els.tileGrid.style.removeProperty("grid-template-columns");
      els.tileGrid.style.removeProperty("grid-template-rows");
      return;
    }
    els.tileGrid.innerHTML = items
      .map(
        (tile) => tile.pending ? this.pendingTileMarkup(tile) :
          `<article draggable="false" class="tile${isInstagramLink(tile) ? " tile--instagram" : ""} tile--${escapeHtml(tile.size || "medium")} tile--${escapeHtml(this.services.tabs.current.orientation || tile.orientation || "landscape")}" data-tile-id="${escapeHtml(tile.id)}" tabindex="0"><div class="tile-media">${this.tileMedia(tile)}</div><div class="tile-gradient"></div>${this.services.tabs.current.form === "watchlist" ? this.services.watchlist.watchedButton(tile, true) : ""}<div class="tile-actions"><button class="tile-action" data-edit-tile="${escapeHtml(tile.id)}" aria-label="Edit tile" data-tooltip="Edit content"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg></button></div><div class="tile-content"><h3>${escapeHtml(tile.label || defaultTileLabel(tile))}</h3>${tile.description || (tile.type === "link" ? tile.url : "") ? `<p>${escapeHtml(tile.description || tile.url)}</p>` : ""}</div></article>`,
      )
      .join("");
    els.emptyState.hidden = items.length > 0;
    this.insertSeenDivider();
    this.layoutTiles();
  }

  resetTileLayout() {
    const grid = els.tileGrid;
    grid.classList.remove("tile-grid--mosaic");
    grid.style.height = "";
    grid.style.gridTemplateRows = "";
    grid.style.gridTemplateColumns = "";
    for (const el of grid.children) {
      for (const key of ["gridColumn", "gridRow", "position", "left", "top", "width", "height"])
        el.style[key] = "";
    }
  }

  layoutTiles() {
    if (!els.tileGrid.clientWidth || this.services.tabs.view === "list") return;
    const grid = els.tileGrid;
    this.resetTileLayout();
    const width = grid.clientWidth;
    const gap = 13;
    const limit = Math.max(1, Math.min(8, Number(state.settings.gridRowLimit) || 3));
    if (this.services.tabs.view === "equal") {
      const count = Math.min(limit, Math.max(1, Math.floor((width + gap) / (220 + gap))));
      grid.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
      this.fitTextTiles();
      return;
    }
    grid.classList.add("tile-grid--mosaic");
    const tiles = new Map([...state.tiles, ...(state.pendingLinks || [])].map((tile) => [tile.id, tile]));
    let group = [], top = 0;
    const place = (el, x, y, w, h) => {
      Object.assign(el.style, {position: "absolute", left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`});
    };
    const flush = () => {
      if (!group.length) return;
      const shapes = group.map(({size, orientation}) => ({size, orientation}));
      const key = JSON.stringify([width, limit, shapes]);
      this.mosaicLayouts ||= new Map();
      let layout = this.mosaicLayouts.get(key);
      if (!layout) {
        layout = layoutMosaic(shapes, width, limit, gap);
        if (this.mosaicLayouts.size >= 16) this.mosaicLayouts.delete(this.mosaicLayouts.keys().next().value);
        this.mosaicLayouts.set(key, layout);
      }
      for (const rect of layout.tiles) place(group[rect.item.index].el, rect.x, top + rect.y, rect.width, rect.height);
      top += layout.height + gap;
      group = [];
    };
    for (const el of grid.children) {
      if (el.classList.contains("seen-divider")) {
        // Hard partition: neither packing nor date swaps can cross SEEN.
        flush();
        place(el, 0, top, width, 44);
        top += 44 + gap;
      } else {
        const tile = tiles.get(el.dataset.tileId || el.dataset.pendingLink) || {};
        group.push({...tile, el, orientation: this.services.tabs.current.orientation || tile.orientation || "landscape"});
      }
    }
    flush();
    grid.style.height = `${Math.max(0, top - gap)}px`;
    this.fitTextTiles();
  }


  createdTime(tile) {
    return Date.parse(tile.createdAt || tile.dateAdded || "") || 0;
  }

  insertSeenDivider() {
    if (this.seenIndex < 0) return;
    const divider = document.createElement("div");
    divider.className = "seen-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-label", "Previously seen content");
    divider.innerHTML = "<span>SEEN</span>";
    els.tileGrid.insertBefore(divider, els.tileGrid.children[this.seenIndex] || null);
  }

  startVisitTracking() {
    const key = `hub:last-visit:${location.pathname}`;
    const read = () => { try { const value = Number(localStorage.getItem(key)); return value > 0 && value <= Date.now() ? value : null; } catch { return null; } };
    const record = () => { try { localStorage.setItem(key, String(Date.now())); } catch { /* Session still works without storage. */ } };
    state.lastVisit = read();
    record();
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "hidden") record();
      else {
        state.lastVisit = read(); record();
        if (!state.savingContent && !(state.pendingLinks || []).length) {
          try {
            const fresh = await api.bootstrap();
            state.tiles = fresh.tiles;
            state.history = fresh.history || [];
            // Keep local collection changes while a write may still be pending.
            this.services.application.renderAll();
          } catch { this.renderTiles(); }
        }
      }
    });
    window.addEventListener("pagehide", record);
  }

  fitTextTiles() {
    els.tileGrid.querySelectorAll(".text-tile").forEach((preview) => {
      const tile = state.tiles.find(
        (item) => item.id === preview.closest("[data-tile-id]").dataset.tileId,
      );
      const content = preview.querySelector(".text-content");
      const css = getComputedStyle(preview);
      const height =
        preview.clientHeight -
        parseFloat(css.paddingTop) -
        parseFloat(css.paddingBottom);
      const width =
        preview.clientWidth -
        parseFloat(css.paddingLeft) -
        parseFloat(css.paddingRight);
      if (!content || height <= 0 || width <= 0) return;
      let low = 0,
        high = Math.max(1, Number(tile?.textStyle?.fontSize || 28));
      preview.style.fontSize = `${high}px`;
      if (content.scrollHeight <= height && content.scrollWidth <= width)
        return;
      for (let i = 0; i < 20; i++) {
        const size = (low + high) / 2;
        preview.style.fontSize = `${size}px`;
        if (content.scrollHeight <= height && content.scrollWidth <= width)
          low = size;
        else high = size;
      }
      preview.style.fontSize = `${low}px`;
    });
  }

  async handleClick(e) {
    const page = e.target.closest("[data-page]");
    if (page && !page.disabled) {
      state.page = Number(page.dataset.page);
      this.renderTiles();
      els.tileGrid.scrollIntoView({block: "start", behavior: "auto"});
      return;
    }
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      state.tag = tag.dataset.tag;
      this.renderTags();
      this.renderTiles();
      return;
    }
  }

  bindEvents() {
    els.gridLayoutToggle.addEventListener("click", () => {
      this.services.tabs.cycleView();
    });
    document.addEventListener(
      "load",
      (event) => {
        if (event.target.matches?.("[data-link-favicon]"))
          event.target.parentElement.classList.add("has-favicon");
      },
      true,
    );
    document.addEventListener(
      "error",
      (event) => {
        if (event.target.matches?.("[data-link-favicon]")) {
          event.target.hidden = true;
          event.target.parentElement.classList.remove("has-favicon");
        }
      },
      true,
    );
    els.search.addEventListener("input", () => {
      state.query = els.search.value.trim();
      els.clearSearch.classList.toggle("is-visible", !!state.query);
      this.renderTiles();
    });
    els.clearSearch.addEventListener("click", () => {
      els.search.value = "";
      state.query = "";
      els.clearSearch.classList.remove("is-visible");
      els.search.focus();
      this.renderTiles();
    });
    document.addEventListener("click", this.handleClick);
    document.fonts?.ready.then(this.fitTextTiles);
    document.fonts?.addEventListener("loadingdone", this.fitTextTiles);
    new ResizeObserver(() => {
      cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = requestAnimationFrame(this.layoutTiles);
    }).observe(els.tileGrid);
  }
}
