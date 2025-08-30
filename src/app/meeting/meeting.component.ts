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
import { BackgroundOption, BackgroundType, VideoBackgroundService } from '../services/video-background.service';

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
    remoteSharescreenTrack = this.roomService.remoteSharescreenTrack;
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
    private videoModalInstance: any;
    get remoteUsersCount(): number {
        const map = this.remoteTracksMap();
        const uniqueParticipants = new Set(
            Array.from(map.values()).map(track => track.participantIdentity)
        );
        return uniqueParticipants.size;
    }

    backgroundOptions: BackgroundOption[] = [];
    selectedBackground: BackgroundOption | null = null;
    isProcessing = false;
    private subscriptions = new Subscription();
    frames: Array<number> = [1,2, 3,4,5, 6 ,7, 8, 9,10];
    isMyshareScreen: boolean = false;
    constructor(
        private cameraService: CameraService,
        private router: ActivatedRoute,
        private roomService: RoomService,
        private route: Router,
        private mediaPerm: MediaPermissionsService,
        public videoBackgroundService: VideoBackgroundService
    ) {
        // Initialize virtual background service
        this.videoBackgroundService.initialize().catch(console.error);
    }

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

        // Load default backgrounds
        this.backgroundOptions = this.videoBackgroundService.getBackgrounds();

        // Subscribe to current background
        this.subscriptions.add(
            this.videoBackgroundService.getCurrentBackground().subscribe(bg => {
                this.selectedBackground = bg;
            })
        );

        // Subscribe to processing status
        this.subscriptions.add(
            this.videoBackgroundService.getProcessingStatus().subscribe(status => {
                this.isProcessing = status;
            })
        );

        this.roomService.screenShare$.subscribe(value => {
            this.enableScreenSharing.set(value);
        });
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
            this.videoModalInstance = new bootstrap.Modal(cameraActiveModal);

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
        if (!this.isCameraOn()) {
            await this.videoBackgroundService.removeBackground(this.localTrack()!)
        }
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
        this.room()?.localParticipant.setMicrophoneEnabled(this.isMicOn());
    }

    async shareScreen() {
        try {
            if(!this.room()) return;
            
            const [screenTrack] = await createLocalScreenTracks({
                audio: false, // set to true to share system audio
                resolution: { width: 1920, height: 1080 },
            });
            
            this.enableScreenSharing.set(true);
            this.isMyshareScreen = true;
            // Detect when user presses "Stop sharing" in browser UI
            screenTrack.mediaStreamTrack.onended = () => {
                console.log("User stopped screen sharing");
                this.stopScreenShare(); // 👈 implement cleanup here
            };
    
            await this.room()?.localParticipant.publishTrack(screenTrack);
            screenTrack.attach(this.screenPreview.nativeElement);
        } catch (error) {
            this.enableScreenSharing.set(false);          
        }
    }

    async stopScreenShare() {
        if (!this.room) return;
        
        this.enableScreenSharing.set(false);
        this.isMyshareScreen = false;
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
    }

    showUserMicActivePopup() {
        if (this.modalInstance) {
            this.modalInstance.show();
        }
    }

    async activeMic() {
        console.log("Working")
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        //this.mediaPerm.requestPermissions(true, true);
    }

    showUseCameraActivePopup() {
        if (this.videoModalInstance) {
            this.videoModalInstance.show();
        }
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

    isParticipantCameraEnabled(participantIdentity: string): boolean {
        const status = this.roomService.getParticipantMediaStatus(participantIdentity);
        return status ? (status.hasCameraTrack && status.isCameraEnabled) : false;
    }

    isParticipantAudioEnabled(participantIdentity: string): boolean {
        const status = this.roomService.getParticipantMediaStatus(participantIdentity);
        return status ? (status.hasAudioTrack && status.isAudioEnabled) : false;
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
        this.subscriptions.unsubscribe();
    } 
    
    async selectBackground(option: BackgroundOption) {
        if (this.isProcessing) return;
        if (!this.localTrack()) {
            throw new Error('Camera must be enabled to apply virtual background');
        }

        this.selectedBackground = option;
        try {
            await this.videoBackgroundService.applyBackground(this.localTrack()!, this.selectedBackground);
        } catch (error) {
            console.error('Failed to apply virtual background:', error);
            throw error;
        }
    }

    getBackgroundTypeIcon(type: BackgroundType): string {
        switch (type) {
            case BackgroundType.NONE:
                return 'close';
            case BackgroundType.BLUR:
                return 'blur_on';
            case BackgroundType.IMAGE:
                return 'image';
            default:
                return 'help';
        }
    }
}
