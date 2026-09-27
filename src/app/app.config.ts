import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './providers/interceptors/auth.interceptor';
import { errorInterceptor } from './providers/interceptors/error.interceptor';
import { AuthInitService } from './providers/services/auth-init.service';

export function initializeApp(authInitService: AuthInitService) {
    return () => authInitService.initialize();
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideRouter(routes),
        provideAnimationsAsync(),
        {
            provide: APP_INITIALIZER,
            useFactory: initializeApp,
            deps: [AuthInitService],
            multi: true
        }
    ],
};
