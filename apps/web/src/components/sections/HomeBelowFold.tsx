import { connection } from "next/server";
import { ProductMatrixSection } from "@/components/sections/ProductMatrixSection";
import { SolutionsSection } from "@/components/sections/SolutionsSection";
import { MissionSection } from "@/components/sections/MissionSection";
import { DeliveriesSection } from "@/components/sections/DeliveriesSection";
import { ProcessBandI18n } from "@/components/sections/blocks-i18n";
import { CertificationWall } from "@/components/sections/CertificationWall";
import { ContactSectionLazy } from "@/components/sections/ContactSectionLazy";

/**
 * 首页首屏以下内容：RSC Streaming 边界（connection），
 * 先输出 Hero/LCP，再流式渲染其余 Server Component。
 */
export async function HomeBelowFold() {
  await connection();

  return (
    <>
      <ProductMatrixSection />
      <SolutionsSection />
      <MissionSection />
      <DeliveriesSection />
      <ProcessBandI18n />
      <CertificationWall />
      <ContactSectionLazy />
    </>
  );
}
