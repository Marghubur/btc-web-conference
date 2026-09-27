import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallType, CallConfig, CallStatus, CallInitiatePayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class InitiateAudioJoiningRequestService extends BaseCallService {
    execute(calleeId: string, conversationId: string): void {
        const payload = this.createPayload<CallInitiatePayload>(conversationId, {
            callId: crypto.randomUUID(),
            calleeIds: [calleeId],
            callType: CallType.AUDIO,
            timeout: CallConfig.DEFAULT_TIMEOUT
        });

        this.ws.sendEvent(CallEvents.JOINING_REQUEST, payload);
        this.callStore.callStatus.set(CallStatus.INITIATED);
    }
}
