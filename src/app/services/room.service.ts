import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import {
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from 'livekit-client';
import { BehaviorSubject, lastValueFrom, Subject } from 'rxjs';
import { HttpHandlerService } from './http-handler.service';
import { environment } from '../../environments/environment';
import { Chat, ClappingHands, CryingFace, FacewithOpenMouth, FacewithTearsofJoy, hand_down, hand_raise, PartyPopper, reaction, SparklingHeart, ThinkingFace, ThumbsDown, ThumbsUp } from './constant';

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
  latestScreenShare = new BehaviorSubject<{ participant: Participant; track: RemoteVideoTrack; } | null>(null);
  // Expose reactions as observable
  reactions = signal<{ id: string; emoji: string, name: string }[]>([]);
  chatsMessage = signal<{ id: string; message: string, name: string, isSender: boolean, time: Date }[]>([]);
  handChnageStatus = signal<{ id: string; isHandRaise: boolean, name: string}[]>([]);
  private counter = 0;
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
        // 'Ignoring screen share track in remoteTracksMap
        if (publication.trackSid && publication.source === Track.Source.ScreenShare) {
          this.latestScreenShare.next({ participant, track: _track as RemoteVideoTrack });
        }
        if (_track.kind === 'audio') {
        // create a MediaStream from the LiveKit track's MediaStreamTrack
        try {
          const mediaTrack = _track.mediaStreamTrack; // LiveKit RemoteTrack exposes mediaStreamTrack
          const ms = new MediaStream([mediaTrack]);
          //this.whisperService._attachStreamSource(ms, `remote-${participant.identity ?? participant.sid}`);
        } catch (err) {
          console.warn('Could not create MediaStream from LiveKit track', err);
        }
      }
        if (publication.source === Track.Source.ScreenShare) {
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
      if (publication.source === Track.Source.ScreenShare) {
        const current = this.latestScreenShare.getValue();
        if (current && current.participant.identity === participant.identity)
          this.latestScreenShare.next(null);
      }
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

    // Handle participant connected
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      //this.whisperService._attachParticipantAudio(participant);
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

    // Handle hand raise
    room.on(RoomEvent.DataReceived, (payload, participant, _) => {
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === hand_raise) {
        this.updateHandStatus(participant?.identity!, true);
      } else if(msg.type == hand_down) {
        this.updateHandStatus(participant?.identity!, false);
      } else if (msg.type === reaction) {
        this.addReaction(msg.emoji, participant?.identity!);
      } else if (msg.type === Chat) {
        this.addMessage(msg.message, participant?.identity!);
      }
    });

    const token = await this.getToken(roomName, participantName);
    await room.connect(this.LIVEKIT_URL, token);
    return room;
  }

  private updateHandStatus(name: string, isRaised: boolean) {
    this.handChnageStatus.update((list) => {
      const existing = list.find(x => x.name === name);
      if (existing) {
        return list.map(x => x.name === name ? { ...x, isHandRaise: isRaised } : x);
      } else {
        return [...list, { id: crypto.randomUUID(), name, isHandRaise: isRaised }];
      }
    });
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

  sendReaction(emoji: string, name: string) {
    if (this.room) {
      const payload = JSON.stringify({ type: reaction, emoji });
      this.room()?.localParticipant.publishData(
        new TextEncoder().encode(payload),
            {
                reliable: true,
                topic: 'emoji_signal'
            }
      );

      // Also show locally
      this.addReaction(emoji, name);
    }
  }

  private addReaction(emoji: string, name: string) {
    const id = crypto.randomUUID();
    var emojiFile = "";
    switch (emoji) {
      case SparklingHeart:
        emojiFile = "assets/9.png"
        break;
      case ThumbsUp:
        emojiFile = "assets/8.png"
        break;
      case PartyPopper:
        emojiFile = "assets/7.png"
        break;
      case ClappingHands:
        emojiFile = "assets/6.png"
        break;
      case FacewithTearsofJoy:
        emojiFile = "assets/5.png"
        break;
      case FacewithOpenMouth:
        emojiFile = "assets/4.png"
        break;
      case CryingFace:
        emojiFile = "assets/3.png"
        break;
      case ThinkingFace:
        emojiFile = "assets/2.png"
        break;
      case ThumbsDown:
        emojiFile = "assets/1.png"
        break;
    }
    this.reactions.update((list) => [...list, { id: id, emoji: emojiFile, name: name }]);

    setTimeout(() => {
      this.reactions.update((list) => list.filter((r) => r.id !== id));
    }, 3000);
  }

  sendChat(message: string, name: string, isSender: boolean) {
    if (this.room) {
      const payload = JSON.stringify({ type: Chat, message });
      this.room()?.localParticipant.publishData(
        new TextEncoder().encode(payload),
            {
                reliable: true,
                topic: 'chat_signal'
            }
      );

      // Also show locally
      this.addMessage(message, name, isSender);
    }
  }

  private addMessage(message: string, name: string, isSender: boolean = false) {
    const id = ++this.counter;
    this.chatsMessage.update((list) => [...list, { id: crypto.randomUUID(), message: message, name: name, isSender: isSender, time: new Date() }]);
  }

  async leaveRoom() {
    await this.room()?.disconnect();
    this.room.set(undefined);
    this.remoteTracksMap.set(new Map());
  }
}

