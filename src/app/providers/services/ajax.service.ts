import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ResponseModel } from '../model';
import { JwtService } from './jwt.service';

@Injectable({
    providedIn: 'root',
})
export class AjaxService {
    protected baseUrl: string = environment.appServerBaseUrl;

    constructor(
      protected http: HttpClient,
      protected jwtService: JwtService
    ) {
    }

    async login(Url: string, Param: any): Promise<ResponseModel> {
        return new Promise((resolve, reject) => {
            this.http
                .post(this.baseUrl + Url, Param, {
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
                    },
                    error: (e: HttpErrorResponse) => {
                        reject(e.error);
                    },
                });
        });
    }

    async get(Url: string): Promise<ResponseModel> {
        return new Promise((resolve, reject) => {
            this.http
                .get(this.baseUrl + Url, {
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
                .post(this.baseUrl + Url, Param, {
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
                .put(this.baseUrl + Url, Param, {
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
                .delete(this.baseUrl + Url, {
                    observe: 'response',
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
