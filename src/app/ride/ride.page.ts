import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone, signal } from '@angular/core';
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
import { ToastController } from '@ionic/angular/standalone';
import { ViewDidEnter, ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  locationOutline, 
  flagOutline, 
  personOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  warningOutline,
  closeOutline,
  chevronDownOutline,
  chevronUpOutline,
  listOutline,
  playCircleOutline,
  calendarOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { BookingsService, Booking } from '../services/bookings.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import * as L from 'leaflet';
import { interval, Subscription, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Fix for default marker icon issue in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

@Component({
  selector: 'app-ride',
  templateUrl: 'ride.page.html',
  styleUrls: ['ride.page.scss'],
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
export class RidePage implements OnInit, AfterViewInit, OnDestroy, ViewDidEnter, ViewWillEnter {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  map!: L.Map;
  currentLocation: { lat: number; lng: number } | null = null;
  isOnline = false;
  upcomingRide: Booking | null = null;
  isLoading = true;
  isMapReady = false;
  isLoadingBookings = false;
  isUpdatingStatus = false; // Track if status update API call is in progress
  isRideCardMinimized = signal<boolean>(false); // Track if ride card is minimized
  isRideAccepted = signal<boolean>(false); // Track if ride is accepted (shows Start Ride button)

  // Route animation
  private routePolyline: L.Polyline | null = null;
  private vehicleMarker: L.Marker | null = null;
  private animationInterval: Subscription | null = null;
  private routeCoordinates: L.LatLng[] = [];
  private currentRouteIndex = 0;
  private isAnimating = false;
  private watchId: string | null = null;
  private resizeListener?: () => void;
  private mapInitAttempts = 0;
  private readonly MAX_MAP_INIT_ATTEMPTS = 10;
  private apiUrl = environment.apiUrl;

  constructor(
    private bookingsService: BookingsService,
    private ngZone: NgZone,
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({
      'location-outline': locationOutline,
      'flag-outline': flagOutline,
      'person-outline': personOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'warning-outline': warningOutline,
      'close-outline': closeOutline,
      'chevron-down-outline': chevronDownOutline,
      'chevron-up-outline': chevronUpOutline,
      'list-outline': listOutline,
      'play-circle-outline': playCircleOutline,
      'calendar-outline': calendarOutline
    });
  }

  ngOnInit() {
    // Don't load bookings here - wait for ionViewWillEnter
  }

  ionViewWillEnter() {
    // Get online status from API when navigating to this tab
    this.getOnlineStatus();
    // Load pending bookings when user navigates to this tab
    this.loadUpcomingRide();
  }

  ngAfterViewInit() {
    // Don't initialize map here - wait for ionViewDidEnter
  }

  ionViewDidEnter() {
    // Initialize map when view enters (container should have dimensions by now)
    if (!this.map) {
      this.mapInitAttempts = 0;
      // Wait a bit longer to ensure DOM is fully rendered
      setTimeout(() => {
        // Force container to have dimensions
        if (this.mapContainer?.nativeElement) {
          const container = this.mapContainer.nativeElement;
          const parent = container.parentElement;
          if (parent) {
            const parentRect = parent.getBoundingClientRect();
            if (parentRect.height > 0) {
              container.style.height = `${parentRect.height}px`;
            }
          }
        }
        this.initMap();
      }, 300);
    } else {
      // Resize map if it already exists
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
        // Show route if there's a pending ride (static path)
        if (this.upcomingRide && this.isMapReady) {
          this.showRoute(false); // false = static route, no animation
        }
      }, 100);
    }
  }

  ngOnDestroy() {
    if (this.animationInterval) {
      this.animationInterval.unsubscribe();
    }
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      window.removeEventListener('orientationchange', this.resizeListener);
    }
    if (this.map) {
      this.map.remove();
    }
  }

  async initMap() {
    // Prevent infinite retry loops
    if (this.mapInitAttempts >= this.MAX_MAP_INIT_ATTEMPTS) {
      console.error('Max map initialization attempts reached');
      this.isLoading = false;
      return;
    }

    this.mapInitAttempts++;

    try {
      // Check if ViewChild is available
      if (!this.mapContainer || !this.mapContainer.nativeElement) {
        console.warn(`Map container element not found (attempt ${this.mapInitAttempts}), retrying...`);
        requestAnimationFrame(() => {
          setTimeout(() => this.initMap(), 100);
        });
        return;
      }

      // Ensure container has dimensions first
      const container = this.mapContainer.nativeElement;
      
      // Force layout recalculation
      container.style.display = 'block';
      container.style.width = '100%';
      container.style.height = '100%';
      
      // Get dimensions using multiple methods
      const rect = container.getBoundingClientRect();
      const width = rect.width || container.offsetWidth || container.clientWidth || window.innerWidth;
      const height = rect.height || container.offsetHeight || container.clientHeight || window.innerHeight;
      
      if (!width || !height || width === 0 || height === 0) {
        // If still no dimensions, use viewport dimensions as fallback
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (viewportWidth > 0 && viewportHeight > 0) {
          console.warn(`Using viewport dimensions as fallback: ${viewportWidth}x${viewportHeight}`);
          container.style.width = `${viewportWidth}px`;
          container.style.height = `${viewportHeight}px`;
        } else {
          console.warn(`Map container has no dimensions (${width}x${height}, attempt ${this.mapInitAttempts}), retrying...`);
          requestAnimationFrame(() => {
            setTimeout(() => this.initMap(), 200);
          });
          return;
        }
      }

      // Determine initial map center location - always use UAE-based location
      let initialLocation: { lat: number; lng: number };
      
      // Priority 1: Use pickup location from pending ride if available (from UAE locations)
      if (this.upcomingRide && this.upcomingRide.pickupLocation) {
        initialLocation = this.geocodeLocation(this.upcomingRide.pickupLocation);
        console.log('Using pickup location for map center:', this.upcomingRide.pickupLocation, initialLocation);
      } else {
        // Priority 2: Use UAE default location (Dubai) as base
        // This ensures map is always centered in UAE region
        initialLocation = { lat: 25.2048, lng: 55.2708 }; // Dubai, UAE
        console.log('Using UAE default location (Dubai) for map center:', initialLocation);
        
        // Try to get GPS location in background (for driver's current position marker)
        // But don't use it to center the map - keep it centered on UAE/pickup location
        try {
          const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
          this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('GPS location obtained for driver marker:', this.currentLocation);
        } catch (geoError) {
          console.log('GPS location not available, using UAE default');
          // Don't set currentLocation if GPS fails - it will be set when going online
        }
      }

      // Initialize map centered on initial location
      this.map = L.map(this.mapContainer.nativeElement, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: false
      }).setView([initialLocation.lat, initialLocation.lng], 13);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        tileSize: 256,
        zoomOffset: 0
      }).addTo(this.map);

      // Add current location marker only if we have actual GPS location
      if (this.currentLocation && this.currentLocation.lat !== 25.2048 && this.currentLocation.lng !== 55.2708) {
        L.marker([this.currentLocation.lat, this.currentLocation.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          })
        }).addTo(this.map).bindPopup('Your Location');
      }

      // Invalidate size to ensure map renders correctly
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          this.map.setView([initialLocation.lat, initialLocation.lng], 13);
        }
      }, 100);

      // Add resize listener for orientation changes
      this.resizeListener = () => {
        if (this.map) {
          setTimeout(() => {
            this.map.invalidateSize();
          }, 100);
        }
      };
      window.addEventListener('resize', this.resizeListener);
      window.addEventListener('orientationchange', this.resizeListener);

      this.isMapReady = true;
      this.isLoading = false;

      // Show route if there's a pending ride (static path, no animation)
      // Animation will start only when online AND accepted
      if (this.upcomingRide) {
        setTimeout(() => {
          this.showRoute(false); // false = static route, no animation
        }, 100);
      }

      // Watch position if online
      if (this.isOnline) {
        this.watchPosition();
        // If ride is accepted and online, start animation
        // Route will be shown when ride is loaded, not on map init
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      
      // Ensure container has dimensions before fallback
      const container = this.mapContainer.nativeElement;
      if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn(`Map container has no dimensions in fallback (attempt ${this.mapInitAttempts}), retrying...`);
        requestAnimationFrame(() => {
          setTimeout(() => this.initMap(), 100);
        });
        return;
      }

      // Fallback to default location (UAE - Dubai)
      this.currentLocation = { lat: 25.2048, lng: 55.2708 }; // Dubai, UAE default

      if (!this.currentLocation) {
        console.error('Current location is not available');
        this.isLoading = false;
        return;
      }

      this.map = L.map(this.mapContainer.nativeElement, {
        zoomControl: true,
        attributionControl: true
      }).setView([this.currentLocation.lat, this.currentLocation.lng], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);
      
      // Invalidate size for fallback map too
      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);
      
      this.isMapReady = true;
      
      // Show route if there's a pending ride (static path, no animation)
      if (this.upcomingRide) {
        setTimeout(() => {
          this.showRoute(false); // false = static route, no animation
        }, 100);
      }
      this.isLoading = false;
    }
  }

  async watchPosition() {
    if (!this.isOnline) return;

    // Clear existing watch if any
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position, err) => {
          if (err) {
            console.error('Watch position error:', err);
            return;
          }
          if (position) {
            this.ngZone.run(() => {
              this.currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              // Update vehicle marker if animating
              if (this.isAnimating && this.vehicleMarker && this.currentLocation && this.map) {
                this.vehicleMarker.setLatLng([this.currentLocation.lat, this.currentLocation.lng]);
                this.map.setView([this.currentLocation.lat, this.currentLocation.lng], this.map.getZoom());
              }
            });
          }
        }
      );
    } catch (error) {
      console.error('Error watching position:', error);
    }
  }

  loadUpcomingRide() {
    console.log('RidePage: loadUpcomingRide() called - fetching pending bookings');
    this.isLoadingBookings = true;
    
    // Get rick ID from auth service
    const currentUser = this.authService.getCurrentUserValue();
    const rick = currentUser?.rick || this.authService.getStoredRick();

    if (!rick) {
      console.error('RidePage: Rick ID not found. Please login again.');
      this.isLoadingBookings = false;
      this.upcomingRide = null;
      return;
    }

    // Prepare request body
    const requestBody = { rick };
    console.log('RidePage: Making API call to /app/bookings with rick:', rick);

    // Make API call to get pending bookings
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
          
          console.error('RidePage: Bookings API Error:', errorMessage);
          this.isLoadingBookings = false;
          this.upcomingRide = null;
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('RidePage: API response received', response);
          
          // Handle both wrapped and direct response formats
          let bookings: Booking[];

          if (Array.isArray(response)) {
            // Direct array response: [...]
            bookings = response;
          } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
            // Wrapped response format: { success: true, data: [...] }
            bookings = response.data;
          } else {
            console.error('RidePage: Invalid response format from bookings API');
            this.isLoadingBookings = false;
            this.upcomingRide = null;
            return;
          }

          // Filter for pending bookings only
          const pendingBookings = bookings.filter(booking => booking.status === 'pending');
          
          // Sort by date and time (earliest first)
          pendingBookings.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
            const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
            return dateA - dateB;
          });

          if (pendingBookings.length > 0) {
            // Get the earliest pending ride
            this.upcomingRide = {
              id: pendingBookings[0].id,
              date: pendingBookings[0].date,
              time: pendingBookings[0].time || '00:00:00',
              status: pendingBookings[0].status,
              pickupLocation: pendingBookings[0].pickupLocation,
              dropoffLocation: pendingBookings[0].dropoffLocation,
              passengerName: pendingBookings[0].passengerName
            };
            
            // Reset accepted status for new ride
            this.isRideAccepted.set(false);
            console.log('RidePage: Found pending ride:', this.upcomingRide);
            
            // Center map on pickup location and show route
            if (this.isMapReady) {
              const pickupCoords = this.geocodeLocation(this.upcomingRide.pickupLocation);
              this.map.setView([pickupCoords.lat, pickupCoords.lng], 13);
              this.showRoute(false); // false = don't animate yet
            } else if (this.map) {
              // If map exists but not ready, wait a bit and try again
              setTimeout(() => {
                if (this.map && this.upcomingRide) {
                  const pickupCoords = this.geocodeLocation(this.upcomingRide.pickupLocation);
                  this.map.setView([pickupCoords.lat, pickupCoords.lng], 13);
                  this.showRoute(false);
                }
              }, 500);
            }
          } else {
            console.log('RidePage: No pending bookings found');
            this.upcomingRide = null;
            this.isRideAccepted.set(false);
          }
          
          this.isLoadingBookings = false;
        },
        error: (error) => {
          console.error('RidePage: Failed to load pending bookings:', error);
          this.isLoadingBookings = false;
          this.upcomingRide = null;
        }
      });
  }

  getOnlineStatus() {
    // Get driver ID from localStorage (saved on login)
    const driverId = this.authService.getStoredDriverId();
    
    if (!driverId) {
      console.error('RidePage: Driver ID not found. Cannot fetch online status.');
      return;
    }
    
    // Prepare request body
    const requestBody = {
      id: driverId
    };
    
    console.log('Fetching driver online status:', requestBody);
    
    // Call API to get online status
    this.http.post<{ success: boolean; data: { id: number; online: boolean }; message: string }>(`${this.apiUrl}/app/drivers/get-online-status`, requestBody)
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'Failed to get online status';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
          } else {
            const apiError = error.error as { message?: string };
            errorMessage = apiError?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
          }
          
          console.error('RidePage: Get online status API Error:', errorMessage);
          // Don't show alert for this - just log the error and use default offline status
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('RidePage: Online status received', response);
          
          // Update local status based on API response
          // Response format: { success: true, data: { id: number, online: boolean }, message: string }
          let onlineStatus = false;
          
          if (response && response.success && response.data && typeof response.data.online === 'boolean') {
            onlineStatus = response.data.online;
          } else {
            console.warn('RidePage: Unexpected response format for online status', response);
          }
          
          this.isOnline = onlineStatus;
          console.log('RidePage: Updated online status to:', this.isOnline);
          
          // Start/stop position watching based on status
          if (this.isOnline) {
            this.watchPosition();
          } else {
            if (this.watchId) {
              Geolocation.clearWatch({ id: this.watchId });
              this.watchId = null;
            }
            this.stopAnimation();
            if (this.vehicleMarker) {
              this.map?.removeLayer(this.vehicleMarker);
              this.vehicleMarker = null;
            }
          }
        },
        error: (error) => {
          console.error('RidePage: Failed to get online status:', error);
          // Default to offline if API call fails
          this.isOnline = false;
        }
      });
  }

  toggleOnlineStatus() {
    // Toggle online/offline status
    const newOnlineStatus = !this.isOnline;
    
    // Get driver ID from localStorage (saved on login)
    const driverId = this.authService.getStoredDriverId();
    
    if (!driverId) {
      console.error('RidePage: Driver ID not found. Please login again.');
      alert('Driver ID not found. Please login again.');
      return;
    }
    
    // Prepare request body
    const requestBody = {
      id: driverId,
      online: newOnlineStatus
    };
    
    console.log('Updating driver online status:', requestBody);
    
    // Call API to update online status
    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/drivers/update-online`, requestBody)
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'Failed to update online status';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
          } else {
            const apiError = error.error as { message?: string };
            errorMessage = apiError?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
          }
          
          console.error('RidePage: Update online status API Error:', errorMessage);
          alert(`Failed to update online status: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('RidePage: Online status updated successfully', response);
          
          // Update local status only after successful API call
          this.isOnline = newOnlineStatus;
          
          if (this.isOnline) {
            // Start watching position when going online
            this.watchPosition();
          } else {
            // Stop watching position when going offline
            if (this.watchId) {
              Geolocation.clearWatch({ id: this.watchId });
              this.watchId = null;
            }
            // Stop any animation
            this.stopAnimation();
            // Remove vehicle marker if exists
            if (this.vehicleMarker) {
              this.map?.removeLayer(this.vehicleMarker);
              this.vehicleMarker = null;
            }
          }
        },
        error: (error) => {
          console.error('RidePage: Failed to update online status:', error);
          // Don't update local status if API call failed
          // Error already handled in catchError
        }
      });
  }

  async showRoute(animate: boolean = false) {
    if (!this.upcomingRide || !this.map) return;

    // Get pickup and dropoff coordinates from UAE locations database
    const pickupCoords = this.geocodeLocation(this.upcomingRide.pickupLocation);
    const dropoffCoords = this.geocodeLocation(this.upcomingRide.dropoffLocation);
    
    console.log('Showing route from pickup:', this.upcomingRide.pickupLocation, pickupCoords);
    console.log('To dropoff:', this.upcomingRide.dropoffLocation, dropoffCoords);
    
    // Always center map on pickup location (UAE-based)
    this.map.setView([pickupCoords.lat, pickupCoords.lng], 13);

    // Get current location or use pickup location as start for route display
    let startLocation = this.currentLocation;
    if (!startLocation || !this.isOnline) {
      // If offline or no GPS location, use a point near pickup for route visualization
      startLocation = { lat: pickupCoords.lat - 0.005, lng: pickupCoords.lng - 0.005 };
    }

    // Generate route coordinates (simulated route from start location to pickup, then to dropoff)
    // In a real app, you would use a routing service like OSRM or Google Directions API

    // Create route from start location to pickup, then to dropoff
    this.routeCoordinates = [
      L.latLng(startLocation.lat, startLocation.lng),
      ...this.generateRoutePoints(
        startLocation,
        pickupCoords
      ),
      L.latLng(pickupCoords.lat, pickupCoords.lng),
      ...this.generateRoutePoints(
        pickupCoords,
        dropoffCoords
      ),
      L.latLng(dropoffCoords.lat, dropoffCoords.lng)
    ];

    // Clear existing route
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }

    // Draw route polyline
    this.routePolyline = L.polyline(this.routeCoordinates, {
      color: '#3880ff',
      weight: 5,
      opacity: 0.7
    }).addTo(this.map);

    // Clear existing markers (if any) and add new ones
    // Note: In a real app, you'd want to track markers to remove them properly
    // For now, we'll just add new markers
    L.marker([pickupCoords.lat, pickupCoords.lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })
    }).addTo(this.map).bindPopup(`Pickup: ${this.upcomingRide.pickupLocation}`);

    L.marker([dropoffCoords.lat, dropoffCoords.lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })
    }).addTo(this.map).bindPopup(`Dropoff: ${this.upcomingRide.dropoffLocation}`);

    // Fit map to show entire route
    const bounds = L.latLngBounds(this.routeCoordinates);
    this.map.fitBounds(bounds, { padding: [50, 50] });

    // Start vehicle animation only if animate is true (when Start Ride is clicked)
    if (animate && this.isOnline) {
      this.startVehicleAnimation();
    } else {
      // Stop any existing animation
      this.stopAnimation();
    }
  }

  generateRoutePoints(start: { lat: number; lng: number }, end: { lat: number; lng: number }): L.LatLng[] {
    const points: L.LatLng[] = [];
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const ratio = i / steps;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      points.push(L.latLng(lat, lng));
    }
    return points;
  }

  startVehicleAnimation() {
    if (this.isAnimating || this.routeCoordinates.length === 0) return;

    this.stopAnimation();
    this.isAnimating = true;
    this.currentRouteIndex = 0;

    // Create vehicle marker with custom icon
    const vehicleIcon = L.divIcon({
      className: 'vehicle-marker',
      html: '<div class="vehicle-icon">🚗</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.vehicleMarker = L.marker(this.routeCoordinates[0], { icon: vehicleIcon }).addTo(this.map);

    // Animate along route
    this.animationInterval = interval(200).subscribe(() => {
      if (this.currentRouteIndex < this.routeCoordinates.length - 1) {
        this.currentRouteIndex++;
        const nextPoint = this.routeCoordinates[this.currentRouteIndex];
        if (this.vehicleMarker) {
          this.vehicleMarker.setLatLng(nextPoint);
          // Smoothly pan map to follow vehicle
          this.map.panTo(nextPoint, { animate: true, duration: 0.2 });
        }
      } else {
        // Reached destination, restart animation
        this.currentRouteIndex = 0;
      }
    });
  }

  stopAnimation() {
    if (this.animationInterval) {
      this.animationInterval.unsubscribe();
      this.animationInterval = null;
    }
    this.isAnimating = false;
  }

  geocodeLocation(locationName: string): { lat: number; lng: number } {
    // UAE location coordinates database (common locations)
    // In a real app, use a proper geocoding service like Google Maps Geocoding API
    const uaeLocations: { [key: string]: { lat: number; lng: number } } = {
      // Dubai locations
      'dubai': { lat: 25.2048, lng: 55.2708 },
      'burj khalifa': { lat: 25.1972, lng: 55.2744 },
      'dubai mall': { lat: 25.1984, lng: 55.2794 },
      'dubai marina': { lat: 25.0767, lng: 55.1394 },
      'jbr': { lat: 25.0767, lng: 55.1394 },
      'jumeirah': { lat: 25.2048, lng: 55.2708 },
      'business bay': { lat: 25.1867, lng: 55.2633 },
      'downtown dubai': { lat: 25.1972, lng: 55.2744 },
      'deira': { lat: 25.2667, lng: 55.3000 },
      'bur dubai': { lat: 25.2500, lng: 55.3000 },
      'al barsha': { lat: 25.1167, lng: 55.2000 },
      'jlt': { lat: 25.0667, lng: 55.1500 },
      'internet city': { lat: 25.0833, lng: 55.1667 },
      'media city': { lat: 25.0833, lng: 55.1667 },
      
      // Abu Dhabi locations
      'abu dhabi': { lat: 24.4539, lng: 54.3773 },
      'corniche': { lat: 24.4833, lng: 54.3500 },
      'yas island': { lat: 24.5333, lng: 54.6000 },
      'saadiyat island': { lat: 24.5333, lng: 54.4167 },
      
      // Sharjah locations
      'sharjah': { lat: 25.3573, lng: 55.4033 },
      
      // Ajman locations
      'ajman': { lat: 25.4054, lng: 55.5136 },
      
      // Ras Al Khaimah locations
      'ras al khaimah': { lat: 25.7889, lng: 55.9597 },
      
      // Airport locations
      'dubai airport': { lat: 25.2532, lng: 55.3657 },
      'dxb': { lat: 25.2532, lng: 55.3657 },
      'abu dhabi airport': { lat: 24.4330, lng: 54.6511 },
      'auh': { lat: 24.4330, lng: 54.6511 },
    };
    
    // Normalize location name for lookup
    const normalizedName = locationName.toLowerCase().trim();
    
    // Try exact match first
    if (uaeLocations[normalizedName]) {
      return uaeLocations[normalizedName];
    }
    
    // Try partial match
    for (const [key, coords] of Object.entries(uaeLocations)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return coords;
      }
    }
    
    // If no match found, use hash-based generation around Dubai center
    const baseLat = 25.2048; // Dubai center
    const baseLng = 55.2708;
    
    // Generate coordinates based on location name hash
    const hash = locationName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Use smaller offset for UAE (within ~10km radius)
    const latOffset = ((hash % 200) - 100) / 1000; // -0.1 to +0.1 degrees (~11km)
    const lngOffset = (((hash * 7) % 200) - 100) / 1000;
    
    return {
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset
    };
  }

  async acceptRide() {
    if (!this.upcomingRide || this.isUpdatingStatus) return;

    // Check if driver is online
    if (!this.isOnline) {
      await this.showOfflineToast('Please go online to accept rides. Tap the online toggle button.');
      return;
    }

    const bookingId = this.upcomingRide.id;
    const status = 'in-progress';
    
    console.log('Accepting ride:', bookingId);
    this.isUpdatingStatus = true;
    
    // Prepare request body
    const requestBody = {
      bookingId: bookingId,
      status: status
    };

    // Call API to update booking status
    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, requestBody)
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'Failed to accept ride';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
          } else {
            const apiError = error.error as { message?: string };
            errorMessage = apiError?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
          }
          
          console.error('RidePage: Accept ride API Error:', errorMessage);
          this.isUpdatingStatus = false;
          alert(`Failed to accept ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('RidePage: Ride accepted successfully', response);
          this.isUpdatingStatus = false;
          
          // Mark ride as accepted - this will show the "Start Ride" button
          this.isRideAccepted.set(true);
          
          // Keep the ride card visible but show Start Ride button instead of Accept/Reject
          // Don't hide the card or clear the route - just change the button
        },
        error: (error) => {
          console.error('RidePage: Failed to accept ride:', error);
          this.isUpdatingStatus = false;
          // Error already handled in catchError, but keep this for additional handling if needed
        }
      });
  }

  toggleRideCardMinimize() {
    // Toggle minimize/expand state of the ride card
    this.isRideCardMinimized.set(!this.isRideCardMinimized());
  }

  showAllRides() {
    // Navigate to booking page and show all pending rides
    this.router.navigate(['/tabs/bookings'], {
      queryParams: { segment: 'pending' }
    });
  }

  startRide() {
    if (!this.upcomingRide || !this.isOnline) {
      if (!this.isOnline) {
        alert('Please go online to start the ride.');
      }
      return;
    }

    console.log('Starting ride:', this.upcomingRide.id);
    
    // Show route with animation
    if (this.isMapReady && this.map) {
      this.showRoute(true); // true = show animation
    }
    
    // Hide the ride card after starting (or you can keep it visible with ride details)
    // For now, let's keep it visible but you can change this behavior
  }

  rejectRide() {
    if (!this.upcomingRide || this.isUpdatingStatus) return;

    // Check if driver is online
    if (!this.isOnline) {
      alert('Please enable online status to reject rides. Tap the online toggle button to go online.');
      return;
    }

    const bookingId = this.upcomingRide.id;
    const status = 'cancelled';
    
    console.log('Rejecting ride:', bookingId);
    this.isUpdatingStatus = true;
    
    // Prepare request body
    const requestBody = {
      bookingId: bookingId,
      status: status
    };

    // Call API to update booking status
    this.http.post<{ success?: boolean; message?: string }>(`${this.apiUrl}/app/bookings/update-status`, requestBody)
      .pipe(
        catchError((error: HttpErrorResponse | Error) => {
          let errorMessage = 'Failed to reject ride';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
          } else {
            const apiError = error.error as { message?: string };
            errorMessage = apiError?.message || error.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
          }
          
          console.error('RidePage: Reject ride API Error:', errorMessage);
          this.isUpdatingStatus = false;
          alert(`Failed to reject ride: ${errorMessage}`);
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: (response) => {
          console.log('RidePage: Ride rejected successfully', response);
          this.isUpdatingStatus = false;
          
          // Clear current ride from UI
          const rejectedRideId = this.upcomingRide?.id;
          this.upcomingRide = null;
          this.stopAnimation();
          if (this.routePolyline) {
            this.map?.removeLayer(this.routePolyline);
            this.routePolyline = null;
          }
          if (this.vehicleMarker) {
            this.map?.removeLayer(this.vehicleMarker);
            this.vehicleMarker = null;
          }
          
          // Load next pending ride after a short delay to ensure backend has processed the rejection
          setTimeout(() => {
            console.log('RidePage: Loading next pending ride after rejection');
            this.loadUpcomingRide();
          }, 300);
        },
        error: (error) => {
          console.error('RidePage: Failed to reject ride:', error);
          this.isUpdatingStatus = false;
          // Error already handled in catchError, but keep this for additional handling if needed
        }
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
    // Combine date and time for display
    // Handle date string - could be "YYYY-MM-DD" format
    const dateObj = new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date:', date);
      return 'Invalid Date';
    }
    
    // Parse time parts
    const timeParts = (time || '00:00:00').split(':');
    const hours = timeParts[0] || '00';
    const minutes = timeParts[1] || '00';
    
    // Set time on the date object
    dateObj.setHours(parseInt(hours, 10));
    dateObj.setMinutes(parseInt(minutes, 10));
    dateObj.setSeconds(0);
    dateObj.setMilliseconds(0);
    
    // Format date
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
    
    // Format time (12-hour format)
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
    
    return `${formattedDate} at ${formattedTime}`;
  }
}
