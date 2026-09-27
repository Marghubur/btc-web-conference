import { inject, Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallConfig, CallStatus, CallInitiatePayload, CallTypeValue } from '../../../../models/conference_call/call_model';
import { TimeoutCallService } from './timeout-call.service';
import { NotificationService } from '../../../../notifications/services/notification.service';

@Injectable({
    providedIn: 'root'
})
export class InitiateGroupCallService extends BaseCallService {
    private timeoutCallService = inject(TimeoutCallService);
    private notificationService = inject(NotificationService);

    execute(calleeIds: string[], conversationId: string, callType: CallTypeValue): void {
        const payload = this.createPayload<CallInitiatePayload>(conversationId, {
            callId: crypto.randomUUID(),
            calleeIds: calleeIds,
            callType: callType,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });

        this.ws.sendEvent(CallEvents.CALL_INITIATE, payload);
        this.callStore.callStatus.set(CallStatus.INITIATED);

        // Start 120s ring timeout
        setTimeout(() => {
            if (this.callStore.callStatus() === CallStatus.INITIATED || this.callStore.callStatus() === CallStatus.RINGING) {
                // Time's up! No one answered.
                this.timeoutCallService.execute(conversationId, '');

                // For group calls, just show a message but keep caller in the room
                this.notificationService.showNotification({
                    id: crypto.randomUUID(),
                    type: 'warning',
                    title: 'No Answer',
                    content: 'One or more users did not respond in 2 minutes.',
                    conversationId: '',
                    timestamp: new Date(),
                    read: false
                });
            }
        }, 120 * 1000); // 120 seconds
    }
}
