import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CommonService } from './providers/services/common.service';
import { iNavigation } from './providers/services/iNavigation';
import { MeetingContainerComponent } from "./meeting-container/meeting-container.component";
import { MeetingService } from './meeting/meeting.service';
import { ThemeService } from './providers/services/theme.service';
import { CommonModule } from '@angular/common';
import { SplashComponent } from './splash/splash.component';
import { AuthInitService } from './providers/services/auth-init.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, MeetingContainerComponent, SplashComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
    navRouter: Subscription = null;
    showSplash: boolean = true;

    @ViewChild(SplashComponent) splashRef!: SplashComponent;

    constructor(private common: CommonService,
        private nav: iNavigation,
        private router: Router,
        private meetingService: MeetingService,
        private themeService: ThemeService, // Initialize theme on app startup
        private authInitService: AuthInitService
    ) {
        this.navRouter = this.router.events.subscribe((event: any) => {
            if (event instanceof NavigationStart) {
                let pageName = event.url.replace("/", "")
                this.common.SetCurrentPageName(pageName);
                this.nav.manageLocalSessionKey(pageName);
                this.nav.pushRoute(pageName);
            }
        });

        this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((ev: any) => {
            const url = ev.urlAfterRedirects ?? ev.url;
            if (this.meetingService.inMeeting() && url.startsWith('/meeting')) {
                // on meeting route -> maximize
                this.meetingService.maximize();
            } else if (this.meetingService.inMeeting()) {
                // any other route -> minimize
                this.meetingService.minimize();
            }
        });
    }

    ngOnInit() {
        // Since APP_INITIALIZER is now non-blocking, AppComponent (<app-splash>) mounts immediately right on page refresh!
        // We wait for authInitService to finish checking token/session in the background before fading out SplashComponent.
        this.authInitService.initialize().finally(() => {
            setTimeout(() => {
                if (this.splashRef) this.splashRef.hide();
            }, 500);
        });
    }

    ngOnDestroy(): void {
        this.navRouter.unsubscribe();
    }

    private generateRandomString(length: number = 12): string {
        return `${this.randomLetters(3)}-${this.randomLetters(3)}-${this.randomLetters(6)}`;
    }

    private randomLetters(len: number): string {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    }

}