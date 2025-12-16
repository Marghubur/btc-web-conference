// global-search.service.ts

import { Injectable, inject } from '@angular/core';
import {
    Observable,
    Subject,
    BehaviorSubject,
    of,
    throwError,
    timer,
    from
} from 'rxjs';
import {
    debounceTime,
    distinctUntilChanged,
    switchMap,
    catchError,
    tap,
    takeUntil,
    retry,
    shareReplay,
    map,
    finalize
} from 'rxjs/operators';
import {
    GlobalSearchResponse,
    SearchState,
    HealthResponse,
    MetricsResponse
} from './search.models';
import { AjaxService } from '../../providers/services/ajax.service';

@Injectable({
    providedIn: 'root'
})
export class GlobalSearchService {
    private readonly http = inject(AjaxService);

    // Configuration
    private readonly DEBOUNCE_TIME = 300; // ms
    private readonly MIN_SEARCH_LENGTH = 2;
    private readonly TYPEAHEAD_LIMIT = 5;
    private readonly DEFAULT_PAGE_SIZE = 20;

    // Subjects for search
    private readonly searchSubject = new Subject<string>();
    private readonly cancelSubject = new Subject<void>();

    // State management
    private readonly stateSubject = new BehaviorSubject<SearchState>({
        query: '',
        results: null,
        isLoading: false,
        error: null,
        isOpen: false
    });

    // Public state observable
    public readonly state$ = this.stateSubject.asObservable();

    // Typeahead results stream with debouncing
    public readonly typeaheadResults$: Observable<GlobalSearchResponse | null>;

    constructor() {
        // Set up the debounced typeahead stream
        this.typeaheadResults$ = this.searchSubject.pipe(
            // Debounce to avoid too many API calls
            debounceTime(this.DEBOUNCE_TIME),

            // Only search if query changed
            distinctUntilChanged(),

            // Update state with new query
            tap(query => this.updateState({ query, isLoading: query.length >= this.MIN_SEARCH_LENGTH })),

            // Switch to new search, cancelling previous
            switchMap(query => {
                // Don't search if query is too short
                if (query.length < this.MIN_SEARCH_LENGTH) {
                    this.updateState({ results: null, isLoading: false, error: null });
                    return of(null);
                }

                return this.typeahead(query).pipe(
                    // Cancel if new search comes in
                    takeUntil(this.cancelSubject),

                    // Handle errors gracefully
                    catchError(error => {
                        this.updateState({
                            error: this.extractErrorMessage(error),
                            isLoading: false
                        });
                        return of(null);
                    }),

                    // Update state with results
                    tap(results => {
                        if (results) {
                            this.updateState({ results, isLoading: false, error: null });
                        }
                    })
                );
            }),

            // Share the result among subscribers
            shareReplay(1)
        );

        // Subscribe to keep the stream active
        this.typeaheadResults$.subscribe();
    }

    /**
     * Trigger a typeahead search (debounced)
     */
    search(query: string): void {
        this.searchSubject.next(query);
    }

    /**
     * Cancel ongoing search
     */
    cancelSearch(): void {
        this.cancelSubject.next();
        this.updateState({ isLoading: false });
    }

    /**
     * Clear search results and query
     */
    clearSearch(): void {
        this.cancelSearch();
        this.updateState({
            query: '',
            results: null,
            error: null,
            isOpen: false
        });
    }

    /**
     * Toggle search dropdown visibility
     */
    setSearchOpen(isOpen: boolean): void {
        this.updateState({ isOpen });
    }

    /**
     * Typeahead API call (fast, limited results)
     * Converts AjaxService Promise to Observable for reactive stream compatibility
     */
    typeahead(query: string): Observable<GlobalSearchResponse> {
        const url = `search/typeahead?q=${encodeURIComponent(query.trim())}&fs=n&limit=${this.TYPEAHEAD_LIMIT}`;

        return from(this.http.get(url)).pipe(
            map(response => this.transformResponse(response)),
            retry({
                count: 2,
                delay: (error, retryCount) => {
                    // Only retry on network errors or 5xx
                    if (error?.status >= 500 || error?.status === 0) {
                        return timer(retryCount * 100); // Exponential backoff
                    }
                    return throwError(() => error);
                }
            })
        );
    }

    /**
     * Full search with pagination
     */
    fullSearch(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Observable<GlobalSearchResponse> {
        if (query.length < this.MIN_SEARCH_LENGTH) {
            return of({ results: undefined, combined: [], metadata: undefined });
        }

        this.updateState({ isLoading: true, error: null });

        const url = `search/global?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;

        return from(this.http.get(url)).pipe(
            map(response => this.transformResponse(response)),
            tap(results => this.updateState({ results, isLoading: false })),
            catchError(error => {
                this.updateState({ error: this.extractErrorMessage(error), isLoading: false });
                return throwError(() => error);
            }),
            finalize(() => this.updateState({ isLoading: false }))
        );
    }

    /**
     * Search only users
     */
    searchUsers(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Observable<GlobalSearchResponse> {
        const url = `search/users?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;

        return from(this.http.get(url)).pipe(
            map(response => this.transformResponse(response))
        );
    }

    /**
     * Search only conversations
     */
    searchConversations(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Observable<GlobalSearchResponse> {
        const url = `search/conversations?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;

        return from(this.http.get(url)).pipe(
            map(response => this.transformResponse(response))
        );
    }

    /**
     * Health check
     */
    checkHealth(): Observable<HealthResponse> {
        return from(this.http.get('search/health')).pipe(
            map(response => response?.ResponseBody as HealthResponse)
        );
    }

    /**
     * Get metrics
     */
    getMetrics(): Observable<MetricsResponse> {
        return from(this.http.get('search/metrics')).pipe(
            map(response => response?.ResponseBody as MetricsResponse)
        );
    }

    /**
     * Get current state snapshot
     */
    getState(): SearchState {
        return this.stateSubject.getValue();
    }

    /**
     * Transform ResponseModel to GlobalSearchResponse
     */
    private transformResponse(response: any): GlobalSearchResponse {
        // AjaxService returns ResponseModel with ResponseBody
        // Also handle if the actual data is nested inside 'data' or 'result' property
        const body = response?.ResponseBody || response;
        const data = body?.data || body?.result || body;
        return data as GlobalSearchResponse;
    }

    /**
     * Update state
     */
    private updateState(partialState: Partial<SearchState>): void {
        this.stateSubject.next({
            ...this.stateSubject.getValue(),
            ...partialState
        });
    }

    /**
     * Extract error message from error
     */
    private extractErrorMessage(error: any): string {
        if (error?.error?.message) {
            return error.error.message;
        }
        if (error?.message) {
            return error.message;
        }
        if (error?.status === 0) {
            return 'Network error. Please check your connection.';
        }
        if (error?.status === 429) {
            return 'Too many requests. Please slow down.';
        }
        if (error?.status === 504) {
            return 'Search timed out. Please try again.';
        }
        return 'Search failed. Please try again.';
    }
}