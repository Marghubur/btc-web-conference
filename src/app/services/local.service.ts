import { Injectable } from '@angular/core';
import { User } from '../preview/preview.component';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  constructor() { }

  setUser(meetingId: string, user: User) {
    sessionStorage.setItem(meetingId, JSON.stringify(user));
  }

  getUser(meetingId: string): User {
    var userJson = sessionStorage.getItem(meetingId);
    return JSON.parse(userJson!);
  }

  setMicStatus(meetingId: string, isMicOn: boolean) {
    var user = this.getUser(meetingId);
    if (user) {
      user.isMicOn = isMicOn;
      this.setUser(meetingId, user);
    }
  }

  setCameraStatus(meetingId: string, isCameraOn: boolean) {
    var user = this.getUser(meetingId);
    if (user) {
      user.isCameraOn = isCameraOn;
      this.setUser(meetingId, user);
    }
  }

  getBrowserName(): string {
        const userAgent = navigator.userAgent;

        if (/edg/i.test(userAgent)) {
        return 'Edge';
        } else if (/chrome|chromium|crios/i.test(userAgent)) {
        return 'Chrome';
        } else if (/firefox|fxios/i.test(userAgent)) {
        return 'Firefox';
        } else if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) {
        return 'Safari';
        } else if (/opr\//i.test(userAgent)) {
        return 'Opera';
        } else if (/msie|trident/i.test(userAgent)) {
        return 'Internet Explorer';
        } else {
        return 'Unknown';
        }
    }
}
