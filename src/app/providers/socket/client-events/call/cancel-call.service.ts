import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallStatus, CallCancelPayload } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class CancelCallService extends BaseCallService {
    execute(conversationId: string, calleeIds: string[]): void {
        const payload = this.createPayload<CallCancelPayload>(conversationId, {
            calleeIds: calleeIds
        });

        this.ws.sendEvent(CallEvents.CALL_CANCEL, payload);
        this.callStore.callStatus.set(CallStatus.CANCELLED);
    }
}
