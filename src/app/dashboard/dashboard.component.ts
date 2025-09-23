import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { MeetingDetail, ResponseModel } from '../providers/model';
import { AjaxService } from '../providers/services/ajax.service';
import { HideModal, ShowModal, ToLocateDate } from '../providers/services/common.service';
import { iNavigation } from '../providers/services/iNavigation';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Preview } from '../providers/constant';
import { LocalService } from '../providers/services/local.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDatepickerModule, NgbTooltipModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  meetingDate!: NgbDateStruct;
  meetingTimes: Array<string> = [];
  minPickerDate!: NgbDateStruct;
  meetingEndDate!: NgbDateStruct;
  minEndPickerDate!: NgbDateStruct;
  meetingForm!: FormGroup;
  meetingDetail: MeetingDetail = {agenda: '', durationInSecond: 0, meetingDetailId: 0, meetingId: '', meetingPassword: '', organizedBy: 0, title: ''}
  isSubmitted: boolean = false;
  isLoading: boolean = false;
  allMeetings: Array<MeetingDetail> = [];
  isPageReady: boolean = false;
  quickMeetingTitle: string = "";
  showAll: boolean = false;
  constructor(private nav: iNavigation,
    private local: LocalService,
    private fb: FormBuilder,
    private http: AjaxService
  ) {
    const today = new Date();
    this.minPickerDate = {
      year: today.getFullYear(),
      month: today.getMonth() + 1, // Month is 0-indexed in Date, 1-indexed in NgbDateStruct
      day: today.getDate()
    };
  }


  async ngOnInit() {
    this.generateTimeSlots();
    this.initForm();
    this.loadData();
  }

  generateTimeSlots() {
    this.meetingTimes = [];
    let hour = 0;
    let minute = 0;

    while (hour < 24) {
      let displayHour = hour % 12 === 0 ? 12 : hour % 12;
      let ampm = hour < 12 ? "A.M" : "P.M";
      let displayMinute = minute === 0 ? "00" : "30";
      this.meetingTimes.push(`${displayHour}:${displayMinute} ${ampm}`);

      if (minute === 0) {
        minute = 30;
      } else {
        minute = 0;
        hour++;
      }
    }
  }

  private initForm() {
    this.meetingForm = this.fb.group({
      meetingDetailId: new FormControl(this.meetingDetail.meetingDetailId),
      meetingId: new FormControl(this.meetingDetail.meetingId),
      meetingPassword: new FormControl(this.meetingDetail.meetingPassword),
      organizedBy: new FormControl(this.meetingDetail.organizedBy),
      agenda: new FormControl(this.meetingDetail.agenda),
      title: new FormControl(this.meetingDetail.title, [Validators.required]),
      startDate: new FormControl(this.meetingDetail.startDate, [Validators.required]),
      durationInSecond: new FormControl(this.meetingDetail.durationInSecond),
      endDate: new FormControl( this.meetingDetail.endDate, [Validators.required]),
      startTime: new FormControl(this.meetingDetail.startTime),
      endTime: new FormControl(this.meetingDetail.endTime)
    });
  }

  onMeetingDateSelect(e: NgbDateStruct) {
    let date = new Date(e.year, e.month - 1, e.day);
    this.meetingForm.get('startDate')?.setValue(date);
    this.minEndPickerDate = e;
  }

  onMeetingEndDateSelect(e: NgbDateStruct) {
    let date = new Date(e.year, e.month - 1, e.day);
    this.meetingForm.get('endDate')?.setValue(date);
  }

  saveMeetingDetail() {
    this.isSubmitted = true;
    if (this.meetingForm.invalid) {
      return;
    }

    this.isLoading = true;
    let value = this.meetingForm.getRawValue();
    value.durationInSecond = 5000;
    this.http.post("meeting/generateMeeting", value).then((res: ResponseModel) => {
      if (res.ResponseBody) {
        this.allMeetings = res.ResponseBody;
        HideModal("createMeeting");
        this.isLoading = false;
        this.isSubmitted = false;
      }
    }).catch(e => {
      this.isLoading = false;
    })
  }

  private loadData() {
    this.isPageReady = false;
    this.http.get("meeting/getAllMeetingByOrganizer").then((res: ResponseModel) => {
      if (res.ResponseBody) {
        this.allMeetings = res.ResponseBody;
        this.isPageReady = true;
      }
    }).catch(e => {
      this.isPageReady = true;
    })
  }

  joinMeeting(item: MeetingDetail) {
    // this.router.navigate(['/ems/preview'], {queryParams: {meetingid: item.meetingId}});
    this.nav.navigate(Preview, item);
  }

  scheduleMeetingPopup() {
    this.isSubmitted = false;
    ShowModal("createMeeting");
  }

  quickMeetingModal() {
    let user = this.local?.getUser();
    let fullName = user.firstName;
    if (user.lastName)
        fullName = fullName + " " + user.lastName;

    this.quickMeetingTitle = `Meeting with ${fullName}`;
    this.isSubmitted = false;
    ShowModal("quickMeetingModal");
  }

  generateQuickMeeting() {
    this.isSubmitted = true;
    if (!this.quickMeetingTitle) {
      return;
    }

    this.isLoading = true;
    let meetingDetal = {
      title: this.quickMeetingTitle
    };
    this.http.post("meeting/generateQuickMeeting", meetingDetal).then((res: ResponseModel) => {
      if (res.ResponseBody) {
        this.allMeetings = res.ResponseBody;
        this.isLoading = false;
        HideModal("quickMeetingModal");
      } 
    }).catch(e => {
      this.isLoading = false;
    })
  }

  convertedDate(date: any) {
    return ToLocateDate(date);
  }

  copyLink(item: MeetingDetail, tooltip: any) {
    let url = environment.production ? `www.axilcorps.com/#/ems/preview?meetingid=${item.meetingId}` : `http://localhost:4200/#/ems/preview?meetingid=${item.meetingId}`;
    navigator.clipboard.writeText(url).then(() => {
      console.log('Copied to clipboard:');
      tooltip.open();
      setTimeout(() => tooltip.close(), 1500); // Close tooltip after 1.5s
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  get visibleRecords() {
    return this.showAll ? this.allMeetings : this.allMeetings.slice(0, 7);
  }

  toggleView() {
    this.showAll = !this.showAll;
  }
}