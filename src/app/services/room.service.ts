import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import {
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Room,
    RoomEvent,
} from 'livekit-client';
import { lastValueFrom } from 'rxjs';
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
        this.remoteTracksMap.update((map) => {
          map.set(publication.trackSid, {
            trackPublication: publication,
            participantIdentity: participant.identity,
          });
          return map;
        });
      }
    );

    // Remove unsubscribed tracks
    room.on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, publication: RemoteTrackPublication) => {
      this.remoteTracksMap.update((map) => {
        map.delete(publication.trackSid);
        return map;
      });
    });

    const token = await this.getToken(roomName, participantName);
    await room.connect(this.LIVEKIT_URL, token);
    return room;
  }

  async leaveRoom() {
    await this.room()?.disconnect();
    this.room.set(undefined);
    this.remoteTracksMap.set(new Map());
  }
}