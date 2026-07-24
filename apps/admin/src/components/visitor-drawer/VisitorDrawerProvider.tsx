'use client';

/**
 * 全局访客/IP 详情抽屉 Provider：根部挂一次，任何组件经 useVisitorDrawer() 只传 ID 即可拉起。
 * - 有限栈（封顶 2 层）：仅 IP(底) + 人物(顶) 桥跳转组合，人物在 IP 之上时遮罩透明并可返回。
 * - URL 深链：open/close 写入 ?ip= / ?person=，刷新/分享可复原（scroll:false，同路径替换）。
 * - 权限：聊天 tab 需 chat.view、询盘 tab 需 contacts.view（无则隐藏该 tab，不阻断抽屉本体）。
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IpVisitorDetailSheet } from '@/components/analytics/IpVisitorDetailSheet';
import { useSession } from '@/components/session';
import type { IpDrawerSeed, VisitorProfileIdentity } from '@/features/analytics';
import { VisitorProfileSheet } from '@/features/chat/components/VisitorProfileSheet';
import { type VisitorDrawerApi, VisitorDrawerContext } from './context';

interface PersonEntry {
  visitorId: string;
  seed?: Partial<VisitorProfileIdentity>;
}

interface IpEntry {
  ipHash: string;
  seed?: Partial<IpDrawerSeed>;
}

export function VisitorDrawerProvider({ children }: { children: React.ReactNode }) {
  const { permissions } = useSession();
  const canViewChat = permissions.includes('chat.view') || permissions.includes('*');
  const canViewInquiry =
    permissions.includes('contacts.view') ||
    permissions.includes('contacts.manage') ||
    permissions.includes('*');

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 两槽栈：ipEntry 为底、personEntry 为顶，天然满足「封顶 2 层，仅 IP+人物」约束。
  const [ipEntry, setIpEntry] = useState<IpEntry | null>(null);
  const [personEntry, setPersonEntry] = useState<PersonEntry | null>(null);

  // 首次挂载读 query 复原（同时含 ip 与 person 则 IP 为底、person 为顶）。
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const ip = searchParams.get('ip');
    const person = searchParams.get('person');
    if (ip) setIpEntry({ ipHash: ip });
    if (person) setPersonEntry({ visitorId: person });
  }, [searchParams]);

  // 最新 query 快照（经 effect 更新），供写 URL 时保留其它无关参数而不制造自触发循环。
  const latestSearchRef = useRef(searchParams.toString());
  useEffect(() => {
    latestSearchRef.current = searchParams.toString();
  }, [searchParams]);

  // 栈变化同步到 URL（scroll:false，同路径替换，不新增历史堆栈）。
  useEffect(() => {
    if (!initializedRef.current) return;
    const sp = new URLSearchParams(latestSearchRef.current);
    if (ipEntry) sp.set('ip', ipEntry.ipHash);
    else sp.delete('ip');
    if (personEntry) sp.set('person', personEntry.visitorId);
    else sp.delete('person');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ipEntry, personEntry, pathname, router]);

  const api = useMemo<VisitorDrawerApi>(
    () => ({
      openPerson(visitorId, seed) {
        setPersonEntry({ visitorId, seed });
      },
      openIp(ipHash, seed) {
        // 重置栈：IP 为底，清掉可能存在的人物层
        setIpEntry({ ipHash, seed });
        setPersonEntry(null);
      },
      close() {
        // 关闭栈顶：有人物层先关人物（回到 IP 层），否则关 IP 层
        setPersonEntry((prev) => {
          if (prev) return null;
          setIpEntry(null);
          return prev;
        });
      },
    }),
    [],
  );

  const closePerson = useCallback(() => setPersonEntry(null), []);
  const closeIp = useCallback(() => {
    // 人物层在顶时，忽略底层 IP 的关闭请求（堆叠 Radix Dialog 下点顶层 X 可能连带 dismiss 底层）
    if (personEntry) return;
    setIpEntry(null);
  }, [personEntry]);

  return (
    <VisitorDrawerContext.Provider value={api}>
      {children}

      <IpVisitorDetailSheet
        ipHash={ipEntry?.ipHash ?? null}
        seed={ipEntry?.seed}
        open={!!ipEntry}
        onOpenChange={(v) => {
          if (!v) closeIp();
        }}
      />

      {/* 人物抽屉：作为二层叠在 IP 抽屉之上时遮罩透明 + 提供 onBack 弹回 IP 层 */}
      <VisitorProfileSheet
        visitorId={personEntry?.visitorId ?? null}
        seed={personEntry?.seed}
        open={!!personEntry}
        onOpenChange={(v) => {
          if (!v) closePerson();
        }}
        onBack={ipEntry ? closePerson : undefined}
        overlayClassName={ipEntry ? 'bg-transparent' : undefined}
        canViewChat={canViewChat}
        canViewInquiry={canViewInquiry}
      />
    </VisitorDrawerContext.Provider>
  );
}
