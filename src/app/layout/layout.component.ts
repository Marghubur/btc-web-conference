import { Component } from '@angular/core';
import { SidemenuComponent } from "../sidemenu/sidemenu.component";
import { RouterOutlet } from '@angular/router';
import { LocalService } from '../providers/services/local.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SidemenuComponent, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  isLoggedIn: boolean = false;
  constructor(private local: LocalService) {
    this.isLoggedIn = local.isLoggedIn();
  }
}
