// search.models.ts

export interface SearchResultItem {
  type: 'USER' | 'CONVERSATION' | 'MESSAGE' | 'FILE' | 'CHANNEL';
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  score: number;
  highlights?: { [key: string]: string };
  lastActivity?: string;
  metadata?: { [key: string]: any };
}

export interface GroupedResults {
  users: SearchResultItem[];
  conversations: SearchResultItem[];
  messages: SearchResultItem[];
  files: SearchResultItem[];
  userCount: number;
  conversationCount: number;
  messageCount: number;
  fileCount: number;
}

export interface SearchMetadata {
  searchTerm: string;
  totalCount: number;
  page: number;
  limit: number;
  executionTimeMs: number;
  fromCache: boolean;
  isTypeahead: boolean;
  countByType: { [key: string]: number };
}

export interface SearchError {
  code: string;
  message: string;
  retriable: boolean;
}

export interface GlobalSearchResponse {
  results?: GroupedResults;
  combined?: SearchResultItem[];
  metadata?: SearchMetadata;
  error?: SearchError;
}

export interface SearchState {
  query: string;
  results: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
}

// Health check response
export interface HealthResponse {
  status: 'UP' | 'DOWN';
  service: string;
}

// Metrics response
export interface MetricsResponse {
  totalSearches: number;
  cacheHits: number;
  cacheHitRate: number;
  failedSearches: number;
  activeSearches: number;
  cacheSize: number;
  isHealthy: boolean;
  poolSize: number;
  activeThreads: number;
  queueSize: number;
}