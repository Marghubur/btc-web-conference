import { Injectable, signal } from '@angular/core';
import { RoomService } from './room.service';
import { LocalService } from './local.service';
import { iNavigation } from './iNavigation';
import { LocalVideoTrack, Room } from 'livekit-client';
import { CameraService } from './camera.service';
import { VideoBackgroundService } from './video-background.service';
import { User } from '../../models/model';
import { Dashboard, Login } from '../../models/constant';
import { CallEventService } from '../socket/call-event.service';

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private _isMinimized = signal(true);
  isMinimized = this._isMinimized.asReadonly();
  private _inMeeting = signal(false);
  inMeeting = this._inMeeting.asReadonly();
  room = signal<Room | undefined>(undefined);
  localTrack = signal<LocalVideoTrack | undefined>(undefined);
  user: User | null = null;
  isCameraOn = signal(true);
  isMicOn = signal(true);
  private _loading = signal(false);
  meetingId: string = "";
  isLoading = this._loading.asReadonly();
  constructor(private roomService: RoomService,
    private local: LocalService,
    private nav: iNavigation,
    private cameraService: CameraService,
    private callEventService: CallEventService,
    private videoBackgroundService: VideoBackgroundService
  ) {
  }

  minimize() { this._isMinimized.set(true); }
  maximize() { this._isMinimized.set(false); }

  userJoinRoom() { this._inMeeting.set(true); }
  userExitRoom() { this._inMeeting.set(false); }

  async leaveRoom(isNavigate: boolean = false) {
    // CRITICAL: Ensure all camera/mic tracks are fully released before leaving
    const room = this.room();
    if (room) {
      try {
        // Disable camera and mic via LiveKit - this should release the hardware
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(false);

        // Also use cameraService to stop all tracks as a safety measure
        this.cameraService.stopAllTracks(room);

        console.log('Camera and mic disabled before leaving room');
      } catch (error) {
        console.warn('Error disabling camera/mic:', error);
      }
    }

    await this.roomService.leaveRoom();
    this.room.set(undefined);
    this.localTrack.set(undefined);
    this.userExitRoom();
    this.maximize();
    if (isNavigate) {
      if (this.local.isLoggedIn()) {
        this.nav.navigate(Dashboard, null);
      }
      else {
        this.nav.navigate(Login, null);
        localStorage.clear();
      }
    }
    this.callEventService.endCall()
  }

  async joinRoom() {
    try {
      this._loading.set(true);
      this.user = this.local.getUser();
      this.isCameraOn.set(this.user?.isCameraOn!);
      this.isMicOn.set(this.user?.isMicOn!);
      // Detect available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === "audioinput");
      const hasCam = devices.some(d => d.kind === "videoinput");

      // const roomName = this.roomForm.value.roomName!;
      const participantName = this.getFullName();
      const joinedRoom = await this.roomService.joinRoom(this.meetingId!, participantName!);

      this.room.set(joinedRoom);
      this.maximize();
      this.userJoinRoom();

      // Enable default camera & mic
      if (this.isMicOn() && hasMic) {
        await this.cameraService.enableMic(joinedRoom);
        joinedRoom.localParticipant.setMicrophoneEnabled(this.isMicOn());
      }

      if (hasCam && this.room) {
        await this.cameraService.enableCamera(joinedRoom);
        // Set the local video track for disroomFormplay
        const videoPub = joinedRoom.localParticipant.videoTrackPublications.values().next().value;
        if (videoPub?.videoTrack) {
          this.localTrack.set(videoPub.videoTrack);
        }
        setTimeout(() => {
          this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
        }, 200);
      } else {
        console.warn("No camera detected, showing avatar placeholder");
        this.localTrack.set(undefined); // explicitly mark no video
      }
    } catch (error: any) {
      console.error('Error joining room:', error);
      await this.leaveRoom();
    } finally {
      this._loading.set(false);
    }
  }

  async toggleCamera() {
    if (!this.room()) return;

    this.isCameraOn.set(!this.isCameraOn());
    this.room()?.localParticipant.setCameraEnabled(this.isCameraOn());
    if (!this.isCameraOn()) {
      await this.videoBackgroundService.removeBackground(this.localTrack()!)
    }
    this.local.setCameraStatus(this.isCameraOn());
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
    this.local.setMicStatus(this.isMicOn())
  }

  private getFullName(): string {
    if (!this.user)
      this.user = this.local.getUser();

    let fullName = this.user?.firstName;
    if (this.user?.lastName)
      fullName = fullName + " " + this.user.lastName;

    return fullName;
  }
}
