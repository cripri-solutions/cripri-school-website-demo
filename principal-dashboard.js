// Secure Principal workspace. All data access remains subject to Supabase RLS.
(() => {
  "use strict";
  const config = window.CRIPRI_SUPABASE_CONFIG;
  const library = window.supabase;
  const statusNode = document.getElementById("principal-dashboard-status");
  const form = document.getElementById("school-content-form");
  if (!config || !library || typeof library.createClient !== "function") {
    statusNode.textContent = "The secure school workspace is not configured.";
    statusNode.className = "pd-message is-error";
    return;
  }

  const client = library.createClient(config.url, config.publishableKey);
  let school = null;
  let contentRow = null;

  function message(value, bad) {
    statusNode.textContent = value || "";
    statusNode.className = "pd-message" + (bad ? " is-error" : "");
  }
  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value == null ? "" : String(value);
  }
  function dateLabel(value) {
    if (!value) return "Not yet saved";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Saved" : "Updated " + date.toLocaleString();
  }
  function explainRpcError(error) {
    const detail = String(error && (error.message || error.details || error.code) || "");
    if (/activate_principal_school|schema cache|could not find the function|42883|PGRST202/i.test(detail)) {
      return "The Supabase onboarding migration has not been installed yet. Ask the platform owner to run supabase-onboarding-migration.sql in the Supabase SQL Editor.";
    }
    if (/no uniquely approved|approved application|principal|headteacher/i.test(detail)) {
      return "This email does not match one uniquely approved Principal / Headteacher application. Contact CRIPRI Technologies to check the application details.";
    }
    return "Your school access could not be verified. Please contact CRIPRI Technologies.";
  }
  async function loadSchoolContent() {
    const result = await client.from("school_content")
      .select("id, content, published, updated_at")
      .eq("school_id", school.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error("School access is active, but the content permissions need attention: " + result.error.message);
    }
    contentRow = result.data || null;
    const content = contentRow && contentRow.content && typeof contentRow.content === "object" ? contentRow.content : {};
    setValue("content-motto", content.motto || "");
    setValue("content-headline", content.headline || "");
    setValue("content-welcome", content.welcome_message || "");
    setValue("content-about", content.about || "");
    setValue("content-email", content.contact_email || "");
    setValue("content-phone", content.contact_phone || "");
    setValue("content-location", content.location || "");
    document.getElementById("content-published").checked = !!(contentRow && contentRow.published);
    document.getElementById("content-updated").textContent = dateLabel(contentRow && contentRow.updated_at);
  }
  async function start() {
    message("Checking your verified Principal access…");
    const current = await client.auth.getUser();
    const user = current.data && current.data.user;
    if (current.error || !user) {
      window.location.replace("principal-access.html");
      return;
    }
    document.getElementById("principal-email").textContent = user.email || "Signed-in Principal";
    document.getElementById("school-account-email").textContent = user.email || "—";

    const activation = await client.rpc("activate_principal_school");
    if (activation.error) {
      message(explainRpcError(activation.error), true);
      document.getElementById("school-heading").textContent = "School access is not ready";
      document.getElementById("school-status").textContent = "Access not verified";
      return;
    }
    const provisioned = Array.isArray(activation.data) ? activation.data[0] : activation.data;
    if (!provisioned || !provisioned.school_id) {
      message("The database did not return a school linked to this account. Contact CRIPRI Technologies.", true);
      return;
    }

    school = { id: provisioned.school_id };
    const schoolResult = await client.from("schools")
      .select("id, name, slug, motto, status")
      .eq("id", school.id)
      .single();
    if (schoolResult.error || !schoolResult.data) {
      message("Your membership was created, but school details could not be loaded under the current database permissions. Contact CRIPRI Technologies.", true);
      return;
    }
    school = schoolResult.data;
    document.getElementById("school-heading").textContent = "Welcome, Principal";
    document.getElementById("school-name").textContent = school.name;
    document.getElementById("school-slug").textContent = school.slug;
    const status = document.getElementById("school-status");
    status.textContent = school.status;
    status.classList.toggle("is-active", school.status === "active");

    try {
      await loadSchoolContent();
      message("Your school workspace is ready. Website content is saved separately for this school.");
    } catch (error) {
      console.error("School content load failed:", error);
      message(error.message, true);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!school) {
      message("Your school has not been verified yet. Content was not saved.", true);
      return;
    }
    const button = document.getElementById("save-content");
    button.disabled = true;
    message("Saving school website content…");
    const content = {
      motto: document.getElementById("content-motto").value.trim(),
      headline: document.getElementById("content-headline").value.trim(),
      welcome_message: document.getElementById("content-welcome").value.trim(),
      about: document.getElementById("content-about").value.trim(),
      contact_email: document.getElementById("content-email").value.trim(),
      contact_phone: document.getElementById("content-phone").value.trim(),
      location: document.getElementById("content-location").value.trim()
    };
    const values = {
      school_id: school.id,
      content,
      published: document.getElementById("content-published").checked,
      updated_at: new Date().toISOString()
    };
    try {
      let result;
      if (contentRow && contentRow.id) {
        result = await client.from("school_content").update({
          content: values.content,
          published: values.published,
          updated_at: values.updated_at
        }).eq("id", contentRow.id).eq("school_id", school.id).select("id, content, published, updated_at").maybeSingle();
      } else {
        result = await client.from("school_content").insert(values).select("id, content, published, updated_at").single();
      }
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No row was returned. The database may not allow this save under the current Row Level Security policies.");
      contentRow = result.data;
      document.getElementById("content-updated").textContent = dateLabel(contentRow.updated_at);
      message("School website content saved successfully.");
    } catch (error) {
      console.error("School content save failed:", error);
      message("Content was not saved. Check the school_content Row Level Security policies. " + (error.message || ""), true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("principal-signout").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.replace("principal-access.html");
  });

  start().catch((error) => {
    console.error("Principal workspace initialisation failed:", error);
    message("The school workspace could not be loaded. Please sign in again or contact CRIPRI Technologies.", true);
  });
})();