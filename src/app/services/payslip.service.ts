import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PayslipTransaction {
  type: 'CR' | 'DR';
  field: string;
  amount: number;
}

export interface Payslip {
  id?: string | number;
  month_name?: string;
  year?: string | number;
  obopm?: string | number; // Opening balance
  created_at?: string;
  updated_at?: string;
  rick?: string;
  plate?: string | number;
  mobile_no?: string;
  driver_name?: string;
  payslip_array?: PayslipTransaction[];
  // Legacy fields for backward compatibility
  month?: string;
  gross?: string | number;
  net?: string;
  deductions?: string;
  basicSalary?: string;
  allowances?: string;
  period?: string;
  driverName?: string;
  mobileNo?: string;
  rickNo?: string;
  plateNo?: string;
  transactions?: any[];
  totalDebit?: number;
  totalCredit?: number;
  closingBalance?: number;
  closingDrCr?: 'DR' | 'CR';
  [key: string]: any; // Allow additional properties from backend
}

export interface PayslipApiResponse {
  success?: boolean;
  message?: string;
  data?: Payslip[];
  payslips?: Payslip[];
}

@Injectable({
  providedIn: 'root'
})
export class PayslipService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getPayslips(): Observable<Payslip[]> {
    // Get rick ID from auth service
    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();

    if (!rick) {
      return throwError(() => new Error('Rick ID not found. Please login again.'));
    }

    // Prepare request body
    const requestBody = { rick };

    // Make API call
    return this.http.post<PayslipApiResponse>(`${this.apiUrl}/app/payslips`, requestBody)
      .pipe(
        map(response => {
          // Handle both wrapped and direct response formats
          let payslips: Payslip[] = [];

          if (response.data && Array.isArray(response.data)) {
            // Wrapped response format: { success: true, data: [...] }
            payslips = response.data;
          } else if (response.payslips && Array.isArray(response.payslips)) {
            // Alternative wrapped format: { payslips: [...] }
            payslips = response.payslips;
          } else if (Array.isArray(response)) {
            // Direct array response: [...]
            payslips = response;
          } else {
            // Empty array if no valid data found
            payslips = [];
          }

          return payslips;
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
      const apiError = error.error as PayslipApiResponse;
      if (apiError && typeof apiError === 'object' && 'message' in apiError) {
        errorMessage = apiError.message || error.message;
      } else {
        errorMessage = error.error?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('Payslip API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };
}

