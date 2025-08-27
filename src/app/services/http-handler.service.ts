import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HttpHandlerService {

  constructor() { }

  private sfuProdEnabled: boolean = false;
  private applicationProdEnabled: boolean = false;
  
  public setSFUProdEnabled(sfuServerMode: boolean = false) {
    this.sfuProdEnabled = sfuServerMode;
  }

  public getSFUProdEnabled(): boolean {
    return this.sfuProdEnabled;
  }

  public setApplicationProdEnabled(applicationServerMode: boolean = false) {
    this.applicationProdEnabled = applicationServerMode;
  }

  public getApplicationProdEnabled(): boolean {
    return this.applicationProdEnabled;
  }  
}
