import { Component, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AjaxService } from '../providers/services/ajax.service';
import { User } from '../providers/model';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';
import { environment } from '../../environments/environment';
import { ConfeetSocketService, Message } from '../providers/socket/confeet-socket.service';
import { ChatServerService } from '../providers/services/chat.server.service';
import { Subscription } from 'rxjs';
import { Participant } from 'livekit-client';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, AfterViewChecked {
    @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

    meetingRooms: Array<Conversation> = [];
    isPageReady: boolean = false;
    today: Date = new Date();
    message: any = signal<string | null>('');
    messages: Message[] = [];
    pageIndex: number = 1;
    recieverId?: string = null;
    filterModal: FilterModal = { pageIndex: 1, pageSize: 20, searchString: '1=1' };
    conn: any = null;
    user: User = {
        isMicOn: false,
        isCameraOn: false,
    };

    searchQuery: string = '';
    searchResults: any[] = [];
    isSearching: boolean = false;

    typingUsers: Map<string, boolean> = new Map();
    private subscriptions = new Subscription();
    private shouldScrollToBottom = false;

    currentUserId: string = "";
    activeConversation: Conversation = null;

    readonly destroyRef = inject(DestroyRef);

    constructor(
        private http: AjaxService,
        private local: LocalService,
        private ws: ConfeetSocketService,
        private httpMessage: ChatServerService
    ) { }

    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }

    ngOnInit() {
        this.user = this.local.getUser();
        this.currentUserId = this.user.userId;
        this.socketHandShake();

        this.receivedEvent();

        // Listen for global search selections
        this.subscriptions.add(
            this.httpMessage.openChat$.subscribe((user: any) => {
                this.startChatWithUser(user);
            })
        );

        this.getConversationNames();
        this.isPageReady = true;
    }

    socketHandShake() {
        var socketEndPoint = `${environment.socketBaseUrl}/${environment.socketHandshakEndpoint}`;
        this.ws.connect(socketEndPoint, this.user.userId, '675459a1b1c2d3e4f5a6b7c1');
    }

    getConversationNames() {
        this.httpMessage.get(`users/meeting-rooms`).then((res: any) => {
            if (res.conversations && res.conversations.length > 0) {
                console.log("meeting rooms loaded");
                this.meetingRooms = res.conversations;
            }
        });
    }

    getUserInitiaLetter(fname: string, lname: string): string {
        var name = fname + ' ' + (lname != null && lname != '' ? lname : '');
        if (!name) return '';

        const words = name.split(' ').slice(0, 2);
        const initials = words
            .map((x) => {
                if (x.length > 0) {
                    return x.charAt(0).toUpperCase();
                }
                return '';
            })
            .join('');

        return initials;
    }

    getColorFromName(fname: string, lname: string): string {
        var name = fname + ' ' + (lname != null && lname != '' ? lname : '');
        // Predefined color palette (Google Meet style soft colors)
        const colors = [
            '#f28b829f',
            '#FDD663',
            '#81C995',
            '#AECBFA',
            '#D7AEFB',
            '#FFB300',
            '#34A853',
            '#4285F4',
            '#FBBC05',
            '#ff8075ff',
            '#9AA0A6',
            '#F6C7B6',
        ];

        // Create hash from name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Pick color based on hash
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    onSearch() {
        if (!this.searchQuery || this.searchQuery.length < 2) {
            this.searchResults = [];
            return;
        }

        this.isSearching = true;
        this.httpMessage.get(`users/search?term=${this.searchQuery}`).then((res: any) => {
            this.isSearching = false;
            // Assuming res is the array of users or res.users
            this.searchResults = Array.isArray(res) ? res : (res.users || []);
        }).catch(e => {
            this.isSearching = false;
            console.error("Search failed", e);
        });
    }

    startChatWithUser(selectedUser: any) {
        // Check if conversation exists
        const existing = this.meetingRooms.findIndex(x =>
            x.participantIds.findIndex(y => y === selectedUser.userId) > -1);
        if (existing > -1) {
            this.selectUser(this.meetingRooms[existing]); // Type assertion if needed, or better type matching
        } else {
            // Logic to create new conversation if not exists
            // For now, let's treat it as transient user add to list for UI
            // Or verify with backend to create room
            console.log("Starting new chat with", selectedUser);
            let newConversation: Conversation = {
                id: null,
                conversationName: selectedUser.firstName + ' ' + selectedUser.lastName,
                createdBy: `${this.currentUserId}`,
                conversationType: 'direct',
                participantIds: [selectedUser.userId, this.currentUserId],
                conversationAvatar: selectedUser.avatar,
                participants: [],
                createdAt: new Date().toISOString(),
                updatedAt: null,
                lastMessageAt: null,
                lastMessage: null,
                settings: null,
                isActive: true
            }

            this.meetingRooms.unshift(newConversation);
            this.selectUser(newConversation, selectedUser.userId);

            // this.http.post("user/create-conversation", newConversation).then((res: any) => {
            //     this.meetingRooms.push(res);
            //     this.selectUser(res);
            // });
            // Verify if we need to call API to create room
            // For this task, assuming we might just display
        }
        this.searchQuery = '';
        this.searchResults = [];
    }

    selectUser(conversation: Conversation, recieverId: string = null) {
        this.recieverId = recieverId;
        this.activeConversation = conversation;
        this.pageIndex = 1;
        this.messages = []; // Clear existing messages
        this.loadMoreMessages(true); // Pass true to scroll to bottom on first load
    }

    onScroll(event: any) {
        const element = event.target;
        // Load more when scrolled to top (for loading older messages)
        if (element.scrollTop === 0) {
            this.loadMoreMessages(false);
        }
    }

    loadMoreMessages(scrollToBottom: boolean = false) {
        if (!this.activeConversation) return;

        this.httpMessage.get(`meetings/get-room-messages/${this.activeConversation.id}?page=${this.pageIndex}`).then((res: any) => {
            if (res.messages && res.messages.data && res.messages.data.length > 0) {
                console.log("messages loaded", res.messages.data.length);
                const newMessages = res.messages.data;
                // Append new messages to the list
                this.messages = [...this.messages, ...newMessages];
                this.pageIndex++;

                // Scroll to bottom only on initial load
                if (scrollToBottom) {
                    this.shouldScrollToBottom = true;
                }
            }
        });
    }

    sendMessage() {
        if (this.recieverId != null) {
            // call java to insert or create conversation channel
            this.http.post(`conversations/create/${this.currentUserId}`, this.activeConversation).then((res: any) => {
                console.log("channel created", res);
                this.send(res);
            });
        } else {
            this.send(this.activeConversation);
        }
    }

    private send(response: any) {
        if (this.message() != null && this.message() != '' && response.id != null) {
            var event: Message = {
                conversationId: response.id,
                messageId: crypto.randomUUID(),
                senderId: this.currentUserId,
                recievedId: this.recieverId,
                type: "text",
                body: this.message(),
                fileUrl: null,
                replyTo: null,
                mentions: [],
                reactions: [],
                clientType: "web",
                createdAt: new Date(),
                editedAt: null,
                status: 1
            }

            this.messages.push(event);
            this.ws.sendMessage(event);
            this.message.set('');
            this.shouldScrollToBottom = true; // Scroll to bottom after sending
        }
    }

    scrollToBottom(): void {
        try {
            if (this.messagesContainer) {
                this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
            }
        } catch (err) {
            console.error('Error scrolling to bottom:', err);
        }
    }

    formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    receivedEvent() {
        // New message received
        this.subscriptions.add(
            this.ws.newMessage$.subscribe(message => {
                this.messages.push(message);
                // Auto mark as delivered
                this.ws.markDelivered(message.id!, message.conversationId);
                this.shouldScrollToBottom = true; // Scroll to bottom on new message
            })
        );

        // Message sent confirmation
        this.subscriptions.add(
            this.ws.messageSent$.subscribe(message => {
                // Update local message with server-assigned id and timestamp
                const index = this.messages.findIndex(m => m.messageId === message.messageId);
                if (index > -1) {
                    this.messages[index] = message;
                } else {
                    this.messages.push(message);
                }
            })
        );

        // Delivery receipt
        this.subscriptions.add(
            this.ws.delivered$.subscribe(delivered => {
                this.updateMessageStatus(delivered.messageId, 'delivered');
            })
        );

        // Read receipt
        this.subscriptions.add(
            this.ws.seen$.subscribe(seen => {
                this.updateMessageStatus(seen.messageId, 'seen');
            })
        );

        // Typing indicator
        this.subscriptions.add(
            this.ws.userTyping$.subscribe(typing => {
                this.typingUsers.set(typing.userId, typing.isTyping);
            })
        );

        // Error handling
        this.subscriptions.add(
            this.ws.error$.subscribe(error => {
                console.error('Server error:', error.message);
            })
        );
    }

    onTyping(isTyping: boolean): void {
        this.ws.sendTyping('current-conversation-id', isTyping);
    }

    markAsSeen(messageId: string, conversationId: string): void {
        this.ws.markSeen(messageId, conversationId);
    }

    private updateMessageStatus(messageId: string, status: string): void {
        const message = this.messages.find(m => m.id === messageId);
        if (message) {
            // Update UI to show delivered/seen status
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        this.ws.disconnect();
    }
}

export interface FilterModal {
    searchString: string;
    sortBy?: string;
    pageIndex: number;
    pageSize: number;
}

export interface Participants {
    userId: string;
    username: string;
    displayName: string;
    joinedAt: string;
    role: 'admin' | 'member';
    email: string;
    avatar: string;
    isActive: boolean;
}

export interface LastMessage {
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
    sentAt: string;
}

export interface ConversationSettings {
    allowReactions: boolean;
    allowPinning: boolean;
    adminOnlyPost: boolean;
}

export interface Conversation {
    id: string;
    conversationType: 'group' | 'direct';
    participantIds: Array<string>;
    participants: Participants[];
    conversationName: string;
    conversationAvatar: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage: LastMessage;
    settings: ConversationSettings;
    isActive: boolean;
}