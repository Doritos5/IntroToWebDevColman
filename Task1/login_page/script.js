
// This is the "Login" button
const loginForm = document.querySelector('#login-form');
const loginBtn = document.querySelector(".btn.login-btn.btn-lg");

// FUNCTIONS

// Validation functions
function validatePassword(password) {
    const passwordError = document.getElementById("passwordError");
    const success = password.length >= 3;

    console.log("password: " + success);
    const _ = success ? passwordError.classList.add("d-none") : passwordError.classList.remove("d-none");
    return success;
}

function isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/;
    const usernameError = document.getElementById("usernameError");
    const success = pattern.test(email);

    console.log("username: " + success);
    const _ = success ? usernameError.classList.add("d-none") : usernameError.classList.remove("d-none");
    return success;
}

// Handler function
function handleFormSubmit(e){
    e.preventDefault(); // the "form" default behavior is to refresh the page. here we are saying to it - NOT!
    console.log("dammm");



    // DOMPurify - This is JAVA Package that removes malicious code from our textbox values
    // We need to put this in the html:   <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.2.9/purify.min.js"></script>
    const email = DOMPurify.sanitize(loginForm.querySelector('#email').value.trim());
    const password = DOMPurify.sanitize(loginForm.querySelector('#password').value.trim());

    const email_validator = isValidEmail(email);
    const pass_validator = validatePassword(password);
    if (!email_validator || !pass_validator){
        return;
    }


    console.log("dammm222");

    // if (!validatePassword(password)) {
    //     const usernameError = document.getElementById("usernameError");
    //     usernameError.textContent = "Username must be at least 3 characters and contain only letters/numbers.";
    //     usernameError.classList.remove("d-none"); // show error
    //     return false;
    // }
    // else{
    //     usernameError.classList.add("d-none"); // hide error
    //     return true;
    // }
    //


    // const newRecipe = {
    //     name: name,
    //     method: method,
    //     roast: roast,
    //     grind: grind,
    //     ratio: ratio,
    //     note: note,
    //     id: Date.now(),
    // }
    // console.log(newRecipe);
    // listItems.push(newRecipe);
    // e.target.reset(); // Reset form values
    // recipeContainer.dispatchEvent(new CustomEvent('refreshRecipes'));
}


loginBtn.addEventListener('click', handleFormSubmit);
