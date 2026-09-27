import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallStatus, CallAcceptPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class AcceptCallService extends BaseCallService {
    execute(conversationId: string, callerId: string): void {
        const payload = this.createPayload<CallAcceptPayload>(conversationId, {
            callerId: callerId
        });

        this.ws.sendEvent(CallEvents.CALL_ACCEPT, payload);
        this.callStore.hasIncomingCall.set(false);
        this.callStore.callStatus.set(CallStatus.ACCEPTED);
    }
}
