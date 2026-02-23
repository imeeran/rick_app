import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButton
} from '@ionic/angular/standalone';
import { ThemeService, Theme } from '../services/theme.service';
import { AuthService, Driver } from '../services/auth.service';
import { PayslipService } from '../services/payslip.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  chevronForward,
  personOutline,
  briefcaseOutline,
  colorPaletteOutline,
  moonOutline,
  sunnyOutline,
  logOutOutline
} from 'ionicons/icons';


@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  imports: [
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonButton
  ],
})
export class ProfilePage implements OnInit, OnDestroy {
  selectedSegment = signal<string>('personal');
  themes: Theme[] = [];
  filteredThemes: Theme[] = [];
  currentTheme = signal<string>('default');
  themeMode = signal<'light' | 'dark'>('light');
  driver = signal<Driver | null>(null);
  private themeSubscription?: Subscription;

  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private payslipService: PayslipService,
    private router: Router
  ) {
    addIcons({ 
      chevronForward,
      personOutline,
      briefcaseOutline,
      colorPaletteOutline,
      moonOutline,
      sunnyOutline,
      logOutOutline
    });
  }

  ngOnInit(): void {
    // Load driver data
    const currentDriver = this.authService.getCurrentUserValue();
    if (currentDriver) {
      this.driver.set(currentDriver);
    }

    // Subscribe to driver changes
    this.authService.currentUser$.subscribe(driver => {
      this.driver.set(driver);
    });

    this.themes = this.themeService.getThemes();
    this.currentTheme.set(this.themeService.getCurrentTheme());
    
    // Determine initial mode based on current theme
    const currentThemeObj = this.themes.find(t => t.name === this.currentTheme());
    if (currentThemeObj) {
      const isDark = this.themeService.isDarkColor(currentThemeObj.background);
      this.themeMode.set(isDark ? 'dark' : 'light');
    }
    
    this.filterThemes();
    
    this.themeSubscription = this.themeService.currentTheme$.subscribe(theme => {
      this.currentTheme.set(theme);
      // Update mode based on selected theme
      const themeObj = this.themes.find(t => t.name === theme);
      if (themeObj) {
        const isDark = this.themeService.isDarkColor(themeObj.background);
        this.themeMode.set(isDark ? 'dark' : 'light');
        this.filterThemes();
      }
    });
  }

  ngOnDestroy(): void {
    this.themeSubscription?.unsubscribe();
  }

  segmentChanged(event: CustomEvent): void {
    this.selectedSegment.set(event.detail.value);
  }

  selectTheme(themeName: string): void {
    this.themeService.setTheme(themeName);
    // Force update current theme signal to ensure UI reflects the change
    this.currentTheme.set(themeName);
  }

  onThemeModeChange(event: CustomEvent): void {
    const mode = event.detail.value as string;
    if (mode === 'light' || mode === 'dark') {
      this.themeMode.set(mode as 'light' | 'dark');
      this.filterThemes();
      
      // Automatically select default theme for the selected mode
      const defaultTheme = mode === 'dark' ? 'dark' : 'default';
      this.selectTheme(defaultTheme);
    }
  }

  private filterThemes(): void {
    this.filteredThemes = this.themeService.getThemesByMode(this.themeMode() === 'dark');
  }

  getCurrentThemePrimaryColor(): string {
    const themeObj = this.themes.find(t => t.name === this.currentTheme());
    return themeObj?.primary || '#0A2463';
  }

  getLogoutButtonTextColor(): string {
    // Always use white text for primary color buttons for better contrast
    return '#ffffff';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  }

  async onLogout(): Promise<void> {
    // Clear downloaded payslip files before logging out
    // This prevents files from previous users from being shown to new users
    await this.payslipService.clearDownloadedPayslips();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
