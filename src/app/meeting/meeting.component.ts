import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { createLocalScreenTracks, LocalTrackPublication, LocalVideoTrack, RemoteVideoTrack, Room } from 'livekit-client';
import { CameraService } from '../services/camera.service';
import { RoomService } from '../services/room.service';
import { AudioComponent } from '../audio/audio.component';
import { VideoComponent } from '../video/video.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { MediaPermissions, MediaPermissionsService } from '../services/media-permission.service';
import { BackgroundOption, BackgroundType, VideoBackgroundService } from '../services/video-background.service';
import { User } from '../preview/preview.component';
import { LocalService } from '../services/local.service';
import { TooltipDirective } from '../../directive/tooltip.directive';
import { ScreenRecorderService } from '../services/screen-recorder.service';

@Component({
    selector: 'app-meeting',
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, AudioComponent, VideoComponent, CommonModule, TooltipDirective],
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
    currentScreenTrack: RemoteVideoTrack | null = null;
    private subs: Subscription[] = [];
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
    @ViewChild('shareMeetingURLModal') shareMeetingURLModal!: ElementRef;
    private modalInstance: any;
    private videoModalInstance: any;
    private shareLinkModalInstance: any;
    currentBrowser: string = "";
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
    isMyshareScreen: boolean = false;
    mediaRecorder!: MediaRecorder;
    recordedChunks: BlobPart[] = [];
    meetingUrl = window.location.href;
    whatsappUrl: string = "";
    gmailUrl: string = "";
    tweetUrl: string = "";
    linkedInUrl: string = "";
    user: User | null = null;
    remoteAudio!: HTMLAudioElement;
    isRecording: boolean = false;
    constructor(
        private cameraService: CameraService,
        private router: ActivatedRoute,
        private roomService: RoomService,
        private route: Router,
        private mediaPerm: MediaPermissionsService,
        public videoBackgroundService: VideoBackgroundService,
        private local: LocalService,
        private recorder: ScreenRecorderService,
    ) {
        // Initialize virtual background service
        this.videoBackgroundService.initialize().catch(console.error);
    }

    async ngOnInit() {
        this.setInitialDetail();
        await this.getDeviceDetail();
        // Using snapshot (loads once)
        if (this.meetingId) {
            this.joinRoom();
        }

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

        // Subscribe to screen share updates
        this.subs.push(
            this.roomService.latestScreenShare.subscribe(share => {
                if (share) {
                    this.attachScreen(share.track);
                } else {
                    this.detachScreen();
                }
            })
        );
    }

    private setInitialDetail() {
        this.currentBrowser = this.local.getBrowserName();
        this.meetingId = this.router.snapshot.paramMap.get('id');
        this.user = this.local.getUser(this.meetingId!);
        this.isCameraOn.set(this.user?.isCameraOn!);
        this.isMicOn.set(this.user?.isMicOn!);
        this.roomForm.get('participantName')?.setValue(this.user?.Name!);
        this.timerSubscription = interval(60 * 1000).subscribe(() => {
            this.currentTime = new Date();
        });
        this.subscription = this.mediaPerm.permissions$.subscribe(
            permissions => {
                this.permissions = permissions;
            }
        );

        // Load default backgrounds
        this.backgroundOptions = this.videoBackgroundService.getBackgrounds();
    }

    private async getDeviceDetail() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.cameras = devices.filter(d => d.kind === 'videoinput');
        this.microphones = devices.filter(d => d.kind === 'audioinput');
        this.speakers = devices.filter(d => d.kind === 'audiooutput');

        this.selectedCamera = this.cameras[0]?.deviceId || null;
        this.selectedMic = this.microphones[0]?.deviceId || null;
        this.selectedSpeaker = this.speakers[0]?.deviceId || null;
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

        const shareLinkModal = document.getElementById('shareMeetingURLModal');
        if (shareLinkModal) {
            // @ts-ignore (bootstrap comes from CDN)
            this.shareLinkModalInstance = new bootstrap.Modal(shareLinkModal);

            shareLinkModal.addEventListener('shown.bs.modal', () => {
                this.shareMeetingURLModal?.nativeElement.focus();
            });
        }
    }

    async joinRoom() {
        try {
            // const roomName = this.roomForm.value.roomName!;
            const participantName = this.user?.Name; //`User-${new Date().getMilliseconds()}`; // this.roomForm.value.participantName!;
            const joinedRoom = await this.roomService.joinRoom(this.meetingId!, participantName!);

            this.room.set(joinedRoom);

            // Enable default camera & mic
            if (this.user?.isMicOn) {
                await this.cameraService.enableMic(joinedRoom);
            }
            await this.cameraService.enableCamera(joinedRoom);
            setTimeout(async () => {
                this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
            }, 100);
            // Set the local video track for disroomFormplay
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
        this.local.setCameraStatus(this.meetingId!, this.isCameraOn())
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
        this.local.setMicStatus(this.meetingId!, this.isMicOn())
    }

    async shareScreen() {
        try {
            if (!this.room()) return;

            const [screenTrack] = await createLocalScreenTracks({
                audio: false, // set to true to share system audio
                resolution: { width: 1920, height: 1080 },
            });

            if (screenTrack.mediaStreamTrack.readyState === 'ended') {
                console.warn('User cancelled screen share');
                return;
            }

            this.isMyshareScreen = true;
            // Detect when user presses "Stop sharing" in browser UI
            screenTrack.mediaStreamTrack.onended = () => {
                this.stopScreenShare(); // 👈 implement cleanup here
            };

            await this.room()?.localParticipant.publishTrack(screenTrack);
            screenTrack.attach(this.screenPreview.nativeElement);
        } catch (error) {
        }
    }

    async stopScreenShare() {
        if (!this.room) return;

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
        this.roomService.latestScreenShare.next(null);
    }

    showUserMicActivePopup() {
        if (this.modalInstance) {
            this.modalInstance.show();
        }
    }

    async activeMic() {
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
        this.subs.forEach(s => s.unsubscribe());
        this.detachScreen();
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

    sharePopupModal() {
        if (this.shareLinkModalInstance) {
            const encodedUrl = encodeURIComponent(`Join my meeting: ${window.location.href}`);
            this.whatsappUrl = `https://wa.me/?text=${encodedUrl}`;
            this.gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=Join Meeting&body=${encodedUrl}`;
            this.tweetUrl = `https://twitter.com/intent/tweet?text=${encodedUrl}`;
            this.linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${window.location.href}`;
            this.shareLinkModalInstance.show();
        }
    }

    copyLink() {
        navigator.clipboard.writeText(this.meetingUrl);
        alert("Meeting link copied!");
    }

    toggleHandRaise() {
        //this.handRaised = !this.handRaised;

        const message = JSON.stringify({
            type: 'hand_raise',
            raised: true
        });

        // Send to all participants
        this.room()?.localParticipant.publishData(
            new TextEncoder().encode('hand_raise'),
            {
                reliable: true,
                topic: 'hand_signal'
            }
        );
    }

    async changeMicrophone(deviceId: string) {
        if (!this.room) return;

        try {
            // Replace mic with the new selected device
            await this.room()?.localParticipant.setMicrophoneEnabled(true, { deviceId });
        } catch (err) {
            console.error('Failed to change microphone', err);
        }
    }

    async changeSpeaker(deviceId: string) {
        if (this.remoteAudio && (this.remoteAudio as any).setSinkId) {
            try {
                await (this.remoteAudio as any).setSinkId(deviceId);
                console.log('Speaker switched to:', deviceId);
            } catch (err) {
                console.error('Error switching speaker', err);
            }
        } else {
            console.warn('setSinkId not supported in this browser');
        }
    }

    private attachScreen(track: RemoteVideoTrack) {
        this.detachScreen(); // clean up previous
        this.currentScreenTrack = track;
        if (this.screenPreview?.nativeElement) {
            track.attach(this.screenPreview.nativeElement);
        }
    }

    private detachScreen() {
        if (this.currentScreenTrack && this.screenPreview?.nativeElement) {
            this.currentScreenTrack.detach(this.screenPreview.nativeElement);
            this.screenPreview.nativeElement.srcObject = null;
            this.currentScreenTrack = null;
            this.isMyshareScreen = false;
        }
    }

    async startVideoAudio() {
        await this.recorder.startRecording({ video: true, audio: true });
    }

    async startVideo() {
        await this.recorder.startRecording({ video: true, audio: false });
    }

    async startAudio() {
        await this.recorder.startRecording({ video: false, audio: true });
    }

    async stop() {
        // try {
        //     const blob = await this.recorder.stopRecording();
        // let transcript = await this.whisperService.transcribeAudio(this.recorder.recordedChunks);
        // this.whisperService.downloadFormattedTranscript(transcript);
        // } catch (err) {
        // console.error('Transcription error', err);
        // }
        try {
            const blob = await this.recorder.stopRecording();
            const name = `recording_${crypto.randomUUID()}`;
            this.recorder.downloadRecording(blob, name);
            this.isRecording = false;
        } catch (err) {
            alert('Error stopping recording: ' + err);
        }
    }

    getUserInitiaLetter(name: string): string {
        if (!name)
            return "";

        const words = name.split(' ').slice(0, 2);
        const initials = words.map(x => {
            if (x.length > 0) {
                return x.charAt(0).toUpperCase();
            }
            return '';
        }).join('');

        return initials;
    }
}
