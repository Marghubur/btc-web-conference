import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { MeetingService } from './meeting.service'; // import your LiveKit service

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private disconnectTimer: any;
  private pingSub?: Subscription;
  private readonly OFFLINE_LIMIT = 60_000; // 1 minute

  isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);
  isSlow$ = new BehaviorSubject<boolean>(false);

  constructor(private ngZone: NgZone, private meetingService: MeetingService) {
    // listen to network events
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));

    // listen to tab visibility (sleep / hibernate)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.startDisconnectTimer();
      } else {
        this.clearDisconnectTimer();
      }
    });

    // start speed monitoring
    this.startPingCheck();
  }

  private setOnline(status: boolean) {
    this.ngZone.run(() => {
      this.isOnline$.next(status);
      if (!status) {
        this.startDisconnectTimer();
      } else {
        this.clearDisconnectTimer();
      }
    });
  }

  /** start 1-min offline/hibernate countdown */
  private startDisconnectTimer() {
    this.clearDisconnectTimer();
    this.ngZone.runOutsideAngular(() => {
      this.disconnectTimer = setTimeout(() => {
        this.ngZone.run(() => {
          console.warn('User offline or hibernated >1 min. Disconnecting meeting.');
          this.isOnline$.next(false);
          this.meetingService.leaveRoom(); // disconnect LiveKit meeting
        });
      }, this.OFFLINE_LIMIT);
    });
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /** periodic ping to check connection speed */
  private startPingCheck() {
    this.pingSub = interval(5000).subscribe(() => {
      const start = Date.now();
      fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          const latency = Date.now() - start;
          this.ngZone.run(() => {
            this.isSlow$.next(latency > 1000); // >1s = slow network
            this.setOnline(true); // network is available
          });
        })
        .catch(() => this.setOnline(false));
    });
  }

  /** cleanup subscription if service destroyed */
  ngOnDestroy() {
    this.pingSub?.unsubscribe();
    this.clearDisconnectTimer();
  }
}
