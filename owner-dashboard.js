// CRIPRI private owner dashboard. Browser uses publishable key only.
(() => {
  const config = window.CRIPRI_SUPABASE_CONFIG;
  const library = window.supabase;
  if (!config || !library || !library.createClient) return;
  const client = library.createClient(config.url, config.publishableKey);
  const OWNER_EMAIL = "hillaryrotich786@gmail.com";
  const loginForm = document.getElementById("owner-login-form");
  const dashboardList = document.getElementById("owner-application-list");
  const authStatus = document.getElementById("owner-auth-status");
  const dashboardStatus = document.getElementById("owner-dashboard-status");
  let applications = [];

  function statusMessage(node, message, kind) {
    if (!node) return;
    node.textContent = message;
    node.className = "owner-status" + (kind ? " " + kind : "");
  }
  function make(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function dateLabel(value) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
  }
  async function checkOwner(user) {
    if (!user || (user.email || "").toLowerCase() !== OWNER_EMAIL) return false;
    const { data, error } = await client.from("platform_reviewers")
      .select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
    return !error && !!data;
  }
  async function requireOwner() {
    const { data: { user } } = await client.auth.getUser();
    if (!(await checkOwner(user))) {
      await client.auth.signOut();
      window.location.replace("owner-login.html");
      return null;
    }
    const identity = document.getElementById("owner-identity");
    if (identity) identity.textContent = user.email;
    return user;
  }
  async function signIn(event) {
    event.preventDefault();
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const password = loginForm.elements.password.value;
    const button = document.getElementById("owner-login-button");
    if (email !== OWNER_EMAIL) {
      statusMessage(authStatus, "This sign-in is reserved for the authorised CRIPRI owner account.", "error");
      return;
    }
    button.disabled = true;
    statusMessage(authStatus, "Signing in securely…");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      statusMessage(authStatus, "Sign-in failed. Check your email and password, then try again.", "error");
      button.disabled = false;
      return;
    }
    if (!(await checkOwner(data.user))) {
      await client.auth.signOut();
      statusMessage(authStatus, "This account is not authorised for the owner dashboard.", "error");
      button.disabled = false;
      return;
    }
    window.location.replace("owner-dashboard.html");
  }
  async function sendReset() {
    const email = loginForm.elements.email.value.trim().toLowerCase();
    if (email !== OWNER_EMAIL) {
      statusMessage(authStatus, "Use the authorised CRIPRI owner email address.", "error");
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, "owner-login.html")
    });
    statusMessage(authStatus, error ? "Could not send the reset email. Please try again." : "If the account is eligible, Supabase has sent a password reset email.", error ? "error" : "success");
  }
  function updateCounts() {
    const count = status => applications.filter(item => item.status === status).length;
    document.getElementById("count-total").textContent = applications.length;
    document.getElementById("count-pending").textContent = count("pending");
    document.getElementById("count-approved").textContent = count("approved");
    document.getElementById("count-rejected").textContent = count("rejected");
  }
  function renderApplications() {
    if (!dashboardList) return;
    dashboardList.replaceChildren();
    const filter = document.getElementById("owner-filter").value;
    const visible = applications.filter(item => filter === "all" || item.status === filter);
    if (!visible.length) {
      dashboardList.append(make("p", "owner-empty", "No applications match this view."));
      return;
    }
    visible.forEach(item => {
      const card = make("article", "owner-application");
      const heading = make("div", "owner-app-heading");
      const nameBlock = make("div");
      nameBlock.append(make("h3", "", item.school_name), make("p", "owner-app-meta", "Submitted " + dateLabel(item.created_at)));
      heading.append(nameBlock, make("span", "owner-pill " + item.status, item.status));
      card.append(heading);
      const details = make("div", "owner-app-details");
      [
        ["Category", item.school_category], ["Country", item.country], ["Region", item.region],
        ["Address", item.physical_address], ["Contact person", item.contact_person],
        ["Role", item.contact_role], ["Email", item.contact_email], ["Telephone", item.contact_phone],
        ["Requested website name", item.requested_slug], ["Additional information", item.message]
      ].forEach(([label, value]) => {
        if (value) {
          const cell = make("div", "owner-detail");
          cell.append(make("strong", "", label), make("span", "", value));
          details.append(cell);
        }
      });
      card.append(details);
      if (item.status === "pending") {
        const controls = make("div", "owner-review-controls");
        const reason = document.createElement("input");
        reason.type = "text";
        reason.maxLength = 1000;
        reason.placeholder = "Optional review note (required if rejecting)";
        reason.setAttribute("aria-label", "Review note for " + item.school_name);
        const approve = make("button", "owner-primary", "Approve");
        const reject = make("button", "owner-danger", "Reject");
        approve.addEventListener("click", () => decide(item, "approved", reason.value, approve, reject));
        reject.addEventListener("click", () => {
          if (!reason.value.trim() && !window.confirm("Reject this application without adding a reason?")) return;
          decide(item, "rejected", reason.value, approve, reject);
        });
        controls.append(reason, approve, reject);
        card.append(controls);
      } else {
        card.append(make("p", "owner-review-meta", "Reviewed " + dateLabel(item.reviewed_at) + (item.review_reason ? " · " + item.review_reason : "")));
      }
      dashboardList.append(card);
    });
  }
  async function decide(item, decision, reason, approve, reject) {
    approve.disabled = true; reject.disabled = true;
    statusMessage(dashboardStatus, "Saving the decision and audit record…");
    const { error } = await client.rpc("review_school_application", {
      p_application_id: item.id, p_decision: decision, p_reason: reason.trim() || null
    });
    if (error) {
      statusMessage(dashboardStatus, "The decision was not saved. " + error.message, "error");
      approve.disabled = false; reject.disabled = false;
      return;
    }
    statusMessage(dashboardStatus, "Application " + decision + " and review history saved.", "success");
    await loadDashboard();
  }
  async function loadDashboard() {
    statusMessage(dashboardStatus, "Loading applications…");
    const { data, error } = await client.from("school_applications").select("*").order("created_at", { ascending: false });
    if (error) {
      statusMessage(dashboardStatus, "Could not load applications. Please refresh or sign in again.", "error");
      return;
    }
    applications = data || [];
    updateCounts();
    renderApplications();
    statusMessage(dashboardStatus, applications.length + " application(s) loaded securely.", "success");
    await loadAudit();
  }
  async function loadAudit() {
    const target = document.getElementById("owner-audit-list");
    if (!target) return;
    const { data, error } = await client.from("application_review_audit")
      .select("decision, reason, created_at, application_id, school_applications(school_name)")
      .order("created_at", { ascending: false }).limit(10);
    target.replaceChildren();
    if (error) {
      target.textContent = "Review history could not be loaded.";
      return;
    }
    if (!data || !data.length) {
      target.textContent = "No decisions have been recorded yet.";
      return;
    }
    data.forEach(entry => {
      const line = make("div", "owner-audit-item");
      const school = entry.school_applications && entry.school_applications.school_name ? entry.school_applications.school_name : "School application";
      line.append(make("strong", "", school + " — " + entry.decision),
        make("span", "", dateLabel(entry.created_at)),
        make("p", "", entry.reason || "No note recorded"));
      target.append(line);
    });
  }
  if (loginForm) {
    loginForm.addEventListener("submit", signIn);
    document.getElementById("owner-reset-button").addEventListener("click", sendReset);
  }
  if (dashboardList) {
    document.getElementById("owner-refresh").addEventListener("click", loadDashboard);
    document.getElementById("owner-filter").addEventListener("change", renderApplications);
    document.getElementById("owner-signout").addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.replace("owner-login.html");
    });
    requireOwner().then(user => { if (user) loadDashboard(); });
  }
})();