import { Injectable } from '@angular/core';
import { ConfeetSocketService } from '../../confeet-socket.service';
import { CallEvents, CallInvitePayload, CallTypeValue } from '../../../../models/conference_call/call_model';
import { LocalService } from '../../../../providers/services/local.service';

@Injectable({
    providedIn: 'root'
})
export class InviteCallEventService {

    constructor(
        private ws: ConfeetSocketService,
        private localService: LocalService
    ) { }

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
        const currentUser = this.localService.getUser();

        const payload: CallInvitePayload = {
            targetUserId: targetUserId,
            callerId: currentUser.userId,
            callerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
            callerAvatar: (currentUser as any).avatar || '',
            conversationId: conversationId,
            callType: callType,
            timeout: timeout
        };

        this.ws.sendEvent(CallEvents.CALL_INVITE, payload);
    }
}
