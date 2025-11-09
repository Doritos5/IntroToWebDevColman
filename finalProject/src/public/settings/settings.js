document.addEventListener('DOMContentLoaded', () => {
    const addForm = document.getElementById('add-profile-form');
    const profileNameInput = document.getElementById('profileName');
    let messageContainer = document.getElementById('message-container');
    const profileList = document.getElementById('profiles-list');

    const penIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V12h2.293z"/></svg>`;

    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'message-container';
        messageContainer.setAttribute('aria-live', 'polite');
    }
    profileNameInput.insertAdjacentElement('afterend', messageContainer);

    function showMessage(message, isError = false) {
        messageContainer.textContent = message;
        messageContainer.className = isError ? 'alert alert-danger mt-2' : 'alert alert-success mt-2';
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
                    body: JSON.stringify({ profileName }),
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
            if (event.target.closest('.btn-delete-profile')) {
                const button = event.target.closest('.btn-delete-profile');
                const profileId = button.dataset.profileId;
                const profileName = button.closest('li').querySelector('span').textContent;
                const isConfirmed = confirm(`Are you sure you want to delete "${profileName}"?`);
                if (!isConfirmed) return;

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

            const editButton = event.target.closest('.btn-edit-profile');
            if (editButton) {
                const profileItem = editButton.closest('.profile-item');
                const profileId = profileItem.dataset.profileId;
                const profileNameSpan = profileItem.querySelector('.profile-name');
                const profileEditInput = profileItem.querySelector('.profile-edit-input');

                const isEditing = profileItem.classList.contains('is-editing');

                if (isEditing) {
                    const newName = profileEditInput.value.trim();
                    const oldName = profileNameSpan.textContent;

                    if (newName && newName !== oldName) {
                        try {
                            const response = await fetch(`/profiles/${profileId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ displayName: newName }),
                                credentials: 'include'
                            });

                            if (!response.ok) throw new Error('Failed to save');
                            profileNameSpan.textContent = newName;
                            showMessage('Profile updated!', false);
                        } catch (error) {
                            console.error('Error updating profile:', error);
                            showMessage('Failed to update profile.', true);
                            profileEditInput.value = oldName;
                        }
                    } else {
                        profileEditInput.value = oldName;
                    }

                    profileNameSpan.style.display = 'inline';
                    profileEditInput.style.display = 'none';
                    editButton.innerHTML = penIconSVG;
                    editButton.classList.replace('btn-danger', 'btn-secondary');
                    profileItem.classList.remove('is-editing');

                } else {
                    profileNameSpan.style.display = 'none';
                    profileEditInput.style.display = 'inline-block';
                    profileEditInput.focus();
                    editButton.innerHTML = 'Save';
                    editButton.classList.replace('btn-secondary', 'btn-danger');
                    profileItem.classList.add('is-editing');
                }
            }
        });
    }
});