const loginForm = document.querySelector('#login-form');
const loginBtn = document.querySelector(".btn.login-btn.btn-lg");
const serverError = document.getElementById("serverError");

// FUNCTIONS

// Validation functions
function validatePassword(password) {
    const passwordError = document.getElementById("passwordError");
    const success = password.length >= 6;
    const _ = success ? passwordError.classList.add("d-none") : passwordError.classList.remove("d-none");
    return success;
}

function isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/;
    const usernameError = document.getElementById("usernameError");
    const success = pattern.test(email);
    const _ = success ? usernameError.classList.add("d-none") : usernameError.classList.remove("d-none");
    return success;
}

// Handler function
async function handleFormSubmit(e){
    e.preventDefault(); // keep page from reloading

    const email = DOMPurify.sanitize(loginForm.querySelector('#email').value.trim());
    const password = DOMPurify.sanitize(loginForm.querySelector('#password').value.trim());

    const email_validator = isValidEmail(email);
    const pass_validator  = validatePassword(password);
    if (!email_validator || !pass_validator){
        return;
    }

    // send to Express /login
    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        debugger
        // handle server response
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            serverError.textContent = err.message || "Login failed";
            serverError.classList.remove("d-none");
            return;
        }
        serverError.classList.add("d-none");
        localStorage.setItem(email, JSON.stringify({"username": email, "status": "success"}));
        window.location.href = data.redirect;


    } catch (err) {
        console.error("Network error:", err);
    }

}

// add submit so Enter key works too
loginForm.addEventListener('submit', handleFormSubmit);
loginBtn.addEventListener('click', handleFormSubmit);