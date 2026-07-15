import { Component, EventEmitter, Input, Output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchResult } from '../../../components/global-search/search.models';

@Component({
  selector: 'app-multi-user-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './multi-user-autocomplete.component.html',
  styleUrl: './multi-user-autocomplete.component.css'
})
export class MultiUserAutocompleteComponent {
  @Input() placeholder: string = 'Search users by name or email...';
  @Input() selectedUsers: SearchResult[] = [];
  @Input() searchResults: SearchResult[] = [];
  @Input() isLoading: boolean = false;
  @Input() currentUserId: string = '';

  @Output() searchChange = new EventEmitter<string>();
  @Output() selectedUsersChange = new EventEmitter<SearchResult[]>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  query: string = '';
  isOpen: boolean = false;
  selectedIndex: number = -1;
  isFocused: boolean = false;

  // Predefined soft color palette matching Google Meet/Teams
  readonly colors = [
    '#f28b829f', '#FDD663', '#81C995', '#AECBFA', '#D7AEFB', '#FFB300',
    '#34A853', '#4285F4', '#FBBC05', '#EA4335', '#9AA0A6', '#F6C7B6'
  ];

  getColorFromName(name: string): string {
    if (!name) return '#9AA0A6';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % this.colors.length;
    return this.colors[index];
  }

  getInitials(name: string): string {
    if (!name) return '';
    const words = name.trim().split(' ').slice(0, 2);
    return words.map(w => w.length > 0 ? w.charAt(0).toUpperCase() : '').join('');
  }

  get filteredResults(): SearchResult[] {
    return (this.searchResults || []).filter(u => u && u.userId !== this.currentUserId);
  }

  isSelected(user: SearchResult): boolean {
    return this.selectedUsers.some(u => 
      (u.conversationId && u.conversationId === user.conversationId) || 
      (u.userId && u.userId === user.userId)
    );
  }

  onInput(): void {
    this.selectedIndex = -1;
    this.isOpen = true;
    this.searchChange.emit(this.query);
  }

  onFocus(): void {
    this.isFocused = true;
    if (this.query.trim().length >= 1 || this.filteredResults.length > 0) {
      this.isOpen = true;
    }
  }

  onBlur(): void {
    this.isFocused = false;
    // Delay closing dropdown so click events on dropdown items can execute safely
    setTimeout(() => {
      this.isOpen = false;
    }, 200);
  }

  onContainerClick(): void {
    this.searchInput?.nativeElement?.focus();
  }

  toggleSelection(user: SearchResult, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isSelected(user)) {
      this.removeUser(user);
    } else {
      this.addUser(user);
    }
  }

  addUser(user: SearchResult): void {
    if (!this.isSelected(user)) {
      const updated = [...this.selectedUsers, user];
      this.selectedUsersChange.emit(updated);
    }
    this.query = '';
    this.searchChange.emit('');
    this.selectedIndex = -1;
    this.searchInput?.nativeElement?.focus();
  }

  removeUser(user: SearchResult, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const updated = this.selectedUsers.filter(u => 
      !( (u.conversationId && u.conversationId === user.conversationId) || (u.userId && u.userId === user.userId) )
    );
    this.selectedUsersChange.emit(updated);
    this.searchInput?.nativeElement?.focus();
  }

  removeLastUser(event: KeyboardEvent): void {
    if (this.query === '' && this.selectedUsers.length > 0 && event.key === 'Backspace') {
      const updated = this.selectedUsers.slice(0, -1);
      this.selectedUsersChange.emit(updated);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    const total = this.filteredResults.length;
    if (event.key === 'Backspace') {
      this.removeLastUser(event);
      return;
    }
    if (!this.isOpen || total === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % total;
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + total) % total;
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < total) {
          this.toggleSelection(this.filteredResults[this.selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen = false;
        break;
    }
  }
}
