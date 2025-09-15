import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private disconnectTimer: any;
  private pingSub?: Subscription;

  isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);
  isSlow$ = new BehaviorSubject<boolean>(false);

  constructor(private ngZone: NgZone) {
    // listen browser events
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));

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

  /** if disconnected > 1 min → emit false */
  private startDisconnectTimer() {
    this.clearDisconnectTimer();
    this.disconnectTimer = setTimeout(() => {
      // after 1 min no internet
      this.isOnline$.next(false);
      // here you can trigger force meeting disconnect
    }, 60_000);
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /** check internet speed via ping */
  private startPingCheck() {
    this.pingSub = interval(5000).subscribe(() => {
      const start = Date.now();
      fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          const latency = Date.now() - start;
          this.isSlow$.next(latency > 1000); // >1s = slow
          this.isOnline$.next(true);
        })
        .catch(() => {
          this.isOnline$.next(false);
        });
    });
  }
}
