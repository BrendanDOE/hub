import { JobsTable } from "./jobs-table.js?v=20261026-jobs-v16";
import { JobsDrag } from "./jobs-drag.js?v=20261026-jobs-v16";
import { Feature } from "./feature.js?v=20261026-jobs-v16";
import { state, $, escapeHtml as esc } from "./context.js?v=20261026-jobs-v16";
import { api } from "./api.js?v=20261026-jobs-v16";
const TYPES = [
  ["Design", "Artwork, branding, and documents", "✦"],
  ["Print", "Print, finishing, and production", "▤"],
  ["Digital", "Websites, portals, and content", "⌘"],
  ["Media", "Photography, video, and audio", "▷"],
  ["General", "Other requests and tasks", "＋"],
];
const STATUSES = ["Pending", "In Progress", "On Hold", "Complete"];
const ARTWORK = [
  "Certificate",
  "Poster/Flyer",
  "Leaflet A4 (A3 folded in half)",
  "Brochure - roll fold DL (A4 folded in thirds)",
  "Brochure - z fold DL (A4 folded in thirds)",
  "Folder A4",
  "Booklet (4+ pages)",
  "Envelope DL (110mm x 220mm)",
  "Student workbook",
  "Letterhead (A4)",
  "Pull up banner standard (200cm x 80cm)",
  "Business card",
  "Book",
  "Stickers",
  "Corflute Signage",
  "Other",
];
const OVERVIEW_COLUMNS = [
  "Subject",
  "Requester",
  "Assigned to",
  "Due date",
  "Priority",
  "Status",
];
const LIST_COLUMNS = [
  "ID",
  "Subject",
  "Requester",
  "Assigned to",
  "Status",
  "Due date",
  "Created",
  "Updated",
  "Priority",
  "Job type",
  "Department",
  "Description",
  "Artwork type",
  "Copies",
  "Finished size",
  "Paper weight",
  "Colour",
  "Attachments",
];
const COLUMN_KEY = "hub.jobs.columns.v1";
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const overdue = (j) =>
  !!j.dueDate && j.dueDate < dateKey(new Date()) && j.status !== "Complete";
const prettyDate = (value) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No due date";
const DEPARTMENTS = [
  "The Arts",
  "English",
  "Health and Physical Education",
  "Humanities and Social Sciences",
  "Languages",
  "Maths",
  "Science",
  "Technologies",
  "Leadership",
  "ICT",
  "OTL",
  "RTO",
  "Student Services",
  "LRC",
];
const NON_ASSIGNEES = ["Display"]; // in Settings users, but not assignable to jobs
const OVERVIEW_ROW_LIMIT = 8; // max rows shown in the Overview table
export class Jobs extends Feature {
  constructor(services) {
    super(services);
    this.view = "overview";
    this.filter = "All Jobs";
    this.query = "";
    this.week = 0;
    this.month = 0;
    this.scheduleMode = "week";
    this.hiddenColumns = {};
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMN_KEY));
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        this.hiddenColumns = saved;
    } catch {}
  }
  bindEvents() {
    this.root = document.createElement("section");
    this.root.id = "jobsWorkspace";
    this.root.hidden = true;
    $(".workspace").after(this.root);
    this.dialog = document.createElement("dialog");
    this.dialog.className = "modal job-modal";
    this.dialog.id = "jobModal";
    this.dialog.setAttribute("aria-labelledby", "jobTitle");
    document.body.append(this.dialog);
    this.deleteDialog = document.createElement("dialog");
    this.deleteDialog.className = "modal";
    this.deleteDialog.innerHTML = `<div class="modal-card modal-card--confirm"><div class="modal-head"><div><div class="eyebrow">Jobs</div><h2 id="jobDeleteTitle">Delete job?</h2></div><button class="icon-btn modal-close capsule-x viewer-close" type="button" data-cancel-job-delete aria-label="Close"></button></div><p class="confirm-copy">This job will be hidden from the jobs dashboard, but its information and attachments will be retained.</p><div class="modal-actions"><button class="btn btn--ghost" type="button" data-cancel-job-delete>Cancel</button><button class="btn btn--danger" type="button" data-confirm-job-delete>Delete job</button></div></div>`;
    this.deleteDialog.setAttribute("aria-labelledby", "jobDeleteTitle");
    document.body.append(this.deleteDialog);
    this.deleteDialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-cancel-job-delete]") && !this.busy) this.deleteDialog.close();
      if (event.target.closest("[data-confirm-job-delete]")) this.hideJob();
    });
    this.deleteDialog.addEventListener("cancel", (event) => { if (this.busy) event.preventDefault(); });
    document.addEventListener("hub:tab-change", this.render);
    this.root.addEventListener("click", (e) => {
      if (this.dragging) return;
      const row = e.target.closest("[data-job-row]");
      if (row && !e.target.closest("button,a,input,select,textarea")) {
        this.open(this.items.find((j) => j.id === row.dataset.jobRow));
        return;
      }
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.create) this.open(null, b.dataset.create);
      if (b.dataset.edit)
        this.open(this.items.find((j) => j.id === b.dataset.edit));
      if (b.dataset.view) {
        this.closeColumns();
        this.view = b.dataset.view;
        this.render();
      }
      if (b.dataset.filter) {
        this.filter = b.dataset.filter;
        this.render();
      }
      if (b.dataset.week) {
        if (this.view === "schedule" && this.scheduleMode === "month")
          this.month += Number(b.dataset.week);
        else this.week += Number(b.dataset.week);
        this.render();
      }
      if (b.dataset.scheduleMode) {
        this.scheduleMode = b.dataset.scheduleMode;
        this.render();
      }
      if (b.hasAttribute("data-columns"))
        this.openColumns(
          b.getBoundingClientRect().left,
          b.getBoundingClientRect().bottom,
          b,
        );
      if (b.hasAttribute("data-today")) {
        this.week = 0;
        this.month = 0;
        this.render();
      }
    });
    this.root.addEventListener("input", (e) => {
      if (e.target.id === "jobsSearch") {
        this.query = e.target.value;
        this.renderContent();
      }
    });
    this.listTable = new JobsTable(this.root, {
      render: () => this.renderContent(),
      onActive: (active) => {
        this.resizing = active;
      },
      onStorageError: () =>
        this.services.application.toast(
          "Table preferences will last for this session.",
        ),
    });
    this.cardDrag = new JobsDrag(this.root, {
      items: () => this.items,
      canStart: () => !this.busy && !this.dialog.open,
      onActive: (id) => {
        this.dragging = id;
      },
      onDrop: (job, status) => this.changeStatus(job, status),
    });
    this.root.addEventListener("keydown", (e) => {
      if (
        e.target.matches("[data-job-row]") &&
        ["Enter", " "].includes(e.key)
      ) {
        e.preventDefault();
        this.open(this.items.find((j) => j.id === e.target.dataset.jobRow));
      }
    });
    this.menu = document.createElement("div");
    this.menu.className = "jobs-column-menu";
    this.menu.hidden = true;
    this.menu.setAttribute("role", "dialog");
    this.menu.setAttribute("aria-label", "Visible job columns");
    document.body.append(this.menu);
    this.menu.addEventListener("change", (e) => {
      const input = e.target.closest("[data-column]");
      if (!input) return;
      const view = this.view;
      const hidden = new Set(
        Array.isArray(this.hiddenColumns[view]) ? this.hiddenColumns[view] : [],
      );
      if (input.checked) hidden.delete(input.dataset.column);
      else hidden.add(input.dataset.column);
      this.hiddenColumns[view] = [...hidden];
      try {
        localStorage.setItem(COLUMN_KEY, JSON.stringify(this.hiddenColumns));
      } catch {
        this.services.application.toast(
          "Column choices will last for this session.",
        );
      }
      this.renderContent();
      this.updateColumnChecks();
    });
    this.menu.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !this.menu.contains(e.relatedTarget))
        this.closeColumns();
    });
    this.root.addEventListener("contextmenu", (e) => {
      const header = e.target.closest(".jobs-table th");
      if (!header) return;
      e.preventDefault();
      this.openColumns(e.clientX, e.clientY, header);
    });
    this.root.addEventListener("keydown", (e) => {
      const header = e.target.closest(".jobs-table th");
      if (
        header &&
        (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))
      ) {
        e.preventDefault();
        const r = header.getBoundingClientRect();
        this.openColumns(r.left, r.bottom, header);
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (
        !this.menu.hidden &&
        !this.menu.contains(e.target) &&
        !e.target.closest("[data-columns]")
      )
        this.closeColumns();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.menu.hidden) {
        e.preventDefault();
        this.closeColumns(true);
      }
    });
    window.addEventListener("resize", () => this.closeColumns());
    document.addEventListener(
      "scroll",
      (e) => {
        if (!this.menu.contains(e.target)) this.closeColumns();
      },
      true,
    );
    this.dialog.addEventListener("click", (e) => {
      if (e.target.closest("[data-job-close]") && !this.busy)
        this.dialog.close();
      if (e.target.closest("[data-delete-job]") && !this.busy && this.editing) this.deleteDialog.showModal();
      const copy = e.target.closest("[data-copy-project-path]");
      if (copy) this.copyProjectPath(copy);
      if (e.target.closest("[data-add-asset]")) this.addAsset();
      const remove = e.target.closest("[data-remove-asset]");
      if (remove) {
        remove.closest(".project-asset-row").remove();
        this.syncAssetRows();
      }
    });
    this.dialog.addEventListener("cancel", (e) => {
      if (this.busy) e.preventDefault();
    });
    this.dialog.addEventListener("submit", this.save);
    this.dialog.addEventListener("change", (e) => {
      if (e.target.name === "jobType") this.togglePrint();
    });
    this.render();
  }
  get items() {
    return (state.jobs || []).filter((job) => !job.hidden);
  }
  matches(j, filter = this.filter) {
    return (
      filter === "All Jobs" ||
      (filter === "Overdue" ? overdue(j) : j.status === filter)
    );
  }
  get filtered() {
    return this.items
      .filter(
        (j) =>
          (this.view !== "overview" || this.matches(j)) &&
          Object.values(j)
            .filter((x) => typeof x === "string")
            .join(" ")
            .toLowerCase()
            .includes(this.query.toLowerCase()),
      )
      .sort(
        (a, b) =>
          (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
          b.number - a.number,
      );
  }
  render() {
    if (!this.root) return;
    this.cardDrag?.cancel();
    this.listTable?.cancel();
    const active = state.section === "jobs";
    this.root.hidden = !active;
    $(".workspace").hidden = active;
    if (!active) return;
    this.root.classList.remove("jobs-quiet");
    this.contentHtml = this.weeklyHtml = null;
    this.root.innerHTML = `<section class="jobs-panel"><div class="job-types">${TYPES.map(([type, copy, icon]) => `<button type="button" data-create="${type}"><span class="job-type-icon" aria-hidden="true">${icon}</span><span><strong>${type}</strong><small>${copy}</small></span><span aria-hidden="true">↗</span></button>`).join("")}</div></section><section class="jobs-panel"><div class="jobs-toolbar"><label for="jobsSearch">Search jobs</label><input type="search" id="jobsSearch" placeholder="Subject, requester, assignee…" value="${esc(this.query)}"><div class="jobs-views" role="group" aria-label="Job views">${["overview", "list", "status", "schedule"].map((v) => `<button data-view="${v}" aria-pressed="${this.view === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div><div class="jobs-body ${this.view === "overview" ? "" : "jobs-body--full"}"><aside class="jobs-filters" aria-label="Filter jobs" ${this.view === "overview" ? "" : "hidden"}>${["All Jobs", "In Progress", "On Hold", "Overdue"].map((f, i) => `<button data-filter="${f}" aria-pressed="${this.filter === f}"><span aria-hidden="true">${["▤", "◷", "Ⅱ", "!"][i]}</span><strong>${f}</strong><span>${this.items.filter((j) => this.matches(j, f)).length}</span></button>`).join("")}</aside><div id="jobsContent"></div></div></section><div id="jobsWeekly"></div>`;
    this.renderContent();
  }
  // Update in place after data changes (drag/drop, save) so the board never
  // rebuilds the panels, replays enter animations, or resets its scroll.
  refresh() {
    if (!this.root || state.section !== "jobs" || !$("#jobsContent"))
      return this.render();
    this.root.classList.add("jobs-quiet");
    const count = this.root.querySelector(".jobs-count");
    if (count) count.textContent = this.items.length;
    this.root.querySelectorAll("[data-filter]").forEach((button) => {
      button.lastElementChild.textContent = this.items.filter((j) =>
        this.matches(j, button.dataset.filter),
      ).length;
    });
    this.renderContent(true);
  }
  renderContent(skipUnchanged = false) {
    this.cardDrag?.cancel();
    this.listTable?.cancel();
    const rows = this.filtered;
    const content =
      this.view === "status"
        ? this.board(rows)
        : this.view === "schedule"
          ? this.schedule(rows)
          : this.table(rows, this.view === "list");
    const weekly =
      this.view === "overview"
        ? `<section class="jobs-panel">${this.schedule(rows)}</section>`
        : "";
    if (
      skipUnchanged &&
      content === this.contentHtml &&
      weekly === this.weeklyHtml
    )
      return;
    this.contentHtml = content;
    this.weeklyHtml = weekly;
    const scrollLeft = this.root.querySelector(".jobs-board")?.scrollLeft || 0;
    $("#jobsContent").innerHTML = content;
    $("#jobsWeekly").innerHTML = weekly;
    const board = this.root.querySelector(".jobs-board");
    if (board && scrollLeft) board.scrollLeft = scrollLeft;
  }
  editButton(j, label) {
    return `<button class="job-subject" data-edit="${esc(j.id)}">${esc(label || j.subject)}</button>`;
  }
  visibleColumns(view = this.view) {
    const fields = view === "list" ? LIST_COLUMNS : OVERVIEW_COLUMNS;
    const hidden = Array.isArray(this.hiddenColumns[view])
      ? this.hiddenColumns[view]
      : [];
    const visible = fields.filter((f) => !hidden.includes(f));
    return visible.length ? visible : [fields[0]];
  }
  openColumns(x, y, opener) {
    this.columnOpener = opener;
    const fields = this.view === "list" ? LIST_COLUMNS : OVERVIEW_COLUMNS;
    this.menu.innerHTML = `<strong>Visible columns</strong><small>Saved for this view</small>${fields.map((f) => `<label><input type="checkbox" data-column="${f}"><span>${f}</span></label>`).join("")}`;
    this.updateColumnChecks();
    this.menu.hidden = false;
    const rect = this.menu.getBoundingClientRect();
    this.menu.style.left =
      Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + "px";
    this.menu.style.top =
      Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + "px";
    this.menu.querySelector("input:not(:disabled)")?.focus();
  }
  updateColumnChecks() {
    const visible = this.visibleColumns();
    this.menu.querySelectorAll("[data-column]").forEach((input) => {
      input.checked = visible.includes(input.dataset.column);
      input.disabled = input.checked && visible.length === 1;
    });
  }
  closeColumns(restoreFocus = false) {
    if (!this.menu) return;
    this.menu.hidden = true;
    if (restoreFocus) {
      const target = this.columnOpener?.isConnected
        ? this.columnOpener
        : this.root.querySelector("[data-columns]");
      target?.focus();
    }
  }
  table(rows, full) {
    const fields = full ? LIST_COLUMNS : OVERVIEW_COLUMNS;
    const visible = this.visibleColumns(full ? "list" : "overview");
    if (full && this.listTable) rows = this.listTable.sorted(rows);
    if (!full) rows = rows.slice(0, OVERVIEW_ROW_LIMIT);
    const width = (column) => this.listTable?.width(column) || 160;
    const sort = this.listTable?.sort || {};
    return `<div class="jobs-table-wrap"><table class="jobs-table ${full ? "jobs-table--list" : ""}" ${full ? `style="width:${visible.reduce((sum, f) => sum + width(f), 0)}px"` : ""}>${full ? `<colgroup>${visible.map((f) => `<col data-column-width="${f}" style="width:${width(f)}px">`).join("")}</colgroup>` : ""}<thead><tr>${visible.map((f) => `<th scope="col" tabindex="0" ${full ? `data-sort-column="${f}" aria-sort="${sort.column === f ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}"` : ""} title="${full ? "Click to sort. " : ""}Right-click to choose columns"><span class="job-column-label">${f}${full ? `<span class="job-sort-indicator" aria-hidden="true">${sort.column === f ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>` : ""}</span>${full ? `<span class="job-column-resizer" data-resize-column="${f}" role="separator" aria-orientation="vertical" aria-label="Resize ${f} column" aria-valuemin="80" aria-valuemax="800" aria-valuenow="${width(f)}" tabindex="0"></span>` : ""}</th>`).join("")}</tr></thead><tbody>${
      rows
        .map((j) => {
          const due = `<span class="${overdue(j) ? "job-overdue" : ""}"${overdue(j) ? ' title="Overdue"' : ""}>${overdue(j) ? '<i class="job-overdue-icon" aria-hidden="true">!</i>' : ""}${esc(prettyDate(j.dueDate))}</span>`;
          const pill = `<span class="job-pill" data-priority="${esc(j.priority)}">${esc(j.priority)}</span>`;
          const cells = full
            ? [
                `JOB-${j.number}`,
                this.editButton(j),
                esc(j.requester),
                esc(j.assignedTo || "Unassigned"),
                esc(j.status),
                due,
                esc(j.createdAt.slice(0, 10)),
                esc(j.updatedAt.slice(0, 10)),
                pill,
                esc(j.jobType),
                esc(j.department),
                esc(j.description),
                esc(j.artworkType),
                esc(j.copies),
                esc(j.finishedSize),
                esc(j.paperWeight),
                esc(j.colour),
                this.attachments(j),
              ]
            : [
                this.editButton(j),
                esc(j.requester),
                esc(j.assignedTo || "Unassigned"),
                due,
                pill,
                esc(j.status),
              ];
          return `<tr data-job-row="${esc(j.id)}" tabindex="0" aria-label="Edit job: ${esc(j.subject)}">${cells
            .filter((c, i) => visible.includes(fields[i]))
            .map(
              (c) => `<td><div class="job-cell-content">${c || "—"}</div></td>`,
            )
            .join("")}</tr>`;
        })
        .join("") ||
      `<tr><td colspan="${visible.length}"><div class="jobs-empty"><strong>No jobs to show</strong><p>${this.items.length ? "Try another filter or search." : "Choose a job type above to create your first job."}</p></div></td></tr>`
    }</tbody></table></div>`;
  }
  board(rows) {
    return `<div class="jobs-board">${STATUSES.map(
      (status) => {
        const jobs = rows.filter((j) => j.status === status);
        return `<section class="job-lane" data-status="${status}"><h3>${status}<span>${jobs.length}</span></h3><div class="job-lane-cards">${jobs.map((j) => `<article class="job-card" draggable="false" data-job="${esc(j.id)}"><div class="job-card-meta"><span>JOB-${j.number} · ${esc(j.jobType)}</span><span class="job-pill" data-priority="${esc(j.priority)}">${esc(j.priority)}</span></div><h4>${esc(j.subject)}</h4><p>${esc(j.assignedTo || "Unassigned")}</p><div class="job-card-footer"><span class="${overdue(j) ? "job-overdue" : ""}">${esc(prettyDate(j.dueDate))}</span>${this.editButton(j, "Edit")}</div></article>`).join("") || '<div class="job-lane-empty">No jobs here</div>'}</div></section>`;
      },
    ).join("")}</div>`;
  }
  schedule(rows) {
    const monthly = this.view === "schedule" && this.scheduleMode === "month";
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    let days, label, activeMonth;
    if (monthly) {
      start.setDate(1);
      start.setMonth(start.getMonth() + this.month);
      activeMonth = start.getMonth();
      label = start.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const count = new Date(start.getFullYear(), activeMonth + 1, 0).getDate();
      const leading = (start.getDay() + 6) % 7; // Monday-first month grid.
      const cells = Math.ceil((leading + count) / 7) * 7;
      start.setDate(start.getDate() - leading);
      days = Array.from({ length: cells }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });
    } else {
      start.setDate(start.getDate() + this.week * 7);
      days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });
      label =
        prettyDate(dateKey(days[0])) + " – " + prettyDate(dateKey(days[6]));
    }
    return `<header class="jobs-heading"><h2>${monthly ? "Monthly" : "Weekly"} schedule</h2><div class="jobs-schedule-controls">${this.view === "schedule" ? `<div class="jobs-views" role="group" aria-label="Schedule display"><button data-schedule-mode="week" aria-pressed="${!monthly}">Weekly</button><button data-schedule-mode="month" aria-pressed="${monthly}">Monthly</button></div>` : ""}<div class="jobs-week-controls"><button data-week="-1" aria-label="Previous ${monthly ? "month" : "week"}">←</button><button data-today>Today</button><button data-week="1" aria-label="Next ${monthly ? "month" : "week"}">→</button></div></div></header><p class="jobs-muted jobs-hint">${label}</p><div class="jobs-calendar-scroll"><div class="jobs-week ${monthly ? "jobs-month" : ""}">${monthly ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="job-weekday">${d}</div>`).join("") : ""}${days
      .map(
        (d) =>
          `<section class="job-day ${dateKey(d) === dateKey(new Date()) ? "is-today" : ""} ${monthly && d.getMonth() !== activeMonth ? "is-outside-month" : ""}"><h3>${monthly ? "" : d.toLocaleDateString(undefined, { weekday: "short" })}<strong>${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</strong></h3>${
            rows
              .filter((j) => j.dueDate === dateKey(d))
              .map(
                (j) =>
                  `<div class="job-scheduled">${this.editButton(j)}<small>${esc(j.status)} · ${esc(j.assignedTo || "Unassigned")}</small></div>`,
              )
              .join("") || '<span class="job-day-empty">No jobs due</span>'
          }</section>`,
      )
      .join("")}</div></div>${
      rows.some((j) => !j.dueDate)
        ? `<div class="jobs-unscheduled"><strong>Unscheduled</strong> ${rows
            .filter((j) => !j.dueDate)
            .map((j) => this.editButton(j))
            .join("")}</div>`
        : ""
    }`;
  }
  attachments(j) {
    return (j.attachments || [])
      .map(
        (f, i) =>
          `<a href="api.php?action=jobs.attachment&amp;id=${encodeURIComponent(j.id)}&amp;index=${i}">${esc(f.name)}</a>`,
      )
      .join(" · ");
  }
  open(job, type = "General") {
    if (this.busy) return;
    this.editing = job;
    const j = job || {
      jobType: type,
      requester: state.settings.userProfile,
      priority: "Medium",
      status: "Pending",
      finishedSize: "A4 (210 × 297 mm)",
      paperWeight: "N/A",
      colour: "Full colour",
    };
    const field = (
      name,
      label,
      options = null,
      inputType = "text",
      required = false,
    ) =>
      `<label class="field ${name === "description" ? "job-wide" : ""}"><span>${label}${required ? " *" : ""}</span>${options ? `<select name="${name}">${options.map((v) => `<option ${j[name] === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : name === "description" ? `<textarea name="description" maxlength="10000" rows="5">${esc(j[name] || "")}</textarea>` : `<input name="${name}" type="${inputType}" value="${esc(j[name] || "")}" ${required ? "required" : ""} ${inputType === "number" ? 'min="1" max="1000000"' : 'maxlength="1000"'}>`}</label>`;
    this.dialog.innerHTML = `<form id="jobForm"><header class="jobs-heading"><div><span class="jobs-eyebrow">${job ? "JOB-" + job.number : "NEW REQUEST"}</span><h2 id="jobTitle">${job ? "Edit job" : "Create a new job"}</h2></div><button type="button" class="capsule-x viewer-close job-modal-close" data-job-close aria-label="Close job form"></button></header><div class="job-form-body"><div class="job-form-grid"><section class="job-form-section"><h3>Job details</h3>${field("requester", "Requester", null, "text", true)}${field(
      "jobType",
      "Job type",
      TYPES.map((t) => t[0]),
    )}${field("department", "Department", this.departmentOptions(j.department))}${field("subject", "Subject", null, "text", true)}${field("description", "Description")}<div class="job-form-pair">${field("dueDate", "Due date", null, "date")}${field("priority", "Priority", ["Low", "Medium", "High", "Urgent"])}</div></section><section class="job-form-section"><h3>Assignment & production</h3>${field("assignedTo", "Assigned to", this.userOptions(j.assignedTo))}${field("status", "Status", STATUSES)}<div id="jobProduction">${field("artworkType", "Artwork type", ["", ...ARTWORK])}<div class="job-form-pair">${field("copies", "Number of copies", null, "number")}${field("finishedSize", "Finished size", ["A4 (210 × 297 mm)", "A3 (297 × 420 mm)", "A5 (148 × 210 mm)", "DL (110 × 220 mm)", "Custom"])}</div>${field("paperWeight", "Paper weight", ["N/A", "80 gsm", "100 gsm", "150 gsm", "200 gsm", "250 gsm", "300 gsm", "350 gsm", "Other"])}${field("colour", "Colour", ["Full colour", "Black and white", "Spot colour"])}</div></section></div><section class="job-project-assets"><h3>Project Assets</h3><div class="project-assets-list" id="projectAssets">${this.assetsFor(j).map((a) => this.assetRow(a)).join("")}<button type="button" class="project-asset-add" data-add-asset>Add Additional Folder</button></div></section><section class="job-attachments"><h3>Attachments</h3><div>${job ? this.attachments(job) : ""}</div><label class="field"><span>Add files (up to 20 MB each)</span><input type="file" name="attachments[]" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx,.pptx,.zip"></label><small>PDF, images, Office documents, text, CSV, and ZIP files.</small></section><p id="jobError" role="alert"></p></div><footer class="job-form-footer">${job ? `<button type="button" class="btn btn--danger job-delete" data-delete-job>Delete</button>` : ""}<button type="button" class="btn btn--ghost" data-job-close>Cancel</button><button type="submit" class="job-save">${job ? "Save changes" : "Create job"}</button></footer></form>`;
    this.togglePrint();
    this.syncAssetRows();
    this.dialog.showModal();
  }
  // Users come from the Settings "User" dropdown, so there is one source of truth.
  userOptions(current = "") {
    const users = [...document.querySelectorAll("#userProfile option")]
      .map((o) => o.value || o.textContent.trim())
      .filter((name) => name && !NON_ASSIGNEES.includes(name));
    if (current && !users.includes(current)) users.push(current); // keep legacy values
    return ["", ...users];
  }
  departmentOptions(current = "") {
    // Keep a legacy free-text value selectable so editing an old job doesn't wipe it.
    return ["", ...DEPARTMENTS, ...(current && !DEPARTMENTS.includes(current) ? [current] : [])];
  }
  // Project assets: any number of labelled folder paths per job.
  assetsFor(job) {
    const list = Array.isArray(job.projectAssets)
      ? job.projectAssets
      : job.projectLocation
        ? [{ label: "", path: job.projectLocation }]
        : [];
    return list.length ? list : [{ label: "", path: "" }];
  }
  assetRow(a = {}) {
    return `<div class="project-asset-row"><input type="text" class="project-asset-label" maxlength="200" placeholder="Label" aria-label="Folder label" value="${esc(a.label || "")}"><input type="text" class="project-asset-path" maxlength="1000" placeholder="Folder path for this project" aria-label="Folder path" value="${esc(a.path || "")}"><div class="project-asset-actions"><button type="button" data-copy-project-path>Copy Project Path</button><button type="button" class="project-asset-remove" data-remove-asset aria-label="Remove folder">×</button></div></div>`;
  }
  collectAssets() {
    return [...this.dialog.querySelectorAll(".project-asset-row")]
      .map((row) => ({
        label: row.querySelector(".project-asset-label").value.trim(),
        path: row.querySelector(".project-asset-path").value.trim(),
      }))
      .filter((a) => a.label || a.path);
  }
  syncAssetRows() {
    const list = this.dialog.querySelector("#projectAssets");
    list?.classList.toggle(
      "has-multiple",
      list.querySelectorAll(".project-asset-row").length > 1,
    );
  }
  addAsset() {
    const list = this.dialog.querySelector("#projectAssets");
    list
      .querySelector("[data-add-asset]")
      .insertAdjacentHTML("beforebegin", this.assetRow());
    this.syncAssetRows();
    list.querySelector(".project-asset-row:last-of-type .project-asset-label")?.focus();
  }
  async copyProjectPath(button) {
    const input = button.closest(".project-asset-row").querySelector(".project-asset-path");
    const text = input.value;
    if (!text) {
      input.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts / denied clipboard permission.
      input.select();
      if (!document.execCommand?.("copy")) {
        this.services.application.toast("Couldn't copy the path", "error");
        return;
      }
    }
    this.showCopied(button.parentElement);
  }
  showCopied(anchor) {
    anchor.querySelector(".path-copied-popup")?.remove();
    const pop = document.createElement("span");
    pop.className = "path-copied-popup";
    pop.setAttribute("role", "status");
    pop.textContent = "Path Copied";
    anchor.append(pop);
    setTimeout(() => pop.classList.add("is-leaving"), 1100);
    setTimeout(() => pop.remove(), 1400);
  }
  togglePrint() {
    const show = ["Design", "Print"].includes(
      this.dialog.querySelector("[name=jobType]").value,
    );
    $("#jobProduction").hidden = !show;
  }
  async save(e) {
    e.preventDefault();
    if (this.busy) return;
    const form = e.target;
    const data = new FormData(form);
    data.set("projectAssets", JSON.stringify(this.collectAssets()));
    if (this.editing) {
      data.set("id", this.editing.id);
      data.set("revision", this.editing.revision);
    }
    this.busy = true;
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    submit.textContent = "Saving…";
    $("#jobError").textContent = "";
    try {
      const job = await api.saveJob(data);
      this.replace(job);
      this.dialog.close();
      this.services.application.toast("Job saved");
    } catch (error) {
      $("#jobError").textContent = error.message;
    } finally {
      this.busy = false;
      submit.disabled = false;
      submit.textContent = this.editing ? "Save changes" : "Create job";
    }
  }
  async hideJob() {
    if (this.busy || !this.editing) return;
    this.busy = true;
    const confirmButton = this.deleteDialog.querySelector("[data-confirm-job-delete]");
    confirmButton.disabled = true;
    try {
      const hidden = await api.hideJob(this.editing);
      state.jobs = (state.jobs || []).map((job) => job.id === hidden.id ? hidden : job);
      this.deleteDialog.close();
      this.dialog.close();
      this.editing = null;
      this.render();
      this.services.application.toast("Job deleted");
    } catch (error) {
      this.services.application.toast(error.message || "Could not delete job", "error");
    } finally {
      this.busy = false;
      confirmButton.disabled = false;
    }
  }
  replace(job, quiet = false) {
    state.jobs = (state.jobs || []).filter((j) => j.id !== job.id).concat(job);
    quiet ? this.refresh() : this.render();
  }
  async changeStatus(job, status) {
    if (this.busy || job.status === status) {
      this.refresh();
      return;
    }
    this.busy = true;
    const previous = this.items;
    state.jobs = previous.map((item) =>
      item.id === job.id ? { ...item, status } : item,
    );
    this.refresh();
    try {
      this.replace(await api.setJobStatus(job, status), true);
      this.services.application.toast(`Job moved to ${status}`);
    } catch (error) {
      state.jobs = previous;
      this.services.application.toast(error.message, "error");
      this.refresh();
    } finally {
      this.busy = false;
    }
  }
}
