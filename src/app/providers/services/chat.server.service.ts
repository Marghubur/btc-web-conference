import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { JwtService } from './jwt.service';
import { AjaxService } from './ajax.service';

@Injectable({
  providedIn: 'root'
})
export class ChatServerService extends AjaxService {
  protected override baseUrl: string = environment.messageBaseUrl;

  constructor(http: HttpClient, jwtService: JwtService) {
    super(http, jwtService);
  }
}
