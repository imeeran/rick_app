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
  IonSpinner, IonFab, IonFabButton, IonModal, IonButtons, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonSearchbar, IonText } from '@ionic/angular/standalone';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import { ViewWillEnter, LoadingController } from '@ionic/angular';
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
  rocketOutline,
  add,
  location,
  playOutline,
} from 'ionicons/icons';
import { BookingsService, Booking } from '../services/bookings.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LocationService } from '../services/location.service';
import { PlacesService } from '../services/places.service';
import { Position } from '@capacitor/geolocation';


@Component({
  selector: 'app-ride-no-map',
  templateUrl: 'ride-no-map.page.html',
  styleUrls: ['ride-no-map.page.scss'],
  imports: [IonText, IonSearchbar, IonLabel, IonItem, IonList, IonTitle, IonToolbar, IonButtons, IonModal, IonFabButton, IonFab,ReactiveFormsModule,
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
  isWalkinModalOpenPickup = signal(false);
  isWalkinModalOpenDrop = signal(false);
  pickupForm: FormGroup;
  dropOffForm: FormGroup;
  // ---- Location Autocomplete Properties ----
  pickupQuery = '';
  dropoffQuery = '';
  pickupPredictions: google.maps.places.AutocompleteSuggestion[] = [];
  showPickupPredictions = false;
  dropPredictions: google.maps.places.AutocompleteSuggestion[] = [];
  showDropPredictions = false;
  activeField: 'pickup' | 'dropoff' | null = null;
  isSubmitting = false;
  bookingIdForUpdate: any;

  constructor(
    private bookingsService: BookingsService,
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private alertController: AlertController,
    private router: Router,
    private storage: Storage,
    private fb: FormBuilder,
    private loadingCtrl: LoadingController,
    private locationService: LocationService,
    private placesService: PlacesService
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
      'rocket-outline': rocketOutline,
      'add': add,
      'locate': location,
      'play-outline': playOutline
    });
    const now = new Date();
    this.pickupForm = this.fb.group({
      pickupLocation: ['', Validators.required],
      pickupLatLon: [''],
      bookingDate: [now.toISOString()],
      bookingTime: [now.toTimeString().slice(0, 5)],
      rideType: ['WALKIN'],
      rickId: [this.authService.getStoredRick() || '']
    });
    this.dropOffForm = this.fb.group({
      dropoffLocation: ['', Validators.required],
      dropLatLon: [''],
      totalCharge: [null, Validators.required],
      guestName: [''],
      mobileNumber: ['', [Validators.pattern('^[0-9]{10,15}$')]],
      rickId: [this.authService.getStoredRick() || '']
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
            passengerEmail: b.passengerEmail,
            rideType: b.rideType,
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
            if(booking.rideType === 'WALKIN') {
              this.bookingIdForUpdate = booking.id;
              this.openWalkinModalDrop();
            }
            else{
              this.performCompleteRide(booking);
            }
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
    const toast = await this.toastCtrl.create({
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
  openWalkinModal() {
    this.isWalkinModalOpenPickup.set(true);
  }
  openWalkinModalDrop() {
    this.isWalkinModalOpenDrop.set(true);
  }

  closeWalkinModalPickup() {
    this.isWalkinModalOpenPickup.set(false);
  }
  closeWalkinModalDrop() {
    this.isWalkinModalOpenDrop.set(false);
  }

  onDropInput(event: any) {
    const query = event.detail.value;
    this.dropoffQuery = query;
    this.dropOffForm.patchValue({ dropoffLocation: query });
    if (!query || query.trim().length === 0) {
      this.dropPredictions = [];
      this.showDropPredictions = false;
      return;
    }
    this.placesService.getPlacePredictions(query)
      .then(predictions => {
        this.dropPredictions = predictions;
        this.showDropPredictions = predictions.length > 0 && this.activeField === 'dropoff';
      })
      .catch(err => {
        console.error('Error fetching dropoff predictions', err);
        this.showDropPredictions = false;
      });
  }
  onDropFocus() {
    this.activeField = 'dropoff';
    if (this.dropPredictions.length > 0) {
      this.showDropPredictions = true;
    }
  }
  onDropBlur() {
    setTimeout(() => {
      this.showDropPredictions = false;
      if (this.activeField === 'dropoff') this.activeField = null;
    }, 200);
  }

  // ---- PICKUP AUTOCOMPLETE ----
  onPickupInput(event: any) {
    const query = event.detail.value;
    this.pickupQuery = query;
    this.pickupForm.patchValue({ pickupLocation: query });
    if (!query || query.trim().length === 0) {
      this.pickupPredictions = [];
      this.showPickupPredictions = false;
      return;
    }
    this.placesService.getPlacePredictions(query)
      .then(predictions => {
        this.pickupPredictions = predictions;
        this.showPickupPredictions = predictions.length > 0 && this.activeField === 'pickup';
      })
      .catch(err => {
        console.error('Error fetching pickup predictions', err);
        this.showPickupPredictions = false;
      });
  }
  onPickupFocus() {
    this.activeField = 'pickup';
    if (this.pickupPredictions.length > 0) {
      this.showPickupPredictions = true;
    }
  }
  onPickupBlur() {
    setTimeout(() => {
      this.showPickupPredictions = false;
      if (this.activeField === 'pickup') this.activeField = null;
    }, 200);
  }

async selectPickupPrediction(suggestion: google.maps.places.AutocompleteSuggestion) {
  try {
    if (!suggestion.placePrediction) {
      console.warn('No place prediction found');
      return;
    }

    // ✅ Use placePrediction.placeId
    const placeId = suggestion.placePrediction.placeId;
    if (!placeId) {
      throw new Error('No place ID found');
    }

    const details = await this.placesService.getPlaceDetails(placeId);
    
    // ✅ Use placePrediction.text.text for the address
    const address = details.formatted_address || suggestion.placePrediction.text.text || '';
    
    this.pickupForm.patchValue({
      pickupLocation: address,
      pickupLatLon: details.geometry?.location ?
        `${details.geometry.location.lat()},${details.geometry.location.lng()}` : ''
    });
    this.pickupQuery = address;
    this.pickupPredictions = [];
    this.showPickupPredictions = false;
  } catch (error) {
    console.error('Error getting pickup details:', error);
    this.showToast('Failed to get location details', 'danger');
  }
}

// Same for dropoff
async selectDropPrediction(suggestion: google.maps.places.AutocompleteSuggestion) {
  try {
    if (!suggestion.placePrediction) {
      console.warn('No place prediction found');
      return;
    }

    // Declare placeId here
    const placeId = suggestion.placePrediction.placeId;
    if (!placeId) {
      throw new Error('No place ID found');
    }

    const details = await this.placesService.getPlaceDetails(placeId);
    const address = details.formatted_address || suggestion.placePrediction.text.text || '';

    this.dropOffForm.patchValue({
      dropoffLocation: address,
      dropLatLon: details.geometry?.location ?
        `${details.geometry.location.lat()},${details.geometry.location.lng()}` : ''
    });

    this.dropoffQuery = address;
    this.dropPredictions = [];
    this.showDropPredictions = false;
  } catch (error) {
    console.error('Error getting dropoff details:', error);
    this.showToast('Failed to get location details', 'danger');
  }
}
 
  async useCurrentLocationForPickupandDropoff(type: 'pickup' | 'dropoff') {
    console.log(`🔵 useCurrentLocationForPickupandDropoff called for: ${type}`);
    const loader = await this.loadingCtrl.create({
      message: `Getting your ${type} location...`,
    });
    await loader.present();

    let position: Position | null = null;

    try {
      console.log('📍 Requesting position from LocationService...');
      position = await this.locationService.getCurrentPosition();
      console.log('✅ Position obtained:', position);

      if (!position) {
        console.warn('⚠️ Position is null');
        await loader.dismiss();
        this.showToast('Unable to get location. Please enable GPS.', 'danger');
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      console.log(`📍 Coordinates: Lat=${lat}, Lng=${lng}`);

      console.log('🌐 Reverse geocoding...');
      const result = await this.placesService.reverseGeocode(lat, lng);
      console.log('✅ Reverse geocoding result:', result);

      const address = result.formatted_address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
      console.log(`📌 Final address: ${address}`);

      if (type === 'pickup') {
        this.pickupForm.patchValue({
          pickupLocation: address,
          pickupLatLon: `${lat},${lng}`
        });
      } else {
        this.dropOffForm.patchValue({
          dropoffLocation: address,
          dropLatLon: `${lat},${lng}`
        });
      }

      await loader.dismiss();
      this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} location set`, 'success');
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      console.error(`❌ Error:`, errorMessage);

      // Fallback: use coordinates if we have them
      if (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const fallbackAddress = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        if (type === 'pickup') {
          this.pickupForm.patchValue({
            pickupLocation: fallbackAddress,
            pickupLatLon: `${lat},${lng}`
          });
        } else {
          this.dropOffForm.patchValue({
            dropoffLocation: fallbackAddress,
            dropLatLon: `${lat},${lng}`
          });
        }
        await loader.dismiss();
        this.showToast('Location set (coordinates only)', 'warning');
      } else {
        await loader.dismiss();
        this.showToast(`Failed to get ${type} address: ${errorMessage}`, 'danger');
      }
    }
  }

  // ---- FORM SUBMISSION (unchanged) ----
  private toBackendDate(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const raw = String(value).trim();
    if (!raw) return '';
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return raw;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return raw;
  }
  private formatTimeForBackend(timeValue: any): string {
    if (!timeValue) return '';
    if (timeValue instanceof Date) {
      const hours = timeValue.getHours().toString().padStart(2, '0');
      const minutes = timeValue.getMinutes().toString().padStart(2, '0');
      const seconds = timeValue.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    if (typeof timeValue === 'string') {
      if (timeValue.includes('T')) {
        const timePart = timeValue.split('T')[1]?.split('.')[0] || timeValue.split('T')[1]?.split('Z')[0] || '';
        return timePart;
      }
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)) {
        return timeValue.length === 5 ? `${timeValue}:00` : timeValue;
      }
      return timeValue;
    }
    return String(timeValue);
  }

  async createWalkinRide(): Promise<void> {
    console.log('createWalkinRide called');
    console.log('Form value:', this.pickupForm.value);
    console.log('Form valid:', this.pickupForm.valid);
    if (this.pickupForm.invalid) {
      console.log('Form is invalid');
      this.pickupForm.markAllAsTouched();
      this.showToast('Please complete the required fields.', 'warning');
      return;
    }
    const loader = await this.loadingCtrl.create({
      message: 'Creating booking...',
    });
    await loader.present();

    const formValue = this.pickupForm.value;
    const payload = {
      pickupLocation: formValue.pickupLocation,
      pickup_lat_lon: formValue.pickupLatLon || '',
      bookingDate: this.toBackendDate(formValue.bookingDate),
      bookingTime: this.formatTimeForBackend(formValue.bookingTime),
      ride_type: formValue.rideType,
      rickId: formValue.rickId || '',
    };
    try {
      await firstValueFrom(this.bookingsService.createBooking(payload));
      await loader.dismiss();
      this.showToast('Booking created successfully.', 'success');
      this.resetBookingForm();
      this.loadPendingRides();
      this.isWalkinModalOpenPickup.set(false);
    } catch (error) {
      await loader.dismiss();
      this.showToast('Failed to create booking. Please try again.', 'danger');
      console.error('Booking create error', error);
    }
  }

  async updateDropoff() {
    console.log('Mobile errors:', this.dropOffForm.get('mobileNumber')?.errors);
    if (this.dropOffForm.invalid) {
      this.dropOffForm.markAllAsTouched();
      this.showToast('Please complete the required fields.', 'warning');
      return;
    }
    const loader = await this.loadingCtrl.create({
      message: 'Creating booking...',
    });
    await loader.present();

    const formValue = this.dropOffForm.value;
    const payload = {
      dropoffLocation: formValue.dropoffLocation,
      drop_lat_lon: formValue.dropLatLon || '',
      total_charge: formValue.totalCharge,
      guestName: formValue.guestName,
      mobileNumber: formValue.mobileNumber,
      rickId: formValue.rickId || '',
      id: this.bookingIdForUpdate
    };
    try {
      await firstValueFrom(this.bookingsService.updateDropoffWalkin(payload));
      await loader.dismiss();
      this.showToast('Booking updated successfully.', 'success');
      this.resetDropOffForm();
      this.loadPendingRides();
      this.isWalkinModalOpenDrop.set(false);
    } catch (error) {
      await loader.dismiss();
      this.showToast('Failed to update booking. Please try again.', 'danger');
      console.error('Booking create error', error);
    }
  }
  private resetDropOffForm(): void {
    this.dropOffForm.reset({
      dropoffLocation: '',
      dropLatLon: '',
      totalCharge: '',
      guestName: '',
      mobileNumber: '',
      rideType: 'WALKIN',
      rickId: this.authService.getStoredRick() || '',
    });
    this.dropoffQuery = '';
    this.dropPredictions = [];
    this.showDropPredictions = false;
  }

  private resetBookingForm(): void {
    const now = new Date();
    this.pickupForm.reset({
      pickupLocation: '',
      pickupLatLon: '',
      bookingDate: now.toISOString(),
      bookingTime: now.toTimeString().slice(0, 5),
      rideType: 'WALKIN',
      rickId: this.authService.getStoredRick() || '',
    });
    this.pickupQuery = '';
    this.pickupPredictions = [];
    this.showPickupPredictions = false;
  }

  // Toast Display Here
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
  onMobileInput(event: any) {
    let raw = event.detail.value || '';
    // Remove all non-digit characters
    const digitsOnly = raw.replace(/\D/g, '');
    // Update the form control with the cleaned value
    this.dropOffForm.patchValue({ mobileNumber: digitsOnly }, { emitEvent: false });
  }
}
