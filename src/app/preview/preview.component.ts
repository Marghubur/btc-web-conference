import { Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalVideoTrack, Room } from 'livekit-client';
import { MediaPermissions, MediaPermissionsService } from '../providers/services/media-permission.service';
import { Subscription } from 'rxjs';
import { LocalService } from '../providers/services/local.service';
import { iNavigation } from '../providers/services/iNavigation';
import { Dashboard, MeetingId } from '../providers/constant';
import {  User } from '../providers/model';
import { MeetingService } from '../providers/services/meeting.service';

@Component({
    selector: 'app-preview',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './preview.component.html',
    styleUrl: './preview.component.css'
})
export class PreviewComponent implements OnDestroy {
    @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;
    cameras: MediaDeviceInfo[] = [];
    microphones: MediaDeviceInfo[] = [];
    speakers: MediaDeviceInfo[] = [];
    room = signal<Room | undefined>(undefined);
    localTrack = signal<LocalVideoTrack | undefined>(undefined);
    selectedCamera: string | null = null;
    selectedMic: string | null = null;
    selectedSpeaker: string | null = null;
    meetingId: string | null = null;
    private previewStream?: MediaStream;
    private subscription?: Subscription;
    permissions: MediaPermissions = {
        camera: 'unknown',
        microphone: 'unknown',
    };
    isMicOn: boolean = true;
    isCameraOn: boolean = true;
    isLoggedIn: boolean = false;
    meetingTitle: string = "";
    userName: string = "";
    passCode: string = "";
    isSubmitted: boolean = false;
    constructor(private nav: iNavigation,
        private route: ActivatedRoute,
        private router: Router,
        private mediaPerm: MediaPermissionsService,
        private local: LocalService,
        private meetingService: MeetingService
    ) { 
        this.isLoggedIn = local.isLoggedIn();
        this.route.queryParamMap.subscribe(paramm => {
            this.meetingId = paramm.get(MeetingId);
        });
    }

    async joinRoom() {
        this.isSubmitted = true;
        if (this.permissions.camera != 'granted') {
            alert("Please allow camera.");
            return;
        }

        if (this.permissions.microphone != 'granted') {
            alert("Please allow microphone.");
            return;
        }

        if (!this.isLoggedIn) {
            if (!this.userName) {
                alert("Please add your name");
                return;
            }

            if (!this.passCode) {
                alert("Please add meeting pass code");
                return;
            }
        }
        this.saveUser();
        this.meetingService.meetingId = this.meetingId;
        this.meetingService.maximize();
        this.meetingService.userJoinRoom();
        //this.router.navigate(['/ems/meeting', this.meetingId]);
    }

    async ngOnInit() {
        if (this.isLoggedIn) {
            let meetingDetail = this.nav.getValue();
            this.meetingId = meetingDetail.meetingId;
            this.meetingTitle = meetingDetail.title;
        }
        await this.loadDevices();
        this.toggleCamera();
        //await this.startPreview();
        this.subscription = this.mediaPerm.permissions$.subscribe(
            permissions => {
                this.permissions = permissions;
            }
        );
    }


    /** Load available media devices */
    async loadDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.cameras = devices.filter(d => d.kind === 'videoinput');
        this.microphones = devices.filter(d => d.kind === 'audioinput');
        this.speakers = devices.filter(d => d.kind === 'audiooutput');

        this.selectedCamera = this.cameras[0]?.deviceId || null;
        this.selectedMic = this.microphones[0]?.deviceId || null;
        this.selectedSpeaker = this.speakers[0]?.deviceId || null;
    }

    /** Start camera & mic preview */
    async startPreview() {
        try {
            this.previewStream = await navigator.mediaDevices.getUserMedia({
                video: this.selectedCamera ? { deviceId: this.selectedCamera } : true,
                audio: this.selectedMic ? { deviceId: this.selectedMic } : true
            });

            if (this.previewVideo && this.previewStream) {
                this.previewVideo.nativeElement.srcObject = this.previewStream;
            }

            const videoElement = this.previewVideo.nativeElement;
            videoElement.srcObject = this.previewStream;
            videoElement.muted = true; // ✅ Ensure no echo from preview video
            videoElement.play();
        } catch (err) {
            console.error('Error accessing media devices', err);
        }
    }

    async stopPreview() {
        try {
            this.previewStream?.getTracks().forEach(track => track.stop());
            if (this.previewVideo?.nativeElement) {
                this.previewVideo.nativeElement.srcObject = null;
            }
        } catch (err) {
            console.error('Error accessing media devices', err);
        }
    }

    /** Switch camera */
    async onCameraChange(event: any) {
        this.selectedCamera = event.target.value;
        await this.startPreview();
    }

    /** Switch microphone */
    async onMicChange(event: any) {
        this.selectedMic = event.target.value;
        await this.startPreview();
    }

    /** Switch speaker */
    onSpeakerChange(event: any) {
        this.selectedSpeaker = event.target.value;
        if (this.previewVideo?.nativeElement && typeof this.previewVideo.nativeElement.setSinkId === 'function') {
            this.previewVideo.nativeElement.setSinkId(this.selectedSpeaker!);
        }
    }

    /** Stop preview when leaving */
    ngOnDestroy() {
        this.previewStream?.getTracks().forEach(track => track.stop());
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.mediaPerm.destroy();
    }

    private saveUser() {
        var user: User = null;
        if (this.local.isLoggedIn()) {
            user = this.local.getUser();
            user.isCameraOn = this.selectedCamera != null ? this.isCameraOn: false,
            user.isMicOn = this.selectedMic != null ?  this.isMicOn : false;
        } else {
            user = {
                isMicOn: this.selectedMic != null ?  this.isMicOn : false,
                isCameraOn: this.selectedCamera != null ? this.isCameraOn: false,
                firstName: this.userName,
                isLogin: false,
                passCode: this.passCode
            }
        }
        this.local.setUser(user)
    }

    async toggleCamera() {
        if (this.isCameraOn) {
            await this.stopPreview()
        } else {
            await this.startPreview();
        }
        this.isCameraOn = !this.isCameraOn;
    }

    toggleMic() {
        this.isMicOn = !this.isMicOn;
    }

    navToDahsboard() {
        this.nav.navigate(Dashboard, null);
    }
}