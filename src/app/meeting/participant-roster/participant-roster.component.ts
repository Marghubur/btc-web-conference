import { Component, EventEmitter, inject, Input, Output, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { RemoteParticipant } from 'livekit-client';
import { MeetingService } from '../meeting.service';
import { InvitedParticipant } from '../meeting.component';
import { CallParticipant } from '../../models/conference_call/call_model';

/**
 * Shared Participant Roster Component
 * Used by both meeting-view and screenshare components to display
 * the list of participants in the call.
 */
@Component({
    selector: 'app-participant-roster',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './participant-roster.component.html',
    styleUrl: './participant-roster.component.css',
})
export class ParticipantRosterComponent {
    // Inject services directly
    meetingService = inject(MeetingService);

    // Required inputs
    @Input() roomForm!: FormGroup;

    // Invited participants not in the call (can be array or use invitedParticipantsArray)
    @Input() invitedParticipants: InvitedParticipant[] = [];

    // Track which participants are currently being called
    callingParticipants = signal<Set<string>>(new Set());

    // Timeout duration in milliseconds (10 seconds)
    private readonly CALLING_TIMEOUT = 10000;

    isCallingParticipant(userId: string): boolean {
        return this.callingParticipants().has(userId);
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
            updatedSet.delete(invited.userId);
            this.callingParticipants.set(updatedSet);
        }, this.CALLING_TIMEOUT);
    }
}
