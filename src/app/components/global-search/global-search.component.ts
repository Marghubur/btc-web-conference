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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GlobalSearchService } from './global-search.service';
import { SearchResultItem, GlobalSearchResponse } from './search.models';

@Component({
    selector: 'global-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './global-search.component.html',
    styleUrls: ['./global-search.component.css']
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
    private readonly searchService = inject(GlobalSearchService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly destroy$ = new Subject<void>();
    private keyboardShortcutHandler: ((event: KeyboardEvent) => void) | null = null;

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
    @ViewChild('searchContainer') searchContainer!: ElementRef<HTMLDivElement>;
    @ViewChild('resultsList') resultsList!: ElementRef<HTMLDivElement>;

    // Signals for state
    query = signal('');
    results = signal<GlobalSearchResponse | null>(null);
    isLoading = signal(false);
    error = signal<string | null>(null);
    isOpen = signal(false);
    selectedIndex = signal(-1);

    // Configuration
    placeholder = signal('Search people, chats, messages...');
    showDebugInfo = signal(false); // Set to true in development

    // Platform-aware shortcut hint
    shortcutHint = signal('⌘K');

    // Computed values
    users = computed(() => this.results()?.results?.users ?? []);
    conversations = computed(() => this.results()?.results?.conversations ?? []);
    totalCount = computed(() => this.results()?.metadata?.totalCount ?? 0);
    executionTime = computed(() => this.results()?.metadata?.executionTimeMs);
    fromCache = computed(() => this.results()?.metadata?.fromCache ?? false);
    isRetriable = computed(() => this.results()?.error?.retriable ?? false);

    hasResults = computed(() => {
        const r = this.results();
        return (r?.results?.users?.length ?? 0) > 0 ||
            (r?.results?.conversations?.length ?? 0) > 0;
    });

    hasError = computed(() => !!this.error());

    allResults = computed(() => [...this.users(), ...this.conversations()]);

    ngOnInit(): void {
        // Subscribe to search service state
        this.searchService.state$
            .pipe(takeUntil(this.destroy$))
            .subscribe(state => {
                this.query.set(state.query);
                this.results.set(state.results);
                this.isLoading.set(state.isLoading);
                this.error.set(state.error);
            });

        // Check if in development mode
        this.showDebugInfo.set(this.isDevMode());

        // Detect platform for shortcut hint
        if (isPlatformBrowser(this.platformId)) {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            this.shortcutHint.set(isMac ? '⌘K' : 'Ctrl+K');
        }

        // Setup keyboard shortcut (Cmd/Ctrl + K)
        this.setupKeyboardShortcut();
    }

    ngOnDestroy(): void {
        // Clean up keyboard shortcut listener to prevent memory leak
        if (this.keyboardShortcutHandler && isPlatformBrowser(this.platformId)) {
            document.removeEventListener('keydown', this.keyboardShortcutHandler);
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Handle input changes
     */
    onQueryChange(value: string): void {
        this.query.set(value);
        this.selectedIndex.set(-1);
        this.searchService.search(value);

        if (value.length >= 2) {
            this.isOpen.set(true);
        }
    }

    /**
     * Handle input focus
     */
    onFocus(): void {
        this.isOpen.set(true);
        if (this.query().length >= 2 && !this.results()) {
            this.searchService.search(this.query());
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
                } else if (this.query().length >= 2) {
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
        this.isOpen.set(false);
        this.selectedIndex.set(-1);
    }

    /**
     * Select a result
     */
    selectResult(result: SearchResultItem): void {
        console.log('Selected:', result);
        this.closeDropdown();

        // Navigate based on result type
        switch (result.type) {
            case 'USER':
                // Navigate to user profile or start chat
                // this.router.navigate(['/user', result.id]);
                break;
            case 'CONVERSATION':
                // Navigate to conversation
                // this.router.navigate(['/chat', result.id]);
                break;
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
    seeAllResults(): void {
        const q = this.query();
        if (q.length >= 2) {
            this.searchService.fullSearch(q).subscribe({
                next: (results) => {
                    this.results.set(results);
                    // Navigate to full search results page
                    // this.router.navigate(['/search'], { queryParams: { q } });
                },
                error: (err) => {
                    this.error.set(err.message);
                }
            });
        }
    }

    /**
     * Retry failed search
     */
    retry(): void {
        this.error.set(null);
        this.searchService.search(this.query());
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
                this.isOpen.set(true);
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