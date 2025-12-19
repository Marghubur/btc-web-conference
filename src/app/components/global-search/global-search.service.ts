// global-search.service.ts

import { Injectable, inject, signal, computed, effect } from '@angular/core';
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
    private readonly MIN_LENGTH_FOR_COMPLETE_SEARCH = 4;
    private readonly TYPEAHEAD_LIMIT = 8;
    private readonly DEFAULT_PAGE_SIZE = 20;

    // Signals for state
    readonly query = signal('');
    readonly results = signal<GlobalSearchResponse | null>(null);
    readonly isLoading = signal(false);
    readonly error = signal<string | null>(null);
    readonly isOpen = signal(false);

    // Derived state for convenience (optional, useful if components expect a state object)
    readonly state = computed<SearchState>(() => ({
        query: this.query(),
        results: this.results(),
        isLoading: this.isLoading(),
        error: this.error(),
        isOpen: this.isOpen()
    }));

    constructor() {
        // Effect to handle search logic with debouncing
        effect((onCleanup) => {
            const query = this.query();

            // Clear results if query is too short
            if (query.length < this.MIN_SEARCH_LENGTH) {
                // We typically shouldn't write to signals in effects without care,
                // but this sets derived state from the source of truth (query).
                // Need to use untracked if we want to avoid re-triggering (though these don't trigger this effect).
                this.results.set(null);
                this.error.set(null);
                this.isLoading.set(false);
                return;
            }

            // Set loading state immediately (debouncing happens for the actual call, but UI might want to show typing?)
            // Actually, typically we wait for debounce to show loading.
            // Let's stick to standard debounce pattern: don't do anything until debounce timer hits.

            const timeoutId = setTimeout(async () => {
                await this.performTypeaheadSearch(query);
            }, this.DEBOUNCE_TIME);

            onCleanup(() => {
                clearTimeout(timeoutId);
            });
        }, { allowSignalWrites: true });
    }

    /**
     * Update the search query
     */
    search(query: string): void {
        this.query.set(query);
    }

    /**
     * Cancel ongoing search (for external cancellation)
     */
    cancelSearch(): void {
        this.isLoading.set(false);
    }

    /**
     * Clear search results and query
     */
    clearSearch(): void {
        this.query.set('');
        this.results.set(null);
        this.error.set(null);
        this.isOpen.set(false);
        this.isLoading.set(false);
    }

    /**
     * Toggle search dropdown visibility
     */
    setSearchOpen(isOpen: boolean): void {
        this.isOpen.set(isOpen);
    }

    /**
     * Perform the actual typeahead API call
     */
    private async performTypeaheadSearch(query: string): Promise<void> {
        // Double check query length (in case called directly)
        if (query.length < this.MIN_SEARCH_LENGTH) {
            this.results.set(null);
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);

        try {
            const fs = query.length >= this.MIN_LENGTH_FOR_COMPLETE_SEARCH ? 'y' : 'n';
            const url = `search/typeahead?q=${encodeURIComponent(query.trim())}&fs=${fs}&limit=${this.TYPEAHEAD_LIMIT}`;

            // Assuming AjaxService returns a Promise. 
            // If it supports cancellation, we would pass a signal here, but basic Promise doesn't.
            // We handle "cancellation" via the effect cleanup: 
            // - The timeout is cleared if query changes.
            // - If the request already started, we check if the query is still the same before setting results.

            const response = await this.http.get(url);

            // Check if this result is still relevant
            if (this.query() === query) {
                const results = this.transformResponse(response);
                this.results.set(results);
                this.isLoading.set(false);
            }
        } catch (err) {
            if (this.query() === query) {
                this.error.set(this.extractErrorMessage(err));
                this.results.set(null);
                this.isLoading.set(false);
            }
        }
    }

    /**
     * Full search with pagination
     */
    async fullSearch(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Promise<GlobalSearchResponse> {
        if (query.length < this.MIN_SEARCH_LENGTH) {
            return { results: undefined, metadata: undefined };
        }

        this.isLoading.set(true);
        this.error.set(null);

        try {
            const url = `search/global?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;
            const response = await this.http.get(url);
            const results = this.transformResponse(response);

            // We might or might not want to update the main 'results' state for a full search.
            // Usually full search navigates to a new page or updates a different view.
            // But the legacy service updated the state.
            this.results.set(results);
            this.isLoading.set(false);
            return results;
        } catch (err) {
            this.error.set(this.extractErrorMessage(err));
            this.isLoading.set(false);
            throw err;
        }
    }

    /**
     * Search only users
     */
    async searchUsers(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Promise<GlobalSearchResponse> {
        const url = `search/users?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;
        const response = await this.http.get(url);
        return this.transformResponse(response);
    }

    /**
     * Search only conversations
     */
    async searchConversations(query: string, page = 0, limit = this.DEFAULT_PAGE_SIZE): Promise<GlobalSearchResponse> {
        const url = `search/conversations?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`;
        const response = await this.http.get(url);
        return this.transformResponse(response);
    }

    /**
     * Health check
     */
    async checkHealth(): Promise<HealthResponse> {
        const response = await this.http.get('search/health');
        return response?.ResponseBody as HealthResponse;
    }

    /**
     * Get metrics
     */
    async getMetrics(): Promise<MetricsResponse> {
        const response = await this.http.get('search/metrics');
        return response?.ResponseBody as MetricsResponse;
    }

    /**
     * Get current state snapshot
     */
    getState(): SearchState {
        return this.state();
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