document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tripPlannerForm");
    const loadingEl = document.getElementById("plannerLoading");
    const errorEl = document.getElementById("plannerError");
    const warningEl = document.getElementById("plannerWarning");
    const resultsEl = document.getElementById("plannerResults");
    const generateBtn = document.getElementById("generateBtn");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        hideAll();
        setLoading(true);

        const formData = new FormData(form);
        const interests = formData.getAll("interests");

        const payload = {
            destination: formData.get("destination").trim(),
            budget: Number(formData.get("budget")),
            days: Number(formData.get("days")),
            travelers: Number(formData.get("travelers")),
            travelType: formData.get("travelType"),
            interests,
        };

        try {
            const res = await fetch("/trip-planner/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                showError(data.message || "Failed to generate itinerary.");
                return;
            }

            if (data.warning) {
                showWarning(data.warning);
            }

            renderItinerary(data.itinerary);
            resultsEl.classList.add("active");
            resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
            showError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    });

    function hideAll() {
        errorEl.classList.remove("active");
        warningEl.classList.remove("active");
        resultsEl.classList.remove("active");
        errorEl.textContent = "";
        warningEl.textContent = "";
    }

    function setLoading(on) {
        loadingEl.classList.toggle("active", on);
        generateBtn.disabled = on;
        generateBtn.innerHTML = on
            ? '<span class="spinner-border spinner-border-sm me-2"></span>Generating...'
            : '<i class="fas fa-magic me-2"></i>Generate Itinerary';
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.add("active");
    }

    function showWarning(msg) {
        warningEl.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${msg}`;
        warningEl.classList.add("active");
    }

    function formatCurrency(amount) {
        return "₹" + Number(amount).toLocaleString("en-IN");
    }

    function renderItinerary(itinerary) {
        let html = "";

        if (itinerary.recommendedHotel) {
            const h = itinerary.recommendedHotel;
            html += `
                <div class="recommended-hotel">
                    <div>
                        <h3><i class="fas fa-star me-2"></i>Recommended: ${escapeHtml(h.title)}</h3>
                        <p>${escapeHtml(h.reason || "")}</p>
                    </div>
                    <a href="/listings/${escapeHtml(h.id)}" class="btn-view-hotel">
                        <i class="fas fa-hotel me-1"></i>View Hotel
                    </a>
                </div>`;
        }

        if (itinerary.dailyBudget) {
            const b = itinerary.dailyBudget;
            html += `
                <div class="budget-summary">
                    <div class="budget-item"><div class="label">Accommodation</div><div class="amount">${formatCurrency(b.accommodation)}</div></div>
                    <div class="budget-item"><div class="label">Food</div><div class="amount">${formatCurrency(b.food)}</div></div>
                    <div class="budget-item"><div class="label">Activities</div><div class="amount">${formatCurrency(b.activities)}</div></div>
                    <div class="budget-item"><div class="label">Transport</div><div class="amount">${formatCurrency(b.transport)}</div></div>
                    <div class="budget-item total"><div class="label">Daily Total</div><div class="amount">${formatCurrency(b.total)}</div></div>
                </div>`;
        }

        if (itinerary.days && itinerary.days.length) {
            html += '<div class="day-cards">';
            for (const day of itinerary.days) {
                html += renderDayCard(day);
            }
            html += "</div>";
        }

        if (itinerary.travelTips && itinerary.travelTips.length) {
            html += `
                <div class="travel-tips-section">
                    <h3><i class="fas fa-lightbulb"></i>Travel Tips</h3>
                    <ul>${itinerary.travelTips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
                </div>`;
        }

        resultsEl.innerHTML = html;
    }

    function renderDayCard(day) {
        let placesHtml = "";
        if (day.placesToVisit && day.placesToVisit.length) {
            placesHtml = day.placesToVisit.map((p) => `
                <div class="place-item">
                    <span class="place-time">${escapeHtml(p.time || "")}</span>
                    <div>
                        <span class="place-name">${escapeHtml(p.name)}</span>
                        ${p.duration ? `<span class="place-duration"> · ${escapeHtml(p.duration)}</span>` : ""}
                    </div>
                </div>`).join("");
        }

        let foodHtml = "";
        if (day.foodRecommendation) {
            const f = day.foodRecommendation;
            foodHtml = `<strong>${escapeHtml(f.name)}</strong>`;
            if (f.cuisine) foodHtml += ` · ${escapeHtml(f.cuisine)}`;
            if (f.estimatedCost) foodHtml += ` · ${formatCurrency(f.estimatedCost)}`;
        }

        let tipsHtml = "";
        if (day.tips && day.tips.length) {
            tipsHtml = `<div class="day-tips"><ul>${day.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>`;
        }

        return `
            <div class="day-card">
                <div class="day-card-header">
                    <h4>Day ${day.day} — ${escapeHtml(day.title || "")}</h4>
                    ${day.estimatedCost ? `<span class="day-cost">${formatCurrency(day.estimatedCost)}</span>` : ""}
                </div>
                <div class="day-card-body">
                    ${day.hotel ? `
                    <div class="day-section">
                        <div class="day-section-title"><i class="fas fa-hotel"></i>Hotel</div>
                        <div class="day-section-content">${escapeHtml(day.hotel.title)}</div>
                    </div>` : ""}
                    ${placesHtml ? `
                    <div class="day-section">
                        <div class="day-section-title"><i class="fas fa-map-marker-alt"></i>Places to Visit</div>
                        <div class="day-section-content">${placesHtml}</div>
                    </div>` : ""}
                    ${foodHtml ? `
                    <div class="day-section">
                        <div class="day-section-title"><i class="fas fa-utensils"></i>Food Recommendation</div>
                        <div class="day-section-content">${foodHtml}</div>
                    </div>` : ""}
                    ${tipsHtml}
                </div>
            </div>`;
    }

    function escapeHtml(str) {
        if (!str) return "";
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
});
