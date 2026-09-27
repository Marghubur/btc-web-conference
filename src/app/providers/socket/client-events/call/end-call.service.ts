import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallStatus, CallEndReason, CallEndPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class EndCallService extends BaseCallService {
    execute(reason?: string): void {
        const payload = this.createPayload<CallEndPayload>(this.ws.currentConversationId(), {
            reason: reason || CallEndReason.NORMAL
        });

        this.ws.sendEvent(CallEvents.CALL_END, payload);
        this.callStore.callStatus.set(CallStatus.ENDED);
    }
}
