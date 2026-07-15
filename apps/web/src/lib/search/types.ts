export type SearchResultGroup = 'page' | 'solution' | 'case' | 'news' | 'blog' | 'tradeShow';

export interface SearchResult {
  id: string;
  title: string;
  href: string;
  group: SearchResultGroup;
  excerpt?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  pagination: SearchPagination;
}

export interface SearchPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
}
