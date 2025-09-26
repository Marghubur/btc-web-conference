export interface ResponseModel {
  AuthenticationToken: string;
  HttpStatusCode: number;
  HttpStatusMessage: string;
  ResponseBody: any;
}

export interface MeetingDetail {
  meetingDetailId?: number;
  meetingId: string;
  meetingPassword: string;
  organizedBy?: number; 
  agenda?: string;
  title?: string;
  startDate?: Date;
  durationInSecond?: number;
  endDate?: Date;
  startTime? : string;
  endTime?: string;
  organizerName?: string;
  hasQuickMeeting? : boolean;
}


export interface User {
    isMicOn: boolean;
    isCameraOn: boolean;
    firstName?: string;
    lastName?: string;
    email?: string;
    userId?: number;
    token?: string;
    isLogin?: boolean;
    passCode?: string;
}