import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JwtService } from './jwt.service';
import { AjaxService } from './ajax.service';

@Injectable({
  providedIn: 'root'
})
export class ChatServerService extends AjaxService {
  protected override baseUrl: string = environment.messageBaseUrl;

  public openChat$ = new Subject<any>();

  constructor(http: HttpClient, jwtService: JwtService) {
    super(http, jwtService);
  }
}
