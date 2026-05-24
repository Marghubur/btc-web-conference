import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NullPageComponent } from './null-page.component';

describe('NullPageComponent', () => {
  let component: NullPageComponent;
  let fixture: ComponentFixture<NullPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NullPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NullPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
