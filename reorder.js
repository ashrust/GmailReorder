// == Minimal GMAIL REORDER SCRIPT ==
// Adjust this code when Gmail's DOM changes.

console.log("Reorder Script started...");

(function() {
  // Star priority order
  const starPriority = {
    "none": 1,
    "purple": 2,
    "red": 3,
    "yellow": 4
  };

  function isInboxPage() {
    // In Gmail, the Inbox URL often looks like: https://mail.google.com/mail/u/0/#inbox
    return window.location.hash.includes('#inbox');
  }

  /**
   * Detects star color from the row (checks <span aria-label^="Starred"...>).
   * If the row is unread (class "zE"), we treat it as if unstarred.
   */
  function getStarColor(emailRow) {
    // If the message is unread, treat as unstarred:
    if (emailRow.classList.contains('zE')) {
      console.log("Message is unread, treating as unstarred");
      return "none"; 
    }

    // Otherwise, detect actual star color
    const starElement = emailRow.querySelector(
      'span[role="button"][aria-label^="Starred"]'
    );
    if (starElement) {
      let label = starElement.getAttribute("aria-label").toLowerCase();
      console.log("Star Element found...", label);

      // If it includes "red-star"
      if (label.includes("red-star")) return "red";
      // If it includes "purple-star"
      if (label.includes("purple-star")) return "purple";
      // Otherwise, if it just says "starred", assume "yellow"
      if (label.includes("starred")) {
        console.log("Yellow star found");
        return "yellow";
      }
    } else {
      console.log("starElement is null for row:", emailRow);
    }
    return "none";
  }

  /**
   * Extracts the timestamp from the row's time element.
   */
  function getEmailTimestamp(emailRow) {
    const timeElement = emailRow.querySelector("span.xW.xY, span.xT>span");
    if (!timeElement) return 0;
    const dateTitle = timeElement.getAttribute("title") || timeElement.getAttribute("data-tooltip");
    if (!dateTitle) return 0;
    const parsedDate = new Date(dateTitle);
    if (isNaN(parsedDate.getTime())) return 0;
    return parsedDate.getTime();
  }

  /**
   * Reorder emails visually (CSS flex) so we don't break Gmail's click bindings,
   * while adjusting row size with line-height & padding.
   */
  function reorderEmails() {
    console.log("Reordering begins...");

    // Only reorder if we're in the Inbox
    if (!isInboxPage()) {
      console.log("Not on inbox page...");
      return;
    }

    const emailRows = document.querySelectorAll('tr.zA, div.zA');
    if (!emailRows || emailRows.length === 0) {
      console.log("No email rows found...");
      return;
    }

    // Convert NodeList to array
    const rowsArray = Array.from(emailRows);

    // Sort them by star color, then timestamp desc
    rowsArray.sort((a, b) => {
      const colorA = getStarColor(a);
      const colorB = getStarColor(b);
      const priorityA = starPriority[colorA] || 9999;
      const priorityB = starPriority[colorB] || 9999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const timeA = getEmailTimestamp(a);
      const timeB = getEmailTimestamp(b);
      return timeB - timeA;
    });

    // Force parent to flex layout
    const parent = emailRows[0].parentElement;
    if (!parent) {
      console.log("No parent element found for rows");
      return;
    }

    parent.style.setProperty("display", "flex", "important");
    parent.style.setProperty("flex-direction", "column", "important");

    // If the parent is <tbody>, also flex the <table> above it
    const grandparent = parent.parentElement;
    if (grandparent && grandparent.tagName.toLowerCase() === "table") {
      grandparent.style.setProperty("display", "flex", "important");
      grandparent.style.setProperty("flex-direction", "column", "important");
    }

    // Apply row styling to keep ~40px height
    rowsArray.forEach((row, i) => {
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("flex-direction", "row", "important");
      row.style.setProperty("align-items", "center", "important");

      row.style.setProperty("margin", "0", "important");
      row.style.setProperty("padding", "7px 0", "important");
      row.style.setProperty("line-height", "1.6", "important");
      row.style.setProperty("height", "auto", "important");

      // Set the CSS order property
      row.style.setProperty("order", i.toString(), "important");
    });

    console.log("Visual reorder complete. Rows assigned order [0..N].");
  }

  // Run immediately on load
  reorderEmails();
  console.log("Reorder finished...");

  // Repeat every 10s
  setInterval(reorderEmails, 10 * 1000);
})();
