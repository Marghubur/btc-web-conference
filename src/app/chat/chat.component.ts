import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { AjaxService } from '../providers/services/ajax.service';
import { User } from '../providers/model';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { LocalService } from '../providers/services/local.service';
import { environment } from '../../environments/environment';
import { ConfeetSocketService } from '../providers/socket/confeet-socket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    alluser: Array<User> = [];
    isPageReady: boolean = false;
    today: Date = new Date();
    message: any = signal<string | null>('');
    filterModal: FilterModal = { pageIndex: 1, pageSize: 20, searchString: '1=1' };
    conn: any = null;
    user: User = {
        isMicOn: false,
        isCameraOn: false,
    };

    currentUserId: string = null;
    chatMessages = signal<MessageEvent[]>([]);

    readonly destroyRef = inject(DestroyRef);

    constructor(private http: AjaxService, private local: LocalService, private ws: ConfeetSocketService) {}

    ngOnInit() {
        this.user = this.local.getUser();
        this.currentUserId = `user-${this.user.userId}`;
        this.alluser.push(this.user);
        this.socketHandShake();

        this.recievedEvent();

        this.isPageReady = true;
    }

    socketHandShake() {
        var socketEndPoint = `${environment.socketBaseUrl}/${environment.socketHandshakEndpoint}`;
        console.log(socketEndPoint);
        this.ws.connect(socketEndPoint, this.user.userId.toString(), 'ctx-ab0-kujd0');
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

    selectUser(user: User) {
        this.user = user;
    }

    sendMessage() {
        console.log(this.message());
        if (this.message() != null && this.message() != '') {
            this.sendEvent(this.message());
        }

        this.message.set('');
    }

    recievedEvent() {
        this.ws.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((msg: MessageEvent) => {
            console.log('Received:', msg);

            switch (msg.event) {
                // 1️⃣ NEW MESSAGE
                case 'client_message':
                    this.chatMessages.update((old) => [...old, msg]);
                    break;

                // 2️⃣ MESSAGE DELIVERED UPDATE
                case 'server_message':
                    this.updateMessageStatus(msg.messageId, 1);
                    break;

                // 3️⃣ MESSAGE SEEN UPDATE
                case 'message_seen':
                    this.updateMessageStatus(msg.messageId, 2);
                    break;

                default:
                    console.warn('Unknown event:', msg.event);
                    break;
            }
        });
    }

    updateMessageStatus(messageId: string, status: 1 | 2) {
        this.chatMessages.update((current) =>
            current.map((ev) => {
                if (ev.messageId === messageId) {
                    return {
                        ...ev,
                        message: { ...ev.message, status },
                    };
                }
                return ev;
            })
        );
    }

    sendEvent(payload: any) {
        var event: MessageEvent = {
            event: 'client_message',
            requestId: crypto.randomUUID(),
            messageId: crypto.randomUUID(),
            message: {
                channelId: 'ch-121',
                senderId: this.currentUserId,
                type: 'text',
                body: payload,
                fileLink: null,
                timestamp: Date.now(),
                status: 0,
                metadata: {
                    replyTo: null,
                    mentions: [],
                    clientType: 'web',
                },
            },
        };

        this.chatMessages.update((old) => [...old, event]);
        // const data = JSON.stringify(event);
        this.ws.send(event);
    }

    formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
}

export interface FilterModal {
    searchString: string;
    sortBy?: string;
    pageIndex: number;
    pageSize: number;
}

export interface MessageEvent {
    event: string; // "client_message"
    requestId: string; // uuid
    message: ChatMessage;
    messageId: string;
}

export interface ChatMessage {
    channelId: string;
    senderId: string;
    type: 'text' | 'audio' | 'video' | 'image' | 'file';
    body: string | null;
    fileLink: string | null;
    metadata: ChatMetadata;
    status: number; //  <-- ADD THIS
    timestamp: number;
}

export interface ChatMetadata {
    replyTo: string | null;
    mentions: string[];
    clientType: 'web' | 'android' | 'ios' | 'desktop';
}
