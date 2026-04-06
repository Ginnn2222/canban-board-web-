// ── Auth Logic ───────────────────────────────────────────

const authOverlay     = document.getElementById('auth-overlay');
const modeLogin       = document.getElementById('mode-login');
const modeRegister    = document.getElementById('mode-register');
const authSwitchBtn   = document.getElementById('auth-switch-btn');
const brandCtaText    = document.getElementById('brand-cta-text');

const loginEmailEl    = document.getElementById('login-email');
const loginPasswordEl = document.getElementById('login-password');
const loginError      = document.getElementById('login-error');
const loginSubmit     = document.getElementById('login-submit');

const regUsername     = document.getElementById('reg-username');
const regEmail        = document.getElementById('reg-email');
const regPassword     = document.getElementById('reg-password');
const regConfirm      = document.getElementById('reg-confirm');
const registerError   = document.getElementById('register-error');
const registerSubmit  = document.getElementById('register-submit');

const openLoginBtn    = document.getElementById('open-login-btn');
const userProfileBtn  = document.getElementById('user-profile-btn');
const userAvatar      = document.getElementById('user-avatar');
const userDropdown    = document.getElementById('user-dropdown');
const userDisplayName = document.getElementById('user-display-name');
const userDisplayEmail = document.getElementById('user-display-email');
const userNavName     = document.getElementById('user-nav-name');
const logoutBtn       = document.getElementById('logout-btn');

// ── In-memory current user ───────────────────────────────
window.currentUser = null;

function getCurrentUser() { return window.currentUser || null; }
function setCurrentUser(u) { window.currentUser = u; }
function getInitials(n)   { return n.trim().split(' ').map(w => w[0].toUpperCase()).slice(0,2).join(''); }

// ── API helper ───────────────────────────────────────────
async function authApi(data) {
    const res = await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// ── Mode switching ───────────────────────────────────────
let isLoginMode = true;
let photoPos    = { x: 50, y: 50 };

function switchToLogin() {
    isLoginMode = true;
    modeLogin.classList.add('active');
    modeRegister.classList.remove('active');
    brandCtaText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = 'Register';
    
    const savedEmail = localStorage.getItem('tralala_remember_email');
    const savedPass  = localStorage.getItem('tralala_remember_pass');
    loginEmailEl.value    = savedEmail || '';
    loginPasswordEl.value = savedPass || '';
    
    const loginRememberEl = document.getElementById('login-remember');
    if (loginRememberEl) loginRememberEl.checked = !!savedEmail;
    
    loginError.classList.add('hidden');
}

function switchToRegister() {
    isLoginMode = false;
    modeRegister.classList.add('active');
    modeLogin.classList.remove('active');
    brandCtaText.textContent = 'Already have an account?';
    authSwitchBtn.textContent = 'Login';
    regUsername.value = '';
    regEmail.value = '';
    regPassword.value = '';
    regConfirm.value = '';
    registerError.classList.add('hidden');
}

authSwitchBtn.addEventListener('click', () => {
    if (isLoginMode) switchToRegister();
    else switchToLogin();
});

// ── Helpers ──────────────────────────────────────────────
function showFieldMsg(el, msg, type = 'error') {
    el.textContent = msg;
    el.classList.remove('hidden', 'success', 'error');
    el.classList.add(type);
}
function hideMsg(el) { el.classList.add('hidden'); }

// ── Login ────────────────────────────────────────────────
loginSubmit.addEventListener('click', doLogin);
[loginEmailEl, loginPasswordEl].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); })
);

async function doLogin() {
    const email    = loginEmailEl.value.trim();
    const password = loginPasswordEl.value;
    if (!email || !password) { showFieldMsg(loginError, 'Email dan password harus diisi.'); return; }

    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Memproses...';
    try {
        const r = await authApi({ action: 'login', email, password });
        if (!r.ok) { showFieldMsg(loginError, r.message || 'Email atau password salah.'); return; }

        const loginRememberEl = document.getElementById('login-remember');
        if (loginRememberEl && loginRememberEl.checked) {
            localStorage.setItem('tralala_remember_email', email);
            localStorage.setItem('tralala_remember_pass', password);
        } else {
            localStorage.removeItem('tralala_remember_email');
            localStorage.removeItem('tralala_remember_pass');
        }

        setCurrentUser(r.data);
        applyAuthState(r.data);
        authOverlay.classList.add('hidden');
        showToast('Selamat datang, ' + r.data.username + '!');
        if (typeof loadBoard === 'function') await loadBoard();
    } catch(e) {
        showFieldMsg(loginError, 'Koneksi gagal. Coba lagi.');
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Masuk';
    }
}

// ── Register ─────────────────────────────────────────────
registerSubmit.addEventListener('click', doRegister);

async function doRegister() {
    const username = regUsername.value.trim();
    const email    = regEmail.value.trim();
    const password = regPassword.value;
    const confirm  = regConfirm.value;

    if (!username || !email || !password || !confirm) { showFieldMsg(registerError, 'Semua field harus diisi.'); return; }
    if (password !== confirm) { showFieldMsg(registerError, 'Password tidak cocok.'); return; }
    if (password.length < 6) { showFieldMsg(registerError, 'Password minimal 6 karakter.'); return; }

    registerSubmit.disabled = true;
    registerSubmit.textContent = 'Memproses...';
    try {
        const r = await authApi({ action: 'register', username, email, password });
        if (!r.ok) { showFieldMsg(registerError, r.message || 'Registrasi gagal.'); return; }

        // Akun berhasil dibuat → arahkan ke login, jangan auto-login
        switchToLogin();
        showFieldMsg(loginError, '✓ Akun berhasil dibuat! Silakan login.', 'success');
        loginEmailEl.value = email; // pre-fill email untuk kemudahan
        showToast('Akun berhasil dibuat! Silakan login.');
    } catch(e) {
        showFieldMsg(registerError, 'Koneksi gagal. Coba lagi.');
    } finally {
        registerSubmit.disabled = false;
        registerSubmit.textContent = 'Daftar';
    }
}

// ── Auth state ────────────────────────────────────────────
function applyAuthState(user) {
    if (!openLoginBtn || !userProfileBtn) return;
    if (user) {
        openLoginBtn.classList.add('hidden');
        userProfileBtn.classList.remove('hidden');
        if (userAvatar)      renderNavAvatar(userAvatar, user);
        if (userDisplayName) userDisplayName.textContent  = user.username;
        if (userDisplayEmail) userDisplayEmail.textContent = user.email;
        if (userNavName)     userNavName.textContent      = user.username;
    } else {
        openLoginBtn.classList.remove('hidden');
        userProfileBtn.classList.add('hidden');
    }
}

function renderNavAvatar(el, user) {
    if (!el) return;
    const imgEl = el.querySelector('#user-nav-photo');
    const iniEl = el.querySelector('#user-nav-initials');
    if (user && user.photo) {
        if (imgEl) { imgEl.src = user.photo; imgEl.classList.remove('hidden'); }
        if (iniEl) iniEl.classList.add('hidden');
        el.classList.add('has-photo');
    } else if (user) {
        if (imgEl) imgEl.classList.add('hidden');
        if (iniEl) { iniEl.textContent = getInitials(user.username); iniEl.classList.remove('hidden'); }
        el.classList.remove('has-photo');
    }
}

// ── Open / close auth overlay ────────────────────────────
openLoginBtn.addEventListener('click', () => {
    switchToLogin();
    authOverlay.classList.remove('hidden');
});

const authCloseBtn = document.getElementById('auth-close-btn');
if (authCloseBtn) {
    authCloseBtn.addEventListener('click', () => authOverlay.classList.add('hidden'));
}
authOverlay.addEventListener('click', e => {
    if (e.target === authOverlay) authOverlay.classList.add('hidden');
});

// ── Avatar dropdown ───────────────────────────────────────
userAvatar.addEventListener('click', e => {
    e.stopPropagation();
    userDropdown.classList.toggle('hidden');
});
document.addEventListener('click', e => {
    if (!userProfileBtn.contains(e.target)) userDropdown.classList.add('hidden');
});

// ── Logout ────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
    await authApi({ action: 'logout' });
    setCurrentUser(null);
    if (typeof boardData !== 'undefined') { boardData = []; }
    if (typeof renderAllLists === 'function') renderAllLists();
    applyAuthState(null);
    showLandingOnly();
    userDropdown.classList.add('hidden');
    showToast('Logout berhasil.');
});

// ── Auth eye ─────────────────────────────────────────────
document.querySelectorAll('.auth-eye').forEach(icon => {
    icon.addEventListener('click', () => {
        const input = document.getElementById(icon.dataset.target);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        icon.classList.toggle('fa-eye', isText);
        icon.classList.toggle('fa-eye-slash', !isText);
    });
});

// ─────────────────────────────────────────────────────────
// ── Profile Modal ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────

const profileModal       = document.getElementById('profile-modal');
const profileModalClose  = document.getElementById('profile-modal-close');
const openProfileBtn     = document.getElementById('open-profile-modal');

const profileAvatarPreview  = document.getElementById('profile-avatar-preview');
const profileAvatarInitials = document.getElementById('profile-avatar-initials');
const profileAvatarImg      = document.getElementById('profile-avatar-img');
const avatarDragHint        = document.getElementById('avatar-drag-hint');
const photoDragTip          = document.getElementById('photo-drag-tip');
const profilePhotoInput     = document.getElementById('profile-photo-input');
const profilePhotoRemove    = document.getElementById('profile-photo-remove');

const profileUsernameEl  = document.getElementById('profile-username');
const profileNameMsg     = document.getElementById('profile-name-msg');
const profileOldPw       = document.getElementById('profile-old-pw');
const profileNewPw       = document.getElementById('profile-new-pw');
const profileConfirmPw   = document.getElementById('profile-confirm-pw');
const profilePwMsg       = document.getElementById('profile-pw-msg');
const profileSaveAll     = document.getElementById('profile-save-all');
const profileGlobalMsg   = document.getElementById('profile-global-msg');

function openProfileModal() {
    const user = getCurrentUser();
    if (!user) return;
    profileUsernameEl.value = user.username;
    hideMsg(profileNameMsg);
    hideMsg(profilePwMsg);
    hideMsg(profileGlobalMsg);

    if (user.photo) {
        photoPos = user.photoPos || { x: 50, y: 50 };
        profileAvatarImg.src = user.photo;
        profileAvatarImg.style.display = 'block';
        profileAvatarInitials.style.display = 'none';
        profilePhotoRemove.classList.remove('hidden');
        if (avatarDragHint) avatarDragHint.classList.add('hidden');
        if (photoDragTip)   photoDragTip.classList.add('hidden');
        profileAvatarPreview.classList.add('has-photo');
    } else {
        photoPos = { x: 50, y: 50 };
        profileAvatarImg.style.display = 'none';
        profileAvatarInitials.style.display = 'block';
        profileAvatarInitials.textContent = getInitials(user.username);
        profilePhotoRemove.classList.add('hidden');
        if (avatarDragHint) avatarDragHint.classList.add('hidden');
        if (photoDragTip)   photoDragTip.classList.add('hidden');
        profileAvatarPreview.classList.remove('has-photo');
    }

    profileOldPw.value = '';
    profileNewPw.value = '';
    profileConfirmPw.value = '';
    profileModal.classList.remove('hidden');
    userDropdown.classList.add('hidden');
}

function closeProfileModal() { profileModal.classList.add('hidden'); }

openProfileBtn.addEventListener('click', openProfileModal);
profileModalClose.addEventListener('click', closeProfileModal);
profileModal.addEventListener('click', e => { if (e.target === profileModal) closeProfileModal(); });

// ── Photo upload & Canvas Cropper ─────────────────────────
const cropModal     = document.getElementById('cropper-modal');
const cropImg       = document.getElementById('cropper-img');
const cropMask      = document.getElementById('cropper-mask');
const cropCancel    = document.getElementById('cropper-cancel');
const cropConfirm   = document.getElementById('cropper-confirm');
const cropScale     = document.getElementById('cropper-scale');
const cropContainer = document.getElementById('cropper-container');
const CROP_SIZE     = 300;

let currentCropImg  = new Image();
let cropState       = { x: 0, y: 0, scale: 1 };
let imgRenderState  = { x: 0, y: 0, w: 0, h: 0 };
let isDragCrop      = false;
let startCropDrag   = { x: 0, y: 0 };

function updateCropTransform() {
    const size = CROP_SIZE * cropState.scale;
    cropMask.style.width  = size + 'px';
    cropMask.style.height = size + 'px';
    cropMask.style.left   = cropState.x + 'px';
    cropMask.style.top    = cropState.y + 'px';
}

function clampCropState() {
    const maskSize = CROP_SIZE * cropState.scale;
    const minX = imgRenderState.x, maxX = imgRenderState.x + imgRenderState.w - maskSize;
    const minY = imgRenderState.y, maxY = imgRenderState.y + imgRenderState.h - maskSize;
    cropState.x = maxX >= minX ? Math.max(minX, Math.min(cropState.x, maxX)) : imgRenderState.x + (imgRenderState.w - maskSize) / 2;
    cropState.y = maxY >= minY ? Math.max(minY, Math.min(cropState.y, maxY)) : imgRenderState.y + (imgRenderState.h - maskSize) / 2;
}

function initCropper(base64) {
    cropImg.src = base64;
    currentCropImg.src = base64;
    cropModal.classList.remove('hidden');
    currentCropImg.onload = () => {
        const rect    = cropContainer.getBoundingClientRect();
        const scaleFit = Math.min(rect.width / currentCropImg.width, rect.height / currentCropImg.height) * 0.9;
        imgRenderState.w = currentCropImg.width * scaleFit;
        imgRenderState.h = currentCropImg.height * scaleFit;
        imgRenderState.x = (rect.width - imgRenderState.w) / 2;
        imgRenderState.y = (rect.height - imgRenderState.h) / 2;
        cropImg.style.left   = imgRenderState.x + 'px';
        cropImg.style.top    = imgRenderState.y + 'px';
        cropImg.style.width  = imgRenderState.w + 'px';
        cropImg.style.height = imgRenderState.h + 'px';
        const maxScale = Math.max(0.1, Math.min(imgRenderState.w / CROP_SIZE, imgRenderState.h / CROP_SIZE));
        const initScale = Math.min(1, maxScale);
        cropState.scale = initScale;
        cropState.x = (rect.width - CROP_SIZE * initScale) / 2;
        cropState.y = (rect.height - CROP_SIZE * initScale) / 2;
        cropScale.value = initScale;
        cropScale.min = 0.1;
        cropScale.max = maxScale;
        clampCropState();
        updateCropTransform();
    };
}

profilePhotoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { showToast('Max file size 200MB!'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => initCropper(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
});

function startC(x, y) { isDragCrop = true; startCropDrag = { x: x - cropState.x, y: y - cropState.y }; }
function moveC(x, y)  { if (!isDragCrop) return; cropState.x = x - startCropDrag.x; cropState.y = y - startCropDrag.y; clampCropState(); updateCropTransform(); }
function endC()        { isDragCrop = false; }

if (cropContainer) {
    cropContainer.addEventListener('mousedown', e => { if (e.target === cropMask || e.target === cropContainer) startC(e.clientX, e.clientY); });
    document.addEventListener('mousemove', e => moveC(e.clientX, e.clientY));
    document.addEventListener('mouseup', endC);
    cropContainer.addEventListener('touchstart', e => { if (e.target === cropMask || e.target === cropContainer) startC(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
    document.addEventListener('touchmove', e => { if (isDragCrop) e.preventDefault(); moveC(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
    document.addEventListener('touchend', endC);
}

if (cropScale) {
    cropScale.addEventListener('input', e => {
        const newScale = parseFloat(e.target.value);
        const oldSize  = CROP_SIZE * cropState.scale;
        const newSize  = CROP_SIZE * newScale;
        cropState.x    = (cropState.x + oldSize / 2) - newSize / 2;
        cropState.y    = (cropState.y + oldSize / 2) - newSize / 2;
        cropState.scale = newScale;
        clampCropState();
        updateCropTransform();
    });
}

if (cropCancel) cropCancel.addEventListener('click', () => cropModal.classList.add('hidden'));

if (cropConfirm) {
    cropConfirm.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width  = CROP_SIZE;
        canvas.height = CROP_SIZE;
        const ctx = canvas.getContext('2d');
        const maskSize = CROP_SIZE * cropState.scale;
        const maskRelX = cropState.x - imgRenderState.x;
        const maskRelY = cropState.y - imgRenderState.y;
        const rawRatio = currentCropImg.width / imgRenderState.w;
        ctx.drawImage(currentCropImg,
            maskRelX * rawRatio, maskRelY * rawRatio, maskSize * rawRatio, maskSize * rawRatio,
            0, 0, CROP_SIZE, CROP_SIZE);
        applyFinalPhoto(canvas.toDataURL('image/jpeg', 0.95));
        cropModal.classList.add('hidden');
    });
}

async function applyFinalPhoto(base64) {
    photoPos = { x: 50, y: 50 };
    profileAvatarImg.src = base64;
    profileAvatarImg.style.display = 'block';
    profileAvatarInitials.style.display = 'none';
    profilePhotoRemove.classList.remove('hidden');
    if (avatarDragHint) avatarDragHint.classList.add('hidden');
    if (photoDragTip)   photoDragTip.classList.add('hidden');
    profileAvatarPreview.classList.add('has-photo');

    try {
        const r = await authApi({ action: 'update_photo', photo: base64 });
        if (r.ok) {
            const user = getCurrentUser();
            if (user) { user.photo = base64; user.photoPos = { x: 50, y: 50 }; setCurrentUser(user); }
            renderNavAvatar(userAvatar, getCurrentUser());
            showToast('Foto profil berhasil diperbarui!');
        }
    } catch(e) { showToast('Gagal menyimpan foto.'); }
}

profilePhotoRemove.addEventListener('click', async () => {
    profileAvatarImg.style.display = 'none';
    profileAvatarInitials.style.display = 'block';
    const user = getCurrentUser();
    if (user) profileAvatarInitials.textContent = getInitials(user.username);
    profilePhotoRemove.classList.add('hidden');
    if (avatarDragHint) avatarDragHint.classList.add('hidden');
    if (photoDragTip)   photoDragTip.classList.add('hidden');
    profileAvatarPreview.classList.remove('has-photo');

    try {
        const r = await authApi({ action: 'update_photo', photo: null });
        if (r.ok) {
            if (user) { user.photo = null; user.photoPos = { x: 50, y: 50 }; setCurrentUser(user); }
            renderNavAvatar(userAvatar, getCurrentUser());
            showToast('Foto profil dihapus.');
        }
    } catch(e) { showToast('Gagal menghapus foto.'); }
});

// ── Single Save All ───────────────────────────────────────
profileSaveAll.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (!user) return;

    const newName  = profileUsernameEl.value.trim();
    const oldPw    = profileOldPw.value;
    const newPw    = profileNewPw.value;
    const confPw   = profileConfirmPw.value;
    let errors = [];

    if (!newName) errors.push('Username tidak boleh kosong.');
    if (oldPw || newPw || confPw) {
        if (!oldPw || !newPw || !confPw)   errors.push('Isi semua field password.');
        else if (newPw.length < 6)          errors.push('Password baru minimal 6 karakter.');
        else if (newPw !== confPw)           errors.push('Konfirmasi password tidak cocok.');
    }
    if (errors.length) { showFieldMsg(profileGlobalMsg, errors.join(' '), 'error'); return; }

    profileSaveAll.disabled = true;
    try {
        const payload = { action: 'update_profile', username: newName };
        if (oldPw && newPw) { payload.old_password = oldPw; payload.new_password = newPw; }

        const r = await authApi(payload);
        if (!r.ok) { showFieldMsg(profileGlobalMsg, r.message, 'error'); return; }

        setCurrentUser(r.data);
        userDisplayName.textContent = r.data.username;
        if (userNavName) userNavName.textContent = r.data.username;
        renderNavAvatar(userAvatar, r.data);
        if (!r.data.photo) profileAvatarInitials.textContent = getInitials(r.data.username);

        profileOldPw.value = '';
        profileNewPw.value = '';
        profileConfirmPw.value = '';

        showFieldMsg(profileGlobalMsg, '✓ Perubahan berhasil disimpan!', 'success');
        showToast('Profil berhasil diperbarui!');
        setTimeout(() => hideMsg(profileGlobalMsg), 3000);
    } catch(e) {
        showFieldMsg(profileGlobalMsg, 'Koneksi gagal. Coba lagi.', 'error');
    } finally {
        profileSaveAll.disabled = false;
    }
});

// ── Profile eye toggle ────────────────────────────────────
document.querySelectorAll('.profile-eye').forEach(icon => {
    icon.addEventListener('click', () => {
        const input = document.getElementById(icon.dataset.target);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        icon.classList.toggle('fa-eye', isText);
        icon.classList.toggle('fa-eye-slash', !isText);
    });
});

// ── Init (async session check) ────────────────────────────
function showLandingOnly() {
    const lp = document.getElementById('landing-page');
    const bc = document.querySelector('.board-container');
    if (lp) lp.classList.remove('hidden');
    if (bc) bc.classList.add('hidden');
    document.body.classList.add('home-view');
}

(async function authInit() {
    try {
        const r = await authApi({ action: 'session_check' });
        if (r.ok && r.data) {
            setCurrentUser(r.data);
            applyAuthState(r.data);
            if (typeof loadBoard === 'function') await loadBoard();
        } else {
            applyAuthState(null);
            showLandingOnly();
        }
    } catch(e) {
        applyAuthState(null);
        showLandingOnly();
    }
})();

// ─────────────────────────────────────────────────────────
// ── How It Works Modal ────────────────────────────────────
// ─────────────────────────────────────────────────────────

const hiwModal      = document.getElementById('how-it-works-modal');
const hiwTrigger    = document.getElementById('brand-how-it-works');
const navHiwTrigger = document.getElementById('nav-how-it-works');
const hiwClose      = document.getElementById('hiw-close');
const hiwGotIt      = document.getElementById('hiw-got-it');

function openHiwModal()  { hiwModal.classList.remove('hidden'); }
function closeHiwModal() { hiwModal.classList.add('hidden'); }

if (hiwTrigger)    hiwTrigger.addEventListener('click',    e => { e.stopPropagation(); openHiwModal(); });
if (navHiwTrigger) navHiwTrigger.addEventListener('click', e => { e.stopPropagation(); openHiwModal(); });
[hiwClose, hiwGotIt].forEach(btn => { if (btn) btn.addEventListener('click', closeHiwModal); });
hiwModal.addEventListener('click', e => { if (e.target === hiwModal) closeHiwModal(); });
