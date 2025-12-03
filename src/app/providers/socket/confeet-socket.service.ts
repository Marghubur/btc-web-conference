import { Injectable, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { User } from '../model';

@Injectable({
    providedIn: 'root',
})
export class ConfeetSocketService implements OnDestroy {
    private ws: WebSocket | null = null;
    private reconnectInterval = 3000;

    public messages$ = new Subject<any>();

    private userId!: string;
    private channelId!: string;
    private url!: string;
    private user: User = {
        isMicOn: false,
        isCameraOn: false,
    };

    constructor() {}

    connect(url: string, userId: string, channelId: string) {
        this.url = url;
        this.userId = userId;
        this.channelId = channelId;

        if (this.ws) return;

        this.initSocket();
    }

    private initSocket() {
        this.ws = new WebSocket(`${this.url}?userId=${this.userId}&channelId=${this.channelId}`);

        this.ws.onopen = () => {
            console.log('WS connected');
        };

        this.ws.onmessage = (event) => {
            this.messages$.next(JSON.parse(event.data));
        };

        this.ws.onerror = () => {
            console.error('WS error');
        };

        this.ws.onclose = () => {
            console.warn('WS closed, reconnecting...');
            this.ws = null;

            setTimeout(() => this.initSocket(), this.reconnectInterval);
        };
    }

    send(data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    ngOnDestroy() {
        this.ws?.close();
    }
}
