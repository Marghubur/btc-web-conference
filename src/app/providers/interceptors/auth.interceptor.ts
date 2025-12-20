import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { JwtService } from '../services/jwt.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const jwtService = inject(JwtService);
    const router = inject(Router);
    const token = jwtService.getJwtToken();

    let authReq = req;

    // Skip auth for auth endpoints if needed, but usually safe to attach if token exists
    // The existing one had: if (req.url.includes("auth")) return next(req);
    // We can keep that or just rely on if(token). 
    // Let's keep it robust: if token exists, attach it. 
    // Exception: Login/Register usually don't need it, but sending it doesn't hurt unless backend rejects.

    if (token) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                // Auto logout on 401
                jwtService.removeJwtToken();
                router.navigate(['/login']);
            }
            return throwError(() => error);
        })
    );
};
