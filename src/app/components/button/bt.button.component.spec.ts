import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BtButtonComponent } from './bt.button.component';

describe('BtButtonComponent', () => {
  let component: BtButtonComponent;
  let fixture: ComponentFixture<BtButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BtButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BtButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
