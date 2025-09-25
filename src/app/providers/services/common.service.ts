import { Injectable } from '@angular/core';
// @ts-ignore
import * as bootstrap from 'bootstrap';
import { Home } from '../constant';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommonService {
  private CurrentPageName: string = Home;
  isLoading: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor() { }

  public SetCurrentPageName(Name: string) {
    if (this.IsValidString(Name)) {
      this.CurrentPageName = Name;
    }
  }

  public IsValidString(Data: any): boolean {
    let flag = false;
    let type = typeof Data;
    if (type === "undefined") return flag;
    if (type === "string") {
      if (Data !== null) {
        flag = true;
        if (Data.trim() === "") flag = false;
      }
    } else if (type === "number") flag = true;
    return flag;
  }

  public GetCurrentPageName() {
    return this.CurrentPageName;
  }
}

export function ShowModal(id: string) {
  let modalElement = document.getElementById(id);
  var modal = new bootstrap.Modal(modalElement);
  if (modal)
    modal.show();
}

export function HideModal(id: string) {
  let modalElement = document.getElementById(id);
  var modal = bootstrap.Modal.getInstance(modalElement);
  if (modal) {
    modal.hide();
  }

  removeBackdrop();
}

function removeBackdrop(): void {
  const backdropElement = document.querySelectorAll('.modal-backdrop');
  if (backdropElement && backdropElement.length > 0) {
    backdropElement.forEach(x => {
      x.remove();
    })
  }

  // Remove modal-open class from body
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}

export function ToLocateDate(date: any) {
  if(date) {
    let type = typeof(date);
    switch(type) {
      case "string":
        if (date.indexOf("Z") == -1)
          return new Date(date + ".000Z");
        else
          return new Date(date)
      default:
          var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
          var offset = date.getTimezoneOffset() / 60;
          var hours = date.getHours();
          newDate.setHours(hours - offset);
          return newDate;
    }
  }

  return null;
}