import { AfterViewInit, Component, ElementRef, inject, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalVideoTrack } from 'livekit-client';
import { VideoComponent } from '../../video/video.component';
import { RoomService } from '../../providers/services/room.service';

/**
 * Screen Share View Component
 * Displays the screen share content (local or remote)
 * No longer handles participant roster - that's now in meeting.component
 */
@Component({
    selector: 'app-screenshare',
    standalone: true,
    imports: [CommonModule, VideoComponent],
    templateUrl: './screenshare.component.html',
    styleUrl: './screenshare.component.css',
})
export class MeetingScreenshareViewComponent implements AfterViewInit, OnChanges {
    private roomService = inject(RoomService);

    // Remote screen share track from service
    remoteSharescreenTrack = this.roomService.remoteSharescreenTrack;

    @ViewChild('screenPreview') screenPreview!: ElementRef<HTMLVideoElement>;

    // Only screen-share specific inputs
    @Input() isMyshareScreen: boolean = false;
    @Input() localScreenTrack: LocalVideoTrack | null = null;

    private isViewReady = false;

    ngAfterViewInit(): void {
        this.isViewReady = true;
        this.attachLocalScreenTrack();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['localScreenTrack'] && this.isViewReady) {
            this.attachLocalScreenTrack();
        }
    }

    private attachLocalScreenTrack(): void {
        if (this.localScreenTrack && this.screenPreview?.nativeElement && this.isMyshareScreen) {
            this.localScreenTrack.attach(this.screenPreview.nativeElement);
            console.log('Local screen track attached to preview');
        }
    }
}
