/* CRIPRI Universal School Website
   CUSTOMISE this object for each school's public website.
   Only enter approved public information. Never add passwords,
   private keys, student records or confidential data here. */
const SCHOOL_SETTINGS = {
  name: "Your School",
  initial: "S",
  logoUrl: "", // Optional public image URL for this school
  primaryColor: "#123b5d",
  accentColor: "#f2b84b",
  heroImageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=2000&q=85", // Replace with school-approved hero photo URL
  motto: "Learning • Growth • Opportunity",
  headline: "A place to learn, grow and shape the future.",
  tagline: "Welcome to a school community where every learner matters.",
  welcomeTitle: "Education with purpose and possibility",
  welcomeMessage: "We believe education is more than lessons and examinations. It is about helping learners build knowledge, confidence, character and the skills to contribute positively to their communities.",
  aboutTitle: "More than a school. A community.",
  aboutMessage: "We are committed to creating a welcoming environment where learners are encouraged to ask questions, discover their strengths and prepare for a changing world.",
  mission: "To nurture knowledgeable, confident and responsible learners through quality education and a supportive school community.",
  email: "info@example.com",
  phone: "+000 000 000 000",
  location: "School location"
};

document.addEventListener("DOMContentLoaded", () => {
  const textSettings = {
    "[data-school-name]": SCHOOL_SETTINGS.name,
    "[data-school-motto]": SCHOOL_SETTINGS.motto,
    "[data-school-headline]": SCHOOL_SETTINGS.headline,
    "[data-school-tagline]": SCHOOL_SETTINGS.tagline,
    "[data-welcome-title]": SCHOOL_SETTINGS.welcomeTitle,
    "[data-welcome-message]": SCHOOL_SETTINGS.welcomeMessage,
    "[data-about-title]": SCHOOL_SETTINGS.aboutTitle,
    "[data-about-message]": SCHOOL_SETTINGS.aboutMessage,
    "[data-school-mission]": SCHOOL_SETTINGS.mission,
    "[data-school-email]": SCHOOL_SETTINGS.email,
    "[data-school-phone]": SCHOOL_SETTINGS.phone,
    "[data-school-location]": SCHOOL_SETTINGS.location
  };

  Object.entries(textSettings).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  });

  document.documentElement.style.setProperty("--navy", SCHOOL_SETTINGS.primaryColor || "#123b5d");
  document.documentElement.style.setProperty("--gold", SCHOOL_SETTINGS.accentColor || "#f2b84b");

  const logo = document.querySelector("[data-school-logo]");
  const initial = document.querySelector("[data-school-initial]");
  if (logo && SCHOOL_SETTINGS.logoUrl) {
    logo.src = SCHOOL_SETTINGS.logoUrl;
    logo.hidden = false;
    if (initial) initial.hidden = true;
  }
  const hero = document.querySelector(".hero");
  if (hero && SCHOOL_SETTINGS.heroImageUrl) {
    hero.style.backgroundImage = 'linear-gradient(115deg, rgba(10,39,63,.88), rgba(18,59,93,.68)), url("' + SCHOOL_SETTINGS.heroImageUrl + '")';
    hero.style.backgroundPosition = "center";
    hero.style.backgroundSize = "cover";
  }
  if (initial) initial.textContent = (SCHOOL_SETTINGS.initial || SCHOOL_SETTINGS.name.charAt(0) || "S").charAt(0).toUpperCase();

  document.querySelectorAll("[data-school-email-link]").forEach((element) => {
    element.href = "mailto:" + SCHOOL_SETTINGS.email;
  });
  document.querySelectorAll("[data-school-phone-link]").forEach((element) => {
    element.href = "tel:" + SCHOOL_SETTINGS.phone.replace(/[^+\d]/g, "");
  });

  document.title = SCHOOL_SETTINGS.name + " | Welcome";
  const year = document.getElementById("current-year");
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#site-nav");
  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }
});