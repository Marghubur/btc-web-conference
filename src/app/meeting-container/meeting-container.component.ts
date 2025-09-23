import { Component } from '@angular/core';
import { MeetingMiniComponent } from '../meeting-mini/meeting-mini.component';
import { MeetingComponent } from "../meeting/meeting.component";
import { MeetingService } from '../providers/services/meeting.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-meeting-container',
  standalone: true,
  imports: [MeetingMiniComponent, MeetingComponent, CommonModule],
  templateUrl: './meeting-container.component.html',
  styleUrl: './meeting-container.component.css'
})
export class MeetingContainerComponent {
  constructor(public meetingService: MeetingService) {}
}
