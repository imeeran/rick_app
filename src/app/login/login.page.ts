import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personOutline, 
  lockClosedOutline, 
  carOutline, 
  eyeOutline, 
  eyeOffOutline
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    ReactiveFormsModule
  ]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    addIcons({ 
      personOutline, 
      lockClosedOutline, 
      carOutline,
      eyeOutline,
      eyeOffOutline
    });
  }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      rick: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    // Clear previous error message
    this.errorMessage = '';
    this.loginForm.setErrors(null);

    if (this.loginForm.valid) {
      this.isLoading = true;
      
      const rick = this.loginForm.get('rick')?.value?.trim();
      const password = this.loginForm.get('password')?.value?.trim();

      this.authService.login({ rick: rick?.toUpperCase(), password }).subscribe({
        next: (response) => {
          this.isLoading = false;
          // Login successful - navigate to tabs page
          this.router.navigate(['/tabs/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          // Use user-friendly message - never show raw HTTP errors (e.g. "Http failure response... 0 Unknown Error")
          const msg = error?.message || '';
          this.errorMessage = (msg.includes('Http failure') || msg.includes('Unknown Error'))
            ? 'Unable to connect. Please check your connection and try again.'
            : (msg || 'Login failed. Please try again.');
          this.loginForm.setErrors({ apiError: true });
          this.loginForm.get('rick')?.markAsTouched();
          this.loginForm.get('password')?.markAsTouched();
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  get rickControl() {
    return this.loginForm.get('rick');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }
}

