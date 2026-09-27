import { inject, Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallType, CallConfig, CallStatus, CallInitiatePayload, CallEndReason } from '../../../../models/conference_call/call_model';
import { TimeoutCallService } from './timeout-call.service';
import { EndCallService } from './end-call.service';
import { NotificationService } from '../../../../notifications/services/notification.service';

@Injectable({
    providedIn: 'root'
})
export class InitiateAudioCallService extends BaseCallService {
    private timeoutCallService = inject(TimeoutCallService);
    private endCallService = inject(EndCallService);
    private notificationService = inject(NotificationService);

    execute(calleeIds: string | string[], conversationId: string, isDirectCall: boolean = false): void {
        const ids = Array.isArray(calleeIds) ? calleeIds : [calleeIds];

        const payload = this.createPayload<CallInitiatePayload>(conversationId, {
            callId: crypto.randomUUID(),
            calleeIds: ids,
            callType: CallType.AUDIO,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });

        this.ws.sendEvent(CallEvents.CALL_INITIATE, payload);
        this.callStore.callStatus.set(CallStatus.INITIATED);

        // Start 120s ring timeout
        setTimeout(() => {
            // Check if call is still ringing/initiated (hasn't been accepted/rejected/ended)
            if (this.callStore.callStatus() === CallStatus.INITIATED || this.callStore.callStatus() === CallStatus.RINGING) {
                // Time's up! No one answered.

                // Notify the server/callee to stop ringing
                // Note: For multiple callees, this just sends to the room or first callee
                const targetId = ids.length > 0 ? ids[0] : '';
                this.timeoutCallService.execute(conversationId, targetId);

                if (isDirectCall || ids.length === 1) {
                    // For direct calls, disconnect the caller as requested
                    this.notificationService.showNotification({
                        id: crypto.randomUUID(),
                        type: 'warning',
                        title: 'No Answer',
                        content: 'The user did not respond in 2 minutes. Disconnecting call.',
                        conversationId: '',
                        timestamp: new Date(),
                        read: false
                    });
                    this.endCallService.execute(CallEndReason.TIMEOUT);
                } else {
                    // For group calls, just show a message but keep caller in the room
                    this.notificationService.showNotification({
                        id: crypto.randomUUID(),
                        type: 'warning',
                        title: 'No Answer',
                        content: 'One or more users did not respond.',
                        conversationId: '',
                        timestamp: new Date(),
                        read: false
                    });
                }
            }
        }, 120 * 1000); // 120 seconds
    }
}
