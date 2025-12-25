export interface ResponseModel {
  AccessToken: string;
  HttpStatusCode: number;
  HttpStatusMessage: string;
  ResponseBody: any;
  ErrorCode: string;
  ErrorMessage: string;
  IsSuccess: boolean;
  Message: string;
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
  startTime?: string;
  endTime?: string;
  organizerName?: string;
  hasQuickMeeting?: boolean;
}


export interface User {
  isMicOn: boolean;
  isCameraOn: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  userId?: string;
  token?: string;
  isLogin?: boolean;
  status?: 'online' | 'away' | 'busy' | 'offline';
}