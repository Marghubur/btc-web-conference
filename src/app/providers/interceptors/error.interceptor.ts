import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            let errorMessage = 'An unknown error occurred!';

            if (error.error instanceof ErrorEvent) {
                // Client-side error
                errorMessage = `Error: ${error.error.message}`;
            } else {
                // Server-side error
                if (error.status === 0) {
                    errorMessage = 'Network error. Please check your connection.';
                } else {
                    errorMessage = error.error?.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
                }
            }

            // Log error to console or remote logging service
            console.error('HTTP Error:', errorMessage, error);

            // Return a standard error format or just rethrow
            return throwError(() => error);
        })
    );
};
