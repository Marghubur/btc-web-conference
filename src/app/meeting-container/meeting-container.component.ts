import { Component, OnInit } from '@angular/core';
import { MeetingMiniComponent } from '../meeting-mini/meeting-mini.component';
import { MeetingComponent } from "../meeting/meeting.component";
import { MeetingService } from '../providers/services/meeting.service';
import { CommonModule } from '@angular/common';
import { LocalService } from '../providers/services/local.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-meeting-container',
  standalone: true,
  imports: [MeetingMiniComponent, MeetingComponent, CommonModule],
  templateUrl: './meeting-container.component.html',
  styleUrl: './meeting-container.component.css',
  animations: [
    trigger('slideFade', [
      state('hidden', style({ opacity: 0, height: '0px', overflow: 'hidden', width: '0px' })),
      state('visible', style({ opacity: 1, height: '*', overflow: 'hidden'})),
      transition('hidden <=> visible', animate('300ms ease-in-out'))
    ])
  ]
})
export class MeetingContainerComponent {
  constructor(public meetingService: MeetingService,
    private local: LocalService
  ) { }

  get isLoggedIn(): boolean {
  return this.local.isLoggedIn();
  } 
}
