/**
 * Fill [data-toc-id] page labels from the same breaks the print stylesheet uses.
 * Page 1 is the cover. Screen computed style does not see @media print, so the
 * breaks are read from the classes styles.css applies in print.
 */
const PAGE_MM = 297;
const MARGIN_TOP_MM = 14;
const MARGIN_BOTTOM_MM = 18;
const CONTENT_MM = PAGE_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;

function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

function isPhotoPage(el: Element): boolean {
  return el.classList.contains("photo-annex-page");
}

function isA4Page(el: Element): boolean {
  return el.classList.contains("report-a4-page");
}

function photoPageBreaksAfter(el: Element): boolean {
  if (!isPhotoPage(el)) return false;
  const parent = el.parentElement;
  const last = parent?.lastElementChild === el;
  if (
    last &&
    parent &&
    (parent.classList.contains("report-annexure-subject") ||
      parent.classList.contains("report-annexure-comps"))
  ) {
    return false;
  }
  return true;
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

  const flow = (el: Element) => {
    const h = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
    const avoid =
      el.classList.contains("report-section-open") ||
      el.classList.contains("report-keep-block") ||
      el.classList.contains("report-table-keep");
    if (avoid && used > 1 && h > 0 && h <= pageH && used + h > pageH) newPage();
    mark(el);
    el.querySelectorAll<HTMLElement>("[id]").forEach((node) => {
      if (node.closest(".report-annexure, .photo-annex-page, .report-a4-page") === el) mark(node);
      else if (!node.closest(".report-annexure, .photo-annex-page, .report-a4-page")) mark(node);
    });
    if (h <= 0) return;
    if (used + h <= pageH + 0.5) {
      used += h;
      return;
    }
    if (avoid && h <= pageH) {
      newPage();
      mark(el);
      used = h;
      return;
    }
    const total = used + h;
    page += Math.floor(total / pageH);
    used = total % pageH;
  };

  const placePageBlock = (el: Element) => {
    if (used > 1) newPage();
    const owner = el.closest("[id]");
    if (owner) mark(owner);
    mark(el);
    used = pageH;
    if (isPhotoPage(el) && photoPageBreaksAfter(el)) newPage();
  };

  const place = (el: Element) => {
    if (isPhotoPage(el) || isA4Page(el)) {
      placePageBlock(el);
      return;
    }
    if (startsPage(el) && used > 1) newPage();
    const blocks = Array.from(el.querySelectorAll<HTMLElement>(".photo-annex-page, .report-a4-page"));
    if (blocks.length > 0) {
      mark(el);
      let cursor: ChildNode | null = el.firstChild;
      blocks.forEach((block) => {
        const before: Element[] = [];
        while (cursor && cursor !== block) {
          if (cursor instanceof Element && !cursor.querySelector(".photo-annex-page, .report-a4-page")) {
            before.push(cursor);
          }
          cursor = cursor.nextSibling;
        }
        before.forEach(flow);
        placePageBlock(block);
        cursor = block.nextSibling;
      });
      return;
    }
    flow(el);
    if (endsPage(el)) newPage();
  };

  Array.from(sheet.children).forEach((child) => {
    if (child instanceof Element) place(child);
  });

  document.querySelectorAll<HTMLElement>("[data-toc-id]").forEach((slot) => {
    const id = slot.getAttribute("data-toc-id");
    if (!id) return;
    const n = pages.get(id);
    slot.textContent = n ? String(n) : "—";
  });
  sheet.classList.remove("exam-toc-measure");
  if (hostWasHidden) host.classList.add("hidden");
}
