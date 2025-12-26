import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonitorService } from '../providers/services/monitor.service';
import { ClientInfo, MonitorResponse } from '../models/monitor.model';

@Component({
    selector: 'app-monitor-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './monitor-dashboard.component.html',
    styleUrl: './monitor-dashboard.component.css'
})
export class MonitorDashboardComponent implements OnInit, OnDestroy {
    private monitorService = inject(MonitorService);

    // State signals
    readonly monitorData = this.monitorService.monitorData;
    readonly isLoading = this.monitorService.isLoading;
    readonly error = this.monitorService.error;
    readonly lastUpdated = this.monitorService.lastUpdated;

    // Derived state
    readonly status = this.monitorService.status;
    readonly connections = this.monitorService.connections;
    readonly rooms = this.monitorService.rooms;
    readonly calls = this.monitorService.calls;
    readonly clients = this.monitorService.clients;
    readonly statusCount = this.monitorService.statusCount;

    // Computed signal for status count keys (Object.keys can't be used in templates)
    readonly statusCountKeys = computed(() => Object.keys(this.statusCount()));

    // UI State
    searchQuery = signal<string>('');
    statusFilter = signal<string>('all');
    roomSearch = signal<string>('');
    isAutoRefreshEnabled = signal<boolean>(true);
    isDarkMode = signal<boolean>(false); // Default to light mode

    toggleTheme(): void {
        this.isDarkMode.update(v => !v);
    }

    // Filtered clients
    readonly filteredClients = computed(() => {
        let clients = this.clients();
        const query = this.searchQuery().toLowerCase().trim();
        const status = this.statusFilter();

        // Filter by status
        if (status !== 'all') {
            clients = clients.filter(c => c.status === status);
        }

        // Filter by search query
        if (query) {
            clients = clients.filter(c =>
                c.clientId.toLowerCase().includes(query) ||
                c.userId.toLowerCase().includes(query) ||
                (c.currentConversationId?.toLowerCase().includes(query) ?? false)
            );
        }

        return clients;
    });

    // Filtered rooms
    readonly filteredRooms = computed(() => {
        const roomDetails = this.rooms()?.roomDetails ?? [];
        const query = this.roomSearch().toLowerCase().trim();

        if (!query) return roomDetails;

        return roomDetails.filter(r =>
            r.conversationId.toLowerCase().includes(query)
        );
    });

    // Status badge class
    readonly statusBadgeClass = computed(() => {
        const s = this.status();
        switch (s) {
            case 'healthy': return 'status-healthy';
            case 'degraded': return 'status-degraded';
            case 'unhealthy': return 'status-unhealthy';
            default: return 'status-unknown';
        }
    });

    // Status icon
    readonly statusIcon = computed(() => {
        const s = this.status();
        switch (s) {
            case 'healthy': return 'fa-circle-check';
            case 'degraded': return 'fa-triangle-exclamation';
            case 'unhealthy': return 'fa-circle-xmark';
            default: return 'fa-circle-question';
        }
    });

    ngOnInit(): void {
        this.monitorService.startAutoRefresh();
    }

    ngOnDestroy(): void {
        this.monitorService.stopAutoRefresh();
    }

    onSearchChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.searchQuery.set(input.value);
    }

    onStatusFilterChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.statusFilter.set(select.value);
    }

    onRoomSearchChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.roomSearch.set(input.value);
    }

    toggleAutoRefresh(): void {
        const enabled = !this.isAutoRefreshEnabled();
        this.isAutoRefreshEnabled.set(enabled);

        if (enabled) {
            this.monitorService.startAutoRefresh();
        } else {
            this.monitorService.stopAutoRefresh();
        }
    }

    refreshNow(): void {
        this.monitorService.fetchMonitorData();
    }

    getCallDuration(startedAt: string): string {
        const start = new Date(startedAt);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
    }

    getStatusLabel(status: number): string {
        const statusMap: { [key: number]: string } = {
            0: 'Initiating',
            1: 'Ringing',
            2: 'Connected',
            3: 'On Hold',
            4: 'Ended'
        };
        return statusMap[status] ?? 'Unknown';
    }

    trackByClientId(index: number, client: ClientInfo): string {
        return client.clientId;
    }

    trackByConversationId(index: number, item: { conversationId: string }): string {
        return item.conversationId;
    }
}
