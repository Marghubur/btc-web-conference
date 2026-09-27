import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallStatus, CallRejectPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class RejectCallService extends BaseCallService {
    execute(conversationId: string, receiverId: string, reason?: string): void {
        const payload = this.createPayload<CallRejectPayload>(conversationId, {
            callerId: this.getCallerInfo().callerId,
            receiverId: receiverId,
            reason: reason
        });

        this.ws.sendEvent(CallEvents.CALL_REJECT, payload);
        this.callStore.hasIncomingCall.set(false);
        this.callStore.callStatus.set(CallStatus.REJECTED);
    }
}
