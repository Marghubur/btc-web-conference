import { Component } from '@angular/core';
import { LocalService } from '../providers/services/local.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-window',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-window.component.html',
  styleUrl: './floating-window.component.css'
})
export class FloatingWindowComponent {

  constructor(private local: LocalService) {}
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
    var currentUser = this.local.getUser();
    let fullName = currentUser?.firstName;
    if (currentUser?.lastName)
      fullName = fullName + " " + currentUser.lastName;

    return fullName
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

  
}
