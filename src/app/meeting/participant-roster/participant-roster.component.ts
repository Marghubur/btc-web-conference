import { Component, EventEmitter, inject, Input, Output, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { RemoteParticipant, LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { MeetingService } from '../meeting.service';
import { InvitedParticipant } from '../meeting.component';
import { CallParticipant, CallStatus } from '../../models/conference_call/call_model';
import { VideoComponent } from '../../video/video.component';
import { NotificationService } from '../../notifications/services/notification.service';

export interface RosterParticipantItem {
    id: string;
    identity: string;
    name: string;
    isLocal: boolean;
    email?: string;
    isInLiveKit: boolean;
}

/**
 * Shared Participant Roster Component
 * Used by both meeting-view and screenshare components to display
 * the list of participants in the call.
 */
@Component({
    selector: 'app-participant-roster',
    standalone: true,
    imports: [CommonModule, VideoComponent],
    templateUrl: './participant-roster.component.html',
    styleUrl: './participant-roster.component.css',
})
export class ParticipantRosterComponent {
    // Inject services directly
    meetingService = inject(MeetingService);
    notificationService = inject(NotificationService);

    // Required inputs
    @Input() roomForm!: FormGroup;

    // Invited participants not in the call (can be array or use invitedParticipantsArray)
    @Input() invitedParticipants: InvitedParticipant[] = [];

    // Track which participants are currently being called
    callingParticipants = signal<Set<string>>(new Set());

    // Timeout duration in milliseconds (120 seconds)
    private readonly CALLING_TIMEOUT = 120000;

    isCallingParticipant(userId: string): boolean {
        return this.callingParticipants().has(userId);
    }

    inMeetingParticipants(): RosterParticipantItem[] {
        const filterValue = (this.meetingService as any).participantFilterSignal ? (this.meetingService as any).participantFilterSignal().toLowerCase().trim() : '';
        const list: RosterParticipantItem[] = [];

        // 1. Local participant (You)
        const localName = this.roomForm?.value?.participantName || 'You';
        list.push({
            id: 'local-you',
            identity: localName,
            name: localName,
            isLocal: true,
            isInLiveKit: true
        });

        // 2. All LiveKit remote participants (who are actually in the meeting room)
        const lkParticipants = this.meetingService.remoteParticipants();
        lkParticipants.forEach((rp, identity) => {
            list.push({
                id: rp.sid || identity,
                identity: identity,
                name: rp.name || identity,
                isLocal: false,
                isInLiveKit: true
            });
        });

        // 3. Any backend accepted participants from serverEventService (filteredInvitedParticipants(true))
        // just in case someone is accepted via websocket but hasn't completed LiveKit join yet
        const acceptedBackend = this.meetingService.filteredInvitedParticipants(true);
        if (acceptedBackend && acceptedBackend.length) {
            acceptedBackend.forEach((p) => {
                const alreadyAdded = list.some(item => 
                    item.identity === p.name || 
                    item.name === p.name || 
                    (p.email && item.identity === p.email) || 
                    item.id === p.userId
                );
                if (!alreadyAdded) {
                    list.push({
                        id: p.userId,
                        identity: p.name || p.email || p.userId,
                        name: p.name,
                        email: p.email,
                        isLocal: false,
                        isInLiveKit: false
                    });
                }
            });
        }

        // Filter by search query if any
        if (!filterValue) {
            return list;
        }
        return list.filter(p => 
            p.name.toLowerCase().includes(filterValue) || 
            p.identity.toLowerCase().includes(filterValue) ||
            (p.email && p.email.toLowerCase().includes(filterValue))
        );
    }

    isAudioEnabled(p: RosterParticipantItem): boolean {
        if (p.isLocal) {
            return this.meetingService.isMicOn();
        }
        return this.meetingService.isParticipantAudioEnabled(p.identity);
    }

    isCameraEnabled(p: RosterParticipantItem): boolean {
        if (p.isLocal) {
            return this.meetingService.isCameraOn();
        }
        return this.meetingService.isParticipantCameraEnabled(p.identity);
    }

    getVideoTrack(p: RosterParticipantItem): LocalVideoTrack | RemoteVideoTrack | undefined {
        if (p.isLocal) {
            return this.meetingService.localTrack() || undefined;
        }
        return this.meetingService.getParticipantVideoTrack(p.identity);
    }

    hasVideoTrack(p: RosterParticipantItem): boolean {
        return this.isCameraEnabled(p) && !!this.getVideoTrack(p);
    }

    requestToJoin(invited: CallParticipant): void {
        // Add to calling set
        const currentSet = new Set(this.callingParticipants());
        currentSet.add(invited.userId);
        this.callingParticipants.set(currentSet);

        // Call the service method
        this.meetingService.requestToJoin(invited);

        // Reset after timeout
        setTimeout(() => {
            const updatedSet = new Set(this.callingParticipants());
            if (updatedSet.has(invited.userId)) {
                updatedSet.delete(invited.userId);
                this.callingParticipants.set(updatedSet);
                
                // Show timeout notification if the user is still not in the meeting room
                const isAccepted = this.meetingService.filteredInvitedParticipants(true).some(p => p.userId === invited.userId);
                if (!isAccepted) {
                    this.notificationService.showNotification({
                        id: crypto.randomUUID(),
                        type: 'warning',
                        title: 'No response',
                        content: `${invited.name} did not answer the call.`,
                        conversationId: '',
                        timestamp: new Date(),
                        read: false
                    });
                }
            }
        }, this.CALLING_TIMEOUT);
    }
}

