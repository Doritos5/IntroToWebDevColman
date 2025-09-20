document.addEventListener('DOMContentLoaded', () => {

    const profiles = [
        { id: 'paul', username: 'Paul', avatar: '../images/netflix_profile.jpg' },
        { id: 'alon', username: 'Alon', avatar: '../images/netflix_profile.jpg' },
        { id: 'ronni', username: 'Ronni', avatar: '../images/netflix_profile.jpg' },
        { id: 'anna', username: 'Anna', avatar: '../images/netflix_profile.jpg' },
        { id: 'noa', username: 'Noa', avatar: '../images/netflix_profile.jpg' }
    ];

    const profilesContainer = document.querySelector('.profiles-wrap');

    function createProfileHTML(profile) {
        return `
            <div class="text-center">
                <input type="checkbox" id="edit-${profile.id}" class="edit-check">
                <form id="form-${profile.id}" action="../catalog/mainDisplay.html" class="profile-form">
                    <button type="submit" class="profile-btn" aria-label="${profile.username}">
                        <img src="${profile.avatar}" alt="${profile.username}" class="avatar">
                    </button>
                    <label for="edit-${profile.id}" class="edit-toggle" aria-label="Edit name">
                        <svg viewBox="0 0 24 24" class="edit-icon"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04c.39-.39.39-1.02 0-1.41l-2.12-2.12a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.61-1.61z"/></svg>
                    </label>
                </form>
                <input type="text" name="username" form="form-${profile.id}" class="profile-name-input" value="${profile.username}" data-id="${profile.id}">
                <div class="profile-caption">${profile.username}</div>
            </div>
        `;
    }

    function renderProfiles() {
        profilesContainer.innerHTML = profiles.map(createProfileHTML).join('');
    }

    profilesContainer.addEventListener('input', (e) => {
        if (e.target.matches('.profile-name-input')) {
            const profileId = e.target.dataset.id;
            const newUsername = e.target.value;
            const profileToUpdate = profiles.find(p => p.id === profileId);
            if (profileToUpdate) {
                profileToUpdate.username = newUsername;
            }
        }
    });

    profilesContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const input = document.querySelector(`input[form="${form.id}"]`);
        if (input) {
            const profileIdToSave = input.dataset.id;
            localStorage.setItem('selectedProfileId', profileIdToSave);
            window.location.href = form.action;
        }
    });

    renderProfiles();
});



document.addEventListener('DOMContentLoaded', () => {
    const onProfilePage = !!document.querySelector('.profiles-wrap');
    if (onProfilePage) setupProfilesPage(); else setupMainDisplayPage();
});

function setupProfilesPage() {
    document.querySelectorAll('.profile-form').forEach((form) => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const externalInput = form.id ? document.querySelector(`input[name="username"][form="${form.id}"]`) : null;
            const internalInput = form.querySelector('input[name="username"]');
            const username = (externalInput?.value || internalInput?.value || '').trim();
            if (!username) return;
            try { localStorage.setItem('selectedProfile', username); } catch {}
            window.location.href = '../catalog/mainDisplay.html';
        });
    });
}

function setupMainDisplayPage() {
    let username = null;
    try { username = localStorage.getItem('selectedProfile'); } catch {}
    if (!username) { window.location.replace('../profile/profilePage.html'); return; }
    const banner = document.createElement('div');
    banner.className = 'greeting-banner';
    banner.textContent = `Hello "${username}"`;
    const nav = document.querySelector('nav.catalog');
    if (nav) nav.insertAdjacentElement('afterend', banner); else document.body.prepend(banner);
    const avatarImg = document.querySelector('.user-avatar');
    if (avatarImg) { avatarImg.alt = username; avatarImg.title = username; }
    const signOut = document.getElementById('signOutLink') || Array.from(document.querySelectorAll('.dropdown-menu a, a')).find(a => a.textContent.trim().toLowerCase() === 'sign out');
    if (signOut) {
        signOut.addEventListener('click', (e) => {
            e.preventDefault();
            try { localStorage.removeItem('selectedProfile'); } catch {}
            window.location.href = '../login/loginPage.html';
        });
    }

}
