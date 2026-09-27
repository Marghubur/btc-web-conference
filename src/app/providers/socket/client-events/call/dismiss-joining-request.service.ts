import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallEndReason, CallDismissPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class DismissJoiningRequestService extends BaseCallService {
    execute(conversationId: string, callerId: string, reason?: string): void {
        const payload = this.createPayload<CallDismissPayload>(conversationId, {
            callerId: callerId,
            reason: reason || CallEndReason.NORMAL
        });

        this.ws.sendEvent(CallEvents.CALL_DISMISS, payload);
        this.callStore.hasIncomingCall.set(false);
        this.callStore.hasJoiningRequest.set(false);
    }
}
