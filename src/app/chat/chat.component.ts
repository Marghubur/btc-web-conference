import { Component, OnInit } from '@angular/core';
import { AjaxService } from '../providers/services/ajax.service';
import { ResponseModel } from '../providers/model';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  animations: [
    trigger('highlightAnim', [
      state('normal', style({
        backgroundColor: 'transparent',
        boxShadow: 'none',
        fontWeight: 'normal',
        transform: 'scale(1)'
      })),
      state('selected', style({
        backgroundColor: 'white',
        boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px',
        fontWeight: '600',
        transform: 'scale(1)'  // slight zoom
      })),
      transition('normal => selected', [
        animate('200ms ease-in')
      ]),
      transition('selected => normal', [
        animate('200ms ease-out')
      ])
    ])
  ]
})
export class ChatComponent implements OnInit {
  alluser: Array<User> = [];
  isPageReady: boolean = false;
  today: Date = new Date();
  selectedUser: User = {userId: 0, firstName: null, lastName: null, mobile: null};
  filterModal: FilterModal = {pageIndex: 1, pageSize: 20, searchString: '1=1'};
  constructor(private http: AjaxService) { }
  ngOnInit() {
    this.http.post("user/getAllUser", this.filterModal).then((res: ResponseModel) => {
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

  selectUser(user: User) {
    this.selectedUser = user;
  }

}

export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  total?: number;
  rowIndex?: number;
  email?: string;
  mobile: string;
}

export interface FilterModal {
  searchString: string;
  sortBy?: string;
  pageIndex: number;
  pageSize: number;
}