/**
 * Write contents page numbers for every report type.
 * The number is text, so Safari and Chrome show the same figure.
 * Page 1 is the cover. A break-after followed by a break-before is one page.
 * Each contents target is numbered on the page where that heading starts.
 */
const PAGE_MM = 297;
const MARGIN_TOP_MM = 14;
const MARGIN_BOTTOM_MM = 18;
const CONTENT_MM = PAGE_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
const CONTENT_WIDTH_MM = 210 - 24;

function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

function isPhotoPage(el: Element): boolean {
  return el.classList.contains("photo-annex-page");
}

function isA4Page(el: Element): boolean {
  return el.classList.contains("report-a4-page");
}

function startsPage(el: Element): boolean {
  return (
    el.classList.contains("report-exam-summary-sheet") ||
    el.classList.contains("report-annexure") ||
    el.classList.contains("report-section-sales") ||
    el.classList.contains("report-section-references")
  );
}

function endsPage(el: Element): boolean {
  return (
    el.classList.contains("exam-cover") ||
    el.classList.contains("report-exam-summary-sheet") ||
    el.classList.contains("report-toc")
  );
}

export function fillExamTocPages(): void {
  const sheet = document.getElementById("report-preview-sheet");
  if (!sheet) return;
  const host = sheet.closest(".report-print-host") as HTMLElement | null;
  const hostWasHidden = host?.classList.contains("hidden") ?? false;
  if (hostWasHidden) host.classList.remove("hidden");
  sheet.classList.add("exam-toc-measure");
  const previousWidth = sheet.style.width;
  sheet.style.width = `${CONTENT_WIDTH_MM}mm`;
  void sheet.offsetHeight;

  const pageH = mmToPx(CONTENT_MM);
  const pages = new Map<string, number>();
  let page = 1;
  let used = 0;

  const mark = (el: Element) => {
    if (el.id && !pages.has(el.id)) pages.set(el.id, page);
  };

  const newPage = () => {
    page += 1;
    used = 0;
  };

  const consume = (height: number) => {
    if (height <= 0) return;
    if (used > 1 && used + height > pageH) newPage();
    used += height;
    while (used > pageH) {
      used -= pageH;
      page += 1;
    }
  };

  const walk = (el: Element) => {
    if (isPhotoPage(el) || isA4Page(el)) {
      if (used > 1) newPage();
      mark(el);
      el.querySelectorAll<HTMLElement>("[id]").forEach(mark);
      used = pageH;
      if (isPhotoPage(el)) newPage();
      return;
    }
    if (startsPage(el) && used > 1) newPage();
    mark(el);
    const nested = Array.from(el.children).filter(
      (child) => child.querySelector("[id]") || child.id,
    );
    if (nested.length === 0) {
      consume(el.getBoundingClientRect().height);
    } else {
      nested.forEach(walk);
    }
    if (endsPage(el)) newPage();
  };

  Array.from(sheet.children).forEach((child) => {
    if (child instanceof Element) walk(child);
  });

  document.querySelectorAll<HTMLElement>("[data-toc-id]").forEach((slot) => {
    const id = slot.getAttribute("data-toc-id");
    if (!id) return;
    const n = pages.get(id);
    const fallback = slot.querySelector(".toc-fallback");
    if (fallback) fallback.textContent = n ? String(n) : "—";
  });
  sheet.classList.remove("exam-toc-measure");
  sheet.style.width = previousWidth;
  if (hostWasHidden) host.classList.add("hidden");
}
