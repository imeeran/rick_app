import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './services/theme.service';
import { OneSignalService } from './services/onesignal.service';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(
    private themeService: ThemeService,
    private oneSignalService: OneSignalService
  ) {}

  async ngOnInit() {
    // Theme service will automatically load the saved theme in its constructor
    // This ensures the theme is applied on app startup
    
    // Configure status bar to ensure icons/text are visible
    this.configureStatusBar();
    // Re-apply status bar style when theme changes
    this.themeService.currentTheme$.subscribe(() => this.configureStatusBar());

    // Initialize OneSignal for push notifications
    await this.oneSignalService.initialize();
  }

  private async configureStatusBar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Prevent webview content from drawing under the status bar
      await StatusBar.setOverlaysWebView({ overlay: false });

      // Use current background color to decide icon/text color
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-background-color')
        .trim() || '#ffffff';

      const isDark = this.isDarkColor(bg);

      // If background is dark -> light status bar icons, else dark icons
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });

      // Set background to match app theme background
      await StatusBar.setBackgroundColor({ color: this.normalizeHex(bg) });
    } catch (e) {
      // Don't crash app if plugin not available
      console.warn('StatusBar configure failed:', e);
    }
  }

  private normalizeHex(color: string): string {
    // Support values like " #fff " or "rgba(...)" (fallback to white)
    const c = color.trim();
    if (c.startsWith('#')) {
      if (c.length === 4) {
        return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toUpperCase();
      }
      if (c.length === 7) return c.toUpperCase();
    }
    return '#FFFFFF';
  }

  private isDarkColor(hex: string): boolean {
    const h = this.normalizeHex(hex);
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    // relative luminance
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  }
}
