// import { Component, inject, Input } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormGroup } from '@angular/forms';
// import { MeetingService } from '../meeting.service';
// import { VideoComponent } from '../../video/video.component';
// import { AudioComponent } from '../../audio/audio.component';
// import { RoomService } from '../../providers/services/room.service';
// import { NgbSlide } from "../../../../node_modules/@ng-bootstrap/ng-bootstrap/carousel/carousel";

// /**
//  * Meeting View Component
//  * Displays the video grid with local and remote participants
//  * No longer handles participant roster - that's now in meeting.component
//  */
// @Component({
//     selector: 'app-meeting-view',
//     standalone: true,
//     imports: [CommonModule, VideoComponent, AudioComponent, NgbSlide],
//     templateUrl: './meeting-view.component.html',
//     styleUrl: './meeting-view.component.css',
// })
// export class MeetingViewComponent {
//     // Inject services directly
//     meetingService = inject(MeetingService);
//     private roomService = inject(RoomService);

//     // Signals from services - accessed directly
//     localTrack = this.meetingService.localTrack;
//     remoteParticipants = this.roomService.remoteParticipants;
//     remoteTracksMap = this.roomService.remoteTracksMap;

//     // Only video grid specific inputs
//     @Input() roomForm!: FormGroup;

//     // Helper functions for display
//     @Input() getColorFromName!: (name: string) => string;
//     @Input() getUserInitiaLetter!: (name: string) => string;
//     @Input() isParticipantAudioEnabled!: (identity: string) => boolean;
//     @Input() isParticipantCameraEnabled!: (identity: string) => boolean;
//     @Input() getVideoTrack!: (identity: string) => any;

//     get remoteUsersCount(): number {
//         return this.remoteParticipants().size;
//     }
// }
