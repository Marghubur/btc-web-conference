import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'bt-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bt.button.component.html',
  styleUrl: './bt.button.component.scss'
})
export class BtButtonComponent {
  @Input() label: string = 'Click Me';
  @Input() type: 'primary' | 'secondary' | 'danger' | 'warning' = 'primary';
  @Input() disabled: boolean = false;
  @Input() class: string | string[] = '';
  @Input() icon?: string; // Bootstrap icon name e.g. "bi-save"
  @Input() outline: boolean = false;

  @Output() clicked = new EventEmitter<void>();

  get finalClasses() {
    const base = this.outline ? `outline outline-${this.type}` : this.type;
    return [base, this.class];
  }

  onClick() {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}
