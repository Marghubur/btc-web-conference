import { Injectable } from '@angular/core';
import { ConfeetSocketService } from '../../confeet-socket.service';
import { ServerEventService } from '../../server-events/server-event.service';
import { CallEvents, CallConfig, CallStatus, CallInitiatePayload, CallTypeValue, CallEndReason } from '../../../../models/conference_call/call_model';
import { LocalService } from '../../../services/local.service';
import { TimeoutCallService } from './timeout-call.service';
import { NotificationService } from '../../../../notifications/services/notification.service';

@Injectable({
    providedIn: 'root'
})
export class InitiateGroupCallService {
    constructor(
        private ws: ConfeetSocketService,
        private serverEventService: ServerEventService,
        private local: LocalService,
        private timeoutCallService: TimeoutCallService,
        private notificationService: NotificationService
    ) { }

    execute(calleeIds: string[], conversationId: string, callType: CallTypeValue): void {
        const user = this.local.getUser();
        const callerId = user?.userId || '';
        const callerName = ((user?.firstName || '') + ' ' + (user?.lastName || '')).trim() || user?.email || 'Unknown';
        const callerAvatar = '';

        this.ws.sendEvent(CallEvents.CALL_INITIATE, <CallInitiatePayload>{
            callId: crypto.randomUUID(),
            callerId: callerId,
            callerName: callerName,
            callerAvatar: callerAvatar,
            conversationId: conversationId,
            calleeIds: calleeIds,
            callType: callType,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });
        this.serverEventService.callStatus.set(CallStatus.INITIATED);

        // Start 120s ring timeout
        setTimeout(() => {
            if (this.serverEventService.callStatus() === CallStatus.INITIATED || this.serverEventService.callStatus() === CallStatus.RINGING) {
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
