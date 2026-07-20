import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Booking {
  id: string;
  date: string; // Date in format: "YYYY-MM-DD" or ISO date string
  time: string; // Time in format: "HH:mm:ss" or "HH:mm"
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  pickupLocation: string;
  dropoffLocation: string;
  passengerName: string;
  passengerEmail: string;
  rideType: string;
}

// export interface WalkinBookingPayload {
//   customer_name: string;
//   mobile_number: string;
//   pickup_loc: string;
//   pickup_lat_lon?: string;
//   drop_loc: string;
//   drop_lat_lon?: string;
//   ride_type: string;
//   payment_mode: string;
//   booking_type: string;
//   schedule_type: 'now' | 'later';
//   booking_date_time: string;
//   special_note?: string;
//   assigned_driver?: string;
//   source?: string;
// }

export interface CreateBookingPayload {
  vehicleType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickup_lat_lon?: string;
  drop_lat_lon?: string;
  duration?: string;
  distance?: string;
  bookingDate?: string;
  bookingTime?: string;
  guestName?: string;
  mobileNumber?: string;
  emailId?: string;
  total_charge?: number;
  driverCharge?: number;
  tollCharge?: number;
  payment_mode?: string;
  ride_type?: string;
  hours?: number;
  on_contract?: boolean;
  contract_provider_name?: string;
  specialNote?: string;
  rickId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingsService {
  private readonly createWalkinEndpoint = `${environment.apiUrl}/app/bookings/create-walkin`;
  private readonly UpdateWalkinEndpoint = `${environment.apiUrl}/app/bookings/update-walkin`;

  constructor(private http: HttpClient) {}

  getBookings(): Observable<Booking[]> {
    // Return empty array - API is called from booking.page.ts
    return of([]);
  }

  getBookingsByStatus(status: 'pending' | 'in-progress' | 'completed' | 'cancelled'): Observable<Booking[]> {
    // Return empty array - API is called from booking.page.ts
    return of([]);
  }

  createBooking(payload: CreateBookingPayload): Observable<any> {
    return this.http.post(this.createWalkinEndpoint, payload);
  }
   updateDropoffWalkin(payload: CreateBookingPayload): Observable<any> {
    return this.http.patch(this.UpdateWalkinEndpoint, payload);
  }

  // createWalkinBooking(payload: WalkinBookingPayload): Observable<any> {
  //   return this.http.post(this.bookingsEndpoint, payload);
  // }
}

