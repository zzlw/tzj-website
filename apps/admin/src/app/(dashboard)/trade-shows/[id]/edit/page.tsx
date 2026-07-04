"use client";

import { use } from "react";
import { ResourceEditor } from "@/components/crud/ResourceEditor";
import { tradeShowsConfig } from "@/features/resources/tradeShows";

export default function EditTradeShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ResourceEditor config={tradeShowsConfig} id={id} />;
}
