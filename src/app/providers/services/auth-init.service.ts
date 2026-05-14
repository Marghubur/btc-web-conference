import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JwtService } from './jwt.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthInitService {
  private httpClient: HttpClient;

  constructor(
    private httpBackend: HttpBackend,
    private jwtService: JwtService
  ) {
    // Create an isolated HttpClient that bypasses all interceptors
    this.httpClient = new HttpClient(this.httpBackend);
  }

  initialize(): Promise<boolean> {
    const url = `${environment.appServerBaseUrl}auth/v1/regenerateToken`;

    // Silently attempt to get a new access token using the background HttpOnly cookie
    return firstValueFrom(
      this.httpClient.post(url, {}, { withCredentials: true, observe: 'response' }).pipe(
        catchError(() => {
          // If it fails (no cookie, expired cookie, network error), ensure we are logged out locally
          this.jwtService.removeJwtToken();
          return of(null);
        })
      )
    ).then((res: any) => {
      if (res && (res.status === 200 || res.status === 201) && res.body) {
        // Success: we got a fresh token. Save it exactly as the login process would.
        const body = res.body;
        const responseData = body.responseBody || body.ResponseBody || body;

        if (responseData) {
          this.jwtService.setLoginDetail(responseData);
          return true;
        }
      }

      return false;
    });
  }
}
