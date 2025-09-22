import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonService } from './providers/services/common.service';
import { iNavigation } from './providers/services/iNavigation';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
    navRouter: Subscription = null;
    constructor(private common: CommonService,
        private nav: iNavigation,
        private router: Router
    ) {
        this.navRouter = this.router.events.subscribe((event: any) => {
            if (event instanceof NavigationStart) {
                let pageName = event.url.replace("/", "")
                this.common.SetCurrentPageName(pageName);
                this.nav.manageLocalSessionKey(pageName);
                this.nav.pushRoute(pageName);
            }
        });
    }
    ngOnInit() {
        // this.router.events
        // .pipe(filter(event => event instanceof NavigationEnd))
        // .subscribe((event: any) => {
        //   // Now we have the correct URL
        //   if (event.urlAfterRedirects === '/' || event.urlAfterRedirects === '') {
        //     const randomId = this.generateRandomString();
        //     this.router.navigate([`/meeting/${randomId}`]);
        //   }
        // });
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