import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { 
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonAccordion,
  IonAccordionGroup,
  IonSpinner, IonButton, IonModal, IonHeader, IonTitle, IonToolbar, IonButtons, IonInput, IonDatetime, IonDatetimeButton, IonTextarea, IonRefresher, IonList, IonText, IonFooter, IonCheckbox, IonSearchbar 
} from '@ionic/angular/standalone';
import { BookingsService, Booking } from '../services/bookings.service';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Subscription, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { locationOutline, flagOutline, personOutline, timeOutline, calendarOutline, addOutline, closeOutline, locateOutline } from 'ionicons/icons';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastController, LoadingController, NavController } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { LocationService } from '../services/location.service';
import { PlacesService } from '../services/places.service';

interface MonthGroup {
  monthKey: string;
  monthName: string;
  year: number;
  bookings: Booking[];
}

@Component({
  selector: 'app-booking',
  templateUrl: 'booking.page.html',
  styleUrls: ['booking.page.scss'],
  imports: [IonSearchbar, IonFooter, IonText, IonList, IonRefresher, IonTextarea, IonDatetime, IonDatetimeButton, IonInput, IonButtons, IonToolbar, IonTitle, IonHeader, IonModal, IonButton, ReactiveFormsModule,
    CommonModule,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonAccordion,
    IonAccordionGroup,
    IonSpinner,
    IonCheckbox
  ],
})
export class BookingPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('segmentElement', { read: ElementRef }) segmentElement!: ElementRef;
  
  selectedSegment = signal<'pending' | 'completed' | 'cancelled'>('pending');
  selectedMonth = signal<string>('all');
  selectedYear = signal<string>('all');
  showAll = signal<boolean>(true);
  dateScopeToday = signal<boolean>(false);
  
  allBookings: Booking[] = [];
  filteredBookings = signal<Booking[]>([]);
  monthGroups = signal<MonthGroup[]>([]);
  isLoading = signal<boolean>(false);
  
  months: { value: string; label: string }[] = [];
  years: { value: string; label: string }[] = [];
  currentMonthKey: string = '';
  private themeSubscription?: Subscription;
  private apiUrl = environment.apiUrl;
  isWalkinModalOpen = signal(false);

  bookingForm: FormGroup;
  isSubmitting = false;
  rideTypes = [
    { value: 'TRANSFER', label: 'TRANSFER' },
    { value: 'CHAUFFEUR', label: 'CHAUFFEUR' },
    { value: 'WALKIN', label: 'WALKIN' },
    { value: 'Other', label: 'Other' },
  ];
  paymentModes = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
  ];
  vehicleOptions = [
    { value: 'suv', label: 'SUV' },
    { value: 'xl', label: 'XL' },
    { value: 'vip', label: 'VIP' },
    { value: 'vip-plus', label: 'VIP PLUS' },
    { value: 'bmw7series', label: 'BMW 7 SERIES' },
    { value: 'tesla', label: 'TESLA' },
  ];
  selectedVehicle = signal<string>('');

  // ---- Location Autocomplete Properties ----
  pickupQuery = '';
  pickupPredictions: google.maps.places.AutocompletePrediction[] = [];
  showPickupPredictions = false;

  dropoffQuery = '';
  dropoffPredictions: google.maps.places.AutocompletePrediction[] = [];
  showDropoffPredictions = false;

  activeField: 'pickup' | 'dropoff' | null = null;
  rickId: string | null = null;

  constructor(
    private bookingsService: BookingsService,
    private themeService: ThemeService,
    private http: HttpClient,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private locationService: LocationService,
    private placesService: PlacesService
  ) {
    addIcons({ locationOutline, flagOutline, personOutline, timeOutline, calendarOutline, addOutline, closeOutline, locateOutline });
    const now = new Date();
    this.bookingForm = this.fb.group({
      vehicleType: ['', Validators.required],
      pickupLocation: ['', Validators.required],
      pickupLatLon: [''],
      dropoffLocation: ['', Validators.required],
      dropLatLon: [''],
      bookingDate: [now.toISOString(), Validators.required],
      bookingTime: [now.toTimeString().slice(0, 5), Validators.required],
      guestName: ['', Validators.required],
      mobileNumber: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      emailId: ['', [Validators.required, Validators.email]],
      totalCharge: [null, Validators.required],
      driverCharge: [null, Validators.required],
      tollCharge: [null],
      paymentMode: ['CASH', Validators.required],
      rideType: ['TRANSFER', Validators.required],
      hours: [null],
      onContract: [false],
      contractProviderName: [''],
      specialNote: [''],
    });
  }

  ngOnInit() {
    console.log('BookingPage: ngOnInit() called');
    this.initializeMonths();
    this.initializeYears();
    this.setupThemeSubscription();
  }

  ionViewWillEnter() {
    console.log('BookingPage: ionViewWillEnter() called - loading bookings');
    this.applyRouteQueryParams();
    this.loadBookings();
  }

  private applyRouteQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const segment = qp.get('segment');
    const scope = qp.get('scope');
    let shouldClear = false;

    this.dateScopeToday.set(false);

    if (scope === 'today') {
      this.selectedSegment.set('pending');
      this.dateScopeToday.set(true);
      const now = new Date();
      this.selectedMonth.set(String(now.getMonth()));
      this.selectedYear.set(String(now.getFullYear()));
      this.showAll.set(false);
      shouldClear = true;
    } else if (scope === 'currentMonth') {
      this.selectedSegment.set('pending');
      const now = new Date();
      this.selectedMonth.set(String(now.getMonth()));
      this.selectedYear.set(String(now.getFullYear()));
      this.showAll.set(false);
      shouldClear = true;
    } else if (segment === 'pending' || segment === 'completed' || segment === 'cancelled') {
      this.selectedSegment.set(segment);
      if (segment === 'completed' || segment === 'cancelled') {
        this.selectedMonth.set('all');
        this.selectedYear.set('all');
        this.showAll.set(true);
      }
      shouldClear = true;
    }

    if (shouldClear) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
  }

  ngAfterViewInit() {
    this.updateSegmentColor();
  }

  ngOnDestroy() {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  private setupThemeSubscription() {
    this.themeSubscription = this.themeService.currentTheme$.subscribe(() => {
      setTimeout(() => {
        this.updateSegmentColor();
      }, 150);
    });
    setTimeout(() => {
      this.updateSegmentColor();
    }, 200);
  }

  private updateSegmentColor() {
    if (this.segmentElement?.nativeElement) {
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-color-primary')
        .trim();
      
      if (primaryColor) {
        const segmentEl = this.segmentElement.nativeElement;
        const isAndroid = document.body.classList.contains('md') || 
                         document.documentElement.classList.contains('md');
        
        if (isAndroid) {
          segmentEl.style.setProperty('--indicator-color', 'transparent');
        } else {
          segmentEl.style.setProperty('--indicator-color', primaryColor);
        }
        
        const textColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--ion-text-color')
          .trim();
        
        const segmentButtons = segmentEl.querySelectorAll('ion-segment-button');
        segmentButtons.forEach((button: Element) => {
          const htmlButton = button as HTMLElement;
          const isChecked = htmlButton.classList.contains('segment-button-checked');
          const label = htmlButton.querySelector('ion-label');
          
          if (isAndroid) {
            htmlButton.style.setProperty('--indicator-color', 'transparent');
            htmlButton.style.setProperty('--color-checked', '#ffffff');
            htmlButton.style.setProperty('--background-checked', primaryColor);
            htmlButton.style.setProperty('--ripple-color', primaryColor);
            
            if (isChecked) {
              htmlButton.style.setProperty('background', primaryColor);
              if (label) {
                (label as HTMLElement).style.setProperty('--color', '#ffffff');
                (label as HTMLElement).style.setProperty('color', '#ffffff');
              }
            } else {
              htmlButton.style.setProperty('background', 'transparent');
              if (label) {
                (label as HTMLElement).style.setProperty('--color', textColor);
                (label as HTMLElement).style.setProperty('color', textColor);
              }
            }
          } else {
            htmlButton.style.setProperty('--indicator-color', primaryColor);
            htmlButton.style.setProperty('--color-checked', primaryColor);
            htmlButton.style.setProperty('--ripple-color', primaryColor);
            
            if (label) {
              if (isChecked) {
                (label as HTMLElement).style.setProperty('--color', primaryColor);
                (label as HTMLElement).style.setProperty('color', primaryColor);
              } else {
                (label as HTMLElement).style.setProperty('--color', textColor);
                (label as HTMLElement).style.setProperty('color', textColor);
              }
            }
          }
        });
      }
    }
  }

  private initializeMonths() {
    this.months = [
      { value: 'all', label: 'All Months' },
      { value: '0', label: 'January' },
      { value: '1', label: 'February' },
      { value: '2', label: 'March' },
      { value: '3', label: 'April' },
      { value: '4', label: 'May' },
      { value: '5', label: 'June' },
      { value: '6', label: 'July' },
      { value: '7', label: 'August' },
      { value: '8', label: 'September' },
      { value: '9', label: 'October' },
      { value: '10', label: 'November' },
      { value: '11', label: 'December' }
    ];
  }

  private initializeYears() {
    const now = new Date();
    const currentYear = now.getFullYear();
    this.years = [
      { value: 'all', label: 'All Years' }
    ];
    for (let i = 0; i < 6; i++) {
      const year = currentYear - i;
      this.years.push({
        value: year.toString(),
        label: year.toString()
      });
    }
  }

  loadBookings() {
    console.log('BookingPage: loadBookings() called');
    this.isLoading.set(true);
    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();
    this.rickId = rick;

    if (!rick) {
      console.error('BookingPage: Rick ID not found. Please login again.');
      this.isLoading.set(false);
      return;
    }

    const requestBody = { rick };
    console.log('BookingPage: Making API call to /app/bookings with rick:', rick);

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
          console.error('Bookings API Error:', errorMessage);
          this.isLoading.set(false);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('BookingPage: API response received', response);
          let bookings: Booking[];
          if (Array.isArray(response)) {
            bookings = response;
          } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
            bookings = response.data;
          } else {
            console.error('Invalid response format from bookings API');
            this.isLoading.set(false);
            return;
          }
          this.allBookings = bookings.map(booking => ({
            id: booking.id,
            date: booking.date,
            time: booking.time || '00:00:00',
            status: booking.status,
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            passengerName: booking.passengerName,
            passengerEmail: booking.passengerEmail
          }));
          this.filterBookings();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load bookings:', error);
          this.isLoading.set(false);
        }
      });
  }

  segmentChanged(event: CustomEvent) {
    this.dateScopeToday.set(false);
    this.selectedSegment.set(event.detail.value);
    this.filterBookings();
    setTimeout(() => {
      this.updateSegmentColor();
    }, 50);
  }

  monthChanged(event: CustomEvent) {
    this.dateScopeToday.set(false);
    const value = event.detail.value;
    this.selectedMonth.set(value);
    this.showAll.set(value === 'all' && this.selectedYear() === 'all');
    this.filterBookings();
  }

  yearChanged(event: CustomEvent) {
    this.dateScopeToday.set(false);
    const value = event.detail.value;
    this.selectedYear.set(value);
    this.showAll.set(value === 'all' && this.selectedMonth() === 'all');
    this.filterBookings();
  }

  filterBookings() {
    const status = this.selectedSegment();
    const monthFilter = this.selectedMonth();
    const yearFilter = this.selectedYear();
    
    let filtered = this.allBookings.filter(booking => booking.status === status);
    
    if (yearFilter !== 'all') {
      const year = parseInt(yearFilter);
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate.getFullYear() === year;
      });
    }
    
    if (monthFilter !== 'all') {
      const month = parseInt(monthFilter);
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate.getMonth() === month;
      });
    }

    if (this.dateScopeToday()) {
      const today = new Date();
      filtered = filtered.filter(booking => {
        const d = new Date(booking.date);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      });
    }
    
    this.filteredBookings.set(filtered);
    
    if (this.showAll()) {
      this.groupByMonth(filtered);
    } else {
      this.monthGroups.set([]);
    }
  }

  private groupByMonth(bookings: Booking[]) {
    const groups = new Map<string, MonthGroup>();
    bookings.forEach(booking => {
      const bookingDate = new Date(booking.date);
      const year = bookingDate.getFullYear();
      const month = bookingDate.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      if (!groups.has(monthKey)) {
        const monthName = bookingDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        groups.set(monthKey, {
          monthKey,
          monthName,
          year,
          bookings: []
        });
      }
      groups.get(monthKey)!.bookings.push(booking);
    });
    
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });
    this.monthGroups.set(sortedGroups);
  }

  formatDate(date: string, time: string): string {
    const dateObj = new Date(date);
    const timeParts = time.split(':');
    const hours = timeParts[0] || '00';
    const minutes = timeParts[1] || '00';
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
    const hour24 = parseInt(hours);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
    return `${formattedDate} at ${formattedTime}`;
  }

  getSelectedMonthLabel(): string {
    const selected = this.selectedMonth();
    if (selected === 'all') return 'Show All';
    if (selected === 'current') {
      const now = new Date();
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const month = this.months.find(m => m.value === selected);
    return month ? month.label : 'Select Month';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  createWalking() {
    this.isWalkinModalOpen.set(true);
  }

  closeWalkinModal() {
    this.isWalkinModalOpen.set(false);
  }

  selectVehicle(vehicleType: string): void {
    this.selectedVehicle.set(vehicleType);
    this.bookingForm.patchValue({ vehicleType });
  }

  // ---- PICKUP AUTOCOMPLETE ----
  onPickupInput(event: any) {
    const query = event.detail.value;
    this.pickupQuery = query;
    // Update form control (if using ngModel separately, but we use formControlName)
    this.bookingForm.patchValue({ pickupLocation: query });
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

  async selectPickupPrediction(prediction: google.maps.places.AutocompletePrediction) {
    try {
      const details = await this.placesService.getPlaceDetails(prediction.place_id);
      const address = details.formatted_address || prediction.description;
      this.bookingForm.patchValue({
        pickupLocation: address,
        pickupLatLon: details.geometry?.location ? 
          `${details.geometry.location.lat()},${details.geometry.location.lng()}` : ''
      });
      this.pickupQuery = address;
      this.pickupPredictions = [];
      this.showPickupPredictions = false;
    } catch (error) {
      console.error('Error getting pickup details', error);
      this.showToast('Failed to get location details', 'danger');
    }
  }

  // ---- DROPOFF AUTOCOMPLETE ----
  onDropoffInput(event: any) {
    const query = event.detail.value;
    this.dropoffQuery = query;
    this.bookingForm.patchValue({ dropoffLocation: query });
    if (!query || query.trim().length === 0) {
      this.dropoffPredictions = [];
      this.showDropoffPredictions = false;
      return;
    }
    this.placesService.getPlacePredictions(query)
      .then(predictions => {
        this.dropoffPredictions = predictions;
        this.showDropoffPredictions = predictions.length > 0 && this.activeField === 'dropoff';
      })
      .catch(err => {
        console.error('Error fetching dropoff predictions', err);
        this.showDropoffPredictions = false;
      });
  }

  onDropoffFocus() {
    this.activeField = 'dropoff';
    if (this.dropoffPredictions.length > 0) {
      this.showDropoffPredictions = true;
    }
  }

  onDropoffBlur() {
    setTimeout(() => {
      this.showDropoffPredictions = false;
      if (this.activeField === 'dropoff') this.activeField = null;
    }, 200);
  }

  async selectDropoffPrediction(prediction: google.maps.places.AutocompletePrediction) {
    try {
      const details = await this.placesService.getPlaceDetails(prediction.place_id);
      const address = details.formatted_address || prediction.description;
      this.bookingForm.patchValue({
        dropoffLocation: address,
        dropLatLon: details.geometry?.location ?
          `${details.geometry.location.lat()},${details.geometry.location.lng()}` : ''
      });
      this.dropoffQuery = address;
      this.dropoffPredictions = [];
      this.showDropoffPredictions = false;
    } catch (error) {
      console.error('Error getting dropoff details', error);
      this.showToast('Failed to get location details', 'danger');
    }
  }

  // ---- USE CURRENT LOCATION (for Pickup) ----
  async useCurrentLocation() {
    const loader = await this.loadingCtrl.create({
      message: 'Getting your location...',
    });
    await loader.present();

    try {
      const position = await this.locationService.getCurrentPosition();
      if (!position) {
        await loader.dismiss();
        this.showToast('Unable to get location. Please enable GPS.', 'danger');
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Reverse geocode to get address
      const result = await this.placesService.reverseGeocode(lat, lng);
      const address = result.formatted_address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

      this.bookingForm.patchValue({
        pickupLocation: address,
        pickupLatLon: `${lat},${lng}`
      });
      this.pickupQuery = address;
      this.showPickupPredictions = false;
      this.pickupPredictions = [];

      await loader.dismiss();
      this.showToast('Current location set successfully', 'success');
    } catch (error) {
      await loader.dismiss();
      console.error('Error getting location or address:', error);
      this.showToast('Failed to get address. Please try again.', 'danger');
    }
  }

  // ---- PREVENT BLUR ON CLICK ----
  preventBlur(event: MouseEvent) {
    event.preventDefault();
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

  private toNumber(value: any, defaultValue: number | undefined): number | undefined {
    if (defaultValue === undefined && (value == null || String(value).trim() === '')) {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : (defaultValue ?? 0);
  }

  async createBooking(): Promise<void> {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      this.showToast('Please complete the required fields.', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Creating booking...',
    });
    await loader.present();

    const formValue = this.bookingForm.value;
    const payload = {
      vehicleType: formValue.vehicleType,
      pickupLocation: formValue.pickupLocation,
      dropoffLocation: formValue.rideType === 'CHAUFFEUR' ? '' : (formValue.dropoffLocation || ''),
      pickup_lat_lon: formValue.pickupLatLon || '',
      drop_lat_lon: formValue.rideType === 'CHAUFFEUR' ? (formValue.pickupLatLon || '') : (formValue.dropLatLon || ''),
      duration: '',
      distance: '',
      bookingDate: this.toBackendDate(formValue.bookingDate),
      bookingTime: this.formatTimeForBackend(formValue.bookingTime),
      guestName: formValue.guestName,
      mobileNumber: formValue.mobileNumber,
      emailId: formValue.emailId,
      total_charge: this.toNumber(formValue.totalCharge, 0),
      driverCharge: this.toNumber(formValue.driverCharge, 0),
      tollCharge: this.toNumber(formValue.tollCharge, undefined),
      payment_mode: formValue.paymentMode,
      ride_type: formValue.rideType,
      hours: formValue.rideType === 'CHAUFFEUR' ? this.toNumber(formValue.hours, 2) : undefined,
      on_contract: formValue.onContract ?? false,
      contract_provider_name: formValue.onContract ? (formValue.contractProviderName || '') : '',
      specialNote: formValue.specialNote || '',
      rickId: this.rickId || '',
    };

    try {
      await firstValueFrom(this.bookingsService.createBooking(payload));
      await loader.dismiss();
      this.showToast('Booking created successfully.', 'success');
      this.resetBookingForm();
      this.isWalkinModalOpen.set(false);
    } catch (error) {
      await loader.dismiss();
      this.showToast('Failed to create booking. Please try again.', 'danger');
      console.error('Booking create error', error);
    }
  }

  private resetBookingForm(): void {
    const now = new Date();
    this.bookingForm.reset({
      vehicleType: '',
      pickupLocation: '',
      pickupLatLon: '',
      dropoffLocation: '',
      dropLatLon: '',
      bookingDate: now.toISOString(),
      bookingTime: now.toTimeString().slice(0, 5),
      guestName: '',
      mobileNumber: '',
      emailId: '',
      totalCharge: null,
      driverCharge: null,
      tollCharge: null,
      paymentMode: 'CASH',
      rideType: 'TRANSFER',
      hours: null,
      onContract: false,
      contractProviderName: '',
      specialNote: '',
    });
    this.selectedVehicle.set('');
    this.pickupQuery = '';
    this.dropoffQuery = '';
    this.pickupPredictions = [];
    this.dropoffPredictions = [];
    this.showPickupPredictions = false;
    this.showDropoffPredictions = false;
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}