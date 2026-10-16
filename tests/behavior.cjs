// Run: node --experimental-vm-modules tests/behavior.cjs
// Tests actual feature modules; DOM measurements are supplied deterministically.
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
class Element {
  constructor(name = "div") {
    this.tagName = name;
    this.children = [];
    this.dataset = {};
    this.style = {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      },
    };
    this.className = "";
    this.clientWidth = 1000;
    this.classList = {
      contains: (n) => this.className.split(" ").includes(n),
      add: (n) => (this.className += " " + n),
      remove: (n) =>
        (this.className = this.className
          .split(" ")
          .filter((c) => c !== n)
          .join(" ")),
    };
  }
  append(el) {
    el.remove();
    el.parentElement = this;
    this.children.push(el);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
        (e) => e !== this,
      );
      this.parentElement = null;
    }
  }
  contains(el) {
    return (
      this.children.includes(el) || this.children.some((c) => c.contains(el))
    );
  }
  setAttribute(k, v) {
    this[k] = v;
  }
  insertBefore(el, before) {
    el.parentElement = this;
    const i = this.children.indexOf(before);
    if (i < 0) this.children.push(el);
    else this.children.splice(i, 0, el);
  }
  querySelectorAll() {
    return [];
  }
  querySelector(selector) {
    return (
      this.children.find((e) => e.classList.contains(selector.slice(1))) ||
      this.children.map((c) => c.querySelector(selector)).find(Boolean) ||
      null
    );
  }
  set innerHTML(html) {
    this.html = html;
    this.children = [];
    for (const match of html.matchAll(
      /<article[^>]*data-(tile-id|pending-link)="([^"]+)"/g,
    )) {
      const el = new Element();
      el.className =
        match[1] === "pending-link" ? "tile tile--pending" : "tile";
      el.dataset[match[1] === "pending-link" ? "pendingLink" : "tileId"] =
        match[2];
      this.append(el);
    }
  }
  get innerHTML() {
    return this.html || "";
  }
}
(async () => {
  const state = {
    tiles: [],
    section: "dashboard",
    tag: "All",
    query: "",
    genreFilters: [],
    activeCollectionId: null,
    activeHistoryMonth: null,
    lastVisit: 5000,
    page: 1,
    settings: { resultsPerPage: 25, gridRowLimit: 3 },
  };
  const els = {
    tileGrid: new Element(),
    emptyState: new Element(),
    viewerMedia: new Element(),
  };
  const nav = new Element();
  const ctx = vm.createContext({
    console,
    URL,
    Date,
    Map,
    Set,
    Math,
    Number,
    String,
    Array,
    JSON,
    FormData,
    Blob,
    File,
    CustomEvent,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({ columnGap: "13px" }),
    document: {
      getElementById: () => nav,
      createElement: (n) => new Element(n),
      dispatchEvent() {},
    },
  });
  const controls = {};
  const exports = {
    state,
    els,
    normalizeUrl: (s) => s,
    ENABLE_CALENDAR_MODULE: true,
    THEME_KEY: "test",
    favicon: () => "",
    IMAGE_LIMIT: 2097152,
    encode: () => {},
    TILE_COLOR_GROUPS: [],
    TILE_COLOR_COUNT: 0,
    BUILTIN_FONT_OPTIONS: [],
    FONT_UPLOAD_ICON: "",
    ALIGN_ORDER: [],
    ALIGN_ICONS: {},
    safeHostname: (s) => new URL(s).hostname,
    $$: () => [],
    $: (sel, root) =>
      root ? root.querySelector(sel) : (controls[sel] ||= new Element()),
    escapeHtml: (s) => String(s),
    defaultTileLabel: (t) => t.type,
    displayText: (t) => t.text || "",
    tileColor: () => "",
    GLOBE_ICON: "",
    MEDIA_TYPES: new Set(["image"]),
  };
  const contextModule = new vm.SyntheticModule(
    Object.keys(exports),
    function () {
      for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
    },
    { context: ctx },
  );
  const apiMock = {};
  const api = new vm.SyntheticModule(
    ["api"],
    function () {
      this.setExport("api", apiMock);
    },
    { context: ctx },
  );
  const cache = new Map();
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    const mod = new vm.SourceTextModule(
      fs.readFileSync(path.join(__dirname, "../assets/js", name), "utf8"),
      { context: ctx },
    );
    cache.set(name, mod);
    await mod.link((spec) =>
      spec.startsWith("./context.js")
        ? contextModule
        : spec.startsWith("./api.js")
          ? api
          : load(spec.split("?")[0].slice(2)),
    );
    return mod;
  }
  const boardModule = await load("content-board.js");
  await boardModule.evaluate();
  const services = {
    tabs: {
      view: "asymmetric",
      current: {},
      matches: () => true,
      renderList(items) {
        els.tileGrid.innerHTML = items
          .map((t) => `<article data-tile-id="${t.id}"></article>`)
          .join("");
      },
    },
    watchlist: {},
  };
  const board = new boardModule.namespace.ContentBoard(services);
  state.tiles = Array.from({ length: 57 }, (_, i) => ({
    id: String(i),
    createdAt: new Date(16000 - i * 1000).toISOString(),
    type: "text",
    text: "Item",
    size: ["small", "medium", "large"][i % 3],
  }));
  board.renderTiles();
  assert.equal(
    els.tileGrid.children.filter((e) => e.className === "tile").length,
    25,
  );
  assert.equal(els.tileGrid.children[11].className, "seen-divider");
  assert.match(nav.innerHTML, /1 \/ 3/);
  state.page = 3;
  board.renderTiles();
  assert.equal(els.tileGrid.children.length, 7);
  assert.match(nav.innerHTML, /3 \/ 3/);
  state.query = "changed";
  board.renderTiles();
  assert.equal(state.page, 1);
  state.settings.resultsPerPage = 50;
  board.renderTiles();
  assert.equal(
    els.tileGrid.children.filter((e) => e.className === "tile").length,
    50,
  );
  // Mosaic rectangles stay inside the board; SEEN is an absolute boundary.
  for (const viewport of [320, 600, 1100, 1800])
    for (const n of [8, 1, 3]) {
      els.tileGrid.clientWidth = viewport;
      state.settings.gridRowLimit = n;
      board.layoutTiles();
      for (const el of els.tileGrid.children.filter(
        (e) => e.className === "tile",
      )) {
        assert(parseFloat(el.style.left) >= -1e-6);
        assert(
          parseFloat(el.style.left) + parseFloat(el.style.width) <=
            viewport + 1e-6,
        );
        assert(parseFloat(el.style.height) > 0);
      }
      const marker = els.tileGrid.children.find(
        (e) => e.className === "seen-divider",
      );
      const markerTop = parseFloat(marker.style.top),
        markerBottom = markerTop + parseFloat(marker.style.height);
      const markerIndex = els.tileGrid.children.indexOf(marker);
      assert(
        els.tileGrid.children
          .slice(0, markerIndex)
          .every(
            (e) =>
              parseFloat(e.style.top) + parseFloat(e.style.height) < markerTop,
          ),
      );
      assert(
        els.tileGrid.children
          .slice(markerIndex + 1)
          .every((e) => parseFloat(e.style.top) > markerBottom),
      );
    }
  services.tabs.view = "equal";
  board.layoutTiles();
  assert(!els.tileGrid.classList.contains("tile-grid--mosaic"));
  assert.equal(els.tileGrid.style.height, "");
  assert(
    els.tileGrid.children.every(
      (e) => e.style.position === "" && e.style.height === "",
    ),
  );
  services.tabs.view = "list";
  board.renderTiles();
  assert.equal(els.tileGrid.children[11].className, "seen-divider");
  assert.equal(els.tileGrid.style.height, "");
  services.tabs.view = "asymmetric";
  const viewerModule = await load("media-viewer.js");
  await viewerModule.evaluate();
  const viewer = new viewerModule.namespace.MediaViewer({});
  const tile = { id: "gallery", files: ["one", "two", "three"] };
  state.viewerTileId = tile.id;
  state.viewerIndex = 0;
  state.viewerZoom = 1;
  let rendered = [];
  const setup = () => {
    els.viewerMedia.children = [];
    const stage = new Element();
    stage.className = "viewer-stage";
    const img = new Element("img");
    img.className = "viewer-zoom-target";
    stage.append(img);
    els.viewerMedia.append(stage);
  };
  viewer.renderViewerSelection = () => {
    rendered.push(state.viewerIndex);
    setup();
  };
  setup();
  for (const next of [1, 2, 1, 0]) {
    const swipe = viewer.createGallerySwipe(tile);
    swipe.move(-150);
    swipe.settle(next);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(state.viewerIndex, next);
    assert.equal(rendered.at(-1), next);
  }
  const canceled = viewer.createGallerySwipe(tile);
  canceled.settle(1);
  canceled.cleanup();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(state.viewerIndex, 0);
  const unchanged = viewer.createGallerySwipe(tile);
  unchanged.settle(0);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(state.viewerIndex, 0);
  const tabsModule = await load("tabs.js");
  await tabsModule.evaluate();
  const tabs = new tabsModule.namespace.TabController({});
  tabs.definitions = [{ id: "dashboard" }];
  state.query = "";
  state.activeHistoryMonth = null;
  const archive = {
    id: "archive",
    section: "dashboard",
    historyMonth: "2026-09",
  };
  assert.equal(tabs.matches(archive), false);
  state.activeHistoryMonth = "2026-09";
  assert.equal(tabs.matches(archive), true);
  state.activeCollectionId = "saved";
  state.collections = [
    { id: "saved", section: "dashboard", items: ["archive"] },
  ];
  state.activeHistoryMonth = null;
  assert.equal(tabs.matches(archive), true);

  // Legacy collections stay public; private groups follow the selected profile.
  state.collections = [
    { id: "public", section: "dashboard" },
    {
      id: "brian",
      section: "dashboard",
      visibility: "private",
      owner: "Brian",
    },
    {
      id: "steve",
      section: "dashboard",
      visibility: "private",
      owner: "Steve",
    },
    { id: "other-tab", section: "projects" },
  ];
  for (const user of ["Brian", "Brendan", "Jasprit", "Steve", "Sydney"]) {
    state.settings.userProfile = user;
    assert.deepEqual(
      Array.from(tabs.collections, (c) => c.id),
      user === "Brian"
        ? ["brian", "public"]
        : user === "Steve"
          ? ["steve", "public"]
          : ["public"],
    );
  }
  state.settings.userProfile = "Brian";
  state.activeCollectionId = "steve";
  assert.equal(tabs.matches(archive), false);

  // Pending links share the same pagination budget and move the SEEN boundary.
  services.tabs.view = "asymmetric";
  state.settings.resultsPerPage = 25;
  state.page = 1;
  state.activeCollectionId = null;
  state.activeHistoryMonth = null;
  state.lastVisit = 5000;
  state.pendingLinks = [
    {
      id: "pending-1",
      pending: true,
      section: "dashboard",
      url: "https://example.com",
      createdAt: new Date(20000).toISOString(),
      progress: 0.4,
      message: "Reading…",
    },
  ];
  board.renderTiles();
  assert.equal(els.tileGrid.children.length, 26);
  assert.equal(els.tileGrid.children[0].dataset.pendingLink, "pending-1");
  assert.equal(els.tileGrid.children[12].className, "seen-divider");
  services.tabs.view = "list";
  services.tabs.renderList = (items) => tabs.renderList(items);
  tabs.services.board = board;
  tabs.services.watchlist = {};
  state.lastVisit = null;
  board.renderTiles();
  assert(els.tileGrid.innerHTML.includes('data-pending-link="pending-1"'));
  assert.equal(els.tileGrid.children.length, 25);
  // Caption cleanup keeps the useful prose and stored long captions intact.
  const metadata = await load("link-metadata.js");
  await metadata.evaluate();
  const { cleanInstagramText, cleanLinkInfo, cleanLinkTile } =
    metadata.namespace;
  assert.equal(
    cleanInstagramText(
      '"253 likes, 6 comments - rnrunclub on September 20, 2026: "Sunday miles with @rnrunclub #runclub #Perth""',
    ),
    "Sunday miles with",
  );
  assert.equal(
    cleanInstagramText(
      "Run Club on Instagram: “A morning with @sam.lee #ランニング #café”",
    ),
    "A morning with",
  );
  assert.equal(
    cleanInstagramText("Email hello@example.com for details."),
    "Email hello@example.com for details.",
  );
  const long = "A long caption with useful details. ".repeat(30);
  assert.equal(cleanInstagramText(long), long.trim());
  const ordinary = {
    type: "link",
    url: "https://example.com",
    label: "Keep @names and #tags",
    description: "Unchanged",
  };
  assert.equal(cleanLinkTile(ordinary), ordinary);
  const instagram = cleanLinkTile({
    ...ordinary,
    url: "https://www.instagram.com/p/test/",
    label: "Caption #run @sam",
  });
  assert.equal(instagram.label, "Caption");
  // Step buttons and migrated values use the same bounds and increments.
  const preferences = await load("preferences.js");
  await preferences.evaluate();
  const { normalizePreference } = preferences.namespace;
  assert.equal(normalizePreference("resultsPerPage", 1), 5);
  assert.equal(normalizePreference("resultsPerPage", 27), 25);
  assert.equal(normalizePreference("resultsPerPage", 100), 50);
  const appModule = await load("application.js");
  await appModule.evaluate();
  const app = new appModule.namespace.Application({
    board: { renderTiles() {} },
  });
  app.saveLocalTheme = () => {};
  state.settings.resultsPerPage = 25;
  app.changePreference("resultsPerPage", 1);
  assert.equal(state.settings.resultsPerPage, 30);
  app.changePreference("resultsPerPage", -1);
  assert.equal(state.settings.resultsPerPage, 25);
  state.settings.resultsPerPage = 5;
  app.changePreference("resultsPerPage", -1);
  assert.equal(state.settings.resultsPerPage, 5);
  state.settings.resultsPerPage = 50;
  app.changePreference("resultsPerPage", 1);
  assert.equal(state.settings.resultsPerPage, 50);
  state.settings.gridRowLimit = 1;
  app.changePreference("gridRowLimit", -1);
  assert.equal(state.settings.gridRowLimit, 1);
  app.changePreference("gridRowLimit", 1);
  assert.equal(state.settings.gridRowLimit, 2);
  state.settings.gridRowLimit = 8;
  app.changePreference("gridRowLimit", 1);
  assert.equal(state.settings.gridRowLimit, 8);
  // Import and exercise the supplied quick-add flow with deterministic network responses.
  const editorModule = await load("content-editor.js");
  await editorModule.evaluate();
  let toasts = [],
    saved = [],
    updates = [];
  const quickServices = {
    tabs: { current: { editor: "content" } },
    board: {
      renderTiles() {},
      renderTags() {},
      updatePendingTile(item) {
        updates.push(item.progress);
      },
    },
    collections: { renderBookmarks() {} },
    application: {
      toast(...args) {
        toasts.push(args);
      },
    },
  };
  const editor = new editorModule.namespace.ContentEditor(quickServices);
  editor.creepPendingLink = () => () => {};
  editor.fetchLinkThumbnailFile = async () => null;
  els.search = new Element();
  els.clearSearch = new Element();
  state.pendingLinks = [];
  state.tiles = [];
  state.section = "dashboard";
  state.urlBackgrounds = ["one.jpg", "two.jpg", "three.jpg"];
  apiMock.inspectLink = async (url) =>
    cleanLinkInfo(
      {
        title: 'Club on Instagram: "Morning run #run @sam"',
        description:
          '253 likes, 6 comments - rnrunclub on September 20, 2026: "Great morning #Perth"',
      },
      url,
    );
  apiMock.createTile = async (form) => {
    saved.push(Object.fromEntries(form));
    return { ...Object.fromEntries(form), id: "saved-" + saved.length };
  };
  await editor.quickAddLink("https://www.instagram.com/p/test/");
  assert.equal(saved[0].label, "Morning run");
  assert.equal(saved[0].description, "Great morning");
  assert(state.urlBackgrounds.includes(saved[0].urlBackground));
  assert.equal(state.pendingLinks.length, 0);
  assert.equal(state.tiles.length, 1);
  assert.equal(updates.at(-1), 1);
  assert.equal(state.page, 1);
  editor.fetchLinkThumbnailFile = async () => ({
    file: new File(["image"], "cover.jpg", { type: "image/jpeg" }),
    width: 800,
    height: 600,
  });
  await editor.quickAddLink("https://example.com");
  assert.equal(saved[1].thumbnail.name, "cover.jpg");
  // Slow requests stay visible, and changing sections cannot redirect the save.
  let release;
  apiMock.inspectLink = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const slow = editor.quickAddLink("https://example.org");
  assert.equal(state.pendingLinks.length, 1);
  state.section = "resources";
  release({ title: "Example" });
  await slow;
  assert.equal(saved.at(-1).section, "dashboard");
  assert.equal(state.pendingLinks.length, 0);
  apiMock.inspectLink = async () => {
    throw new Error("Metadata unavailable");
  };
  editor.fetchLinkThumbnailFile = async () => null;
  await editor.quickAddLink("https://fallback.example");
  assert.equal(saved.at(-1).label, "fallback.example");
  assert(state.urlBackgrounds.includes(saved.at(-1).urlBackground));
  let attempts = 0;
  apiMock.createTile = async () => {
    attempts++;
    throw new Error("Connection interrupted");
  };
  await editor.quickAddLink("https://instagram.com/p/failure/");
  assert.equal(attempts, 1);
  assert.equal(state.pendingLinks.length, 0);
  assert.equal(toasts.at(-1)[1], "error");
  let intercepted = [];
  editor.quickAddLink = (url) => intercepted.push(url);
  assert.equal(
    editor.tryQuickAddLink({ type: "link", url: "https://example.com" }),
    true,
  );
  assert.equal(
    editor.tryQuickAddLink({
      type: "link",
      url: "https://example.com/photo.jpg",
    }),
    true,
  );
  assert.equal(editor.tryQuickAddLink({ type: "text", text: "A note" }), false);
  assert.equal(
    editor.tryQuickAddLink({ type: "link", url: "javascript:alert(1)" }),
    false,
  );

  assert.equal(cleanInstagramText("#run#club @sam@alex"), "");
  // Verify normalization is wired into real API requests, including existing tiles.
  const realApiModule = await load("api.js");
  await realApiModule.evaluate();
  const realApi = realApiModule.namespace.api;
  ctx.window = { location: { href: "https://hub.example/" } };
  let sent;
  ctx.fetch = async (url, options = {}) => {
    const action = new URL(url).searchParams.get("action");
    sent = options.body ? JSON.parse(options.body) : null;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data:
          action === "bootstrap"
            ? {
                tiles: [
                  {
                    type: "link",
                    url: "https://instagram.com/p/test/",
                    label: "Caption #run @sam",
                    description:
                      '253 likes, 6 comments - rnrunclub on September 20, 2026: "Morning"',
                  },
                ],
              }
            : action === "links.inspect"
              ? {
                  title: 'Club on Instagram: "Caption #run"',
                  description: "Morning @sam",
                }
              : { ...sent, id: "saved-api" },
      }),
    };
  };
  assert.equal((await realApi.bootstrap()).tiles[0].description, "Morning");
  assert.equal(
    (await realApi.inspectLink("https://instagram.com/p/test/")).title,
    "Caption",
  );
  const form = new FormData();
  form.set("type", "link");
  form.set("url", "https://instagram.com/p/test/");
  form.set("label", "Caption #run @sam");
  form.set("description", "Great #Perth");
  await realApi.createTile(form);
  assert.equal(sent.label, "Caption");
  assert.equal(sent.description, "Great");
  console.log(
    "PASS: profile collection filtering, mosaic bounds, strict SEEN separation, view-switch cleanup, existing pagination, SEEN, grid, gallery, history, and collection checks; pending-link pagination/list view; Instagram cleanup; stepper increments/bounds; automatic metadata/thumbnail saves; fallback images; section changes during retrieval; and failed-save handling.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
