import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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

  /**
   * Clear all downloaded payslip files from the filesystem
   * This should be called when a user logs out to prevent files from previous users
   * from being shown to new users
   */
  async clearDownloadedPayslips(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // On web platform, there's no filesystem to clear
      return;
    }

    try {
      const folder = 'payslips';
      const dir = Directory.Documents;

      // Try to read the directory to get all files
      try {
        const result = await Filesystem.readdir({ path: folder, directory: dir });
        const files = (result.files ?? []).map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean) as string[];

        // Delete all PDF files in the payslips folder
        for (const file of files) {
          if (file.toLowerCase().endsWith('.pdf')) {
            try {
              await Filesystem.deleteFile({
                path: `${folder}/${file}`,
                directory: dir,
              });
            } catch (deleteError) {
              console.warn(`Failed to delete payslip file ${file}:`, deleteError);
              // Continue deleting other files even if one fails
            }
          }
        }

        // Try to remove the empty folder (optional, may fail if not empty or on some platforms)
        try {
          await Filesystem.rmdir({
            path: folder,
            directory: dir,
            recursive: false,
          });
        } catch {
          // Ignore errors when removing folder - it's okay if it doesn't exist or can't be removed
        }
      } catch (readError) {
        // Folder doesn't exist or can't be read - that's fine, nothing to clear
        console.log('Payslips folder does not exist or cannot be read:', readError);
      }
    } catch (error) {
      console.error('Error clearing downloaded payslips:', error);
      // Don't throw - we don't want logout to fail if file clearing fails
    }
  }
}

