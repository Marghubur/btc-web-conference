import { Component } from '@angular/core';
import { SidemenuComponent } from "../sidemenu/sidemenu.component";
import { RouterOutlet } from '@angular/router';
import { LocalService } from '../providers/services/local.service';
import { RoomService } from '../providers/services/room.service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { FloatingWindowComponent } from '../floating-window/floating-window.component';
import { MeetingComponent } from '../meeting/meeting.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SidemenuComponent, RouterOutlet, NgbTooltipModule, FloatingWindowComponent, MeetingComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  isLoggedIn: boolean = false;
  userName: string = null;
  constructor(private local: LocalService,
    public roomService: RoomService,
  ) {
    this.isLoggedIn = local.isLoggedIn();
  }

  
}
