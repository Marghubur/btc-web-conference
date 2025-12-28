import { Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalVideoTrack, Room } from 'livekit-client';
import { MediaPermissions, MediaPermissionsService } from '../providers/services/media-permission.service';
import { Subscription } from 'rxjs';
import { LocalService } from '../providers/services/local.service';
import { iNavigation } from '../providers/services/iNavigation';
import { MeetingService } from '../providers/services/meeting.service';
import { AjaxService } from '../providers/services/ajax.service';
import { Dashboard, MeetingId } from '../models/constant';
import { ResponseModel, User } from '../models/model';
import { DeviceService } from '../layout/device.service';
import { CallType } from '../models/conference_call/call_model';

@Component({
    selector: 'app-preview',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './preview.component.html',
    styleUrl: './preview.component.css'
})
export class PreviewComponent implements OnDestroy {
    @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;

    selectedCamera: string | null = null;
    selectedMic: string | null = null;
    selectedSpeaker: string | null = null;

    room = signal<Room | undefined>(undefined);
    localTrack = signal<LocalVideoTrack | undefined>(undefined);
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
    isValidMeetingId: boolean = false;
    callType: string = CallType.AUDIO;

    constructor(private nav: iNavigation,
        private route: ActivatedRoute,
        private router: Router,
        private mediaPerm: MediaPermissionsService,
        private local: LocalService,
        private meetingService: MeetingService,
        private http: AjaxService,
        private deviceService: DeviceService
    ) {
        this.isLoggedIn = local.isLoggedIn();
        this.route.queryParamMap.subscribe(paramm => {
            this.meetingId = paramm.get(MeetingId);
        });
    }

    async ngOnInit() {
        this.selectedCamera = this.deviceService.selectedCamera();
        this.selectedMic = this.deviceService.selectedMic();
        this.selectedSpeaker = this.deviceService.selectedSpeaker();
        if (this.isLoggedIn) {
            this.readRoutedMeetingDetail();
            this.enableStream();
            this.subscription = this.mediaPerm.permissions$.subscribe(
                permissions => {
                    this.permissions = permissions;
                    if (permissions.camera == 'granted' &&
                        permissions.microphone == 'granted') {
                        this.joinRoom();
                    }
                }
            );
        } else {
            this.validatMeetingId();
        }
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
        }

        // Stop the preview stream before joining to release the camera
        // LiveKit will create its own stream when joining the room
        if (this.previewStream) {
            this.previewStream.getTracks().forEach(track => track.stop());
            this.previewStream = undefined;
        }
        if (this.previewVideo?.nativeElement) {
            this.previewVideo.nativeElement.srcObject = null;
        }

        this.saveUser();
        this.meetingService.meetingId = this.meetingId;
        this.meetingService.maximize();
        this.meetingService.userJoinRoom();
    }

    readRoutedMeetingDetail() {
        const state = history.state;

        if (state?.id) {
            this.meetingId = state.id;
        }

        if (state?.title) {
            this.meetingTitle = state.title;
        }

        if (state?.type) {
            this.callType = state.type;
        }

        // Fallback to nav service if state is not available
        if (!this.meetingId || !this.meetingTitle) {
            let meetingDetail = this.nav.getValue();
            if (meetingDetail) {
                this.meetingId = this.meetingId || meetingDetail.meetingId;
                this.meetingTitle = this.meetingTitle || meetingDetail.title;
                this.isValidMeetingId = true;
            }
        } else {
            this.isValidMeetingId = true;
        }
    }

    async validatMeetingId() {
        if (this.meetingId) {
            const match = this.meetingId.match(/_(\d+)$/);
            let meetingDetailId = match ? +match[1] : null;
            const updatedId = this.meetingId.replace(/_\d+$/, "");
            let value = {
                meetingId: updatedId,
                meetingDetailId: meetingDetailId
            };
            this.http.post(`meeting/validateMeeting`, value).then((res: ResponseModel) => {
                if (res.ResponseBody) {
                    this.isValidMeetingId = true;
                    this.meetingTitle = res.ResponseBody.title;
                    this.enableStream();
                    this.subscription = this.mediaPerm.permissions$.subscribe(
                        permissions => {
                            this.permissions = permissions;
                        }
                    );
                }
            }).catch(e => {
                this.isValidMeetingId = false;
            })
        } else {
            this.isValidMeetingId = false;
        }
    }


    /** Load available media devices */
    async enableStream() {
        try {
            // Request permission first - this is required to get real device IDs
            this.previewStream = await navigator.mediaDevices.getUserMedia({
                video: !(this.callType == CallType.AUDIO),
                audio: true,
            });

            // Use the existing stream for preview instead of creating a new one
            if (this.previewVideo?.nativeElement) {
                this.previewVideo.nativeElement.srcObject = this.previewStream;
                this.previewVideo.nativeElement.muted = true;
                this.previewVideo.nativeElement.play();
            }

            this.isCameraOn = !(this.callType == CallType.AUDIO);
            this.isMicOn = true;
        } catch (err) {
            console.error('Error accessing media devices', err);
        }
    }

    /** Start camera & mic preview */
    async startPreview() {
        try {
            // Stop existing stream first to prevent orphaned streams
            if (this.previewStream) {
                this.previewStream.getTracks().forEach(track => track.stop());
            }

            this.previewStream = await navigator.mediaDevices.getUserMedia({
                video: this.selectedCamera ? { deviceId: this.selectedCamera } : true,
                audio: this.selectedMic ? { deviceId: this.selectedMic } : true
            });

            if (this.previewVideo?.nativeElement && this.previewStream) {
                this.previewVideo.nativeElement.srcObject = this.previewStream;
                this.previewVideo.nativeElement.muted = true;
                this.previewVideo.nativeElement.play();
            }
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
        // Stop all tracks in the preview stream
        if (this.previewStream) {
            this.previewStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped track: ${track.kind}`);
            });
            this.previewStream = undefined;
        }

        // Clear the video element's srcObject
        if (this.previewVideo?.nativeElement) {
            this.previewVideo.nativeElement.srcObject = null;
        }

        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.mediaPerm.destroy();
    }

    private saveUser() {
        var user: User = null;
        if (this.local.isLoggedIn()) {
            user = this.local.getUser();
            user.isCameraOn = this.selectedCamera != null ? this.isCameraOn : false,
                user.isMicOn = this.selectedMic != null ? this.isMicOn : false;
        } else {
            user = {
                isMicOn: this.selectedMic != null ? this.isMicOn : false,
                isCameraOn: this.selectedCamera != null ? this.isCameraOn : false,
                firstName: this.userName,
                isLogin: false,
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