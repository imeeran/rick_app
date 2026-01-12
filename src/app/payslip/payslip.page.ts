import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonSpinner,
  IonToast
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular/standalone';
import { PayslipService, Payslip } from '../services/payslip.service';
import { PayslipPdfService } from '../profile/payslip-pdf.service';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import { addIcons } from 'ionicons';
import { 
  documentText, 
  downloadOutline,
  checkmarkCircle,
  openOutline
} from 'ionicons/icons';
import { ViewWillEnter } from '@ionic/angular';

@Component({
  selector: 'app-payslip',
  templateUrl: 'payslip.page.html',
  styleUrls: ['payslip.page.scss'],
  imports: [
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonSpinner,
    IonToast
  ],
})
export class PayslipPage implements OnInit, OnDestroy, ViewWillEnter {
  payslips = signal<Payslip[]>([]);
  isLoadingPayslips = signal<boolean>(false);
  payslipError = signal<string | null>(null);
  downloadingPayslipKey = signal<string | null>(null);
  downloadedPayslipKeys = signal<Set<string>>(new Set());
  toastOpen = signal<boolean>(false);
  toastMessage = signal<string>('');
  toastColor = signal<'success' | 'warning' | 'danger' | 'primary'>('primary');
  toastOffsetTopPx = signal<number>(12);
  toastButtons = signal<any[]>([{ text: 'OK', role: 'cancel' }]);
  private appStateListener?: any;

  constructor(
    private payslipService: PayslipService,
    private payslipPdfService: PayslipPdfService,
    private alertController: AlertController
  ) {
    addIcons({ 
      documentText, 
      downloadOutline,
      checkmarkCircle,
      openOutline
    });
  }

  ngOnInit(): void {
    // Load payslips
    this.loadPayslips();
    // Restore downloaded status for list
    void this.refreshDownloadedPayslips();

    // Listen for app state changes (when app comes back from background)
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          // App came to foreground - refresh data
          this.loadPayslips();
          void this.refreshDownloadedPayslips();
        }
      }).then(listener => {
        this.appStateListener = listener;
      });
    }
  }

  ngOnDestroy(): void {
    // Remove app state listener
    if (this.appStateListener) {
      void this.appStateListener.remove();
    }
  }

  ionViewWillEnter(): void {
    // Refresh payslip data and downloaded status whenever the page is entered
    this.loadPayslips();
    void this.refreshDownloadedPayslips();
  }

  formatAmount(value: unknown, fractionDigits = 2): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return String(value);
    return num.toFixed(fractionDigits);
  }

  loadPayslips(): void {
    this.isLoadingPayslips.set(true);
    this.payslipError.set(null);

    this.payslipService.getPayslips().subscribe({
      next: (payslips) => {
        // Filter out September 2025 payslip
        const filteredPayslips = payslips.filter(payslip => {
          const monthName = payslip.month_name || '';
          const year = payslip.year || '';
          // Exclude if it's September 2025
          return !(monthName.toLowerCase() === 'september' && (year === '2025' || year === 2025));
        });
        this.payslips.set(filteredPayslips);
        this.isLoadingPayslips.set(false);
        void this.refreshDownloadedPayslips();
      },
      error: (error) => {
        console.error('Error loading payslips:', error);
        this.payslipError.set(error.message || 'Failed to load payslips');
        this.isLoadingPayslips.set(false);
        this.payslips.set([]);
      }
    });
  }

  private async getAvailablePayslipPath(
      baseFilename: string,
      directory: Directory,
      folder = 'payslips'
    ): Promise<string> {
      let index = 0;
    
      while (true) {
        const filename =
          index === 0
            ? baseFilename
            : baseFilename.replace('.pdf', `(${index}).pdf`);
    
        const path = `${folder}/${filename}`;
    
        try {
          await Filesystem.stat({ path, directory });
          index++; // file exists → try next number
        } catch {
          return path; // file does not exist → use this path
        }
      }
  }
  

  async downloadPayslipPDF(event: Event, payslip: Payslip): Promise<void> {
    event.stopPropagation();
    this.setToastAnchorFromEvent(event);
  
    const key = this.getPayslipKey(payslip);
    if (this.downloadingPayslipKey() === key) return;

    try {
      this.downloadingPayslipKey.set(key);
      const blob = await this.withTimeout(
        this.payslipPdfService.generatePayslip(payslip),
        30000,
        'PDF generation is taking too long'
      );
  
      const monthName = payslip.month_name || 'payslip';
      const year = payslip.year || '';
      const filename = `Payslip_${monthName}_${year}.pdf`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
      if (Capacitor.isNativePlatform()) {
        const base64Data = await this.withTimeout(
          this.blobToBase64(blob),
          20000,
          'Preparing file is taking too long'
        );
        const platform = Capacitor.getPlatform();
  
        /* ✅ ANDROID — REAL DOWNLOAD (NO SHARE) */
        if (platform === 'android') {
          const filePath = await this.getAvailablePayslipPath(
            safeFilename,
            Directory.Documents
          );
          await this.withTimeout(
            Filesystem.writeFile({
              path: filePath,
              data: base64Data,
              directory: Directory.Documents,
              recursive: true, // ✅ IMPORTANT
            }),
            20000,
            'Saving payslip is taking too long'
          );
  
          this.markPayslipDownloaded(payslip);
          await this.presentToast(`Payslip saved: ${filePath.split('/').pop()}`, 'success', false);
          return; // ✅ STOP HERE (IMPORTANT)
        }
  
        /* 🍎 iOS — SHARE IS MANDATORY */
        const path = `payslips/${safeFilename}`;
        await Filesystem.writeFile({
          path,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
  
        const { uri } = await Filesystem.getUri({
          path,
          directory: Directory.Documents,
        });
  
        await Share.share({
          title: safeFilename,
          url: uri,
        });
        return;
      }
  
      /* 🌐 WEB */
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
  
    } catch (error) {
      console.error('Error generating PDF:', error);
      await this.presentToast('Failed to download payslip. Please try again.', 'danger');
    } finally {
      if (this.downloadingPayslipKey() === key) {
        this.downloadingPayslipKey.set(null);
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'primary' = 'primary',
    showOpenButton = false
  ): Promise<void> {
    this.toastMessage.set(message);
    this.toastColor.set(color);
    this.toastButtons.set([{ text: 'OK', role: 'cancel' }]);
    this.toastOpen.set(true);
  }

  async openPayslip(payslip: Payslip, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    
    if (!this.isPayslipDownloaded(payslip)) {
      return;
    }

    try {
      const monthName = payslip.month_name || 'payslip';
      const year = payslip.year || '';
      const filename = `Payslip_${monthName}_${year}.pdf`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      // Try to find the actual file path (could be with (1), (2), etc. suffix)
      const folder = 'payslips';
      const dir = Directory.Documents;
      
      let filePath: string | null = null;
      try {
        const result = await Filesystem.readdir({ path: folder, directory: dir });
        const files = (result.files ?? []).map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean) as string[];
        const safeBase = safeFilename.replace(/\.pdf$/i, '');
        const re = new RegExp(`^${safeBase}(\\(\\d+\\))?\\.pdf$`, 'i');
        const match = files.find(name => re.test(name));
        if (match) {
          filePath = `${folder}/${match}`;
        }
      } catch {
        // Folder doesn't exist
      }

      if (!filePath) {
        // Fallback: try the base filename
        filePath = `${folder}/${safeFilename}`;
      }

      const { uri } = await Filesystem.getUri({
        path: filePath,
        directory: dir,
      });

      try {
        await FileOpener.open({
          filePath: uri,
          contentType: 'application/pdf',
          openWithDefault: true,
        });
      } catch (openError) {
        console.warn('Direct open failed; no PDF viewer available:', openError);
        // Show alert suggesting to install a PDF opener app
        await this.showPdfOpenerAlert();
      }
    } catch (e) {
      console.error('Failed to open payslip:', e);
      await this.presentToast('Could not open payslip. Please try downloading again.', 'warning', false);
    }
  }

  onToastDidDismiss(): void {
    this.toastOpen.set(false);
  }

  private async showPdfOpenerAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'PDF Viewer Required',
      message: 'No PDF viewer app is available on your device. Please install a PDF viewer app (like Adobe Acrobat Reader, Google PDF Viewer, or any PDF reader) from the Play Store/App Store to open payslips.',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  private setToastAnchorFromEvent(event?: Event): void {
    const target = event?.target as HTMLElement | null;
    if (!target?.getBoundingClientRect) return;

    const rect = target.getBoundingClientRect();
    // Place toast slightly above the clicked icon, clamped to a sensible minimum.
    const top = Math.max(12, Math.round(rect.top - 12));
    this.toastOffsetTopPx.set(top);
  }

  isDownloadingPayslip(payslip: Payslip): boolean {
    return this.downloadingPayslipKey() === this.getPayslipKey(payslip);
  }

  isPayslipDownloaded(payslip: Payslip): boolean {
    return this.downloadedPayslipKeys().has(this.getPayslipKey(payslip));
  }

  private getPayslipKey(payslip: Payslip): string {
    return String(payslip.id ?? `${payslip.month_name ?? ''}-${payslip.year ?? ''}`);
  }

  private markPayslipDownloaded(payslip: Payslip): void {
    const key = this.getPayslipKey(payslip);
    const next = new Set(this.downloadedPayslipKeys());
    next.add(key);
    this.downloadedPayslipKeys.set(next);
  }

  private async refreshDownloadedPayslips(): Promise<void> {
    try {
      const dir = Directory.Documents;
      const folder = 'payslips';
      const result = await Filesystem.readdir({ path: folder, directory: dir });
      const files = (result.files ?? []).map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean) as string[];

      const downloaded = new Set<string>();
      for (const p of this.payslips()) {
        const monthName = p.month_name || 'payslip';
        const year = p.year || '';
        const filename = `Payslip_${monthName}_${year}.pdf`;
        const safeBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.pdf$/i, '');
        const re = new RegExp(`^${safeBase}(\\(\\d+\\))?\\.pdf$`, 'i');
        if (files.some(name => re.test(name))) {
          downloaded.add(this.getPayslipKey(p));
        }
      }
      this.downloadedPayslipKeys.set(downloaded);
    } catch {
      // Folder doesn't exist yet (no downloads) or not readable; keep as empty.
      this.downloadedPayslipKeys.set(new Set());
    }
  }
  

  private async blobToBase64(blob: Blob): Promise<string> {
    // FileReader is much faster than manually iterating bytes in JS (important on Android WebView).
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read PDF blob'));
      reader.onload = () => {
        const result = String(reader.result || '');
        // result is "data:application/pdf;base64,AAAA..."
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
  }
}

