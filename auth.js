(() => {
  let mode = "login";
  let role = "candidate";
  let telegramSetupToken = "";
  const form = document.getElementById("authForm");
  const config = window.PAYWORK_CONFIG || {};
  const apiBase = (config.supabaseUrl || "").replace(/\/$/, "");

  function savedSession() {
    try { return JSON.parse(localStorage.getItem("paywork_auth") || "null"); }
    catch (_) { return null; }
  }

  async function refreshSession(force = false) {
    let session = savedSession();
    if (!session?.access_token || session.demo) return session;
    const expiresAt = Number(session.expires_at || 0);
    if (!force && expiresAt > Math.floor(Date.now() / 1000) + 60) return session;
    if (!session.refresh_token) {
      if (force || (expiresAt && expiresAt <= Math.floor(Date.now() / 1000))) {
        localStorage.removeItem("paywork_auth");
        throw new Error("Kirish muddati tugadi. Qayta kiring.");
      }
      return session;
    }
    const response = await fetch(`${apiBase}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) {
      localStorage.removeItem("paywork_auth");
      throw new Error("Kirish muddati tugadi. Qayta kiring.");
    }
    session = { ...session, ...result, user: result.user || session.user };
    localStorage.setItem("paywork_auth", JSON.stringify(session));
    return session;
  }

  async function authenticatedFetch(url, options = {}) {
    let session = await refreshSession(false);
    if (!session?.access_token) throw new Error("Davom etish uchun tizimga kiring.");
    const send = current => {
      const headers = new Headers(options.headers || {});
      headers.set("apikey", config.publishableKey);
      headers.set("Authorization", `Bearer ${current.access_token}`);
      return fetch(url, { ...options, headers });
    };
    let response = await send(session);
    if (response.status === 401 && session.refresh_token) {
      session = await refreshSession(true);
      response = await send(session);
    }
    return response;
  }

  async function refreshUserProfile(session = savedSession()) {
    session = await refreshSession(false);
    if (!session?.user?.id || session.demo) return session;
    const authResponse = await authenticatedFetch(`${apiBase}/auth/v1/user`);
    const authUser = await authResponse.json().catch(() => null);
    if (!authResponse.ok || !authUser?.id) throw new Error("Kirish seansini tekshirib bo‘lmadi. Qayta kiring.");
    if (authUser.email && !authUser.email_confirmed_at) {
      localStorage.removeItem("paywork_auth");
      throw new Error("Email tasdiqlanmagan. Akkauntga kirish uchun emailga yuborilgan tasdiqlash havolasini oching.");
    }
    session.user = authUser;
    const url = `${apiBase}/rest/v1/profiles?select=role,full_name,age,gender,contacts,avatar,is_active,phone,public_id,email&id=eq.${encodeURIComponent(session.user.id)}`;
    let response = await authenticatedFetch(url);
    if (response.status === 401 && session.refresh_token) {
      session = await refreshSession(true);
      response = await authenticatedFetch(url);
    }
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error(rows.message || "Profil ma’lumotlarini tekshirib bo‘lmadi.");
    if (rows[0]) {
      session.user.user_metadata = { ...(session.user.user_metadata || {}), ...rows[0] };
      session.user.phone = rows[0].phone || session.user.phone || "";
      localStorage.setItem("paywork_auth", JSON.stringify(session));
    }
    return session;
  }

  window.refreshPayWorkSession = refreshSession;
  window.refreshPayWorkProfile = refreshUserProfile;
  window.authenticatedPayWorkFetch = authenticatedFetch;

  function setMode(next) {
    mode = next;
    form.querySelector('[name="identifier"]').readOnly = false;
    form.querySelector('[name="password"]').required = true;
    form.querySelector('[name="password"]').closest(".field").hidden = false;
    const signup = mode === "signup";
    const currentIdentifier = String(form.querySelector('[name="identifier"]').value || "").trim();
    const currentPhone = !!currentIdentifier && !currentIdentifier.includes("@");
    form.querySelector('[name="password"]').required = !currentPhone;
    form.querySelector('[name="password"]').closest(".field").hidden = currentPhone;
    document.getElementById("authTitle").textContent = signup ? "Akkaunt yaratish" : "Kirish";
    document.getElementById("authSubmit").textContent = signup ? "Ro‘yxatdan o‘tish" : "Kirish";
    document.getElementById("authCopy").textContent = signup
      ? "Pay Work’da ish topish yoki xodim izlash uchun akkaunt yarating."
      : "Pay Work akkauntingizga kiring va davom eting.";
    document.getElementById("authNameWrap").hidden = !signup;
    document.getElementById("authRoleWrap").hidden = !signup;
    document.getElementById("authReferralWrap").hidden = !signup;
    document.getElementById("googleAuthBlock").hidden = false;
    document.getElementById("googleAuthButtonLabel").textContent = signup ? "Google orqali ro‘yxatdan o‘tish" : "Google orqali kirish";
    document.getElementById("authNameWrap").querySelector("input").required = signup;
    document.getElementById("loginTab").classList.toggle("active", !signup);
    document.getElementById("signupTab").classList.toggle("active", signup);
    document.getElementById("authSwitchLine").innerHTML = signup
      ? 'Akkauntingiz bormi? <button class="btn btn-plain" style="padding:2px;color:var(--green)" onclick="switchAuth(\'login\')">Kirish</button>'
      : 'Akkauntingiz yo‘qmi? <button class="btn btn-plain" style="padding:2px;color:var(--green)" onclick="switchAuth(\'signup\')">Ro‘yxatdan o‘ting</button>';
    form.querySelector('[name="password"]').autocomplete = signup ? "new-password" : "current-password";
    if (signup) {
      const referral = new URLSearchParams(location.search).get("ref");
      if (referral && form.querySelector('[name="referral_code"]')) form.querySelector('[name="referral_code"]').value = normalizeReferralCode(referral);
    }
  }

  window.openAuth = initialMode => { setMode(initialMode || "login"); openModal("authModal"); };
  window.switchAuth = setMode;
  window.chooseAuthRole = next => {
    role = next;
    form.querySelector('[name="role"]').value = role;
    document.querySelectorAll(".role-card").forEach(button => button.classList.toggle("active", button.dataset.role === role));
  };
  window.togglePassword = () => {
    const input = form.querySelector('[name="password"]');
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    document.querySelector(".password-toggle").textContent = visible ? "Yashirish" : "Ko‘rsatish";
  };

  async function completeTelegramPhoneSetup(event) {
    event.preventDefault();
    const setupForm = event.currentTarget, values = new FormData(setupForm), password = String(values.get("password") || "");
    if (password.length < 10) { showToast("Parol kamida 10 ta belgidan iborat bo‘lsin."); return; }
    if (password !== values.get("password_confirm")) { showToast("Parollar mos kelmadi."); return; }
    const submit = setupForm.querySelector("button[type=submit]"); submit.disabled = true; submit.textContent = "Akkaunt tayyorlanmoqda…";
    try {
      const response = await fetch(`${apiBase}/functions/v1/complete-telegram-phone-auth`, {
        method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken: telegramSetupToken, fullName: String(values.get("full_name") || "").trim(), role: String(values.get("role") || "candidate"), referralCode: String(values.get("referral_code") || "").trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.access_token || !result.user?.email_confirmed_at) throw new Error(result.error || "Parol saqlanmadi. Botdan yangi tasdiqlash kodi oling.");
      localStorage.setItem("paywork_auth", JSON.stringify(result));
      telegramSetupToken = "";
      document.getElementById("authNavBtn").textContent = "Kabinet";
      document.getElementById("telegramPhoneSetupModal")?.remove();
      await window.showDashboard(result);
      showToast("Telefon Telegram orqali tasdiqlandi. Akkauntingizga kirdingiz.");
    } catch (error) { showToast(error.message || "Telegram orqali kirish yakunlanmadi."); }
    finally { if (submit.isConnected) { submit.disabled = false; submit.textContent = "Parolni saqlash va kirish"; } }
  }

  function openTelegramPhoneSetup(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token) || !apiBase || !config.publishableKey) return;
    telegramSetupToken = token;
    let modal = document.getElementById("telegramPhoneSetupModal");
    if (!modal) {
      modal = document.createElement("div"); modal.className = "modal show"; modal.id = "telegramPhoneSetupModal";
      modal.innerHTML = `<div class="dialog"><div class="dialog-head"><h2>Parol yarating</h2></div><p class="auth-copy">Telefon raqamingiz Telegram botda tasdiqlandi. Endi Pay Work akkauntingiz uchun parol o‘rnating.</p><form id="telegramPhoneSetupForm"><div class="formgrid"><div class="field wide"><label>Ism-familiya *</label><input name="full_name" autocomplete="name" required maxlength="120" placeholder="Ism familiya"></div><div class="field wide"><label>Men...</label><select name="role"><option value="candidate">Ish izlayman</option><option value="employer">Ish beruvchiman</option></select></div><div class="field wide"><label>Referal kod (ixtiyoriy)</label><input name="referral_code" autocomplete="off" maxlength="32" placeholder="Referal kod"></div><div class="field wide"><label>Yangi parol *</label><input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="Kamida 10 ta belgi"></div><div class="field wide"><label>Parolni qayta kiriting *</label><input name="password_confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="Parolni tasdiqlang"></div></div><button class="btn btn-green submit" type="submit">Parolni saqlash va kirish</button><p class="account-hint">Tasdiqlash havolasi bir marta ishlaydi va 10 daqiqada tugaydi. Parolni hech kim bilan bo‘lishmang.</p></form></div>`;
      document.body.append(modal);
      modal.querySelector("form").addEventListener("submit", completeTelegramPhoneSetup);
    }
    modal.classList.add("show"); modal.querySelector('[name="full_name"]').focus();
  }

  const launchHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const setupToken = launchHash.get("tg-setup");
  if (setupToken) { window.history.replaceState({}, document.title, `${location.pathname}${location.search}`); openTelegramPhoneSetup(setupToken); }
  function normalizeReferralCode(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  async function validateReferralCode(value) {
    const referralCode = normalizeReferralCode(value);
    if (!referralCode) return "";
    const response = await fetch(`${apiBase}/rest/v1/rpc/paywork_referral_code_is_valid`, {
      method: "POST",
      headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: referralCode })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Referal kodni hozir tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.");
    if (result !== true) throw new Error("Referal kod topilmadi. Kodni tekshiring yoki maydonni bo‘sh qoldiring.");
    return referralCode;
  }

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  window.signInWithGoogle = async () => {
    const base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (!base || !config.publishableKey) {
      showToast("Google orqali kirish uchun avval tizim serverga ulanishi kerak.");
      return;
    }
    const signup = mode === "signup";
    const fullName = String(form.querySelector('[name="full_name"]').value || "").trim();
    if (signup && !fullName) {
      showToast("Google orqali ro‘yxatdan o‘tish uchun avval ism familiyangizni kiriting.");
      form.querySelector('[name="full_name"]').focus();
      return;
    }
    const submit = document.getElementById("authSubmit");
    const googleButton = document.querySelector(".google-auth");
    try {
      if (signup) {
        const referralCode = await validateReferralCode(form.querySelector('[name="referral_code"]').value);
        sessionStorage.setItem("paywork_google_signup", JSON.stringify({ full_name: fullName, role: String(form.querySelector('[name="role"]').value || "candidate"), referral_code: referralCode }));
      } else {
        sessionStorage.removeItem("paywork_google_signup");
      }
      const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
      const verifier = base64Url(verifierBytes);
      const challengeDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      const challenge = base64Url(new Uint8Array(challengeDigest));
      sessionStorage.setItem("paywork_google_pkce_verifier", verifier);
      const redirect = `${window.location.origin}${window.location.pathname}`;
      const url = new URL(`${base}/auth/v1/authorize`);
      url.searchParams.set("provider", "google");
      url.searchParams.set("redirect_to", redirect);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "s256");
      url.searchParams.set("apikey", config.publishableKey);
      if (googleButton) googleButton.disabled = true;
      if (submit) submit.disabled = true;
      window.location.href = url.toString();
    } catch (error) {
      showToast(error.message || "Google orqali kirishda xatolik yuz berdi.");
      if (googleButton) googleButton.disabled = false;
      if (submit) submit.disabled = false;
    }
  };
  async function completeGoogleRedirect() {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const legacyAccessToken = fragment.get("access_token");
    const oauthError = params.get("error_description") || params.get("error") || fragment.get("error_description") || fragment.get("error");
    if (!authCode && !legacyAccessToken && !oauthError) return;
    const cleanParams = new URLSearchParams(window.location.search);
    ["code", "error", "error_description", "error_code", "state"].forEach(key => cleanParams.delete(key));
    const cleanUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams}` : ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
    if (oauthError) {
      sessionStorage.removeItem("paywork_google_pkce_verifier");
      sessionStorage.removeItem("paywork_google_signup");
      showToast(oauthError);
      return;
    }
    try {
      let session;
      if (authCode) {
        const verifier = sessionStorage.getItem("paywork_google_pkce_verifier");
        if (!verifier) throw new Error("Google kirish jarayoni tugallanmagan. Qaytadan urinib ko‘ring.");
        const response = await fetch(`${apiBase}/auth/v1/token?grant_type=pkce`, {
          method: "POST",
          headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
          body: JSON.stringify({ auth_code: authCode, code_verifier: verifier })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.access_token) throw new Error(result.msg || result.message || "Google hisobiga kirish yakunlanmadi.");
        session = { ...result, expires_at: result.expires_at || Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600) };
        sessionStorage.removeItem("paywork_google_pkce_verifier");
      } else {
        const response = await fetch(`${apiBase}/auth/v1/user`, {
          headers: { apikey: config.publishableKey, Authorization: `Bearer ${legacyAccessToken}` }
        });
        const user = await response.json();
        if (!response.ok) throw new Error(user.message || "Google hisobini tekshirib bo‘lmadi.");
        session = {
          access_token: legacyAccessToken,
          refresh_token: fragment.get("refresh_token") || "",
          token_type: fragment.get("token_type") || "bearer",
          expires_in: Number(fragment.get("expires_in") || 3600),
          expires_at: Math.floor(Date.now() / 1000) + Number(fragment.get("expires_in") || 3600),
          user
        };
      }
      localStorage.setItem("paywork_auth", JSON.stringify(session));
      const pendingSignup = JSON.parse(sessionStorage.getItem("paywork_google_signup") || "null");
      let attributionApplied = false;
      if (pendingSignup) {
        const attributionResponse = await fetch(`${apiBase}/rest/v1/rpc/complete_paywork_google_signup`, {
          method: "POST",
          headers: { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_full_name: pendingSignup.full_name, p_role: pendingSignup.role, p_referral_code: pendingSignup.referral_code })
        });
        const attributionResult = await attributionResponse.json().catch(() => null);
        if (!attributionResponse.ok) throw new Error(attributionResult?.message || "Google akkaunt yaratildi, ammo ro‘yxatdan o‘tish ma’lumotlari saqlanmadi. Kabinetdan ism va rolni tekshiring.");
        attributionApplied = attributionResult === true;
        sessionStorage.removeItem("paywork_google_signup");
      }
      document.getElementById("authNavBtn").textContent = "Kabinet";
      const currentSession = await refreshUserProfile(session);
      await window.showDashboard(currentSession);
      showToast(pendingSignup && attributionApplied ? "Google orqali akkaunt yaratildi." : "Google orqali tizimga kirdingiz.");
    } catch (error) {
      sessionStorage.removeItem("paywork_google_pkce_verifier");
      showToast(error.message || "Google orqali kirishda xatolik yuz berdi.");
    }
  }
  completeGoogleRedirect();
  window.handleAuthButton = async () => {
    let session = savedSession();
    if (!session?.access_token) { window.openAuth("login"); return; }
    try { session = await refreshUserProfile(session); window.showDashboard(session); }
    catch (error) { showToast(error.message || "Akkauntni tekshirib bo‘lmadi."); }
  };
  window.closeDashboard = () => document.getElementById("accountScreen").classList.remove("show");
  window.openEmployerPost = () => {
    const session = JSON.parse(localStorage.getItem("paywork_auth") || "null");
    const currentRole = session?.user?.user_metadata?.role;
    if (!session?.access_token) {
      window.openAuth("signup");
      window.chooseAuthRole("employer");
      return;
    }
    if (currentRole !== "employer") {
      showToast("E’lon joylash uchun ish beruvchi akkauntiga kiring.");
      return;
    }
    openModal("postModal");
  };
  window.logoutPayWork = async () => {
    const session = JSON.parse(localStorage.getItem("paywork_auth") || "null");
    try {
      const base = (config.supabaseUrl || "").replace(/\/$/, "");
      if (!session?.demo && base && config.publishableKey) {
        await fetch(`${base}/auth/v1/logout`, { method: "POST", headers: { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` } });
      }
    } catch (_) {}
    localStorage.removeItem("paywork_auth");
    document.getElementById("authNavBtn").textContent = "Kirish";
    window.closeDashboard();
    showToast("Akkauntdan chiqdingiz.");
  };
  window.showDashboard = async (providedSession = null) => {
    let session = providedSession || savedSession();
    if (!session?.access_token) return;
    try { session = await refreshUserProfile(session); }
    catch (error) {
      if (!savedSession()?.access_token) { document.getElementById("authNavBtn").textContent = "Kirish"; }
      showToast(error.message || "Akkauntni tekshirib bo‘lmadi.");
      return;
    }
    const user = session.user || {};
    const profile = user.user_metadata || {};
    const roleName = profile.role === "admin" ? "Administrator" : profile.role === "employer" ? "Ish beruvchi" : "Ish izlovchi";
    const userKey = user.email || user.phone || "";
    document.getElementById("accountName").textContent = profile.full_name || user.email || user.phone || "Foydalanuvchi";
    document.getElementById("accountRole").textContent = roleName;
    const accountBadge = document.getElementById("accountBadge");
    accountBadge.innerHTML = profile.avatar ? `<img src="${profile.avatar}" alt="Profil rasmi">` : (profile.full_name || user.email || user.phone || "P").trim().charAt(0).toUpperCase();
    const avatarInput = document.getElementById("accountAvatarInput");
    if (avatarInput && !avatarInput.dataset.bound) {
      avatarInput.dataset.bound = "true";
      avatarInput.addEventListener("change", () => {
        const file = avatarInput.files?.[0]; if (!file) return;
        if (!file.type.startsWith("image/")) { showToast("Rasm faylini tanlang."); avatarInput.value = ""; return; }
        if (file.size > 3 * 1024 * 1024) { showToast("Rasm hajmi 3 MB dan oshmasin."); avatarInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => {
          const latest = JSON.parse(localStorage.getItem("paywork_auth") || "null"); if (!latest?.user) return;
          latest.user.user_metadata = { ...(latest.user.user_metadata || {}), avatar: reader.result };
          localStorage.setItem("paywork_auth", JSON.stringify(latest));
          if (latest.demo) { const accounts = JSON.parse(localStorage.getItem("paywork_demo_accounts") || "{}"), key = latest.user.email || latest.user.phone || ""; if (accounts[key]) { accounts[key].avatar = reader.result; localStorage.setItem("paywork_demo_accounts", JSON.stringify(accounts)); } }
          accountBadge.innerHTML = `<img src="${reader.result}" alt="Profil rasmi">`; showToast("Profil rasmi yangilandi."); avatarInput.value = "";
        };
        reader.readAsDataURL(file);
      });
    }
    const savedKeys = JSON.parse(localStorage.getItem("paywork_saved") || "[]");
    const allJobs = JSON.parse(localStorage.getItem("paywork_jobs") || "[]");
    const apps = JSON.parse(localStorage.getItem("paywork_apps") || "[]");
    const isEmployer = profile.role === "employer";
    const isAdmin = profile.role === "admin";
    document.querySelectorAll("[data-seeker-only]").forEach(item => { item.hidden = isEmployer || isAdmin; });
    document.querySelectorAll("[data-admin-only]").forEach(item => { item.hidden = !isAdmin; });
    document.getElementById("candidateDrawerFooter").hidden = isEmployer || isAdmin;
    const myJobs = isEmployer ? allJobs.filter(job => job.employerId === userKey) : [];
    const myJobKeys = new Set(myJobs.map(job => job.jobKey || `${job.title}::${job.company}`));
    const incomingApps = isEmployer ? apps.filter(app => myJobKeys.has(app.jobKey || `${app.job}::${app.company || ""}`)) : [];
    document.getElementById("accountStats").innerHTML = isAdmin
      ? `<div class="account-stat"><strong>Admin</strong><span>Foydalanuvchilar boshqaruvi</span></div><div class="account-stat"><strong>Ruxsat</strong><span>Server orqali tekshiriladi</span></div><div class="account-stat"><strong>Pay Work</strong><span>Administrator profili</span></div>`
      : isEmployer
      ? `<div class="account-stat"><strong>${myJobs.length}</strong><span>Mening e’lonlarim</span></div><div class="account-stat"><strong>${incomingApps.length}</strong><span>Kelgan arizalar</span></div><div class="account-stat"><strong>24/7</strong><span>Pay Work yordami</span></div>`
      : `<div class="account-stat"><strong>${savedKeys.length}</strong><span>Saqlangan ishlar</span></div><div class="account-stat"><strong>${apps.length}</strong><span>Yuborgan arizalar</span></div><div class="account-stat"><strong>14</strong><span>Hudud bo‘yicha ishlar</span></div>`;
    document.getElementById("accountPrimaryAction").textContent = isAdmin ? "Administrator paneli →" : isEmployer ? "+ Ish e’lon qilish" : "Ishlarni ko‘rish →";
    document.getElementById("accountPrimaryAction").onclick = isAdmin ? () => window.showAccountSection("admin") : isEmployer ? () => openModal("postModal") : () => { closeDashboard(); openAllJobs(); };
    document.getElementById("accountScreen").classList.add("show");
    window.showAccountSection("overview");
    const pending = JSON.parse(localStorage.getItem("paywork_pending_application") || "null");
    if (pending) {
      localStorage.removeItem("paywork_pending_application");
      if (profile.role === "employer") {
        showToast("Vakansiyaga ariza berish uchun ish izlovchi akkaunti kerak.");
      } else {
        setTimeout(() => {
          window.closeDashboard();
          window.applyFor(pending.title, pending.company);
        }, 0);
      }
    }
  };
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  const existing = JSON.parse(localStorage.getItem("paywork_auth") || "null");
  if (existing?.access_token) document.getElementById("authNavBtn").textContent = "Kabinet";

  const passwordField = form.querySelector('[name="password"]').closest(".field");
  form.querySelector('[name="identifier"]').addEventListener("input", event => {
    const isPhone = !String(event.currentTarget.value || "").includes("@");
    passwordField.hidden = isPhone;
    form.querySelector('[name="password"]').required = !isPhone;
    document.getElementById("authSubmit").textContent = isPhone ? "Telegram orqali davom etish" : (mode === "signup" ? "Ro‘yxatdan o‘tish" : "Kirish");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const base = (config.supabaseUrl || "").replace(/\/$/, "");
    const values = new FormData(form);
    const signup = mode === "signup";
    const identifier = String(values.get("identifier") || "").trim();
    const phoneLogin = !identifier.includes("@");
    if (!base || !config.publishableKey) { showToast("Xavfsiz kirish server sozlamalari topilmadi. Demo kirish o‘chirib qo‘yilgan."); return; }
    if (phoneLogin) {
      const normalizedPhone = identifier.replace(/[\s()-]/g, "");
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) { showToast("Telefon raqamini xalqaro formatda kiriting, masalan +998901234567."); return; }
      if (signup && !String(values.get("full_name") || "").trim()) { showToast("Ism-familiyangizni kiriting."); return; }
      const url = new URL("https://t.me/pay_workbot"); url.searchParams.set("start", "auth");
      if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url.toString());
      else window.open(url.toString(), "_blank", "noopener,noreferrer");
      showToast("Telegram botda tilni tanlang, o‘z raqamingizni ulashing va yuborilgan koddan keyin parol yarating.");
      return;
    }
    const endpoint = signup ? `${base}/auth/v1/signup` : `${base}/auth/v1/token?grant_type=password`;
    const account = phoneLogin ? { phone: identifier } : { email: identifier };
    const payload = signup
      ? { ...account, password: values.get("password"), data: { full_name: values.get("full_name"), role: values.get("role"), referral_code: values.get("referral_code") || "" } }
      : { ...account, password: values.get("password") };
    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    submit.textContent = "Biroz kuting…";
    try {
      if (signup) {
        const referralCode = normalizeReferralCode(values.get("referral_code"));
        if (referralCode) {
          await validateReferralCode(referralCode);
          values.set("referral_code", referralCode);
        }
        payload.data.referral_code = referralCode;
      }
      const response = await fetch(endpoint, { method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || result.message || result.error_description || "Ma’lumotlarni tekshirib qayta urinib ko‘ring.");
      if (result.access_token && result.user?.email_confirmed_at) {
        localStorage.setItem("paywork_auth", JSON.stringify(result));
        document.getElementById("authNavBtn").textContent = "Kabinet";
        closeModal("authModal");
        form.reset();
        window.showDashboard();
        showToast(signup ? "Akkauntingiz yaratildi!" : "Xush kelibsiz!");
      } else if (signup) {
        closeModal("authModal");
        showToast(result.access_token ? "Email tasdiqlanmagan. Emailga kelgan tasdiqlash havolasini oching." : "Emailingizga yuborilgan tasdiqlash havolasini oching.");
      } else if (result.access_token && !result.user?.email_confirmed_at) {
        localStorage.removeItem("paywork_auth");
        throw new Error("Email manzili tasdiqlanmagan. Emailga yuborilgan tasdiqlash havolasini oching.");
      }
    } catch (error) {
      showToast(error.message || "Server bilan bog‘lanib bo‘lmadi.");
    } finally {
      submit.disabled = false;
      submit.textContent = signup ? "Ro‘yxatdan o‘tish" : "Kirish";
    }
  });
})();
