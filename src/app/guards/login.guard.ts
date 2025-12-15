import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const loginGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // Already authenticated - redirect to tabs
    router.navigate(['/tabs/dashboard']);
    return false;
  }

  // Not authenticated - allow access to login page
  return true;
};
