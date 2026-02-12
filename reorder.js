(() => {
  "use strict";

  const MODE_KEY = "gmailReorder.mode";
  const MODES = {
    DEFAULT: "default",
    SUBJECT: "subject",
    STAR: "star"
  };
  const ALLOWED_MODES = new Set(Object.values(MODES));

  const STAR_PRIORITY = {
    none: 1,
    purple: 2,
    red: 3,
    yellow: 4
  };

  const PRIORITY_LABELS = new Set(["sr founder", "sr grant founder"]);

  const REORDER_DEBOUNCE_MS = 250;
  const STAR_COOLDOWN_MS = 1000;
  const ACTION_COOLDOWN_MS = 1200;
  const FALLBACK_INTERVAL_MS = 15000;

  const ROW_SELECTOR = "tr.zA, div.zA";
  const STAR_BUTTON_SELECTOR = "span[role='button'][aria-label]";

  let currentMode = loadMode();
  let lastStarInteractionAt = 0;
  let pauseUntil = 0;
  let reorderTimer = null;
  let uiObserver = null;

  function loadMode() {
    try {
      const stored = localStorage.getItem(MODE_KEY);
      if (stored && ALLOWED_MODES.has(stored)) {
        return stored;
      }
    } catch (error) {
      // Ignore storage failures and continue with default.
    }
    return MODES.STAR;
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function isInboxPage() {
    return window.location.hash.includes("#inbox");
  }

  function getEmailRows() {
    return Array.from(document.querySelectorAll(ROW_SELECTOR));
  }

  function findStarButton(root) {
    const candidates = root.querySelectorAll(STAR_BUTTON_SELECTOR);
    for (const candidate of candidates) {
      const label = (candidate.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("star")) {
        return candidate;
      }
    }
    return null;
  }

  function getStarColor(emailRow) {
    if (emailRow.classList.contains("zE")) {
      return "none";
    }

    const starButton = findStarButton(emailRow);
    if (!starButton) {
      return "none";
    }

    const label = (starButton.getAttribute("aria-label") || "").toLowerCase();

    if (label.includes("red-star")) {
      return "red";
    }
    if (label.includes("purple-star")) {
      return "purple";
    }
    if (label.includes("not starred")) {
      return "none";
    }
    if (label.includes("starred") || label.includes("yellow-star")) {
      return "yellow";
    }

    return "none";
  }

  function getEmailTimestamp(emailRow) {
    const timeElement = emailRow.querySelector("span.xW.xY, span.xT > span");
    if (!timeElement) {
      return 0;
    }

    const dateText =
      timeElement.getAttribute("title") ||
      timeElement.getAttribute("data-tooltip") ||
      "";

    if (!dateText) {
      return 0;
    }

    const parsedDate = new Date(dateText);
    const timestamp = parsedDate.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function getSubjectText(emailRow) {
    const subjectElement = emailRow.querySelector("span.bog, span.y2");
    if (!subjectElement) {
      return "";
    }
    return subjectElement.textContent.trim().toLowerCase();
  }

  function hasPinnedLabel(emailRow) {
    const labelSelectors = [
      "span.at",
      "span.av",
      "span[title]",
      "div[title]",
      "span[data-tooltip]",
      "div[data-tooltip]",
      "span[aria-label]",
      "div[aria-label]"
    ];

    const seen = new Set();
    for (const selector of labelSelectors) {
      const elements = emailRow.querySelectorAll(selector);
      for (const element of elements) {
        const values = [
          element.textContent || "",
          element.getAttribute("title") || "",
          element.getAttribute("data-tooltip") || "",
          element.getAttribute("aria-label") || ""
        ];

        for (const value of values) {
          const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
          if (!normalized || seen.has(normalized)) {
            continue;
          }
          seen.add(normalized);
          if (PRIORITY_LABELS.has(normalized)) {
            return true;
          }
        }
      }
    }

    // Fallback for Gmail markup variations where label chips are rendered differently.
    const rowText = (emailRow.textContent || "").toLowerCase();
    return (
      rowText.includes("sr founder") ||
      rowText.includes("sr grant founder")
    );
  }

  function applyLayoutStyles(parent) {
    parent.style.setProperty("display", "flex", "important");
    parent.style.setProperty("flex-direction", "column", "important");
    parent.setAttribute("data-gmail-reorder-managed-parent", "1");

    const grandparent = parent.parentElement;
    if (grandparent && grandparent.tagName.toLowerCase() === "table") {
      grandparent.style.setProperty("display", "flex", "important");
      grandparent.style.setProperty("flex-direction", "column", "important");
      grandparent.setAttribute("data-gmail-reorder-managed-grandparent", "1");
    }
  }

  function applyRowStyles(row, orderIndex) {
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("flex-direction", "row", "important");
    row.style.setProperty("align-items", "center", "important");
    row.style.setProperty("margin", "0", "important");
    row.style.setProperty("padding", "7px 0", "important");
    row.style.setProperty("line-height", "1.6", "important");
    row.style.setProperty("height", "auto", "important");
    row.style.setProperty("order", String(orderIndex), "important");
    row.setAttribute("data-gmail-reorder-managed-row", "1");
  }

  function clearManagedStyles() {
    const managedRows = document.querySelectorAll("[data-gmail-reorder-managed-row='1']");
    for (const row of managedRows) {
      row.style.removeProperty("display");
      row.style.removeProperty("flex-direction");
      row.style.removeProperty("align-items");
      row.style.removeProperty("margin");
      row.style.removeProperty("padding");
      row.style.removeProperty("line-height");
      row.style.removeProperty("height");
      row.style.removeProperty("order");
      row.removeAttribute("data-gmail-reorder-managed-row");
    }

    const managedParents = document.querySelectorAll("[data-gmail-reorder-managed-parent='1']");
    for (const parent of managedParents) {
      parent.style.removeProperty("display");
      parent.style.removeProperty("flex-direction");
      parent.removeAttribute("data-gmail-reorder-managed-parent");
    }

    const managedGrandparents = document.querySelectorAll(
      "[data-gmail-reorder-managed-grandparent='1']"
    );
    for (const grandparent of managedGrandparents) {
      grandparent.style.removeProperty("display");
      grandparent.style.removeProperty("flex-direction");
      grandparent.removeAttribute("data-gmail-reorder-managed-grandparent");
    }
  }

  function compareBySubject(a, b) {
    const subjectA = getSubjectText(a);
    const subjectB = getSubjectText(b);

    if (subjectA !== subjectB) {
      return subjectA.localeCompare(subjectB);
    }

    return getEmailTimestamp(b) - getEmailTimestamp(a);
  }

  function compareByStar(a, b) {
    const pinnedA = hasPinnedLabel(a);
    const pinnedB = hasPinnedLabel(b);
    if (pinnedA !== pinnedB) {
      return pinnedA ? -1 : 1;
    }

    const colorA = getStarColor(a);
    const colorB = getStarColor(b);

    const priorityA = STAR_PRIORITY[colorA] || 9999;
    const priorityB = STAR_PRIORITY[colorB] || 9999;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return getEmailTimestamp(b) - getEmailTimestamp(a);
  }

  function isHoveringEmailRow() {
    return Boolean(document.querySelector("tr.zA:hover, div.zA:hover"));
  }

  function canReorderNow() {
    if (!isInboxPage()) {
      return false;
    }

    if (currentMode === MODES.DEFAULT) {
      return false;
    }

    const now = Date.now();

    if (now - lastStarInteractionAt < STAR_COOLDOWN_MS) {
      return false;
    }

    if (now < pauseUntil) {
      return false;
    }

    if (isHoveringEmailRow()) {
      return false;
    }

    return true;
  }

  function reorderEmails() {
    if (!canReorderNow()) {
      if (currentMode === MODES.DEFAULT || !isInboxPage()) {
        clearManagedStyles();
      } else {
        scheduleReorder(300);
      }
      return;
    }

    const rows = getEmailRows();
    if (rows.length === 0) {
      return;
    }

    const sortedRows = rows.slice();

    if (currentMode === MODES.SUBJECT) {
      sortedRows.sort(compareBySubject);
    } else if (currentMode === MODES.STAR) {
      sortedRows.sort(compareByStar);
    }

    const parent = rows[0].parentElement;
    if (!parent) {
      return;
    }

    applyLayoutStyles(parent);

    sortedRows.forEach((row, index) => {
      applyRowStyles(row, index);
    });
  }

  function scheduleReorder(delayMs = REORDER_DEBOUNCE_MS) {
    if (reorderTimer) {
      clearTimeout(reorderTimer);
    }

    reorderTimer = window.setTimeout(() => {
      reorderTimer = null;
      reorderEmails();
    }, delayMs);
  }

  function setMode(mode) {
    if (!ALLOWED_MODES.has(mode)) {
      return;
    }

    currentMode = mode;
    saveMode(mode);

    const select = document.getElementById("gmail-reorder-select");
    if (select && select.value !== mode) {
      select.value = mode;
    }

    if (mode === MODES.DEFAULT) {
      clearManagedStyles();
    }

    scheduleReorder();
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findGmailLogo() {
    const selectors = [
      "a[title='Gmail']",
      "a[aria-label='Gmail']",
      "a[aria-label*='Gmail']",
      "a[title*='Gmail']",
      "header a[href*='#inbox']",
      "a[href*='/mail']"
    ];

    const uniqueCandidates = new Set();
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (isVisibleElement(candidate)) {
          uniqueCandidates.add(candidate);
        }
      }
    }

    let bestCandidate = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of uniqueCandidates) {
      const rect = candidate.getBoundingClientRect();
      const score = Math.abs(rect.top - 24) + Math.abs(rect.left - 24);
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  function positionModeControl(control, logo) {
    let top = 12;
    let left = 140;

    if (logo && isVisibleElement(logo)) {
      const logoRect = logo.getBoundingClientRect();
      top = Math.max(8, Math.round(logoRect.top + (logoRect.height - 30) / 2));
      left = Math.max(8, Math.round(logoRect.right + 12));
    }

    const maxLeft = Math.max(8, window.innerWidth - 180);
    control.style.top = `${top}px`;
    control.style.left = `${Math.min(left, maxLeft)}px`;
  }

  function ensureModeControl() {
    let existingControl = document.getElementById("gmail-reorder-control");
    const logo = findGmailLogo();

    if (existingControl) {
      const select = existingControl.querySelector("#gmail-reorder-select");
      if (select && select.value !== currentMode) {
        select.value = currentMode;
      }
      positionModeControl(existingControl, logo);
      return;
    }

    const control = document.createElement("div");
    control.id = "gmail-reorder-control";
    control.style.position = "fixed";
    control.style.zIndex = "2147483647";
    control.style.display = "inline-flex";
    control.style.alignItems = "center";
    control.style.gap = "4px";
    control.style.padding = "0";
    control.style.border = "none";
    control.style.background = "transparent";
    control.style.boxShadow = "none";
    control.style.fontSize = "12px";
    control.style.fontFamily = "Arial, sans-serif";
    control.style.color = "#e8eaed";

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "★";
    icon.style.fontSize = "12px";
    icon.style.lineHeight = "1";
    icon.style.color = "#e8eaed";

    const select = document.createElement("select");
    select.id = "gmail-reorder-select";
    select.style.fontSize = "12px";
    select.style.padding = "1px 4px";
    select.style.color = "#e8eaed";
    select.style.background = "#3c4043";
    select.style.border = "none";
    select.style.borderRadius = "4px";
    select.style.maxWidth = "100px";

    const options = [
      { value: MODES.STAR, text: "Stars" },
      { value: MODES.SUBJECT, text: "Subject" },
      { value: MODES.DEFAULT, text: "Default" }
    ];

    options.forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.text;
      select.appendChild(option);
    });

    select.value = currentMode;
    select.addEventListener("change", () => {
      setMode(select.value);
    });

    control.appendChild(icon);
    control.appendChild(select);

    document.body.appendChild(control);
    existingControl = control;
    positionModeControl(existingControl, logo);
  }

  function markStarInteractionIfNeeded(target) {
    const starControl = target.closest(STAR_BUTTON_SELECTOR);
    if (!starControl) {
      return;
    }
    if (!starControl.closest(ROW_SELECTOR)) {
      return;
    }

    const label = (starControl.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("star")) {
      lastStarInteractionAt = Date.now();
      scheduleReorder(STAR_COOLDOWN_MS + 10);
    }
  }

  function pauseForArchiveOrReplyIfNeeded(target) {
    const interactive = target.closest("[aria-label], [data-tooltip], [title]");
    if (!interactive) {
      return;
    }

    const combinedText = [
      interactive.getAttribute("aria-label") || "",
      interactive.getAttribute("data-tooltip") || "",
      interactive.getAttribute("title") || ""
    ]
      .join(" ")
      .toLowerCase();

    if (combinedText.includes("archive") || combinedText.includes("reply")) {
      pauseUntil = Date.now() + ACTION_COOLDOWN_MS;
      scheduleReorder(ACTION_COOLDOWN_MS + 10);
    }
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    const tagName = target.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA") {
      return true;
    }

    if (target.isContentEditable) {
      return true;
    }

    return Boolean(target.closest("[contenteditable='true']"));
  }

  function handleKeydown(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const key = (event.key || "").toLowerCase();
    if (key === "e" || key === "r") {
      pauseUntil = Date.now() + ACTION_COOLDOWN_MS;
      scheduleReorder(ACTION_COOLDOWN_MS + 10);
    }
  }

  function observeGmailUi() {
    if (uiObserver) {
      uiObserver.disconnect();
    }

    uiObserver = new MutationObserver(() => {
      ensureModeControl();
      scheduleReorder();
    });

    uiObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    ensureModeControl();

    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        markStarInteractionIfNeeded(event.target);
        pauseForArchiveOrReplyIfNeeded(event.target);
      },
      true
    );

    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("hashchange", () => {
      ensureModeControl();
      scheduleReorder();
    });
    window.addEventListener("resize", () => {
      ensureModeControl();
    });

    observeGmailUi();
    scheduleReorder(50);

    window.setInterval(() => {
      ensureModeControl();
      scheduleReorder();
    }, FALLBACK_INTERVAL_MS);
  }

  init();
})();
