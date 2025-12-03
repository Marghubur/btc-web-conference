import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'list-tile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-title.component.html',
  styleUrl: './list-title.component.scss'
})
export class ListTitle {
  @Input() label: string = 'Click Me';
  @Input() icon?: string; // Bootstrap icon name e.g. "bi-save"
  @Input() disabled: boolean = false;

  @Output() clicked = new EventEmitter<void>();

  onClick() {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}