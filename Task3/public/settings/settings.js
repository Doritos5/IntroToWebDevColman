document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings page script loaded.');

    const form = document.getElementById('add-profile-form');
    const profileNameInput = document.getElementById('profileName');
    const messageContainer = document.getElementById('message-container');

    if (!form) {
        console.error('Error: Could not find the form with id "add-profile-form"');
        return;
    }

    function showMessage(message, isError = false) {
        messageContainer.textContent = message;
        messageContainer.className = isError ? 'alert alert-danger mt-3' : 'alert alert-success mt-3';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submission intercepted!');

        const profileName = profileNameInput.value.trim();
        console.log(`Profile name entered: "${profileName}"`);

        if (!profileName) {
            showMessage('Profile name cannot be empty.', true);
            return;
        }

        console.log('Sending POST request to /api/profiles...');
        try {
            const response = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileName: profileName }),
            });

            console.log('Received response from server:', response);
            const data = await response.json();

            if (!response.ok) {
                showMessage(data.message || 'An unknown error occurred.', true);
            } else {
                showMessage(data.message);
                form.reset();
            }
        } catch (error) {
            console.error('Submission fetch error:', error);
            showMessage('Could not connect to the server.', true);
        }
    });
});

