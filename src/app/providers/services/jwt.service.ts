import { Injectable } from '@angular/core';
import { AccessToken, BTCUSer } from '../../models/constant';

@Injectable({
  providedIn: 'root'
})
export class JwtService {
  constructor() { }

  getJwtToken() {
    let Token = localStorage.getItem(AccessToken);
    return Token;
  }

  setJwtToken(token: string) {
    if (token !== null && token !== '') {
      localStorage.setItem(AccessToken, token);
    }
  }

  setLoginDetail(res: any): boolean {
    if (res !== undefined && res !== null) {
      this.removeJwtToken();
      this.setJwtToken(res.token!);
      res.token = "";
      res.isLogin = true;
      localStorage.setItem(BTCUSer, JSON.stringify(res));
      return true;
    }

    return false;
  }

  removeJwtToken() {
    localStorage.removeItem(AccessToken);
    localStorage.removeItem(BTCUSer);
  }
}