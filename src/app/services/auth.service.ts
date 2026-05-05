import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { OneSignalService } from './onesignal.service';

export interface LoginRequest {
  rick: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    driver: Driver;
  };
  errors?: string;
  timestamp: string;
}

export interface Driver {
  id: number;
  rick: string;
  category: string;
  name: string;
  mobile: string;
  eid_no: string;
  visa_expiry: string;
  passport_no: string;
  passport_expiry: string;
  daman_expiry: string;
  driving_licence_expiry: string;
  trafic_code: string;
  driver_permit_num: string;
  limo_permit_expiry: string;
  created_at: string;
  updated_at: string;
  status: string;
  driving_licence_no: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<Driver | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private rickKey = 'user_rick';
  private passwordKey = 'user_password';
  private userKey = 'current_user';
  private driverIdKey = 'driver_id';

  constructor(
    private http: HttpClient,
    private oneSignalService: OneSignalService
  ) {
    // Re-authenticate user on app start if credentials exist
    this.initializeAuth();
  }

  /**
   * Login user
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/app/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.data?.driver) {
            this.handleAuthResponse(response, credentials);
          } else {
            // Handle API-level errors (success: false)
            const errorMessage = response.errors || response.message || 'Login failed';
            throw new Error(errorMessage);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get current driver (synchronous)
   */
  getCurrentUserValue(): Driver | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getStoredRick() && !!this.getStoredPassword();
  }

  /**
   * Get stored rick
   */
  getStoredRick(): string | null {
    return localStorage.getItem(this.rickKey);
  }

  /**
   * Get stored password
   */
  getStoredPassword(): string | null {
    return localStorage.getItem(this.passwordKey);
  }

  /**
   * Get stored driver ID
   */
  getStoredDriverId(): number | null {
    const driverIdStr = localStorage.getItem(this.driverIdKey);
    if (driverIdStr) {
      const driverId = parseInt(driverIdStr, 10);
      return isNaN(driverId) ? null : driverId;
    }
    return null;
  }

  /**
   * Logout user - clears all stored credentials and user data
   */
  logout(): void {
    this.clearAuthData();
  }

  /**
   * Handle authentication response
   */
  private handleAuthResponse(response: AuthResponse, credentials: LoginRequest): void {
    // Save credentials for session maintenance
    localStorage.setItem(this.rickKey, credentials.rick);
    localStorage.setItem(this.passwordKey, credentials.password);

    // Save driver data
    if (response.data?.driver) {
      this.currentUserSubject.next(response.data.driver);
      this.saveUserToStorage(response.data.driver);
      // Save driver ID to localStorage
      if (response.data.driver.id) {
        localStorage.setItem(this.driverIdKey, response.data.driver.id.toString());
      }

      // Send OneSignal Player ID to backend after successful login
      if (response.data?.driver?.id) {
        const driverId = response.data.driver.id;
        this.oneSignalService.getPushId().then((pushId: string | null) => {
          if (pushId) {
            this.oneSignalService.sendPushIdToBackend(driverId, pushId);
          }
        });
      }
    }
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.rickKey);
    localStorage.removeItem(this.passwordKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.driverIdKey);
    this.currentUserSubject.next(null);
  }

  /**
   * Initialize authentication on app start
   */
  private initializeAuth(): void {
    const rick = this.getStoredRick();
    const password = this.getStoredPassword();

    if (rick && password) {
      // Re-authenticate user with stored credentials
      this.login({ rick, password }).subscribe({
        next: () => {
          console.log('User session restored');
        },
        error: (error) => {
          console.error('Failed to restore session:', error);
          // Clear invalid credentials
          this.clearAuthData();
        }
      });
    } else {
      // Load user from storage if credentials don't exist
      this.loadUserFromStorage();
    }
  }

  /**
   * Save driver to storage
   */
  private saveUserToStorage(driver: Driver): void {
    try {
      localStorage.setItem(this.userKey, JSON.stringify(driver));
    } catch (error) {
      console.error('Error saving driver to storage:', error);
    }
  }

  /**
   * Load driver from storage
   */
  private loadUserFromStorage(): void {
    try {
      const userStr = localStorage.getItem(this.userKey);
      if (userStr) {
        const driver: Driver = JSON.parse(userStr);
        this.currentUserSubject.next(driver);
      }
    } catch (error) {
      console.error('Error loading driver from storage:', error);
    }
  }

  /**
   * Handle HTTP errors - avoid showing raw technical errors (e.g. "Http failure response... 0 Unknown Error") on UI
   */
  private handleError = (error: HttpErrorResponse | Error): Observable<never> => {
    let errorMessage = 'Login failed. Please try again.';
    
    if (error instanceof Error) {
      // Error thrown from tap operator (API-level error with success: false)
      const msg = error.message;
      if (!this.isRawHttpError(msg)) {
        errorMessage = msg;
      }
    } else if (error.error instanceof ErrorEvent) {
      // Client-side error - don't expose raw message
      errorMessage = 'Login failed. Please check your connection and try again.';
    } else {
      // Server-side HTTP error
      if (error.status === 0) {
        // Network/CORS/connection failure - never show raw error on UI
        errorMessage = 'Unable to connect. Please check your connection and try again.';
      } else {
        const apiError = error.error as AuthResponse;
        if (apiError && typeof apiError === 'object' && (apiError.message || apiError.errors)) {
          const msg = apiError.errors || apiError.message || '';
          if (!this.isRawHttpError(msg)) {
            errorMessage = msg;
          }
        }
      }
    }
    
    console.error('API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };

  /** Detect raw HTTP error messages that should not be shown to users */
  private isRawHttpError(message: string): boolean {
    return !message || 
      message.includes('Http failure response') || 
      message.includes('Unknown Error') ||
      message.startsWith('Error Code:');
  }
}
