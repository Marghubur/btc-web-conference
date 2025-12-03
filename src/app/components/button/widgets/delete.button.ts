import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BtButtonComponent } from '../bt.button.component';

@Component({
  selector: 'button-delete',
  standalone: true,
  imports: [BtButtonComponent],
  template: `
    <bt-button
      label="Delete"
      [outline]="outline"
      type="primary"
      [icon]="icon"
      (clicked)="clicked.emit()"
    >
    </bt-button>
  `
})
export class DeleteButton {
  @Input() outline: boolean = false; // <-- REQUIRED!
  @Input() icon: string = 'bi-save';

  @Output() clicked = new EventEmitter<void>();
}
