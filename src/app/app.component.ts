import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
    private router = inject(Router);
    ngOnInit() {
      this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Now we have the correct URL
        if (event.urlAfterRedirects === '/' || event.urlAfterRedirects === '') {
          const randomId = this.generateRandomString();
          this.router.navigate([`/meeting/${randomId}`]);
        }
      });
    } 

    private generateRandomString(length: number = 12): string {
       return `${this.randomLetters(3)}-${this.randomLetters(3)}-${this.randomLetters(6)}`;
    }

    private randomLetters(len: number): string {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    }

}