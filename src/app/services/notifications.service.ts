import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { Platform } from '@ionic/angular';

export type NotificationType = 'order_assigned' | 'order_completed' | 'payslip_generated';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  orderId?: string; // For order-related notifications
  payslipMonth?: string; // For payslip notifications (e.g., "January 2024")
  payslipYear?: number;
  amount?: number; // For order completed and payslip notifications
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private notifications: Notification[] = [];

  constructor(private platform: Platform) {
    // Load notifications from localStorage or initialize with mock data
    this.loadNotifications();
    
    // Set up OneSignal notification listeners
    this.setupOneSignalListeners();
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
   * Add a new notification
   */
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.notifications.unshift(newNotification); // Add to beginning
    this.saveNotifications();
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
      this.notificationsSubject.next([...this.notifications]);
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.saveNotifications();
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.saveNotifications();
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications = [];
    localStorage.removeItem('notifications'); // Clear localStorage
    this.notificationsSubject.next([]);
    // Regenerate mock data for testing
    setTimeout(() => {
      this.generateMockNotifications();
    }, 100);
  }

  /**
   * Clear all read notifications
   */
  clearRead(): void {
    this.notifications = this.notifications.filter(n => !n.read);
    // If all notifications were cleared, regenerate mock data
    if (this.notifications.length === 0) {
      localStorage.removeItem('notifications');
      // Regenerate mock data for testing
      setTimeout(() => {
        this.generateMockNotifications();
      }, 100);
    } else {
      this.saveNotifications();
    }
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Generate mock notifications for demonstration
   */
  generateMockNotifications(): void {
    const now = new Date();
    const mockNotifications: Notification[] = [];
    
    // Order assigned notifications
    for (let i = 0; i < 5; i++) {
      const hoursAgo = i * 2;
      const date = new Date(now);
      date.setHours(date.getHours() - hoursAgo);
      
      mockNotifications.push({
        id: this.generateId(),
        type: 'order_assigned',
        title: 'New Order Assigned',
        message: `Order #${1000 + i} has been assigned to you. Pickup: Downtown Station`,
        timestamp: date,
        read: false,
        orderId: `order-${1000 + i}`,
        amount: Math.floor(Math.random() * 50) + 10
      });
    }

    // Order completed notifications
    for (let i = 0; i < 8; i++) {
      const daysAgo = i;
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(Math.floor(Math.random() * 24));
      
      mockNotifications.push({
        id: this.generateId(),
        type: 'order_completed',
        title: 'Order Completed',
        message: `Order #${2000 + i} has been completed successfully.`,
        timestamp: date,
        read: false,
        orderId: `order-${2000 + i}`,
        amount: Math.floor(Math.random() * 50) + 10
      });
    }

    // Payslip generated notifications (one per month for last 3 months)
    for (let i = 0; i < 3; i++) {
      const monthsAgo = i;
      const date = new Date(now);
      date.setMonth(date.getMonth() - monthsAgo);
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      
      mockNotifications.push({
        id: this.generateId(),
        type: 'payslip_generated',
        title: 'Payslip Generated',
        message: `Your payslip for ${monthName} ${year} has been generated.`,
        timestamp: date,
        read: false,
        payslipMonth: monthName,
        payslipYear: year,
        amount: Math.floor(Math.random() * 2000) + 1000
      });
    }

    // Sort by timestamp (newest first)
    mockNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    this.notifications = mockNotifications;
    this.saveNotifications();
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Save notifications to localStorage
   */
  private saveNotifications(): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  /**
   * Load notifications from localStorage
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        this.notifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        // If array is empty, generate mock data
        if (this.notifications.length === 0) {
          this.generateMockNotifications();
        } else {
          this.notificationsSubject.next([...this.notifications]);
        }
      } else {
        // Initialize with mock data if no stored notifications
        this.generateMockNotifications();
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.generateMockNotifications();
    }
  }

  /**
   * Generate unique ID for notifications
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
        orderId: data.orderId,
        payslipMonth: data.payslipMonth,
        payslipYear: data.payslipYear,
        amount: data.amount
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

