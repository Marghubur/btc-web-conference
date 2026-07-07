import { Injectable } from '@angular/core';
import { ConfeetSocketService } from '../../confeet-socket.service';
import { ServerEventService } from '../../server-events/server-event.service';
import { CallEvents, CallConfig, CallStatus, CallInitiatePayload, CallTypeValue } from '../../../../models/conference_call/call_model';
import { LocalService } from '../../../services/local.service';

@Injectable({
    providedIn: 'root'
})
export class InitiateGroupCallService {
    constructor(
        private ws: ConfeetSocketService,
        private serverEventService: ServerEventService,
        private local: LocalService
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
    }
}
