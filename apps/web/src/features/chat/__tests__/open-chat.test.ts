import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('openChat lazy-widget wake', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('空闲挂载完成前的 openChat 会唤醒订阅并缓冲，就绪后回放', async () => {
    const { markChatWidgetReady, onChatWidgetWake, openChat, OPEN_CHAT_EVENT } = await import(
      '../open-chat'
    );

    const wake = vi.fn();
    const unsubscribe = onChatWidgetWake(wake);
    const received: string[] = [];
    const onOpen = (e: Event) => {
      received.push((e as CustomEvent<{ message?: string }>).detail.message ?? '');
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);

    openChat({ message: '预约咨询' });
    expect(wake).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);

    markChatWidgetReady();
    expect(received).toEqual(['预约咨询']);

    openChat({ message: '第二次' });
    expect(received).toEqual(['预约咨询', '第二次']);
    expect(wake).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  });

  it('取消唤醒订阅后不再触发挂载', async () => {
    const { onChatWidgetWake, openChat } = await import('../open-chat');
    const wake = vi.fn();
    const unsubscribe = onChatWidgetWake(wake);
    unsubscribe();
    openChat();
    expect(wake).not.toHaveBeenCalled();
  });
});
