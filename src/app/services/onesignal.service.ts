import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import OneSignal from 'onesignal-cordova-plugin';

@Injectable({
  providedIn: 'root'
})
export class OneSignalService {

  private initialized = false;
  private pushId: string | null = null;
  private STORAGE_KEY = 'onesignal_push_id';

  constructor(
    private platform: Platform,
    private http: HttpClient
  ) {
    this.loadStoredPushId();
  }

  /* ----------------------------------
   * INITIALIZE ONESIGNAL
   * ---------------------------------- */
  async initialize(): Promise<void> {

    if (this.initialized) {
      return;
    }

    await this.platform.ready();

    // ❌ Skip web
    if (!this.platform.is('capacitor')) {
      console.log('[OneSignal] Web detected, skipping init');
      return;
    }

    try {
      // Debug logs (remove in production)
      OneSignal.Debug.setLogLevel(6);
      // alert("1 FATAL ==> "+ OneSignal.Debug.setLogLevel(1));
      // alert("2 ERROR ==> "+ OneSignal.Debug.setLogLevel(2));
      // alert("3 WARN ==> "+ OneSignal.Debug.setLogLevel(3));
      // alert("4 INFO ==> "+ OneSignal.Debug.setLogLevel(4));
      // alert("5 DEBUG ==> "+ OneSignal.Debug.setLogLevel(5));
      // alert("6 VERBOSE ==> "+ OneSignal.Debug.setLogLevel(6));  

      // ✅ Initialize
      OneSignal.initialize(environment.oneSignalAppId);

      // ✅ Request permission (Android 13+ safe)
      OneSignal.Notifications.requestPermission(true);

      // ✅ Listen for push subscription changes (BEST PRACTICE)
      OneSignal.User.pushSubscription.addEventListener('change', event => {
        const id = event?.current?.id;
        if (id && id !== this.pushId) {
          this.pushId = id;
          this.savePushId(id);

          const userId = this.getUserIdFromStorage();
          if (userId) {
            this.sendPushIdToBackend(userId, id);
          }
        }
      });

      // ✅ Handle notification opened
      OneSignal.Notifications.addEventListener('click', event => {
        const data = event?.notification?.additionalData || {};
        window.dispatchEvent(
          new CustomEvent('onesignal-notification-opened', { detail: data })
        );
      });

      this.initialized = true;
      console.log('[OneSignal] Initialized successfully');

    } catch (err) {
      console.error('[OneSignal] Init error:', err);
    }
  }

  /* ----------------------------------
   * GET PUSH ID
   * ---------------------------------- */
  async getPushId(): Promise<string | null> {
    if (this.pushId) {
      return this.pushId;
    }

    try {
      const id = await OneSignal.User.pushSubscription.getIdAsync();
      if (id) {
        this.pushId = id;
        this.savePushId(id);
      }
      return id ?? null;
    } catch {
      return null;
    }
  }

  getCachedPushId(): string | null {
    return this.pushId;
  }

  /* ----------------------------------
   * BACKEND SYNC
   * ---------------------------------- */
  async sendPushIdToBackend(userId: number, pushId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/app/auth/update-player-id`, {
          id: userId,
          player_id: pushId
        })
      );

      console.log('[OneSignal] Push ID synced:', pushId);

    } catch (err) {
      console.error('[OneSignal] Backend sync failed:', err);
    }
  }

  /* ----------------------------------
   * LOCAL STORAGE
   * ---------------------------------- */
  private savePushId(id: string): void {
    localStorage.setItem(this.STORAGE_KEY, id);
  }

  private loadStoredPushId(): void {
    this.pushId = localStorage.getItem(this.STORAGE_KEY);
  }

  private getUserIdFromStorage(): number | null {
    const id = localStorage.getItem('driver_id');
    return id ? Number(id) : null;
  }
}
