import { HttpInterceptorFn, HttpErrorResponse, HttpBackend, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, from, BehaviorSubject, defer, of, timer, Observable } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { JwtService } from '../services/jwt.service';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

// Helper function to attempt token refresh using an isolated HttpClient
function attemptRefresh(httpClient: HttpClient, maxAttempts: number, currentAttempt: number = 1): Observable<any> {
    const url = `${environment.appServerBaseUrl}auth/v1/regenerateToken`;

    return httpClient.post(url, {}, { withCredentials: true, observe: 'response' }).pipe(
        switchMap((res: any) => {
            if (res.status === 200 || res.status === 201) {
                return of(res.body); // Success! Return the response body
            } else {
                return throwError(() => new Error('Token refresh API returned failure'));
            }
        }),
        catchError(err => {
            if (currentAttempt < maxAttempts) {
                console.warn(`Token refresh attempt ${currentAttempt} failed. Retrying in 2 seconds...`);
                return timer(2000).pipe( // 2 second gap between retries
                    switchMap(() => attemptRefresh(httpClient, maxAttempts, currentAttempt + 1))
                );
            } else {
                return throwError(() => new Error('Failed to refresh token after 5 attempts'));
            }
        })
    );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const jwtService = inject(JwtService);
    const router = inject(Router);
    // Inject HttpBackend directly to create an HttpClient that BYPASSES all interceptors
    const httpBackend = inject(HttpBackend);

    const token = jwtService.getJwtToken();
    let authReq = req;

    // Do not add Authorization header to S3/R2 presigned URLs
    if (token && !req.url.includes('X-Amz-Signature')) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            // Only trigger refresh if 401 AND it's not a refresh token request itself
            if (error.status === 401 && !req.url.includes('auth/v1/regenerateToken')) {

                if (!isRefreshing) {
                    isRefreshing = true;
                    refreshTokenSubject.next(null);

                    // Create isolated client that won't trigger this interceptor again
                    const bypassClient = new HttpClient(httpBackend);

                    // Call the retry helper with 5 maximum attempts
                    return attemptRefresh(bypassClient, 5).pipe(
                        switchMap((body: any) => {
                            // Safely extract the response body regardless of casing
                            const responseData = body.responseBody || body.ResponseBody;
                            jwtService.setLoginDetail(responseData);

                            const newToken = jwtService.getJwtToken();
                            refreshTokenSubject.next(newToken);

                            return next(req.clone({
                                setHeaders: {
                                    Authorization: `Bearer ${newToken}`
                                }
                            }));
                        }),
                        catchError((err) => {
                            // If all 5 attempts fail, we log out.
                            refreshTokenSubject.error(err); // Reject queued requests
                            jwtService.removeJwtToken();
                            router.navigate(['/login']);
                            return throwError(() => err);
                        }),
                        finalize(() => {
                            // CRITICAL FIX: Ensure the lock is ALWAYS released!
                            // If the user navigates away or the request is cancelled before completion,
                            // this will safely unlock the interceptor for the next request.
                            isRefreshing = false;

                            // If it was cancelled or failed and the subject is still null/empty, reset it
                            if (!refreshTokenSubject.value && !refreshTokenSubject.hasError) {
                                refreshTokenSubject.error(new Error('Request cancelled before refresh completed'));
                            }

                            // Re-initialize the subject for the next time it's needed
                            if (refreshTokenSubject.hasError || refreshTokenSubject.isStopped) {
                                refreshTokenSubject = new BehaviorSubject<any>(null);
                            }
                        })
                    );
                } else {
                    // Queue concurrent requests while refreshing
                    return refreshTokenSubject.pipe(
                        filter(token => token != null),
                        take(1),
                        switchMap(jwt => {
                            return next(req.clone({
                                setHeaders: {
                                    Authorization: `Bearer ${jwt}`
                                }
                            }));
                        }),
                        catchError(err => {
                            return throwError(() => err);
                        })
                    );
                }
            } else if (error.status === 401 && req.url.includes('auth/v1/regenerateToken')) {
                // Failsafe if the manually bypassed refresh somehow triggers this
                jwtService.removeJwtToken();
                router.navigate(['/login']);
                return throwError(() => error);
            }

            return throwError(() => error);
        })
    );
};
