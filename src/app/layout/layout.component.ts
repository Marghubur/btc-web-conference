import { Component } from '@angular/core';
import { SidemenuComponent } from "../sidemenu/sidemenu.component";
import { HeaderComponent } from "./header/header.component";
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LocalService } from '../providers/services/local.service';
import { RoomService } from '../providers/services/room.service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { MeetingComponent } from '../meeting/meeting.component';
import { MeetingService } from '../providers/services/meeting.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SidemenuComponent, RouterOutlet, NgbTooltipModule, MeetingComponent, HeaderComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  isLoggedIn: boolean = false;
  userName: string = null;
  constructor(private local: LocalService,
    public meetingService: MeetingService,
    private router: Router
  ) {
    this.isLoggedIn = local.isLoggedIn();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (event.urlAfterRedirects.startsWith('/meeting')) {
          // If in meeting route → show full screen
          if (this.meetingService.inMeeting()) {
            this.meetingService.maximize();
          }
        } else {
          // Any other page → minimize
          if (this.meetingService.inMeeting()) {
            this.meetingService.minimize();
          }
        }
      }
    });
  }


}
