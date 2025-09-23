import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { iNavigation } from '../providers/services/iNavigation';
import { ChatPage, Dashboard, Login } from '../providers/constant';
import { LocalService } from '../providers/services/local.service';
import { NgbDropdownConfig, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { JwtService } from '../providers/services/jwt.service';
import { User } from '../providers/model';
import { MeetingService } from '../providers/services/meeting.service';

@Component({
  selector: 'app-sidemenu',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  providers: [NgbDropdownConfig],
  templateUrl: './sidemenu.component.html',
  styleUrl: './sidemenu.component.css'
})
export class SidemenuComponent {
  sideMenu: Array<{ Id: number, Title: string, Link: string, Icon: string, IsActive: boolean }> = [
    {
      Id: 1,
      IsActive: false,
      Title: "Chat",
      Link: ChatPage,
      Icon: "M240-400h320v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"
    }, {
      Id: 2,
      IsActive: true,
      Link: Dashboard,
      Title: "Meet",
      Icon: "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Zm0-80h480v-480H160v480Zm0 0v-480 480Z"
    }
  ];
  currentUser: User = null;
  constructor(private router: Router,
    private nav: iNavigation,
    private local: LocalService,
    private config: NgbDropdownConfig,
    private jwtService: JwtService,
    private meetingService: MeetingService
  ) {
    config.placement = 'top-end';
		config.autoClose = true;
    this.currentUser = this.local.getUser();

    let currentPage = this.router.url;
    this.sideMenu.forEach(x => {
      x.IsActive = false;
    });
    if (currentPage.includes(ChatPage))
      this.sideMenu[0].IsActive = true;
    else if (currentPage.includes(Dashboard))
      this.sideMenu[1].IsActive = true;
  }

  navigatePage(link: string) {
    this.sideMenu.forEach(x => {
      x.IsActive = false;
    });
    if (link.includes(ChatPage))
      this.sideMenu[0].IsActive = true;
    else if (link.includes(Dashboard))
      this.sideMenu[1].IsActive = true;

    this.nav.navigate(link, null);
  }

  getUserInitiaLetter(): string {
    let fullName = this.getFullName();

    const words = fullName.split(' ').slice(0, 2);
    const initials = words.map(x => {
      if (x.length > 0) {
        return x.charAt(0).toUpperCase();
      }
      return '';
    }).join('');

    return initials;
  }

  getFullName(): string {
    let fullName = this.currentUser?.firstName;
    if (this.currentUser?.lastName)
      fullName = fullName + " " + this.currentUser.lastName;

    return fullName
  }

  logout() {
    this.jwtService.removeJwtToken();
    this.meetingService.leaveRoom()
    this.nav.navigate(Login, null);
  }
}
