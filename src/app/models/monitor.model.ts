// -----------------------------------------------------------------
// Monitor API Response Models
// -----------------------------------------------------------------

// MonitorResponse is the main response for the monitor API
export interface MonitorResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    IsSuccess: boolean;
    connections: ConnectionStats;
    rooms: RoomStats;
    calls: CallStats;
    clients: ClientInfo[];
    statusCount: { [key: string]: number };
}

// ConnectionStats holds connection-related statistics
export interface ConnectionStats {
    totalConnected: number;
    totalOnline: number;
    totalBusy: number;
    totalInCall: number;
    totalAway: number;
}

// RoomStats holds room/conversation statistics
export interface RoomStats {
    totalRooms: number;
    activeRooms: number;
    roomDetails: RoomInfo[];
}

// RoomInfo contains information about a single room
export interface RoomInfo {
    conversationId: string;
    totalMembers: number;
    onlineMembers: number;
    memberIds: string[];
}

// CallStats holds active call statistics
export interface CallStats {
    totalActiveCalls: number;
    callDetails: CallInfo[];
}

// CallInfo contains information about a single active call
export interface CallInfo {
    conversationId: string;
    callerId: string;
    calleeIds: string[];
    callType: 'audio' | 'video';
    status: number;
    startedAt: string;
}

// ClientInfo contains information about a connected client
export interface ClientInfo {
    clientId: string;
    userId: string;
    status: 'online' | 'busy' | 'in_call' | 'away';
    currentConversationId?: string;
}
