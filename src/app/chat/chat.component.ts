import { Component, DestroyRef, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';
import { ConfeetSocketService, Message } from '../providers/socket/confeet-socket.service';
import { Subscription } from 'rxjs';
import { Conversation, Participant, UserDetail } from '../components/global-search/search.models';
import { ChatService } from './chat.service';
import { Router } from '@angular/router';
import { User } from '../models/model';
import { CallEventService } from '../providers/socket/call-event.service';
import { NotificationService } from '../notifications/services/notification.service';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {
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

    // typingUsers now comes from NotificationService
    private subscriptions = new Subscription();
    private shouldScrollToBottom = false;
    private shouldPreserveScrollPosition = false;
    private previousScrollHeight = 0;

    currentUserId: string = "";
    currentConversation: Conversation = null;

    readonly destroyRef = inject(DestroyRef);

    constructor(
        private local: LocalService,
        private ws: ConfeetSocketService,
        public chatService: ChatService,
        private router: Router,
        public notificationService: NotificationService,
        private callEventService: CallEventService
    ) {
        // React to new messages by scrolling to bottom
        effect(() => {
            const messages = this.chatService.messages();
            if (messages.length > 0 && this.pageIndex === 1) {
                this.shouldScrollToBottom = true;
            }
        });
    }

    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }

        // Preserve scroll position when older messages are prepended
        if (this.shouldPreserveScrollPosition && this.messagesContainer) {
            const container = this.messagesContainer.nativeElement;
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - this.previousScrollHeight;
            container.scrollTop = scrollDiff;
            this.shouldPreserveScrollPosition = false;
        }
    }

    ngOnInit() {
        this.user = this.local.getUser();
        this.currentUserId = this.user.userId;

        // Listen for global search selections
        this.subscriptions.add(
            this.chatService.openChat$.subscribe((user: any) => {
                this.startConversation(user);
            })
        );

        this.getConversations();

        var navigation = this.router.getCurrentNavigation();
        if (navigation?.extras.state?.['channel']) {
            this.startConversation(navigation?.extras.state['channel']);
        } else if (navigation?.extras.state?.['id']) {
            const conversationId = navigation?.extras.state['id'];
        }

        this.isPageReady = true;
    }

    // Get typingUsers from NotificationService
    get typingUsers(): Map<string, boolean> {
        return this.notificationService.typingUsers();
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

    isGroupConversation(obj: UserDetail | Conversation): obj is Conversation {
        return (obj as Conversation).conversationType === 'group';
    }

    startConversation(selectedConversation: UserDetail | Conversation) {
        if (this.isGroupConversation(selectedConversation)) {
            this.enableConversation(selectedConversation as Conversation);
        } else {
            this.enableNewConversation(selectedConversation as UserDetail);
        }
    }

    enableConversation(conversation: Conversation) {
        // Check if conversation exists
        conversation.conversationType = 'group';
        const existing = this.chatService.meetingRooms().findIndex(x => x.id === conversation.id);
        if (existing > -1) {
            this.selectChannelForConversation(this.chatService.meetingRooms()[existing]);
        } else {
            console.log("Starting new chat with", conversation);
            this.chatService.meetingRooms.update(rooms => [conversation, ...rooms]);
            this.selectChannelForConversation(conversation);
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
            this.selectChannelForConversation(this.chatService.meetingRooms()[existing]);
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
            this.selectChannelForConversation(newConversation);
        }

        this.searchQuery = '';
        this.chatService.searchResults.set([]);
    }

    selectChannelForConversation(conversation: Conversation) {
        this.currentConversation = conversation;
        this.pageIndex = 1;
        this.chatService.messages.set([]); // Clear existing messages

        // Notify the NotificationService which conversation is now active
        this.notificationService.setActiveConversation(conversation.id);

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
        if (!this.currentConversation) return;

        // Save current scroll height before loading older messages
        if (!scrollToBottom && this.messagesContainer) {
            this.previousScrollHeight = this.messagesContainer.nativeElement.scrollHeight;
        }

        this.chatService.getMessages(this.currentConversation.id ?? '', this.pageIndex, 20, this.pageIndex > 1).then(() => {
            this.pageIndex = this.pageIndex + 1;
            if (scrollToBottom) {
                this.shouldScrollToBottom = true;
            } else {
                // Flag to preserve scroll position for older messages
                this.shouldPreserveScrollPosition = true;
            }
        });
    }

    sendMessage() {
        if (this.currentConversation.id == null) {
            // call java to insert or create conversation channel
            this.chatService.createConversation(this.currentUserId, this.currentConversation).then((res: any) => {
                console.log("channel created", res);
                this.send(res);
            });
        } else {
            this.send(this.currentConversation);
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

    onTyping(isTyping: boolean): void {
        if (this.currentConversation?.id) {
            this.ws.sendTyping(this.currentConversation.id, isTyping);
        }
    }

    markAsSeen(messageId: string, conversationId: string): void {
        this.ws.markSeen(messageId, this.currentUserId, conversationId);
    }

    startAudioCall() {
        this.callEventService.initiateAudioCall(this.currentUserId, this.currentConversation.id);
        this.router.navigate(['/btc/preview'], {
            state: {
                id: this.currentConversation.id,
                title: this.currentConversation.conversationName ? this.currentConversation.conversationName : 'NEW'
            }
        });
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        // Clear active conversation when leaving chat page
        this.notificationService.setActiveConversation(null);
    }
}

export interface FilterModal {
    searchString: string;
    sortBy?: string;
    pageIndex: number;
    pageSize: number;
}
