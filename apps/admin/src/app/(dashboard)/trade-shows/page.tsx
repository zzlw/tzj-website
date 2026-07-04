"use client";

import { ResourceListView } from "@/components/crud/ResourceListView";
import { tradeShowsConfig } from "@/features/resources/tradeShows";

export default function TradeShowsPage() {
  return <ResourceListView config={tradeShowsConfig} />;
}
