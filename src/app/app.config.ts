import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'; // Import this
import { authInterceptor } from './providers/auth.interceptor';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }), 
        provideHttpClient(withInterceptors([authInterceptor])), 
        provideRouter(routes),
        {provide: LocationStrategy, useClass: HashLocationStrategy},
        provideAnimationsAsync() // Add it here
    ],
  };
