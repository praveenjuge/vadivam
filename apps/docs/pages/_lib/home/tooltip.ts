// One shared tooltip for the icon tiles instead of one per tile keeps the
// homepage under the 2 MB crawl limit. It stays inside the viewport and
// Escape hides it (WCAG 1.4.13; the drawer's Escape handler calls `hide`).
import { cardFrom, nameOf } from "./grid";

export function createTooltip(browser: HTMLElement, signal: AbortSignal) {
  const tooltip = document.querySelector<HTMLElement>("#iconTooltip")!;
  let tooltipCard: HTMLAnchorElement | null = null;
  const hide = () => {
    tooltipCard?.removeAttribute("aria-describedby");
    tooltipCard = null;
    tooltip.hidden = true;
  };
  const show = (card: HTMLAnchorElement) => {
    if (card === tooltipCard) return;
    hide();
    tooltip.textContent = nameOf(card);
    tooltip.hidden = false;
    const margin = 8;
    const target = card.getBoundingClientRect();
    const { width, height } = tooltip.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - margin - width;
    const above = target.top - height - margin;
    tooltip.style.left = `${Math.max(margin, Math.min(target.left + target.width / 2 - width / 2, maxLeft))}px`;
    tooltip.style.top = `${above >= 0 ? above : target.bottom + margin}px`;
    card.setAttribute("aria-describedby", tooltip.id);
    tooltipCard = card;
  };
  browser.addEventListener("pointerover", (event) => {
    // Touch has no hover.
    if ((event as PointerEvent).pointerType === "touch") return;
    const card = cardFrom(event);
    if (card) show(card);
    else hide();
  });
  browser.addEventListener("pointerleave", hide);
  browser.addEventListener("focusin", (event) => {
    const card = cardFrom(event);
    if (card?.matches(":focus-visible")) show(card);
  });
  browser.addEventListener("focusout", hide);
  addEventListener("scroll", hide, { passive: true, signal });
  return { hide };
}
