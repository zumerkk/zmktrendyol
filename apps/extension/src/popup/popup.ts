/**
 * ZMK Extension — Popup Script
 * Handles login/logout and auth state display
 */

document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('popup-auth')!;
    const userSection = document.getElementById('popup-user')!;
    const loginBtn = document.getElementById('login-btn')!;
    const logoutBtn = document.getElementById('logout-btn')!;
    const loginError = document.getElementById('login-error')!;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;

    // Check current auth state
    chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
        if (response?.success) {
            showUserSection(response.user);
        } else {
            showAuthSection();
        }
    });

    // Login
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError('E-posta ve şifre gereklidir');
            return;
        }

        loginBtn.textContent = 'Giriş yapılıyor...';
        (loginBtn as HTMLButtonElement).disabled = true;

        chrome.runtime.sendMessage(
            { type: 'LOGIN', payload: { email, password } },
            (response) => {
                if (response?.success) {
                    showUserSection(response.user);
                } else {
                    showError(response?.error || 'Giriş başarısız');
                    loginBtn.textContent = 'Giriş Yap';
                    (loginBtn as HTMLButtonElement).disabled = false;
                }
            },
        );
    });

    // Enter key support
    passwordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
            showAuthSection();
        });
    });

    function showAuthSection() {
        authSection.classList.remove('hidden');
        userSection.classList.add('hidden');
    }

    function showUserSection(user: any) {
        authSection.classList.add('hidden');
        userSection.classList.remove('hidden');

        const userName = document.getElementById('user-name')!;
        const userEmail = document.getElementById('user-email')!;
        const userAvatar = document.getElementById('user-avatar')!;

        userName.textContent = user?.email?.split('@')[0] || 'Kullanıcı';
        userEmail.textContent = user?.email || '';
        userAvatar.textContent = (user?.email?.[0] || 'U').toUpperCase();
    }

    function showError(message: string) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
        setTimeout(() => loginError.classList.add('hidden'), 5000);
    }
});
