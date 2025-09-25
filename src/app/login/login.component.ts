import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalService } from '../providers/services/local.service';
import { ResponseModel } from '../providers/model';
import { Router } from '@angular/router';
import { AjaxService } from '../providers/services/ajax.service';
import { iNavigation } from '../providers/services/iNavigation';
import { Dashboard } from '../providers/constant';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = "";
  isSubmitted: boolean = false;
  isEmailValid: boolean = true;
  passwordType: string = "password";
  password: string = '';
  isLoading: boolean = false;
  constructor(private nav: iNavigation,
              private http: AjaxService
  ) {}
  login() {
    this.isSubmitted = true;
    if (!this.email || !this.isEmailValid)
      return;

    if (!this.password)
      return;

    this.isLoading = true;
    let user = {
      email: this.email,
      password: this.password
    }
    this.http.login("auth/authenticateUser", user).then((res: ResponseModel) => {
      if (res.ResponseBody) {
        this.isLoading = false;
        this.nav.navigate(Dashboard, null);
      }
    }).catch(e => {
      this.isLoading = false;
    })
  }

  isValidEmail() {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.isEmailValid =  regex.test(this.email);
  }

  viewPassword() {
    if (this.passwordType == 'password')
      this.passwordType = "text";
    else
      this.passwordType = "password";
  }
}
