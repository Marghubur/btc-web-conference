import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents, CallInvitePayload, CallTypeValue } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class InviteCallEventService extends BaseCallService {
    /**
     * Invite a specific user to an ongoing call
     * @param targetUserId ID of the user to invite
     * @param conversationId The ID of the current conversation/room
     * @param callType "audio" or "video"
     * @param timeout Ring timeout in seconds (default 120s)
     */
    execute(
        targetUserId: string,
        conversationId: string,
        callType: CallTypeValue,
        timeout: number = 120
    ): void {
        const payload = this.createPayload<CallInvitePayload>(conversationId, {
            targetUserId: targetUserId,
            callType: callType,
            timeout: timeout
        });

        this.ws.sendEvent(CallEvents.CALL_INVITE, payload);
    }
}
