import { Component, OnInit } from '@angular/core';
import { AjaxService } from '../providers/services/ajax.service';
import { ResponseModel } from '../providers/model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit {
  alluser: Array<User> = [];
  isPageReady: boolean = false;
  today: Date = new Date();
  selectedUserId: number = 0;
  constructor(private http: AjaxService) { }
  ngOnInit() {
    this.http.get("user/getAllUser").then((res: ResponseModel) => {
      if (res.ResponseBody) {
        this.alluser = res.ResponseBody;
        this.isPageReady = true;
      }
    }).catch(e => {
      this.isPageReady = true;
    })
  }

  getUserInitiaLetter(fname: string, lname: string): string {
    var name = fname + " " + ((lname != null && lname != '') ? lname : '');
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

  getColorFromName(fname: string, lname: string): string {
    var name = fname + " " + ((lname != null && lname != '') ? lname : '');
    // Predefined color palette (Google Meet style soft colors)
    const colors = [
      "#f28b829f", "#FDD663", "#81C995", "#AECBFA", "#D7AEFB", "#FFB300",
      "#34A853", "#4285F4", "#FBBC05", "#ff8075ff", "#9AA0A6", "#F6C7B6"
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

  selecteUser(user: User) {
    this.selectedUserId = user.userId;
  }

}

export interface User {
  userId: number;
  firstName: string;
  lastName: string
}