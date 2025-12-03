import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BtButtonComponent } from '../bt.button.component';

@Component({
  selector: 'button-upload',
  standalone: true,
  imports: [BtButtonComponent],
  template: `
    <bt-button
      label="Upload"
      [outline]="outline"
      type="primary"
      [icon]="icon"
      (clicked)="clicked.emit()"
    >
    </bt-button>
  `
})
export class UploadButton {
  @Input() outline: boolean = false; // <-- REQUIRED!
  @Input() icon: string = 'bi-save';

  @Output() clicked = new EventEmitter<void>();
}
