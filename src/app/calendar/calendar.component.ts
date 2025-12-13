import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { MeetingDetail, ResponseModel } from '../providers/model';
import { AjaxService } from '../providers/services/ajax.service';
import { iNavigation } from '../providers/services/iNavigation';
import { LocalService } from '../providers/services/local.service';
import { Preview } from '../providers/constant';
import { HideModal, ShowModal } from '../providers/services/common.service';
import { environment } from '../../environments/environment';

interface CalendarDay {
    date: Date;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    meetings: MeetingDetail[];
}

interface TimeSlot {
    time: string;
    hour: number;
    minute: number;
    display: string;
}

@Component({
    selector: 'app-calendar',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDatepickerModule, NgbTooltipModule, NgbModalModule],
    templateUrl: './calendar.component.html',
    styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnDestroy, AfterViewInit {
    // ViewChild for scrolling
    @ViewChild('weekBody') weekBody!: ElementRef;
    @ViewChild('dayBody') dayBody!: ElementRef;

    // View mode
    viewMode: 'day' | 'week' | 'month' = 'week';

    // Current time tracking
    currentTimePosition: number = 0;
    private timeUpdateInterval: any;

    // Current date tracking
    currentDate: Date = new Date();
    today: Date = new Date();
    selectedDate: Date = new Date();

    // Calendar data
    calendarDays: CalendarDay[] = [];
    weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    timeSlots: TimeSlot[] = [];

    // Week view data
    weekDates: Date[] = [];

    // Meetings
    allMeetings: MeetingDetail[] = [];
    allSchedularMeeting: MeetingDetail[] = [];

    // Form
    meetingForm!: FormGroup;
    meetingDate!: NgbDateStruct;
    meetingEndDate!: NgbDateStruct;
    minPickerDate!: NgbDateStruct;
    minEndPickerDate!: NgbDateStruct;
    meetingTimes: string[] = [];
    duration: string = "00:00";

    // State
    isSubmitted: boolean = false;
    isLoading: boolean = false;
    isPageReady: boolean = false;

    // Selected meeting for details popup
    selectedMeeting: MeetingDetail | null = null;

    constructor(
        private nav: iNavigation,
        private local: LocalService,
        private fb: FormBuilder,
        private http: AjaxService,
        private ngZone: NgZone
    ) {
        const today = new Date();
        this.minPickerDate = {
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate()
        };
    }

    ngOnInit(): void {
        this.generateTimeSlots();
        this.generateMeetingTimes();
        this.initForm();
        this.loadData();
        this.updateCalendar();
        this.updateCurrentTimePosition();

        // Update current time line every second for smooth updates
        this.ngZone.runOutsideAngular(() => {
            this.timeUpdateInterval = setInterval(() => {
                this.ngZone.run(() => {
                    this.updateCurrentTimePosition();
                });
            }, 1000); // Update every second for smooth movement
        });
    }

    ngOnDestroy(): void {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
    }

    ngAfterViewInit(): void {
        // Scroll to current time after view is ready
        setTimeout(() => this.scrollToCurrentTime(), 500);
    }

    // Scroll to current time position
    scrollToCurrentTime(): void {
        const scrollPosition = Math.max(0, this.currentTimePosition - 100); // 100px offset to show some context above
        if (this.viewMode === 'week' && this.weekBody) {
            this.weekBody.nativeElement.scrollTop = scrollPosition;
        } else if (this.viewMode === 'day' && this.dayBody) {
            this.dayBody.nativeElement.scrollTop = scrollPosition;
        }
    }

    // Update current time position for the red line
    updateCurrentTimePosition(): void {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        // Each time row is 48px height + 1px border = 49px, and there are 2 rows per hour
        // So each hour = 49px * 2 = 98px, each minute = 98px / 60 ≈ 1.633px
        const rowHeight = 49; // 48px min-height + 1px border
        const pixelsPerHour = rowHeight * 2; // 2 rows per hour
        const pixelsPerMinute = pixelsPerHour / 60;
        this.currentTimePosition = (hours * pixelsPerHour) + (minutes * pixelsPerMinute);
    }

    // Generate time slots for day/week view (Full 24 hours like Teams)
    generateTimeSlots(): void {
        this.timeSlots = [];
        for (let hour = 0; hour < 24; hour++) {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            this.timeSlots.push({
                time: `${hour}:00`,
                hour: hour,
                minute: 0,
                display: `${displayHour}:00 ${ampm}`
            });
            this.timeSlots.push({
                time: `${hour}:30`,
                hour: hour,
                minute: 30,
                display: `${displayHour}:30 ${ampm}`
            });
        }
    }

    // Generate meeting times for form dropdown
    generateMeetingTimes(): void {
        this.meetingTimes = [];
        for (let hour = 0; hour < 24; hour++) {
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? "A.M" : "P.M";
            this.meetingTimes.push(`${displayHour}:00 ${ampm}`);
            this.meetingTimes.push(`${displayHour}:30 ${ampm}`);
        }
    }

    initForm(): void {
        this.meetingForm = this.fb.group({
            meetingDetailId: new FormControl(0),
            meetingId: new FormControl(''),
            meetingPassword: new FormControl(''),
            organizedBy: new FormControl(0),
            agenda: new FormControl(''),
            title: new FormControl('', [Validators.required]),
            startDate: new FormControl(null, [Validators.required]),
            endDate: new FormControl(null, [Validators.required]),
            startTime: new FormControl(null, [Validators.required]),
            endTime: new FormControl(null, [Validators.required]),
            durationInSecond: new FormControl(0)
        });
    }

    // Load meetings data
    loadData(): void {
        this.isPageReady = false;
        this.http.get("meeting/getAllMeetingByOrganizer").then((res: ResponseModel) => {
            if (res.ResponseBody) {
                this.bindMeetings(res.ResponseBody);
                this.updateCalendar();
                this.isPageReady = true;
            }
        }).catch(e => {
            this.isPageReady = true;
        });
    }

    bindMeetings(res: any): void {
        this.allMeetings = res || [];
        this.allSchedularMeeting = this.allMeetings.filter(x => !x.hasQuickMeeting);

        // Parse meeting times
        this.allSchedularMeeting.forEach(meeting => {
            if (meeting.startDate) {
                const startDate = new Date(meeting.startDate);
                meeting.startTime = this.formatTime(startDate);
                if (meeting.durationInSecond) {
                    meeting.endDate = new Date(startDate.getTime() + (meeting.durationInSecond * 1000));
                    meeting.endTime = this.formatTime(meeting.endDate);
                }
            }
        });
    }

    // Calendar navigation
    previousPeriod(): void {
        if (this.viewMode === 'month') {
            this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        } else if (this.viewMode === 'week') {
            this.currentDate = new Date(this.currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
            this.currentDate = new Date(this.currentDate.getTime() - 24 * 60 * 60 * 1000);
        }
        this.updateCalendar();
    }

    nextPeriod(): void {
        if (this.viewMode === 'month') {
            this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
        } else if (this.viewMode === 'week') {
            this.currentDate = new Date(this.currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else {
            this.currentDate = new Date(this.currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
        this.updateCalendar();
    }

    goToToday(): void {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.updateCalendar();
    }

    setViewMode(mode: 'day' | 'week' | 'month'): void {
        this.viewMode = mode;
        this.updateCalendar();
    }

    // Update calendar grid
    updateCalendar(): void {
        if (this.viewMode === 'month') {
            this.generateMonthView();
        } else if (this.viewMode === 'week') {
            this.generateWeekView();
        }
    }

    // Generate month view calendar
    generateMonthView(): void {
        this.calendarDays = [];

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const startDay = firstDayOfMonth.getDay();
        const totalDays = lastDayOfMonth.getDate();

        // Previous month days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthLastDay - i);
            this.calendarDays.push(this.createCalendarDay(date, false));
        }

        // Current month days
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            this.calendarDays.push(this.createCalendarDay(date, true));
        }

        // Next month days
        const remainingDays = 42 - this.calendarDays.length;
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            this.calendarDays.push(this.createCalendarDay(date, false));
        }
    }

    // Generate week view
    generateWeekView(): void {
        this.weekDates = [];

        const dayOfWeek = this.currentDate.getDay();
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - dayOfWeek);

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            this.weekDates.push(date);
        }
    }

    createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
        const isToday = this.isSameDay(date, this.today);
        const isSelected = this.isSameDay(date, this.selectedDate);
        const meetings = this.getMeetingsForDate(date);

        return {
            date,
            dayOfMonth: date.getDate(),
            isCurrentMonth,
            isToday,
            isSelected,
            meetings
        };
    }

    // Get meetings for a specific date
    getMeetingsForDate(date: Date): MeetingDetail[] {
        return this.allSchedularMeeting.filter(meeting => {
            if (!meeting.startDate) return false;
            const meetingDate = new Date(meeting.startDate);
            return this.isSameDay(meetingDate, date);
        });
    }

    // Get meetings for a specific time slot
    getMeetingsForTimeSlot(date: Date, slot: TimeSlot): MeetingDetail[] {
        return this.allSchedularMeeting.filter(meeting => {
            if (!meeting.startDate) return false;
            const meetingDate = new Date(meeting.startDate);
            if (!this.isSameDay(meetingDate, date)) return false;

            const meetingHour = meetingDate.getHours();
            const meetingMinute = meetingDate.getMinutes();

            // Check if meeting starts in this slot
            return meetingHour === slot.hour &&
                ((slot.minute === 0 && meetingMinute < 30) || (slot.minute === 30 && meetingMinute >= 30));
        });
    }

    // Check if meeting spans this time slot
    isMeetingInTimeSlot(meeting: MeetingDetail, date: Date, slot: TimeSlot): boolean {
        if (!meeting.startDate) return false;

        const meetingStart = new Date(meeting.startDate);
        const meetingEnd = meeting.endDate ? new Date(meeting.endDate) : new Date(meetingStart.getTime() + 3600000);

        if (!this.isSameDay(meetingStart, date) && !this.isSameDay(meetingEnd, date)) return false;

        const slotStart = new Date(date);
        slotStart.setHours(slot.hour, slot.minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        return meetingStart < slotEnd && meetingEnd > slotStart;
    }

    // Helper: Check if two dates are the same day
    isSameDay(date1: Date, date2: Date): boolean {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    }

    // Select date
    selectDate(day: CalendarDay): void {
        this.selectedDate = day.date;
        this.calendarDays.forEach(d => d.isSelected = false);
        day.isSelected = true;
    }

    // Get current period title
    getPeriodTitle(): string {
        const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

        if (this.viewMode === 'month') {
            return this.currentDate.toLocaleDateString('en-US', options);
        } else if (this.viewMode === 'week') {
            const weekStart = this.weekDates[0];
            const weekEnd = this.weekDates[6];
            if (weekStart && weekEnd) {
                const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
                const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
                if (startMonth === endMonth) {
                    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
                }
                return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
            }
        } else {
            return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
        return '';
    }

    // Check if date is today
    isDateToday(date: Date): boolean {
        return this.isSameDay(date, this.today);
    }

    // Get current time position for red line indicator (now using the tracked property)
    getCurrentTimePosition(): number {
        return this.currentTimePosition;
    }

    // Is current time visible in view (always true now since we show 24 hours)
    isCurrentTimeVisible(): boolean {
        return true;
    }

    // Open schedule meeting modal
    openScheduleModal(date?: Date, slot?: TimeSlot): void {
        this.isSubmitted = false;
        this.initForm();

        if (date && slot) {
            const startDate = new Date(date);
            startDate.setHours(slot.hour, slot.minute, 0, 0);

            this.meetingDate = {
                year: startDate.getFullYear(),
                month: startDate.getMonth() + 1,
                day: startDate.getDate()
            };

            const timeStr = this.formatTimeForDropdown(slot.hour, slot.minute);
            this.meetingForm.patchValue({
                startDate: startDate,
                startTime: timeStr
            });

            // Set end time 1 hour later
            const endDate = new Date(startDate.getTime() + 3600000);
            this.meetingEndDate = {
                year: endDate.getFullYear(),
                month: endDate.getMonth() + 1,
                day: endDate.getDate()
            };

            const endTimeStr = this.formatTimeForDropdown(endDate.getHours(), endDate.getMinutes());
            this.meetingForm.patchValue({
                endDate: endDate,
                endTime: endTimeStr
            });

            this.calculateDuration();
        }

        ShowModal("scheduleMeetingModal");
    }

    formatTimeForDropdown(hour: number, minute: number): string {
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour < 12 ? "A.M" : "P.M";
        const minStr = minute >= 30 ? "30" : "00";
        return `${displayHour}:${minStr} ${ampm}`;
    }

    // Form handlers
    onMeetingDateSelect(e: NgbDateStruct): void {
        let startTime = this.meetingForm.get("startTime")?.value;
        let date;
        if (startTime) {
            const time = this.convertTo24Hour(startTime);
            date = new Date(e.year, e.month - 1, e.day, time[0], time[1]);
        } else {
            date = new Date(e.year, e.month - 1, e.day);
        }
        this.meetingForm.get('startDate')?.setValue(date);
        this.minEndPickerDate = e;
        this.calculateDuration();
    }

    onMeetingEndDateSelect(e: NgbDateStruct): void {
        let endTime = this.meetingForm.get("endTime")?.value;
        let date;
        if (endTime) {
            const time = this.convertTo24Hour(endTime);
            date = new Date(e.year, e.month - 1, e.day, time[0], time[1]);
        } else {
            date = new Date(e.year, e.month - 1, e.day);
        }
        this.meetingForm.get('endDate')?.setValue(date);
        this.calculateDuration();
    }

    onStartTimeSelect(): void {
        const date = this.meetingForm.get('startDate')?.value;
        if (date) {
            const startTime = this.meetingForm.get("startTime")?.value;
            const time = this.convertTo24Hour(startTime);
            const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time[0], time[1]);
            this.meetingForm.get('startDate')?.setValue(selectedDate);
            this.calculateDuration();
        }
    }

    onEndTimeSelect(): void {
        const date = this.meetingForm.get('endDate')?.value;
        if (date) {
            const endTime = this.meetingForm.get("endTime")?.value;
            const time = this.convertTo24Hour(endTime);
            const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time[0], time[1]);
            this.meetingForm.get('endDate')?.setValue(selectedDate);
            this.calculateDuration();
        }
    }

    convertTo24Hour(time: string): number[] {
        const timeParts = time.split(' ');
        const timeArr = timeParts[0].split(':');
        let hours = parseInt(timeArr[0], 10);
        const minutes = parseInt(timeArr[1], 10);
        const period = timeParts[1];

        if (period === 'A.M' && hours === 12) {
            hours = 0;
        }
        if (period === 'P.M' && hours !== 12) {
            hours += 12;
        }

        return [hours, minutes];
    }

    calculateDuration(): void {
        const startDate = this.meetingForm.get('startDate')?.value;
        const endDate = this.meetingForm.get('endDate')?.value;
        const startTime = this.meetingForm.get('startTime')?.value;
        const endTime = this.meetingForm.get('endTime')?.value;

        if (startDate && endDate && startTime && endTime) {
            const timeDifferenceMs = endDate.getTime() - startDate.getTime();
            if (timeDifferenceMs < 0) {
                this.meetingForm.get("endDate")?.setValue(null);
                return;
            }
            this.meetingForm.get("durationInSecond")?.setValue(timeDifferenceMs / 1000);
            const totalMinutes = Math.floor(timeDifferenceMs / 60000);
            const hours = Math.floor(totalMinutes / 60);
            this.duration = `${hours}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
        }
    }

    // Save meeting
    saveMeeting(): void {
        this.isSubmitted = true;
        if (this.meetingForm.invalid) {
            return;
        }

        this.isLoading = true;
        const value = this.meetingForm.getRawValue();

        this.http.post("meeting/generateMeeting", value).then((res: ResponseModel) => {
            if (res.ResponseBody) {
                this.bindMeetings(res.ResponseBody);
                this.updateCalendar();
                HideModal("scheduleMeetingModal");
                this.isLoading = false;
                this.isSubmitted = false;
            }
        }).catch(e => {
            this.isLoading = false;
        });
    }

    // Join meeting
    joinMeeting(meeting: MeetingDetail): void {
        meeting.meetingId = `${meeting.meetingId}_${meeting.meetingDetailId}`;
        this.nav.navigate(Preview, meeting);
    }

    // Show meeting details
    showMeetingDetails(meeting: MeetingDetail): void {
        this.selectedMeeting = meeting;
        ShowModal("meetingDetailsModal");
    }

    // Copy meeting link
    copyMeetingLink(meeting: MeetingDetail, tooltip: any): void {
        const url = environment.production
            ? `www.axilcorps.com/#/btc/preview?meetingid=${meeting.meetingId}_${meeting.meetingDetailId}`
            : `http://localhost:4200/#/btc/preview?meetingid=${meeting.meetingId}_${meeting.meetingDetailId}`;

        navigator.clipboard.writeText(url).then(() => {
            tooltip.open();
            setTimeout(() => tooltip.close(), 1500);
        });
    }

    // Format time
    formatTime(date: Date): string {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'P.M' : 'A.M';

        hours = hours % 12;
        hours = hours ? hours : 12;

        const minStr = minutes < 10 ? '0' + minutes : minutes.toString();
        return `${hours}:${minStr} ${ampm}`;
    }

    // Get meeting color class based on index
    getMeetingColor(index: number): string {
        const colors = ['meeting-purple', 'meeting-blue', 'meeting-green', 'meeting-orange', 'meeting-pink'];
        return colors[index % colors.length];
    }
}
