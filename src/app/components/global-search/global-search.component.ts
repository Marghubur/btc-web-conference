// global-search.component.ts

import {
    Component,
    OnInit,
    OnDestroy,
    inject,
    signal,
    computed,
    ElementRef,
    ViewChild,
    HostListener,
    PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { GlobalSearchService } from './global-search.service';
import { UserDetail, Conversation } from './search.models';
import { LocalService } from '../../providers/services/local.service';
import { ChatService } from '../../chat/chat.service';

@Component({
    selector: 'global-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './global-search.component.html',
    styleUrls: ['./global-search.component.css']
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
    public readonly searchService = inject(GlobalSearchService);
    private readonly router = inject(Router);
    private readonly localService = inject(LocalService);
    private readonly chatService = inject(ChatService);
    private readonly platformId = inject(PLATFORM_ID);
    private keyboardShortcutHandler: ((event: KeyboardEvent) => void) | null = null;
    currentUserId: string = '';

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
    @ViewChild('searchContainer') searchContainer!: ElementRef<HTMLDivElement>;
    @ViewChild('resultsList') resultsList!: ElementRef<HTMLDivElement>;

    // Local UI state
    selectedIndex = signal(-1);

    // Configuration
    placeholder = signal('Search people, chats, messages...');
    showDebugInfo = signal(false); // Set to true in development

    // Platform-aware shortcut hint
    shortcutHint = signal('⌘K');

    // Signal aliases for template access
    query = this.searchService.query;
    isLoading = this.searchService.isLoading;
    isOpen = this.searchService.isOpen;
    error = this.searchService.error;

    // Computed values derived from service signals
    results = this.searchService.results;

    users = computed(() => this.results()?.results?.users ?? []);
    conversations = computed(() => this.results()?.results?.conversations ?? []);
    totalCount = computed(() => this.results()?.metadata?.totalCount ?? 0);
    executionTime = computed(() => this.results()?.metadata?.executionTimeMs);
    fromCache = computed(() => this.results()?.metadata?.fromCache ?? false);
    isRetriable = computed(() => this.searchService.error() && (this.searchService.error() === 'Network error. Please check your connection.' || this.searchService.error() === 'Search failed. Please try again.'));
    // Simplified isRetriable logic or just assume true for common errors if retriable isn't in error property
    // But let's check if the error signal gives us an object or string. The service sets it to string. 
    // So we can just say "if error exists".

    hasResults = computed(() => {
        const r = this.results();
        return (r?.results?.users?.length ?? 0) > 0 ||
            (r?.results?.conversations?.length ?? 0) > 0;
    });

    hasError = computed(() => !!this.searchService.error());

    allResults = computed(() => [...this.users(), ...this.conversations()]);

    ngOnInit(): void {
        // Check if in development mode
        this.showDebugInfo.set(this.isDevMode());

        // Detect platform for shortcut hint
        if (isPlatformBrowser(this.platformId)) {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            this.shortcutHint.set(isMac ? '⌘K' : 'Ctrl+K');
        }

        // Setup keyboard shortcut (Cmd/Ctrl + K)
        this.setupKeyboardShortcut();

        // Get current user ID
        const user = this.localService.getUser();
        if (user) {
            this.currentUserId = user.userId;
        }
    }

    ngOnDestroy(): void {
        // Clean up keyboard shortcut listener to prevent memory leak
        if (this.keyboardShortcutHandler && isPlatformBrowser(this.platformId)) {
            document.removeEventListener('keydown', this.keyboardShortcutHandler);
        }
    }

    /**
     * Handle input changes
     */
    onQueryChange(value: string): void {
        this.selectedIndex.set(-1);
        this.searchService.search(value);

        if (value.length >= 2) {
            this.searchService.setSearchOpen(true);
        }
    }

    /**
     * Handle input focus
     */
    onFocus(): void {
        this.searchService.setSearchOpen(true);
        if (this.searchService.query().length >= 2 && !this.results()) {
            this.searchService.search(this.searchService.query());
        }
    }

    /**
     * Handle keyboard navigation
     */
    onKeyDown(event: KeyboardEvent): void {
        const results = this.allResults();
        const total = results.length;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex.update(idx => {
                    const newIdx = Math.min(idx + 1, total - 1);
                    this.scrollToSelectedItem(newIdx);
                    return newIdx;
                });
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex.update(idx => {
                    const newIdx = Math.max(idx - 1, -1);
                    this.scrollToSelectedItem(newIdx);
                    return newIdx;
                });
                break;

            case 'Enter':
                event.preventDefault();
                const idx = this.selectedIndex();
                if (idx >= 0 && idx < total) {
                    this.selectResult(results[idx]);
                } else if (this.searchService.query().length >= 2) {
                    this.seeAllResults();
                }
                break;

            case 'Escape':
                event.preventDefault();
                this.closeDropdown();
                this.searchInput?.nativeElement?.blur();
                break;

            case 'Tab':
                this.closeDropdown();
                break;
        }
    }

    /**
     * Clear search
     */
    clearSearch(): void {
        this.searchService.clearSearch();
        this.selectedIndex.set(-1);
        this.searchInput?.nativeElement?.focus();
    }

    /**
     * Close dropdown
     */
    closeDropdown(): void {
        this.searchService.setSearchOpen(false);
        this.selectedIndex.set(-1);
    }

    selectResult(result: UserDetail | Conversation): void {
        console.log('Selected:', result);
        this.closeDropdown();

        if ('conversationName' in result) {
            // It's a Conversation
            let groupChat: Conversation = result;

            // Check if we are already on the chat page
            if (this.router.url.includes('/btc/chat')) {
                this.chatService.openChat$.next(groupChat);
            } else {
                this.router.navigate(['/btc/chat'], { state: { selectedUser: groupChat } });
            }

        } else {
            // It's a UserDetail
            let userDetail: UserDetail = result;

            // Check if we are already on the chat page
            if (this.router.url.includes('/btc/chat')) {
                this.chatService.openChat$.next(userDetail);
            } else {
                this.router.navigate(['/btc/chat'], { state: { selectedUser: userDetail } });
            }
        }
    }

    /**
     * Set selected index on hover
     */
    setSelectedIndex(index: number): void {
        this.selectedIndex.set(index);
    }

    /**
     * See all results (full search)
     */
    async seeAllResults(): Promise<void> {
        const q = this.searchService.query();
        if (q.length >= 2) {
            try {
                await this.searchService.fullSearch(q);
                // Navigate to full search results page
                // this.router.navigate(['/search'], { queryParams: { q } });
            } catch (err) {
                // Error handled by service signal
            }
        }
    }

    /**
     * Retry failed search
     */
    retry(): void {
        this.searchService.search(this.searchService.query());
    }

    /**
     * Get initials from name
     */
    getInitials(name: string): string {
        return name
            .split(' ')
            .map(part => part.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    /**
     * Handle click outside to close dropdown
     */
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (this.searchContainer &&
            !this.searchContainer.nativeElement.contains(event.target as Node)) {
            this.closeDropdown();
        }
    }

    /**
     * Scroll to keep selected item visible
     */
    private scrollToSelectedItem(index: number): void {
        if (!isPlatformBrowser(this.platformId)) return;

        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            const dropdown = this.searchContainer?.nativeElement?.querySelector('.search-dropdown');
            const selectedItem = dropdown?.querySelectorAll('.result-item')[index] as HTMLElement;

            if (selectedItem && dropdown) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 0);
    }

    /**
     * Setup Cmd/Ctrl + K shortcut
     */
    private setupKeyboardShortcut(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        this.keyboardShortcutHandler = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                this.searchInput?.nativeElement?.focus();
                this.searchService.setSearchOpen(true);
            }
        };

        document.addEventListener('keydown', this.keyboardShortcutHandler);
    }

    /**
     * Check if running in development mode
     */
    private isDevMode(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;

        try {
            // Angular's isDevMode() can be imported, or check manually
            return !!(window as any).ng?.probe;
        } catch {
            return false;
        }
    }
}