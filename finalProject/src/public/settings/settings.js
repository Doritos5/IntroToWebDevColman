document.addEventListener('DOMContentLoaded', () => {
    const addForm = document.getElementById('add-profile-form');
    const profileNameInput = document.getElementById('profileName');
    const messageContainer = document.getElementById('message-container');
    const profileList = document.getElementById('profiles-list'); // רשימת הפרופילים למחיקה

    function showMessage(message, isError = false) {
        messageContainer.textContent = message;
        messageContainer.className = isError ? 'alert alert-danger mt-3' : 'alert alert-success mt-3';
    }

    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const profileName = profileNameInput.value.trim();
            if (!profileName) {
                showMessage('Profile name cannot be empty.', true);
                return;
            }
            try {
                const response = await fetch('/profiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ profileName: profileName }),
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok) {
                    showMessage(data.message || 'An unknown error occurred.', true);
                } else {
                    location.reload();
                }
            } catch (error) {
                console.error('Submission fetch error:', error);
                showMessage('Could not connect to the server.', true);
            }
        });
    }

    if (profileList) {
        profileList.addEventListener('click', async (event) => {
            if (event.target.classList.contains('btn-delete-profile')) {
                const button = event.target;
                const profileId = button.dataset.profileId;
                const profileName = button.closest('li').querySelector('span').textContent;
                const isConfirmed = confirm(`האם אתה בטוח שברצונך למחוק את "${profileName}"?`);
                if (!isConfirmed) {
                    return;
                }
                try {
                    const response = await fetch(`/profiles/${profileId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    if (response.ok) {
                        location.reload();
                    } else {
                        const data = await response.json();
                        showMessage(data.message || 'Could not delete profile.', true);
                    }
                } catch (error) {
                    console.error('Delete fetch error:', error);
                    showMessage('Could not connect to the server.', true);
                }
            }
        });
    }
});