/* =========================
   1. CONFIG
========================= */
const API_BASE = "http://localhost:8000";

/* =========================
   2. FOOTER YEAR
========================= */
const yearElement = document.getElementById("year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

/* =========================
   3. MOBILE NAV
========================= */
const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");

if (menuBtn && navMenu) {
    menuBtn.addEventListener("click", function () {
        navMenu.classList.toggle("show");
        const icon = menuBtn.querySelector("i");
        if (icon) {
            icon.classList.toggle("fa-bars");
            icon.classList.toggle("fa-xmark");
        }
    });

    navMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            navMenu.classList.remove("show");
            const icon = menuBtn.querySelector("i");
            if (icon) {
                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");
            }
        });
    });
}

/* =========================
   4. DATE MIN
========================= */
const visitDate = document.getElementById("visitDate");
if (visitDate) {
    const today = new Date();
    const localToday = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];
    visitDate.min = localToday;
}

/* =========================
   5. APPOINTMENT FORM
========================= */
const appointmentForm = document.getElementById("appointmentForm");
const formStatus = document.getElementById("formStatus");
const submitBtn = appointmentForm
    ? appointmentForm.querySelector('button[type="submit"]')
    : null;

function setStatus(text, type) {
    if (!formStatus) return;
    formStatus.textContent = text;
    formStatus.style.color =
        type === "error" ? "#c0392b"
        : type === "success" ? "#079879"
        : "#056b5b";
}

if (appointmentForm && formStatus) {
    appointmentForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const patientName = document.getElementById("patientName").value.trim();
        const patientPhone = document.getElementById("patientPhone").value.trim();
        const service = document.getElementById("service").value;
        const selectedDate = document.getElementById("visitDate").value;
        const message = document.getElementById("message").value.trim();

        if (!patientName) return setStatus("Please enter your name.", "error");
        if (!/^[0-9]{10}$/.test(patientPhone))
            return setStatus("Please enter a valid 10-digit phone number.", "error");
        if (!service || !selectedDate)
            return setStatus("Please select a reason and preferred date.", "error");

        const payload = {
            patient_name: patientName,
            patient_phone: patientPhone,
            service: service,
            visit_date: selectedDate,
            message: message || null,
        };

        const originalText = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending <i class="fa-solid fa-spinner fa-spin"></i>';
        }
        setStatus("Sending your enquiry...", "info");

        try {
            const response = await fetch(`${API_BASE}/api/appointments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const detail = err.detail;
                throw new Error(
                    typeof detail === "string"
                        ? detail
                        : Array.isArray(detail) && detail[0]?.msg
                        ? detail[0].msg
                        : "Failed to submit appointment."
                );
            }

            await response.json();
            setStatus(
                "✅ Appointment request received! The clinic will contact you soon to confirm.",
                "success"
            );
            appointmentForm.reset();
        } catch (err) {
            console.error(err);
            setStatus(
                `❌ ${err.message || "Something went wrong. Please call the clinic."}`,
                "error"
            );
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });
}