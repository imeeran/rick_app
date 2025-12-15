import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface Booking {
  id: string;
  date: string; // Date in format: "YYYY-MM-DD" or ISO date string
  time: string; // Time in format: "HH:mm:ss" or "HH:mm"
  status: 'pending' | 'completed' | 'cancelled';
  pickupLocation: string;
  dropoffLocation: string;
  passengerName: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingsService {
  constructor() {}

  getBookings(): Observable<Booking[]> {
    // Return empty array - API is called from booking.page.ts
    return of([]);
  }

  getBookingsByStatus(status: 'pending' | 'completed' | 'cancelled'): Observable<Booking[]> {
    // Return empty array - API is called from booking.page.ts
    return of([]);
  }
}
