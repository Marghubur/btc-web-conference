import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallType, CallConfig, CallStatus, CallInitiatePayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class JoinCallService extends BaseCallService {
    execute(calleeId: string, conversationId: string): void {
        const payload = this.createPayload<CallInitiatePayload>(conversationId, {
            calleeIds: [calleeId],
            callType: CallType.AUDIO,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });

        this.ws.sendEvent(CallEvents.CALL_STARTED, payload);
        this.callStore.callStatus.set(CallStatus.INITIATED);
    }
}
