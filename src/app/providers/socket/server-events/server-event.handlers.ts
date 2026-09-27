import { CallStatus } from '../../../models/conference_call/call_model';
import { LocalService } from '../../services/local.service';
import { NotificationService } from '../../../notifications/services/notification.service';
import { MeetingService } from '../../../meeting/meeting.service';

/**
 * registerCallEventHandlers
 *
 * Wires up all WebSocket server-event subscriptions.
 * Each handler translates a raw socket payload into a semantic
 * CallStore method call — the store owns all state mutations.
 */
export function registerCallEventHandlers(
    service: any,
    local: LocalService,
    notificationService: NotificationService,
    meetingService: MeetingService
): void {

    // ── Incoming Call ────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callIncoming$.subscribe(event => {
            const currentUser = local.getUser();

            // Ignore own event — caller should not see their own incoming call
            if (currentUser && event.callerId === currentUser.userId) {
                console.log('[ServerEvents] Ignoring incoming call — I am the caller');
                return;
            }

            service.store.setRinging(event, CallStatus.RINGING);
            console.log('[ServerEvents] Incoming call from:', event.callerId);
        })
    );

    // ── Joining Request (invited into ongoing call) ──────────────────────────
    service.subscriptions.add(
        service.callJoiningRequest$.subscribe(event => {
            const currentUser = local.getUser();

            service.store.setParticipantsInRoom(event.participants);

            if (currentUser && event.callerId === currentUser.userId) {
                console.log('[ServerEvents] Ignoring joining request — I am the caller');
                return;
            }

            service.store.setJoiningRequest(event, CallStatus.JOINING_REQUEST);
            console.log('[ServerEvents] Joining request from:', event.callerId);
        })
    );

    // ── Group Notification ───────────────────────────────────────────────────
    service.subscriptions.add(
        service.groupNotification$.subscribe(event => {
            console.log('[ServerEvents] Group notification:', event);
            service.store.setGroupNotification(event);
        })
    );

    // ── Raised Joining Request ───────────────────────────────────────────────
    service.subscriptions.add(
        service.callRaisedJoiningRequest$.subscribe(event => {
            const currentUser = local.getUser();

            if (currentUser && event.callerId === currentUser.userId) {
                console.log('[ServerEvents] Ignoring raised joining request — I am the caller');
                return;
            }

            service.store.setJoiningRequest(event, CallStatus.RAISED_JOINING_REQUEST);
            console.log('[ServerEvents] Raised joining request from:', event.callerId);
        })
    );

    // ── Call Accepted ────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callAccepted$.subscribe(event => {
            service.store.setAccepted(CallStatus.ACCEPTED);
            console.log('[ServerEvents] Call accepted by:', event.acceptedBy);
        })
    );

    // ── Call Rejected ────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callRejected$.subscribe(async event => {
            // 1. Update Call Store
            service.store.setRejected(CallStatus.REJECTED);
            console.log('[ServerEvents] Call rejected by:', event.rejectedBy);

            // 2. Show notification to user
            notificationService.showNotification({
                id: crypto.randomUUID(),
                type: 'warning',
                title: 'Call Rejected',
                content: `${event.rejectedBy || 'The user'} declined the call.`,
                conversationId: event.conversationId,
                timestamp: new Date(),
                read: false
            });

            // 3. Fully tear down room, release media & navigate back to chat
            await meetingService.leaveRoom(true, false);
        })
    );

    // ── Call Dismissed ───────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callDismissed$.subscribe(event => {
            service.store.setDismissed();
            console.log('[ServerEvents] Call dismissed by:', JSON.stringify(event));
        })
    );

    // ── Call Cancelled ───────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callCancelled$.subscribe(event => {
            service.store.setCancelled(CallStatus.CANCELLED);
            console.log('[ServerEvents] Call cancelled by:', event.cancelledBy);
        })
    );

    // ── Call Timed Out ───────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callTimedOut$.subscribe(event => {
            service.store.setTimedOut(CallStatus.TIMEOUT);
            console.log('[ServerEvents] Call timed out:', event.conversationId);
        })
    );

    // ── Call Ended ───────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callEnded$.subscribe(event => {
            service.store.setEnded(CallStatus.ENDED);
            console.log('[ServerEvents] Call ended by:', event.endedBy, '| Duration:', event.duration);
        })
    );

    // ── Callee Busy ──────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callBusy$.subscribe(event => {
            service.store.setBusy(CallStatus.BUSY);
            console.log('[ServerEvents] User busy:', event.busyUser);
        })
    );

    // ── Call Error ───────────────────────────────────────────────────────────
    service.subscriptions.add(
        service.callError$.subscribe(event => {
            service.store.setFailed(CallStatus.FAILED);
            console.error('[ServerEvents] Call error:', event.error);
        })
    );
}
