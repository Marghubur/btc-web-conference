import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InMeetingRoomComponent } from './in-meeting-room.component';

describe('InMeetingRoomComponent', () => {
  let component: InMeetingRoomComponent;
  let fixture: ComponentFixture<InMeetingRoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InMeetingRoomComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InMeetingRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
