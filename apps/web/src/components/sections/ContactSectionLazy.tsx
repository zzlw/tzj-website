"use client";

import dynamic from "next/dynamic";
import { Container } from "@/components/ui";

const ContactSection = dynamic(
  () =>
    import("@/components/sections/ContactSection").then((m) => ({
      default: m.ContactSection,
    })),
  {
    loading: () => (
      <section className="border-t border-neutral-200 bg-neutral-50 py-16">
        <Container>
          <div className="mx-auto h-8 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="mt-10 h-64 animate-pulse rounded bg-neutral-100" />
        </Container>
      </section>
    ),
  },
);

/** 联系表单 + Turnstile：唯一值得 dynamic 的首页重组件（纯客户端）。 */
export function ContactSectionLazy() {
  return <ContactSection />;
}
