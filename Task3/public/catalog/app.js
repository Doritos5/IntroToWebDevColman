document.addEventListener('DOMContentLoaded', () => {
    const feed = document.getElementById('feed');
    const greetingBanner = document.querySelector('.greeting-banner');
    let catalog = [];

    function popHeart(btn) {
        const rect = btn.getBoundingClientRect();
        const heart = document.createElement('div');
        heart.className = 'heart-fly';
        heart.innerHTML = '<i class="bi bi-balloon-heart-fill"></i>';
        heart.style.left = `${rect.left + rect.width / 2}px`;
        heart.style.top = `${rect.top + window.scrollY}px`;
        document.body.appendChild(heart);
        heart.addEventListener('animationend', () => heart.remove());
    }

    function rainbow(btn) {
        btn.classList.add('rainbow-once');
        btn.addEventListener('animationend', () => {
            btn.classList.remove('rainbow-once');
        }, { once: true });
    }

    async function initializeCatalog() {
        const selectedProfileId = localStorage.getItem('selectedProfileId');
        const profileName = localStorage.getItem('selectedProfileName');

        if (!selectedProfileId || !profileName) {
            window.location.replace('/profiles');
            return;
        }

        if (greetingBanner) {
            greetingBanner.textContent = `Hello, ${profileName}`;
        }

        try {
            const response = await fetch(`/catalog/data?profileId=${selectedProfileId}`);
            if (!response.ok) throw new Error('Failed to fetch catalog data');
            const data = await response.json();
            catalog = data.catalog;
            const likedIds = new Set(data.likedContent || []);
            renderFeed(likedIds);
        } catch (error) {
            console.error(error);
            feed.innerHTML = '<p class="text-white">Could not load the catalog. Please try again later.</p>';
        }
    }

    function renderFeed(likedIds = new Set()) {
        if (!catalog || catalog.length === 0) {
            feed.innerHTML = '<p class="text-white">No items to display.</p>';
            return;
        }
        feed.innerHTML = catalog.map(item => cardHTML(item, likedIds)).join('');
    }

    function cardHTML(item, likedIds) {
        const isLiked = likedIds.has(item.id);
        const buttonText = isLiked ? 'Liked' : 'Like';
        const buttonClass = isLiked ? 'btn-danger' : 'btn-outline-light'; // Use btn-danger for 'unlike'
        const badges = item.genres.map(g => `<span class="badge text-bg-secondary me-1 mb-1">${g}</span>`).join('');

        return `
          <div class="col-6 col-md-4 col-lg-3 mb-4">
            <div class="card h-100 bg-dark text-white">
              <img src="${item.poster}" class="card-img-top" alt="${item.title}">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title mb-1">${item.title}</h5>
                <div class="small text-white-50 mb-2">${item.year}</div>
                <div class="mb-3">${badges}</div>
                <div class="mt-auto d-flex justify-content-between align-items-center">
                  <span class="small">
                    <i class="bi bi-heart-fill text-danger me-1"></i>
                    <span data-likes-id="${item.id}">${item.likes}</span>
                  </span>
                  <button class="btn btn-sm ${buttonClass}" data-item-id="${item.id}">${buttonText}</button>
                </div>
              </div>
            </div>
          </div>`;
    }

    feed.addEventListener('click', async (e) => {
        // Target any button with a data-item-id attribute
        if (e.target.matches('[data-item-id]')) {
            const button = e.target;
            const itemId = button.dataset.itemId;
            const profileId = localStorage.getItem('selectedProfileId');

            if (!profileId) {
                alert('Profile not selected!');
                return;
            }

            const isUnlike = button.classList.contains('btn-danger');
            const endpoint = isUnlike ? '/api/unlike' : '/api/like';

            button.disabled = true;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId: Number(itemId), profileId: profileId })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to process request');

                const likesSpan = document.querySelector(`[data-likes-id="${itemId}"]`);
                if (likesSpan) {
                    likesSpan.textContent = result.newLikesCount;
                }

                if (isUnlike) {
                    button.textContent = 'Like';
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-outline-light');
                } else {
                    button.textContent = 'Liked';
                    button.classList.remove('btn-outline-light');
                    button.classList.add('btn-danger');
                    popHeart(button);
                    rainbow(button);
                }

                button.disabled = false;

            } catch (error) {
                console.error('Like/Unlike error:', error);
                button.disabled = false;
                alert(error.message);
            }
        }
    });

    const signOut = document.getElementById('signOutLink') || Array.from(document.querySelectorAll('.dropdown-menu a')).find(a => a.textContent.trim().toLowerCase() === 'sign out');
    if (signOut) {
        signOut.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                localStorage.removeItem('selectedProfileId');
                localStorage.removeItem('selectedProfileName');
            } catch {}
            window.location.replace('/');
        });
    }

    initializeCatalog();
});

