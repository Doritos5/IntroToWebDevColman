const loginForm = document.querySelector('#login-form');
const loginBtn = document.querySelector(".btn.login-btn.btn-lg");

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
function handleFormSubmit(e){
    e.preventDefault(); // the "form" default behavior is to refresh the page. here we are saying to it - NOT!

    // DOMPurify - This is JAVA Package that removes malicious code from our textbox values
    // We need to put this in the html:   <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.2.9/purify.min.js"></script>
    const email = DOMPurify.sanitize(loginForm.querySelector('#email').value.trim());
    const password = DOMPurify.sanitize(loginForm.querySelector('#password').value.trim());

    const email_validator = isValidEmail(email);
    const pass_validator = validatePassword(password);
    if (!email_validator || !pass_validator){
        return;
    }

    localStorage.setItem(email, JSON.stringify({"username": email, "status": "success"}));
    window.location.href = "../navbar_page/mainDisplay.html";
}


loginBtn.addEventListener('click', handleFormSubmit);
