import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalService } from '../services/local.service';
import { User } from '../preview/preview.component';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = "bottomhalf.dev@gmail.com";
  isSubmitted: boolean = false;
  isEmailValid: boolean = true;
  passwordType: string = "password";
  password: string = '12345678';
  private basUrl: string = environment.appServerBaseUrl;
  constructor(private local: LocalService,
              private router: Router,
              private http: HttpClient
  ) {}
  login() {
    this.isSubmitted = true;
    if (!this.email || !this.isEmailValid)
      return;

    if (!this.password)
      return;

    let user = {
      email: this.email,
      password: this.password
    }
    this.http.post(this.basUrl + "auth/authenticateUser/", user).subscribe({
      next: (res: any) => {
        this.local.setUser(this.email, res);
        this.router.navigate(['/dashboard'])
      },
      error(err) {
        console.error(err);
      },
    })
  }

  isValidEmail() {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.isEmailValid =  regex.test(this.email);
  }
}
