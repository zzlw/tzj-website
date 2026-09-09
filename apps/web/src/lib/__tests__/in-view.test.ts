import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeOnceInView } from '@/lib/in-view';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('observeOnceInView', () => {
  it('无 IntersectionObserver 时立即回调', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onView = vi.fn();
    const stop = observeOnceInView({} as Element, onView);
    expect(onView).toHaveBeenCalledOnce();
    stop();
  });

  it('相交后回调一次并断开观察', () => {
    let callback: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );

    const onView = vi.fn();
    const el = {} as Element;
    observeOnceInView(el, onView, '100px');
    expect(observe).toHaveBeenCalledWith(el);
    expect(onView).not.toHaveBeenCalled();

    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onView).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
