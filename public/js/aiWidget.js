document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("ai-widget-toggle");
    const container = document.getElementById("ai-widget-container");
    const closeBtn = document.getElementById("ai-close-btn");
    const resetBtn = document.getElementById("ai-reset-btn");
    const form = document.getElementById("ai-chat-form");
    const input = document.getElementById("ai-user-input");
    const messagesContainer = document.getElementById("ai-chat-messages");
    const typingIndicator = document.getElementById("ai-typing-indicator");
    const chips = document.querySelectorAll(".ai-chip");

    // Toggle widget view
    toggleBtn.addEventListener("click", () => {
        container.classList.toggle("ai-widget-hidden");
        if (!container.classList.contains("ai-widget-hidden")) {
            input.focus();
        }
    });

    closeBtn.addEventListener("click", () => {
        container.classList.add("ai-widget-hidden");
    });

    // Reset conversation memory
    resetBtn.addEventListener("click", async () => {
        try {
            const res = await fetch("/ai/reset", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                messagesContainer.innerHTML = `
                    <div class="ai-message ai-message-bot">
                        <div class="ai-message-content">
                            🔄 Conversation memory reset! How can I assist your travel search now?
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            console.error("Failed to reset AI memory:", err);
        }
    });

    // Chip click handler
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            const promptText = chip.getAttribute("data-prompt");
            if (promptText) {
                input.value = promptText;
                form.dispatchEvent(new Event("submit"));
            }
        });
    });

    // Form submit handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const userPrompt = input.value.trim();
        if (!userPrompt) return;

        // Append user message
        appendMessage("user", userPrompt);
        input.value = "";

        // Show typing indicator
        showTyping(true);

        try {
            const response = await fetch("/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: userPrompt })
            });

            const data = await response.json();
            showTyping(false);

            if (data.success) {
                appendMessage("bot", data.reply, data.hotels);
            } else {
                appendMessage("bot", data.reply || "Something went wrong. Please try again.");
            }
        } catch (err) {
            showTyping(false);
            console.error("AI Request Error:", err);
            appendMessage("bot", "⚠️ Network error or connection failed. Please try again.");
        }
    });

    function showTyping(show) {
        if (show) {
            typingIndicator.classList.remove("d-none");
        } else {
            typingIndicator.classList.add("d-none");
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Helper to render markdown text and hotel cards cleanly.
     */
    function appendMessage(sender, text, hotels = []) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `ai-message ai-message-${sender}`;

        const contentDiv = document.createElement("div");
        contentDiv.className = "ai-message-content";
        
        // Simple Markdown parsing for bold and bullet lists
        let formattedText = escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n- /g, '<br>• ')
            .replace(/\n/g, '<br>');

        contentDiv.innerHTML = formattedText;

        // Render Grounded Hotel Cards if provided
        if (hotels && hotels.length > 0) {
            const hotelsGrid = document.createElement("div");
            hotelsGrid.className = "ai-hotels-grid";

            hotels.forEach(h => {
                const card = document.createElement("a");
                card.href = `/listings/${h.id}`;
                card.target = "_blank";
                card.className = "ai-hotel-card";

                const fallbackImg = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200";
                const imgUrl = h.imageUrl || fallbackImg;

                card.innerHTML = `
                    <img src="${imgUrl}" class="ai-hotel-thumb" alt="${escapeHtml(h.title)}" onerror="this.src='${fallbackImg}'" />
                    <div class="ai-hotel-info">
                        <div class="ai-hotel-title">${escapeHtml(h.title)}</div>
                        <div class="ai-hotel-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(h.location)}, ${escapeHtml(h.country)}</div>
                        <div class="ai-hotel-price">&#8377;${Number(h.pricePerNight).toLocaleString('en-IN')} / night</div>
                    </div>
                `;
                hotelsGrid.appendChild(card);
            });

            contentDiv.appendChild(hotelsGrid);
        }

        msgDiv.appendChild(contentDiv);
        messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function escapeHtml(string) {
        return String(string).replace(/[&<>"']/g, function (s) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[s];
        });
    }
});
