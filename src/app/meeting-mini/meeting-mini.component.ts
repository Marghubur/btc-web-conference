import { Component, ElementRef, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { MeetingService } from '../providers/services/meeting.service';
import { LocalVideoTrack, Room } from 'livekit-client';
import { User } from '../providers/model';
import { LocalService } from '../providers/services/local.service';
import { CommonModule } from '@angular/common';
import { MediaPermissions, MediaPermissionsService } from '../providers/services/media-permission.service';
import { Subscription } from 'rxjs';
import { VideoComponent } from '../video/video.component';

@Component({
  selector: 'app-meeting-mini',
  standalone: true,
  imports: [CommonModule, VideoComponent],
  templateUrl: './meeting-mini.component.html',
  styleUrl: './meeting-mini.component.css'
})
export class MeetingMiniComponent implements OnInit, OnDestroy {
  // Simple draggable behavior
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private origLeft = 0;
  private origTop = 0;
  localTrack = signal<LocalVideoTrack | undefined>(undefined);
  userName: string = null;
  private user: User = null;
  permissions: MediaPermissions = {
    camera: 'unknown',
    microphone: 'unknown',
  };
  private subscription?: Subscription;
  room = signal<Room | undefined>(undefined);
  constructor(private elRef: ElementRef, 
              public meetingService: MeetingService,
              private mediaPerm: MediaPermissionsService,
              private local: LocalService) { }
  ngOnInit() {
    this.user = this.local.getUser();
    this.userName = this.getFullName();
    this.room.set(this.meetingService.room());
    this.localTrack.set(this.meetingService.localTrack());
    this.subscription = this.mediaPerm.permissions$.subscribe(
      permissions => {
          this.permissions = permissions;
      }
    );
  }

  expand() { this.meetingService.maximize(); }
  async leave() { await this.meetingService.leaveRoom(true); }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    this.dragging = true;
    const rect = (this.elRef.nativeElement as HTMLElement).getBoundingClientRect();
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.origLeft = rect.left;
    this.origTop = rect.top;
    e.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const node = (this.elRef.nativeElement as HTMLElement).parentElement as HTMLElement;
    if (!node) return;
    node.style.right = 'auto';
    node.style.left = `${this.origLeft + dx}px`;
    node.style.top = `${this.origTop + dy}px`;
  }

  @HostListener('document:mouseup')
  onMouseUp() { this.dragging = false; }

  async toggleCamera() {
    await this.meetingService.toggleCamera();
  }

  async toggleMic() {
    await this.meetingService.toggleMic()
  }

  getUserInitiaLetter(): string {
    var name = this.getFullName();
    if (!name)
      return "";

    const words = name.split(' ').slice(0, 2);
    const initials = words.map(x => {
      if (x.length > 0) {
        return x.charAt(0).toUpperCase();
      }
      return '';
    }).join('');

    return initials;
  }

  getColorFromName(): string {
    var name = this.getFullName();
    // Predefined color palette (Google Meet style soft colors)
    const colors = [
      "#f28b829f", "#FDD663", "#81C995", "#AECBFA", "#D7AEFB", "#FFB300",
      "#34A853", "#4285F4", "#FBBC05", "#EA4335", "#9AA0A6", "#F6C7B6"
    ];

    // Create hash from name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Pick color based on hash
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  private getFullName(): string {
    let fullName = this.user?.firstName;
    if (this.user?.lastName)
      fullName = fullName + " " + this.user.lastName;

    return fullName;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.mediaPerm.destroy();
  }
}
