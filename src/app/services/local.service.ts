import { Injectable } from '@angular/core';
import { User } from '../preview/preview.component';
import { BTCUSer } from './constant';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  constructor() { }

  setUser(user: User) {
    sessionStorage.setItem(BTCUSer, JSON.stringify(user));
  }

  getUser(): User {
    var userJson = sessionStorage.getItem(BTCUSer);
    return JSON.parse(userJson!);
  }

  setMicStatus(isMicOn: boolean) {
    var user = this.getUser();
    if (user) {
      user.isMicOn = isMicOn;
      this.setUser(user);
    }
  }

  setCameraStatus(isCameraOn: boolean) {
    var user = this.getUser();
    if (user) {
      user.isCameraOn = isCameraOn;
      this.setUser(user);
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
