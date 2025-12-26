import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallEventService } from '../../providers/socket/call-event.service';
import { CallType } from '../../models/conference_call/call_model';
import { Router } from '@angular/router';

@Component({
    selector: 'app-incoming-call',
    standalone: true,
    imports: [CommonModule],
    template: `
        @if (callEventService.hasIncomingCall()) {
            <div class="incoming-call-overlay">
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
    `,
    styles: [`
        .incoming-call-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        }

        .incoming-call-card {
            position: relative;
            width: 320px;
            padding: 40px 30px;
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            border-radius: 24px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5),
                        0 0 0 1px rgba(255, 255, 255, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            animation: slideUp 0.4s ease-out;
        }

        .incoming-call-card.video-call {
            background: linear-gradient(145deg, #1a1a2e 0%, #2d1b4e 50%, #4a1d6e 100%);
        }

        /* Pulse animation rings */
        .pulse-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 120px;
            height: 120px;
            margin: -60px 0 0 -60px;
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
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 24px;
        }

        .call-type-badge svg {
            width: 14px;
            height: 14px;
        }

        /* Caller avatar */
        .caller-avatar {
            position: relative;
            width: 100px;
            height: 100px;
            margin-bottom: 20px;
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
            font-size: 36px;
            font-weight: 600;
            color: white;
            text-transform: uppercase;
            border: 3px solid rgba(255, 255, 255, 0.2);
        }

        /* Caller info */
        .caller-info {
            text-align: center;
            margin-bottom: 16px;
        }

        .caller-name {
            color: #fff;
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 6px 0;
        }

        .call-status {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            margin: 0;
            animation: blink 1.5s ease-in-out infinite;
        }

        /* Timer */
        .call-timer {
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            font-family: monospace;
            margin-bottom: 28px;
        }

        /* Action buttons */
        .call-actions {
            display: flex;
            gap: 40px;
        }

        .action-btn {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .action-btn svg {
            width: 28px;
            height: 28px;
        }

        .action-btn.accept {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            box-shadow: 0 8px 25px rgba(34, 197, 94, 0.4);
            animation: wiggle 0.5s ease-in-out infinite;
        }

        .action-btn.accept:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 35px rgba(34, 197, 94, 0.5);
        }

        .action-btn.decline {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
        }

        .action-btn.decline:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 35px rgba(239, 68, 68, 0.5);
        }

        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
                opacity: 0.8;
            }
            100% {
                transform: scale(2.5);
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
    private router = inject(Router);

    private ringtoneAudio: HTMLAudioElement | null = null;
    private timerInterval: any = null;

    callDuration = signal(0);

    incomingCall = () => this.callEventService.incomingCall();

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

    formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    acceptCall(): void {
        const call = this.incomingCall();
        if (call) {
            this.stopRingtone();
            this.stopTimer();
            this.callEventService.acceptCall(call.conversationId, call.callerId);
            this.router.navigate(['/btc/preview'], {
                state: {
                    id: call.conversationId,
                    title: call.callerName || 'NEW'
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
