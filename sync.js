(() => {
  const config = window.PAYWORK_CONFIG || {};
  const base = (config.supabaseUrl || "").replace(/\/$/, "");
  const key = config.publishableKey || "";
  const ready = Boolean(base && key);
  if (!ready) return;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  const toDb = job => ({
    title: job.title, company: job.company, city: job.city,
    job_type: job.type, salary: Number(job.salary), salary_unit: job.unit || "kuniga",
    icon: job.icon || "P", color: job.color || "#e9f2ea",
    description: job.description || "", is_new: Boolean(job.fresh), employer_id: job.ownerId || null
  });
  const fromDb = row => ({
    title: row.title, company: row.company, city: row.city, type: row.job_type,
    salary: row.salary, unit: row.salary_unit, icon: row.icon, color: row.color,
    description: row.description, fresh: row.is_new, ownerId: row.employer_id
  });
  async function db(path, options = {}) {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Database request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  }
  async function refreshJobs(seedIfEmpty = false) {
    try {
      let rows = await db("jobs?select=*&order=created_at.desc");
      if (rows.length) {
        jobs = rows.map(fromDb);
        localStorage.setItem("paywork_jobs", JSON.stringify(jobs));
        renderJobs();
      }
    } catch (error) {
      console.warn("Pay Work shared data is unavailable.", error);
    }
  }

  refreshJobs(true);
  window.setInterval(() => {
    if (document.visibilityState === "visible") refreshJobs(false);
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshJobs(false);
  });

  document.getElementById("jobForm").addEventListener("submit", async () => {
    const job = jobs[0];
    if (!job) return;
    try {
      if (!job.ownerId || !window.authenticatedPayWorkFetch) throw new Error("Employer session is required.");
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/jobs`, { method: "POST", headers: { Prefer: "return=minimal", "Content-Type": "application/json" }, body: JSON.stringify(toDb(job)) });
      if (!response.ok) throw new Error("Job listing could not be shared.");
      await refreshJobs(false);
    } catch (error) {
      showToast("E’lon bu qurilmada saqlandi, lekin umumiy bazaga ulanilmadi.");
    }
  });

  document.getElementById("applyForm").addEventListener("submit", async event => {
    const form = new FormData(event.currentTarget);
    const application = {
      job_title: form.get("job"), applicant_name: form.get("name"),
      phone: form.get("phone"), message: form.get("message") || "",
      applicant_id: JSON.parse(localStorage.getItem("paywork_auth") || "null")?.user?.id || null,
      employer_id: form.get("employerUserId") || JSON.parse(localStorage.getItem("paywork_jobs") || "[]").find(job => (job.jobKey || `${job.title}::${job.company}`) === form.get("jobKey"))?.ownerId || null
    };
    try {
      if (!application.applicant_id || !window.authenticatedPayWorkFetch) throw new Error("Candidate session is required.");
      const response = await window.authenticatedPayWorkFetch(`${base}/rest/v1/applications`, { method: "POST", headers: { Prefer: "return=representation", "Content-Type": "application/json" }, body: JSON.stringify(application) });
      if (!response.ok) throw new Error("Application could not be shared.");
      const [created] = await response.json().catch(() => []);
      if (created?.id && application.employer_id) {
        try {
          await window.authenticatedPayWorkFetch(`${base}/functions/v1/telegram-notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: created.id }) });
        } catch (_) {}
      }
    } catch (error) {
      showToast("Ariza bu qurilmada saqlandi, lekin umumiy bazaga yuborilmadi.");
    }
  }, true);
})();
