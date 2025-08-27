import { Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalVideoTrack, Room } from 'livekit-client';
import { VideoComponent } from '../video/video.component';
import { AudioComponent } from '../audio/audio.component';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AudioComponent, VideoComponent],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.css'
})
export class PreviewComponent implements OnDestroy {
    @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;

    cameras: MediaDeviceInfo[] = [];
    microphones: MediaDeviceInfo[] = [];
    speakers: MediaDeviceInfo[] = [];

    roomForm = new FormGroup({
        roomName: new FormControl('Test Room', Validators.required),
        participantName: new FormControl('Participant' + Math.floor(Math.random() * 100), Validators.required),
    });

    room = signal<Room | undefined>(undefined);
    localTrack = signal<LocalVideoTrack | undefined>(undefined);

    selectedCamera: string | null = null;
    selectedMic: string | null = null;
    selectedSpeaker: string | null = null;
    meetingId: string | null = null;

    private previewStream?: MediaStream;

    constructor(private route: Router, private router: ActivatedRoute) { }

    joinRoom(){
        this.route.navigate(["/meeting", this.meetingId]);
    }

    async ngOnInit() {
        // Using snapshot (loads once)
        this.meetingId = this.router.snapshot.paramMap.get('id');
        await this.loadDevices();
        await this.startPreview();        
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
    }
}

