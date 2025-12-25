import { Injectable, signal, computed } from '@angular/core';
import { Observable, filter, map, Subscription } from 'rxjs';
import { ConfeetSocketService, WsEvent } from './confeet-socket.service';
import { LocalService } from '../services/local.service';
import {
    // Constants
    CallEvents,
    CallServerEvents,
    CallType,
    CallConfig,
    CallStatus,
    CallEndReason,
    // Types
    CallTypeValue,
    CallStatusValue,
    // Client to Server Payloads
    CallInitiatePayload,
    CallAcceptPayload,
    CallRejectPayload,
    CallCancelPayload,
    CallTimeoutPayload,
    CallEndPayload,
    // Server to Client Events
    CallIncomingEvent,
    CallAcceptedEvent,
    CallRejectedEvent,
    CallCancelledEvent,
    CallTimedOutEvent,
    CallEndedEvent,
    CallBusyEvent,
    CallErrorEvent,
    Call
} from '../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class CallEventService {
    // =========================================================
    // Server to Client Event Observables
    // =========================================================

    /** Emits when receiving an incoming call */
    callIncoming$: Observable<CallIncomingEvent>;

    /** Emits when callee accepts the call */
    callAccepted$: Observable<CallAcceptedEvent>;

    /** Emits when callee rejects the call */
    callRejected$: Observable<CallRejectedEvent>;

    /** Emits when caller cancels before answer */
    callCancelled$: Observable<CallCancelledEvent>;

    /** Emits when call times out (no answer) */
    callTimedOut$: Observable<CallTimedOutEvent>;

    /** Emits when call ends */
    callEnded$: Observable<CallEndedEvent>;

    /** Emits when callee is busy */
    callBusy$: Observable<CallBusyEvent>;

    /** Emits when a call error occurs */
    callError$: Observable<CallErrorEvent>;

    // =========================================================
    // Call State Management
    // =========================================================

    /** Current active call (if any) */
    public activeCall = signal<Call | null>(null);

    /** Call status for UI display */
    public callStatus = signal<CallStatusValue | null>(null);

    /** Is currently in a call */
    public inCall = computed(() => this.activeCall() !== null);

    /** Is receiving an incoming call */
    public hasIncomingCall = signal<boolean>(false);

    /** Incoming call details */
    public incomingCall = signal<CallIncomingEvent | null>(null);

    private subscriptions = new Subscription();

    constructor(
        private ws: ConfeetSocketService,
        private local: LocalService
    ) {
        // Setup filtered observables for server events
        this.callIncoming$ = this.onCallEvent<CallIncomingEvent>(CallServerEvents.CALL_INCOMING);
        this.callAccepted$ = this.onCallEvent<CallAcceptedEvent>(CallServerEvents.CALL_ACCEPTED);
        this.callRejected$ = this.onCallEvent<CallRejectedEvent>(CallServerEvents.CALL_REJECTED);
        this.callCancelled$ = this.onCallEvent<CallCancelledEvent>(CallServerEvents.CALL_CANCELLED);
        this.callTimedOut$ = this.onCallEvent<CallTimedOutEvent>(CallServerEvents.CALL_TIMED_OUT);
        this.callEnded$ = this.onCallEvent<CallEndedEvent>(CallServerEvents.CALL_ENDED);
        this.callBusy$ = this.onCallEvent<CallBusyEvent>(CallServerEvents.CALL_BUSY);
        this.callError$ = this.onCallEvent<CallErrorEvent>(CallServerEvents.CALL_ERROR);
    }

    /**
     * Initialize call event listeners.
     * Should be called once from LayoutComponent or NotificationService.
     */
    initialize(): void {
        this.registerCallEventHandlers();
        console.log('CallEventService initialized');
    }

    // =========================================================
    // Client to Server Methods (Send Events)
    // =========================================================

    /**
     * Initiate an audio call to a user
     */
    initiateAudioCall(calleeId: string, conversationId: string): void {
        this.send(CallEvents.CALL_INITIATE, <CallInitiatePayload>{
            conversationId: conversationId,
            calleeIds: [calleeId],
            callType: CallType.AUDIO,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });
        this.callStatus.set(CallStatus.INITIATED);
    }

    /**
     * Initiate a video call to a user
     */
    initiateVideoCall(calleeId: string, conversationId: string): void {
        this.send(CallEvents.CALL_INITIATE, <CallInitiatePayload>{
            callId: crypto.randomUUID(),
            conversationId: conversationId,
            calleeIds: [calleeId],
            callType: CallType.VIDEO,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });
        this.callStatus.set(CallStatus.INITIATED);
    }

    /**
     * Initiate a group call to multiple users
     */
    initiateGroupCall(calleeIds: string[], conversationId: string, callType: CallTypeValue): void {
        this.send(CallEvents.CALL_INITIATE, <CallInitiatePayload>{
            callId: crypto.randomUUID(),
            conversationId: conversationId,
            calleeIds: calleeIds,
            callType: callType,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });
        this.callStatus.set(CallStatus.INITIATED);
    }

    /**
     * Accept an incoming call
     */
    acceptCall(conversationId: string, callerId: string): void {
        this.send(CallEvents.CALL_ACCEPT, <CallAcceptPayload>{
            conversationId: conversationId,
            callerId: callerId
        });
        this.hasIncomingCall.set(false);
        this.incomingCall.set(null);
        this.callStatus.set(CallStatus.ACCEPTED);
    }

    /**
     * Reject an incoming call
     */
    rejectCall(conversationId: string, callerId: string, reason?: string): void {
        this.send(CallEvents.CALL_REJECT, <CallRejectPayload>{
            conversationId: conversationId,
            callerId: callerId,
            reason: reason
        });
        this.hasIncomingCall.set(false);
        this.incomingCall.set(null);
        this.callStatus.set(CallStatus.REJECTED);
    }

    /**
     * Cancel an outgoing call before it's answered
     */
    cancelCall(conversationId: string, calleeIds: string[]): void {
        this.send(CallEvents.CALL_CANCEL, <CallCancelPayload>{
            conversationId: conversationId,
            calleeIds: calleeIds
        });
        this.callStatus.set(CallStatus.CANCELLED);
        this.resetCallState();
    }

    /**
     * Report call timeout (no answer)
     */
    timeoutCall(conversationId: string, callerId: string): void {
        this.send(CallEvents.CALL_TIMEOUT, <CallTimeoutPayload>{
            conversationId: conversationId,
            callerId: callerId
        });
        this.callStatus.set(CallStatus.TIMEOUT);
        this.resetCallState();
    }

    /**
     * End an ongoing call
     */
    endCall(conversationId: string, reason?: string): void {
        this.send(CallEvents.CALL_END, <CallEndPayload>{
            conversationId: conversationId,
            reason: reason || CallEndReason.NORMAL
        });
        this.callStatus.set(CallStatus.ENDED);
        this.resetCallState();
    }

    // =========================================================
    // Private Helper Methods
    // =========================================================

    /**
     * Generic event filter for call events
     */
    private onCallEvent<T>(eventType: string): Observable<T> {
        return this.ws.getMessageSubject().pipe(
            filter((e: WsEvent) => e.event === eventType),
            map((e: WsEvent) => e.payload as T)
        );
    }

    /**
     * Generic send method using socket service
     */
    private send<T>(event: string, payload: T): void {
        this.ws.sendEvent(event, payload);
    }

    /**
     * Register handlers for incoming call events
     */
    private registerCallEventHandlers(): void {
        // Handle incoming call (only for callees, not the caller)
        this.subscriptions.add(
            this.callIncoming$.subscribe(event => {
                const currentUser = this.local.getUser();

                // Skip if I am the caller (I should not get notified of my own call)
                if (currentUser && event.callerId === currentUser.userId) {
                    console.log('Ignoring incoming call event - I am the caller');
                    return;
                }

                this.hasIncomingCall.set(true);
                this.incomingCall.set(event);
                this.callStatus.set(CallStatus.RINGING);
                console.log('Incoming call from:', event.callerId);
            })
        );

        // Handle call accepted
        this.subscriptions.add(
            this.callAccepted$.subscribe(event => {
                this.callStatus.set(CallStatus.ACCEPTED);
                console.log('Call accepted by:', event.acceptedBy);
                // TODO: Connect to LiveKit room with event.roomName and event.token
            })
        );

        // Handle call rejected
        this.subscriptions.add(
            this.callRejected$.subscribe(event => {
                this.callStatus.set(CallStatus.REJECTED);
                this.resetCallState();
                console.log('Call rejected by:', event.rejectedBy);
            })
        );

        // Handle call cancelled
        this.subscriptions.add(
            this.callCancelled$.subscribe(event => {
                this.callStatus.set(CallStatus.CANCELLED);
                this.hasIncomingCall.set(false);
                this.incomingCall.set(null);
                console.log('Call cancelled by:', event.cancelledBy);
            })
        );

        // Handle call timeout
        this.subscriptions.add(
            this.callTimedOut$.subscribe(event => {
                this.callStatus.set(CallStatus.TIMEOUT);
                this.resetCallState();
                console.log('Call timed out:', event.conversationId);
            })
        );

        // Handle call ended
        this.subscriptions.add(
            this.callEnded$.subscribe(event => {
                this.callStatus.set(CallStatus.ENDED);
                this.resetCallState();
                console.log('Call ended by:', event.endedBy, 'Duration:', event.duration);
            })
        );

        // Handle callee busy
        this.subscriptions.add(
            this.callBusy$.subscribe(event => {
                this.callStatus.set(CallStatus.BUSY);
                this.resetCallState();
                console.log('User busy:', event.busyUser);
            })
        );

        // Handle call error
        this.subscriptions.add(
            this.callError$.subscribe(event => {
                this.callStatus.set(CallStatus.FAILED);
                this.resetCallState();
                console.error('Call error:', event.error);
            })
        );
    }

    /**
     * Reset all call state
     */
    private resetCallState(): void {
        this.activeCall.set(null);
        this.hasIncomingCall.set(false);
        this.incomingCall.set(null);
    }

    /**
     * Cleanup subscriptions
     */
    destroy(): void {
        this.subscriptions.unsubscribe();
    }
}
