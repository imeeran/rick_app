import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonList,
  IonBadge,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  AlertController
} from '@ionic/angular/standalone';
import { NotificationsService, Notification } from '../services/notifications.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, 
  checkmarkCircleOutline, 
  documentTextOutline,
  trashOutline,
  checkmarkDoneOutline,
  calendarOutline,
  closeOutline,
  carOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-notification',
  templateUrl: 'notification.page.html',
  styleUrls: ['notification.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonButton,
    IonList,
    IonBadge,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons
  ]
})
export class NotificationPage implements OnInit, OnDestroy {
  ionViewWillEnter = () => this.notificationsService.fetchNotifications();
  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);
  selectedNotification = signal<Notification | null>(null);
  isModalOpen = signal(false);
  private notificationsSubscription?: Subscription;

  constructor(
    private notificationsService: NotificationsService,
    private alertController: AlertController,
    private router: Router
  ) {
    addIcons({ 
      notificationsOutline, 
      checkmarkCircleOutline, 
      documentTextOutline,
      trashOutline,
      checkmarkDoneOutline,
      calendarOutline,
      closeOutline,
      carOutline
    });
  }

  ngOnInit() {
    this.loadNotifications();
  }

  ngOnDestroy() {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
  }

  loadNotifications() {
    this.notificationsSubscription = this.notificationsService.getNotifications().subscribe(
      notifications => {
        this.notifications.set(notifications);
        this.unreadCount.set(this.notificationsService.getUnreadCount());
      }
    );
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'order_assigned':
        return 'notifications-outline';
      case 'order_completed':
        return 'checkmark-circle-outline';
      case 'payslip_generated':
        return 'document-text-outline';
      default:
        return 'notifications-outline';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'order_assigned':
        return 'primary';
      case 'order_completed':
        return 'success';
      case 'payslip_generated':
        return 'warning';
      default:
        return 'medium';
    }
  }

  formatNotificationDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  getPickupDisplay(notification: Notification): string {
    const parts: string[] = [];
    if (notification.pickupDate) {
      // Format "2025-02-26" -> "Feb 26, 2025"
      const d = new Date(notification.pickupDate + 'T00:00:00');
      parts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
    if (notification.pickupTime) {
      // Format "14:30:00" -> "2:30 PM"
      const [h, m] = notification.pickupTime.split(':').map(Number);
      const date = new Date(2000, 0, 1, h, m || 0, 0);
      parts.push(date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    }
    return parts.join(' at ');
  }

  formatTimestamp(date: Date): string {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return notificationDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: notificationDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  viewNotification(notification: Notification) {
    if (!notification.read) {
      this.notificationsService.markAsRead(notification.id);
    }
    this.selectedNotification.set(notification);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.selectedNotification.set(null);
  }

  getActionButtonConfig(notification: Notification): { text: string; icon: string; route: string | null } {
    switch (notification.type) {
      case 'order_assigned':
        return { text: 'View Booking', icon: 'car-outline', route: '/tabs/bookings' };
      case 'order_completed':
        return { text: 'View Booking', icon: 'car-outline', route: '/tabs/bookings' };
      case 'payslip_generated':
        return { text: 'View Payslip', icon: 'document-text-outline', route: '/tabs/payslip' };
      default:
        return { text: 'Close', icon: 'close-outline', route: null };
    }
  }

  handleActionClick(notification: Notification) {
    const config = this.getActionButtonConfig(notification);
    this.closeModal();
    if (config.route) {
      setTimeout(() => this.router.navigate([config.route]), 300);
    }
  }

  markAsReadFromModal() {
    const notification = this.selectedNotification();
    if (notification) {
      this.notificationsService.markAsRead(notification.id);
    }
  }

  deleteFromModal() {
    const notification = this.selectedNotification();
    if (notification) {
      // this.notificationsService.deleteNotification(notification.id);
      this.closeModal();
    }
  }

  async clearAllNotifications() {
    const alert = await this.alertController.create({
      header: 'Clear All Notifications',
      message: 'Are you sure you want to clear all notifications? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: () => {
            this.notificationsService.clearAll();
          }
        }
      ]
    });

    await alert.present();
  }

  async clearReadNotifications() {
    const alert = await this.alertController.create({
      header: 'Clear Read Notifications',
      message: 'Are you sure you want to clear all read notifications?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear Read',
          role: 'destructive',
          handler: () => {
            this.notificationsService.clearRead();
          }
        }
      ]
    });

    await alert.present();
  }

  markAllAsRead() {
    this.notificationsService.markAllAsRead();
  }

  deleteNotification(notificationId: string) {
    // this.notificationsService.deleteNotification(notificationId);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
