
const registerForm = document.getElementById('register-form');
const emailInput = document.getElementById('register-email');
const usernameInput = document.getElementById('register-username');
const passwordInput = document.getElementById('register-password');
const emailError = document.getElementById('registerEmailError');
const usernameError = document.getElementById('registerUsernameError');
const passwordError = document.getElementById('registerPasswordError');
const serverError = document.getElementById('registerServerError');
const successMessage = document.getElementById('registerSuccess');

function toggleMessage(element, message) {
    if (!message) {
        element.classList.add('d-none');
        element.textContent = '';
    } else {
        element.classList.remove('d-none');
        element.textContent = message;
    }
}

function isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/;
    return pattern.test(email);
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_ ]{3,}$/.test(username);
}

function isValidPassword(password) {
    return password.length >= 6;
}

async function registerUser(email, username, password) {
    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });

    const payload = await response.json();
    debugger
    if (!response.ok) {
        throw new Error(payload.message || 'Unable to register.');
    }
    return payload;
}

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    toggleMessage(serverError, '');
    toggleMessage(successMessage, '');

    const email = DOMPurify.sanitize(emailInput.value.trim());
    const username = DOMPurify.sanitize(usernameInput.value.trim());
    const password = DOMPurify.sanitize(passwordInput.value.trim());

    let valid = true;
    if (!isValidEmail(email)) {
        toggleMessage(emailError, 'Email must be at least 3 characters and contain only english letters/numbers.');
        valid = false;
    } else {
        toggleMessage(emailError, '');
    }

    if (!isValidUsername(username)) {
        toggleMessage(usernameError, 'Username must be at least 3 characters and contain only letters and numbers');
        valid = false;
    } else {
        toggleMessage(usernameError, '');
    }

    if (!isValidPassword(password)) {
        toggleMessage(passwordError, 'Password must be at least 6 characters.');
        valid = false;
    } else {
        toggleMessage(passwordError, '');
    }

    if (!valid) {
        console.log("not valud")
        return;
    }
    console.log("valid")
    try {
        await registerUser(email, username, password);
        toggleMessage(successMessage, 'Registration successful! Redirecting to login...');
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    } catch (error) {
        console.error('Registration failed:', error);
        toggleMessage(serverError, error.message);
    }
});