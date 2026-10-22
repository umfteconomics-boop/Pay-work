(() => {
  const getSession = () => JSON.parse(localStorage.getItem("paywork_auth") || "null");
  const getApps = () => JSON.parse(localStorage.getItem("paywork_apps") || "[]");
  const getJobs = () => JSON.parse(localStorage.getItem("paywork_jobs") || "[]");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const identity = session => session?.user?.email || session?.user?.phone || "";
  const employer = session => session?.user?.user_metadata?.role === "employer";
  const jobsFor = session => getJobs().filter(job => job.employerId && job.employerId === identity(session));
  const appsFor = session => {
    const apps = getApps();
    if (!employer(session)) return apps.filter(app => app.applicantId === identity(session) || (session?.user?.phone && app.phone === session.user.phone));
    const keys = new Set(jobsFor(session).map(job => job.jobKey || [job.title, job.company].join("::")));
    return apps.filter(app => keys.has(app.jobKey || [app.job, app.company || ""].join("::")));
  };
  const appKey = app => app.id || [app.jobKey || app.job, app.applicantId || app.phone || app.name].join("::");
  const archivedApps = session => JSON.parse(localStorage.getItem(`paywork_archived_apps_${identity(session)}`) || "[]");
  const archivedJobs = session => JSON.parse(localStorage.getItem(`paywork_archived_jobs_${identity(session)}`) || "[]");
  const archiveKey = job => job.jobKey || [job.title, job.company].join("::");
  let activeChat = "";
  let activePayworkThread = "";
  let payworkChatRefreshTimer = 0;
  const payworkChatEmojis = ["😊", "🤝", "💸", "😎", "😂", "❤️", "👍", "👌", "🤦‍♂️", "😡"];
  let activeAccountSection = "overview";
  let adminProfilesData = [];

  let mediaDb;
  function openMediaDb() {
    if (mediaDb) return mediaDb;
    mediaDb = new Promise((resolve, reject) => {
      const request = indexedDB.open("paywork-media", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return mediaDb;
  }
  async function saveMedia(file) {
    const db = await openMediaDb();
    const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ id, name: file.name, type: file.type, blob: file, size: file.size });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    return { id, name: file.name, type: file.type, size: file.size };
  }
  async function getMedia(id) {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
    });
  }
  function mediaMarkup(item) {
    return getMedia(item.id).then(file => {
      if (!file) return `<p class="account-file-link">📎 ${esc(item.name || "Biriktirilgan fayl")}</p>`;
      const url = URL.createObjectURL(file.blob);
      return file.type.startsWith("image/") ? `<a class="account-media" href="${url}" target="_blank"><img src="${url}" alt="${esc(file.name)}"><span>${esc(file.name)}</span></a>`
        : file.type.startsWith("video/") ? `<div class="account-media"><video src="${url}" controls></video><span>${esc(file.name)}</span></div>`
          : `<a class="account-file-link" href="${url}" download="${esc(file.name)}">📎 ${esc(file.name)}</a>`;
    }).catch(() => `<p class="account-file-link">📎 ${esc(item.name || "Biriktirilgan fayl")}</p>`);
  }
  const empty = text => `<div class="account-empty">${esc(text)}</div>`;
  function listCard(app, archived = false) {
    const key = encodeURIComponent(appKey(app));
    const name = employer(getSession()) ? (app.applicantProfile?.full_name || app.name || "Nomzod") : (app.company || "Ish beruvchi");
    const contact = employer(getSession()) ? (app.applicantProfile?.contact || app.phone || "") : (app.employerProfile?.contact || "");
    return `<article class="account-row"><div><b>${esc(app.job || "Vakansiya")}</b><p>${esc(name)}${contact ? ` · ${esc(contact)}` : ""}</p><small>${app.created ? new Date(app.created).toLocaleDateString("uz-UZ") : "Ariza"} · ${esc(app.status || "Ko‘rib chiqilmoqda")}</small></div><div class="account-row-actions">${!archived ? `<button class="apply" onclick="openAccountChat('${key}')">Chat</button>` : ""}<button class="btn btn-plain" onclick="${archived ? "restoreApplication" : "archiveApplication"}('${key}')">${archived ? "Qaytarish" : "Arxivlash"}</button></div></article>`;
  }
  function jobCard(job, archived = false) {
    const key = encodeURIComponent(archiveKey(job));
    return `<article class="account-row"><div><b>${esc(job.title)}</b><p>${esc(job.company)} · ${esc(job.city)}</p><small>${Number(job.salary).toLocaleString("uz-UZ")} so‘m · ${esc(job.type)}</small></div><button class="btn btn-plain" onclick="${archived ? "restoreJob" : "archiveJob"}('${key}')">${archived ? "Faollashtirish" : "Arxivlash"}</button></article>`;
  }

  window.toggleAccountMenu = force => {
    const drawer = document.getElementById("accountDrawer"), scrim = document.getElementById("accountScrim");
    const open = typeof force === "boolean" ? force : !drawer.classList.contains("open");
    drawer.classList.toggle("open", open); scrim.classList.toggle("open", open);
  };
  window.showAccountSection = section => {
    const session = getSession(); if (!session?.access_token) return;
    if (["experience", "promo", "invite", "about", "instagram"].includes(section) && employer(session)) { showToast("Bu bo‘lim ish izlovchilar uchun."); return; }
    activeAccountSection = section;
    window.toggleAccountMenu(false);
    document.querySelectorAll(".account-menu-list button").forEach(button => button.classList.toggle("active", button.getAttribute("onclick")?.includes(`'${section}'`)));
    if (["privacy", "security", "notifications"].includes(section)) document.querySelectorAll(".account-menu-list button").forEach(button => button.classList.toggle("active", button.getAttribute("onclick")?.includes("'settings'")));
    const content = document.getElementById("accountContent"), apps = appsFor(session), archived = archivedApps(session), archivedJobKeys = archivedJobs(session);
    if (section !== "overview") content.classList.remove("candidate-home");
    const activeApps = apps.filter(app => !archived.includes(appKey(app))), oldApps = apps.filter(app => archived.includes(appKey(app)));
    const myJobs = jobsFor(session), activeJobs = myJobs.filter(job => !archivedJobKeys.includes(archiveKey(job))), oldJobs = myJobs.filter(job => archivedJobKeys.includes(archiveKey(job)));
    const tabs = sectionName => `<div class="account-subnav">${sectionName.map(([id, label]) => `<button class="${(section === "settings" ? "privacy" : section) === id ? "active" : ""}" onclick="showAccountSection('${id}')">${label}</button>`).join("")}</div>`;

    if (section === "admin") {
      if (session.demo || session.user?.user_metadata?.role !== "admin") { showToast("Administrator huquqi talab qilinadi."); return; }
      content.classList.remove("candidate-home");
      if (!document.getElementById("adminPanelStyles")) { const style = document.createElement("style"); style.id = "adminPanelStyles"; style.textContent = ".admin-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.admin-panel-head h3{margin:0 0 6px}.admin-panel-head .account-lead{margin:0}#adminSummary.admin-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}.admin-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 190px 190px;gap:12px;align-items:end;margin:16px 0}.admin-toolbar label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:700}.admin-toolbar input,.admin-toolbar select{width:100%;min-height:42px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--bg);color:var(--ink)}.admin-list-heading{display:flex;justify-content:space-between;align-items:center;margin:12px 0;color:var(--ink)}.admin-list-heading span{color:var(--muted);font-size:12px}.admin-profile-card[hidden]{display:none!important}.admin-profile-self{box-shadow:inset 3px 0 var(--green)}.admin-profile-card select:disabled,.admin-profile-card input:disabled{opacity:.65;cursor:not-allowed}.admin-profile-details{grid-column:1/-1;border:1px solid var(--line);border-radius:10px;background:var(--mint);padding:9px 12px;color:var(--green);font-size:12px;font-weight:800}.admin-profile-details:hover{filter:brightness(.97)}.admin-profile-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#0b1813b8;backdrop-filter:blur(5px);animation:adminFadeIn .18s ease}.admin-profile-modal-card{width:min(720px,100%);max-height:min(86vh,850px);overflow:auto;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 28px 90px #0005;animation:adminModalIn .22s ease}.admin-profile-modal-head{position:sticky;top:0;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;background:var(--bg);border-bottom:1px solid var(--line)}.admin-profile-modal-head span{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--green)}.admin-profile-modal-head h3{margin:6px 0 4px;font:800 22px Manrope,sans-serif}.admin-profile-modal-head p{margin:0;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.admin-profile-modal-head button{flex:none;width:38px;height:38px;border:1px solid var(--line);border-radius:12px;background:var(--mint);color:var(--ink);font-size:22px;cursor:pointer}.admin-profile-modal-body{padding:22px 24px 26px}.admin-profile-modal-body h4{margin:20px 0 10px;font-size:13px}.admin-profile-modal-body h4:first-child{margin-top:0}.admin-profile-modal-body dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}.admin-profile-modal-body dl div{min-width:0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface,#fff)}.admin-profile-modal-body dt{margin-bottom:5px;color:var(--muted);font-size:10px}.admin-profile-modal-body dd{margin:0;font-size:12px;font-weight:700;overflow-wrap:anywhere}.admin-profile-modal-body .admin-profile-contacts{white-space:pre-line}.admin-profile-modal-foot{display:flex;justify-content:flex-end;padding-top:18px}.admin-profile-modal-foot .btn{min-width:120px}@keyframes adminFadeIn{from{opacity:0}to{opacity:1}}@keyframes adminModalIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:700px){#adminSummary.admin-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-toolbar{grid-template-columns:1fr 1fr}.admin-search-label{grid-column:1/-1}.admin-panel-head{align-items:center}}@media(max-width:560px){.admin-profile-modal{padding:10px}.admin-profile-modal-head,.admin-profile-modal-body{padding-left:16px;padding-right:16px}.admin-profile-modal-head h3{font-size:19px}.admin-profile-modal-body dl{grid-template-columns:1fr}}body.theme-night .admin-toolbar input,body.theme-night .admin-toolbar select{background:#111a16;color:var(--ink);border-color:var(--line)}body.theme-night .admin-profile-modal-body dl div{background:#1a2620}"; document.head.append(style); }
      content.innerHTML = `<div class="admin-panel-head"><div><h3>Administrator paneli</h3><p class="account-lead">Pay Work foydalanuvchilari va akkaunt holatini boshqaring.</p></div><button class="btn btn-plain" id="adminRefresh" type="button">Yangilash</button></div><div class="admin-summary-grid" id="adminSummary"><div class="admin-summary-card"><strong>—</strong><span>Jami profillar</span></div><div class="admin-summary-card"><strong>—</strong><span>Ish izlovchilar</span></div><div class="admin-summary-card"><strong>—</strong><span>Ish beruvchilar</span></div><div class="admin-summary-card"><strong>—</strong><span>Nofaol akkauntlar</span></div></div><div class="admin-toolbar"><label class="admin-search-label">Profil qidirish<input id="adminSearch" type="search" placeholder="Ism, email yoki telefon"></label><label>Rol<select id="adminRoleFilter"><option value="all">Barcha rollar</option><option value="candidate">Ish izlovchi</option><option value="employer">Ish beruvchi</option><option value="admin">Administrator</option></select></label><label>Holat<select id="adminStatusFilter"><option value="all">Barcha holatlar</option><option value="active">Faol</option><option value="inactive">Nofaol</option></select></label></div><div class="admin-list-heading"><strong>Foydalanuvchilar</strong><span id="adminResultCount">Yuklanmoqda…</span></div><div id="adminProfiles" class="account-control-list"><div class="account-empty">Profillar yuklanmoqda…</div></div>`;
      document.getElementById("adminSearch").addEventListener("input", renderAdminProfiles);
      document.getElementById("adminRoleFilter").addEventListener("change", renderAdminProfiles);
      document.getElementById("adminStatusFilter").addEventListener("change", renderAdminProfiles);
      document.getElementById("adminRefresh").addEventListener("click", () => loadAdminProfiles(session).then(renderAdminProfiles));
      const walletSection = document.createElement("section");
      walletSection.className = "admin-wallet-section";
      walletSection.innerHTML = `<div class="admin-list-heading"><strong>Hamyon so‘rovlari</strong><button class="btn btn-plain" type="button" onclick="loadAdminWalletRequests()">Yangilash</button></div><p class="account-lead">Tasdiqlash hamyon hisobini yangilaydi. Haqiqiy pul o‘tkazmasini administrator alohida bajaradi.</p><div id="adminWalletRequests"><div class="account-empty">So‘rovlar yuklanmoqda…</div></div>`;
      document.getElementById("adminProfiles").before(walletSection);
      loadAdminWalletRequests(session);
      loadAdminProfiles(session).then(renderAdminProfiles);
      return;
    }

    if (section === "overview") {
      const savedKeys = JSON.parse(localStorage.getItem("paywork_saved") || "[]"), savedJobs = getJobs().filter(job => savedKeys.includes(job.title + job.company));
      if (!employer(session)) {
        const days = Array.from({ length: 20 }, (_, i) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i); return d; });
        const storyItems = [
          ["💰", "Yuqori haq", "Kuniga 250 000 so‘mdan", "Yuqori maoshli vakansiyalarni ko‘ring"],
          ["◎", "Instagram", "Profil targ‘iboti", "O‘z profilingizni ko‘proq ish beruvchiga ko‘rsating"],
          ["▶", "Yo‘riqnoma", "Yaxshi rezyume", "Ishga topshirishda foydali maslahatlar"]
        ];
        const weekdayUz = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
        const monthUz = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
        const renderDailyJobs = dayIndex => {
          const all = getJobs(); if (!all.length) return empty("Mos vakansiyalar hozircha yo‘q. Barcha ishlarni ko‘ring.");
          const start = (dayIndex * 3) % all.length, selected = Array.from({length: Math.min(6, all.length)}, (_,i) => all[(start+i)%all.length]);
          return selected.map(job=>`<article class="candidate-job"><span class="candidate-company-mark">${esc((job.company||"P").charAt(0).toUpperCase())}</span><div class="candidate-job-info"><b>${esc(job.title)}</b><p>${esc(job.company)} · ${esc(job.city)}</p><small>${esc(job.type||"Moslashuvchan")} · ${Number(job.salary).toLocaleString("uz-UZ")} so‘m</small></div><button class="apply" onclick="applyFor('${esc(job.title)}','${esc(job.company)}')">Ko‘rish →</button></article>`).join("");
        };
        document.getElementById("accountStats").hidden = true;
        content.classList.add("candidate-home");
        const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        content.innerHTML = `<div class="candidate-section-head candidate-promo-head"><div><h4>Siz uchun tavsiyalar</h4><p>Yaxshi haq, tanlangan profillar va foydali yo‘riqnomalar</p></div></div><div class="candidate-stories">${storyItems.map(([icon,title,sub,desc],i)=>`<button class="candidate-story story-${i+1}" onclick="openCandidateStory(${i})"><span class="candidate-story-ring"><i>${icon}</i></span><b>${title}</b><small>${sub}</small><em>${desc}</em></button>`).join("")}</div><div class="candidate-plan"><div class="candidate-title-row"><div><span class="candidate-kicker">ISH IZLOVCHI KABINETI</span><h3>Bugungi rejangiz</h3><p class="account-lead">Sanani tanlang, mos ishlarni va foydali takliflarni ko‘ring.</p></div><button class="candidate-heart" onclick="showAccountSection('listings')" aria-label="Saqlangan ishlar"><span>♡</span><small>Saqlanganlar</small><b>${savedJobs.length}</b></button></div><div class="candidate-date-strip" aria-label="20 kunlik jadval">${days.map((d,i)=>`<button class="candidate-date ${i===0?"active":""}" data-day="${i}" onclick="selectCandidateDate(this,'${dateKey(d)}',${i})"><small>${i===0?"Bugun":weekdayUz[d.getDay()]}</small><b>${d.getDate()}</b><small>${monthUz[d.getMonth()]}</small></button>`).join("")}</div><div class="candidate-section-head candidate-jobs-head"><div><h4>Mos vakansiyalar</h4><p>Yangi va tanlangan ishlar</p></div><button class="btn btn-plain" onclick="openAllJobs()">Barchasini ko‘rish →</button></div><div class="candidate-job-list">${renderDailyJobs(0)}</div></div>`;
        window.selectCandidateDate = (button, date, dayIndex) => { content.querySelectorAll(".candidate-date").forEach(el=>el.classList.remove("active")); button.classList.add("active"); const heading=content.querySelector(".candidate-jobs-head h4"); if(heading) heading.textContent = dayIndex === 0 ? "Bugungi vakansiyalar" : new Date(date+"T00:00:00").toLocaleDateString("uz-UZ",{day:"numeric"})+" "+monthUz[new Date(date+"T00:00:00").getMonth()]+" kungi vakansiyalar"; content.querySelector(".candidate-job-list").innerHTML = renderDailyJobs(dayIndex); };
        window.openCandidateStory = index => {
          const close = () => document.getElementById("candidateFeature")?.remove();
          let body = "", title = "";
          if (index === 0) {
            title = "Yuqori haqdagi ishlar";
            const high = getJobs().slice().sort((a,b)=>Number(b.salary)-Number(a.salary)).slice(0,12);
            body = `<div class="feature-celebrate"><span>✨</span><span>🎉</span><span>💸</span><h3>Mehnatingiz munosib baholansin!</h3><p>Hozirgi e’lonlar ichidan eng yuqori haq taklif qilayotgan ishlar.</p></div><div class="feature-jobs">${high.map(job=>`<article class="candidate-job"><span class="candidate-company-mark">${esc((job.company||"P").charAt(0).toUpperCase())}</span><div class="candidate-job-info"><b>${esc(job.title)}</b><p>${esc(job.company)} · ${esc(job.city)}</p><small>${Number(job.salary).toLocaleString("uz-UZ")} so‘m / ${esc(job.unit||"kuniga")}</small></div><button class="apply" onclick="applyFor('${esc(job.title)}','${esc(job.company)}')">Ariza →</button></article>`).join("")}</div>`;
          } else if (index === 1) {
            title = "Instagram reklamalari";
            body = `<p class="feature-intro">Ish izlovchilar uchun tanlangan sahifa va kurslar. Reklama namunasi.</p><div class="instagram-ads"><article><span class="insta-brand">@ kasb_maktabi</span><div class="insta-art insta-one">🎨<b>Yangi kasb — yangi imkoniyat</b></div><p>Qisqa kurslar va amaliy mashg‘ulotlar</p><button onclick="showToast('Reklama beruvchi bilan bog‘lanish tez orada qo‘shiladi.')">Profilni ko‘rish ↗</button></article><article><span class="insta-brand">@ ish_uz_guide</span><div class="insta-art insta-two">📈<b>Rezyumeni kuchaytiring</b></div><p>Ish topish bo‘yicha foydali tavsiyalar</p><button onclick="showToast('Reklama beruvchi bilan bog‘lanish tez orada qo‘shiladi.')">Profilni ko‘rish ↗</button></article></div>`;
          } else {
            title = "Ish boshlash yo‘riqnomasi";
            body = `<p class="feature-intro">Yangi ishni boshlashdan oldin quyidagilarni tekshirib oling.</p><div class="guide-steps"><article><b>01</b><div><strong>Ish beruvchini tekshiring</strong><p>Kompaniya nomi, manzili va aloqa ma’lumotlarini aniqlang.</p></div></article><article><b>02</b><div><strong>Vazifa va jadvalni kelishing</strong><p>Qiladigan ishingiz, ish vaqti va tanaffuslarni oldindan biling.</p></div></article><article><b>03</b><div><strong>To‘lovni aniq belgilang</strong><p>Haq miqdori, hisoblash usuli va to‘lanadigan sanani yozib oling.</p></div></article><article><b>04</b><div><strong>Xavfsizlikni unutmang</strong><p>Ish joyiga borishdan oldin yaqinlaringizga manzil va vaqtni ayting.</p></div></article></div>`;
          }
          document.body.insertAdjacentHTML("beforeend", `<div class="candidate-feature-screen" id="candidateFeature" onclick="if(event.target===this)this.remove()"><section class="candidate-feature-dialog"><header><h2>${title}</h2><button onclick="document.getElementById('candidateFeature').remove()" aria-label="Yopish">×</button></header>${body}</section></div>`);
        };
      } else {
        document.getElementById("accountStats").hidden = false;
        content.classList.remove("candidate-home");
        content.innerHTML = `<h3>Shaxsiy kabinetingiz</h3><p class="account-lead">Menyudan kerakli bo‘limni tanlab ma’lumotlaringizni boshqaring.</p><div class="account-shortcuts"><button onclick="showAccountSection('profile')"><b>Shaxsiy ma’lumotlar</b><span>Profilingizni ko‘rish va tahrirlash</span></button><button onclick="showAccountSection('applications')"><b>Arizalar</b><span>${activeApps.length} ta faol ariza</span></button><button onclick="showAccountSection('chats')"><b>Chatlar</b><span>Suhbatlarni davom ettirish</span></button></div><h3>Faol e’lonlar</h3>${activeJobs.length ? activeJobs.map(job => jobCard(job)).join("") : empty("Hali e’lon joylamagansiz. Yuqoridagi tugma orqali vakansiya joylang.")}`;
      }
      return;
    }
    if (section === "profile") {
      const user = session.user || {}, profile = user.user_metadata || {}, contact = user.phone || profile.phone || (String(user.email || "").endsWith("@phone.paywork.invalid") ? "" : user.email) || "";
      let contacts = Array.isArray(profile.contacts) ? profile.contacts : [];
      if (!contacts.length && contact) contacts = [{ type: user.phone || profile.phone ? "Telefon" : "Email", value: contact }];
      content.innerHTML = `<h3>Shaxsiy ma’lumotlar</h3><p class="account-lead">Aloqa usullari, yoshingiz va jinsingizni kiriting. Kerak bo‘lsa keyin o‘zgartirasiz.</p><div class="paywork-my-id profile-public-id">Pay Work ID: <strong>${esc(profile.public_id || "Yuklanmoqda…")}</strong><small>Shu ID orqali boshqalar sizni chatda topadi.</small></div><form class="account-form" id="accountProfileForm"><div class="field"><label>Ism-familiya</label><input name="full_name" required value="${esc(profile.full_name || "")}" placeholder="Ism familiya"></div><div class="account-profile-grid"><div class="field"><label>Yosh</label><input type="number" name="age" min="16" max="100" value="${esc(profile.age || "")}" placeholder="Masalan, 24"></div><div class="field"><label>Jins</label><select name="gender"><option value="">Tanlang</option><option value="Ayol" ${profile.gender === "Ayol" ? "selected" : ""}>Ayol</option><option value="Erkak" ${profile.gender === "Erkak" ? "selected" : ""}>Erkak</option><option value="Ko‘rsatmaslik" ${profile.gender === "Ko‘rsatmaslik" ? "selected" : ""}>Ko‘rsatmaslik</option></select></div></div><div class="account-contact-head"><div><b>Aloqa usullari</b><small>Telefon, email, Telegram yoki WhatsApp qo‘shishingiz mumkin.</small></div><button type="button" class="apply" onclick="addProfileContact()">+ Aloqa qo‘shish</button></div><div id="profileContacts">${contacts.map(item => contactRow(item.type, item.value)).join("")}</div><button class="btn btn-green" type="submit">Ma’lumotlarni saqlash</button></form>`;
      document.getElementById("accountProfileForm").addEventListener("submit", window.saveAccountProfile);
      return;
    }
    if (section === "experience") {
      const key = `paywork_experience_${identity(session)}`, entries = JSON.parse(localStorage.getItem(key) || "[]");
      content.innerHTML = `<h3>Ish tajribasi</h3><p class="account-lead">Oldingi ish joylaringiz va ko‘nikmalaringizni qo‘shing. Bu ma’lumotlar profilingizda saqlanadi.</p><form class="account-form experience-form" id="experienceForm"><div class="field"><label>Lavozim</label><input name="position" required placeholder="Masalan, Kassir"></div><div class="field"><label>Kompaniya yoki ish joyi</label><input name="company" required placeholder="Kompaniya nomi"></div><div class="account-profile-grid"><div class="field"><label>Boshlagan sana</label><input type="month" name="from" required></div><div class="field"><label>Tugagan sana</label><input type="month" name="to" placeholder="Hozir ishlayapman"></div></div><label class="experience-current"><input type="checkbox" name="current"> Hozir shu yerda ishlayapman</label><div class="field"><label>Vazifalar va natijalar</label><textarea name="description" rows="3" placeholder="Qilgan ishlaringiz yoki ko‘nikmalaringiz"></textarea></div><button class="btn btn-green" type="submit">Tajriba qo‘shish</button></form><h4 class="experience-list-title">Ish faoliyati</h4><div class="experience-list">${entries.length ? entries.map((item,i)=>`<article class="experience-card"><div><span class="experience-dot">▧</span><b>${esc(item.position)}</b><p>${esc(item.company)}</p><small>${esc(item.from)} — ${item.current ? "Hozir" : esc(item.to || "")}</small>${item.description ? `<p>${esc(item.description)}</p>` : ""}</div><button class="btn btn-plain" onclick="removeWorkExperience(${i})" aria-label="Tajribani o‘chirish">×</button></article>`).join("") : empty("Ish tajribasi hali qo‘shilmagan. Birinchi ish joyingizni kiriting.")}</div>`;
      document.getElementById("experienceForm").addEventListener("submit", event => { event.preventDefault(); const f = new FormData(event.currentTarget), all = JSON.parse(localStorage.getItem(key) || "[]"); all.unshift({ position: String(f.get("position")).trim(), company: String(f.get("company")).trim(), from: f.get("from"), to: f.get("to"), current: f.has("current"), description: String(f.get("description") || "").trim() }); localStorage.setItem(key, JSON.stringify(all)); window.showAccountSection("experience"); showToast("Ish tajribasi saqlandi."); });
      window.removeWorkExperience = index => { const all = JSON.parse(localStorage.getItem(key) || "[]"); all.splice(index, 1); localStorage.setItem(key, JSON.stringify(all)); window.showAccountSection("experience"); };
      return;
    }
    if (section === "payments") {
      content.innerHTML = `<div class="account-panel-head"><div><h3>Hamyon va to‘lov so‘rovlari</h3><p class="account-lead">Mablag‘ kiritish va yechish so‘rovlari administrator tasdiqlagandan keyin hisobga olinadi.</p></div><button class="btn btn-plain" type="button" onclick="loadPayworkWallet()">Yangilash</button></div><div id="payworkWallet"><div class="account-empty">Hamyon yuklanmoqda…</div></div>`;
      loadPayworkWallet();
      return;
    }
    if (section === "invite") {
      if (!document.getElementById("inviteReferralStyles")) { const style = document.createElement("style"); style.id = "inviteReferralStyles"; style.textContent = ".invite-reward{display:grid;gap:5px;margin:18px 0;padding:15px 17px;border:1px solid #a8d7bd;border-radius:14px;background:linear-gradient(120deg,#e8f5ed,#f5f8e8)}.invite-reward strong{color:var(--green);font-size:17px}.invite-reward span,.invite-friend-info small,.invite-friend-status{color:var(--muted);font-size:12px}.invite-referrals{margin-top:24px;padding-top:18px;border-top:1px solid var(--line)}.invite-referrals-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.invite-referrals-head h4{margin:0}.invite-referrals-head span{font-weight:800;color:var(--green);font-size:13px}.invite-friends{display:grid;gap:8px;margin-top:12px}.invite-friend{display:flex;align-items:center;gap:11px;padding:11px;border:1px solid var(--line);border-radius:13px}.invite-friend-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:var(--mint);color:var(--green);font-weight:800}.invite-friend-info{display:grid;gap:3px;min-width:0;flex:1}.invite-friend-info small{overflow-wrap:anywhere}.invite-friend-status{max-width:170px;text-align:right}.invite-friend-status.confirmed{color:var(--green);font-weight:800}.admin-referral-state{display:grid;gap:6px;grid-column:1/-1;padding:10px;border-radius:10px;background:var(--mint)}.admin-referral-state small{color:var(--muted)}body.theme-night .invite-reward{background:#1b352b;border-color:#385b49}body.theme-night .invite-friend{background:#14251e}"; document.head.append(style); }
      const userKey = identity(session), savedCode = localStorage.getItem(`paywork_invite_${userKey}`);
      const code = savedCode || `PW-${Array.from(crypto.getRandomValues(new Uint8Array(5)), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
      if (!savedCode) localStorage.setItem(`paywork_invite_${userKey}`, code);
      const link = `${location.href.split("#")[0]}?ref=${encodeURIComponent(code)}`;
      content.innerHTML = `<h3>Do‘stingizni taklif qiling</h3><p class="account-lead">Pay Work’ni do‘stingizga ulashing. U siz yuborgan havola orqali platformaga kira oladi.</p><div class="invite-card"><span class="invite-icon">♧</span><h4>Yaxshi imkoniyatni ulashing</h4><p>Do‘stingiz mos ishlarni topsin, siz esa Pay Work’ni tanishtiring.</p><div class="invite-reward"><strong>Har bir do‘st uchun 10 000 so‘m</strong><span>Do‘stingiz ishni boshlagach, bonus administrator tomonidan tasdiqlanadi.</span></div><label>Shaxsiy taklif kodingiz</label><div class="invite-code-row"><strong id="inviteCodeValue">${esc(code)}</strong><button class="apply" onclick="copyInviteCode()">Nusxalash</button></div><button class="btn btn-green invite-share" onclick="shareInviteLink()">Do‘stingizga yuborish ↗</button><div class="invite-referrals"><div class="invite-referrals-head"><h4>Taklif qilgan do‘stlaringiz</h4><span id="inviteBonusTotal">Bonus: 0 so‘m</span></div><div id="inviteFriends" class="invite-friends"><div class="account-empty">Takliflar tekshirilmoqda…</div></div></div></div>`;
      window.copyInviteCode = async () => { const current = document.getElementById("inviteCodeValue")?.textContent || code; try { await navigator.clipboard.writeText(current); showToast("Taklif kodi nusxalandi."); } catch (_) { showToast(`Taklif kodingiz: ${current}`); } };
      window.shareInviteLink = async () => { const current = document.getElementById("inviteCodeValue")?.textContent || code, currentLink = `${location.href.split("#")[0]}?ref=${encodeURIComponent(current)}`; try { if (navigator.share) await navigator.share({ title: "Pay Work — ish imkoniyatlari", text: `Mening taklif kodim: ${current}`, url: currentLink }); else { await navigator.clipboard.writeText(currentLink); showToast("Taklif havolasi nusxalandi."); } } catch (_) {} };
      loadInviteReferrals(session, code);
      return;
    }
    if (section === "promo") {
      const key = `paywork_promos_${identity(session)}`, codes = JSON.parse(localStorage.getItem(key) || "[]");
      content.innerHTML = `<h3>Promokodlar</h3><p class="account-lead">Sizda bor promokodni kiriting va akkauntingizga saqlang.</p><form class="promo-form" id="promoForm"><div class="field"><label>Promokod</label><input name="code" required minlength="4" maxlength="24" placeholder="Masalan, PAYWORK10"></div><button class="btn btn-green" type="submit">Promokodni saqlash</button></form><div class="promo-note">Promokodning amal qilish shartlari va chegirmasi to‘lov xizmati ulangach tekshiriladi. Hozircha bu demo rejimi.</div><h4 class="experience-list-title">Saqlangan kodlar</h4>${codes.length ? codes.map(code=>`<div class="promo-code-card"><span>✦</span><div><b>${esc(code)}</b><small>Demo rejimida saqlandi · shartlari tekshirilmagan</small></div></div>`).join("") : empty("Saqlangan promokodlaringiz shu yerda ko‘rinadi.")}`;
      document.getElementById("promoForm").addEventListener("submit", event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("code")).trim().toUpperCase(), current = JSON.parse(localStorage.getItem(key) || "[]"); if (!current.includes(value)) current.unshift(value); localStorage.setItem(key, JSON.stringify(current)); window.showAccountSection("promo"); showToast("Promokod demo akkauntingizga saqlandi."); });
      return;
    }
    if (section === "about") {
      content.innerHTML = `<h3>Biz haqimizda</h3><p class="account-lead">Yaxshi ish — yangi imkoniyatlar sari qadam.</p><div class="about-intro"><p>Pay Work — O‘zbekiston bo‘ylab kunlik, soatbay va masofaviy ishlarni topish hamda ish beruvchilarga kerakli xodimlarni jalb etishni osonlashtirish uchun yaratilayotgan platforma.</p></div><div class="about-grid"><article class="about-card"><div class="about-icon">⌁</div><h3>Loyiha tarixi</h3><strong>2026-yilda boshlandi</strong><p>Pay Work qulay va moslashuvchan ish topish imkoniyatini kengaytirish maqsadida loyiha sifatida ishlab chiqilmoqda.</p></article><article class="about-card"><div class="about-icon">◎</div><h3>Jamoa yo‘nalishlari</h3><strong>Mahsulot · Texnologiya · HR</strong><p>Mahsulot, dasturiy yechimlar va nomzodlar tajribasi yo‘nalishlari ustida ish olib borilmoqda.</p></article><article class="about-card"><div class="about-icon">✦</div><h3>Dastlabki natijalar</h3><strong>MVP demo tayyor</strong><p>Kunlik, soatbay va masofaviy ish qidirish hamda 14 hududni tanlash imkoniyati mavjud.</p></article></div>`;
      return;
    }
    if (section === "instagram") {
      content.innerHTML = `<h3>Instagram sahifamiz</h3><p class="account-lead">Pay Work yangiliklari, ish e’lonlari va foydali tavsiyalar uchun Instagram sahifasi.</p><div class="instagram-account-card"><span>◎</span><div><b>Pay Work Instagram</b><p>Rasmiy sahifa havolasi hali kiritilmagan.</p></div><button class="apply" onclick="showToast('Instagram sahifasining rasmiy havolasi qo‘shilmagan.')">Sahifani ochish ↗</button></div><div class="promo-note">Rasmiy Instagram manzili ulanmaguncha bu bo‘limda faqat demo ma’lumot ko‘rsatiladi.</div>`;
      return;
    }
    if (section === "applications") {
      content.innerHTML = `<h3>${employer(session) ? "Arizalar va e’lonlar" : "Arizalarim va e’lonlar"}</h3>${tabs([["applications", "Faol arizalar"], ["listings", employer(session) ? "E’lonlarim" : "Saqlangan ishlar"], ["archive", "Arxiv"]])}<div class="account-listing-view">${activeApps.length ? activeApps.slice().reverse().map(app => listCard(app)).join("") : empty(employer(session) ? "Sizning faol vakansiyalaringizga hali ariza kelmagan." : "Hali ariza yubormagansiz. Vakansiyani tanlab, Ariza berish tugmasini bosing.")}</div>`;
      return;
    }
    if (section === "listings") {
      if (employer(session)) content.innerHTML = `<h3>Mening e’lonlarim</h3>${tabs([["applications", "Arizalar"], ["listings", "Faol e’lonlar"], ["archive", "Arxiv"]])}${activeJobs.length ? activeJobs.map(job => jobCard(job)).join("") : empty("Hali faol e’lon yo‘q. Yuqoridagi “Ish e’lon qilish” tugmasidan foydalaning.")}`;
      else {
        const keys = JSON.parse(localStorage.getItem("paywork_saved") || "[]"), saved = getJobs().filter(job => keys.includes(job.title + job.company));
        content.innerHTML = `<h3>Saqlangan vakansiyalar</h3>${tabs([["applications", "Arizalarim"], ["listings", "Saqlangan ishlar"], ["archive", "Arxiv"]])}${saved.length ? saved.map(job => `<div class="account-row"><div><b>${esc(job.title)}</b><p>${esc(job.company)} · ${esc(job.city)}</p></div><strong>${Number(job.salary).toLocaleString("uz-UZ")} so‘m</strong></div>`).join("") : empty("Saqlagan vakansiyalaringiz shu yerda ko‘rinadi.")}`;
      }
      return;
    }
    if (section === "archive") {
      content.innerHTML = `<h3>Arxiv</h3>${tabs([["applications", "Arizalar"], ["listings", "E’lonlar"], ["archive", "Arxivlanganlar"]])}<h4>Arxivlangan arizalar</h4>${oldApps.length ? oldApps.map(app => listCard(app, true)).join("") : empty("Arxivlangan arizalar yo‘q.")}<h4>Arxivlangan e’lonlar</h4>${oldJobs.length ? oldJobs.map(job => jobCard(job, true)).join("") : empty("Arxivlangan e’lonlar yo‘q.")}`;
      return;
    }
    if (section === "chats") {
      content.innerHTML = `<div class="paywork-chat-heading"><div><h3>Chatlar</h3><p class="account-lead">ID orqali foydalanuvchini toping yoki Pay Work yangiliklari kanalini oching.</p></div><strong class="paywork-my-id">Mening ID: ${esc(session.user?.user_metadata?.public_id || "Yuklanmoqda…")}</strong></div><form class="paywork-chat-search" id="payworkChatSearch"><input name="public_id" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="Foydalanuvchi ID · 8 raqam" required><button class="btn btn-green">Qidirish</button></form><div class="account-chat-layout"><div class="account-chat-list" id="payworkChatList"><div class="account-empty">Chatlar yuklanmoqda…</div></div><div class="account-chat-thread" id="payworkChatThread"><div class="account-chat-placeholder">Chat yoki kanalni tanlang</div></div></div>`;
      document.getElementById("payworkChatSearch").addEventListener("submit", searchPayworkChatUser);
      loadPayworkChats();
      return;
    }
    if (["settings", "privacy", "security", "notifications", "language", "interface", "app-info", "account-control"].includes(section)) {
      const settingsTabs = [["privacy", "Maxfiylik"], ["security", "Xavfsizlik"], ["notifications", "Bildirishnomalar"], ["language", "Til"], ["app-info", "Dastur haqida"], ["account-control", "Hisob"]];
      const currentTheme = localStorage.getItem("paywork_theme") || "system";
      content.innerHTML = `<h3>${section === "app-info" ? "Dastur haqida" : section === "account-control" ? "Hisob va xavfsizlik" : "Sozlamalar"}</h3><div class="settings-navigation-row">${tabs(settingsTabs)}<div class="settings-quick-theme" aria-label="Interfeys ko‘rinishi"><button class="${currentTheme === "day" ? "active" : ""}" data-theme-choice="day" title="Kunduzgi" aria-label="Kunduzgi" onclick="setPayworkTheme('day')">☀</button><button class="${currentTheme === "night" ? "active" : ""}" data-theme-choice="night" title="Tungi" aria-label="Tungi" onclick="setPayworkTheme('night')">☾</button><button class="${currentTheme === "system" ? "active" : ""}" data-theme-choice="system" title="Tizim bo‘yicha" aria-label="Tizim bo‘yicha" onclick="setPayworkTheme('system')">◐</button></div></div>${section === "security" ? securityHtml(session) : section === "notifications" ? notificationHtml(session) : section === "language" ? languageHtml() : section === "app-info" ? appInfoHtml() : section === "account-control" ? accountControlHtml(session) : privacyHtml(session)}`;
      if (section === "privacy") document.getElementById("accountPrivacyForm").addEventListener("submit", savePrivacy);
       if (section === "notifications") { document.getElementById("accountNotificationsForm").addEventListener("submit", saveNotifications); loadPayworkNotifications(session); }
      if (section === "security") document.getElementById("accountPasswordForm").addEventListener("submit", savePassword);
      if (section === "language") document.getElementById("accountLanguageSelect").addEventListener("change", event => window.setPayworkLanguage(event.target.value));
      if (section === "account-control") document.getElementById("deleteAccountBtn").addEventListener("click", deletePayWorkAccount);
      return;
    }
    if (section === "contact") {
      content.innerHTML = `<h3>Bog‘lanish</h3><p class="account-lead">Savol yoki taklifingizni yozib, rasm yoki video biriktiring.</p><form class="account-form account-contact-form" id="accountContactForm"><div class="field"><label>Ism-familiya</label><input name="name" required value="${esc(session.user?.user_metadata?.full_name || "")}"></div><div class="field"><label>Email yoki telefon</label><input name="contact" required value="${esc(session.user?.email || session.user?.phone || "")}"></div><div class="field"><label>Xabar</label><textarea name="message" required placeholder="Xabaringizni yozing"></textarea></div><div class="field"><label>Rasm yoki video biriktirish</label><input type="file" name="attachment" accept="image/*,video/*"><small class="account-hint">Fayl shu qurilmada saqlanadi; jamoaga yetkazish uchun server ulanishi kerak.</small></div><div id="contactAttachmentPreview"></div><button class="btn btn-green" type="submit">Xabarni yuborish</button></form>`;
      const fileInput = document.querySelector('#accountContactForm [name="attachment"]');
      fileInput.addEventListener("change", () => previewFile(fileInput.files[0], "contactAttachmentPreview"));
      document.getElementById("accountContactForm").addEventListener("submit", saveContactMessage);
    }
  };

  function contactRow(type = "Telefon", value = "") {
    return `<div class="account-contact-row"><select name="contactType"><option ${type === "Telefon" ? "selected" : ""}>Telefon</option><option ${type === "Email" ? "selected" : ""}>Email</option><option ${type === "Telegram" ? "selected" : ""}>Telegram</option><option ${type === "WhatsApp" ? "selected" : ""}>WhatsApp</option><option ${type === "Boshqa" ? "selected" : ""}>Boshqa</option></select><input name="contactValue" value="${esc(value)}" placeholder="Raqam, manzil yoki username"><button type="button" class="btn btn-plain" onclick="this.closest('.account-contact-row').remove()" aria-label="O‘chirish">×</button></div>`;
  }
  function renderAdminProfiles() {
    const list = document.getElementById("adminProfiles"); if (!list) return;
    const cards = Array.from(list.querySelectorAll(".admin-profile-card"));
    const query = (document.getElementById("adminSearch")?.value || "").trim().toLocaleLowerCase();
    const roleFilter = document.getElementById("adminRoleFilter")?.value || "all";
    const statusFilter = document.getElementById("adminStatusFilter")?.value || "all";
    let visible = 0;
    cards.forEach(card => {
      const role = card.querySelector("[data-admin-role]")?.value || "";
      const active = !!card.querySelector("[data-admin-active]")?.checked;
      const isSelf = card.querySelector("[data-admin-role]")?.dataset.adminRole === getSession()?.user?.id;
      card.classList.toggle("admin-profile-self", isSelf);
      card.querySelector("[data-admin-role]")?.toggleAttribute("disabled", isSelf);
      card.querySelector("[data-admin-active]")?.toggleAttribute("disabled", isSelf);
      const matches = (card.dataset.search || card.textContent).toLocaleLowerCase().includes(query) && (roleFilter === "all" || role === roleFilter) && (statusFilter === "all" || (statusFilter === "active") === active);
      card.hidden = !matches; if (matches) visible += 1;
    });
    const count = document.getElementById("adminResultCount");
    if (count) count.textContent = `${visible} / ${cards.length} profil`;
    const summary = document.getElementById("adminSummary");
    if (summary) summary.innerHTML = `<div class="account-stat"><strong>${cards.length}</strong><span>Jami profillar</span></div><div class="account-stat"><strong>${cards.filter(card => card.querySelector("[data-admin-role]")?.value === "candidate").length}</strong><span>Ish izlovchilar</span></div><div class="account-stat"><strong>${cards.filter(card => card.querySelector("[data-admin-role]")?.value === "employer").length}</strong><span>Ish beruvchilar</span></div><div class="account-stat"><strong>${cards.filter(card => !card.querySelector("[data-admin-active]")?.checked).length}</strong><span>Nofaol akkauntlar</span></div>`;
  }

  async function walletRequest(session, kind, amount, note) {
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_create_wallet_request`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_amount: amount, p_note: note })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || "So‘rov yuborilmadi.");
    return result;
  }

  window.loadPayworkWallet = async () => {
    const box = document.getElementById("payworkWallet"); if (!box) return;
    const session = getSession(), config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (!session || session.demo || !session.user?.id) { box.innerHTML = empty("Haqiqiy akkaunt va server ulanishi bo‘lmaguncha hamyon ishlamaydi. Demo rejimida mablag‘ saqlanmaydi."); return; }
    box.innerHTML = empty("Hamyon ma’lumotlari yuklanmoqda…");
    try {
      const [walletResponse, requestsResponse, ledgerResponse] = await Promise.all([
        window.authenticatedPayWorkFetch(`${base}/rest/v1/wallet_accounts?select=available_balance&user_id=eq.${encodeURIComponent(session.user.id)}`),
        window.authenticatedPayWorkFetch(`${base}/rest/v1/wallet_requests?select=id,kind,amount,note,status,created_at,decision_note&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=30`),
        window.authenticatedPayWorkFetch(`${base}/rest/v1/wallet_ledger?select=id,kind,amount_delta,note,created_at&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=30`)
      ]);
      const [walletRows, requests, ledger] = await Promise.all([walletResponse.json(), requestsResponse.json(), ledgerResponse.json()]);
      for (const response of [walletResponse, requestsResponse, ledgerResponse]) if (!response.ok) throw new Error("Hamyon sxemasini Supabase’da o‘rnatish kerak.");
      const balance = Number(walletRows[0]?.available_balance || 0);
      const rows = requests.length ? requests.map(item => `<article class="account-row"><div><b>${item.kind === "deposit" ? "Mablag‘ kiritish" : "Pul yechish"} · ${Number(item.amount).toLocaleString("uz-UZ")} so‘m</b><p>${esc(item.note || "Izoh yo‘q")} · ${new Date(item.created_at).toLocaleString("uz-UZ")}</p>${item.decision_note ? `<small>${esc(item.decision_note)}</small>` : ""}</div><span class="account-status ${item.status === "pending" ? "pending" : ""}">${item.status === "pending" ? "Kutilmoqda" : item.status === "approved" ? "Tasdiqlandi" : "Rad etildi"}</span></article>`).join("") : empty("Hozircha so‘rovlar yo‘q.");
      const ledgerRows = ledger.length ? ledger.map(item => `<article class="account-row"><div><b>${item.kind === "deposit" ? "Mablag‘ kiritildi" : item.kind === "withdrawal" ? "Pul yechildi" : "Taklif bonusi"}</b><p>${esc(item.note || "Tasdiqlangan hamyon amali")} · ${new Date(item.created_at).toLocaleString("uz-UZ")}</p></div><strong>${item.amount_delta > 0 ? "+" : "−"}${Math.abs(Number(item.amount_delta)).toLocaleString("uz-UZ")} so‘m</strong></article>`).join("") : empty("Tasdiqlangan amallar tarixi hozircha yo‘q.");
      box.innerHTML = `<div class="payment-wallet"><span>PAY WORK HAMYONI</span><strong>${balance.toLocaleString("uz-UZ")} <small>so‘m</small></strong><p>Barcha o‘zgarishlar admin tasdiqlovi va audit jurnalida qayd etiladi. Sayt hozir Click yoki avtomatik pul o‘tkazmasini bajarmaydi.</p></div><form class="account-form wallet-request-form" id="walletRequestForm"><div class="field"><label>So‘rov turi</label><select name="kind"><option value="deposit">Mablag‘ kiritishni so‘rash</option><option value="withdrawal">Pul yechishni so‘rash</option></select></div><div class="field"><label>Miqdor (so‘m)</label><input name="amount" type="number" min="1000" max="50000000" step="1000" required></div><div class="field"><label>Izoh (karta raqami yoki maxfiy ma’lumot kiritmang)</label><input name="note" maxlength="300" placeholder="To‘lov izohi yoki admin uchun aloqa"></div><button class="btn btn-green" type="submit">So‘rovni yuborish</button></form><h4 class="experience-list-title">So‘rovlar</h4>${rows}<h4 class="experience-list-title">Hamyon tarixi</h4>${ledgerRows}`;
      document.getElementById("walletRequestForm")?.addEventListener("submit", async event => {
        event.preventDefault(); const form = event.currentTarget, values = new FormData(form), button = form.querySelector('[type="submit"]');
        const amount = Number(values.get("amount")); if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 50000000) { showToast("Miqdor 1 000 dan 50 000 000 so‘mgacha bo‘lishi kerak."); return; }
        button.disabled = true; button.textContent = "Yuborilmoqda…";
        try { await walletRequest(session, String(values.get("kind")), amount, String(values.get("note") || "").trim()); showToast("So‘rov yuborildi. Administrator ko‘rib chiqadi."); await window.loadPayworkWallet(); }
        catch (error) { showToast(error.message || "So‘rov yuborilmadi."); button.disabled = false; button.textContent = "So‘rovni yuborish"; }
      });
    } catch (error) { box.innerHTML = empty(error.message || "Hamyonni yuklab bo‘lmadi."); }
  };

  window.loadAdminWalletRequests = async (session = getSession()) => {
    const box = document.getElementById("adminWalletRequests"); if (!box) return;
    if (session?.user?.user_metadata?.role !== "admin" || session.demo) { box.innerHTML = empty("Administrator sessiyasi talab qilinadi."); return; }
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, ""); box.innerHTML = empty("So‘rovlar yuklanmoqda…");
    try {
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/wallet_requests?select=id,user_id,kind,amount,note,status,created_at&status=eq.pending&order=created_at.asc&limit=100`);
      const requests = await response.json(); if (!response.ok) throw new Error(requests.message || "So‘rovlarni yuklab bo‘lmadi.");
      if (!requests.length) { box.innerHTML = empty("Tasdiqlashni kutayotgan so‘rov yo‘q."); return; }
      const ids = [...new Set(requests.map(item => item.user_id))];
      const profilesResponse = await window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?select=id,full_name,email,phone&id=in.(${ids.map(encodeURIComponent).join(",")})`);
      const profiles = profilesResponse.ok ? await profilesResponse.json() : [];
      const byId = new Map(profiles.map(item => [item.id, item]));
      box.innerHTML = requests.map(item => { const person = byId.get(item.user_id) || {}; return `<article class="account-row admin-wallet-request"><div><b>${item.kind === "deposit" ? "Mablag‘ kiritish" : "Pul yechish"} · ${Number(item.amount).toLocaleString("uz-UZ")} so‘m</b><p>${esc(person.full_name || "Foydalanuvchi")} · ${esc(person.email || person.phone || item.user_id)} · ${new Date(item.created_at).toLocaleString("uz-UZ")}</p><small>${esc(item.note || "Izoh yo‘q")}</small></div><div class="account-actions"><button class="btn btn-green" type="button" onclick="resolveWalletRequest('${esc(item.id)}','approved')">Tasdiqlash</button><button class="btn btn-plain" type="button" onclick="resolveWalletRequest('${esc(item.id)}','rejected')">Rad etish</button></div></article>`; }).join("");
    } catch (error) { box.innerHTML = empty(error.message || "So‘rovlar yuklanmadi."); }
  };

  window.resolveWalletRequest = async (id, decision) => {
    const session = getSession(), config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (session?.user?.user_metadata?.role !== "admin" || session.demo) { showToast("Bu amal uchun haqiqiy administrator sessiyasi kerak."); return; }
    const note = decision === "rejected" ? prompt("Rad etish sababini kiriting (ixtiyoriy):") : prompt("Tasdiqlash izohi (ixtiyoriy):");
    if (note === null) return;
    try {
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_admin_resolve_wallet_request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_request_id: id, p_decision: decision, p_note: note }) });
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || "So‘rovni yangilab bo‘lmadi.");
      showToast(decision === "approved" ? "So‘rov tasdiqlandi va hamyon hisobi yangilandi." : "So‘rov rad etildi.");
      try { await window.authenticatedPayWorkFetch(`${base}/functions/v1/telegram-notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id }) }); } catch (_) {}
      await window.loadAdminWalletRequests(session);
    } catch (error) { showToast(error.message || "So‘rovni yangilab bo‘lmadi."); }
  };

  async function loadInviteReferrals(session, fallbackCode) {
    const codeNode = document.getElementById("inviteCodeValue"), list = document.getElementById("inviteFriends"), total = document.getElementById("inviteBonusTotal");
    if (!list || !total) return;
    if (session.demo || !session.user?.id) { list.innerHTML = empty("Haqiqiy akkaunt bilan kirgach takliflar shu yerda ko‘rinadi."); return; }
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    try {
      const ownResponse = await window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?select=referral_code&id=eq.${encodeURIComponent(session.user.id)}`);
      const ownRows = await ownResponse.json();
      if (!ownResponse.ok) throw new Error(ownRows.message || "Taklif kodini yuklab bo‘lmadi.");
      const code = ownRows[0]?.referral_code || fallbackCode;
      if (codeNode) codeNode.textContent = code;
      localStorage.setItem(`paywork_invite_${identity(session)}`, code);
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_list_my_referrals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const friends = await response.json();
      if (!response.ok) throw new Error(friends.message || "Taklif qilgan do‘stlarni yuklab bo‘lmadi.");
      const confirmed = friends.filter(friend => friend.referral_work_started_at && friend.referral_bonus_confirmed).length;
      total.textContent = `Tasdiqlangan bonus: ${(confirmed * 10000).toLocaleString("uz-UZ")} so‘m`;
      list.innerHTML = friends.length ? friends.map(friend => {
        const started = !!friend.referral_work_started_at;
        const info = [friend.public_id ? `ID: ${friend.public_id}` : "", friend.role === "employer" ? "Ish beruvchi" : "Ish izlovchi"].filter(Boolean).join(" · ");
        return `<article class="invite-friend"><div class="invite-friend-avatar">${esc((friend.full_name || "D").trim().charAt(0).toUpperCase())}</div><div class="invite-friend-info"><b>${esc(friend.full_name || "Do‘st")}</b><small>${esc(info)}</small></div><span class="invite-friend-status ${started ? "confirmed" : "pending"}">${started ? "+10 000 so‘m tasdiqlandi" : "Ish boshlashi kutilmoqda"}</span></article>`;
      }).join("") : empty("Hozircha taklif kodingiz orqali ro‘yxatdan o‘tgan do‘st yo‘q.");
    } catch (error) { list.innerHTML = empty(error.message || "Takliflar yuklanmadi."); }
  }

  async function loadAdminProfiles(session) {
    const target = document.getElementById("adminProfiles"); if (!target) return;
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    try {
      session = await window.refreshPayWorkProfile(session);
      if (session?.user?.user_metadata?.role !== "admin") throw new Error("Administrator huquqi topilmadi. Sahifani yangilang yoki administrator sifatida qayta kiring.");
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?select=id,email,phone,full_name,role,is_active,age,gender,contacts,avatar,created_at,updated_at,referred_by,referral_work_started_at,referral_bonus_confirmed&order=created_at.desc`);
      const profiles = await response.json(); if (!response.ok) throw new Error(profiles.message || "Profillarni yuklab bo‘lmadi.");
      if (!profiles.length) { target.innerHTML = empty("Hozircha profillar topilmadi."); return; }
      const profilesById = new Map(profiles.map(item => [item.id, item]));
      const profileDetails = profile => {
        const contacts = Array.isArray(profile.contacts) ? profile.contacts : [];
        const contactText = contacts.length ? contacts.map(item => `${item.type || "Aloqa"}: ${item.value || ""}`).join("\n") : "Qo‘shimcha aloqa kiritilmagan";
        const inviter = profilesById.get(profile.referred_by);
        const created = profile.created_at ? new Date(profile.created_at).toLocaleString("uz-UZ") : "Noma’lum";
        return `<h4>Shaxsiy ma’lumotlar</h4><dl><div><dt>Profil ID</dt><dd>${esc(profile.id)}</dd></div><div><dt>Email</dt><dd>${esc(profile.email || "Kiritilmagan")}</dd></div><div><dt>Telefon</dt><dd>${esc(profile.phone || "Kiritilmagan")}</dd></div><div><dt>Yosh va jins</dt><dd>${esc(profile.age ? `${profile.age} yosh` : "Yosh kiritilmagan")}${profile.gender ? ` · ${esc(profile.gender)}` : " · Jins kiritilmagan"}</dd></div><div><dt>Boshqa aloqa ma’lumotlari</dt><dd class="admin-profile-contacts">${esc(contactText)}</dd></div><div><dt>Profil rasmi</dt><dd>${profile.avatar ? "Kiritilgan" : "Kiritilmagan"}</dd></div><div><dt>Rol va holat</dt><dd>${esc(profile.role === "admin" ? "Administrator" : profile.role === "employer" ? "Ish beruvchi" : "Ish izlovchi")} · ${profile.is_active ? "Faol" : "Nofaol"}</dd></div></dl><h4>Akkaunt tarixi va taklif</h4><dl><div><dt>Ro‘yxatdan o‘tgan vaqt</dt><dd>${esc(created)}</dd></div><div><dt>Oxirgi yangilanish</dt><dd>${esc(profile.updated_at ? new Date(profile.updated_at).toLocaleString("uz-UZ") : "Noma’lum")}</dd></div><div><dt>Taklif qilgan foydalanuvchi</dt><dd>${esc(profile.referred_by ? (inviter?.full_name || inviter?.email || profile.referred_by) : "Taklif orqali kelmagan")}</dd></div><div><dt>Ish boshlashi / bonus</dt><dd>${esc(profile.referral_work_started_at ? `${new Date(profile.referral_work_started_at).toLocaleString("uz-UZ")} · ${profile.referral_bonus_confirmed ? "10 000 so‘m tasdiqlangan" : "Bonus tasdiqlanmagan"}` : profile.referred_by ? "Ish boshlashi kutilmoqda" : "Tegishli emas")}</dd></div></dl>`;
      };
      adminProfilesData = profiles;
      window.openAdminProfileDetails = id => {
        const selected = adminProfilesData.find(item => item.id === id); if (!selected) return;
        document.getElementById("adminProfileModal")?.remove();
        const modal = document.createElement("div"); modal.className = "admin-profile-modal"; modal.id = "adminProfileModal";
        modal.innerHTML = `<section class="admin-profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminProfileModalTitle"><header class="admin-profile-modal-head"><div><span>FOYDALANUVCHI PROFILI</span><h3 id="adminProfileModalTitle">${esc(selected.full_name || "Ism kiritilmagan")}</h3><p>${esc([selected.email, selected.phone].filter(Boolean).join(" · ") || "Aloqa ma’lumoti kiritilmagan")}</p></div><button type="button" onclick="closeAdminProfileDetails()" aria-label="Yopish">×</button></header><div class="admin-profile-modal-body">${profileDetails(selected)}<div class="admin-profile-modal-foot"><button class="btn btn-green" type="button" onclick="closeAdminProfileDetails()">Yopish</button></div></div></section>`;
        modal.addEventListener("click", event => { if (event.target === modal) window.closeAdminProfileDetails(); });
        document.body.append(modal); document.body.style.overflow = "hidden";
        window.closeAdminProfileDetails = () => { document.getElementById("adminProfileModal")?.remove(); document.body.style.overflow = ""; };
        modal.querySelector("button")?.focus();
      };
      target.innerHTML = profiles.map(profile => `<article class="admin-profile-card" data-search="${esc([profile.full_name, profile.email, profile.phone, ...(Array.isArray(profile.contacts) ? profile.contacts.map(item => item.value) : [])].filter(Boolean).join(" "))}"><div class="admin-profile-summary"><b>${esc(profile.full_name || "Ism kiritilmagan")}</b><p>${esc(profile.email || profile.phone || "Aloqa ko‘rsatilmagan")}</p><small>${profile.age ? `${esc(profile.age)} yosh` : "Yosh ko‘rsatilmagan"}${profile.gender ? ` · ${esc(profile.gender)}` : ""}</small></div><label>Rol<select data-admin-role="${esc(profile.id)}"><option value="candidate" ${profile.role === "candidate" ? "selected" : ""}>Ish izlovchi</option><option value="employer" ${profile.role === "employer" ? "selected" : ""}>Ish beruvchi</option><option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrator</option></select></label><label class="admin-profile-active">Faol<input type="checkbox" data-admin-active="${esc(profile.id)}" ${profile.is_active ? "checked" : ""}></label>${profile.referred_by ? `<div class="admin-referral-state"><small>Taklif orqali ro‘yxatdan o‘tgan · ${profile.referral_work_started_at ? "ish boshlagan" : "ishga chiqishi kutilmoqda"}</small>${!profile.referral_work_started_at ? `<button class="btn btn-plain" onclick="confirmReferralWork('${esc(profile.id)}')">Ish boshlaganini tasdiqlash</button>` : `<small>Bonus: 10 000 so‘m tasdiqlandi</small>`}</div>` : ""}<button class="btn btn-plain" onclick="saveAdminProfile('${esc(profile.id)}')">Saqlash</button><button class="btn btn-plain" type="button" onclick="openAdminCredentialEditor('${esc(profile.id)}')">Email, telefon yoki parolni o‘zgartirish</button><button class="admin-profile-details" type="button" onclick="openAdminProfileDetails('${esc(profile.id)}')">↗　To‘liq profil ma’lumotlari</button></article>`).join("");
    } catch (error) { target.innerHTML = `<div class="account-empty">${esc(error.message || "Server bilan bog‘lanib bo‘lmadi.")} SQL sxemani Supabase’da ishga tushirganingizni tekshiring.</div>`; }
  }
  window.openAdminCredentialEditor = id => {
    const session = getSession(), selected = adminProfilesData.find(item => item.id === id);
    if (session?.user?.user_metadata?.role !== "admin" || !selected) { showToast("Bu amal faqat administrator uchun."); return; }
    document.getElementById("adminCredentialModal")?.remove();
    const modal = document.createElement("div"); modal.className = "admin-profile-modal"; modal.id = "adminCredentialModal";
    modal.innerHTML = `<section class="admin-profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminCredentialTitle"><header class="admin-profile-modal-head"><div><span>ADMINISTRATOR AMALI</span><h3 id="adminCredentialTitle">Kirish ma’lumotlarini o‘zgartirish</h3><p>${esc(selected.full_name || "Foydalanuvchi")} · ${esc(selected.email || selected.phone || selected.id)}</p></div><button type="button" onclick="closeAdminCredentialEditor()" aria-label="Yopish">×</button></header><form class="admin-profile-modal-body" id="adminCredentialForm"><label class="field"><span>Yangi email</span><input type="email" name="email" autocomplete="off" value="${esc(selected.email || "")}" placeholder="email@example.com"></label><label class="field"><span>Yangi telefon (xalqaro formatda)</span><input type="tel" name="phone" autocomplete="off" value="${esc(selected.phone || "")}" placeholder="+998901234567"></label><label class="field"><span>Yangi parol</span><input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="O‘zgartirmaslik uchun bo‘sh qoldiring"></label><p class="account-hint">Email yoki telefonni o‘zgartirishda bo‘sh qoldirilgan maydon saqlanadi. Parol hech qachon ko‘rsatilmaydi; yangi parol kiritilmasa o‘zgarmaydi.</p><div class="admin-profile-modal-foot"><button class="btn btn-plain" type="button" onclick="closeAdminCredentialEditor()">Bekor qilish</button><button class="btn btn-green" type="submit">O‘zgarishni saqlash</button></div></form></section>`;
    modal.addEventListener("click", event => { if (event.target === modal) window.closeAdminCredentialEditor(); });
    document.body.append(modal); document.body.style.overflow = "hidden";
    window.closeAdminCredentialEditor = () => { document.getElementById("adminCredentialModal")?.remove(); document.body.style.overflow = ""; };
    modal.querySelector("#adminCredentialForm").addEventListener("submit", event => window.saveAdminCredentials(event, id));
    modal.querySelector("input[name=email]")?.focus();
  };
  window.saveAdminCredentials = async (event, id) => {
    event.preventDefault();
    const session = getSession(), config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, ""), form = event.currentTarget, values = new FormData(form);
    if (session?.user?.user_metadata?.role !== "admin" || session.demo) { showToast("Bu amal faqat haqiqiy administrator akkauntida ishlaydi."); return; }
    const email = String(values.get("email") || "").trim(), phone = String(values.get("phone") || "").trim(), password = String(values.get("password") || "");
    const original = adminProfilesData.find(item => item.id === id);
    const payload = { targetUserId: id, email: email !== (original?.email || "") ? email : "", phone: phone !== (original?.phone || "") ? phone : "", password };
    if (!payload.email && !payload.phone && !password) { showToast("O‘zgartirish uchun kamida bitta yangi ma’lumot kiriting."); return; }
    const button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = "Saqlanmoqda…";
    try {
      const response = await window.authenticatedPayWorkFetch(`${base}/functions/v1/admin-update-user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Ma’lumotlarni yangilab bo‘lmadi.");
      showToast("Akkaunt ma’lumotlari yangilandi."); window.closeAdminCredentialEditor();
      await loadAdminProfiles(session); renderAdminProfiles();
    } catch (error) { showToast(error.message || "Server bilan bog‘lanib bo‘lmadi."); button.disabled = false; button.textContent = "O‘zgarishni saqlash"; }
  };
  window.saveAdminProfile = async id => {
    const session = getSession(), config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (session?.user?.id === id) { showToast("O‘z akkauntingiz rolini yoki holatini o‘zgartirib bo‘lmaydi."); return; }
    const role = document.querySelector(`[data-admin-role="${CSS.escape(id)}"]`)?.value;
    const is_active = document.querySelector(`[data-admin-active="${CSS.escape(id)}"]`)?.checked;
    if (!session || !["candidate", "employer", "admin"].includes(role)) return;
    try {
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ role, is_active }) });
      if (!response.ok) throw new Error("O‘zgarishlarni saqlab bo‘lmadi.");
      showToast("Profil yangilandi. Rol o‘zgarishi uchun foydalanuvchi qayta kirishi kerak.");
      await loadAdminProfiles(session); renderAdminProfiles();
    } catch (error) { showToast(error.message || "Server bilan bog‘lanib bo‘lmadi."); }
  };
  window.confirmReferralWork = async id => {
    const session = getSession(), config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (session?.user?.user_metadata?.role !== "admin") { showToast("Bu amal uchun administrator huquqi kerak."); return; }
    try {
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_admin_confirm_referral`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_referred_user_id: id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Ish boshlagan holatini saqlab bo‘lmadi.");
      showToast("Ish boshlagani tasdiqlandi, 10 000 so‘m bonus hamyonga qo‘shildi."); await loadAdminProfiles(session); renderAdminProfiles();
    } catch (error) { showToast(error.message || "Server bilan bog‘lanib bo‘lmadi."); }
  };
  window.addProfileContact = () => document.getElementById("profileContacts").insertAdjacentHTML("beforeend", contactRow());

  window.saveAccountProfile = async event => {
    event.preventDefault(); const session = getSession(), form = event.currentTarget, values = new FormData(form);
    const contacts = Array.from(form.querySelectorAll(".account-contact-row")).map(row => ({ type: row.querySelector("[name=contactType]").value, value: row.querySelector("[name=contactValue]").value.trim() })).filter(item => item.value);
    const metadata = { ...(session.user?.user_metadata || {}), full_name: String(values.get("full_name")).trim(), age: values.get("age") || "", gender: values.get("gender") || "", contacts };
    if (!metadata.full_name) return;
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    if (!session.demo && base && config.publishableKey && session.access_token) {
      try {
        const response = await window.authenticatedPayWorkFetch(`${base}/auth/v1/user`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: metadata }) });
        const updated = await response.json(); if (!response.ok) throw new Error(updated.message || "Profilni yangilab bo‘lmadi."); session.user = updated;
      } catch (error) { showToast(error.message || "Server bilan bog‘lanib bo‘lmadi."); return; }
    }
    if (!session.demo && base && config.publishableKey && session.access_token && session.user?.id) {
      try {
        const profileResponse = await window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ email: session.user.email || null, phone: session.user.phone || null, full_name: metadata.full_name, age: metadata.age ? Number(metadata.age) : null, gender: metadata.gender, contacts: metadata.contacts, avatar: metadata.avatar || "" }) });
        if (!profileResponse.ok) throw new Error("Profil serverdagi jadvalga sinxronlanmadi.");
      } catch (error) { console.warn("Pay Work profile sync is unavailable.", error); }
    }
    session.user = session.user || {}; session.user.user_metadata = metadata; localStorage.setItem("paywork_auth", JSON.stringify(session));
    if (session.demo) { const accounts = JSON.parse(localStorage.getItem("paywork_demo_accounts") || "{}"); const key = identity(session); if (accounts[key]) { Object.assign(accounts[key], metadata); localStorage.setItem("paywork_demo_accounts", JSON.stringify(accounts)); } }
    document.getElementById("accountName").textContent = metadata.full_name; const badge = document.getElementById("accountBadge"); badge.innerHTML = metadata.avatar ? `<img src="${metadata.avatar}" alt="Profil rasmi">` : esc(metadata.full_name.charAt(0).toUpperCase()); showToast("Shaxsiy ma’lumotlar saqlandi.");
  };

  function privacyHtml(session) {
    const prefs = JSON.parse(localStorage.getItem(`paywork_privacy_${identity(session)}`) || '{"showName":true,"showPhone":false,"showEmail":false,"showAge":false,"showGender":false,"chatContact":true,"publicProfile":true}');
    const toggle = (key, label) => `<label class="account-setting"><span>${label}</span><input type="checkbox" name="${key}" ${prefs[key] ? "checked" : ""}></label>`;
    return `<h4>Profil va chat maxfiyligi</h4><p class="account-lead">Suhbatdoshlar profilingizda qaysi ma’lumotlarni ko‘rishini boshqaring.</p><form class="account-settings-list" id="accountPrivacyForm" action="javascript:void(0)" onsubmit="return false">${toggle("publicProfile", "Profilim ommaviy ko‘rinsin")}${toggle("showName", "Ism-familiyam ko‘rinsin")}${toggle("showPhone", "Telefon raqamim ko‘rinsin")}${toggle("showEmail", "Email manzilim ko‘rinsin")}${toggle("showAge", "Yoshim ko‘rinsin")}${toggle("showGender", "Jinsim ko‘rinsin")}${toggle("chatContact", "Chatda aloqa usullarim ko‘rinsin")}<button class="btn btn-green" type="button" onclick="saveAccountPrivacy(this)">Maxfiylikni saqlash</button></form>`;
  }
  function notificationHtml(session) {
    const prefs = JSON.parse(localStorage.getItem(`paywork_notifications_${identity(session)}`) || '{"telegram":false}');
    const toggle = (key, label) => `<label class="account-setting"><span>${label}</span><input type="checkbox" name="${key}" ${prefs[key] ? "checked" : ""}></label>`;
    return `<h4>Bildirishnomalar</h4><p class="account-lead">Sayt va Mini App xabarlari akkauntingizda saqlanadi. Telegram xabarlari uchun botni Mini App ichidan ulang.</p><form class="account-settings-list" id="accountNotificationsForm">${toggle("telegram", "Ariza va hamyon xabarlarini Telegram’da olish")}<button class="btn btn-green">Bildirishnomalarni saqlash</button></form><div class="account-inbox"><div class="admin-list-heading"><strong>Sayt va mini ilova xabarlari</strong><button class="btn btn-plain" type="button" onclick="loadPayworkNotifications()">Yangilash</button></div><div id="payworkNotificationInbox"><div class="account-empty">Xabarlar yuklanmoqda…</div></div><p id="telegramLinkState" class="account-hint"></p><button class="btn btn-plain" id="telegramLinkButton" type="button" onclick="linkPayworkTelegram()">Telegram botni ulash</button></div>`;
  }
  window.loadPayworkNotifications = async (session = getSession()) => {
    const box = document.getElementById("payworkNotificationInbox"); if (!box) return;
    if (!session || session.demo || !session.user?.id) { box.innerHTML = empty("Xabarlar haqiqiy akkauntda ko‘rinadi."); return; }
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
    try {
      const [messageResponse, profileResponse] = await Promise.all([
        window.authenticatedPayWorkFetch(`${base}/rest/v1/paywork_notifications?select=id,kind,title,body,is_read,created_at&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=30`),
        window.authenticatedPayWorkFetch(`${base}/rest/v1/profiles?select=telegram_user_id,notification_telegram&id=eq.${encodeURIComponent(session.user.id)}`)
      ]);
      const [messages, profiles] = await Promise.all([messageResponse.json(), profileResponse.json()]);
      if (!messageResponse.ok) throw new Error(messages.message || "Xabarlarni yuklab bo‘lmadi.");
      box.innerHTML = messages.length ? messages.map(item => `<article class="account-row"><div><b>${esc(item.title)}</b><p>${esc(item.body || "")}</p><small>${new Date(item.created_at).toLocaleString("uz-UZ")}</small></div>${item.is_read ? "" : '<span class="account-status">Yangi</span>'}</article>`).join("") : empty("Hozircha yangi xabar yo‘q.");
      if (messages.some(item => !item.is_read)) await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_mark_notifications_read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const linked = !!profiles?.[0]?.telegram_user_id;
      const state = document.getElementById("telegramLinkState"), button = document.getElementById("telegramLinkButton"), toggle = document.querySelector('#accountNotificationsForm [name="telegram"]');
      if (state) state.textContent = linked ? "Telegram bot ulangan." : "Telegram bot hali ulanmagan. Avval Pay Work Mini App’ni bot ichidan oching.";
      if (button) { button.disabled = !window.Telegram?.WebApp?.initData || linked; button.textContent = linked ? "Telegram ulangan" : window.Telegram?.WebApp?.initData ? "Telegram’ni ulash" : "Telegram Mini App ichida ulash mumkin"; }
      if (toggle) { toggle.checked = !!profiles?.[0]?.notification_telegram; toggle.disabled = !linked; }
    } catch (error) { box.innerHTML = empty(error.message || "Xabarlarni yuklab bo‘lmadi."); }
  };
  window.linkPayworkTelegram = async () => {
    const session = getSession(), initData = window.Telegram?.WebApp?.initData;
    if (!session?.access_token || session.demo) { showToast("Avval Pay Work akkauntingizga kiring."); return; }
    if (!initData) { showToast("Telegram bog‘lash uchun Mini App’ni bot ichidan oching."); return; }
    try {
      const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
      const response = await window.authenticatedPayWorkFetch(`${base}/functions/v1/telegram-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData }) });
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "Telegram’ni ulab bo‘lmadi.");
      showToast("Telegram akkauntingiz xavfsiz ulandi."); await window.loadPayworkNotifications(session);
    } catch (error) { showToast(error.message || "Telegram’ni ulab bo‘lmadi."); }
  };
  function languageHtml() {
    const current = localStorage.getItem("paywork_language") || "uz";
    return `<h4>Til</h4><p class="account-lead">Ilova menyusi va interfeys tilini tanlang.</p><div class="field settings-select-field"><label for="accountLanguageSelect">Ilova tili</label><select id="accountLanguageSelect"><option value="uz" ${current === "uz" ? "selected" : ""}>O‘zbek — O‘zbekcha</option><option value="ru" ${current === "ru" ? "selected" : ""}>Русский — Русский</option><option value="en" ${current === "en" ? "selected" : ""}>English — English</option><option value="kk" ${current === "kk" ? "selected" : ""}>Қазақша — Қазақша</option><option value="ky" ${current === "ky" ? "selected" : ""}>Кыргызча — Кыргызча</option><option value="tj" ${current === "tj" ? "selected" : ""}>Тоҷикӣ — Тоҷикӣ</option></select></div><p class="account-hint">Tanlangan til shu qurilmadagi Pay Work oynalarida qo‘llanadi.</p>`;
  }
  function interfaceHtml() {
    const current = localStorage.getItem("paywork_theme") || "system", choices = [["day", "☀", "Kunduzgi"], ["night", "☾", "Tungi"], ["system", "◐", "Tizim bo‘yicha"]];
    return `<h4>Interfeys ko‘rinishi</h4><p class="account-lead">Pay Work ko‘rinishini o‘zingizga qulay tanlang.</p><div class="theme-choice-list">${choices.map(([id,icon,label])=>`<button class="theme-choice ${current===id?"active":""}" data-theme-choice="${id}" onclick="setPayworkTheme('${id}')"><span>${icon}</span><b>${label}</b><i></i></button>`).join("")}</div>`;
  }
  function appInfoHtml() {
    return `<h4>Pay Work haqida</h4><p class="account-lead">O‘zbekistonda kunlik, soatbay va masofaviy ishlarni topish uchun yaratilgan platforma.</p><div class="app-info-card"><span class="brand-mark">↗</span><div><b>Pay Work</b><small>Ilova versiyasi 4.9.0</small></div></div><div class="account-row"><div><b>Loyiha boshlangan</b><p>2026-yil</p></div><span class="account-status">MVP demo</span></div><div class="account-row"><div><b>Qo‘llab-quvvatlanadigan hududlar</b><p>O‘zbekistonning 14 hududi</p></div></div><p class="account-hint">Demo versiyadagi ma’lumotlar hozircha shu qurilmada saqlanadi.</p>`;
  }
  function accountControlHtml(session) {
    return `<h4>Akkaunt boshqaruvi</h4><p class="account-lead">Chiqish yoki Pay Work akkauntingiz va unga tegishli ma’lumotlarni o‘chirish.</p><div class="account-control-list"><article><div><b>Akkauntdan chiqish</b><p>Ushbu qurilmadagi akkaunt seansini yakunlang.</p></div><button class="btn btn-plain" onclick="logoutPayWork()">Chiqish</button></article><article class="account-delete"><div><b>Akkauntni butunlay o‘chirish</b><p>Akkauntingiz va u bilan bog‘liq ma’lumotlarni o‘chiradi. Bu amalni qaytarib bo‘lmaydi.</p></div><button class="btn btn-danger" id="deleteAccountBtn">Butunlay o‘chirish</button></article></div><p class="account-hint">Akkauntni o‘chirish so‘rovini <a href="./delete-account.html">Pay Work saytida</a> ham yuborishingiz mumkin.</p>`;
  }
  window.setPayworkTheme = theme => { if (!window.applyPayworkTheme) return; localStorage.setItem("paywork_theme", theme); window.applyPayworkTheme(); window.showAccountSection(["privacy", "security", "notifications", "language", "interface", "app-info", "account-control", "settings"].includes(activeAccountSection) ? activeAccountSection : "interface"); };
  window.setPayworkLanguage = lang => { if (!window.applyPayworkLanguage) return; window.applyPayworkLanguage(lang); window.showAccountSection("language"); };
  window.freezePayWorkAccount = () => {
    const session = getSession(); if (!session?.demo) { showToast("Akkauntni muzlatish uchun server xizmati kerak."); return; }
    if (!confirm("Akkauntingizni vaqtincha muzlatib, tizimdan chiqasizmi?")) return;
    const key = identity(session), accounts = JSON.parse(localStorage.getItem("paywork_demo_accounts") || "{}"); if (accounts[key]) { accounts[key].frozen = true; localStorage.setItem("paywork_demo_accounts", JSON.stringify(accounts)); }
    showToast("Demo akkauntingiz muzlatildi."); window.logoutPayWork();
  };
  async function deletePayWorkAccount() {
    const session = getSession(); if (!session?.access_token) { showToast("Avval akkauntingizga kiring."); return; }
    if (!confirm("Pay Work akkauntingiz va unga bog‘liq ma’lumotlarni butunlay o‘chirasizmi? Bu amalni qaytarib bo‘lmaydi.")) return;
    const confirmation = prompt("Tasdiqlash uchun O‘CHIRISH deb yozing:"); if (confirmation?.trim().toUpperCase().replace(/[‘’]/g, "'") !== "O'CHIRISH") { showToast("Akkaunt o‘chirish bekor qilindi."); return; }
    if (!session.demo) {
      try {
        const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
        const response = await window.authenticatedPayWorkFetch(`${base}/functions/v1/delete-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Akkauntni o‘chirib bo‘lmadi. Keyinroq qayta urinib ko‘ring.");
      } catch (error) { showToast(error.message || "Akkauntni o‘chirib bo‘lmadi."); return; }
    }
    const key = identity(session), accounts = JSON.parse(localStorage.getItem("paywork_demo_accounts") || "{}"); delete accounts[key]; localStorage.setItem("paywork_demo_accounts", JSON.stringify(accounts));
    localStorage.setItem("paywork_apps", JSON.stringify(getApps().filter(app => app.applicantId !== key && app.employerId !== key)));
    localStorage.setItem("paywork_jobs", JSON.stringify(getJobs().filter(job => job.employerId !== key)));
    for (const storageKey of Object.keys(localStorage)) if (storageKey.endsWith(`_${key}`) || storageKey.includes(`_${key}_`)) localStorage.removeItem(storageKey);
    localStorage.removeItem("paywork_auth"); document.getElementById("authNavBtn").textContent = "Kirish"; window.closeDashboard(); showToast("Demo akkaunt va unga bog‘liq ma’lumotlar o‘chirildi.");
  }
  function securityHtml(session = getSession()) {
    const googleIdentity = (session?.user?.identities || []).some(identity => identity.provider === "google");
    const googleAction = googleIdentity
      ? '<span class="account-status">Google ulangan</span>'
      : '<button type="button" class="btn btn-plain" onclick="signInWithGoogle()">Google orqali kirish</button>';
    return `<h4>Parolni o‘zgartirish</h4><form class="account-form" id="accountPasswordForm"><div class="field"><label>Amaldagi parol</label><input name="current" type="password" required></div><div class="field"><label>Yangi parol</label><input name="password" type="password" minlength="6" required></div><div class="field"><label>Yangi parolni takrorlang</label><input name="confirm" type="password" minlength="6" required></div><button class="btn btn-green">Parolni yangilash</button></form><h4 style="margin-top:26px">Qo‘shimcha himoya</h4><div class="security-option"><div><b>Google orqali kirish</b><small>Google hisobingiz bilan tizimga kirish usuli</small></div>${googleAction}</div><div class="security-option"><div><b>Passkey</b><small>Qurilma kaliti bilan kirish</small></div><label class="security-switch"><input type="checkbox" disabled><span></span></label><span class="account-status">Server sozlamasi kerak</span></div><div class="security-option"><div><b>MyID orqali tasdiqlash</b><small>Shaxsni tasdiqlash xizmatini ulash kerak</small></div><label class="security-switch"><input type="checkbox" disabled><span></span></label><span class="account-status">Ulanmagan</span></div><div class="security-option"><div><b>Ikki bosqichli tasdiqlash</b><small>SMS yoki autentifikator kodi</small></div><label class="security-switch"><input type="checkbox" disabled><span></span></label><span class="account-status">Ulanmagan</span></div><p class="account-hint">Google orqali kirish Supabase Auth sozlamalari va Google provayderi yoqilgan bo‘lishini talab qiladi. Bu qo‘shimcha kirish usuli, ikki bosqichli tasdiqlash emas.</p>`;
  }
  async function sha256(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  async function savePassword(event) {
    event.preventDefault(); const session = getSession(), values = new FormData(event.currentTarget), current = String(values.get("current")), password = String(values.get("password"));
    if (password !== values.get("confirm")) { showToast("Yangi parollar bir xil emas."); return; }
    if (password.length < 6) { showToast("Parol kamida 6 ta belgidan iborat bo‘lsin."); return; }
    if (session.demo) {
      const accounts = JSON.parse(localStorage.getItem("paywork_demo_accounts") || "{}"), key = identity(session), account = accounts[key];
      if (!account || account.passwordHash !== await sha256(current)) { showToast("Amaldagi parol noto‘g‘ri."); return; }
      account.passwordHash = await sha256(password); accounts[key] = account; localStorage.setItem("paywork_demo_accounts", JSON.stringify(accounts)); showToast("Demo akkaunt paroli yangilandi.");
      event.currentTarget.reset(); return;
    }
    const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, ""), user = session.user || {};
    try {
      const identityValue = user.email || user.phone, login = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ ...(user.email ? { email: identityValue } : { phone: identityValue }), password: current }) });
      const loginData = await login.json(); if (!login.ok) throw new Error("Amaldagi parol noto‘g‘ri.");
      const update = await fetch(`${base}/auth/v1/user`, { method: "PUT", headers: { apikey: config.publishableKey, Authorization: `Bearer ${loginData.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const updateData = await update.json(); if (!update.ok) throw new Error(updateData.message || "Parolni yangilab bo‘lmadi.");
      localStorage.setItem("paywork_auth", JSON.stringify({ ...session, ...loginData, user: updateData })); showToast("Parol yangilandi."); event.currentTarget.reset();
    } catch (error) { showToast(error.message || "Parolni yangilashda xatolik."); }
  }
  function savePrivacy(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget), session = getSession();
    localStorage.setItem(`paywork_privacy_${identity(session)}`, JSON.stringify(Object.fromEntries(["showName", "showPhone", "showEmail", "showAge", "showGender", "chatContact", "publicProfile"].map(key => [key, data.has(key)])))); showToast("Maxfiylik sozlamalari saqlandi.");
  }
  window.saveAccountPrivacy = button => {
    const form = button?.closest("#accountPrivacyForm");
    if (!form) return;
    const session = getSession();
    if (!session?.access_token) { showToast("Saqlash uchun avval akkauntingizga kiring."); return; }
    const data = new FormData(form);
    localStorage.setItem(`paywork_privacy_${identity(session)}`, JSON.stringify(Object.fromEntries(["showName", "showPhone", "showEmail", "showAge", "showGender", "chatContact", "publicProfile"].map(key => [key, data.has(key)]))));
    showToast("Maxfiylik sozlamalari saqlandi.");
  };
  async function saveNotifications(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget), session = getSession();
    const prefs = { telegram: data.has("telegram") };
    try {
      if (!session?.demo) {
        const config = window.PAYWORK_CONFIG || {}, base = (config.supabaseUrl || "").replace(/\/$/, "");
        const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/rpc/paywork_set_telegram_notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_enabled: prefs.telegram }) });
        const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || "Telegram sozlamasini saqlab bo‘lmadi.");
      }
      localStorage.setItem(`paywork_notifications_${identity(session)}`, JSON.stringify(prefs));
      showToast("Bildirishnoma sozlamalari saqlandi.");
    } catch (error) { showToast(error.message || "Bildirishnoma sozlamalari saqlanmadi."); }
  }

  window.archiveApplication = keyEncoded => {
    const session = getSession(), key = decodeURIComponent(keyEncoded), list = archivedApps(session); if (!list.includes(key)) list.push(key);
    localStorage.setItem(`paywork_archived_apps_${identity(session)}`, JSON.stringify(list)); showToast("Ariza arxivga ko‘chirildi."); window.showAccountSection("applications");
  };
  window.restoreApplication = keyEncoded => {
    const session = getSession(), key = decodeURIComponent(keyEncoded); localStorage.setItem(`paywork_archived_apps_${identity(session)}`, JSON.stringify(archivedApps(session).filter(item => item !== key))); showToast("Ariza arxivdan qaytarildi."); window.showAccountSection("archive");
  };
  window.archiveJob = keyEncoded => {
    const session = getSession(), key = decodeURIComponent(keyEncoded), list = archivedJobs(session); if (!list.includes(key)) list.push(key);
    localStorage.setItem(`paywork_archived_jobs_${identity(session)}`, JSON.stringify(list)); showToast("E’lon arxivlandi."); window.showAccountSection("listings");
  };
  window.restoreJob = keyEncoded => {
    const session = getSession(), key = decodeURIComponent(keyEncoded); localStorage.setItem(`paywork_archived_jobs_${identity(session)}`, JSON.stringify(archivedJobs(session).filter(item => item !== key))); showToast("E’lon qayta faollashtirildi."); window.showAccountSection("archive");
  };

  function payworkChatBase() { return (window.PAYWORK_CONFIG?.supabaseUrl || "").replace(/\/$/, ""); }
  async function payworkChatApi(path, options = {}) {
    const response = await window.authenticatedPayWorkFetch(`${payworkChatBase()}${path}`, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.hint || "Chat serveri bilan bog‘lanib bo‘lmadi.");
    return data;
  }
  async function loadPayworkChats() {
    const list = document.getElementById("payworkChatList"); if (!list) return;
    try {
      const rows = await payworkChatApi("/rest/v1/rpc/paywork_list_chat_threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const me = getSession()?.user?.id;
      list.innerHTML = rows.length ? rows.map(row => `<button type="button" class="${row.thread_type === "announcement" ? "paywork-channel-item" : ""}" data-thread-id="${esc(row.thread_id)}"><span class="chat-avatar">${row.thread_type === "announcement" ? "📣" : esc((row.other_full_name || "P").charAt(0).toUpperCase())}</span><span><b>${esc(row.thread_type === "announcement" ? "Pay Work yangiliklari" : row.other_full_name || `Foydalanuvchi · ${row.other_public_id}`)}</b><small>${row.thread_type === "announcement" ? "Faqat administrator yozadi · reaksiya qoldiring" : `ID: ${esc(row.other_public_id || "—")}`}</small><em>${esc(row.last_body || (row.thread_type === "announcement" ? "Rasmiy e’lonlar kanali" : "Suhbatni ochish"))}</em></span>${row.thread_type === "announcement" ? `<span class="paywork-pin" title="Yuqoriga mahkamlangan">📌</span>` : ""}</button>`).join("") : empty("Chatlar yo‘q.");
      list.querySelectorAll("[data-thread-id]").forEach(button => button.addEventListener("click", () => openPayworkThread(button.dataset.threadId)));
      const ownId = document.querySelector(".paywork-my-id");
      if (ownId && !getSession()?.user?.user_metadata?.public_id) {
        const profile = await payworkChatApi(`/rest/v1/profiles?select=public_id&id=eq.${encodeURIComponent(me)}&limit=1`);
        if (profile[0]?.public_id) ownId.textContent = `Mening ID: ${profile[0].public_id}`;
      }
      if (!activePayworkThread && rows[0]?.thread_type === "announcement") await openPayworkThread(rows[0].thread_id);
    } catch (error) { list.innerHTML = empty(error.message || "Chatlar yuklanmadi. Avval chat migratsiyasini qo‘llash kerak."); }
  }
  async function searchPayworkChatUser(event) {
    event.preventDefault(); const form = event.currentTarget, publicId = String(new FormData(form).get("public_id") || "").replace(/\D/g, "");
    try {
      const matches = await payworkChatApi("/rest/v1/rpc/paywork_find_user_by_public_id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_public_id: publicId }) });
      const target = matches?.[0]; if (!target) throw new Error("Bu ID bo‘yicha faol foydalanuvchi topilmadi.");
      const start = await payworkChatApi("/rest/v1/rpc/paywork_start_direct_chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_public_id: publicId }) });
      await loadPayworkChats(); await openPayworkThread(start);
    } catch (error) { showToast(error.message || "Foydalanuvchi topilmadi."); }
  }
  async function openPayworkThread(threadId) {
    const pane = document.getElementById("payworkChatThread"); if (!pane || !threadId) return;
    activePayworkThread = threadId;
    clearInterval(payworkChatRefreshTimer);
    const threadRows = await payworkChatApi(`/rest/v1/paywork_chat_threads?select=id,thread_type,title,participant_low,participant_high&id=eq.${encodeURIComponent(threadId)}&limit=1`);
    const thread = threadRows[0]; if (!thread) throw new Error("Chat topilmadi.");
    const session = getSession(), isAdmin = session?.user?.user_metadata?.role === "admin";
    const canPost = thread.thread_type === "direct" || isAdmin;
    pane.innerHTML = `<header class="paywork-chat-thread-head"><div><b>${esc(thread.thread_type === "announcement" ? "📣 Pay Work yangiliklari" : "Shaxsiy chat")}</b><small>${thread.thread_type === "announcement" ? "Kanal barcha foydalanuvchilar ro‘yxatida birinchi turadi" : "Xabarlar faqat suhbat ishtirokchilariga ko‘rinadi"}</small></div></header><div class="account-messages" id="payworkChatMessages"><div class="account-chat-placeholder">Xabarlar yuklanmoqda…</div></div>${canPost ? `<form class="account-chat-compose" id="payworkChatCompose"><input name="body" maxlength="5000" placeholder="Xabar yozing…"><label class="file-attach" title="Fayl biriktirish">＋<input type="file" name="attachment" accept="image/*,.pdf,.txt,.zip,.docx,.xlsx"></label><button class="btn btn-green">Yuborish</button></form><div id="payworkChatFilePreview"></div>` : `<div class="paywork-reaction-only">Bu kanalda faqat administrator xabar va fayl yuboradi. Siz emojilar bilan reaksiya bildirishingiz mumkin.</div>`}`;
    await loadPayworkThreadMessages(threadId);
    if (canPost) {
      const form = document.getElementById("payworkChatCompose"), fileInput = form.querySelector('[name="attachment"]');
      fileInput.addEventListener("change", () => previewFile(fileInput.files[0], "payworkChatFilePreview"));
      form.addEventListener("submit", sendPayworkChatMessage);
    }
    payworkChatRefreshTimer = setInterval(() => { if (activePayworkThread === threadId && document.getElementById("payworkChatMessages")) loadPayworkThreadMessages(threadId); }, 7000);
  }
  async function loadPayworkThreadMessages(threadId) {
    const box = document.getElementById("payworkChatMessages"); if (!box || activePayworkThread !== threadId) return;
    try {
      const messages = await payworkChatApi(`/rest/v1/paywork_chat_messages?select=id,sender_id,body,attachment_path,attachment_name,attachment_type,created_at&id=not.is.null&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.asc&limit=100`);
      if (!messages.length) { box.innerHTML = `<div class="account-chat-placeholder">${threadId ? "Hozircha xabar yo‘q." : ""}</div>`; return; }
      const ids = messages.map(message => message.id), reactions = await payworkChatApi(`/rest/v1/paywork_chat_reactions?select=message_id,user_id,emoji&message_id=in.(${ids.map(encodeURIComponent).join(",")})`);
      const me = getSession()?.user?.id, config = window.PAYWORK_CONFIG || {};
      const files = await Promise.all(messages.map(async message => {
        if (!message.attachment_path) return "";
        const signed = await payworkChatApi(`/storage/v1/object/sign/paywork-chat/${message.attachment_path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 1800 }) }).catch(() => null);
        if (!signed?.signedURL) return `<span class="account-file-link">📎 ${esc(message.attachment_name || "Fayl")}</span>`;
        const url = `${config.supabaseUrl.replace(/\/$/, "")}/storage/v1${signed.signedURL}`;
        return message.attachment_type?.startsWith("image/") ? `<a class="account-media" href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(message.attachment_name || "Rasm")}"><span>${esc(message.attachment_name || "Rasm")}</span></a>` : `<a class="account-file-link" href="${esc(url)}" target="_blank" rel="noopener">📎 ${esc(message.attachment_name || "Fayl")}</a>`;
      }));
      box.innerHTML = messages.map((message, index) => {
        const mine = message.sender_id === me, relevant = reactions.filter(reaction => reaction.message_id === message.id);
        const emojiButtons = payworkChatEmojis.map(emoji => { const users = relevant.filter(reaction => reaction.emoji === emoji); return `<button type="button" class="paywork-reaction ${users.some(item => item.user_id === me) ? "active" : ""}" data-message="${esc(message.id)}" data-emoji="${emoji}" title="${users.length} reaksiya">${emoji}<small>${users.length || ""}</small></button>`; }).join("");
        return `<article class="account-message ${mine ? "mine" : ""}"><div class="paywork-chat-bubble">${message.body ? `<div>${esc(message.body)}</div>` : ""}${files[index]}<time>${new Date(message.created_at).toLocaleString("uz-UZ")}</time></div><div class="paywork-reaction-row">${emojiButtons}</div></article>`;
      }).join("");
      box.querySelectorAll("[data-message][data-emoji]").forEach(button => button.addEventListener("click", togglePayworkReaction));
      box.scrollTop = box.scrollHeight;
    } catch (error) { box.innerHTML = empty(error.message || "Xabarlar yuklanmadi."); }
  }
  async function sendPayworkChatMessage(event) {
    event.preventDefault(); const form = event.currentTarget, body = String(new FormData(form).get("body") || "").trim(), file = form.querySelector('[name="attachment"]').files[0], threadId = activePayworkThread;
    if (!body && !file) return;
    if (file && file.size > 15 * 1024 * 1024) { showToast("Fayl hajmi 15 MB dan oshmasin."); return; }
    try {
      let attachment = {};
      if (file) {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120), path = `${threadId}/${crypto.randomUUID()}-${safeName}`;
        const uploaded = await window.authenticatedPayWorkFetch(`${payworkChatBase()}/storage/v1/object/paywork-chat/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
        const uploadResult = await uploaded.json().catch(() => null); if (!uploaded.ok) throw new Error(uploadResult?.message || "Fayl yuklanmadi.");
        attachment = { attachment_path: path, attachment_name: file.name.slice(0,255), attachment_type: file.type || "application/octet-stream" };
      }
      const result = await payworkChatApi("/rest/v1/paywork_chat_messages", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ thread_id: threadId, sender_id: getSession().user.id, body, ...attachment }) });
      const messageId = Array.isArray(result) ? result[0]?.id : result?.id;
      if (messageId) window.authenticatedPayWorkFetch(`${payworkChatBase()}/functions/v1/telegram-notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatMessageId: messageId }) }).catch(() => {});
      form.reset(); document.getElementById("payworkChatFilePreview").innerHTML = ""; await loadPayworkThreadMessages(threadId); await loadPayworkChats();
    } catch (error) { showToast(error.message || "Xabar yuborilmadi."); }
  }
  async function togglePayworkReaction(event) {
    const button = event.currentTarget, messageId = button.dataset.message, emoji = button.dataset.emoji, userId = getSession()?.user?.id;
    if (!payworkChatEmojis.includes(emoji)) return;
    try {
      const query = `/rest/v1/paywork_chat_reactions?message_id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(userId)}&emoji=eq.${encodeURIComponent(emoji)}`;
      const existing = await payworkChatApi(query);
      if (existing.length) await payworkChatApi(query, { method: "DELETE" });
      else await payworkChatApi("/rest/v1/paywork_chat_reactions", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ message_id: messageId, user_id: userId, emoji }) });
      await loadPayworkThreadMessages(activePayworkThread);
    } catch (error) { showToast(error.message || "Reaksiya saqlanmadi."); }
  }

  window.openAccountChat = () => {
    window.showAccountSection("chats");
    showToast("Suhbat uchun foydalanuvchining 8 xonali Pay Work ID raqamini qidiring.");
  };
  function previewFile(file, targetId) {
    const target = document.getElementById(targetId); if (!target) return; target.innerHTML = ""; if (!file) return;
    const url = URL.createObjectURL(file);
    target.innerHTML = file.type.startsWith("image/") ? `<div class="account-file-preview"><img src="${url}" alt="Biriktirilgan rasm"><span>${esc(file.name)}</span></div>` : `<div class="account-file-preview"><video src="${url}" controls></video><span>${esc(file.name)}</span></div>`;
  }
  async function saveContactMessage(event) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form), file = form.querySelector('[name="attachment"]').files[0];
    if (file && file.size > 15 * 1024 * 1024) { showToast("Fayl 15 MB dan kichik bo‘lishi kerak."); return; }
    let attachment = null; try { if (file) attachment = await saveMedia(file); } catch (_) { showToast("Faylni saqlab bo‘lmadi."); return; }
    const messages = JSON.parse(localStorage.getItem("paywork_support_messages") || "[]"); messages.push({ name: values.get("name"), contact: values.get("contact"), message: values.get("message"), attachment, created: new Date().toISOString() });
    localStorage.setItem("paywork_support_messages", JSON.stringify(messages)); form.reset(); document.getElementById("contactAttachmentPreview").innerHTML = ""; showToast("Demo xabar shu qurilmada saqlandi; jamoaga yetkazish server ulangach ishlaydi.");
  }
})();
