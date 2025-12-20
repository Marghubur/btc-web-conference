import { Component, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResponseModel, User } from '../providers/model';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';
import { environment } from '../../environments/environment';
import { ConfeetSocketService, Message } from '../providers/socket/confeet-socket.service';
import { Subscription } from 'rxjs';
import { Conversation, Participant, UserDetail } from '../components/global-search/search.models';
import { ChatService } from './chat.service';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, AfterViewChecked {
    @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

    // Local state managed by signals in service
    // meetingRooms and searchResults delegated to service
    isPageReady: boolean = false;
    today: Date = new Date();
    message: any = signal<string | null>('');
    // messages delegated to service
    pageIndex: number = 1;
    recieverId?: string = null;
    filterModal: FilterModal = { pageIndex: 1, pageSize: 20, searchString: '1=1' };
    conn: any = null;
    user: User = {
        isMicOn: false,
        isCameraOn: false,
    };

    searchQuery: string = '';
    // searchResults delegated to service
    isSearching: boolean = false;

    typingUsers: Map<string, boolean> = new Map();
    private subscriptions = new Subscription();
    private shouldScrollToBottom = false;

    currentUserId: string = "";
    receiver: Conversation = null;

    readonly destroyRef = inject(DestroyRef);

    constructor(
        private local: LocalService,
        private ws: ConfeetSocketService,
        public chatService: ChatService
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

        this.registerEvents();

        // Listen for global search selections
        this.subscriptions.add(
            this.chatService.openChat$.subscribe((user: any) => {
                this.startChatWithUser(user);
            })
        );

        this.getConversations();
        this.isPageReady = true;
    }

    socketHandShake() {
        var socketEndPoint = `${environment.socketBaseUrl}/${environment.socketHandshakEndpoint}`;
        this.ws.connect(socketEndPoint, this.user.userId, '675459a1b1c2d3e4f5a6b7c1');
    }

    getConversations() {
        this.chatService.getMeetingRooms();
        // State handling for navigation is tricker without the direct promise return
        // We can check the signal effect or assume it loads.
        // For the navigation state check, we can check the signal value immediately if loaded, 
        // or effectively we should move this logic to a computed or effect, or just check after a small delay if strict async is needed.
        // However, since getMeetingRooms awaits, we can just await if we make this async, or use .then() on the void promise if we want.
        // But better pattern:
        // Just call it.
    }

    getCurrentInitiaLetter(conversation: Conversation): string {
        return this.chatService.getCurrentInitiaLetter(conversation, this.currentUserId);
    }

    getConversationName(conversation: Conversation): string {
        return this.chatService.getConversationName(conversation, this.currentUserId);
    }

    getUserInitiaLetter(fname: string, lname: string): string {
        return this.chatService.getUserInitiaLetter(fname, lname);
    }

    getColorFromName(fname: string, lname: string): string {
        return this.chatService.getColorFromName(fname, lname);
    }

    onSearch() {
        if (!this.searchQuery || this.searchQuery.length < 2) {
            this.chatService.searchResults.set([]);
            return;
        }

        this.isSearching = true;
        this.isSearching = true;
        this.chatService.searchUsers(this.searchQuery).then(() => {
            this.isSearching = false;
        });
    }

    isConversation(obj: UserDetail | Conversation): obj is Conversation {
        return (obj as Conversation).conversationType !== undefined;
    }

    isUserDetail(obj: UserDetail | Conversation): obj is UserDetail {
        return (obj as UserDetail).userId !== undefined;
    }

    startChatWithUser(selectedUser: UserDetail | Conversation) {
        if (this.isUserDetail(selectedUser)) {
            this.enableNewConversation(selectedUser as UserDetail);
        } else {
            this.enableConversation(selectedUser as Conversation);
        }
    }

    enableConversation(conversation: Conversation) {
        // Check if conversation exists
        conversation.conversationType = 'group';
        const existing = this.chatService.meetingRooms().findIndex(x => x.id === conversation.id);
        if (existing > -1) {
            this.selectUser(this.chatService.meetingRooms()[existing]);
        } else {
            console.log("Starting new chat with", conversation);
            this.chatService.meetingRooms.update(rooms => [conversation, ...rooms]);
            this.selectUser(conversation);
        }

        this.searchQuery = '';
        this.chatService.searchResults.set([]);
    }

    enableNewConversation(selectedUser: UserDetail) {
        // Check if conversation exists
        const existing = this.chatService.meetingRooms().findIndex(x =>
            x.participantIds.findIndex(y => y === selectedUser.userId) > -1 &&
            x.participantIds.findIndex(y => y === this.currentUserId) > -1 &&
            x.participantIds.length == 2
        );

        if (existing > -1) {
            this.selectUser(this.chatService.meetingRooms()[existing]);
        } else {
            console.log("Starting new chat with", selectedUser);
            let newConversation: Conversation = {
                id: null,
                conversationId: null,
                conversationType: 'direct',
                conversationName: selectedUser.username,
                conversationAvatar: selectedUser.avatar,
                participantIds: [selectedUser.userId, this.currentUserId],
                participants: [
                    <Participant>{
                        userId: selectedUser.userId,
                        username: selectedUser.username,
                        firstName: selectedUser.firstName,
                        lastName: selectedUser.lastName,
                        email: selectedUser.email,
                        avatar: selectedUser.avatar,
                        joinedAt: new Date(),
                        role: 'user'
                    },
                    <Participant>{
                        userId: this.user.userId,
                        username: "",
                        firstName: this.user.firstName,
                        lastName: this.user.lastName,
                        email: this.user.email,
                        avatar: "",
                        joinedAt: new Date(),
                        role: 'user'
                    }
                ],
                createdBy: this.currentUserId,
                createdAt: new Date(),
                updatedAt: null,
                lastMessageAt: null,
                lastMessage: null,
                settings: null,
                isActive: true
            }

            this.chatService.meetingRooms.update(rooms => [newConversation, ...rooms]);
            this.selectUser(newConversation);
        }

        this.searchQuery = '';
        this.chatService.searchResults.set([]);
    }

    selectUser(conversation: Conversation) {
        // this.recieverId = conversation.id;
        this.receiver = conversation;
        this.pageIndex = 1;
        this.chatService.messages.set([]); // Clear existing messages
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
        if (!this.receiver) return;

        this.chatService.getMessages(this.receiver.id ?? '', this.pageIndex, 20, this.pageIndex > 1).then(() => {
            this.pageIndex++;
            if (scrollToBottom) {
                this.shouldScrollToBottom = true;
            }
        });
    }

    sendMessage() {
        if (this.receiver.conversationAvatar == null) {
            // call java to insert or create conversation channel
            this.chatService.createConversation(this.currentUserId, this.receiver).then((res: any) => {
                console.log("channel created", res);
                this.send(res);
            });
        } else {
            this.send(this.receiver);
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

            this.chatService.messages.update(msgs => [...msgs, event]);
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

    registerEvents() {
        // New message received
        this.subscriptions.add(
            this.ws.newMessage$.subscribe(message => {
                this.chatService.messages.update(msgs => [...msgs, message]);
                // Auto mark as delivered
                this.ws.markDelivered(message.id!, message.conversationId);
                this.shouldScrollToBottom = true; // Scroll to bottom on new message
            })
        );

        // Message sent confirmation
        this.subscriptions.add(
            this.ws.messageSent$.subscribe(message => {
                // Update local message with server-assigned id and timestamp
                const index = this.chatService.messages().findIndex(m => m.messageId === message.messageId);
                if (index > -1) {
                    this.chatService.messages.update(msgs => {
                        msgs[index] = message;
                        return [...msgs];
                    });
                } else {
                    this.chatService.messages.update(msgs => [...msgs, message]);
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
        const message = this.chatService.messages().find(m => m.id === messageId);
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
