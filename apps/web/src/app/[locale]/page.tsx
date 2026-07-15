import { Suspense } from 'react';
import { HeroSection } from '@/components/sections/HeroSection';
import { HomeBelowFold } from '@/components/sections/HomeBelowFold';
import { HomeBelowFoldSkeleton } from '@/components/sections/HomeBelowFoldSkeleton';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <Suspense fallback={<HomeBelowFoldSkeleton />}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
