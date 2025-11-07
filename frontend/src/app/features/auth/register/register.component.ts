import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>建立新帳號</h1>
          <p>開始您的專案管理之旅</p>
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="auth-form">
          @if (errorMessage()) {
            <div class="error-message">
              {{ errorMessage() }}
            </div>
          }

          <div class="form-group">
            <label for="fullName">姓名</label>
            <input
              id="fullName"
              type="text"
              formControlName="fullName"
              placeholder="請輸入您的姓名"
              [class.error]="isFieldInvalid('fullName')"
            />
            @if (isFieldInvalid('fullName')) {
              <span class="field-error">
                @if (registerForm.get('fullName')?.errors?.['required']) {
                  請輸入姓名
                } @else if (registerForm.get('fullName')?.errors?.['minlength']) {
                  姓名至少需要 2 個字元
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="email">電子郵件</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="your@email.com"
              [class.error]="isFieldInvalid('email')"
            />
            @if (isFieldInvalid('email')) {
              <span class="field-error">
                @if (registerForm.get('email')?.errors?.['required']) {
                  請輸入電子郵件
                } @else if (registerForm.get('email')?.errors?.['email']) {
                  請輸入有效的電子郵件格式
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="password">密碼</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="至少 8 個字元"
              [class.error]="isFieldInvalid('password')"
            />
            @if (isFieldInvalid('password')) {
              <span class="field-error">
                @if (registerForm.get('password')?.errors?.['required']) {
                  請輸入密碼
                } @else if (registerForm.get('password')?.errors?.['minlength']) {
                  密碼至少需要 8 個字元
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="confirmPassword">確認密碼</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="請再次輸入密碼"
              [class.error]="isFieldInvalid('confirmPassword')"
            />
            @if (isFieldInvalid('confirmPassword')) {
              <span class="field-error">
                @if (registerForm.get('confirmPassword')?.errors?.['required']) {
                  請確認密碼
                } @else if (registerForm.get('confirmPassword')?.errors?.['passwordMismatch']) {
                  密碼不一致
                }
              </span>
            }
          </div>

          <button
            type="submit"
            class="btn-primary"
            [disabled]="registerForm.invalid || loading()"
          >
            @if (loading()) {
              <span>註冊中...</span>
            } @else {
              <span>註冊</span>
            }
          </button>
        </form>

        <div class="auth-footer">
          <p>
            已經有帳號了？
            <a routerLink="/auth/login" class="link">立即登入</a>
          </p>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .auth-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 420px;
      padding: 40px;
    }

    .auth-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .auth-header h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
      color: #1a202c;
    }

    .auth-header p {
      margin: 0;
      color: #718096;
      font-size: 14px;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: #2d3748;
    }

    .form-group input {
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-group input.error {
      border-color: #e53e3e;
    }

    .field-error {
      font-size: 12px;
      color: #e53e3e;
    }

    .error-message {
      background: #fed7d7;
      color: #c53030;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      border: 1px solid #fc8181;
    }

    .btn-primary {
      background: #667eea;
      color: white;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .auth-footer {
      margin-top: 24px;
      text-align: center;
      font-size: 14px;
      color: #718096;
    }

    .auth-footer .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }

    .auth-footer .link:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    registerForm: FormGroup;
    loading = signal(false);
    errorMessage = signal<string | null>(null);

    constructor() {
        this.registerForm = this.fb.group({
            fullName: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]]
        }, {
            validators: this.passwordMatchValidator
        });
    }

    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const password = control.get('password');
        const confirmPassword = control.get('confirmPassword');

        if (!password || !confirmPassword) {
            return null;
        }

        return password.value === confirmPassword.value
            ? null
            : { passwordMismatch: true };
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.registerForm.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched));
    }

    onSubmit(): void {
        if (this.registerForm.invalid) {
            this.markFormGroupTouched();
            return;
        }

        this.loading.set(true);
        this.errorMessage.set(null);

        const { fullName, email, password } = this.registerForm.value;

        this.authService.register(email, password, fullName).subscribe({
            next: () => {
                this.loading.set(false);
                this.router.navigate(['/dashboard']);
            },
            error: (error) => {
                this.loading.set(false);
                if (error.error?.error) {
                    if (Array.isArray(error.error.error)) {
                        this.errorMessage.set(error.error.error.map((e: any) => e.message).join(', '));
                    } else {
                        this.errorMessage.set(error.error.error);
                    }
                } else {
                    this.errorMessage.set('註冊失敗，請稍後再試');
                }
            }
        });
    }

    private markFormGroupTouched(): void {
        Object.keys(this.registerForm.controls).forEach(key => {
            const control = this.registerForm.get(key);
            control?.markAsTouched();
        });
    }
}

