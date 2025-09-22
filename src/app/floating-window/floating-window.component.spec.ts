import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FloatingWindowComponent } from './floating-window.component';

describe('FloatingWindowComponent', () => {
  let component: FloatingWindowComponent;
  let fixture: ComponentFixture<FloatingWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingWindowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FloatingWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
