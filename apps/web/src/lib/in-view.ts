/**
 * 元素进入视口（含提前量）后回调一次。
 * 无 IntersectionObserver 时立刻回调，避免旧内核永远不加载折页图。
 */
export function observeOnceInView(
  element: Element,
  onView: () => void,
  rootMargin = '200px',
): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onView();
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onView();
        io.disconnect();
      }
    },
    { rootMargin },
  );
  io.observe(element);
  return () => io.disconnect();
}
