import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type NotificationType = 'order_assigned' | 'order_completed' | 'payslip_generated';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  orderId?: string;
  payslipMonth?: string;
  payslipYear?: number;
  amount?: number;
  pickupDate?: string;
  pickupTime?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
}

export interface NotificationsApiResponse {
  success?: boolean;
  message?: string;
  data?: { notifications?: Notification[] };
  notifications?: Notification[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private notifications: Notification[] = [];
  private apiUrl = environment.apiUrl;

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.fetchNotifications();
    this.setupOneSignalListeners();
  }

  /**
   * Fetch notifications from API and update local state
   */
  fetchNotifications(): void {
    const rick = this.authService.getCurrentUserValue()?.rick || this.authService.getStoredRick();
    if (!rick) {
      this.notifications = [];
      this.notificationsSubject.next([]);
      return;
    }
    this.http.post<NotificationsApiResponse>(`${this.apiUrl}/app/notifications`, { rick })
      .pipe(
        map(response => this.mapApiResponseToNotifications(response)),
        catchError((err: HttpErrorResponse) => {
          console.error('Fetch notifications API error:', err);
          this.notifications = [];
          this.notificationsSubject.next([]);
          return of([]);
        })
      )
      .subscribe(notifications => {
        this.notifications = notifications;
        this.notificationsSubject.next([...this.notifications]);
      });
  }

  /**
   * Map API response to Notification array
   */
  private mapApiResponseToNotifications(response: NotificationsApiResponse): Notification[] {
    let list: any[] = [];
    if (response.data?.notifications) {
      list = response.data.notifications;
    } else if (Array.isArray(response.notifications)) {
      list = response.notifications;
    }
    return list.map((n: any) => {
      const ts = n.timestamp ?? n.created_at ?? n.createdAt;
      return {
        id: n.id,
        type: n.type || 'order_assigned',
        title: n.title || 'Notification',
        message: n.message || '',
        timestamp: ts ? new Date(ts) : new Date(),
        read: !!n.read,
        orderId: n.orderId ?? n.order_id,
        payslipMonth: n.payslipMonth ?? n.payslip_month,
        payslipYear: n.payslipYear ?? n.payslip_year,
        amount: n.amount,
        pickupDate: n.pickupDate ?? n.pickup_date,
        pickupTime: n.pickupTime ?? n.pickup_time,
        pickupAddress: n.pickup ?? n.pickupAddress ?? n.pickup_address ?? n.pickup_location ?? n.pickupLocation,
        dropoffAddress: n.dropoff ?? n.dropoffAddress ?? n.dropoff_address ?? n.dropoff_location ?? n.dropoffLocation
      };
    });
  }

  /**
   * Get all notifications
   */
  getNotifications(): Observable<Notification[]> {
    return this.notifications$;
  }

  /**
   * Get unread notifications count
   */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Add a new notification (e.g. from OneSignal push)
   */
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.notifications.unshift(newNotification);
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Mark notification as read (local + API)
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notificationsSubject.next([...this.notifications]);
      this.markAsReadApi(notificationId);
    }
  }

  /**
   * Call backend API to mark notification as read
   */
  private markAsReadApi(notificationId: string): void {
    const rick = this.authService.getCurrentUserValue()?.rick || this.authService.getStoredRick();
    if (!rick) {
      console.warn('Rick ID not found, skipping mark-read API call');
      return;
    }
    this.http.post(`${this.apiUrl}/app/notifications/mark-read`, {
      rick,
      notification_id: notificationId
    }).subscribe({
      next: () => {},
      error: (err) => console.error('Mark read API error:', err)
    });
  }

  /**
   * Mark all notifications as read (local + API)
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.notificationsSubject.next([...this.notifications]);
    this.markAllAsReadApi();
  }

  /**
   * Call backend API to mark all notifications as read
   */
  private markAllAsReadApi(): void {
    const rick = this.authService.getCurrentUserValue()?.rick || this.authService.getStoredRick();
    if (!rick) {
      console.warn('Rick ID not found, skipping mark-all-read API call');
      return;
    }
    this.http.post(`${this.apiUrl}/app/notifications/mark-read`, {
      rick,
      mark_all: true
    }).subscribe({
      next: () => {},
      error: (err) => console.error('Mark all read API error:', err)
    });
  }

  /**
   * Clear all notifications (local + API)
   */
  clearAll(): void {
    this.notifications = [];
    this.notificationsSubject.next([]);
    this.deleteNotificationsApi({ clear_all: true }, () => this.fetchNotifications());
  }

  /**
   * Clear all read notifications (local + API)
   */
  clearRead(): void {
    this.notifications = this.notifications.filter(n => !n.read);
    this.notificationsSubject.next([...this.notifications]);
    this.deleteNotificationsApi({ clear_read: true }, () => this.fetchNotifications());
  }

  /**
   * Call backend API to delete notifications (clear all or clear read)
   */
  private deleteNotificationsApi(
    body: { clear_all?: boolean; clear_read?: boolean },
    onSuccess?: () => void
  ): void {
    const rick = this.authService.getCurrentUserValue()?.rick || this.authService.getStoredRick();
    if (!rick) {
      console.warn('Rick ID not found, skipping delete notifications API call');
      return;
    }
    this.http.post(`${this.apiUrl}/app/notifications/delete`, {
      rick,
      ...body
    }).subscribe({
      next: () => onSuccess?.(),
      error: (err) => {
        console.error('Delete notifications API error:', err);
        onSuccess?.(); // Refresh anyway to sync state
      }
    });
  }

  /**
   * Generate unique ID for notifications (used when adding from OneSignal push)
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up OneSignal notification listeners
   */
  private setupOneSignalListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for OneSignal notifications received
    window.addEventListener('onesignal-notification-received', (event: any) => {
      const { notification, data } = event.detail;
      this.handleOneSignalNotification(notification, data);
    });

    // Listen for OneSignal notifications opened (user tapped)
    window.addEventListener('onesignal-notification-opened', (event: any) => {
      const { notification, data } = event.detail;
      this.handleOneSignalNotification(notification, data, true);
    });
  }

  /**
   * Handle OneSignal notification and convert it to app notification format
   */
  private handleOneSignalNotification(notification: any, data: any, opened: boolean = false): void {
    try {
      // Extract notification details
      const title = notification.title || data.title || 'Notification';
      const message = notification.body || data.message || data.body || '';
      
      // Determine notification type from data
      let type: NotificationType = 'order_assigned'; // default
      if (data.type) {
        type = data.type as NotificationType;
      } else if (data.orderId) {
        type = data.orderCompleted ? 'order_completed' : 'order_assigned';
      } else if (data.payslipMonth || data.payslipYear) {
        type = 'payslip_generated';
      }

      // Create notification object
      const notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
        type,
        title,
        message,
        orderId: data.orderId ?? data.order_id,
        payslipMonth: data.payslipMonth ?? data.payslip_month,
        payslipYear: data.payslipYear ?? data.payslip_year,
        amount: data.amount,
        pickupDate: data.pickupDate ?? data.pickup_date,
        pickupTime: data.pickupTime ?? data.pickup_time,
        pickupAddress: data.pickup ?? data.pickupAddress ?? data.pickup_address ?? data.pickup_location,
        dropoffAddress: data.dropoff ?? data.dropoffAddress ?? data.dropoff_address ?? data.dropoff_location
      };

      // Add notification to the list
      this.addNotification(notificationData);

      // If notification was opened, mark it as read
      if (opened) {
        // The notification was just added, so mark the latest one as read
        setTimeout(() => {
          const latestNotification = this.notifications[0];
          if (latestNotification && latestNotification.title === title) {
            this.markAsRead(latestNotification.id);
          }
        }, 100);
      }

      console.log('OneSignal notification processed:', notificationData);
    } catch (error) {
      console.error('Error handling OneSignal notification:', error);
    }
  }
}

