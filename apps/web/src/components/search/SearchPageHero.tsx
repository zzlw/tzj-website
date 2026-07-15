import { SearchBar } from './SearchBar';

/** 搜索页顶区：白底居中标题 + 内嵌搜索条（Rosenbauer 结果页风格） */
export function SearchPageHero({ query, title }: { query: string; title: string }) {
  return (
    <section className="bg-white pt-16 lg:pt-20">
      <div className="mx-auto max-w-3xl px-4 py-10 text-center md:px-6 md:py-14">
        <h1 className="font-display text-3xl font-extrabold text-neutral-900 md:text-4xl">
          {title}
        </h1>
        <div className="mt-8">
          <SearchBar defaultQuery={query} size="large" variant="inline" />
        </div>
      </div>
    </section>
  );
}
