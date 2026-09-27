import { inject, Injectable } from '@angular/core';
import { ConfeetSocketService } from '../../confeet-socket.service';
import { CallStore } from '../../../../store/call/call.store';
import { LocalService } from '../../../services/local.service';
import { User } from '../../../../models/model';
import { CallBaseModel } from '../../../../models/conference_call/call_model';

@Injectable()
export abstract class BaseCallService {
    protected readonly ws = inject(ConfeetSocketService);
    protected readonly callStore = inject(CallStore);
    protected readonly local = inject(LocalService);

    /**
     * Gets current user from local storage
     */
    protected getCurrentUser(): User | null {
        return this.local.getUser();
    }

    /**
     * Extracts caller/user details mapped to CallBaseModel
     */
    protected getCallerInfo(): Partial<CallBaseModel> {
        const user = this.getCurrentUser();
        const firstName = user?.firstName || '';
        const lastName = user?.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();

        return {
            callerId: user?.userId || '',
            callerName: fullName || user?.email || 'Unknown',
            callerEmail: user?.email || '',
            avatarUrl: (user as any)?.avatar || (user as any)?.avatarUrl || ''
        };
    }

    /**
     * Creates a typed call payload populated with current user caller details
     */
    protected createPayload<T extends CallBaseModel>(conversationId: string, extraData?: Partial<T>): T {
        return {
            conversationId,
            ...this.getCallerInfo(),
            ...extraData
        } as T;
    }
}
