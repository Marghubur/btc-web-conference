import { Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Room, LocalVideoTrack } from 'livekit-client';
import { Subscription } from 'rxjs';
import { LocalService } from '../services/local.service';
import { MediaPermissions, MediaPermissionsService } from '../services/media-permission.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnDestroy {
  @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;
  cameras: MediaDeviceInfo[] = [];
  microphones: MediaDeviceInfo[] = [];
  speakers: MediaDeviceInfo[] = [];
  roomForm = new FormGroup({
    roomName: new FormControl('Test Room', Validators.required),
    participantName: new FormControl(null, Validators.required),
  });
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
  isJoinMeeting: boolean = false;
  constructor(private route: Router,
    private router: ActivatedRoute,
    private mediaPerm: MediaPermissionsService,
    private local: LocalService
  ) { }

  joinRoom() {
    if (this.permissions.camera != 'granted') {
      alert("Please allow camera.");
      return;
    }

    if (this.permissions.microphone != 'granted') {
      alert("Please allow microphone.");
      return;
    }

    if (!this.meetingId) {
      alert("Please enter meeting id");
      return;
    }

    this.saveUser();
    this.route.navigate(["/meeting", this.meetingId]);
  }

  async ngOnInit() {
    // Using snapshot (loads once)
    await this.loadDevices();
    this.toggleCamera();
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
    let user = this.local.getUser();
    user.isMicOn= this.selectedMic != null ? this.isMicOn : false;
    user.isCameraOn= this.selectedCamera != null ? this.isCameraOn : false; 
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

  createNewMeeting() {
    this.isJoinMeeting = !this.isJoinMeeting;
    this.meetingId = this.generateRandomString();
  }

  private generateRandomString(): string {
       return `${this.randomLetters(3)}-${this.randomLetters(3)}-${this.randomLetters(6)}`;
    }

    private randomLetters(len: number): string {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    }
}

export interface User {
  isMicOn: boolean;
  isCameraOn: boolean;
  Name?: string;
  Email?: string;
}
