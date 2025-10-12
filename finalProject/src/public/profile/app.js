document.addEventListener('DOMContentLoaded', () => {
    const profilesContainer = document.querySelector('.profiles-wrap');

    function createProfileHTML(profile) {
        return `
            <div class="text-center">
                <form class="profile-form" data-profile-id="${profile.id}">
                    <button type="submit" class="profile-btn" aria-label="${profile.displayName}">
                        <img src="${profile.avatar}" alt="${profile.displayName}" class="avatar">
                    </button>
                    <label for="edit-${profile.id}" class="edit-toggle" aria-label="Edit name">
                        <svg viewBox="0 0 24 24" class="edit-icon"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04c.39-.39.39-1.02 0-1.41l-2.12-2.12a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.61-1.61z"/></svg>
                    </label>
                </form>
                <input type="checkbox" id="edit-${profile.id}" class="edit-check" style="display: none;">
                <input type="text" class="profile-name-input" value="${profile.displayName}" data-profile-id="${profile.id}">
                <div class="profile-caption">${profile.displayName}</div>
            </div>
        `;
    }

    function saveProfileName(profileId, displayName) {
        fetch(`/profiles/${profileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: displayName })
        })
            .then(res => {
                if (!res.ok) {
                    console.error('Failed to save profile name');
                }
                return res.json();
            })
            .then(data => {
                console.log('Server response:', data.message);
            });
    }

    profilesContainer.addEventListener('submit', (e) => {
        if (e.target.classList.contains('profile-form')) {
            e.preventDefault();

            const form = e.target;
            const profileId = form.dataset.profileId;

            const profileCaption = form.parentElement.querySelector('.profile-caption');
            localStorage.setItem('selectedProfileName', profileCaption.textContent);

            localStorage.setItem('selectedProfileId', profileId);

            window.location.href = `/catalog?profileId=${profileId}`;
        }
    });

    profilesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('edit-check')) {
            const checkbox = e.target;
            const profileContainer = checkbox.closest('.text-center');
            const textInput = profileContainer.querySelector('.profile-name-input');
            const profileId = textInput.dataset.profileId;

            if (!checkbox.checked) {
                const newDisplayName = textInput.value;

                saveProfileName(profileId, newDisplayName);

                const caption = profileContainer.querySelector('.profile-caption');
                if (caption) {
                    caption.textContent = newDisplayName;
                }
            }
        }
    });

    fetch('/profiles')
        .then(res => {
            if (!res.ok) {
                if (res.status === 401) window.location.href = '/';
                throw new Error('Could not fetch profiles');
            }
            return res.json();
        })
        .then(profiles => {
            profilesContainer.innerHTML = profiles.map(createProfileHTML).join('');
        })
        .catch(error => {
            console.error(error);
            profilesContainer.innerHTML = '<p style="color: white;">Could not load profiles. Please try logging in again.</p>';
        });
});

