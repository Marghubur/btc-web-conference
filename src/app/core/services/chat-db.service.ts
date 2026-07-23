import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface PendingMessage {
  messageId: string;
  roomId: string;
  payload: any; // The original WS payload
  timestamp: number; // Used to calculate the 15-day expiration
  retryCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatDbService extends Dexie {
  pendingMessages!: Table<PendingMessage, string>;

  constructor() {
    super('ConfeetChatDB');
    this.version(1).stores({
      pendingMessages: 'messageId, roomId, timestamp'
    });
  }

  async addPendingMessage(messageId: string, roomId: string, payload: any): Promise<void> {
    await this.pendingMessages.put({
      messageId,
      roomId,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  async removePendingMessage(messageId: string): Promise<void> {
    await this.pendingMessages.delete(messageId);
  }

  async getPendingMessagesForRoom(roomId: string): Promise<PendingMessage[]> {
    return await this.pendingMessages.where('roomId').equals(roomId).toArray();
  }

  async getAllPendingMessages(): Promise<PendingMessage[]> {
    return await this.pendingMessages.toArray();
  }

  async incrementRetryCount(messageId: string): Promise<void> {
    const msg = await this.pendingMessages.get(messageId);
    if (msg) {
      await this.pendingMessages.update(messageId, { retryCount: msg.retryCount + 1 });
    }
  }
}
