import { Injectable, signal, WritableSignal } from '@angular/core';
import {
  createLocalTracks,
  LocalAudioTrack,
  LocalTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';

type TrackInfo = {
  trackPublication: RemoteTrackPublication;
  participantIdentity: string;
};

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  room = signal<Room | undefined>(undefined);
  private roomInstance!: Room;
  private screenTrack?: MediaStreamTrack; // for screen share lifecycle
  remoteTracksMap = signal<Map<string, TrackInfo>>(new Map());

  constructor() {
    this.roomInstance = new Room();
  }

  async enableCamera(room: Room, deviceId?: string) {
    // First check if we already have a video track published
    const existingVideoPub = room.localParticipant.videoTrackPublications.values().next().value;
    const existingVideoTrack = existingVideoPub?.track;

    if (existingVideoTrack) {
      // If track exists but is muted, unmute it
      await existingVideoTrack.unmute();
    } else {
      // If no video track exists, create and publish one
      const tracks = await createLocalTracks({
        video: { deviceId: deviceId || undefined },
      });
      const videoTrack = tracks.find((t) => t.kind === 'video');
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack);
      }
    }
  }

  async disableCamera(room: Room) {
    room.localParticipant.videoTrackPublications.forEach((trackPub) => {
      trackPub.track?.stop();
      room.localParticipant.unpublishTrack(trackPub.track!);
    });
  }

  async switchCamera(room: Room, deviceId: string) {
    await this.disableCamera(room);
    await this.enableCamera(room, deviceId);
  }

  async enableMic(room: Room, deviceId?: string) {
    // First check if we already have an audio track published
    const existingAudioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;

    if (existingAudioTrack) {
      // If track exists but is muted, unmute it
      await existingAudioTrack.unmute();
    } else {
      // If no audio track exists, create and publish one
      const tracks = await createLocalTracks({
        audio: { deviceId: deviceId || undefined },
      });
      const audioTrack = tracks.find((t) => t.kind === 'audio');
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack);
      }
    }

    // const tracks = await createLocalTracks({
    //   audio: { deviceId: deviceId || undefined },
    // });
    // const audioTrack = tracks.find((t) => t.kind === 'audio');
    // if (audioTrack) {
    //   await room.localParticipant.publishTrack(audioTrack);
    // }
  }

  async disableMic(room: Room) {
    room.localParticipant.audioTrackPublications.forEach((trackPub) => {
      trackPub.track?.mute();
      // trackPub.track?.stop();
      // room.localParticipant.unpublishTrack(trackPub.track!);
    });
  }

  //--------------------- other code ---------------------//

  async listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cams: devices.filter(d => d.kind === 'videoinput'),
      mics: devices.filter(d => d.kind === 'audioinput'),
      speakers: devices.filter(d => d.kind === 'audiooutput'),
    };
  }

  /** Publish camera (and optionally choose deviceId + constraints) */
  async startCamera(room: Room, opts?: { deviceId?: string; }) {
    const [video] = await createLocalTracks({
      video: {
        deviceId: opts?.deviceId,
      },
    });

    await room.localParticipant.publishTrack(video);
    return video as LocalVideoTrack;
  }

  /** Publish microphone (optionally choose deviceId) */
  async startMic(room: Room, deviceId?: string) {
    const [audio] = await createLocalTracks({
      audio: { deviceId },
    });
    await room.localParticipant.publishTrack(audio);
    return audio as LocalAudioTrack;
  }

  /** Stop (unpublish) local camera */
  stopCamera(room: Room) {
    const pub = [...room.localParticipant.videoTrackPublications.values()][0];
    const track = pub?.track as LocalVideoTrack | undefined;
    if (track) {
      room.localParticipant.unpublishTrack(track);
      track.stop();
    }
  }

  /** Stop (unpublish) local mic */
  stopMic(room: Room) {
    const pub = [...room.localParticipant.audioTrackPublications.values()][0];
    const track = pub?.track as LocalAudioTrack | undefined;
    if (track) {
      room.localParticipant.unpublishTrack(track);
      track.stop();
    }
  }

  /** Switch camera to another deviceId (uses setDeviceId with restartTrack fallback) */
  async switchCamera_Old(room: Room, deviceId: string) {
    const pub = [...room.localParticipant.videoTrackPublications.values()][0];
    const videoTrack = pub?.track as LocalVideoTrack | undefined;
    if (!videoTrack) throw new Error('No local video track to switch');

    // setDeviceId exists in current SDK; if absent, fallback to restartTrack
    const anyTrack = videoTrack as LocalVideoTrack & { setDeviceId?: (id: string) => Promise<void> };
    if (typeof anyTrack.setDeviceId === 'function') {
      await anyTrack.setDeviceId(deviceId); // switches camera in place
    } else {
      await videoTrack.restartTrack({ deviceId }); // fallback path
    }
  }

  /** Switch microphone to another deviceId */
  async switchMic(room: Room, deviceId: string) {
    const pub = [...room.localParticipant.audioTrackPublications.values()][0];
    const audioTrack = pub?.track as LocalAudioTrack | undefined;
    if (!audioTrack) throw new Error('No local audio track to switch');

    const anyTrack = audioTrack as LocalAudioTrack & { setDeviceId?: (id: string) => Promise<void> };
    if (typeof anyTrack.setDeviceId === 'function') {
      await anyTrack.setDeviceId(deviceId);
    } else {
      // no setDeviceId: restart the track with new device
      await audioTrack.restartTrack({ deviceId });
    }
  }

  /** Start screen sharing (publishes a screen video track) */
  async startScreenShare(room: Room) {
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
    const track = stream.getVideoTracks()[0];
    this.screenTrack = track;
    const local = new LocalVideoTrack(track);
    await room.localParticipant.publishTrack(local, {
      source: Track.Source.ScreenShare,
    });
    // stop share if user presses "stop sharing" in browser UI
    track.onended = () => this.stopScreenShare(room);
  }

  /** Stop screen sharing */
  stopScreenShare(room: Room) {
    // find the screen-share publication
    const pub = [...room.localParticipant.videoTrackPublications.values()]
      .find(p => p.source === Track.Source.ScreenShare);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (track) {
      room.localParticipant.unpublishTrack(track);
      track.stop();
    }
    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = undefined;
    }
  }

  /** Attach a local video track to a <video> element */
  attachLocalVideo(room: Room, el: HTMLVideoElement) {
    const pub = [...room.localParticipant.videoTrackPublications.values()][0];
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track) return;
    track.attach(el);
  }

  /** Detach a local video track from a <video> element */
  detachLocalVideo(room: Room, el: HTMLVideoElement) {
    const pub = [...room.localParticipant.videoTrackPublications.values()][0];
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track) return;
    track.detach(el);
  }

  /** Stop all local tracks (camera, mic, screen share) - comprehensive cleanup */
  stopAllTracks(room: Room) {
    // Stop all video tracks
    room.localParticipant.videoTrackPublications.forEach((trackPub) => {
      if (trackPub.track) {
        trackPub.track.stop();
        room.localParticipant.unpublishTrack(trackPub.track);
      }
    });

    // Stop all audio tracks
    room.localParticipant.audioTrackPublications.forEach((trackPub) => {
      if (trackPub.track) {
        trackPub.track.stop();
        room.localParticipant.unpublishTrack(trackPub.track);
      }
    });

    // Stop screen share if active
    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = undefined;
    }
  }
}
