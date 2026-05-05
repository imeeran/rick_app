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
  data?: DashboardData | Record<string, unknown>;
  result?: Record<string, unknown>;
  currentMonthCompletedRides?: number;
  currentMonthCancelledRides?: number;
  /** Backend may use American spelling (one "l") */
  currentMonthCanceledRides?: number;
  currentMonthAssignedOrders?: number;
  todayAssignedOrders?: number;
  ridesData?: Ride[];
  /** Common API aliases (snake_case) */
  current_month_completed_rides?: number;
  current_month_cancelled_rides?: number;
  current_month_assigned_orders?: number;
  today_assigned_orders?: number;
  rides_data?: unknown[];
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }
  return 0;
}

function mergeFlatDashboardPayload(...parts: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const p of parts) {
    if (p == null) {
      continue;
    }
    if (typeof p === 'object' && !Array.isArray(p)) {
      Object.assign(merged, p as Record<string, unknown>);
    }
  }
  return merged;
}

/** Top-level fields from API wrapper (excludes nested `data` / `result` objects). */
function extractTopLevelPayloadFields(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const skip = new Set(['data', 'result', 'message', 'success', 'errors', 'timestamp']);
  for (const [k, v] of Object.entries(r)) {
    if (skip.has(k)) {
      continue;
    }
    const isPlainObject =
      v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
    if (isPlainObject) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

function normalizeRideEntry(raw: unknown, index: number): Ride | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = String(o['id'] ?? o['ride_id'] ?? o['booking_id'] ?? `ride-${index}`);
  const dateRaw =
    o['date'] ?? o['ride_date'] ?? o['created_at'] ?? o['updated_at'] ?? new Date().toISOString();
  const statusRaw = String(o['status'] ?? '').toLowerCase();
  const status: 'completed' | 'cancelled' =
    statusRaw === 'cancelled' || statusRaw === 'canceled' ? 'cancelled' : 'completed';
  const amount = pickNumber(o, 'amount', 'ride_amount', 'fare', 'total');
  return { id, date: typeof dateRaw === 'string' ? dateRaw : String(dateRaw), status, amount };
}

function normalizeRidesArray(raw: unknown): Ride[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item, i) => normalizeRideEntry(item, i))
    .filter((r): r is Ride => r !== null);
}

function buildDashboardFromFlatObject(flat: Record<string, unknown>): DashboardData {
  const ridesRaw =
    flat['ridesData'] ?? flat['rides_data'] ?? flat['rides'] ?? flat['month_rides'];
  return {
    currentMonthCompletedRides: pickNumber(
      flat,
      'currentMonthCompletedRides',
      'current_month_completed_rides',
      'completed_rides',
      'month_completed_rides'
    ),
    currentMonthCancelledRides: pickNumber(
      flat,
      'currentMonthCancelledRides',
      'currentMonthCanceledRides',
      'current_month_cancelled_rides',
      'current_month_canceled_rides',
      'cancelled_rides',
      'canceled_rides',
      'month_cancelled_rides'
    ),
    currentMonthAssignedOrders: pickNumber(
      flat,
      'currentMonthAssignedOrders',
      'current_month_assigned_orders',
      'assigned_orders',
      'month_assigned_orders'
    ),
    todayAssignedOrders: pickNumber(
      flat,
      'todayAssignedOrders',
      'today_assigned_orders',
      'assigned_orders_today'
    ),
    ridesData: normalizeRidesArray(ridesRaw).map(ride => ({
      ...ride,
      date: typeof ride.date === 'string' ? new Date(ride.date) : ride.date
    }))
  };
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
          const r = response as DashboardApiResponse & Record<string, unknown>;
          const nestedData =
            r.data && typeof r.data === 'object' && !Array.isArray(r.data)
              ? (r.data as Record<string, unknown>)
              : undefined;
          const nestedResult =
            r.result && typeof r.result === 'object' && !Array.isArray(r.result)
              ? (r.result as Record<string, unknown>)
              : undefined;

          const flat = mergeFlatDashboardPayload(
            nestedData,
            nestedResult,
            extractTopLevelPayloadFields(r)
          );

          if (Object.keys(flat).length === 0) {
            throw new Error('Invalid response format from dashboard API');
          }

          return buildDashboardFromFlatObject(flat);
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
