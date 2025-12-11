import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { AjaxService } from '../providers/services/ajax.service';
import { User } from '../providers/model';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { LocalService } from '../providers/services/local.service';
import { environment } from '../../environments/environment';
import { ConfeetSocketService, Message } from '../providers/socket/confeet-socket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatServerService } from '../providers/services/chat.server.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.css',
    animations: [
        trigger('highlightAnim', [
            state(
                'normal',
                style({
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                    fontWeight: 'normal',
                    transform: 'scale(1)',
                })
            ),
            state(
                'selected',
                style({
                    backgroundColor: 'white',
                    boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px',
                    fontWeight: '600',
                    transform: 'scale(1)', // slight zoom
                })
            ),
            transition('normal => selected', [animate('200ms ease-in')]),
            transition('selected => normal', [animate('200ms ease-out')]),
        ]),
    ],
})
export class ChatComponent implements OnInit {
    meetingRooms: Array<User> = [];
    isPageReady: boolean = false;
    today: Date = new Date();
    message: any = signal<string | null>('');
    messages: Message[] = [];
    pageIndex: number = 1;
    filterModal: FilterModal = { pageIndex: 1, pageSize: 20, searchString: '1=1' };
    conn: any = null;
    user: User = {
        isMicOn: false,
        isCameraOn: false,
    };

    typingUsers: Map<string, boolean> = new Map();
    private subscriptions = new Subscription();

    currentUserId: number = 0;
    activeConversation: Conversation = null;

    readonly destroyRef = inject(DestroyRef);

    constructor(
        private http: AjaxService,
        private local: LocalService,
        private ws: ConfeetSocketService,
        private httpMessage: ChatServerService
    ) { }

    ngOnInit() {
        this.user = this.local.getUser();
        this.currentUserId = this.user.userId;
        this.socketHandShake();

        this.recievedEvent();

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

    selectUser(conversation: Conversation) {
        this.activeConversation = conversation;
        this.pageIndex = 1;
        this.messages = []; // Clear existing messages
        this.loadMoreMessages();
    }

    onScroll(event: any) {
        const element = event.target;
        if (element.scrollHeight - element.scrollTop <= element.clientHeight + 10) {
            this.loadMoreMessages();
        }
    }

    loadMoreMessages() {
        if (!this.activeConversation) return;

        this.httpMessage.get(`meetings/get-room-messages/${this.activeConversation.id}?page=${this.pageIndex}`).then((res: any) => {
            if (res.messages && res.messages.data && res.messages.data.length > 0) {
                console.log("messages loaded", res.messages.data.length);
                const newMessages = res.messages.data;
                // Append new messages to the list
                this.messages = [...this.messages, ...newMessages];
                this.pageIndex++;
            }
        });
    }

    sendMessage() {
        console.log(this.message());
        if (this.message() != null && this.message() != '') {
            this.messages.push(this.message() as Message);
            var event: Message = {
                conversationId: this.activeConversation.id,
                messageId: crypto.randomUUID(),
                senderId: this.currentUserId,
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
        }
    }

    formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    recievedEvent() {
        // New message received
        this.subscriptions.add(
            this.ws.newMessage$.subscribe(message => {
                this.messages.push(message);
                // Auto mark as delivered
                this.ws.markDelivered(message.id!, message.conversationId);
            })
        );

        // Message sent confirmation
        this.subscriptions.add(
            this.ws.messageSent$.subscribe(message => {
                // Update local message with server-assigned id and timestamp
                const index = this.messages.findIndex(m => m.messageId === message.messageId);
                if (index > -1) {
                    this.messages[index] = message;
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

export interface Participant {
    userId: string;
    username: string;
    joinedAt: string;
    role: 'admin' | 'member';
}

export interface LastMessage {
    content: string;
    senderUsername: string;
    timestamp: string;
}

export interface ConversationSettings {
    allowReactions: boolean;
    allowPinning: boolean;
    adminOnlyPost: boolean;
}

export interface Conversation {
    id: string;
    conversationType: 'group' | 'direct';
    participants: Participant[];
    conversationName: string;
    createdAt: string;
    lastMessageAt: string;
    lastMessage: LastMessage;
    isActive: boolean;
    settings: ConversationSettings;
}