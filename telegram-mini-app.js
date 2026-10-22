(() => {
  const webApp = window.Telegram && window.Telegram.WebApp;
  const state = { isMiniApp: Boolean(webApp), initData: "" };
  window.PayWorkTelegram = state;
  if (!webApp) return;

  document.documentElement.classList.add("telegram-mini-app");
  document.body.classList.add("telegram-mini-app");
  webApp.ready();
  try { webApp.expand(); } catch (_) {}
  try { webApp.setHeaderColor("#f7f8f4"); } catch (_) {}
  try { webApp.setBackgroundColor("#f7f8f4"); } catch (_) {}

  const syncTheme = () => {
    const params = webApp.themeParams || {};
    const vars = {
      "--telegram-bg": params.bg_color,
      "--telegram-text": params.text_color,
      "--telegram-hint": params.hint_color,
      "--telegram-link": params.link_color,
      "--telegram-button": params.button_color,
      "--telegram-button-text": params.button_text_color,
      "--telegram-secondary-bg": params.secondary_bg_color
    };
    for (const [name, value] of Object.entries(vars)) {
      if (value) document.documentElement.style.setProperty(name, value);
    }
  };
  syncTheme();
  webApp.onEvent("themeChanged", syncTheme);

  // Keep signed Telegram launch data in memory only. The backend must validate it
  // before using Telegram identity for sign-in or account linking.
  state.initData = webApp.initData || "";
  state.platform = webApp.platform || "unknown";

  const hasBackTarget = () => Boolean(
    document.querySelector(".modal.show") ||
    document.querySelector("#allJobsScreen.show")
  );
  const closeBackTarget = () => {
    const modal = document.querySelector(".modal.show");
    if (modal && typeof window.closeModal === "function") {
      window.closeModal(modal.id);
      return;
    }
    const allJobs = document.getElementById("allJobsScreen");
    if (allJobs && allJobs.classList.contains("show") && typeof window.closeAllJobs === "function") {
      window.closeAllJobs();
    }
  };
  const syncBackButton = () => {
    if (!webApp.BackButton) return;
    if (hasBackTarget()) webApp.BackButton.show();
    else webApp.BackButton.hide();
  };
  if (webApp.BackButton) {
    webApp.BackButton.onClick(closeBackTarget);
    new MutationObserver(syncBackButton).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
    syncBackButton();
  }
})();
