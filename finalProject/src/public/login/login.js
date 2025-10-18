// ------------------------- Variables -------------------------
const loginForm = document.querySelector('#login-form');
const loginBtn = document.querySelector(".btn.login-btn.btn-lg");
const passwordError = document.getElementById("passwordError");
const emailError = document.getElementById("emailError");
const serverError = document.getElementById("registerServerError");
const successMessage = document.getElementById('registerSuccess');

// ------------------------- Functions -------------------------

// Validation functions
function isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/;
    return pattern.test(email);
}

function isValidPassword(password) {
    return password.length >= 6;
}

function toggleMessage(element, message) {
    if (!message) {
        element.classList.add('d-none');
        element.textContent = '';
    } else {
        element.classList.remove('d-none');
        element.textContent = message;
    }
}

// Handler function
async function handleFormSubmit(e){
    e.preventDefault(); // keep page from reloading
    toggleMessage(serverError, '');
    toggleMessage(successMessage, '');

    const email = DOMPurify.sanitize(loginForm.querySelector('#email').value.trim());
    const password = DOMPurify.sanitize(loginForm.querySelector('#password').value.trim());

    let valid = true;
    if (!isValidEmail(email)) {
        toggleMessage(emailError, 'Email must be at least 3 characters and contain only english letters/numbers.');
        valid = false;
    } else {
        toggleMessage(emailError, '');
    }

    if (!isValidPassword(password)) {
        toggleMessage(passwordError, 'Password must be at least 6 characters.');
        valid = false;
    } else {
        toggleMessage(passwordError, '');
    }

    if (!valid) {
        return;
    }


    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            toggleMessage(serverError, data.message || "Login failed");
            return;
        }

        localStorage.setItem('username', data.user.username);

        toggleMessage(successMessage, 'Login successful! Redirecting to profiles page...');

        setTimeout(() => {
            window.location.href = "/profiles_page";
        }, 3000);

    } catch (err) {
        toggleMessage(serverError, err.message);
        console.error("Network error:", err);
    }

}

// ------------------------- Listeners -------------------------
window.addEventListener("DOMContentLoaded", () => {
    // Check if localStorage has a value for "aaa"
    const username = localStorage.getItem("username");

    // If there is username, redirect to profile page
    if (username) {
        // Redirect to login page
        // window.location.href = "/profiles_page";
    }
});

// add submit so Enter key works too
loginForm.addEventListener('submit', handleFormSubmit);
loginBtn.addEventListener('click', handleFormSubmit);