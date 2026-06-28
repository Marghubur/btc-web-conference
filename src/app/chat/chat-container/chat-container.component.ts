import { Component, inject, Input, signal, ViewChild, ElementRef, AfterViewChecked, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfeetSocketService } from '../../providers/socket/confeet-socket.service';
import { ChatService } from '../chat.service';
import { LocalService } from '../../providers/services/local.service';
import { InitiateAudioCallService } from '../../providers/socket/client-events/call/initiate-audio-call.service';
import { NotifyGroupCreatedService } from '../../providers/socket/client-events/group/notify-group-created.service';
import { Conversation, Participant, SearchResult } from '../../components/global-search/search.models';
import { ResponseModel, User } from '../../models/model';
import { CallType } from '../../models/conference_call/call_model';

@Component({
  selector: 'app-chat-container',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-container.component.html',
  styleUrl: './chat-container.component.css'
})
export class ChatContainerComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @Input() header: boolean = false;
  @Input() classes: string = '';

  ws = inject(ConfeetSocketService);
  chatService = inject(ChatService);
  private local = inject(LocalService);
  private router = inject(Router);
  private initiateAudioCallService = inject(InitiateAudioCallService);
  private notifyGroupCreatedService = inject(NotifyGroupCreatedService);

  // User data
  user: User = {
    isMicOn: false,
    isCameraOn: false,
  };
  currentUserId: string = "";

  // Message state
  message = signal<string | null>('');
  pageIndex: number = 1;
  private shouldScrollToBottom = false;
  private shouldPreserveScrollPosition = false;
  private previousScrollHeight = 0;
  private lastMessageId?: string;

  // Members dropdown state
  showMembersDropdown: boolean = false;
  showCreateGroupInput: boolean = false;
  newGroupName: string = '';
  newGroupMembers: SearchResult[] = [];
  memberSearchQuery: string = '';
  memberSearchResults: SearchResult[] = [];
  memberSearchSelectedIndex: number = -1;

  // Header status popover (top-right avatar in chat header)
  showHeaderStatusPopover: boolean = false;
  headerPopoverTop: number = 0;
  headerPopoverLeft: number = 0;
  headerUserStatus: 'available' | 'busy' | 'dnd' | 'away' | 'offline' = 'available';
  headerStatusMessage: string = '';
  headerEditingStatusMessage: boolean = false;
  headerTempStatusMessage: string = '';

  readonly statusOptions = [
    { value: 'available', label: 'Available', color: '#92c353' },
    { value: 'busy', label: 'Busy', color: '#c4314b' },
    { value: 'dnd', label: 'Do not disturb', color: '#c4314b' },
    { value: 'away', label: 'Be right back', color: '#f8d22a' },
    { value: 'offline', label: 'Appear offline', color: '#8a8886' },
  ] as const;

  constructor() {
    this.user = this.local.getUser();
    this.currentUserId = this.user.userId;

    // React to conversation changes and load messages
    effect(() => {
      const conversation = this.ws.currentConversation();
      if (conversation && conversation.id) {
        // Reset page index and load first page of messages
        this.pageIndex = 1;
        this.lastMessageId = undefined; // Reset tracking
        this.loadMoreMessages(true); // true = scroll to bottom
        this.chatService.setIsChatStatus(true, 'Chat container');
      }
    }, { allowSignalWrites: true });

    // React to new incoming messages to auto-scroll
    effect(() => {
      const msgs = this.chatService.messages();
      if (msgs && msgs.length > 0) {
        const latestMsg = msgs[msgs.length - 1];
        const currentLastId = latestMsg.id || latestMsg.messageId;
        
        if (this.lastMessageId !== currentLastId) {
          this.lastMessageId = currentLastId;
          this.shouldScrollToBottom = true;
          // Fallback to ensure scroll happens after DOM updates
          setTimeout(() => this.scrollToBottom(), 50);
        }
      } else {
        this.lastMessageId = undefined;
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

  // Helper methods
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

  getConversationAvatar(conversation: Conversation): string {
    if (!conversation) return '';
    if (conversation.conversationType === 'group') {
      return conversation.conversationAvatar || '';
    }
    const participants = (conversation.participants || []).filter(p => p && p.userId !== this.currentUserId);
    if (participants.length > 0 && participants[0].avatar) {
      return participants[0].avatar;
    }
    return conversation.conversationAvatar || '';
  }

  getDirectUserStatus(conversation: Conversation): string {
    if (!conversation || conversation.conversationType === 'group') return '';
    const participants = (conversation.participants || []).filter(p => p && p.userId !== this.currentUserId);
    if (participants.length > 0) {
      return (participants[0].status || 'offline').toLowerCase();
    }
    return 'offline';
  }

  getDirectUserStatusColor(conversation: Conversation): string {
    const status = this.getDirectUserStatus(conversation);
    switch (status) {
      case 'available':
      case 'online':
        return '#34A853'; // Google Green
      case 'busy':
      case 'dnd':
        return '#EA4335'; // Google Red
      case 'away':
      case 'brb':
        return '#FBBC05'; // Google Yellow
      default:
        return '#9AA0A6'; // Google Gray
    }
  }

  getNormalizedStatus(statusInput: string): string {
    const s = (statusInput || '').toLowerCase();
    if (s === 'available' || s === 'online') return 'online';
    if (s === 'busy' || s === 'dnd') return 'busy';
    return 'offline';
  }

  getDirectUserStatusLabel(conversation: Conversation): string {
    const status = this.getDirectUserStatus(conversation);
    switch (status) {
      case 'available':
      case 'online':
        return 'Available';
      case 'busy':
      case 'dnd':
        return 'Do not disturb';
      case 'away':
      case 'brb':
        return 'Away';
      default:
        return 'Offline';
    }
  }

  failedAvatars = new Set<string>();

  onAvatarError(url: string | null | undefined): void {
    if (url) {
      this.failedAvatars.add(url);
    }
  }

  shouldShowDateSeparator(index: number): boolean {
    const messages = this.chatService.messages();
    if (!messages || !messages[index]) return false;

    if (index === 0) {
      return true;
    }

    const currentMsgDate = new Date(messages[index].createdAt || Date.now());
    const prevMsgDate = new Date(messages[index - 1].createdAt || Date.now());

    const isSameDayAsPrev = currentMsgDate.getDate() === prevMsgDate.getDate() &&
                            currentMsgDate.getMonth() === prevMsgDate.getMonth() &&
                            currentMsgDate.getFullYear() === prevMsgDate.getFullYear();

    return !isSameDayAsPrev;
  }

  getDateSeparatorText(dateInput: any): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const today = new Date();

    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();

    if (isToday) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  getSenderAvatar(senderId: string): string {
    if (!senderId || senderId === this.currentUserId) return '';
    const p = (this.ws.currentConversation()?.participants || []).find(part => part.userId === senderId);
    return p?.avatar || '';
  }

  getSenderName(senderId: string): string {
    if (!senderId) return 'Unknown';
    if (senderId === this.currentUserId) return 'You';
    const p = (this.ws.currentConversation()?.participants || []).find(part => part.userId === senderId);
    if (p) return `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || 'Member';
    return 'Member';
  }

  quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  hoveredMsgIndex: number | null = null;

  reactToMessage(msg: any, emoji: string): void {
    if (!msg.reactions) {
      msg.reactions = [];
    }
    const existingIndex = msg.reactions.findIndex((r: any) => r.userId === this.currentUserId);
    if (existingIndex > -1) {
      if (msg.reactions[existingIndex].emoji === emoji) {
        msg.reactions.splice(existingIndex, 1);
      } else {
        msg.reactions[existingIndex].emoji = emoji;
      }
    } else {
      msg.reactions.push({
        userId: this.currentUserId,
        emoji: emoji
      });
    }
    this.chatService.messages.update(msgs => [...msgs]);
  }

  getUniqueReactions(reactions: any[]): { emoji: string; count: number; hasUserReacted: boolean }[] {
    if (!reactions || !Array.isArray(reactions)) return [];
    const counts = new Map<string, { count: number; hasUserReacted: boolean }>();
    for (const r of reactions) {
      if (!r || !r.emoji) continue;
      const current = counts.get(r.emoji) || { count: 0, hasUserReacted: false };
      current.count += 1;
      if (r.userId === this.currentUserId) {
        current.hasUserReacted = true;
      }
      counts.set(r.emoji, current);
    }
    return Array.from(counts.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasUserReacted: data.hasUserReacted
    }));
  }

  // Audio call
  startAudioCall() {
    this.initiateAudioCallService.execute(this.currentUserId, this.ws.currentConversation().id);
    this.router.navigate(['/btc/preview'], {
      state: {
        id: this.ws.currentConversation().id,
        type: CallType.AUDIO,
        title: this.ws.currentConversation().conversationName ? this.ws.currentConversation().conversationName : 'NEW'
      }
    });
  }

  // Members Dropdown Methods
  toggleMembersDropdown(): void {
    this.showMembersDropdown = !this.showMembersDropdown;
    if (!this.showMembersDropdown) {
      this.cancelCreateGroup();
    }
  }

  cancelCreateGroup(): void {
    this.showCreateGroupInput = false;
    this.newGroupName = '';
    this.newGroupMembers = [];
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
  }

  // Header Status Popover Methods
  private headerPopoverCloseHandler = () => {
    this.showHeaderStatusPopover = false;
    this.headerEditingStatusMessage = false;
    document.removeEventListener('click', this.headerPopoverCloseHandler);
  };

  toggleHeaderStatusPopover(event: Event): void {
    event.stopPropagation();
    this.showHeaderStatusPopover = !this.showHeaderStatusPopover;
    if (this.showHeaderStatusPopover) {
      this.headerTempStatusMessage = this.headerStatusMessage;
      this.headerEditingStatusMessage = false;
      // Compute fixed position below and to the right of the avatar
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.headerPopoverTop = rect.bottom + 6;
      this.headerPopoverLeft = rect.right - 280; // 280 = popover width, align right edge
      setTimeout(() => {
        document.addEventListener('click', this.headerPopoverCloseHandler);
      }, 0);
    } else {
      document.removeEventListener('click', this.headerPopoverCloseHandler);
    }
  }

  stopHeaderPopoverPropagation(event: Event): void {
    event.stopPropagation();
  }

  setHeaderUserStatus(status: 'available' | 'busy' | 'dnd' | 'away' | 'offline'): void {
    this.headerUserStatus = status;
  }

  getHeaderStatusColor(): string {
    return this.statusOptions.find(s => s.value === this.headerUserStatus)?.color ?? '#92c353';
  }

  getHeaderStatusLabel(): string {
    return this.statusOptions.find(s => s.value === this.headerUserStatus)?.label ?? 'Available';
  }

  startHeaderEditingStatusMessage(): void {
    this.headerEditingStatusMessage = true;
    this.headerTempStatusMessage = this.headerStatusMessage;
  }

  saveHeaderStatusMessage(): void {
    this.headerStatusMessage = this.headerTempStatusMessage;
    this.headerEditingStatusMessage = false;
  }

  cancelHeaderStatusMessage(): void {
    this.headerTempStatusMessage = this.headerStatusMessage;
    this.headerEditingStatusMessage = false;
  }

  getDefaultGroupName(): string {
    const participants = this.ws.currentConversation()?.participants || [];
    if (participants.length === 0) return 'New Group';

    // Get first two names
    const names = participants.slice(0, 2).map(p => p.firstName);
    const othersCount = participants.length + this.newGroupMembers.length - 2;

    if (othersCount > 0) {
      return `${names.join(', ')} +${othersCount} others`;
    }
    return names.join(', ');
  }

  onMemberSearch(): void {
    this.memberSearchSelectedIndex = -1; // Reset selection on new search
    if (!this.memberSearchQuery || this.memberSearchQuery.length < 2) {
      this.memberSearchResults = [];
      return;
    }

    // Use the existing search functionality
    this.chatService.searchUsers(this.memberSearchQuery).then(() => {
      let participants: Participant[] = [];
      if (this.ws.currentConversation() && this.ws.currentConversation().participants.length > 0) {
        participants = this.ws.currentConversation().participants;
      }

      // Filter out members who are already in the group
      const existingIds = [
        ...participants.map(p => p.userId),
        ...this.newGroupMembers.map(m => m.userId)
      ];
      this.memberSearchResults = this.chatService.searchResults()
        .filter(user => !existingIds.includes(user.userId));
    });
  }

  onMemberSearchKeydown(event: KeyboardEvent): void {
    const total = this.memberSearchResults.length;
    if (total === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.memberSearchSelectedIndex = Math.min(this.memberSearchSelectedIndex + 1, total - 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.memberSearchSelectedIndex = Math.max(this.memberSearchSelectedIndex - 1, -1);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.memberSearchSelectedIndex >= 0 && this.memberSearchSelectedIndex < total) {
          this.addMemberToGroup(this.memberSearchResults[this.memberSearchSelectedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.memberSearchQuery = '';
        this.memberSearchResults = [];
        this.memberSearchSelectedIndex = -1;
        break;
    }
  }

  addMemberToGroup(member: SearchResult): void {
    // Check if already added
    if (!this.newGroupMembers.find(m => m.conversationId === member.conversationId)) {
      this.newGroupMembers.push(member);
    }
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
    this.memberSearchSelectedIndex = -1;
  }

  removeNewGroupMember(member: SearchResult): void {
    this.newGroupMembers = this.newGroupMembers.filter(m => m.conversationId !== member.conversationId);
  }

  createGroup(): void {
    const groupName = this.newGroupName.trim() || this.getDefaultGroupName();
    const newGroupMembers = this.newGroupMembers.reduce((acc, m) => [...acc, ...m.participants], []);

    let participants: Participant[] = [];
    if (this.ws.currentConversation() && this.ws.currentConversation().participants.length > 0) {
      participants = this.ws.currentConversation().participants;
    }

    const allMembers: Participant[] = [
      ...participants,
      ...newGroupMembers
    ];

    // Call API to create group
    this.chatService.createGroupConversation(this.currentUserId, groupName, this.ws.currentConversationId(), allMembers).then((res: ResponseModel) => {
      // Reset state
      if (res.isSuccess && res.responseBody) {
        this.notifyGroupCreatedService.execute(res.responseBody.id, this.currentUserId);
        this.cancelCreateGroup();
        this.showMembersDropdown = false;
      } else {
        alert("Failed to create group error: " + res.responseBody.responseBody);
      }
    });
  }

  // Message methods
  onScroll(event: any) {
    const element = event.target;
    // Load more when scrolled to top (for loading older messages)
    if (element.scrollTop === 0) {
      this.loadMoreMessages(false);
    }
  }

  loadMoreMessages(scrollToBottom: boolean = false) {
    if (!this.ws.currentConversation()) return;

    // Save current scroll height before loading older messages
    if (!scrollToBottom && this.messagesContainer) {
      this.previousScrollHeight = this.messagesContainer.nativeElement.scrollHeight;
    }

    this.chatService.getMessages(this.ws.currentConversation().id ?? '', this.pageIndex, 20, this.pageIndex > 1).then(() => {
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
    if (this.ws.currentConversation().id == null) {
      // call java to insert or create conversation channel
      this.chatService.createConversation(this.currentUserId, this.ws.currentConversation()).then((res: any) => {
        console.log("channel created", res);
        this.send(res);
      });
    } else {
      this.send(this.ws.currentConversation());
    }
  }

  private send(response: any) {
    if (this.message() != null && this.message() != '' && response.id != null) {
      var event: any = {
        conversationId: response.id,
        messageId: crypto.randomUUID(),
        senderId: this.currentUserId,
        recievedId: null,
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
}
