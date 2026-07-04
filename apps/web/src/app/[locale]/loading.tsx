import { getTranslations } from "next-intl/server";
import { Loading } from "@tzj/ui";
import { Container } from "@/components/ui";

export default async function LoadingPage() {
  const t = await getTranslations("common");

  return (
    <Container>
      <Loading label={t("loading")} labelClassName="text-secondary-text" />
    </Container>
  );
}
