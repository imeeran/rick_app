import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  IonIcon,
  IonButton,
  IonBadge
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { DashboardService, DashboardData } from '../services/dashboard.service';
import { ThemeService } from '../services/theme.service';
import { NotificationsService } from '../services/notifications.service';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { notifications } from 'ionicons/icons';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  imports: [
    CommonModule,
    IonContent, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonIcon,
    IonButton,
    IonBadge
  ],
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter {
  @ViewChild('ridesChartCanvas', { static: false }) ridesChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('assignedOrdersChartCanvas', { static: false }) assignedOrdersChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  dashboardData: DashboardData | null = null;
  isLoading = true;
  loadError: string | null = null;
  unreadCount = signal<number>(0);
  
  private ridesChart: Chart | null = null;
  private assignedOrdersChart: Chart | null = null;
  private chartCreationAttempts = 0;
  private readonly MAX_CHART_ATTEMPTS = 10;
  private isDestroyed = false;
  private themeSubscription?: Subscription;
  private notificationsSubscription?: Subscription;

  constructor(
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private notificationsService: NotificationsService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ notifications });
  }

  ngOnInit() {
    // Subscribe to theme changes to update chart colors
    this.themeSubscription = this.themeService.currentTheme$.subscribe(() => {
      // Wait a bit for theme to be applied to DOM
      setTimeout(() => {
        if (this.dashboardData && !this.isDestroyed && (this.ridesChart || this.assignedOrdersChart)) {
          this.updateChartColors();
        }
      }, 150);
    });
    
    // Subscribe to notifications to update unread count
    this.notificationsSubscription = this.notificationsService.getNotifications().subscribe(() => {
      this.unreadCount.set(this.notificationsService.getUnreadCount());
    });
  }

  ionViewWillEnter() {
    this.loadDashboardData();
    // Update chart colors when returning to this tab (in case theme changed while away)
    if (this.dashboardData && (this.ridesChart || this.assignedOrdersChart)) {
      setTimeout(() => {
        this.updateChartColors();
      }, 100);
    }
  }

  ngAfterViewInit() {
    // Charts will be created after data is loaded
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.ridesChart) {
      this.ridesChart.destroy();
      this.ridesChart = null;
    }
    if (this.assignedOrdersChart) {
      this.assignedOrdersChart.destroy();
      this.assignedOrdersChart = null;
    }
  }

  openNotifications() {
    this.router.navigate(['/tabs/notification']);
  }

  /** Navigate to Bookings with the segment / filters that match each dashboard stat */
  goToStatCard(
    kind: 'completed' | 'cancelled' | 'assignedMonth' | 'assignedToday'
  ): void {
    if (kind === 'completed') {
      this.router.navigate(['/tabs/bookings'], { queryParams: { segment: 'completed' } });
      return;
    }
    if (kind === 'cancelled') {
      this.router.navigate(['/tabs/bookings'], { queryParams: { segment: 'cancelled' } });
      return;
    }
    if (kind === 'assignedMonth') {
      this.router.navigate(['/tabs/bookings'], {
        queryParams: { segment: 'pending', scope: 'currentMonth' }
      });
      return;
    }
    this.router.navigate(['/tabs/bookings'], {
      queryParams: { segment: 'pending', scope: 'today' }
    });
  }

  loadDashboardData() {
    this.isLoading = true;
    this.loadError = null;
    this.chartCreationAttempts = 0; // Reset attempts
    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.isLoading = false;
        this.loadError = null;
        this.cdr.markForCheck();
        // Let Angular's change detection handle the view update naturally
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                if (!this.isDestroyed) {
                  this.createCharts();
                }
              }, 400);
            });
          });
        });
      },
      error: (err: Error) => {
        this.isLoading = false;
        this.dashboardData = null;
        this.loadError = err?.message || 'Could not load dashboard.';
        if (this.ridesChart) {
          this.ridesChart.destroy();
          this.ridesChart = null;
        }
        if (this.assignedOrdersChart) {
          this.assignedOrdersChart.destroy();
          this.assignedOrdersChart = null;
        }
        this.cdr.markForCheck();
      }
    });
  }

  private getThemeColor(cssVariable: string): string {
    if (typeof window !== 'undefined' && document?.documentElement) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(cssVariable)
        .trim() || '#000000';
    }
    return '#000000';
  }

  private getThemeTextColor(): string {
    return this.getThemeColor('--ion-text-color');
  }

  private getThemeBackgroundColor(): string {
    return this.getThemeColor('--ion-background-color');
  }

  private isDarkTheme(): boolean {
    const bgColor = this.getThemeBackgroundColor();
    // Simple check: if background is dark, theme is dark
    if (bgColor.startsWith('rgb')) {
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        return brightness < 128;
      }
    }
    // Check hex color
    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = (r + g + b) / 3;
      return brightness < 128;
    }
    return document.body.classList.contains('dark');
  }

  createCharts() {
    if (!this.dashboardData || this.isDestroyed) return;
    
    // Prevent infinite retries
    if (this.chartCreationAttempts >= this.MAX_CHART_ATTEMPTS) {
      console.warn('Max chart creation attempts reached');
      return;
    }
    
    this.chartCreationAttempts++;

    try {
      // Get theme colors
      const textColor = this.getThemeTextColor();
      const isDark = this.isDarkTheme();
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';
      const tooltipTextColor = isDark ? '#ffffff' : '#ffffff';

      // Create Rides Chart
      if (this.ridesChartCanvas?.nativeElement) {
        const canvas = this.ridesChartCanvas.nativeElement;
        // Check if canvas is actually in the DOM and has dimensions
        const parent = canvas.parentElement;
        if (!parent || (canvas.offsetWidth === 0 && canvas.offsetHeight === 0)) {
          // Retry after a short delay if canvas isn't ready
          if (this.chartCreationAttempts < this.MAX_CHART_ATTEMPTS && !this.isDestroyed) {
            setTimeout(() => this.createCharts(), 150);
          }
          return;
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx && !this.isDestroyed) {
          if (this.ridesChart) {
            this.ridesChart.destroy();
          }
          
          this.ridesChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Completed', 'Cancelled'],
            datasets: [{
              label: 'Rides',
              data: [
                this.dashboardData.currentMonthCompletedRides,
                this.dashboardData.currentMonthCancelledRides
              ],
              backgroundColor: [
                'rgba(46, 204, 113, 0.8)',
                'rgba(231, 76, 60, 0.8)'
              ],
              borderColor: [
                'rgba(46, 204, 113, 1)',
                'rgba(231, 76, 60, 1)'
              ],
              borderWidth: 2,
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: tooltipBg,
                padding: 12,
                titleColor: tooltipTextColor,
                bodyColor: tooltipTextColor,
                titleFont: {
                  size: 14,
                  weight: 'bold'
                },
                bodyFont: {
                  size: 13
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  color: textColor
                },
                grid: {
                  color: gridColor
                }
              },
              x: {
                ticks: {
                  color: textColor
                },
                grid: {
                  display: false
                }
              }
            }
          }
        });
        }
      }

      // Create Assigned Orders Chart
      if (this.assignedOrdersChartCanvas?.nativeElement) {
        const canvas = this.assignedOrdersChartCanvas.nativeElement;
        // Check if canvas is actually in the DOM and has dimensions
        const parent = canvas.parentElement;
        if (!parent || (canvas.offsetWidth === 0 && canvas.offsetHeight === 0)) {
          // Retry after a short delay if canvas isn't ready
          if (this.chartCreationAttempts < this.MAX_CHART_ATTEMPTS && !this.isDestroyed) {
            setTimeout(() => this.createCharts(), 150);
          }
          return;
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx && !this.isDestroyed) {
          if (this.assignedOrdersChart) {
            this.assignedOrdersChart.destroy();
          }
          
          this.assignedOrdersChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Current Month', 'Today'],
            datasets: [{
              label: 'Assigned Orders',
              data: [
                this.dashboardData.currentMonthAssignedOrders,
                this.dashboardData.todayAssignedOrders
              ],
              backgroundColor: [
                'rgba(52, 152, 219, 0.8)',
                'rgba(155, 89, 182, 0.8)'
              ],
              borderColor: [
                'rgba(52, 152, 219, 1)',
                'rgba(155, 89, 182, 1)'
              ],
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: textColor,
                  padding: 15,
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                backgroundColor: tooltipBg,
                padding: 12,
                titleColor: tooltipTextColor,
                bodyColor: tooltipTextColor,
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    return `${label}: ${value} order${value !== 1 ? 's' : ''}`;
                  }
                }
              }
            }
          }
        });
        }
      }
    } catch (error) {
      console.error('Error creating charts:', error);
      // Don't retry on error, just log it
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getCurrentMonthYear(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  updateChartColors() {
    if (this.isDestroyed || (!this.ridesChart && !this.assignedOrdersChart)) return;

    // Get updated theme colors
    const textColor = this.getThemeTextColor();
    const isDark = this.isDarkTheme();
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';
    const tooltipTextColor = isDark ? '#ffffff' : '#ffffff';

    // Update Rides Chart
    if (this.ridesChart && this.ridesChart.options && this.ridesChart.options.scales) {
      const scales = this.ridesChart.options.scales;
      if (scales['y'] && scales['y'].ticks) {
        scales['y'].ticks.color = textColor;
      }
      if (scales['x'] && scales['x'].ticks) {
        scales['x'].ticks.color = textColor;
      }
      if (scales['y'] && scales['y'].grid) {
        scales['y'].grid.color = gridColor;
      }
      if (this.ridesChart.options.plugins && this.ridesChart.options.plugins.tooltip) {
        this.ridesChart.options.plugins.tooltip.backgroundColor = tooltipBg;
        this.ridesChart.options.plugins.tooltip.titleColor = tooltipTextColor;
        this.ridesChart.options.plugins.tooltip.bodyColor = tooltipTextColor;
      }
      this.ridesChart.update('none'); // Update without animation
    }

    // Update Assigned Orders Chart
    if (this.assignedOrdersChart && this.assignedOrdersChart.options && this.assignedOrdersChart.options.plugins) {
      const plugins = this.assignedOrdersChart.options.plugins;
      if (plugins.legend && plugins.legend.labels) {
        plugins.legend.labels.color = textColor;
      }
      if (plugins.tooltip) {
        plugins.tooltip.backgroundColor = tooltipBg;
        plugins.tooltip.titleColor = tooltipTextColor;
        plugins.tooltip.bodyColor = tooltipTextColor;
      }
      this.assignedOrdersChart.update('none'); // Update without animation
    }
  }
}
