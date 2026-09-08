/**
 * Contact form handler for SICSAFT Demo requests
 */
import { saveLead } from "./leadStore";

export function initContactForm(): void {
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  if (!form) return;

  const submitBtn = document.getElementById("form-submit-btn") as HTMLButtonElement | null;
  const feedback = document.getElementById("form-feedback") as HTMLElement | null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!submitBtn || !feedback) return;

    const formData = new FormData(form);
    const name = (formData.get("name") as string) || "";
    const email = (formData.get("email") as string) || "";
    const organization = (formData.get("organization") as string) || "";
    const phone = (formData.get("phone") as string) || "";
    const sector = (formData.get("sector") as string) || "General";
    const level = (formData.get("level") as string) || "Nivel 2";
    const message = (formData.get("message") as string) || "";

    // Save lead to local store and trigger Google Sheets sync
    saveLead({
      name,
      email,
      organization,
      phone,
      sector,
      level,
      message,
    });

    // Simulate submission state
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Enviando solicitud...</span>
    `;

    setTimeout(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      feedback.classList.remove("hidden");
      feedback.classList.add("flex");
      form.reset();

      // Auto-hide feedback after 7 seconds
      setTimeout(() => {
        feedback.classList.add("hidden");
        feedback.classList.remove("flex");
      }, 7000);
    }, 600);
  });
}
