(function () {
  const SIGNIN_URL = "https://api.tczhong.com/auth/signin";
  const STORAGE_KEY = "tc_auth_status_v1";
  const SESSION_DURATION_MS = 7*24 * 60 * 60 * 1000; // 7 days
  let overlayEl = null;

  const getStoredAuth = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        parsed &&
        parsed.authed === true &&
        typeof parsed.timestamp === "number" &&
        Date.now() - parsed.timestamp < SESSION_DURATION_MS
      ) {
        return { valid: true, data: parsed };
      }
    } catch (err) {
      console.warn("Auth state parse error", err);
    }
    return { valid: false };
  };

  const persistAuth = (payload) => {
    const record = {
      authed: true,
      timestamp: Date.now(),
      meta: payload || {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  };

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const ensureStyles = () => {
    if (document.getElementById("tc-auth-styles")) return;
    const style = document.createElement("style");
    style.id = "tc-auth-styles";
    style.textContent = `
      #tc-auth-overlay {
        position: fixed;
        inset: 0;
        background: radial-gradient(circle at 20% 20%, rgba(3, 102, 214, 0.1), transparent 40%),
                    radial-gradient(circle at 80% 0%, rgba(3, 102, 214, 0.18), transparent 35%),
                    #f5f7fbcc;
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      #tc-auth-card {
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
        padding: 28px 26px 22px;
        width: min(420px, 90vw);
        border: 1px solid #e5e8ef;
        font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
      }
      #tc-auth-card h2 {
        margin: 0 0 4px;
        color: #0f172a;
        font-size: 22px;
        font-weight: 700;
        text-align: center;
      }
      #tc-auth-card p {
        margin: 0 0 18px;
        color: #475569;
        font-size: 14px;
        text-align: center;
      }
      #tc-auth-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      #tc-auth-form label {
        font-size: 13px;
        color: #1f2937;
        font-weight: 600;
      }
      #tc-auth-password {
        padding: 11px 12px;
        border-radius: 10px;
        border: 1px solid #d5d9e4;
        font-size: 15px;
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      #tc-auth-password:focus {
        border-color: #0366d6;
        box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
      }
      #tc-auth-submit {
        margin-top: 4px;
        background: linear-gradient(120deg, #0366d6, #0d8eff);
        border: none;
        color: #fff;
        font-weight: 700;
        font-size: 15px;
        padding: 11px 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.2s ease, filter 0.2s ease;
      }
      #tc-auth-submit:hover {
        filter: brightness(1.04);
        box-shadow: 0 12px 24px rgba(3, 102, 214, 0.2);
      }
      #tc-auth-submit:active {
        transform: translateY(1px);
      }
      #tc-auth-submit[disabled] {
        cursor: not-allowed;
        opacity: 0.7;
        box-shadow: none;
      }
      #tc-auth-status {
        min-height: 18px;
        font-size: 13px;
        color: #dc2626;
        text-align: center;
      }
      #tc-auth-meta {
        margin-top: 6px;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      }
      @media (max-width: 480px) {
        #tc-auth-card {
          padding: 24px 18px 18px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const buildOverlay = () => {
    ensureStyles();
    overlayEl = document.createElement("div");
    overlayEl.id = "tc-auth-overlay";
    overlayEl.innerHTML = `
      <div id="tc-auth-card">
        <h2>Enter Password</h2>
        <p>Access to this site requires verification.</p>
        <form id="tc-auth-form">
          <label for="tc-auth-password">Password</label>
          <input id="tc-auth-password" type="password" autocomplete="current-password" required />
          <button id="tc-auth-submit" type="submit">Verify & Continue</button>
          <div id="tc-auth-status" aria-live="polite"></div>
        </form>
        <div id="tc-auth-meta">The password is verified via api.tczhong.com.</div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    const form = overlayEl.querySelector("#tc-auth-form");
    const passwordInput = overlayEl.querySelector("#tc-auth-password");
    const submitBtn = overlayEl.querySelector("#tc-auth-submit");
    const statusEl = overlayEl.querySelector("#tc-auth-status");

    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      statusEl.textContent = "";
      const password = passwordInput.value.trim();
      if (!password) {
        statusEl.textContent = "Please enter the password.";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying...";

      try {
        const res = await fetch(SIGNIN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/plain;q=0.9",
          },
          body: JSON.stringify({ password }),
        });
        const rawText = await res.text();
        let payload = null;
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch (err) {
          payload = null;
        }

        if (!res.ok) {
          const detail =
            (payload && (payload.message || payload.error)) ||
            rawText ||
            `Request failed with status ${res.status}`;
          throw new Error(detail);
        }

        persistAuth(payload || {});
        overlayEl.remove();
      } catch (err) {
        console.error("Auth error", err);
        statusEl.textContent =
          err?.message || "Unable to verify password. Please try again.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Verify & Continue";
        return;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = "Verified";
    });
  };

  const initAuth = () => {
    const authState = getStoredAuth();
    if (authState.valid) return;
    if (document.body) {
      buildOverlay();
    } else {
      document.addEventListener("DOMContentLoaded", buildOverlay);
    }
  };

  window.tcAuth = {
    logout: () => {
      clearAuth();
      if (!overlayEl) buildOverlay();
    },
    isAuthenticated: () => getStoredAuth().valid,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
