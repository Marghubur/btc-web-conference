import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallEventService } from '../../providers/socket/call-event.service';
import { CallType } from '../../models/conference_call/call_model';
import { Router } from '@angular/router';
import { ConfeetSocketService } from '../../providers/socket/confeet-socket.service';

@Component({
    selector: 'app-incoming-call',
    standalone: true,
    imports: [CommonModule],
    template: `
        <!-- Incoming Call Notification (bottom-right, no overlay) -->
        @if (callEventService.hasIncomingCall()) {
            <div class="notification-container">
                <div class="incoming-call-card" [class.video-call]="isVideoCall()">
                    <!-- Animated rings -->
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring delay-1"></div>
                    <div class="pulse-ring delay-2"></div>
                    
                    <!-- Call type indicator -->
                    <div class="call-type-badge">
                        @if (isVideoCall()) {
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                            <span>Video Call</span>
                        } @else {
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>Audio Call</span>
                        }
                    </div>

                    <!-- Caller avatar -->
                    <div class="caller-avatar">
                        @if (incomingCall()?.callerAvatar) {
                            <img [src]="incomingCall()?.callerAvatar" alt="Caller">
                        } @else {
                            <div class="avatar-placeholder">
                                {{ getCallerInitial() }}
                            </div>
                        }
                    </div>

                    <!-- Caller info -->
                    <div class="caller-info">
                        <h3 class="caller-name">{{ getCallerName() }}</h3>
                        <p class="call-status">Incoming call...</p>
                    </div>

                    <!-- Timer -->
                    <div class="call-timer">{{ formatTime(callDuration()) }}</div>

                    <!-- Action buttons -->
                    <div class="call-actions">
                        <button class="action-btn decline" (click)="declineCall()" title="Decline">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M23 7c0 0-3.5-4-11-4S1 7 1 7v3c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V8s2.7-2 5-2 5 2 5 2v2c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V7z" transform="rotate(135 12 12)"/>
                            </svg>
                        </button>
                        <button class="action-btn accept" (click)="acceptCall()" title="Accept">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        }

        <!-- Join Call Notification (bottom-right, positioned above incoming call if both shown) -->
        @if (callEventService.hasJoiningRequest()) {
            <div class="notification-container join-request" [class.stacked]="callEventService.hasIncomingCall()">
                <div class="join-call-card">
                    <!-- Join icon with pulse -->
                    <div class="join-icon-container">
                        <div class="join-pulse-ring"></div>
                        <div class="join-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                    </div>

                    <!-- Call info -->
                    <div class="join-info">
                        <h4 class="join-title">Call in Progress</h4>
                        <p class="join-message">{{ getJoinCallerName() }} started a call</p>
                        <p class="join-subtext">You're invited to join</p>
                    </div>

                    <!-- Action buttons -->
                    <div class="join-actions">
                        <button class="join-btn dismiss" (click)="dismissJoinRequest()" title="Dismiss">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            <span>Dismiss</span>
                        </button>
                        <button class="join-btn join" (click)="joinCall()" title="Join Call">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>Join</span>
                        </button>
                    </div>
                </div>
            </div>
        }
    `,
    styles: [`
        /* Notification Container - positioned bottom-right */
        .notification-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            animation: slideInRight 0.4s ease-out;
        }

        .notification-container.join-request {
            bottom: 24px;
        }

        .notification-container.join-request.stacked {
            bottom: 340px; /* Stack above incoming call card */
        }

        /* ===============================================
           INCOMING CALL CARD STYLES
           =============================================== */
        .incoming-call-card {
            position: relative;
            width: 320px;
            padding: 32px 24px;
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
                        0 0 0 1px rgba(255, 255, 255, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .incoming-call-card.video-call {
            background: linear-gradient(145deg, #1a1a2e 0%, #2d1b4e 50%, #4a1d6e 100%);
        }

        /* Pulse animation rings */
        .pulse-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 100px;
            margin: -50px 0 0 -50px;
            border: 2px solid rgba(34, 197, 94, 0.4);
            border-radius: 50%;
            animation: pulse 2s ease-out infinite;
            pointer-events: none;
        }

        .pulse-ring.delay-1 {
            animation-delay: 0.5s;
        }

        .pulse-ring.delay-2 {
            animation-delay: 1s;
        }

        .video-call .pulse-ring {
            border-color: rgba(139, 92, 246, 0.4);
        }

        /* Call type badge */
        .call-type-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 11px;
            font-weight: 500;
            margin-bottom: 20px;
        }

        .call-type-badge svg {
            width: 12px;
            height: 12px;
        }

        /* Caller avatar */
        .caller-avatar {
            position: relative;
            width: 80px;
            height: 80px;
            margin-bottom: 16px;
            z-index: 1;
        }

        .caller-avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid rgba(255, 255, 255, 0.2);
        }

        .avatar-placeholder {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 600;
            color: white;
            text-transform: uppercase;
            border: 3px solid rgba(255, 255, 255, 0.2);
        }

        /* Caller info */
        .caller-info {
            text-align: center;
            margin-bottom: 12px;
        }

        .caller-name {
            color: #fff;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }

        .call-status {
            color: rgba(255, 255, 255, 0.6);
            font-size: 13px;
            margin: 0;
            animation: blink 1.5s ease-in-out infinite;
        }

        /* Timer */
        .call-timer {
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
            font-family: monospace;
            margin-bottom: 20px;
        }

        /* Action buttons */
        .call-actions {
            display: flex;
            gap: 32px;
        }

        .action-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .action-btn svg {
            width: 24px;
            height: 24px;
        }

        .action-btn.accept {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
            animation: wiggle 0.5s ease-in-out infinite;
        }

        .action-btn.accept:hover {
            transform: scale(1.1);
            box-shadow: 0 10px 30px rgba(34, 197, 94, 0.5);
        }

        .action-btn.decline {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }

        .action-btn.decline:hover {
            transform: scale(1.1);
            box-shadow: 0 10px 30px rgba(239, 68, 68, 0.5);
        }

        /* ===============================================
           JOIN CALL CARD STYLES
           =============================================== */
        .join-call-card {
            width: 320px;
            padding: 20px;
            background: linear-gradient(145deg, #0d1117 0%, #161b22 50%, #21262d 100%);
            border-radius: 16px;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35),
                        0 0 0 1px rgba(255, 255, 255, 0.08),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        /* Join icon */
        .join-icon-container {
            position: relative;
            width: 48px;
            height: 48px;
            align-self: center;
        }

        .join-pulse-ring {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 2px solid rgba(59, 130, 246, 0.4);
            border-radius: 50%;
            animation: joinPulse 2s ease-out infinite;
        }

        .join-icon {
            position: relative;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }

        .join-icon svg {
            width: 24px;
            height: 24px;
        }

        /* Join info */
        .join-info {
            text-align: center;
        }

        .join-title {
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }

        .join-message {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            margin: 0 0 2px 0;
        }

        .join-subtext {
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
            margin: 0;
        }

        /* Join action buttons */
        .join-actions {
            display: flex;
            gap: 12px;
        }

        .join-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .join-btn svg {
            width: 16px;
            height: 16px;
        }

        .join-btn.dismiss {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
        }

        .join-btn.dismiss:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-1px);
        }

        .join-btn.join {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
        }

        .join-btn.join:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(59, 130, 246, 0.45);
        }

        /* ===============================================
           ANIMATIONS
           =============================================== */
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
                opacity: 0.8;
            }
            100% {
                transform: scale(2);
                opacity: 0;
            }
        }

        @keyframes joinPulse {
            0% {
                transform: scale(1);
                opacity: 0.6;
            }
            100% {
                transform: scale(1.8);
                opacity: 0;
            }
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-5deg); }
            75% { transform: rotate(5deg); }
        }
    `]
})
export class IncomingCallComponent implements OnDestroy {
    callEventService = inject(CallEventService);
    ws = inject(ConfeetSocketService);
    private router = inject(Router);

    private ringtoneAudio: HTMLAudioElement | null = null;
    private timerInterval: any = null;

    callDuration = signal(0);

    incomingCall = () => this.callEventService.incomingCall();
    joiningRequest = () => this.callEventService.joiningRequest();

    constructor() {
        // Watch for incoming call changes with effect
        // allowSignalWrites: true is needed because startTimer writes to callDuration signal
        effect(() => {
            const hasIncoming = this.callEventService.hasIncomingCall();

            if (hasIncoming) {
                // Start ringtone and timer when incoming call starts
                this.startRingtone();
                this.startTimer();
            } else {
                // Stop ringtone and timer when call ends/dismissed
                this.stopRingtone();
                this.stopTimer();
            }
        }, { allowSignalWrites: true });
    }

    ngOnDestroy(): void {
        this.stopRingtone();
        this.stopTimer();
    }

    isVideoCall(): boolean {
        return this.incomingCall()?.callType === CallType.VIDEO;
    }

    getCallerName(): string {
        const call = this.incomingCall();
        return call?.callerName || call?.callerId || 'Unknown Caller';
    }

    getCallerInitial(): string {
        const name = this.getCallerName();
        return name.charAt(0).toUpperCase();
    }

    getJoinCallerName(): string {
        const request = this.joiningRequest();
        return request?.callerName || request?.callerId || 'Someone';
    }

    formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    acceptCall(): void {
        const call = this.incomingCall();
        if (call && call.conversationId) {
            this.ws.currentConversationId.set(call.conversationId);
            this.stopRingtone();
            this.stopTimer();
            this.callEventService.acceptCall(call.conversationId, call.callerId);
            this.router.navigate(['/btc/preview'], {
                state: {
                    id: call.conversationId,
                    type: call.callType || CallType.AUDIO,
                    title: call.callerName || 'NEW'
                }
            });
        }
    }

    joinCall(): void {
        const request = this.joiningRequest();
        if (request && request.conversationId) {
            this.ws.currentConversationId.set(request.conversationId);
            this.stopRingtone();
            this.stopTimer();
            this.callEventService.acceptJoiningRequest(request.conversationId, request.callerId);
            this.router.navigate(['/btc/preview'], {
                state: {
                    id: request.conversationId,
                    type: request.callType || CallType.AUDIO,
                    title: request.callerName || 'Call'
                }
            });
        }
    }

    declineCall(): void {
        const call = this.incomingCall();
        if (call) {
            this.stopRingtone();
            this.stopTimer();
            this.callEventService.rejectCall(call.conversationId, call.callerId, 'declined');
        }
    }

    dismissJoinRequest(): void {
        this.callEventService.dismissJoiningRequest();
    }

    private startRingtone(): void {
        try {
            // Use absolute path - Angular serves assets from root
            this.ringtoneAudio = new Audio('assets/ringtone.mp3');
            this.ringtoneAudio.loop = true;
            this.ringtoneAudio.volume = 0.7;

            // Resume AudioContext if suspended (required after user interaction)
            this.resumeAudioContext();

            // Try to play
            const playPromise = this.ringtoneAudio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('Ringtone playing successfully');
                    })
                    .catch(err => {
                        console.warn('Ringtone autoplay blocked:', err.message);
                        // Try alternative: play on any user interaction with the popup
                        this.setupPlayOnInteraction();
                    });
            }
        } catch (error) {
            console.error('Error initializing ringtone:', error);
        }
    }

    /**
     * Resume AudioContext - helps with autoplay on some browsers
     */
    private resumeAudioContext(): void {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }
    }

    /**
     * Setup listener to play audio when user interacts with the call popup
     */
    private setupPlayOnInteraction(): void {
        const playOnce = () => {
            if (this.ringtoneAudio) {
                this.ringtoneAudio.play().catch(() => { });
            }
            document.removeEventListener('click', playOnce);
            document.removeEventListener('touchstart', playOnce);
        };

        document.addEventListener('click', playOnce, { once: true });
        document.addEventListener('touchstart', playOnce, { once: true });
    }

    private stopRingtone(): void {
        if (this.ringtoneAudio) {
            this.ringtoneAudio.pause();
            this.ringtoneAudio.currentTime = 0;
            this.ringtoneAudio = null;
        }
    }

    private startTimer(): void {
        this.callDuration.set(0);
        this.timerInterval = setInterval(() => {
            this.callDuration.update(d => d + 1);
        }, 1000);
    }

    private stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}
