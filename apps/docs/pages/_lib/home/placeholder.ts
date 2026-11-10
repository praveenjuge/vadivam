// Type example queries into the search placeholder until the visitor first
// focuses or types (or a filter fills the field), then rest for good. Reduced
// motion, at load or switched on later, keeps it plain.
export function animatePlaceholder(search: HTMLInputElement, signal: AbortSignal) {
  const examples = search.dataset.examples?.split(" ") ?? [];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (!examples.length || reducedMotion.matches) return;
  const resting = search.placeholder;
  let timer = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    search.placeholder = resting;
  };
  const wait = (ms: number, next: () => void) => {
    if (!stopped) timer = window.setTimeout(next, ms);
  };
  // Shows the first `length` letters of an example, or the resting text at 0.
  const show = (exampleIndex: number, length: number) => {
    if (search.value) return stop();
    const word = examples[exampleIndex % examples.length]!;
    search.placeholder = length ? `Try “${word.slice(0, length)}”` : resting;
    return word;
  };
  const type = (exampleIndex: number, length: number) => {
    const word = show(exampleIndex, length);
    if (!word) return;
    if (length < word.length) wait(90, () => type(exampleIndex, length + 1));
    else wait(1800, () => erase(exampleIndex, length - 1));
  };
  const erase = (exampleIndex: number, length: number) => {
    if (!show(exampleIndex, length)) return;
    if (length > 0) wait(40, () => erase(exampleIndex, length - 1));
    else wait(1600, () => type(exampleIndex + 1, 1));
  };
  if (document.activeElement === search || search.value) stop();
  else wait(2400, () => type(0, 1));
  search.addEventListener("focus", stop, { signal });
  search.addEventListener("input", stop, { signal });
  reducedMotion.addEventListener("change", (event) => event.matches && stop(), { signal });
  signal.addEventListener("abort", () => clearTimeout(timer));
}
