import { Component, OnInit } from '@angular/core';
import { MeetingMiniComponent } from '../meeting-mini/meeting-mini.component';
import { MeetingComponent } from "../meeting/meeting.component";
import { MeetingService } from '../providers/services/meeting.service';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';

@Component({
  selector: 'app-meeting-container',
  standalone: true,
  imports: [MeetingMiniComponent, MeetingComponent, CommonModule],
  templateUrl: './meeting-container.component.html',
  styleUrl: './meeting-container.component.css'
})
export class MeetingContainerComponent implements OnInit {
  isLoggedIn: boolean = true;
  constructor(public meetingService: MeetingService,
              private local: LocalService
  ) {}
  ngOnInit() {
    this.isLoggedIn = this.local.isLoggedIn();
  }
}
