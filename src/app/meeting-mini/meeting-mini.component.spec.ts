import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingMiniComponent } from './meeting-mini.component';

describe('MeetingMiniComponent', () => {
  let component: MeetingMiniComponent;
  let fixture: ComponentFixture<MeetingMiniComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingMiniComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingMiniComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
