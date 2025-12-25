import { AfterViewInit, Component, effect, ElementRef, HostListener, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { createLocalScreenTracks, LocalTrackPublication, LocalVideoTrack, RemoteVideoTrack, Room } from 'livekit-client';
import { RoomService } from '../providers/services/room.service';
import { AudioComponent } from '../audio/audio.component';
import { VideoComponent } from '../video/video.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { MediaPermissions, MediaPermissionsService } from '../providers/services/media-permission.service';
import { BackgroundOption, BackgroundType, VideoBackgroundService } from '../providers/services/video-background.service';
import { LocalService } from '../providers/services/local.service';
import { ScreenRecorderService } from '../providers/services/screen-recorder.service';
import { NgbTooltipConfig, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { MeetingService } from '../providers/services/meeting.service';
import { NetworkService } from '../providers/services/network.service';
import { CameraService } from '../providers/services/camera.service';
import { iNavigation } from '../providers/services/iNavigation';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Offcanvas } from 'bootstrap';
import { User } from '../models/model';
import { hand_down, hand_raise } from '../models/constant';
@Component({
    selector: 'app-meeting',
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, AudioComponent, VideoComponent, CommonModule, NgbTooltipModule],
    templateUrl: './meeting.component.html',
    styleUrl: './meeting.component.css',
    providers: [NgbTooltipConfig],
    animations: [
        trigger('slideFade', [
            state('hidden', style({ opacity: 0, height: '0px', overflow: 'hidden', width: '0px' })),
            state('visible', style({ opacity: 1, height: '*', overflow: 'hidden', width: '16.66666667%' })),
            transition('hidden <=> visible', animate('300ms ease'))
        ])
    ]
})
export class MeetingComponent implements OnDestroy, OnInit {
    // Reference to the dedicated <video> element for screen sharing
    @ViewChild('screenPreview') screenPreview!: ElementRef<HTMLVideoElement>;
    @ViewChild('seetingOffCanvas') offcanvasRef!: ElementRef;
    private offcanvasInstance!: Offcanvas;
    @ViewChild('virtualBackgroundOffcanvas') virtualBackgroundOffcanvasRef!: ElementRef;
    private virtualBackgroundOffcanvasInstance!: Offcanvas;
    @ViewChild('chatOffCanvas') chatOffCanvasRef!: ElementRef;
    private chatOffCanvasInstance!: Offcanvas;
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
    // isCameraOn = signal(true);
    // isMicOn = signal(true);
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
    textMessage: string = "";
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
    recordingAndType: RecordingAndType = { isAudioRecording: false, isRecording: false, isTranscribe: false, isVideoRecording: false };
    timeInSeconds: number = 0;
    private watchSubscription: Subscription | null = null;
    private timer$ = interval(1000);
    handRaised: boolean = false;
    private notified = new Set<string>(); // tracks who is already raised
    isViewParticipant: boolean = false;
    constructor(
        private cameraService: CameraService,
        private route: ActivatedRoute,
        public roomService: RoomService,
        private nav: iNavigation,
        private router: Router,
        private mediaPerm: MediaPermissionsService,
        public videoBackgroundService: VideoBackgroundService,
        private local: LocalService,
        private recorder: ScreenRecorderService,
        public network: NetworkService,
        public meetingService: MeetingService,
        private tooltipConfig: NgbTooltipConfig
    ) {
        // Configure tooltips to close properly on click
        this.tooltipConfig.triggers = 'hover';
        this.tooltipConfig.container = 'body';

        // Initialize virtual background service
        this.videoBackgroundService.initialize().catch(console.error);
        effect(() => {
            const list = this.roomService.handChnageStatus();

            // Collect current raised hands
            const currentlyRaised = new Set(list.filter(u => u.isHandRaise).map(u => u.name));

            // Find newly raised (in current but not in notified)
            currentlyRaised.forEach(name => {
                if (!this.notified.has(name)) {
                    this.showNotification(`${name} raised hand ✋`);
                }
            });

            // Update our tracking set
            this.notified = currentlyRaised;
        });
    }

    async ngOnInit() {
        //this.meetingId = this.route.snapshot.paramMap.get('id');
        this.meetingId = this.meetingService.meetingId;
        if (!this.local.isValidUser()) {
            this.router.navigate(['/btc/preview'], { queryParams: { meetingid: this.meetingId } });
        }
        this.setInitialDetail();
        // Load default backgrounds
        this.backgroundOptions = this.videoBackgroundService.getBackgrounds();
        await this.getDeviceDetail();
        // Using snapshot (loads once)
        if (this.meetingId) {
            await this.meetingService.joinRoom();
            this.room.set(this.meetingService.room());
            this.localTrack.set(this.meetingService.localTrack());
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

        if (this.meetingService.inMeeting()) {
            history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', this.popStateListener);
        }

    }

    private setInitialDetail() {
        this.currentBrowser = this.local.getBrowserName();
        this.user = this.local.getUser();
        // this.isCameraOn.set(this.user?.isCameraOn!);
        // this.isMicOn.set(this.user?.isMicOn!);
        this.roomForm.get('participantName')?.setValue(this.getFullName());
        this.timerSubscription = interval(60 * 1000).subscribe(() => {
            this.currentTime = new Date();
        });
        this.subscription = this.mediaPerm.permissions$.subscribe(
            permissions => {
                this.permissions = permissions;
            }
        );
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
    }

    // async joinRoom() {
    //     try {
    //         // Detect available devices
    //         const devices = await navigator.mediaDevices.enumerateDevices();
    //         const hasMic = devices.some(d => d.kind === "audioinput");
    //         const hasCam = devices.some(d => d.kind === "videoinput");

    //         // const roomName = this.roomForm.value.roomName!;
    //         const participantName = this.getFullName();
    //         const joinedRoom = await this.roomService.joinRoom(this.meetingId!, participantName!);

    //         this.room.set(joinedRoom);
    //         // Enable default camera & mic
    //         if (this.user?.isMicOn && hasMic) {
    //             await this.cameraService.enableMic(this.room());
    //         }

    //         if (hasCam) {
    //             await this.cameraService.enableCamera(this.room());
    //             // Set the local video track for disroomFormplay
    //             const videoPub = this.room().localParticipant.videoTrackPublications.values().next().value;
    //             if (videoPub?.videoTrack) {
    //                 this.localTrack.set(videoPub.videoTrack);
    //             }
    //             setTimeout(async () => {
    //                 this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
    //             }, 100);
    //         } else {
    //             console.warn("No camera detected, showing avatar placeholder");
    //             this.localTrack.set(undefined); // explicitly mark no video
    //         }
    //     } catch (error: any) {
    //         console.error('Error joining room:', error);
    //         await this.leaveRoom();
    //     }
    // }

    async leaveRoom(isNavigate: boolean = false) {
        await this.meetingService.leaveRoom(isNavigate);
    }

    async toggleCamera() {
        // if (!this.room()) return;

        // this.isCameraOn.set(!this.isCameraOn());
        // this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
        // if (!this.isCameraOn()) {
        //     await this.videoBackgroundService.removeBackground(this.localTrack()!)
        // }
        // this.local.setCameraStatus(this.isCameraOn())
        await this.meetingService.toggleCamera();
    }

    async toggleMic() {
        // if (!this.room()) return;

        // if (this.isMicOn()) {
        //     await this.cameraService.disableMic(this.room()!);
        //     this.isMicOn.set(false);
        // } else {
        //     await this.cameraService.enableMic(this.room()!);
        //     this.isMicOn.set(true);
        // }
        // this.room()?.localParticipant.setMicrophoneEnabled(this.isMicOn());
        // this.local.setMicStatus(this.isMicOn())
        await this.meetingService.toggleMic()
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
        //await this.leaveRoom();
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
        this.stopTimer();
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
        this.handRaised = !this.handRaised;
        const message = JSON.stringify({
            type: this.handRaised ? hand_raise : hand_down,
            raised: this.handRaised
        });

        this.room()?.localParticipant.publishData(
            new TextEncoder().encode(message),
            {
                reliable: true,
                topic: 'hand_signal'
            }
        );
    }

    sendReaction(emoji: string) {
        this.roomService.sendReaction(emoji, 'You')
    }

    sendChat(event: any) {
        event.preventDefault();
        if (this.textMessage) {
            this.roomService.sendChat(this.textMessage, this.roomForm.value.participantName!, true);
            this.textMessage = "";
            const audio = new Audio('/assets/message-pop-alert.mp3');
            audio.play().catch(() => { });
        }
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

    // Screen Recording Methods
    async startScreenVideoAudio() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: false, isTranscribe: false, isVideoRecording: true };
        await this.recorder.startRecording({ video: true, audio: true, source: 'screen' });
    }

    async startScreenVideo() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: false, isTranscribe: false, isVideoRecording: true };
        await this.recorder.startRecording({ video: true, audio: false, source: 'screen' });
    }

    // Camera Recording Methods
    async startCameraVideoAudio() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: false, isTranscribe: false, isVideoRecording: true };
        await this.recorder.startRecording({ video: true, audio: true, source: 'camera' });
    }

    async startCameraVideo() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: false, isTranscribe: false, isVideoRecording: true };
        await this.recorder.startRecording({ video: true, audio: false, source: 'camera' });
    }

    // Audio Only Recording
    async startAudio() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: true, isTranscribe: false, isVideoRecording: false };
        await this.recorder.startRecording({ video: false, audio: true, source: 'camera' });
    }

    async startTranscribe() {
        this.startTimer();
        this.recordingAndType = { isRecording: true, isAudioRecording: true, isTranscribe: true, isVideoRecording: false };
        await this.recorder.startRecording({ video: false, audio: true, source: 'camera' });
    }

    // Pause/Resume Recording
    togglePauseResume() {
        this.recorder.togglePauseResume();
    }

    // Cancel Recording
    cancelRecording() {
        this.recorder.cancelRecording();
        this.stopTimer();
        this.recordingAndType = { isRecording: false, isAudioRecording: false, isTranscribe: false, isVideoRecording: false };
    }

    async stopRecording() {
        try {
            this.stopTimer();
            this.recordingAndType.isRecording = false;
            const blob = await this.recorder.stopRecording();
            const name = `recording_${crypto.randomUUID()}`;
            if (this.recordingAndType.isTranscribe) {
                this.recorder.downloadAudioToText(blob, name);
            } else {
                this.recorder.downloadRecording(blob, name);
            }
            this.recordingAndType = { isRecording: false, isAudioRecording: false, isTranscribe: false, isVideoRecording: false };
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

    private startTimer(): void {
        this.timeInSeconds = 0;
        this.watchSubscription = this.timer$.subscribe(() => {
            this.timeInSeconds++;
        });
    }

    private stopTimer(): void {
        if (this.watchSubscription) {
            this.watchSubscription.unsubscribe();
            this.watchSubscription = null;
        }
        this.timeInSeconds = 0;
    }

    public formatTime(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        // Use String.padStart() to ensure two digits
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');

        return `${formattedMinutes}:${formattedSeconds}`;
    }

    private showNotification(message: string) {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-bg-primary border-0 show position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '1055';
        toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    private getFullName(): string {
        let fullName = this.user?.firstName;
        if (this.user?.lastName)
            fullName = fullName + " " + this.user.lastName;

        return fullName;
    }

    private popStateListener = (event: PopStateEvent) => {
        if (this.meetingService.inMeeting()) {
            history.pushState(null, '', window.location.href); // push state back
            alert('You cannot navigate back during a meeting.');
        }
    };

    @HostListener('window:beforeunload', ['$event'])
    handleBeforeUnload(event: BeforeUnloadEvent) {
        if (this.meetingService.inMeeting()) {
            event.preventDefault();
            // Modern browsers ignore custom text and show a generic confirm
            event.returnValue = '';
            return '';
        }
        return;
    }

    openSeetingOffCanvas() {
        this.offcanvasInstance = new Offcanvas(this.offcanvasRef.nativeElement);
        this.offcanvasInstance.show();
    }

    closeSeetingOffCanvas() {
        this.offcanvasInstance.hide();
    }

    openVirtualBackgroundOffcanvas() {
        this.virtualBackgroundOffcanvasInstance = new Offcanvas(this.virtualBackgroundOffcanvasRef.nativeElement);
        this.virtualBackgroundOffcanvasInstance.show();
    }

    closeVirtualBackgroundOffcanvas() {
        this.virtualBackgroundOffcanvasInstance.hide();
    }

    openChatOffCanvas() {
        this.chatOffCanvasInstance = new Offcanvas(this.chatOffCanvasRef.nativeElement);
        this.chatOffCanvasInstance.show();
    }

    closeChatOffCanvas() {
        this.chatOffCanvasInstance.hide();
    }
}


interface RecordingAndType {
    isRecording: boolean;
    isAudioRecording: boolean;
    isVideoRecording: boolean;
    isTranscribe: boolean;
}

export interface Reaction {
    id: number;
    emoji: string;
    name: string;
}