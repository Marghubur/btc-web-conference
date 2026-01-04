import { Injectable, inject, signal, computed } from '@angular/core';
import { MonitorResponse } from '../../models/monitor.model';
import { ResponseModel } from '../../models/model';
import { HttpService } from './http.service';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class MonitorService {
    private http = inject(HttpService);
    private readonly baseUrl = environment.messageBaseUrl;

    // Signal-based state
    private _monitorData = signal<MonitorResponse | null>(null);
    private _isLoading = signal<boolean>(false);
    private _error = signal<string | null>(null);
    private _lastUpdated = signal<Date | null>(null);

    // Auto-refresh interval (in milliseconds)
    private refreshInterval: any = null;
    private readonly DEFAULT_REFRESH_INTERVAL = 10000; // 10 seconds

    // Public readonly signals
    readonly monitorData = this._monitorData.asReadonly();
    readonly isLoading = this._isLoading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly lastUpdated = this._lastUpdated.asReadonly();

    // Computed signals for easy access
    readonly status = computed(() => this._monitorData()?.status ?? 'unknown');
    readonly connections = computed(() => this._monitorData()?.connections ?? null);
    readonly rooms = computed(() => this._monitorData()?.rooms ?? null);
    readonly calls = computed(() => this._monitorData()?.calls ?? null);
    readonly clients = computed(() => this._monitorData()?.clients ?? []);
    readonly roomParticipantsStats = computed(() => this._monitorData()?.roomParticipantsStats ?? []);
    readonly statusCount = computed(() => this._monitorData()?.statusCount ?? {});

    /**
     * Fetch monitor data from API
     */
    async fetchMonitorData(): Promise<void> {
        this._isLoading.set(true);
        this._error.set(null);

        try {
            const response: ResponseModel = await this.http.get('monitor/stats', { baseUrl: this.baseUrl });

            if (response.IsSuccess && response.ResponseBody) {
                this._monitorData.set(response.ResponseBody as MonitorResponse);
                this._lastUpdated.set(new Date());
            } else {
                this._error.set(response.Message || 'Failed to fetch monitor data');
            }
        } catch (err: any) {
            this._error.set(err?.message || 'Network error occurred');
        } finally {
            this._isLoading.set(false);
        }
    }

    /**
     * Start auto-refresh polling
     */
    startAutoRefresh(intervalMs: number = this.DEFAULT_REFRESH_INTERVAL): void {
        this.stopAutoRefresh();

        // Initial fetch
        this.fetchMonitorData();

        // Set up interval
        this.refreshInterval = setInterval(() => {
            this.fetchMonitorData();
        }, intervalMs);
    }

    /**
     * Stop auto-refresh polling
     */
    stopAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Clear all data and reset state
     */
    reset(): void {
        this.stopAutoRefresh();
        this._monitorData.set(null);
        this._isLoading.set(false);
        this._error.set(null);
        this._lastUpdated.set(null);
    }
}
