import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { createLocalScreenTracks, LocalTrackPublication, LocalVideoTrack, Room } from 'livekit-client';
import { CameraService } from '../services/camera.service';
import { RoomService } from '../services/room.service';
import { AudioComponent } from '../audio/audio.component';
import { VideoComponent } from '../video/video.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { MediaPermissions, MediaPermissionsService } from '../services/media-permission.service';

@Component({
  selector: 'app-meeting',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AudioComponent, VideoComponent, CommonModule],
  templateUrl: './meeting.component.html',
  styleUrl: './meeting.component.css'
})
export class MeetingComponent implements OnDestroy, OnInit {
    // Reference to the dedicated <video> element for screen sharing
    @ViewChild('screenPreview') screenPreview!: ElementRef<HTMLVideoElement>;

    roomForm = new FormGroup({
        roomName: new FormControl('Test Room', Validators.required),
        participantName: new FormControl('Participant' + Math.floor(Math.random() * 100), Validators.required),
    });

    room = signal<Room | undefined>(undefined);
    localTrack = signal<LocalVideoTrack | undefined>(undefined);
    remoteTracksMap = this.roomService.remoteTracksMap;

    cameras: MediaDeviceInfo[] = [];
    microphones: MediaDeviceInfo[] = [];
    speakers: MediaDeviceInfo[] = [];

    selectedCamera: string | null = null;
    selectedMic: string | null = null;
    selectedSpeaker: string | null = null;
    meetingId: string | null = null;
    enableScreenSharing = signal(false);

    isCameraOn = signal(true);
    isMicOn = signal(true);
    currentTime: Date = new Date();
    private timerSubscription: Subscription | undefined;
    permissions: MediaPermissions = {
        camera: 'unknown',
        microphone: 'unknown',
    };
    private subscription?: Subscription;
    @ViewChild('microphoneActiveModal') microphoneActiveModal!: ElementRef;
    @ViewChild('cameraActiveModal') cameraActiveModal!: ElementRef;
    private modalInstance: any;
    constructor(
        private cameraService: CameraService,
        private router: ActivatedRoute,
        private roomService: RoomService,
        private route: Router,
        private mediaPerm: MediaPermissionsService
    ) {}

    async ngOnInit() {
        this.timerSubscription = interval(60 * 1000).subscribe(() => {
            this.currentTime = new Date();
        });
        this.subscription = this.mediaPerm.permissions$.subscribe(
            permissions => {
                this.permissions = permissions;
                console.log('Permissions updated:', permissions, 'Update #');
            }
        );
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.cameras = devices.filter(d => d.kind === 'videoinput');
        this.microphones = devices.filter(d => d.kind === 'audioinput');
        this.speakers = devices.filter(d => d.kind === 'audiooutput');

        this.selectedCamera = this.cameras[0]?.deviceId || null;
        this.selectedMic = this.microphones[0]?.deviceId || null;
        this.selectedSpeaker = this.speakers[0]?.deviceId || null;
        // Using snapshot (loads once)
        this.meetingId = this.router.snapshot.paramMap.get('id');
        if(this.meetingId) {
            this.joinRoom();
        }
    }

    ngAfterViewInit() {
        const modalEl = document.getElementById('microphoneActiveModal');
        if (modalEl) {
        // @ts-ignore (bootstrap comes from CDN)
        this.modalInstance = new bootstrap.Modal(modalEl);

        modalEl.addEventListener('shown.bs.modal', () => {
            this.microphoneActiveModal?.nativeElement.focus();
        });
        }

        const cameraActiveModal = document.getElementById('cameraActiveModal');
        if (cameraActiveModal) {
        // @ts-ignore (bootstrap comes from CDN)
        this.modalInstance = new bootstrap.Modal(modalEl);

        cameraActiveModal.addEventListener('shown.bs.modal', () => {
            this.cameraActiveModal?.nativeElement.focus();
        });
        }
    }

    async joinRoom() {
        try {
            // const roomName = this.roomForm.value.roomName!;
            const participantName = `User-${new Date().getMilliseconds()}`; // this.roomForm.value.participantName!;
            const joinedRoom = await this.roomService.joinRoom(this.meetingId!, participantName);

            this.room.set(joinedRoom);

            // Enable default camera & mic
            await this.cameraService.enableCamera(joinedRoom);
            await this.cameraService.enableMic(joinedRoom);

            // Set the local video track for display
            const videoPub = joinedRoom.localParticipant.videoTrackPublications.values().next().value;
            if (videoPub?.videoTrack) {
                this.localTrack.set(videoPub.videoTrack);
            }
        } catch (error: any) {
            console.error('Error joining room:', error);
            await this.leaveRoom();
        }
    }

    async leaveRoom() {
        await this.roomService.leaveRoom();
        this.room.set(undefined);
        this.localTrack.set(undefined);
        this.route.navigate(["/", this.meetingId])
    }

    async toggleCamera() {
        if (!this.room()) return;
        
        this.isCameraOn.set(!this.isCameraOn());
        this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
    }

    async toggleMic() {
        if (!this.room()) return;
        
        if (this.isMicOn()) {
            await this.cameraService.disableMic(this.room()!);
            this.isMicOn.set(false);
        } else {
            await this.cameraService.enableMic(this.room()!);
            this.isMicOn.set(true);
        }
    }

    async shareScreen() {
        if(!this.room()) return;

        this.enableScreenSharing.set(true);
        const [screenTrack] = await createLocalScreenTracks({
            audio: false, // set to true to share system audio
            resolution: { width: 1920, height: 1080 },
        });

        await this.room()?.localParticipant.publishTrack(screenTrack);
        screenTrack.attach(this.screenPreview.nativeElement);
    }

    async stopScreenShare() {
        if (!this.room) return;
        
        const publications = this.room()?.localParticipant.videoTrackPublications;
        publications?.forEach((pub: LocalTrackPublication) => {
            if (pub.track?.source === 'screen_share') {
                this.room()?.localParticipant.unpublishTrack(pub.track);
                pub.track.stop();
            }
        });

        // Clear the preview
        if (this.screenPreview?.nativeElement) {
            this.screenPreview.nativeElement.srcObject = null;
        }
        this.enableScreenSharing.set(false);
    }

    showUserMicActivePopup() {
        if (this.modalInstance) {
            this.modalInstance.show();
        }
    }

    async activeMic() {
        await this.mediaPerm.requestPermissions(true, true);
    }

    getColorFromName(name: string): string {
        // Predefined color palette (Google Meet style soft colors)
        const colors = [
            "#f28b829f", "#FDD663", "#81C995", "#AECBFA", "#D7AEFB", "#FFB300",
            "#34A853", "#4285F4", "#FBBC05", "#EA4335", "#9AA0A6", "#F6C7B6"
        ];

        // Create hash from name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Pick color based on hash
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }
    

    @HostListener('window:beforeunload')
    async ngOnDestroy() {
        await this.leaveRoom();
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.mediaPerm.destroy();
    }    
}
