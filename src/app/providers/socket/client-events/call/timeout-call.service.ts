import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallStatus, CallTimeoutPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class TimeoutCallService extends BaseCallService {
    execute(conversationId: string, callerId: string): void {
        const payload = this.createPayload<CallTimeoutPayload>(conversationId, {
            callerId: callerId
        });

        this.ws.sendEvent(CallEvents.CALL_TIMEOUT, payload);
        this.callStore.callStatus.set(CallStatus.TIMEOUT);
    }
}
