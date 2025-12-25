import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AppNotification } from '../../providers/services/notification.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-toast-notification',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="toast-container">
            @for (toast of visibleToasts(); track toast.id) {
                <div class="toast-notification" 
                     [class.toast-error]="toast.type === 'error'"
                     [class.toast-message]="toast.type === 'message'"
                     (click)="onToastClick(toast)">
                    <div class="toast-header">
                        <span class="toast-icon">
                            @if (toast.type === 'message') {
                                💬
                            } @else if (toast.type === 'error') {
                                ⚠️
                            } @else {
                                🔔
                            }
                        </span>
                        <span class="toast-title">{{ toast.title }}</span>
                        <button class="toast-close" (click)="dismiss(toast, $event)">×</button>
                    </div>
                    <div class="toast-body">{{ toast.body | slice:0:100 }}{{ toast.body.length > 100 ? '...' : '' }}</div>
                    <div class="toast-time">{{ getTimeAgo(toast.timestamp) }}</div>
                </div>
            }
        </div>
    `,
    styles: [`
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column-reverse;
            gap: 10px;
            max-height: 400px;
            overflow: hidden;
            pointer-events: none;
        }

        .toast-notification {
            pointer-events: auto;
            min-width: 320px;
            max-width: 400px;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
                        0 0 0 1px rgba(255, 255, 255, 0.1);
            padding: 14px 16px;
            cursor: pointer;
            animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-in 4.7s forwards;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            backdrop-filter: blur(10px);
        }

        .toast-notification:hover {
            transform: translateX(-5px) scale(1.02);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5),
                        0 0 0 1px rgba(99, 102, 241, 0.3);
            animation-play-state: paused;
        }

        .toast-message {
            border-left: 4px solid #6366f1;
        }

        .toast-error {
            border-left: 4px solid #ef4444;
            background: linear-gradient(135deg, #2e1e1e 0%, #442d2d 100%);
        }

        .toast-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .toast-icon {
            font-size: 18px;
        }

        .toast-title {
            flex: 1;
            font-weight: 600;
            color: #fff;
            font-size: 14px;
        }

        .toast-close {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            transition: color 0.2s ease;
        }

        .toast-close:hover {
            color: #fff;
        }

        .toast-body {
            color: rgba(255, 255, 255, 0.85);
            font-size: 13px;
            line-height: 1.4;
            word-break: break-word;
        }

        .toast-time {
            color: rgba(255, 255, 255, 0.4);
            font-size: 11px;
            margin-top: 8px;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
    `]
})
export class ToastNotificationComponent {
    private notificationService = inject(NotificationService);
    private router = inject(Router);

    // Show only last 3 notifications
    visibleToasts = computed(() => {
        return this.notificationService.notifications()
            .filter(n => !n.read)
            .slice(0, 3);
    });

    onToastClick(toast: AppNotification): void {
        // Mark as read
        this.notificationService.clearNotification(toast.id);

        // Navigate to chat if it's a message notification
        if (toast.type === 'message' && toast.conversationId) {
            this.router.navigate(['/btc/chat'], {
                queryParams: { conversationId: toast.conversationId }
            });
        }
    }

    dismiss(toast: AppNotification, event: Event): void {
        event.stopPropagation();
        this.notificationService.clearNotification(toast.id);
    }

    getTimeAgo(timestamp: Date): string {
        const now = new Date();
        const diff = Math.floor((now.getTime() - new Date(timestamp).getTime()) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }
}
