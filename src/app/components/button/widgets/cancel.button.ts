import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BtButtonComponent } from '../bt.button.component';

@Component({
  selector: 'button-cancel',
  standalone: true,
  imports: [BtButtonComponent],
  template: `
    <bt-button
      label="Cancel"
      [outline]="outline"
      type="primary"
      [icon]="icon"
      (clicked)="clicked.emit()"
    >
    </bt-button>
  `
})
export class CancelButton {
  @Input() outline: boolean = false; // <-- REQUIRED!
  @Input() icon: string = 'bi-save';

  @Output() clicked = new EventEmitter<void>();
}
