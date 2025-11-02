document.addEventListener('DOMContentLoaded', () => {
    const profilesContainer = document.querySelector('.profiles-grid') || document.querySelector('.profiles-wrap');

    function createProfileHTML(profile) {
        return `
            <div class="text-center">
                <form class="profile-form" data-profile-id="${profile.id}">
                    <button type="submit" class="profile-btn" aria-label="${profile.displayName}">
                        <img src="${profile.avatar}" alt="${profile.displayName}" class="avatar">
                    </button>
                </form>
                <div class="profile-caption">${profile.displayName}</div>
            </div>
        `;
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

    // Delegate clicks on the profile name/caption so clicking the name behaves like clicking the card/button
    profilesContainer.addEventListener('click', (e) => {
        const target = e.target;

        // handle anchor-based cards (name inside anchor will already navigate)
        if (target.classList && (target.classList.contains('profile-name') || target.classList.contains('profile-caption'))) {
            // Find nearest .text-center wrapper (server variant) or nearest .profile-card (anchor)
            const textCenter = target.closest('.text-center');
            if (textCenter) {
                const form = textCenter.querySelector('.profile-form');
                if (form) {
                    // emulate submit behavior
                    const profileId = form.dataset.profileId;
                    const name = textCenter.querySelector('.profile-caption')?.textContent || target.textContent;
                    try { localStorage.setItem('selectedProfileName', name); localStorage.setItem('selectedProfileId', profileId); } catch (e) {}
                    window.location.href = `/catalog?profileId=${profileId}`;
                    return;
                }
            }

            // If inside an anchor-based card, clicking the name will bubble and the anchor handles navigation.
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

