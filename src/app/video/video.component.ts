import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { MeetingService } from '../providers/services/meeting.service';

@Component({
    selector: 'video-component',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './video.component.html',
    styleUrl: './video.component.css',
})
export class VideoComponent implements AfterViewInit, OnDestroy {
    videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');

    track = input.required<LocalVideoTrack | RemoteVideoTrack>();
    participantIdentity = input.required<string>();
    local = input(false);
    isMute = input(false);
    constructor(public meetingService: MeetingService) {}
    ngAfterViewInit() {
        if (this.videoElement()) {
            this.track().attach(this.videoElement()!.nativeElement);
        }
    }

    ngOnDestroy() {
        this.track().detach();
    }

    getkey() {
        return crypto.randomUUID();
    }
}
