import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
    HttpParams
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry, timeout as rxTimeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { JwtService } from './jwt.service';
import { ResponseModel } from '../../models/model';

export interface RequestOptions {
    headers?: HttpHeaders | { [header: string]: string | string[] };
    params?: HttpParams | { [param: string]: string | string[] };
    reportProgress?: boolean;
    withCredentials?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
}

@Injectable({
    providedIn: 'root'
})
export class HttpService {
    private readonly DEFAULT_TIMEOUT = 30000;
    private readonly MAX_RETRIES = 1;
    private http = inject(HttpClient);
    private jwtService = inject(JwtService);
    private baseUrl = environment.appServerBaseUrl || '';

    constructor() { }

    /**
     * Login Request - Handles Authentication Storage
     */
    async login<T = any>(url: string, body: any, options?: RequestOptions): Promise<ResponseModel> {
        const response = await this.post<T>(url, body, options);
        if (response.IsSuccess && response.ResponseBody) {
            this.jwtService.setLoginDetail(response.ResponseBody);
        }
        return response;
    }

    /**
     * GET Request
     */
    async get<T = any>(url: string, options?: RequestOptions): Promise<ResponseModel> {
        return this.sendRequest<T>('GET', url, null, options);
    }

    /**
     * POST Request
     */
    async post<T = any>(url: string, body: any, options?: RequestOptions): Promise<ResponseModel> {
        return this.sendRequest<T>('POST', url, body, options);
    }

    /**
     * PUT Request
     */
    async put<T = any>(url: string, body: any, options?: RequestOptions): Promise<ResponseModel> {
        return this.sendRequest<T>('PUT', url, body, options);
    }

    /**
     * DELETE Request
     */
    async delete<T = any>(url: string, options?: RequestOptions): Promise<ResponseModel> {
        return this.sendRequest<T>('DELETE', url, null, options);
    }

    /**
     * PATCH Request
     */
    async patch<T = any>(url: string, body: any, options?: RequestOptions): Promise<ResponseModel> {
        return this.sendRequest<T>('PATCH', url, body, options);
    }

    /**
     * Core request handler - returns validated ResponseModel
     */
    private async sendRequest<T>(
        method: string,
        url: string,
        body?: any,
        options: RequestOptions = {}
    ): Promise<ResponseModel> {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : url}`;

        const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT;
        const maxRetries = options.maxRetries ?? this.MAX_RETRIES;

        const httpOptions: any = {
            body,
            headers: options.headers,
            params: options.params,
            observe: 'body',
            responseType: 'json',
            withCredentials: options.withCredentials
        };

        try {
            const request$ = this.http.request<T>(method, fullUrl, httpOptions).pipe(
                rxTimeout(timeoutMs),
                retry({
                    count: maxRetries,
                    delay: (error, retryCount) => {
                        if (error.status >= 400 && error.status < 500) {
                            throw error;
                        }
                        const delayMs = 500 * Math.pow(2, retryCount);
                        return timer(delayMs);
                    }
                })
            );

            const response = await firstValueFrom(request$) as unknown as ResponseModel;
            response.IsSuccess = response.HttpStatusCode == 200 || response.HttpStatusCode == 201;
            return response;

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Check if response body is empty
     */
    private isEmptyResponse(body: any): boolean {
        if (body === null || body === undefined) {
            return true;
        }

        if (typeof body === 'string' && body.trim() === '') {
            return true;
        }

        if (Array.isArray(body) && body.length === 0) {
            return true;
        }

        if (typeof body === 'object' && Object.keys(body).length === 0) {
            return true;
        }

        return false;
    }

    /**
     * Handle HTTP errors and return ResponseModel
     */
    private handleError(error: any): ResponseModel {
        if (error instanceof HttpErrorResponse) {
            const statusCode = error.status;
            let message = error.message || 'An error occurred';
            let statusMessage = error.statusText || 'Error';

            // Handle common error scenarios
            if (statusCode === 0) {
                message = 'Unable to connect to server. Please check your network connection';
                statusMessage = 'Network Error';
            } else if (statusCode === 400) {
                message = error.error?.message || 'Bad request. Please check your input';
                statusMessage = 'Bad Request';
            } else if (statusCode === 401) {
                message = 'Unauthorized. Please login again';
                statusMessage = 'Unauthorized';
            } else if (statusCode === 403) {
                message = 'Access denied. You do not have permission';
                statusMessage = 'Forbidden';
            } else if (statusCode === 404) {
                message = 'Resource not found';
                statusMessage = 'Not Found';
            } else if (statusCode === 408) {
                message = 'Request timeout. Please try again';
                statusMessage = 'Request Timeout';
            } else if (statusCode === 500) {
                message = 'Internal server error. Please try again later';
                statusMessage = 'Internal Server Error';
            } else if (statusCode === 502) {
                message = 'Bad gateway. Server is temporarily unavailable';
                statusMessage = 'Bad Gateway';
            } else if (statusCode === 503) {
                message = 'Service unavailable. Please try again later';
                statusMessage = 'Service Unavailable';
            } else if (statusCode === 504) {
                message = 'Gateway timeout. Please try again';
                statusMessage = 'Gateway Timeout';
            }

            return this.buildResponse(false, statusCode, statusMessage, error.error, message);
        }

        // Handle timeout error
        if (error?.name === 'TimeoutError') {
            return this.buildResponse(false, 408, 'Request Timeout', null, 'Request timed out. Please try again');
        }

        // Generic error
        return this.buildResponse(false, 0, 'Unknown Error', null, error?.message || 'An unexpected error occurred');
    }

    /**
     * Build ResponseModel object
     */
    private buildResponse(
        isSuccess: boolean,
        httpStatusCode: number,
        httpStatusMessage: string,
        responseBody: any,
        message: string
    ): ResponseModel {
        return {
            AccessToken: '',
            HttpStatusCode: httpStatusCode,
            HttpStatusMessage: httpStatusMessage,
            ResponseBody: responseBody,
            ErrorCode: '',
            ErrorMessage: '',
            IsSuccess: isSuccess,
            Message: message
        };
    }
}
