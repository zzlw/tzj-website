"use client";

import { ResourceEditor } from "@/components/crud/ResourceEditor";
import { tradeShowsConfig } from "@/features/resources/tradeShows";

export default function NewTradeShowPage() {
  return <ResourceEditor config={tradeShowsConfig} />;
}
