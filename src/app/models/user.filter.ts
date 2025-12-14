export interface UserFilter {
    currentPage: number;
    data: any[];
    hasNext: boolean;
    hasPrevious: boolean;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
}