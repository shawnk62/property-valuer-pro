/**
 * Split the preview into the pages the PDF prints, then write the contents
 * number from the page a heading is actually on. No browser page counter.
 */
const PAGE_MM = 297;
const MARGIN_TOP_MM = 14;
const MARGIN_BOTTOM_MM = 18;
const CONTENT_MM = PAGE_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
const CONTENT_WIDTH_MM = 210 - 24;

function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

function isLeafPage(el: Element): boolean {
  return el.classList.contains("photo-annex-page") || el.classList.contains("report-a4-page");
}

function ownPage(el: Element): boolean {
  return (
    el.classList.contains("exam-cover") ||
    el.classList.contains("report-toc") ||
    el.classList.contains("report-exam-summary-sheet") ||
    el.classList.contains("report-summary-page") ||
    el.classList.contains("report-section-sales") ||
    el.classList.contains("report-section-references") ||
    el.classList.contains("report-annexure") ||
    isLeafPage(el)
  );
}

function unwrap(sheet: HTMLElement) {
  sheet.querySelectorAll(":scope > .preview-page").forEach((page) => {
    while (page.firstChild) sheet.insertBefore(page.firstChild, page);
    page.remove();
  });
}

export function fillExamTocPages(): void {
  const source = document.getElementById("report-preview-source");
  if (!source) return;
  const host = source.closest(".report-print-host") as HTMLElement | null;
  if (!host) return;
  let pages = host.querySelector<HTMLElement>("#report-preview-pages");
  if (!pages) {
    pages = document.createElement("div");
    pages.id = "report-preview-pages";
    host.appendChild(pages);
  }
  pages.replaceChildren();
  const sheet = source.cloneNode(true) as HTMLElement;
  sheet.id = "report-preview-sheet";
  sheet.classList.remove("report-sheet-source");
  host.insertBefore(pages, source);
  pages.appendChild(sheet);
  try {
    paginateSheet(sheet);
  } catch (err) {
    console.error("Preview pagination failed", err);
  }
  if (pages.childElementCount > 0) source.classList.add("report-sheet-source");
}

function paginateSheet(sheet: HTMLElement): void {
  const host = sheet.closest(".report-print-host") as HTMLElement | null;
  const hostWasHidden = host?.classList.contains("hidden") ?? false;
  if (hostWasHidden) host.classList.remove("hidden");
  unwrap(sheet);
  sheet.classList.add("exam-toc-measure");
  const previousWidth = sheet.style.width;
  sheet.style.width = `${CONTENT_WIDTH_MM}mm`;
  void sheet.offsetHeight;

  const pageH = mmToPx(CONTENT_MM);
  const children = Array.from(sheet.children).filter((node) => node instanceof Element);
  let pageNum = 0;
  let used = 0;
  let pageEl: HTMLDivElement | null = null;

  const open = () => {
    pageNum += 1;
    used = 0;
    pageEl = document.createElement("div");
    pageEl.className = "preview-page";
    pageEl.dataset.page = String(pageNum);
    sheet.appendChild(pageEl);
  };

  const place = (el: Element, forced: boolean) => {
    const h = Math.max(el.getBoundingClientRect().height, el.scrollHeight);
    if (!pageEl || forced || (used > 8 && h > 0 && used + h > pageH)) open();
    pageEl!.appendChild(el);
    used += h;
  };

  children.forEach((el) => {
    const leafs = Array.from(el.querySelectorAll<HTMLElement>(":scope > .photo-annex-page, :scope > .report-a4-page"));
    if (leafs.length > 0) {
      if (used > 1) open();
      else if (!pageEl) open();
      pageEl?.classList.add("preview-page-flow");
      pageEl?.appendChild(el);
      pageEl!.dataset.page = String(pageNum);
      leafs.forEach((leaf, index) => {
        leaf.dataset.page = String(pageNum + index);
      });
      pageNum += leafs.length - 1;
      used = pageH;
      pageEl = null;
      return;
    }
    const blocks = Array.from(
      el.querySelectorAll<HTMLElement>(
        ":scope > .report-section-open, :scope > .report-keep-block, :scope > .report-result-sign, :scope > .report-map-page, .sales-evidence-item, .report-table-keep",
      ),
    );
    if (el.classList.contains("report-section-sales") && blocks.length > 0) {
      // Place the section's blocks in document order. Do not prepend the
      // section shell — leftover children were appearing before the heading.
      const ordered = Array.from(el.children).filter((node) => node instanceof Element) as HTMLElement[];
      if (!pageEl) open();
      ordered.forEach((block) => {
        const blockH = Math.max(block.getBoundingClientRect().height, 48);
        const mapPage = block.classList.contains("report-map-page");
        const newPage = block.classList.contains("break-before-page");
        const heading = block.classList.contains("report-section-open") || Boolean(block.querySelector("h2, h3"));
        if (mapPage || newPage || (heading && used > pageH * 0.8)) open();
        else if (used > 8 && used + blockH > pageH) open();
        pageEl!.appendChild(block);
        used += blockH;
        if (mapPage) used = pageH;
      });
      el.remove();
      return;
    }
    const h = Math.max(el.getBoundingClientRect().height, el.scrollHeight);
    const forced = ownPage(el);
    if (!pageEl || forced || (used > 8 && h > 0 && used + h > pageH)) open();
    pageEl!.appendChild(el);
    used = forced && !el.classList.contains("report-section-sales") && !el.classList.contains("report-section-references") ? pageH : used + h;
    if (forced && el.classList.contains("exam-cover") || forced && el.classList.contains("report-toc") || forced && el.classList.contains("report-exam-summary-sheet")) pageEl = null;
  });

  let shown = 0;
  sheet.querySelectorAll<HTMLElement>(".preview-page:not(.preview-page-flow), .photo-annex-page, .report-a4-page").forEach((el) => {
    shown += 1;
    el.dataset.page = String(shown);
  });
  sheet.querySelectorAll<HTMLElement>(".report-a4-annex").forEach((section) => {
    const first = section.querySelector<HTMLElement>(".report-a4-page");
    if (section.id && first?.dataset.page) section.dataset.page = first.dataset.page;
  });

  sheet.querySelectorAll<HTMLElement>("[data-toc-id]").forEach((slot) => {
    const id = slot.getAttribute("data-toc-id");
    if (!id) return;
    const target = document.getElementById(id);
    const leaf = target?.closest<HTMLElement>("[data-page]");
    const box = target?.closest<HTMLElement>(".preview-page");
    const n = id === "exam-annex-survey" && (leaf?.dataset.page || box?.dataset.page)
      ? String(Number(leaf?.dataset.page || box?.dataset.page) + 1)
      : leaf?.dataset.page || box?.dataset.page;
    const fallback = slot.querySelector(".toc-fallback");
    if (fallback) fallback.textContent = n || "—";
  });

  sheet.classList.remove("exam-toc-measure");
  sheet.style.width = previousWidth;
  if (hostWasHidden) host.classList.add("hidden");
}
