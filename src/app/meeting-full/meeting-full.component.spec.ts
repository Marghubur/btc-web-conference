import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingFullComponent } from './meeting-full.component';

describe('MeetingFullComponent', () => {
  let component: MeetingFullComponent;
  let fixture: ComponentFixture<MeetingFullComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingFullComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingFullComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
