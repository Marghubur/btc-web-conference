// search.models.ts

export interface UserDetail {
  id: string;
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

export interface Conversation {
  id: string;
  conversationId: string;
  conversationType: 'direct' | 'group';
  participantIds: string[];
  participants: Participant[];
  conversationName: string;
  conversationAvatar: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: LastMessage;
  lastMessageAt: Date;
  isActive: boolean;
  settings: ConversationSettings;
}


export interface Participant {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  joinedAt: Date;
  role: string;
}

export interface LastMessage {
  messageId: string;
  content: string;
  senderId: string;
  senderName: string;
  sentAt: Date;
}

export interface ConversationSettings {
  allowReactions: boolean;
  allowPinning: boolean;
  adminOnlyPost: boolean;
}

export interface Messages {
  id: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  recievedId: string;
  type: string;
  avatar: string;
  body: string;
  fileUrl: string;
  replyTo: string;
  mentions: string[];
  reactions: string[];
  clientType: string;
  createdAt: Date;
  editedAt: Date;
  status: number;
  isNewConversation: boolean;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface GroupedResults {
  users: UserDetail[];
  conversations: Conversation[];
  messages: Messages[];
  files: any[];
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