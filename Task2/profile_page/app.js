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
            window.location.href = '../navbar_page/mainDisplay.html';
        });
    });
}

function setupMainDisplayPage() {
    let username = null;
    try { username = localStorage.getItem('selectedProfile'); } catch {}
    if (!username) { window.location.replace('../profile_page/profilePage.html'); return; }
    const banner = document.createElement('div');
    banner.className = 'greeting-banner';
    banner.textContent = `Hello "${username}"`;
    const nav = document.querySelector('nav.navbar');
    if (nav) nav.insertAdjacentElement('afterend', banner); else document.body.prepend(banner);
    const avatarImg = document.querySelector('.user-avatar');
    if (avatarImg) { avatarImg.alt = username; avatarImg.title = username; }
    const signOut = document.getElementById('signOutLink') || Array.from(document.querySelectorAll('.dropdown-menu a, a')).find(a => a.textContent.trim().toLowerCase() === 'sign out');
    if (signOut) {
        signOut.addEventListener('click', (e) => {
            e.preventDefault();
            try { localStorage.removeItem('selectedProfile'); } catch {}
            window.location.href = '../profile_page/profilePage.html';
        });
    }




    document.addEventListener('DOMContentLoaded',()=>{
        document.querySelectorAll('.profile-form').forEach((form)=>{
            form.addEventListener('submit',()=>{
                const ext=form.id?document.querySelector(`input[name="username"][form="${form.id}"]`):null;
                const inner=form.querySelector('input[name="username"]');
                const name=(ext?.value||inner?.value||'').trim();
                try{localStorage.setItem('selectedProfile',name);}catch{}
            });
        });
    });

}
