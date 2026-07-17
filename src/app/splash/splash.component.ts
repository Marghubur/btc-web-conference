import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.css'
})
export class SplashComponent implements OnInit {
  fadeOut = false;
  private isHidden = false;
  private pulseInterval: any;

  @Output() splashComplete = new EventEmitter<void>();

  constructor(
    private router: Router,
    private localService: LocalService
  ) { }

  ngOnInit(): void {
    const minDelay = new Promise(resolve => setTimeout(resolve, 2800));

    // Preload the landing module in background
    const preload = import('../landing/landing.component').then(m => m.LandingComponent);

    // Wait for both: minimum animation time + module loaded
    Promise.all([minDelay, preload]).then(() => {
      // Only run auto-navigation if this splash wasn't hidden by parent overlay
      // and if we are strictly on the root route ('/' or '')
      if (!this.isHidden && (this.router.url === '/' || this.router.url === '')) {
        this.fadeOut = true;
        setTimeout(() => {
          if (this.localService.isLoggedIn()) {
            this.router.navigate(['/btc/chat']);
          } else {
            this.router.navigate(['/home']);
          }
        }, 600); // match fade-out duration
      }
    });
  }

  /** Called by the parent once APP_INITIALIZER finishes */
  hide(): void {
    if (this.isHidden) return;
    this.isHidden = true;
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
    }
    this.fadeOut = true;
    setTimeout(() => {
      this.splashComplete.emit();
    }, 600);
  }

  onFadeDone(event: any): void {
    if (this.fadeOut) {
      this.splashComplete.emit();
    }
  }
}
