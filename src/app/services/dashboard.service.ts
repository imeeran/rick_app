import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Ride {
  id: string;
  date: Date | string; // Can be Date object or ISO string from API
  status: 'completed' | 'cancelled';
  amount: number;
}

export interface DashboardData {
  currentMonthCompletedRides: number;
  currentMonthCancelledRides: number;
  currentMonthAssignedOrders: number;
  todayAssignedOrders: number;
  ridesData: Ride[];
}

export interface DashboardApiResponse {
  success?: boolean;
  message?: string;
  data?: DashboardData;
  currentMonthCompletedRides?: number;
  currentMonthCancelledRides?: number;
  currentMonthAssignedOrders?: number;
  todayAssignedOrders?: number;
  ridesData?: Ride[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getDashboardData(): Observable<DashboardData> {
    // Get rick ID from auth service
    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();

    if (!rick) {
      return throwError(() => new Error('Rick ID not found. Please login again.'));
    }

    // Prepare request body
    const requestBody = { rick };

    // Make API call
    return this.http.post<DashboardApiResponse>(`${this.apiUrl}/app/dashboard`, requestBody)
      .pipe(
        map(response => {
          // Handle both wrapped and direct response formats
          let dashboardData: DashboardData;

          if (response.data) {
            // Wrapped response format: { success: true, data: {...} }
            dashboardData = response.data;
          } else if (response.currentMonthCompletedRides !== undefined) {
            // Direct response format: { currentMonthCompletedRides: ..., ... }
            dashboardData = {
              currentMonthCompletedRides: response.currentMonthCompletedRides || 0,
              currentMonthCancelledRides: response.currentMonthCancelledRides || 0,
              currentMonthAssignedOrders: response.currentMonthAssignedOrders || 0,
              todayAssignedOrders: response.todayAssignedOrders || 0,
              ridesData: response.ridesData || []
            };
          } else {
            throw new Error('Invalid response format from dashboard API');
          }

          // Ensure all required fields are present and transform date strings to Date objects
          return {
            currentMonthCompletedRides: dashboardData.currentMonthCompletedRides || 0,
            currentMonthCancelledRides: dashboardData.currentMonthCancelledRides || 0,
            currentMonthAssignedOrders: dashboardData.currentMonthAssignedOrders || 0,
            todayAssignedOrders: dashboardData.todayAssignedOrders || 0,
            ridesData: (dashboardData.ridesData || []).map(ride => ({
              ...ride,
              date: typeof ride.date === 'string' ? new Date(ride.date) : ride.date
            }))
          };
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse | Error): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    
    if (error instanceof Error) {
      // Error thrown from map operator
      errorMessage = error.message;
    } else if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side HTTP error
      const apiError = error.error as DashboardApiResponse;
      if (apiError && typeof apiError === 'object' && 'message' in apiError) {
        errorMessage = apiError.message || error.message;
      } else {
        errorMessage = error.error?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('Dashboard API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };
}
