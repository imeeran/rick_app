import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('../booking/booking.page').then((m) => m.BookingPage),
      },
      {
        path: 'ride',
        loadComponent: () =>
          import('../ride/ride.page').then((m) => m.RidePage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'notification',
        loadComponent: () =>
          import('../notification/notification.page').then((m) => m.NotificationPage),
      },
      {
        path: 'payslip',
        loadComponent: () =>
          import('../payslip/payslip.page').then((m) => m.PayslipPage),
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full',
  },
];
