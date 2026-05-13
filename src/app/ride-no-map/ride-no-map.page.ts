import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { 
  IonContent, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner
} from '@ionic/angular/standalone';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  locationOutline, 
  flagOutline, 
  personOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  warningOutline,
  calendarOutline,
  checkmarkDoneOutline,
  rocketOutline
} from 'ionicons/icons';
import { BookingsService, Booking } from '../services/bookings.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-ride-no-map',
  templateUrl: 'ride-no-map.page.html',
  styleUrls: ['ride-no-map.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonSpinner
  ],
})
export class RideNoMapPage implements OnInit, ViewWillEnter {
  pendingRides: Booking[] = [];
  isOnline = false;
  isLoadingBookings = false;
  updatingRideId: string | null = null; // Track which ride is being accepted/rejected
  private apiUrl = environment.apiUrl;
  notify: boolean = false;

  constructor(
    private bookingsService: BookingsService,
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private router: Router,
    private storage: Storage
  ) {
    addIcons({
      'location-outline': locationOutline,
      'flag-outline': flagOutline,
      'person-outline': personOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'warning-outline': warningOutline,
      'calendar-outline': calendarOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'rocket-outline': rocketOutline
    });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.getOnlineStatus();
    this.loadPendingRides();
  }

  loadPendingRides() {
    console.log('RideNoMapPage: loadPendingRides() called');
    this.isLoadingBookings = true;

    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();

    if (!rick) {
      console.error('RideNoMapPage: Rick ID not found. Please login again.');
      this.isLoadingBookings = false;
      this.pendingRides = [];
      return;
    }

    const requestBody = { rick };

    this.http.post<{ success?: boolean; message?: string; data?: Booking[] } | Booking[]>(`${this.apiUrl}/app/bookings`, requestBody)
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'An unknown error occurred';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
          } else {
            const apiError = error.error as { message?: string };
            errorMessage = apiError?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
          }
          console.error('RideNoMapPage: Bookings API Error:', errorMessage);
          this.isLoadingBookings = false;
          this.pendingRides = [];
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          let bookings: Booking[];

          if (Array.isArray(response)) {
            bookings = response;
          } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
            bookings = response.data;
          } else {
            console.error('RideNoMapPage: Invalid response format from bookings API');
            this.isLoadingBookings = false;
            this.pendingRides = [];
            return;
          }

          const norm = (s: string) =>
            (s === 'in_progress' ? 'in-progress' : s) as Booking['status'];
          const active = bookings.filter(b => {
            const st = String(b.status);
            return st === 'pending' || st === 'in-progress' || st === 'in_progress';
          });
          active.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
            const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
            return dateA - dateB;
          });

          this.pendingRides = active.map(b => ({
            id: String(b.id),
            date: b.date,
            time: b.time || '00:00:00',
            status: norm(String(b.status)),
            pickupLocation: b.pickupLocation,
            dropoffLocation: b.dropoffLocation,
            passengerName: b.passengerName,
            passengerEmail: b.passengerEmail
          }));

          this.isLoadingBookings = false;
        },
        error: (error) => {
          console.error('RideNoMapPage: Failed to load pending bookings:', error);
          this.isLoadingBookings = false;
          this.pendingRides = [];
        }
      });
  }

  getOnlineStatus() {
    const driverId = this.authService.getStoredDriverId();
    
    if (!driverId) {
      console.error('RideNoMapPage: Driver ID not found.');
      return;
    }

    this.http.post<{ success: boolean; data: { id: number; online: boolean }; message: string }>(`${this.apiUrl}/app/drivers/get-online-status`, { id: driverId })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'Failed to get online status';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else {
            const apiError = (error as HttpErrorResponse).error as { message?: string };
            errorMessage = apiError?.message || error.message;
          }
          console.error('RideNoMapPage: Get online status API Error:', errorMessage);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          this.isOnline = response?.success && response?.data && typeof response.data.online === 'boolean'
            ? response.data.online
            : false;
        },
        error: () => {
          this.isOnline = false;
        }
      });
  }

  toggleOnlineStatus() {
    const newOnlineStatus = !this.isOnline;
    const driverId = this.authService.getStoredDriverId();
    
    if (!driverId) {
      alert('Driver ID not found. Please login again.');
      return;
    }

    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/drivers/update-online`, {
      id: driverId,
      online: newOnlineStatus
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to update online status';
          alert(`Failed to update online status: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          this.isOnline = newOnlineStatus;
        },
        error: () => {}
      });
  }

  performAcceptRide(booking: Booking) {
    this.updatingRideId = String(booking.id);

    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, {
      bookingId: booking.id,
      status: 'in-progress'
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to accept ride';
          this.updatingRideId = null;
          alert(`Failed to accept ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          this.updatingRideId = null;
          const idx = this.pendingRides.findIndex(r => r.id === booking.id);
          if (idx >= 0) {
            this.pendingRides = [
              ...this.pendingRides.slice(0, idx),
              { ...this.pendingRides[idx], status: 'in-progress' },
              ...this.pendingRides.slice(idx + 1)
            ];
          }
        },
        error: () => {
          this.updatingRideId = null;
        }
      });
  }

  async acceptRide(booking: Booking) {
    if (this.updatingRideId || !this.isOnline) {
      if (!this.isOnline) {
        this.showOfflineToast('Please go online to accept rides.');
      }
      return;
    }

    const completeConfirm = await this.alertController.create({
      header: 'Accept Ride',
      message: 'Are you sure you want to accept this ride? This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Accept',
          role: 'confirm',
          handler: () => {
            this.performAcceptRide(booking);
          }
        }
      ]
    });
    await completeConfirm.present();
  }

  async completeRide(booking: Booking) {
    if (this.updatingRideId || !this.isOnline) {
      if (!this.isOnline) {
        this.showOfflineToast('Please go online to complete rides.');
      }
      return;
    }

    const completeConfirm = await this.alertController.create({
      header: 'Complete Ride',
      message: 'Mark this ride as completed? This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Complete',
          role: 'confirm',
          handler: () => {
            this.performCompleteRide(booking);
          }
        }
      ]
    });
    await completeConfirm.present();
  }

  private performCompleteRide(booking: Booking) {
    if (this.updatingRideId) return;

    this.updatingRideId = String(booking.id);

    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, {
      bookingId: booking.id,
      status: 'completed'
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to complete ride';
          this.updatingRideId = null;
          alert(`Failed to complete ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          this.updatingRideId = null;
          this.pendingRides = this.pendingRides.filter(r => r.id !== booking.id);
        },
        error: () => {
          this.updatingRideId = null;
        }
      });
  }

  async startRide(booking: Booking) {
    if (this.updatingRideId || !this.isOnline) {
      if (!this.isOnline) {
        this.showOfflineToast('Please go online to start rides.');
      }
      return;
    }

    const confirmStart = await this.alertController.create({
      header: 'Start Ride',
      message: 'Are you sure you want to start this ride?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Start',
          role: 'confirm',
          handler: () => {
            this.performStartRide(booking);
          }
        }
      ]
    });
    await confirmStart.present();
  }

  private performStartRide(booking: Booking) {
    if (this.updatingRideId) return;

    this.updatingRideId = String(booking.id);

    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, {
      bookingId: booking.id,
      status: 'in-progress'
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to start ride';
          this.updatingRideId = null;
          alert(`Failed to start ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          this.updatingRideId = null;
          const idx = this.pendingRides.findIndex(r => r.id === booking.id);
          if (idx >= 0) {
            this.pendingRides = [
              ...this.pendingRides.slice(0, idx),
              { ...this.pendingRides[idx], status: 'in-progress' },
              ...this.pendingRides.slice(idx + 1)
            ];
          }
        },
        error: () => {
          this.updatingRideId = null;
        }
      });
  }

  isInProgress(ride: Booking): boolean {
    return ride.status === 'in-progress';
  }

  performNotifyPassenger(booking: Booking) {
    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/notify-passenger`, {
      passengerEmail: booking.passengerEmail,
      passengerName: booking.passengerName
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to notify passenger';
          alert(`Failed to notify passenger: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          // this.storage.set('passenger_notified', true);
        },
        error: () => {
          // this.storage.set('passenger_notified', false);
        }
      });
  } 

  async notifyPassenger(booking: Booking) {
    if (this.updatingRideId || !this.isOnline) {
      if (!this.isOnline) {
        this.showOfflineToast('Please go online to complete rides.');
      }
      return;
    }

    const completeConfirm = await this.alertController.create({
      header: 'Notify',
      message: 'Are you sure you want to send a notification to this passenger that you reached the pickup location?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Notify',
          role: 'confirm',
          handler: () => {
            this.performNotifyPassenger(booking);
          }
        }
      ]
    });
    await completeConfirm.present();
  }

  performRejecteRide(booking: any){
    this.updatingRideId = String(booking.id);

    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, {
      bookingId: booking.id,
      status: 'cancelled'
    })
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          const apiError = (error as HttpErrorResponse).error as { message?: string };
          const errorMessage = apiError?.message || 'Failed to reject ride';
          this.updatingRideId = null;
          alert(`Failed to reject ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          this.updatingRideId = null;
          this.pendingRides = this.pendingRides.filter(r => r.id !== booking.id);
        },
        error: () => {
          this.updatingRideId = null;
        }
      });
  }

  async rejectRide(booking: Booking) {
    if (this.updatingRideId || !this.isOnline) {
      if (!this.isOnline) {
        alert('Please go online to reject rides.');
      }
      return;
    }

    const completeConfirm = await this.alertController.create({
      header: 'Reject Ride',
      message: 'Are you sure you want to reject this ride? This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'confirm',
          handler: () => {
            this.performRejecteRide(booking);
          }
        }
      ]
    });
    await completeConfirm.present();
  }

  isUpdating(bookingId: string | number): boolean {
    return this.updatingRideId === String(bookingId);
  }

  showAllRides() {
    this.router.navigate(['/tabs/bookings'], {
      queryParams: { segment: 'pending' }
    });
  }

  async showOfflineToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: 'warning',
      icon: 'warning-outline',
      buttons: [
        {
          text: 'Go Online',
          handler: () => {
            if (!this.isOnline) {
              this.toggleOnlineStatus();
            }
          }
        }
      ]
    });
    await toast.present();
  }

  formatDate(date: string, time: string): string {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    const timeParts = (time || '00:00:00').split(':');
    const hours = timeParts[0] || '00';
    const minutes = timeParts[1] || '00';
    dateObj.setHours(parseInt(hours, 10));
    dateObj.setMinutes(parseInt(minutes, 10));
    dateObj.setSeconds(0);
    dateObj.setMilliseconds(0);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
    return `${formattedDate} at ${formattedTime}`;
  }
}
