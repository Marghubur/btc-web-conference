import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { LocalVideoTrack, Room } from 'livekit-client';
import { CameraService } from '../services/camera.service';
import { RoomService } from '../services/room.service';
import { AudioComponent } from '../audio/audio.component';
import { VideoComponent } from '../video/video.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-meeting',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AudioComponent, VideoComponent],
  templateUrl: './meeting.component.html',
  styleUrl: './meeting.component.css'
})
export class MeetingComponent implements OnDestroy, OnInit {
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

    isCameraOn = signal(true);
    isMicOn = signal(true);

    constructor(
        private cameraService: CameraService,
        private router: ActivatedRoute,
        private roomService: RoomService,
        private route: Router
    ) { }

    async ngOnInit() {
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
        
        if (this.isCameraOn()) {
            await this.cameraService.disableCamera(this.room()!);
            this.isCameraOn.set(false);
        } else {
            await this.cameraService.enableCamera(this.room()!);
            this.isCameraOn.set(true);
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
    }

    @HostListener('window:beforeunload')
    async ngOnDestroy() {
        await this.leaveRoom();
    }    
}
