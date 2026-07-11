import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Payslip } from '../services/payslip.service';

@Injectable({ providedIn: 'root' })
export class PayslipPdfService {
  private logoBase64: string | null = null;

  constructor() {
    // Preload the logo when service is initialized
    this.loadLogoImage().then(logo => {
      this.logoBase64 = logo;
      console.log('Logo preloaded successfully');
    }).catch(error => {
      console.warn('Failed to preload logo:', error);
    });
  }

  async generatePayslip(payslip: Payslip): Promise<Blob> {
    console.log('PDF Service - Received payslip:', payslip);
    
    const monthName = payslip.month_name || 'January';
    const year = payslip.year || new Date().getFullYear();
    
    // Convert month name to month number for display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNumber = (monthNames.indexOf(monthName) + 1).toString().padStart(2, '0');
    
    // Load logo if not already loaded
    if (!this.logoBase64) {
      this.logoBase64 = await this.loadLogoImage();
    }
    
    const doc = new jsPDF();

    // Header with logo
    this.addLogoToPDF(doc);
    
    // Company info - centered alignment
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12); // Smaller font size for company name
    doc.setFont('helvetica', 'bold'); // Keep bold but smaller
    
    // Center the company name
    const companyName = 'RICK LUXURY TRANSPORT L.L.C';
    const companyNameWidth = doc.getTextWidth(companyName);
    const pageWidth = doc.internal.pageSize.getWidth();
    const companyNameX = (pageWidth - companyNameWidth) / 2;
    doc.text(companyName, companyNameX, 20);
    
    // Center the address - reduced gap
    doc.setFontSize(8); // Smaller font size for address
    doc.setFont('helvetica', 'normal');
    const address = 'Mazyad Mall, Tower 2, Floor 6, Abu Dhabi UAE.';
    const addressWidth = doc.getTextWidth(address);
    const addressX = (pageWidth - addressWidth) / 2;
    doc.text(address, addressX, 24); // Reduced from 27 to 24
    
    // Center the period text - reduced gap
    doc.setFontSize(8); // Smaller font size for period
    doc.setFont('helvetica', 'normal'); // Not bold
    const periodText = `Ledger for the period 1-${monthNumber}-${year} To 31-${monthNumber}-${year}`;
    const periodTextWidth = doc.getTextWidth(periodText);
    const periodTextX = (pageWidth - periodTextWidth) / 2;
    doc.text(periodText, periodTextX, 30); // Reduced from 35 to 30

    // Account holder information
    const payslipArray = payslip.payslip_array || [];
    
    // Extract PLATE value from payslip_array if available
    let plateValue = payslip.plate || 'N/A';
    if (plateValue === 'N/A' || plateValue === '') {
      const plateItem = payslipArray.find(item => item.field && item.field.toLowerCase().includes('plate'));
      if (plateItem && plateItem.amount) {
        plateValue = plateItem.amount.toString();
      }
    }
    
    const accountInfo = [
      { label: 'Name:', value: payslip.driver_name || 'N/A', x: 14, y: 45 },
      { label: 'Mobile No:', value: payslip.mobile_no || 'N/A', x: 14, y: 52 },
      { label: 'RICK No:', value: payslip.rick || 'N/A', x: 14, y: 59 },
      { label: 'Plate No:', value: String(plateValue), x: 14, y: 66 }
    ];

    accountInfo.forEach(info => {
      doc.setFontSize(8); // Smaller font size for account info
      doc.setFont('helvetica', 'normal');
      doc.text(info.label, info.x, info.y);
      // Ensure value is a string and not null/undefined
      const safeValue = String(info.value || 'N/A');
      doc.setFont('helvetica', 'normal'); // Less bold for values too
      doc.text(safeValue, info.x + 40, info.y);
    });

    // Generate ledger transactions
    const transactions = this.generateLedgerTransactions(payslip);
    const closingBalance = this.calculateClosingBalance(payslip);

    // Ledger Table
    autoTable(doc, {
      startY: 75,
      head: [['S NO.', 'Description', 'Dabit', 'Credit', 'Balance', 'DR/CR']],
      body: transactions.map((t, index) => [
        index + 1,
        t.description,
        t.debit > 0 ? t.debit.toFixed(2) : '',
        t.credit > 0 ? t.credit.toFixed(2) : (t.credit === 0 ? '0.00' : ''),
        t.balance.toFixed(2),
        t.drCr
      ]),
      styles: { 
        fontSize: 10,
        cellPadding: 4
      },
      headStyles: { 
        fillColor: [30, 64, 175], // Dark blue
        textColor: [255, 255, 255],
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: { 
        halign: 'center',
        fontSize: 9
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'center', cellWidth: 20 }
      },
      showHead: 'firstPage', // Only show header on first page
    });

    // Add closing balance table with dark blue background - using colspan approach
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      body: [
        [
          { content: 'Closing Balance-', colSpan: 2, styles: { halign: 'left', fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: this.getTotalDebit(transactions).toFixed(2), styles: { halign: 'right', fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: this.getTotalCredit(transactions).toFixed(2), styles: { halign: 'right', fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: closingBalance.toFixed(2), styles: { halign: 'right', fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: closingBalance >= 0 ? 'DR' : 'CR', styles: { halign: 'center', fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' } }
        ]
      ],
      styles: { 
        fontSize: 10,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 80 },   // Description column width
        1: { cellWidth: 20 },   // S NO. column width
        2: { cellWidth: 25 },   // Debit column width
        3: { cellWidth: 25 },   // Credit column width
        4: { cellWidth: 25 },   // Balance column width
        5: { cellWidth: 20 }    // DR/CR column width
      }
    });

    // Footer - centered alignment to match header
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8); // Smaller font size for footer
    doc.setFont('helvetica', 'normal');
    
    // Center the footer text
    const footerText1 = 'For internal use only, Invalid for any legal or financial claims without company authorization.';
    const footerText1Width = doc.getTextWidth(footerText1);
    const footerText1X = (pageWidth - footerText1Width) / 2;
    doc.text(footerText1, footerText1X, finalY);
    
    const footerText2 = 'For any queries, please contact us at any time. Email: Info@ricklimo.com | Web: www.ricklimo.com';
    const footerText2Width = doc.getTextWidth(footerText2);
    const footerText2X = (pageWidth - footerText2Width) / 2;
    doc.text(footerText2, footerText2X, finalY + 6);

    return doc.output('blob');
  }

  private generateLedgerTransactions(payslip: Payslip): any[] {
    console.log('=== GENERATING TRANSACTIONS FROM PAYSLIP DATA ===');
    console.log('Payslip data:', payslip);
    
    const payslipArray = payslip.payslip_array || [];
    const obopm = this.parseAmount(payslip.obopm || 0);
    
    console.log('=== PAYSLIP DATA DEBUG ===');
    console.log('obopm raw value:', payslip.obopm);
    console.log('obopm parsed:', obopm);
    console.log('Payslip array:', payslipArray);
    console.log('=== END DEBUG ===');
    
    let runningBalance = 0; // Start with 0, apply opening balance by DR/CR based on sign
    const transactions = [];

    // 1. Opening Balance (obopm) - Show in DR if positive, CR if negative
    const openingAmount = Math.abs(obopm);
    let openingDebit = 0;
    let openingCredit = 0;

    if (obopm < 0) {
      // Negative opening balance -> show as Credit and reduce balance
      openingCredit = openingAmount;
      runningBalance -= openingAmount;
    } else if (obopm > 0) {
      // Positive opening balance -> show as Debit and increase balance
      openingDebit = openingAmount;
      runningBalance += openingAmount;
    }

    console.log('Opening Balance Details:');
    console.log('- obopm value:', obopm);
    console.log('- openingDebit:', openingDebit);
    console.log('- openingCredit:', openingCredit);
    console.log('- runningBalance after obopm:', runningBalance);

    // Always add opening balance entry (even if zero)
    const openingBalanceEntry = {
      description: 'Opening Balance as of previous month',
      debit: openingDebit,
      credit: openingCredit,
      balance: runningBalance,
      drCr: runningBalance >= 0 ? 'DR' : 'CR'
    };

    transactions.push(openingBalanceEntry);

    console.log('Opening Balance Transaction Added:', openingBalanceEntry);

    // 2. Process payslip_array transactions
    if (Array.isArray(payslipArray)) {
      payslipArray.forEach((item: any) => {
        const amount = this.parseAmount(item.amount);
        const type = item.type || '';
        const field = item.field || '';
        
        // Filter out system fields and display-only fields that shouldn't be displayed as transactions
        const systemFields = ['_excel_row', '_system', '_internal', '_metadata'];
        const displayOnlyFields = ['plate', 'PLATE', 'driver_name', 'mobile_no', 'rick'];
        if (systemFields.some(sysField => field.toLowerCase().includes(sysField.toLowerCase())) ||
            displayOnlyFields.some(displayField => field.toLowerCase().includes(displayField.toLowerCase()))) {
          console.log('Filtering out system/display field:', field);
          return; // Skip this transaction
        }
        
        if (amount > 0) {
          if (type === 'DR') {
            // Debit transactions - add to balance
            runningBalance += amount;
            transactions.push({
              description: field,
              debit: amount,
              credit: 0,
              balance: runningBalance,
              drCr: runningBalance >= 0 ? 'DR' : 'CR'
            });
          } else if (type === 'CR') {
            // Credit transactions - deduct from balance
            runningBalance -= amount;
            transactions.push({
              description: field,
              debit: 0,
              credit: amount,
              balance: runningBalance,
              drCr: runningBalance >= 0 ? 'DR' : 'CR'
            });
          }
        }
      });
    } else {
      console.warn('Payslip array is not an array, skipping transactions');
    }

    console.log('Generated transactions:', transactions);
    console.log('Final running balance:', runningBalance);
    
    return transactions;
  }

  private getTotalDebit(transactions: any[]): number {
    return transactions.reduce((sum, t) => sum + t.debit, 0);
  }

  private getTotalCredit(transactions: any[]): number {
    return transactions.reduce((sum, t) => sum + t.credit, 0);
  }

  private calculateClosingBalance(payslip: Payslip): number {
    console.log('=== CALCULATING CLOSING BALANCE ===');
    console.log('Payslip for calculation:', payslip);
    
    const payslipArray = payslip.payslip_array || [];
    const obopm = this.parseAmount(payslip.obopm || 0);
    
    console.log('Payslip array for calculation:', payslipArray);
    console.log('Opening balance (obopm):', obopm);
    
    let totalDebits = 0;
    let totalCredits = 0;
    
    // Process payslip_array to calculate totals
    if (Array.isArray(payslipArray)) {
      payslipArray.forEach((item: any) => {
        const amount = this.parseAmount(item.amount);
        const type = item.type || '';
        const field = item.field || '';
        
        // Filter out system fields and display-only fields that shouldn't be included in calculations
        const systemFields = ['_excel_row', '_system', '_internal', '_metadata'];
        const displayOnlyFields = ['plate', 'PLATE', 'driver_name', 'mobile_no', 'rick'];
        if (systemFields.some(sysField => field.toLowerCase().includes(sysField.toLowerCase())) ||
            displayOnlyFields.some(displayField => field.toLowerCase().includes(displayField.toLowerCase()))) {
          console.log('Filtering out system/display field from calculation:', field);
          return; // Skip this transaction
        }
        
        if (amount > 0) {
          if (type === 'DR') {
            totalDebits += amount;
          } else if (type === 'CR') {
            totalCredits += amount;
          }
        }
      });
    }
    
    // Calculate closing balance: (Opening Balance + Total Debits) - Total Credits
    const closingBalance = (obopm + totalDebits) - totalCredits;
    
    console.log('Total Debits:', totalDebits);
    console.log('Total Credits:', totalCredits);
    console.log('Opening Balance (obopm):', obopm);
    console.log('Closing Balance:', closingBalance);
    
    return closingBalance;
  }

  private addLogoToPDF(doc: any): void {
    const logoWidth = 18; // Reduced from 30 to 20
    const logoHeight = 15; // Reduced from 20 to 15
    const logoX = 14;
    const logoY = 16; // Moved down from 10 to 15 to align with company name
    
    if (this.logoBase64) {
      try {
        // Use the cached logo
        doc.addImage(this.logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
        return;
      } catch (error) {
        console.warn('Could not add cached logo to PDF:', error);
      }
    }
    
    // Fallback to text logo
    this.addFallbackLogo(doc, logoX, logoY, logoWidth, logoHeight);
  }

  private async loadLogoImage(): Promise<string | null> {
    try {
      // Try multiple paths for Ionic app
      const logoPaths = [
        'assets/images/logo.png',
        '/assets/images/logo.png',
        './assets/images/logo.png'
      ];
      
      for (const logoPath of logoPaths) {
        try {
          const response = await fetch(logoPath);
          if (response.ok) {
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to read logo'));
              reader.readAsDataURL(blob);
            });
          }
        } catch (error) {
          console.warn(`Failed to load logo from ${logoPath}:`, error);
          continue;
        }
      }
      
      throw new Error('Failed to load logo from all paths');
    } catch (error) {
      console.warn('Error loading logo:', error);
      return null;
    }
  }

  private addFallbackLogo(doc: any, x: number, y: number, width: number, height: number): void {
    // Fallback to styled text logo
    doc.setFillColor(37, 99, 235);
    doc.rect(x, y, width, height, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8); // Reduced font size to fit smaller logo
    doc.setFont('helvetica', 'bold');
    doc.text('RICK', x + 1, y + 6);
    doc.text('LUXURY', x + 1, y + 11);
  }

  private getLastDayOfMonth(payslip: Payslip): number {
    const year = payslip.year || new Date().getFullYear();
    const monthName = payslip.month_name || 'January';
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex === -1) return 31;
    
    // Get the last day of the month
    const yearNum = typeof year === 'string' ? parseInt(year) : year;
    const lastDay = new Date(yearNum, monthIndex + 1, 0).getDate();
    return lastDay;
  }

  private getMonthYear(payslip: Payslip): string {
    const monthName = payslip.month_name || 'January';
    const year = payslip.year || new Date().getFullYear();
    
    // Get first 3 letters of month name and format as "Mar-2025"
    const shortMonth = monthName.substring(0, 3);
    const yearNum = typeof year === 'string' ? parseInt(year) : year;
    const result = `${shortMonth}-${yearNum}`;
    return result;
  }

  private parseAmount(amount: string | number): number {
    if (typeof amount === 'string') {
      return parseFloat(amount) || 0;
    }
    return amount || 0;
  }
}

