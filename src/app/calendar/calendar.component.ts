import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { AjaxService } from '../providers/services/ajax.service';
import { iNavigation } from '../providers/services/iNavigation';
import { LocalService } from '../providers/services/local.service';
import { HideModal, ShowModal, ToLocateDate } from '../providers/services/common.service';
import { environment } from '../../environments/environment';
import { MeetingDetail, ResponseModel, User } from '../models/model';
import { Preview } from '../models/constant';
import { ConfeetSocketService } from '../providers/socket/confeet-socket.service';
import { Router } from '@angular/router';
import { CallType } from '../models/conference_call/call_model';
import { JoinCallService } from '../providers/socket/client-events/call/join-call.service';

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
    user: User = null;
    private columnLayoutCache: { [key: string]: { width: string, left: string } } = {};
    private lastLayoutCacheDate: string = '';

    constructor(
        private ws: ConfeetSocketService,
        private router: Router,
        private fb: FormBuilder,
        private http: AjaxService,
        private ngZone: NgZone,
        private local: LocalService,
        private joinCallService: JoinCallService
    ) {
        const today = new Date();
        this.minPickerDate = {
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate()
        };
    }

    ngOnInit(): void {
        this.user = this.local.getUser();
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
        this.http.get("meeting/getAllScheduleMeetingByOrganizer").then((res: ResponseModel) => {
            if (res.responseBody) {
                this.bindMeetings(res.responseBody);
                this.updateCalendar();
                this.isPageReady = true;
            }
        }).catch(e => {
            this.isPageReady = true;
        });
    }

    private isUtcDate(date: any): boolean {
        if (typeof date === 'string') {
            return !date.endsWith('Z') && !date.includes('+') && !date.includes('-0') && !date.match(/-\d{2}:\d{2}$/);
        }
        return false;
    }

    private convertedDate(date: any) {
        return ToLocateDate(date);
    }

    bindMeetings(res: any): void {
        let rawList: any[] = [];
        if (Array.isArray(res)) {
            rawList = res;
        } else if (res && typeof res === 'object') {
            if (Array.isArray(res.ScheduledMeetings) || Array.isArray(res.QuickMeetings)) {
                rawList = [...(res.ScheduledMeetings || []), ...(res.QuickMeetings || [])];
            } else if (Array.isArray(res.data)) {
                rawList = res.data;
            } else if (Array.isArray(res.Meetings)) {
                rawList = res.Meetings;
            } else {
                rawList = [res];
            }
        }
        this.allMeetings = rawList;
        this.allSchedularMeeting = this.allMeetings.filter(x => !x.hasQuickMeeting);
        this.columnLayoutCache = {};
        this.lastLayoutCacheDate = '';

        // Parse meeting times and convert UTC to local system time
        this.allSchedularMeeting.forEach(meeting => {
            if (meeting.startDate) {
                if (this.isUtcDate(meeting.startDate)) {
                    meeting.startDate = this.convertedDate(meeting.startDate);
                }
                const startDate = new Date(meeting.startDate);
                meeting.startTime = this.formatTime(startDate);
                if (meeting.endDate && this.isUtcDate(meeting.endDate)) {
                    meeting.endDate = this.convertedDate(meeting.endDate);
                }
                if (meeting.durationInSecond) {
                    meeting.endDate = new Date(startDate.getTime() + (meeting.durationInSecond * 1000));
                    meeting.endTime = this.formatTime(meeting.endDate);
                } else if (meeting.endDate) {
                    meeting.endTime = this.formatTime(new Date(meeting.endDate));
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
            this.selectedDate = new Date(this.currentDate);
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
            this.selectedDate = new Date(this.currentDate);
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
        if (mode === 'day' && this.selectedDate) {
            this.currentDate = new Date(this.selectedDate);
        }
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
            const meetingStart = new Date(meeting.startDate);
            const meetingEnd = meeting.endDate ? new Date(meeting.endDate) : new Date(meetingStart.getTime() + (meeting.durationInSecond ? meeting.durationInSecond * 1000 : 3600000));

            const checkDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const startDay = new Date(meetingStart.getFullYear(), meetingStart.getMonth(), meetingStart.getDate());
            const endDay = new Date(meetingEnd.getFullYear(), meetingEnd.getMonth(), meetingEnd.getDate());

            return checkDay >= startDay && checkDay <= endDay;
        });
    }

    // Get meetings STARTING in a specific time slot for single-card Teams style display
    getMeetingsStartingInTimeSlot(date: Date, slot: TimeSlot): MeetingDetail[] {
        return this.allSchedularMeeting.filter(meeting => {
            if (!meeting.startDate) return false;

            const meetingStart = new Date(meeting.startDate);
            const meetingEnd = meeting.endDate ? new Date(meeting.endDate) : new Date(meetingStart.getTime() + (meeting.durationInSecond ? meeting.durationInSecond * 1000 : 3600000));

            const checkDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
            const checkDayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

            if (meetingEnd <= checkDayStart || meetingStart > checkDayEnd) return false;

            // If meeting started on a previous day, it starts visually at slot 00:00 for today
            if (meetingStart < checkDayStart) {
                return slot.hour === 0 && slot.minute === 0;
            }

            // Otherwise check if meetingStart falls exactly into this 30-minute slot
            const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), slot.hour, slot.minute, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

            return meetingStart >= slotStart && meetingStart < slotEnd;
        });
    }

    // Calculate Teams-style height in pixels for a single card spanning multiple slots
    getMeetingSlotHeight(meeting: MeetingDetail, viewType: 'week' | 'day', date: Date): number {
        if (!meeting.startDate) return viewType === 'week' ? 45 : 57;

        const meetingStart = new Date(meeting.startDate);
        const meetingEnd = meeting.endDate ? new Date(meeting.endDate) : new Date(meetingStart.getTime() + (meeting.durationInSecond ? meeting.durationInSecond * 1000 : 3600000));

        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 24, 0, 0, 0);

        const effectiveStart = meetingStart < dayStart ? dayStart : meetingStart;
        const effectiveEnd = meetingEnd > dayEnd ? dayEnd : meetingEnd;

        const durationMinutes = Math.max(30, (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
        const slotsSpan = durationMinutes / 30;

        // In week view, each slot row is 49px (48px min-height + 1px border).
        // In day view, each slot row is 61px (60px min-height + 1px border).
        const slotHeight = viewType === 'week' ? 49 : 61;

        return Math.max(slotHeight - 4, slotsSpan * slotHeight - 4);
    }

    // Calculate Teams-style collision layout (width and left position) for overlapping meetings on a day
    getMeetingColumnLayout(meeting: MeetingDetail, date: Date): { width: string, left: string } {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

        // Clear cache if date changed
        if (this.lastLayoutCacheDate !== dateKey) {
            this.columnLayoutCache = {};
            this.lastLayoutCacheDate = dateKey;
        }

        const meetingKey = `${meeting.meetingDetailId || meeting.meetingId || meeting.title}_${dateKey}`;
        if (this.columnLayoutCache[meetingKey]) {
            return this.columnLayoutCache[meetingKey];
        }

        const dayMeetings = this.getMeetingsForDate(date);
        if (!dayMeetings || dayMeetings.length === 0) {
            return { width: 'calc(100% - 4px)', left: '2px' };
        }

        // Convert meetings to time intervals in minutes from start of day
        const dayStartMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
        const dayEndMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();

        const intervals = dayMeetings.map(m => {
            const start = m.startDate ? new Date(m.startDate).getTime() : dayStartMs;
            const end = m.endDate ? new Date(m.endDate).getTime() : (start + (m.durationInSecond ? m.durationInSecond * 1000 : 3600000));

            const effStart = Math.max(dayStartMs, start);
            const effEnd = Math.min(dayEndMs, Math.max(effStart + 30 * 60 * 1000, end));

            const startMin = Math.floor((effStart - dayStartMs) / 60000);
            const endMin = Math.ceil((effEnd - dayStartMs) / 60000);

            return {
                meeting: m,
                startMin,
                endMin,
                colIndex: 0,
                totalCols: 1
            };
        });

        // Sort by start time ascending, then duration descending
        intervals.sort((a, b) => {
            if (a.startMin !== b.startMin) return a.startMin - b.startMin;
            return (b.endMin - b.startMin) - (a.endMin - a.startMin);
        });

        // Partition into overlapping clusters (collision groups)
        let cluster: typeof intervals = [];
        let clusterMaxEnd = -1;

        const processCluster = (cls: typeof intervals) => {
            if (cls.length === 0) return;
            const assigned: typeof intervals = [];
            let maxCol = 0;

            cls.forEach(item => {
                let col = 0;
                while (true) {
                    const conflict = assigned.some(already =>
                        already.colIndex === col &&
                        Math.max(item.startMin, already.startMin) < Math.min(item.endMin, already.endMin)
                    );
                    if (!conflict) break;
                    col++;
                }
                item.colIndex = col;
                if (col > maxCol) maxCol = col;
                assigned.push(item);
            });

            const totalCols = maxCol + 1;
            cls.forEach(item => {
                const widthPercent = 100 / totalCols;
                const leftPercent = widthPercent * item.colIndex;
                const mKey = `${item.meeting.meetingDetailId || item.meeting.meetingId || item.meeting.title}_${dateKey}`;

                if (totalCols === 1) {
                    this.columnLayoutCache[mKey] = { width: 'calc(100% - 4px)', left: '2px' };
                } else {
                    this.columnLayoutCache[mKey] = {
                        width: `calc(${widthPercent}% - 4px)`,
                        left: `calc(${leftPercent}% + 2px)`
                    };
                }
            });
        };

        intervals.forEach(item => {
            if (cluster.length === 0) {
                cluster.push(item);
                clusterMaxEnd = item.endMin;
            } else if (item.startMin < clusterMaxEnd) {
                cluster.push(item);
                if (item.endMin > clusterMaxEnd) clusterMaxEnd = item.endMin;
            } else {
                processCluster(cluster);
                cluster = [item];
                clusterMaxEnd = item.endMin;
            }
        });
        processCluster(cluster);

        return this.columnLayoutCache[meetingKey] || { width: 'calc(100% - 4px)', left: '2px' };
    }

    getMeetingWidth(meeting: MeetingDetail, date: Date): string {
        return this.getMeetingColumnLayout(meeting, date).width;
    }

    getMeetingLeft(meeting: MeetingDetail, date: Date): string {
        return this.getMeetingColumnLayout(meeting, date).left;
    }

    // Get meetings for a specific time slot
    getMeetingsForTimeSlot(date: Date, slot: TimeSlot): MeetingDetail[] {
        return this.allSchedularMeeting.filter(meeting => {
            if (!meeting.startDate) return false;
            return this.isMeetingInTimeSlot(meeting, date, slot);
        });
    }

    // Check if meeting spans this time slot
    isMeetingInTimeSlot(meeting: MeetingDetail, date: Date, slot: TimeSlot): boolean {
        if (!meeting.startDate) return false;

        const meetingStart = new Date(meeting.startDate);
        const meetingEnd = meeting.endDate ? new Date(meeting.endDate) : new Date(meetingStart.getTime() + (meeting.durationInSecond ? meeting.durationInSecond * 1000 : 3600000));

        const checkDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const startDay = new Date(meetingStart.getFullYear(), meetingStart.getMonth(), meetingStart.getDate());
        const endDay = new Date(meetingEnd.getFullYear(), meetingEnd.getMonth(), meetingEnd.getDate());

        if (checkDay < startDay || checkDay > endDay) return false;

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
        this.currentDate = new Date(day.date);
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
            if (res.responseBody) {
                this.bindMeetings(res.responseBody);
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
    joinMeeting(item: MeetingDetail): void {
        this.ws.currentConversationId.set(item.conversationId);
        this.joinCallService.execute(this.user.userId, item.conversationId);
        this.router.navigate(['/btc/preview'], {
            state: {
                id: item.conversationId,
                type: CallType.AUDIO,
                autoJoin: true,
                title: item.title ? item.title : 'Unknown'
            }
        });
    }

    // Show meeting details
    showMeetingDetails(meeting: MeetingDetail): void {
        this.selectedMeeting = meeting;
        ShowModal("meetingDetailsModal");
    }

    // Copy meeting link
    copyMeetingLink(meeting: any, tooltip: any): void {
        const targetId = meeting.meetingId && meeting.meetingDetailId ? `${meeting.meetingId}_${meeting.meetingDetailId}` : (meeting.meetingId || meeting.id);
        const url = environment.production
            ? `https://www.confeet.com/#/btc/preview?meetingid=${targetId}`
            : `http://localhost:4200/#/btc/preview?meetingid=${targetId}`;

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

    // Get meeting color class based on index or meeting ID
    getMeetingColor(index: number | any): string {
        const colors = ['meeting-purple', 'meeting-blue', 'meeting-green', 'meeting-orange', 'meeting-pink'];
        if (typeof index === 'object' && index !== null) {
            const id = index.meetingDetailId || index.meetingId || index.title || '';
            let hash = 0;
            const str = id.toString();
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return colors[Math.abs(hash) % colors.length];
        }
        return colors[(index as number) % colors.length];
    }
}
