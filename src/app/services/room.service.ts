import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import {
  Participant,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Room,
    RoomEvent,
    Track,
    TrackPublication,
} from 'livekit-client';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { HttpHandlerService } from './http-handler.service';
import { environment } from '../../environments/environment';

type TrackInfo = {
    trackPublication: RemoteTrackPublication;
    participantIdentity: string;
};

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  private APPLICATION_SERVER_URL = '';
  private LIVEKIT_URL = '';
  private ipAddress = 'localhost';
  private liveAddress: any = 'www.axilcorps.com';
  private sfuProdEnabled: boolean = false;
  private applicationProdEnabled: boolean = false;

  room = signal<Room | undefined>(undefined);
  remoteTracksMap = signal<Map<string, any>>(new Map());
  remoteSharescreenTrack = signal<any>(null);
  participantMediaStatus = signal<Map<string, any>>(new Map());
  private screenShareSource = new BehaviorSubject<boolean | false>(false);
  screenShare$ = this.screenShareSource.asObservable();
  constructor(private httpClient: HttpClient, private http: HttpHandlerService) {
    http.setSFUProdEnabled(true);
    this.sfuProdEnabled = http.getSFUProdEnabled();
    this.applicationProdEnabled = http.getApplicationProdEnabled();
    this.configureUrls();
  }

  private configureUrls() {    
    if (!this.APPLICATION_SERVER_URL) {
      if (environment.production) {
        this.APPLICATION_SERVER_URL = 'https://' + environment.appServerBaseUrl;
      } else {
        this.APPLICATION_SERVER_URL = 'http://' + environment.appServerBaseUrl;
      }
    }

    if (!this.LIVEKIT_URL) {
      if (environment.production) {
        this.LIVEKIT_URL = 'wss://' + environment.sfuBaseUrl + "/conference";
      } else {
        // this.LIVEKIT_URL = 'ws://' + environment.sfuBaseUrl + "/conference";
        this.LIVEKIT_URL = 'wss://' + environment.sfuBaseUrl + "/conference";
      }
    }
  }

  async getToken(roomName: string, participantName: string): Promise<string> {
    const response = await lastValueFrom(
      this.httpClient.post<{ token: string }>(
        this.APPLICATION_SERVER_URL + 'conference/token',
        { roomName, participantName }
      )
    );
    return response.token;
  }

  async joinRoom(roomName: string, participantName: string): Promise<Room> {
    const room = new Room();
    this.room.set(room);

    // Listen for subscribed tracks
    room.on(
      RoomEvent.TrackSubscribed,
      (_track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (publication.source === Track.Source.ScreenShare) {
          console.log('Ignoring screen share track in remoteTracksMap');
          this.remoteSharescreenTrack.set({
            trackSid: publication.trackSid, 
            trackPublication: publication,
            participantIdentity: participant.identity,
          });
          return;
        }
        this.remoteTracksMap.update((map) => {
          map.set(publication.trackSid, {
            trackPublication: publication,
            participantIdentity: participant.identity,
          });
          return map;
        });

        // Update participant media status
        this.updateParticipantMediaStatus(participant);
      }
    );

    // Remove unsubscribed tracks
    room.on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      this.remoteTracksMap.update((map) => {
        map.delete(publication.trackSid);
        return map;
      });

      // Update participant media status
        this.updateParticipantMediaStatus(participant);
    });

    // Handle track muted/unmuted
    room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
      
      if (participant instanceof RemoteParticipant) {
        this.updateParticipantMediaStatus(participant);
      }
    });

    room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => {
      if (participant instanceof RemoteParticipant) {
        this.updateParticipantMediaStatus(participant);
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (publication.trackSid && publication.source === Track.Source.ScreenShare) {
        this.screenShareSource.next(true);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        this.screenShareSource.next(false); // reset when stop sharing
      }
    });

    // Handle participant connected
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.updateParticipantMediaStatus(participant);
    });

    // Handle participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      this.participantMediaStatus.update((map) => {
        map.delete(participant.identity);
        return map;
      });
    });

    // Handle existing participants after connection
    room.on(RoomEvent.Connected, () => {
      room.remoteParticipants.forEach((participant) => {
        this.updateParticipantMediaStatus(participant);
      });
    });

    const token = await this.getToken(roomName, participantName);
    await room.connect(this.LIVEKIT_URL, token);
    return room;
  }

  private updateParticipantMediaStatus(participant: RemoteParticipant) {
    let cameraTrackPublication: RemoteTrackPublication | undefined;
    let audioTrackPublication: RemoteTrackPublication | undefined;

    // Find camera and audio tracks
    for (const [, publication] of participant.trackPublications) {
      if (publication.kind === Track.Kind.Video && publication.source === Track.Source.Camera) {
        cameraTrackPublication = publication;
      } else if (publication.kind === Track.Kind.Audio && publication.source === Track.Source.Microphone) {
        audioTrackPublication = publication;
      }
    }

    const mediaStatus = {
      participantIdentity: participant.identity,
      participantName: participant.name || participant.identity,
      // Camera status
      hasCameraTrack: !!cameraTrackPublication,
      isCameraEnabled: cameraTrackPublication ? !cameraTrackPublication.isMuted : false,
      // Audio status
      hasAudioTrack: !!audioTrackPublication,
      isAudioEnabled: audioTrackPublication ? !audioTrackPublication.isMuted : false,
    };

    this.participantMediaStatus.update((map) => {
      map.set(participant.identity, mediaStatus);
      return map;
    });

  }
  
  getParticipantMediaStatus(participantIdentity: string): any | undefined {
    return this.participantMediaStatus().get(participantIdentity);
  }

  updateLocalParticipantStatus(participantIdentity: string, isMicEnabled?: boolean) {
    var mediaStatus = this.participantMediaStatus().get(participantIdentity);
    mediaStatus.isAudioEnabled = isMicEnabled;

    this.participantMediaStatus.update((map) => {
      map.set(participantIdentity, mediaStatus);
      return map;
    });
  }

  async leaveRoom() {
    await this.room()?.disconnect();
    this.room.set(undefined);
    this.remoteTracksMap.set(new Map());
  }
}

