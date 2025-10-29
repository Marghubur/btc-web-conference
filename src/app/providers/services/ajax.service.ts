import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ResponseModel } from '../model';
import { JwtService } from './jwt.service';

@Injectable({
  providedIn: 'root'
})
export class AjaxService {
  private basUrl: string =environment.appServerBaseUrl;

  constructor(private http: HttpClient,
              private jwtService: JwtService
  ) { }

  async login(Url: string, Param: any): Promise<ResponseModel> {
    return new Promise((resolve, reject) => {
      this.http
        .post(this.basUrl + Url, Param, {
          observe: 'response',
        })
        .subscribe({
          next: (res: HttpResponse<any>) => {
            try {
              if (res.body) {
                let loginData: ResponseModel = res.body;
                if (this.jwtService.setLoginDetail(loginData.ResponseBody)) {
                  resolve(res.body);
                } 
              } else {
                reject(null);
              }
            } catch (e) {
              reject(e);
            }
            0;
          },
          error: (e: HttpErrorResponse) => {
            reject(e.error);
          },
        });
    });
  }

  async get(Url: string): Promise<ResponseModel> {
    return new Promise((resolve, reject) => {
      return this.http
        .get(this.basUrl + Url, {
          observe: 'response',
        })
        .subscribe({
          next: (res: any) => {
            resolve(res.body);
          },
          error: (e: HttpErrorResponse) => {
            reject(e.error);
          },
        });
    });
  }

  async post(Url: string, Param: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.http
        .post(this.basUrl + Url, Param, {
          observe: 'response',
        })
        .subscribe({
          next: (res: HttpResponse<any>) => {
            resolve(res.body);
          },
          error: (e: HttpErrorResponse) => {
            reject(e.error);
          },
        });
    });
  }

  async put(Url: string, Param: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.http
        .put(this.basUrl + Url, Param, {
          observe: 'response',
        })
        .subscribe({
          next: (res: HttpResponse<any>) => {
            resolve(res.body);
          },
          error: (e: HttpErrorResponse) => {
            reject(e.error);
          },
        });
    });
  }

  async delete(Url: string, Param?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.http
        .delete(this.basUrl + Url, {
          headers: {
            observe: 'response',
          },
          body: Param,
        })
        .subscribe({
          next: (res: any) => {
            resolve(res);
          },
          error: (e: HttpErrorResponse) => {
            reject(e.error);
          },
        });
    });
  }
}
