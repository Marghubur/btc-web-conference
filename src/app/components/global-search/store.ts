// search.store.ts - Signal-based state management for Angular 18

import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
    Observable,
    Subject,
    debounceTime,
    distinctUntilChanged,
    switchMap,
    tap,
    catchError,
    of,
    filter,
    takeUntil
} from 'rxjs';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { GlobalSearchResponse } from './search.models';

/**
 * Signal-based search store using Angular 18's signals
 * This provides a more reactive approach to state management
 */
@Injectable({
    providedIn: 'root'
})
export class SearchStore {
    private readonly http = inject(HttpClient);

    // Configuration
    private readonly API_BASE = '/api/search';
    private readonly DEBOUNCE_MS = 300;
    private readonly MIN_LENGTH = 2;

    // Private state signals
    private readonly _query = signal('');
    private readonly _results = signal<GlobalSearchResponse | null>(null);
    private readonly _isLoading = signal(false);
    private readonly _error = signal<string | null>(null);
    private readonly _isOpen = signal(false);
    private readonly _selectedIndex = signal(-1);
    private readonly _activeTab = signal<'all' | 'people' | 'chats'>('all');

    // Subjects for async operations
    private readonly searchTrigger$ = new Subject<string>();
    private readonly destroy$ = new Subject<void>();

    // Public readonly signals (encapsulation)
    readonly query = this._query.asReadonly();
    readonly results = this._results.asReadonly();
    readonly isLoading = this._isLoading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly isOpen = this._isOpen.asReadonly();
    readonly selectedIndex = this._selectedIndex.asReadonly();
    readonly activeTab = this._activeTab.asReadonly();

    // Computed signals
    readonly users = computed(() => this._results()?.results?.users ?? []);
    readonly conversations = computed(() => this._results()?.results?.conversations ?? []);
    // readonly combined = computed(() => this._results()?.combined ?? []);
    readonly metadata = computed(() => this._results()?.metadata);

    readonly totalCount = computed(() => this.metadata()?.totalCount ?? 0);
    readonly userCount = computed(() => this.users().length);
    readonly conversationCount = computed(() => this.conversations().length);

    readonly hasResults = computed(() =>
        this.users().length > 0 || this.conversations().length > 0
    );

    readonly hasError = computed(() => this._error() !== null);
    readonly isEmpty = computed(() =>
        !this._isLoading() && !this.hasResults() && this._query().length >= this.MIN_LENGTH
    );

    // Filtered results based on active tab
    readonly filteredResults = computed(() => {
        switch (this._activeTab()) {
            case 'people':
                return this.users();
            case 'chats':
                return this.conversations();
            default:
                return [...this.users(), ...this.conversations()];
        }
    });

    // Navigation helpers
    readonly allItems = computed(() => [...this.users(), ...this.conversations()]);
    readonly maxIndex = computed(() => this.allItems().length - 1);
    readonly selectedItem = computed(() => {
        const idx = this._selectedIndex();
        return idx >= 0 ? this.allItems()[idx] : null;
    });

    // Debug info
    readonly executionTimeMs = computed(() => this.metadata()?.executionTimeMs);
    readonly fromCache = computed(() => this.metadata()?.fromCache ?? false);

    constructor() {
        this.setupSearchPipeline();

        // Effect to log state changes (development only)
        if (typeof window !== 'undefined' && (window as any).ngDevMode) {
            effect(() => {
                console.debug('[SearchStore]', {
                    query: this._query(),
                    resultsCount: this.totalCount(),
                    isLoading: this._isLoading(),
                    error: this._error()
                });
            });
        }
    }

    /**
     * Setup the debounced search pipeline
     */
    private setupSearchPipeline(): void {
        this.searchTrigger$.pipe(
            debounceTime(this.DEBOUNCE_MS),
            distinctUntilChanged(),
            tap(query => {
                this._query.set(query);
                if (query.length >= this.MIN_LENGTH) {
                    this._isLoading.set(true);
                    this._error.set(null);
                } else {
                    this._results.set(null);
                    this._isLoading.set(false);
                }
            }),
            filter(query => query.length >= this.MIN_LENGTH),
            switchMap(query => this.executeSearch(query)),
            takeUntil(this.destroy$)
        ).subscribe();
    }

    /**
     * Execute the actual search API call
     */
    private executeSearch(query: string): Observable<GlobalSearchResponse | null> {
        const params = new HttpParams().set('q', query.trim());

        return this.http.get<GlobalSearchResponse>(`${this.API_BASE}/typeahead`, { params }).pipe(
            tap(response => {
                this._results.set(response);
                this._isLoading.set(false);
                this._error.set(response.error?.message ?? null);
                this._selectedIndex.set(-1);
            }),
            catchError(error => {
                this._isLoading.set(false);
                this._error.set(this.extractErrorMessage(error));
                this._results.set(null);
                return of(null);
            })
        );
    }

    // ==================== Actions ====================

    /**
     * Trigger a search (debounced)
     */
    search(query: string): void {
        this.searchTrigger$.next(query);
    }

    /**
     * Execute immediate full search
     */
    fullSearch(page = 0, limit = 20): Observable<GlobalSearchResponse> {
        const query = this._query();
        if (query.length < this.MIN_LENGTH) {
            return of({ results: undefined, combined: [], metadata: undefined });
        }

        this._isLoading.set(true);

        const params = new HttpParams()
            .set('q', query.trim())
            .set('page', page.toString())
            .set('limit', limit.toString());

        return this.http.get<GlobalSearchResponse>(`${this.API_BASE}/global`, { params }).pipe(
            tap(response => {
                this._results.set(response);
                this._isLoading.set(false);
            }),
            catchError(error => {
                this._isLoading.set(false);
                this._error.set(this.extractErrorMessage(error));
                throw error;
            })
        );
    }

    /**
     * Clear all search state
     */
    clear(): void {
        this._query.set('');
        this._results.set(null);
        this._error.set(null);
        this._isLoading.set(false);
        this._selectedIndex.set(-1);
        this._isOpen.set(false);
    }

    /**
     * Set dropdown open state
     */
    setOpen(isOpen: boolean): void {
        this._isOpen.set(isOpen);
    }

    /**
     * Toggle dropdown
     */
    toggleOpen(): void {
        this._isOpen.update(v => !v);
    }

    /**
     * Set active tab
     */
    setActiveTab(tab: 'all' | 'people' | 'chats'): void {
        this._activeTab.set(tab);
        this._selectedIndex.set(-1);
    }

    /**
     * Select next item
     */
    selectNext(): void {
        this._selectedIndex.update(idx => Math.min(idx + 1, this.maxIndex()));
    }

    /**
     * Select previous item
     */
    selectPrevious(): void {
        this._selectedIndex.update(idx => Math.max(idx - 1, -1));
    }

    /**
     * Set selected index
     */
    setSelectedIndex(index: number): void {
        this._selectedIndex.set(index);
    }

    /**
     * Reset selection
     */
    resetSelection(): void {
        this._selectedIndex.set(-1);
    }

    /**
     * Retry last search
     */
    retry(): void {
        const query = this._query();
        if (query.length >= this.MIN_LENGTH) {
            this._error.set(null);
            this.searchTrigger$.next(query);
        }
    }

    /**
     * Cleanup
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Extract error message from HTTP error
     */
    private extractErrorMessage(error: any): string {
        if (error?.error?.error?.message) return error.error.error.message;
        if (error?.error?.message) return error.error.message;
        if (error?.message) return error.message;
        if (error?.status === 0) return 'Network error. Please check your connection.';
        if (error?.status === 429) return 'Too many requests. Please slow down.';
        if (error?.status === 504) return 'Search timed out. Please try again.';
        return 'Search failed. Please try again.';
    }
}


// ============================================================
// Usage in a component
// ============================================================

/*
import { Component, inject } from '@angular/core';
import { SearchStore } from './search.store';

@Component({
  selector: 'app-search-bar',
  template: `
    <input 
      [value]="store.query()" 
      (input)="store.search($event.target.value)"
    />
    
    @if (store.isLoading()) {
      <span>Loading...</span>
    }
    
    @if (store.hasResults()) {
      <div class="results">
        @for (user of store.users(); track user.id) {
          <div>{{ user.title }}</div>
        }
      </div>
    }
  `
})
export class SearchBarComponent {
  readonly store = inject(SearchStore);
}
*/