(() => {
  const action = new URLSearchParams(window.location.search).get("pw");
  if (!action) return;

  const launch = () => {
    if (action === "jobs") {
      window.scrollToJobs?.();
      document.getElementById("ishlar")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (action === "signup") {
      window.openAuth?.("signup");
      return;
    }
    if (action === "employer") {
      window.openAuth?.("signup");
      window.chooseAuthRole?.("employer");
      return;
    }
    if (action === "help") {
      document.getElementById("haqida")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", launch, { once: true });
  else launch();
})();
