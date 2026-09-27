import { Injectable } from '@angular/core';
import { BaseCallService } from './base-call.service';
import { CallEvents } from '../../../../models/conference_call/call_model';

@Injectable({
    providedIn: 'root'
})
export class TestSignalService extends BaseCallService {
    execute(): void {
        this.ws.sendEvent(CallEvents.CALL_TEST_SIGNAL, {});
    }
}
