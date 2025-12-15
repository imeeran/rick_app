import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Theme {
  name: string;
  displayName: string;
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme';
  private currentThemeSubject = new BehaviorSubject<string>('default');
  public currentTheme$: Observable<string> = this.currentThemeSubject.asObservable();

  private themes: { [key: string]: Theme } = {
    //  Light Themes
    default: {
      name: 'default',
      displayName: 'Default',
      primary: '#0A2463',
      secondary: '#1E3A8A',
      tertiary: '#3B82F6',
      background: '#F0F9FF',
      text: '#1A1A1A'
    },
    purple: {
      name: 'purple',
      displayName: 'Purple',
      primary: '#312C51',
      secondary: '#48426D',
      tertiary: '#F0C38E',
      background: '#F8F9FA',
      text: '#312C51'
    },
    blue: {
      name: 'blue',
      displayName: 'Ocean Blue',
      primary: '#0057FF',
      secondary: '#FFD60A',
      tertiary: '#2ECC71',
      background: '#F8F9FB',
      text: '#1A1A1A'
    },
    green: {
      name: 'green',
      displayName: 'Forest Green',
      primary: '#2ECC71',
      secondary: '#27AE60',
      tertiary: '#F39C12',
      background: '#F8F9FA',
      text: '#1A1A1A'
    },
    orange: {
      name: 'orange',
      displayName: 'Sunset Orange',
      primary: '#F5A623',
      secondary: '#E67E22',
      tertiary: '#D35400',
      background: '#FEF9F3',
      text: '#2C3E50'
    },
    red: {
      name: 'red',
      displayName: 'Crimson Red',
      primary: '#E63946',
      secondary: '#F1AA9B',
      tertiary: '#FF6B6B',
      background: '#FFF5F5',
      text: '#2C2C2C'
    },
    pink: {
      name: 'pink',
      displayName: 'Rose Pink',
      primary: '#E91E63',
      secondary: '#F48FB1',
      tertiary: '#FF4081',
      background: '#FDF2F8',
      text: '#2C2C2C'
    },
    teal: {
      name: 'teal',
      displayName: 'Ocean Teal',
      primary: '#009688',
      secondary: '#4DB6AC',
      tertiary: '#26A69A',
      background: '#F0FDFA',
      text: '#1A1A1A'
    },
    indigo: {
      name: 'indigo',
      displayName: 'Deep Indigo',
      primary: '#3F51B5',
      secondary: '#5C6BC0',
      tertiary: '#7986CB',
      background: '#F5F5FF',
      text: '#1A1A1A'
    },
    amber: {
      name: 'amber',
      displayName: 'Golden Amber',
      primary: '#FFC107',
      secondary: '#FFD54F',
      tertiary: '#FFB300',
      background: '#FFFBF0',
      text: '#2C2C2C'
    },
    mint: {
      name: 'mint',
      displayName: 'Fresh Mint',
      primary: '#00C896',
      secondary: '#4ECDC4',
      tertiary: '#95E1D3',
      background: '#F0FFF4',
      text: '#1A1A1A'
    },
    lavender: {
      name: 'lavender',
      displayName: 'Lavender',
      primary: '#9C27B0',
      secondary: '#BA68C8',
      tertiary: '#CE93D8',
      background: '#FAF5FF',
      text: '#2C2C2C'
    },
    coral: {
      name: 'coral',
      displayName: 'Coral',
      primary: '#FF6B6B',
      secondary: '#FF8E8E',
      tertiary: '#FFA8A8',
      background: '#FFF5F5',
      text: '#2C2C2C'
    },
    emerald: {
      name: 'emerald',
      displayName: 'Emerald',
      primary: '#10B981',
      secondary: '#34D399',
      tertiary: '#6EE7B7',
      background: '#F0FDF4',
      text: '#1A1A1A'
    },
    sunset: {
      name: 'sunset',
      displayName: 'Sunset',
      primary: '#FF6B35',
      secondary: '#F7931E',
      tertiary: '#FFB347',
      background: '#FFF8F0',
      text: '#2C2C2C'
    },
    violet: {
      name: 'violet',
      displayName: 'Violet Dream',
      primary: '#7C3AED',
      secondary: '#A78BFA',
      tertiary: '#C4B5FD',
      background: '#FAF5FF',
      text: '#1A1A1A'
    },
    cyan: {
      name: 'cyan',
      displayName: 'Cyan Sky',
      primary: '#06B6D4',
      secondary: '#22D3EE',
      tertiary: '#67E8F9',
      background: '#F0FDFA',
      text: '#1A1A1A'
    },
    sky: {
      name: 'sky',
      displayName: 'Sky Blue',
      primary: '#0EA5E9',
      secondary: '#38BDF8',
      tertiary: '#7DD3FC',
      background: '#F0F9FF',
      text: '#1A1A1A'
    },
    rose: {
      name: 'rose',
      displayName: 'Rose Gold',
      primary: '#F43F5E',
      secondary: '#FB7185',
      tertiary: '#FCA5A5',
      background: '#FFF1F2',
      text: '#1A1A1A'
    },
    peach: {
      name: 'peach',
      displayName: 'Peach Blossom',
      primary: '#FF8A65',
      secondary: '#FFAB91',
      tertiary: '#FFCCBC',
      background: '#FFF5F2',
      text: '#1A1A1A'
    },

    // Dark Themes
    dark: {
      name: 'dark',
      displayName: 'Dark Mode',
      primary: '#E91E63',
      secondary: '#00BCD4',
      tertiary: '#8BC34A',
      background: '#1A1A1A',
      text: '#F5F5F5'
    },
    midnight: {
      name: 'midnight',
      displayName: 'Midnight Blue',
      primary: '#5C6BC0',
      secondary: '#7986CB',
      tertiary: '#9FA8DA',
      background: '#1A1A2E',
      text: '#E8EAF6'
    },
    darkBlue: {
      name: 'darkBlue',
      displayName: 'Dark Blue',
      primary: '#3B82F6',
      secondary: '#60A5FA',
      tertiary: '#93C5FD',
      background: '#0F172A',
      text: '#DBEAFE'
    },
    darkGreen: {
      name: 'darkGreen',
      displayName: 'Dark Green',
      primary: '#10B981',
      secondary: '#34D399',
      tertiary: '#6EE7B7',
      background: '#064E3B',
      text: '#D1FAE5'
    },
    darkPurple: {
      name: 'darkPurple',
      displayName: 'Dark Purple',
      primary: '#8B5CF6',
      secondary: '#A78BFA',
      tertiary: '#C4B5FD',
      background: '#1E1B4B',
      text: '#EDE9FE'
    },
    darkRed: {
      name: 'darkRed',
      displayName: 'Dark Red',
      primary: '#EF4444',
      secondary: '#F87171',
      tertiary: '#FCA5A5',
      background: '#7F1D1D',
      text: '#FEE2E2'
    },
    darkOrange: {
      name: 'darkOrange',
      displayName: 'Dark Orange',
      primary: '#F97316',
      secondary: '#FB923C',
      tertiary: '#FDBA74',
      background: '#7C2D12',
      text: '#FFEDD5'
    },
    darkPink: {
      name: 'darkPink',
      displayName: 'Dark Pink',
      primary: '#EC4899',
      secondary: '#F472B6',
      tertiary: '#F9A8D4',
      background: '#831843',
      text: '#FCE7F3'
    },
    darkTeal: {
      name: 'darkTeal',
      displayName: 'Dark Teal',
      primary: '#14B8A6',
      secondary: '#5EEAD4',
      tertiary: '#99F6E4',
      background: '#134E4A',
      text: '#CCFBF1'
    },
    darkCyan: {
      name: 'darkCyan',
      displayName: 'Dark Cyan',
      primary: '#06B6D4',
      secondary: '#22D3EE',
      tertiary: '#67E8F9',
      background: '#164E63',
      text: '#CFFAFE'
    },
    darkAmber: {
      name: 'darkAmber',
      displayName: 'Dark Amber',
      primary: '#F59E0B',
      secondary: '#FBBF24',
      tertiary: '#FCD34D',
      background: '#78350F',
      text: '#FEF3C7'
    },
    darkIndigo: {
      name: 'darkIndigo',
      displayName: 'Dark Indigo',
      primary: '#6366F1',
      secondary: '#818CF8',
      tertiary: '#A5B4FC',
      background: '#1E1B4B',
      text: '#E0E7FF'
    },
    darkViolet: {
      name: 'darkViolet',
      displayName: 'Dark Violet',
      primary: '#7C3AED',
      secondary: '#8B5CF6',
      tertiary: '#A78BFA',
      background: '#2E1065',
      text: '#EDE9FE'
    },
    darkEmerald: {
      name: 'darkEmerald',
      displayName: 'Dark Emerald',
      primary: '#10B981',
      secondary: '#34D399',
      tertiary: '#6EE7B7',
      background: '#064E3B',
      text: '#D1FAE5'
    },
    darkLime: {
      name: 'darkLime',
      displayName: 'Dark Lime',
      primary: '#84CC16',
      secondary: '#A3E635',
      tertiary: '#D9F99D',
      background: '#365314',
      text: '#ECFCCB'
    },
    darkRose: {
      name: 'darkRose',
      displayName: 'Dark Rose',
      primary: '#F43F5E',
      secondary: '#FB7185',
      tertiary: '#FCA5A5',
      background: '#881337',
      text: '#FFE4E6'
    },
    darkSky: {
      name: 'darkSky',
      displayName: 'Dark Sky',
      primary: '#0EA5E9',
      secondary: '#38BDF8',
      tertiary: '#7DD3FC',
      background: '#0C4A6E',
      text: '#E0F2FE'
    },
    darkSlate: {
      name: 'darkSlate',
      displayName: 'Dark Slate',
      primary: '#64748B',
      secondary: '#94A3B8',
      tertiary: '#CBD5E1',
      background: '#0F172A',
      text: '#F1F5F9'
    },
    darkZinc: {
      name: 'darkZinc',
      displayName: 'Dark Zinc',
      primary: '#71717A',
      secondary: '#A1A1AA',
      tertiary: '#D4D4D8',
      background: '#18181B',
      text: '#F4F4F5'
    },
    darkStone: {
      name: 'darkStone',
      displayName: 'Dark Stone',
      primary: '#78716C',
      secondary: '#A8A29E',
      tertiary: '#D6D3D1',
      background: '#1C1917',
      text: '#F5F5F4'
    },
  };

  constructor() {
    this.loadTheme();
  }

  getThemes(): Theme[] {
    const themes = Object.values(this.themes);
    // Sort themes to put 'default' first
    return themes.sort((a, b) => {
      if (a.name === 'default') return -1;
      if (b.name === 'default') return 1;
      return 0;
    });
  }

  getThemesByMode(isDark: boolean): Theme[] {
    const filtered = Object.values(this.themes).filter(theme => {
      const isDarkBackground = this.isDarkColor(theme.background);
      return isDark ? isDarkBackground : !isDarkBackground;
    });
    // Sort to put default theme first (default for light, dark for dark mode)
    return filtered.sort((a, b) => {
      const defaultName = isDark ? 'dark' : 'default';
      if (a.name === defaultName) return -1;
      if (b.name === defaultName) return 1;
      return 0;
    });
  }

  getCurrentTheme(): string {
    return this.currentThemeSubject.value;
  }

  setTheme(themeName: string): void {
    if (!this.themes[themeName]) {
      console.warn(`Theme ${themeName} not found`);
      return;
    }

    const theme = this.themes[themeName];
    const root = document.documentElement;

    // Apply theme colors - use !important equivalent by setting directly
    root.style.setProperty('--ion-color-primary', theme.primary);
    root.style.setProperty('--ion-color-secondary', theme.secondary);
    root.style.setProperty('--ion-color-tertiary', theme.tertiary);
    root.style.setProperty('--ion-background-color', theme.background);
    root.style.setProperty('--ion-text-color', theme.text);
    
    // Force immediate update by triggering a reflow
    void root.offsetHeight;

    // Calculate RGB values
    const primaryRgb = this.hexToRgb(theme.primary);
    const secondaryRgb = this.hexToRgb(theme.secondary);
    const tertiaryRgb = this.hexToRgb(theme.tertiary);
    const textRgb = this.hexToRgb(theme.text);

    if (primaryRgb) {
      root.style.setProperty('--ion-color-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    }
    if (secondaryRgb) {
      root.style.setProperty('--ion-color-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
    }
    if (tertiaryRgb) {
      root.style.setProperty('--ion-color-tertiary-rgb', `${tertiaryRgb.r}, ${tertiaryRgb.g}, ${tertiaryRgb.b}`);
    }
    if (textRgb) {
      root.style.setProperty('--ion-text-color-rgb', `${textRgb.r}, ${textRgb.g}, ${textRgb.b}`);
      
      // Set text color step variables for better text rendering
      const isDarkText = this.isDarkColor(theme.text);
      if (isDarkText) {
        // Dark text on light background - steps get lighter
        root.style.setProperty('--ion-text-color-step-50', this.tintColor(theme.text, 5));
        root.style.setProperty('--ion-text-color-step-100', this.tintColor(theme.text, 10));
        root.style.setProperty('--ion-text-color-step-150', this.tintColor(theme.text, 15));
        root.style.setProperty('--ion-text-color-step-200', this.tintColor(theme.text, 20));
        root.style.setProperty('--ion-text-color-step-250', this.tintColor(theme.text, 25));
        root.style.setProperty('--ion-text-color-step-300', this.tintColor(theme.text, 30));
        root.style.setProperty('--ion-text-color-step-350', this.tintColor(theme.text, 35));
        root.style.setProperty('--ion-text-color-step-400', this.tintColor(theme.text, 40));
        root.style.setProperty('--ion-text-color-step-450', this.tintColor(theme.text, 45));
        root.style.setProperty('--ion-text-color-step-500', '#FFFFFF');
      } else {
        // Light text on dark background - steps get darker
        root.style.setProperty('--ion-text-color-step-50', this.shadeColor(theme.text, -5));
        root.style.setProperty('--ion-text-color-step-100', this.shadeColor(theme.text, -10));
        root.style.setProperty('--ion-text-color-step-150', this.shadeColor(theme.text, -15));
        root.style.setProperty('--ion-text-color-step-200', this.shadeColor(theme.text, -20));
        root.style.setProperty('--ion-text-color-step-250', this.shadeColor(theme.text, -25));
        root.style.setProperty('--ion-text-color-step-300', this.shadeColor(theme.text, -30));
        root.style.setProperty('--ion-text-color-step-350', this.shadeColor(theme.text, -35));
        root.style.setProperty('--ion-text-color-step-400', this.shadeColor(theme.text, -40));
        root.style.setProperty('--ion-text-color-step-450', this.shadeColor(theme.text, -45));
        root.style.setProperty('--ion-text-color-step-500', '#000000');
      }
    }

    // Calculate shades and tints
    root.style.setProperty('--ion-color-primary-shade', this.shadeColor(theme.primary, -20));
    root.style.setProperty('--ion-color-primary-tint', this.tintColor(theme.primary, 20));
    root.style.setProperty('--ion-color-secondary-shade', this.shadeColor(theme.secondary, -20));
    root.style.setProperty('--ion-color-secondary-tint', this.tintColor(theme.secondary, 20));
    root.style.setProperty('--ion-color-tertiary-shade', this.shadeColor(theme.tertiary, -20));
    root.style.setProperty('--ion-color-tertiary-tint', this.tintColor(theme.tertiary, 20));

    // Set contrast colors
    const primaryContrast = this.getContrastColor(theme.primary);
    const secondaryContrast = this.getContrastColor(theme.secondary);
    const tertiaryContrast = this.getContrastColor(theme.tertiary);
    
    root.style.setProperty('--ion-color-primary-contrast', primaryContrast);
    root.style.setProperty('--ion-color-secondary-contrast', secondaryContrast);
    root.style.setProperty('--ion-color-tertiary-contrast', tertiaryContrast);

    const primaryContrastRgb = this.hexToRgb(primaryContrast);
    const secondaryContrastRgb = this.hexToRgb(secondaryContrast);
    const tertiaryContrastRgb = this.hexToRgb(tertiaryContrast);

    if (primaryContrastRgb) {
      root.style.setProperty('--ion-color-primary-contrast-rgb', `${primaryContrastRgb.r}, ${primaryContrastRgb.g}, ${primaryContrastRgb.b}`);
    }
    if (secondaryContrastRgb) {
      root.style.setProperty('--ion-color-secondary-contrast-rgb', `${secondaryContrastRgb.r}, ${secondaryContrastRgb.g}, ${secondaryContrastRgb.b}`);
    }
    if (tertiaryContrastRgb) {
      root.style.setProperty('--ion-color-tertiary-contrast-rgb', `${tertiaryContrastRgb.r}, ${tertiaryContrastRgb.g}, ${tertiaryContrastRgb.b}`);
    }

    // Check if background is dark
    const isDarkBackground = this.isDarkColor(theme.background);
    const isDarkPrimary = this.isDarkColor(theme.primary);
    
    // Toggle dark class for dark theme
    if (themeName === 'dark' || theme.background === '#1A1A1A' || isDarkBackground) {
      document.body.classList.add('dark');
      // Also set CSS variables on body.dark to override variables.scss hardcoded values
      // This ensures the selected theme's colors are applied even when body.dark class is present
      if (primaryRgb) {
        document.body.style.setProperty('--ion-color-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
      }
      if (secondaryRgb) {
        document.body.style.setProperty('--ion-color-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
      }
      if (tertiaryRgb) {
        document.body.style.setProperty('--ion-color-tertiary-rgb', `${tertiaryRgb.r}, ${tertiaryRgb.g}, ${tertiaryRgb.b}`);
      }
      if (textRgb) {
        document.body.style.setProperty('--ion-text-color-rgb', `${textRgb.r}, ${textRgb.g}, ${textRgb.b}`);
      }
      document.body.style.setProperty('--ion-color-primary', theme.primary);
      document.body.style.setProperty('--ion-color-primary-shade', this.shadeColor(theme.primary, -20));
      document.body.style.setProperty('--ion-color-primary-tint', this.tintColor(theme.primary, 20));
      document.body.style.setProperty('--ion-color-primary-contrast', primaryContrast);
      document.body.style.setProperty('--ion-color-secondary', theme.secondary);
      document.body.style.setProperty('--ion-color-secondary-shade', this.shadeColor(theme.secondary, -20));
      document.body.style.setProperty('--ion-color-secondary-tint', this.tintColor(theme.secondary, 20));
      document.body.style.setProperty('--ion-color-secondary-contrast', secondaryContrast);
      document.body.style.setProperty('--ion-color-tertiary', theme.tertiary);
      document.body.style.setProperty('--ion-color-tertiary-shade', this.shadeColor(theme.tertiary, -20));
      document.body.style.setProperty('--ion-color-tertiary-tint', this.tintColor(theme.tertiary, 20));
      document.body.style.setProperty('--ion-color-tertiary-contrast', tertiaryContrast);
      document.body.style.setProperty('--ion-background-color', theme.background);
      document.body.style.setProperty('--ion-text-color', theme.text);
      if (primaryContrastRgb) {
        document.body.style.setProperty('--ion-color-primary-contrast-rgb', `${primaryContrastRgb.r}, ${primaryContrastRgb.g}, ${primaryContrastRgb.b}`);
      }
      if (secondaryContrastRgb) {
        document.body.style.setProperty('--ion-color-secondary-contrast-rgb', `${secondaryContrastRgb.r}, ${secondaryContrastRgb.g}, ${secondaryContrastRgb.b}`);
      }
      if (tertiaryContrastRgb) {
        document.body.style.setProperty('--ion-color-tertiary-contrast-rgb', `${tertiaryContrastRgb.r}, ${tertiaryContrastRgb.g}, ${tertiaryContrastRgb.b}`);
      }
    } else {
      document.body.classList.remove('dark');
      // Clear body styles when not in dark mode to use :root values
      document.body.style.removeProperty('--ion-color-primary');
      document.body.style.removeProperty('--ion-color-primary-rgb');
      document.body.style.removeProperty('--ion-color-primary-shade');
      document.body.style.removeProperty('--ion-color-primary-tint');
      document.body.style.removeProperty('--ion-color-primary-contrast');
      document.body.style.removeProperty('--ion-color-primary-contrast-rgb');
      document.body.style.removeProperty('--ion-color-secondary');
      document.body.style.removeProperty('--ion-color-secondary-rgb');
      document.body.style.removeProperty('--ion-color-secondary-shade');
      document.body.style.removeProperty('--ion-color-secondary-tint');
      document.body.style.removeProperty('--ion-color-secondary-contrast');
      document.body.style.removeProperty('--ion-color-secondary-contrast-rgb');
      document.body.style.removeProperty('--ion-color-tertiary');
      document.body.style.removeProperty('--ion-color-tertiary-rgb');
      document.body.style.removeProperty('--ion-color-tertiary-shade');
      document.body.style.removeProperty('--ion-color-tertiary-tint');
      document.body.style.removeProperty('--ion-color-tertiary-contrast');
      document.body.style.removeProperty('--ion-color-tertiary-contrast-rgb');
      document.body.style.removeProperty('--ion-background-color');
      document.body.style.removeProperty('--ion-text-color');
      document.body.style.removeProperty('--ion-text-color-rgb');
    }

    // Set card background based on theme
    // For dark themes, use a slightly lighter version of the theme background
    // For light themes, use white
    let cardBackground: string;
    if (isDarkBackground) {
      // Create a slightly lighter version of the dark background for cards
      const bgRgb = this.hexToRgb(theme.background);
      if (bgRgb) {
        // Lighten by 10-15% for better contrast
        cardBackground = this.tintColor(theme.background, 10);
      } else {
        cardBackground = '#2A2A2A'; // Fallback
      }
    } else {
      cardBackground = '#FFFFFF';
    }
    root.style.setProperty('--ion-card-background', cardBackground);

    // Set tab bar colors with proper contrast
    // Use the theme's background color directly for dark themes
    const tabBarBackground = isDarkBackground ? theme.background : '#FFFFFF';
    let tabBarSelectedColor = theme.primary;
    
    // If both primary and background are dark, use a lighter variant
    if (isDarkBackground && isDarkPrimary) {
      const primaryTint = this.tintColor(theme.primary, 50);
      const isSecondaryLighter = !this.isDarkColor(theme.secondary);
      const isTertiaryLighter = !this.isDarkColor(theme.tertiary);
      
      if (isSecondaryLighter) {
        tabBarSelectedColor = theme.secondary;
      } else if (isTertiaryLighter) {
        tabBarSelectedColor = theme.tertiary;
      } else {
        tabBarSelectedColor = primaryTint;
      }
    }

    root.style.setProperty('--ion-tab-bar-background', tabBarBackground);
    root.style.setProperty('--ion-tab-bar-color', isDarkBackground ? '#92949c' : '#92949c');
    root.style.setProperty('--ion-tab-bar-color-selected', tabBarSelectedColor);

    // Set shadow colors based on background
    const shadowColor = isDarkBackground ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)';
    const shadowColorLight = isDarkBackground ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.08)';
    root.style.setProperty('--ion-shadow-color', shadowColor);
    root.style.setProperty('--ion-shadow-color-light', shadowColorLight);

    // Set border colors
    const borderColor = isDarkBackground ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    root.style.setProperty('--ion-border-color', borderColor);

    // Ensure body background matches theme
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;

    // Force update ion-content background to match theme
    setTimeout(() => {
      const ionContentElements = document.querySelectorAll('ion-content');
      ionContentElements.forEach((content: Element) => {
        const htmlContent = content as HTMLElement;
        htmlContent.style.setProperty('--background', theme.background);
        htmlContent.style.setProperty('background-color', theme.background);
        // Also set on the shadow root if accessible
        try {
          const shadowRoot = htmlContent.shadowRoot;
          if (shadowRoot) {
            const style = shadowRoot.querySelector('style') || document.createElement('style');
            if (!shadowRoot.querySelector('style')) {
              shadowRoot.appendChild(style);
            }
            style.textContent = `:host { --background: ${theme.background} !important; background-color: ${theme.background} !important; }`;
          }
        } catch (e) {
          // Shadow root might not be accessible, continue
        }
      });
      
      // Update segment wrapper and custom segment backgrounds
      const segmentWrapper = document.querySelector('.segment-wrapper');
      if (segmentWrapper && primaryRgb && secondaryRgb) {
        const opacity = isDarkBackground ? 0.1 : 0.05;
        (segmentWrapper as HTMLElement).style.setProperty('background', 
          `linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${opacity}) 0%, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, ${opacity}) 100%)`);
      }
      
      const customSegment = document.querySelector('.custom-segment');
      if (customSegment) {
        const bgRgb = this.hexToRgb(theme.background);
        if (bgRgb && isDarkBackground) {
          (customSegment as HTMLElement).style.setProperty('--segment-bg-color', 
            `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.8)`);
          (customSegment as HTMLElement).style.setProperty('background', 
            `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.8)`);
        } else {
          (customSegment as HTMLElement).style.setProperty('background', 'rgba(255, 255, 255, 0.8)');
          (customSegment as HTMLElement).style.removeProperty('--segment-bg-color');
        }
      }
      
      // Force update segment buttons to reflect new text color
      const segmentButtons = document.querySelectorAll('.custom-segment ion-segment-button');
      segmentButtons.forEach((button: Element) => {
        const htmlButton = button as HTMLElement;
        htmlButton.style.setProperty('--color', theme.text);
        htmlButton.style.setProperty('color', theme.text);
        
        const icon = htmlButton.querySelector('ion-icon');
        if (icon) {
          (icon as HTMLElement).style.setProperty('color', theme.text);
        }
        
        const label = htmlButton.querySelector('ion-label');
        if (label) {
          const labelEl = label as HTMLElement;
          if (!htmlButton.classList.contains('segment-button-checked')) {
            labelEl.style.setProperty('color', theme.text);
            labelEl.style.setProperty('--color', theme.text);
          }
        }
      });
      
      // Also update body background to ensure consistency
      document.body.style.backgroundColor = theme.background;
      
      // Trigger a reflow to ensure CSS variables are applied
      void document.body.offsetHeight;
    }, 0);

    // Save to localStorage
    localStorage.setItem(this.STORAGE_KEY, themeName);
    this.currentThemeSubject.next(themeName);
  }

  private loadTheme(): void {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) || 'default';
    this.setTheme(savedTheme);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  private shadeColor(color: string, percent: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const r = Math.max(0, Math.min(255, rgb.r + (rgb.r * percent) / 100));
    const g = Math.max(0, Math.min(255, rgb.g + (rgb.g * percent) / 100));
    const b = Math.max(0, Math.min(255, rgb.b + (rgb.b * percent) / 100));

    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }

  private tintColor(color: string, percent: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const r = Math.min(255, rgb.r + (255 - rgb.r) * (percent / 100));
    const g = Math.min(255, rgb.g + (255 - rgb.g) * (percent / 100));
    const b = Math.min(255, rgb.b + (255 - rgb.b) * (percent / 100));

    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }

  private getContrastColor(hexColor: string): string {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return '#000000';

    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  isDarkColor(hexColor: string): boolean {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return false;

    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    // Consider colors with luminance < 0.5 as dark
    return luminance < 0.5;
  }
}

