// Public school application form submission.
// Uses only the Supabase publishable key. Never add a secret/service_role key here.
(() => {
  const form = document.getElementById("school-registration-form");
  if (!form) return;

  const status = document.getElementById("form-status");
  const submitButton = document.getElementById("submit-registration");

  function showStatus(message, kind) {
    status.textContent = message;
    status.className = "form-status" + (kind ? " " + kind : "");
  }

  function makeSlug(value) {
    return value.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("", "");

    if (form.elements.website.value.trim()) {
      showStatus("Your application could not be submitted. Please try again.", "error");
      return;
    }
    if (!form.reportValidity()) return;

    const config = window.CRIPRI_SUPABASE_CONFIG;
    const supabaseLibrary = window.supabase;
    if (!config || !config.url || !config.publishableKey ||
        !supabaseLibrary || typeof supabaseLibrary.createClient !== "function") {
      showStatus("The application service is not available yet. Please contact CRIPRI Technologies.", "error");
      return;
    }

    const schoolName = form.elements.school_name.value.trim();
    const requestedSlug = makeSlug(schoolName);
    if (!requestedSlug) {
      showStatus("Please enter a valid school name.", "error");
      return;
    }

    const application = {
      school_name: schoolName,
      school_category: form.elements.school_category.value,
      country: form.elements.country.value.trim(),
      county: form.elements.region.value.trim(),
      physical_address: form.elements.physical_address.value.trim(),
      contact_person: form.elements.contact_person.value.trim(),
      contact_role: form.elements.contact_role.value,
      contact_email: form.elements.contact_email.value.trim().toLowerCase(),
      phone: form.elements.contact_phone.value.trim(),
      requested_slug: requestedSlug,
      message: form.elements.message.value.trim() || null
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    try {
      const client = supabaseLibrary.createClient(config.url, config.publishableKey);
      const { error } = await client.from("school_applications").insert([application]);
      if (error) throw error;
      form.reset();
      showStatus("Application received. CRIPRI will review the details before any school website is activated. Please keep your contact details available.", "success");
    } catch (error) {
      console.error("CRIPRI school application submission failed:", error);
      showStatus("We could not submit the application. Please check your connection and try again. If the problem continues, contact CRIPRI Technologies.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit school application";
    }
  });
})();
