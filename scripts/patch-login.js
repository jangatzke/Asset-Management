const fs = require('fs');
const p = 'frontend/src/pages/Login.tsx';
let s = fs.readFileSync(p, 'utf8');
const before = s;

function rep(find, replace) {
  if (!s.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 60)); process.exitCode = 1; return; }
  s = s.split(find).join(replace);
}

// Titles
rep('>ISMS Asset Manager</h1>', ">{t('navigation.applicationName')}</h1>");
rep('Create the first administrator account', "{t('login.firstAdminTitle')}");
rep('This will create the initial admin account. After this, all new users will be managed by administrators.', "{t('login.firstAdminHint')}");

// Multi-line labels
s = s.replace(/(\n\s*)First Name(\n\s*<\/label>)/g, "$1{t('adminUsers.fields.firstName')}$2");
s = s.replace(/(\n\s*)Last Name(\n\s*<\/label>)/g, "$1{t('adminUsers.fields.lastName')}$2");
s = s.replace(/(\n\s*)Email(\n\s*<\/label>)/g, "$1{t('login.email')}$2");
s = s.replace(/(\n\s*)Password(\n\s*<\/label>)/g, "$1{t('login.password')}$2");

// Single-line labels / placeholders
rep('<label htmlFor="newPassword" className={loginLabelClass}>New password</label>', "<label htmlFor=\"newPassword\" className={loginLabelClass}>{t('settings.newPassword')}</label>");
rep('<label htmlFor="mfaToken" className={loginLabelClass}>Authenticator code</label>', "<label htmlFor=\"mfaToken\" className={loginLabelClass}>{t('settings.mfaCode')}</label>");
rep('placeholder="First name"', "placeholder={t('adminUsers.fields.firstName')}");
rep('placeholder="Last name"', "placeholder={t('adminUsers.fields.lastName')}");
rep('placeholder="Password"', "placeholder={t('login.password')}");
rep('placeholder="New password"', "placeholder={t('settings.newPassword')}");

// Buttons / prompts
rep("{submitting ? 'Creating account…' : 'Create Admin Account'}", "{submitting ? t('login.creatingAccount') : t('login.createAdminAccount')}");
rep("{mode === 'login' ? 'Sign in to your account' : 'Create your account'}", "{mode === 'login' ? t('login.signInPrompt') : t('login.createAccountPrompt')}");
rep("'Enter your authenticator code to complete sign-in.'", "t('login.mfaRequiredHint')");
rep("'MFA enrollment is required. Scan the QR code and enter the generated code.'", "t('login.mfaEnrollmentHint')");
rep("'Your password must be changed before sign-in can continue.'", "t('login.passwordChangeHint')");
rep('alt="MFA setup QR code"', "alt={t('login.mfaQrAlt')}");
rep("{submitting ? 'Please wait…' : preAuthState === 'mfa_required' ? 'Verify code' : preAuthState === 'mfa_enrollment_required' ? 'Confirm MFA setup' : preAuthState === 'password_change_required' ? 'Change password' : mode === 'login' ? 'Sign In' : 'Create Account'}",
  "{submitting ? t('login.pleaseWait') : preAuthState === 'mfa_required' ? t('login.verifyCode') : preAuthState === 'mfa_enrollment_required' ? t('login.confirmMfaSetup') : preAuthState === 'password_change_required' ? t('login.changePassword') : mode === 'login' ? t('login.signIn') : t('login.createAccount')}");
rep('{mode === \'login\' ? "Don\'t have an account? Register" : \'Already have an account? Sign In\'}',
  "{mode === 'login' ? t('login.noAccount') + ' ' + t('login.register') : t('login.haveAccount') + ' ' + t('login.signIn')}");

if (s !== before) { fs.writeFileSync(p, s); console.log('PATCHED Login.tsx'); } else { console.error('NO CHANGES'); process.exitCode = 1; }
