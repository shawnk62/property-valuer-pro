/**
 * Fill [data-toc-id] page labels from the live print layout.
 * Page 1 is the cover. Forced breaks on the cover and executive summary
 * are applied the same way as styles.css so footer counters stay aligned.
 */
const PAGE_MM = 297;
const MARGIN_TOP_MM = 14;
const MARGIN_BOTTOM_MM = 18;
const CONTENT_MM = PAGE_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;

function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

function isPageBreakBefore(el: Element): boolean {
  if (
    el.classList.contains("report-exam-summary-sheet") ||
    el.classList.contains("report-a4-page") ||
    el.classList.contains("report-annexure")
  ) {
    return true;
  }
  const s = window.getComputedStyle(el);
  return s.breakBefore === "page" || s.pageBreakBefore === "always";
}

function isPageBreakAfter(el: Element): boolean {
  if (
    el.classList.contains("exam-cover") ||
    el.classList.contains("report-exam-summary-sheet") ||
    el.classList.contains("report-a4-page")
  ) {
    return true;
  }
  const s = window.getComputedStyle(el);
  return s.breakAfter === "page" || s.pageBreakAfter === "always";
}

function isAvoidInside(el: Element): boolean {
  const s = window.getComputedStyle(el);
  return s.breakInside === "avoid" || s.pageBreakInside === "avoid";
}

export function fillExamTocPages(): void {
  const sheet = document.getElementById("report-preview-sheet");
  if (!sheet) return;
  sheet.classList.add("exam-toc-measure");

  const pageH = mmToPx(CONTENT_MM);
  const pages = new Map<string, number>();
  let page = 1;
  let used = 0;

  const mark = (el: Element) => {
    if (el.id) pages.set(el.id, page);
    el.querySelectorAll<HTMLElement>("[id]").forEach((node) => {
      if (!pages.has(node.id)) pages.set(node.id, page);
    });
  };

  const newPage = () => {
    page += 1;
    used = 0;
  };

  const place = (el: Element) => {
    const h = Math.max(0, (el as HTMLElement).getBoundingClientRect().height);
    if (isPageBreakBefore(el) && used > 1) newPage();
    if (isAvoidInside(el) && used > 1 && used + h > pageH + 0.5) newPage();
    mark(el);
    if (h <= 0) {
      if (isPageBreakAfter(el) && used > 0) newPage();
      return;
    }
    if (used + h <= pageH + 0.5) {
      used += h;
    } else if (isAvoidInside(el) && used > 1) {
      newPage();
      mark(el);
      if (h > pageH) {
        page += Math.floor(h / pageH);
        used = h % pageH;
      } else {
        used = h;
      }
    } else {
      const total = used + h;
      const extra = Math.floor(total / pageH);
      page += extra;
      used = total % pageH;
    }
    if (isPageBreakAfter(el)) newPage();
  };

  Array.from(sheet.children).forEach((child) => place(child));

  document.querySelectorAll<HTMLElement>("[data-toc-id]").forEach((slot) => {
    const id = slot.getAttribute("data-toc-id");
    if (!id) return;
    const n = pages.get(id);
    slot.textContent = n ? String(n) : "—";
  });
  sheet.classList.remove("exam-toc-measure");
}
