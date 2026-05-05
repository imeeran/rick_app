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
  IonSpinner
} from '@ionic/angular/standalone';
import { BookingsService, Booking } from '../services/bookings.service';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Subscription, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { locationOutline, flagOutline, personOutline, timeOutline, calendarOutline } from 'ionicons/icons';

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
  imports: [
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
    IonSpinner
  ],
})
export class BookingPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('segmentElement', { read: ElementRef }) segmentElement!: ElementRef;
  
  selectedSegment = signal<'pending' | 'completed' | 'cancelled'>('pending');
  selectedMonth = signal<string>('all');
  selectedYear = signal<string>('all');
  showAll = signal<boolean>(true);
  /** When set from dashboard "Today's assigned" — extra filter in filterBookings */
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

  constructor(
    private bookingsService: BookingsService,
    private themeService: ThemeService,
    private http: HttpClient,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    addIcons({ locationOutline, flagOutline, personOutline, timeOutline, calendarOutline });
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
    // Set initial color
    setTimeout(() => {
      this.updateSegmentColor();
    }, 200);
  }

  private updateSegmentColor() {
    if (this.segmentElement?.nativeElement) {
      // Use the CSS variable that's already set by the theme service
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-color-primary')
        .trim();
      
      if (primaryColor) {
        const segmentEl = this.segmentElement.nativeElement;
        // Check if Android platform
        const isAndroid = document.body.classList.contains('md') || 
                         document.documentElement.classList.contains('md');
        
        if (isAndroid) {
          // For Android: use transparent indicator, background for selected
          segmentEl.style.setProperty('--indicator-color', 'transparent');
        } else {
          // For iOS: use primary color indicator
          segmentEl.style.setProperty('--indicator-color', primaryColor);
        }
        
        // Get text color for unselected buttons
        const textColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--ion-text-color')
          .trim();
        
        // Update all segment buttons
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
            
            // Set background and text color based on checked state
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
            
            // Reset text color for iOS as well
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
    // Generate months list (all 12 months)
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
    
    // Generate years list (current year + 5 previous years)
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
    
    // Get rick ID from auth service
    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();

    if (!rick) {
      console.error('BookingPage: Rick ID not found. Please login again.');
      this.isLoading.set(false);
      return;
    }

    // Prepare request body
    const requestBody = { rick };
    console.log('BookingPage: Making API call to /app/bookings with rick:', rick);

    // Make API call directly from booking page
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
          // Handle both wrapped and direct response formats
          let bookings: Booking[];

          if (Array.isArray(response)) {
            // Direct array response: [...]
            bookings = response;
          } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
            // Wrapped response format: { success: true, data: [...] }
            bookings = response.data;
          } else {
            console.error('Invalid response format from bookings API');
            this.isLoading.set(false);
            return;
          }

          // Ensure all bookings have required fields
          this.allBookings = bookings.map(booking => ({
            id: booking.id,
            date: booking.date,
            time: booking.time || '00:00:00', // Default time if not provided
            status: booking.status,
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            passengerName: booking.passengerName
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
    // Update segment colors after change
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
    
    // Filter by status
    let filtered = this.allBookings.filter(booking => booking.status === status);
    
    // Filter by year if not "all"
    if (yearFilter !== 'all') {
      const year = parseInt(yearFilter);
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate.getFullYear() === year;
      });
    }
    
    // Filter by month if not "all"
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
    
    // Group by month if showing all
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
    
    // Convert to array and sort by date (newest first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });
    
    this.monthGroups.set(sortedGroups);
  }

  formatDate(date: string, time: string): string {
    // Combine date and time for display
    const dateObj = new Date(date);
    const timeParts = time.split(':');
    const hours = timeParts[0] || '00';
    const minutes = timeParts[1] || '00';
    
    // Format date
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
    
    // Format time (12-hour format)
    const hour24 = parseInt(hours);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
    
    return `${formattedDate} at ${formattedTime}`;
  }

  getSelectedMonthLabel(): string {
    const selected = this.selectedMonth();
    if (selected === 'all') {
      return 'Show All';
    }
    if (selected === 'current') {
      const now = new Date();
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    // Find the month label from the months array
    const month = this.months.find(m => m.value === selected);
    return month ? month.label : 'Select Month';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'medium';
    }
  }
}
