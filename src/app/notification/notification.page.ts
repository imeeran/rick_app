import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonList,
  IonBadge,
  AlertController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { NotificationsService, Notification } from '../services/notifications.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, 
  checkmarkCircleOutline, 
  documentTextOutline,
  closeCircleOutline,
  trashOutline,
  eyeOutline,
  checkmarkDoneOutline,
  calendarOutline
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
    IonBadge
  ]
})
export class NotificationPage implements OnInit, OnDestroy {
  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);
  private notificationsSubscription?: Subscription;

  constructor(
    private notificationsService: NotificationsService,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController
  ) {
    addIcons({ 
      notificationsOutline, 
      checkmarkCircleOutline, 
      documentTextOutline,
      closeCircleOutline,
      trashOutline,
      eyeOutline,
      checkmarkDoneOutline,
      calendarOutline
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

  async viewNotification(notification: Notification) {
    // Mark as read if unread
    if (!notification.read) {
      this.notificationsService.markAsRead(notification.id);
    }

    // Show action sheet with view options
    const actionSheet = await this.actionSheetController.create({
      header: notification.title,
      subHeader: notification.message,
      buttons: [
        {
          text: 'View Details',
          icon: 'eye-outline',
          handler: () => {
            this.showNotificationDetails(notification);
          }
        },
        {
          text: notification.read ? 'Mark as Unread' : 'Mark as Read',
          icon: notification.read ? 'notifications-outline' : 'checkmark-done-outline',
          handler: () => {
            if (notification.read) {
              // Note: Service doesn't have markAsUnread, but we can implement if needed
              // For now, just mark as read
            } else {
              this.notificationsService.markAsRead(notification.id);
            }
          }
        },
        {
          text: 'Delete',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.deleteNotification(notification.id);
          }
        },
        {
          text: 'Cancel',
          icon: 'close-circle-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async showNotificationDetails(notification: Notification) {
    let message = notification.message;
    
    if (notification.orderId) {
      message += `\n\nOrder ID: ${notification.orderId}`;
    }
    
    if (notification.payslipMonth && notification.payslipYear) {
      message += `\n\nPeriod: ${notification.payslipMonth} ${notification.payslipYear}`;
    }

    const alert = await this.alertController.create({
      header: notification.title,
      message: message,
      buttons: ['OK']
    });

    await alert.present();
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
    this.notificationsService.deleteNotification(notificationId);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
