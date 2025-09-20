
const feed = document.getElementById('feed');
const searchIcon = document.querySelector('.bi-search');
const searchBoxInput = document.getElementById('searchInput');
const xhr = new XMLHttpRequest();


const initialCatalog = Array.isArray(window.__CATALOG__) ? window.__CATALOG__ : [];
let catalog = initialCatalog.map(item => ({ ...item }));

function cardHTML(item){
    const itemLikes = item.likes;
    const badges = item.genres.map(g => `<span class="badge text-bg-secondary me-1 mb-1">${g}</span>`).join('');
    item.likes = itemLikes;

    return `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        <div class="card h-100 bg-dark text-white">
          <img src="${item.poster}" class="card-img-top" alt="${item.title}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${item.title}</h5>
            <div class="small text-white-50 mb-2">${item.year}</div>
            <div class="mb-3">${badges}</div>
            <div class="mt-auto d-flex justify-content-between align-items-center">
            <!-- 'data-like' it's the right way to pass metadata to span, as 'value' like I did in 'button' won't work  -->
              <span class="small"><i class="bi bi-heart-fill text-danger me-1"></i>
              <span data-likes="${item.id}">${itemLikes}</span>
              </span>
              <button class="btn btn-sm btn-outline-light" value="${item.id}">Like</button>
            </div>
          </div>
        </div>
      </div>`;
}


function renderFeed(filterFunc = null){
    let feedCatalog = Array.isArray(catalog) ? [...catalog] : [];

    if (typeof filterFunc === 'function') {
        feedCatalog = feedCatalog.filter(filterFunc);
    }
    feedCatalog.sort((a, b) => a.title.localeCompare(b.title));
    console.log("done!")
    feed.innerHTML = feedCatalog.map(cardHTML).join('');
}


function popHeart(btn){
    // Create a heart
    const rect = btn.getBoundingClientRect();
    const heart = document.createElement('div');

    heart.className = 'heart-fly';
    heart.innerHTML = '<i class="bi bi-balloon-heart"></i>';

    // Position relative to button
    heart.style.left = rect.left + rect.width / 2 + 'px';
    heart.style.top = rect.top + window.scrollY + 'px';

    document.body.appendChild(heart);

    // Remove after animation
    heart.addEventListener('animationend', () => heart.remove());
}

function rainbow(btn){
    btn.classList.add('rainbow-once');
    btn.addEventListener('animationend', () => {
        btn.classList.remove('rainbow-once');
    }, { once: true });
}

// Scrolls up when the page finishes loading
window.addEventListener("load", () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
});

feed.addEventListener('click', (e) => {
    // "closest:" -> When I click on the "feed" area,
    // it looks for the first ancestor (including itself) that matches the selector.
    const btn = e.target.closest('.btn-outline-light');
    console.log("111111")
    // Nothing found
    if(!btn) return;
    console.log("222222")
    const itemId = Number(btn.getAttribute('value'));
    console.log(itemId)

    // const hardCodedCatalogItem = catalog.find(x => x.id === itemId);
    // console.log(hardCodedCatalogItem)

    // hardCodedCatalogItem.likes += 1;

    const likesSpan = document.querySelector(`[data-likes="${itemId}"]`);
    if(likesSpan) likesSpan.textContent = String(Number(likesSpan.textContent) + 1);

    // TODO: After I presses "like" - i need to block this button and add movie id to "liked" list inside
    //  user -> profile -> like list, and:
    //  1. add API call that increases the movie LIKE count
    //  2. for specific profile, display like button as clicked with animation or something for the button indicating it was clicked
    popHeart(btn);
    rainbow(btn);
});

searchIcon.addEventListener('click', () => {
        const input = document.getElementById('searchInput');
        input.classList.toggle('active');
        if (input.classList.contains('active')) {
            input.focus();
        }
    });

searchBoxInput.addEventListener("input", e => {
    const query = e.target.value.toLowerCase().trim();
    const url = `/catalog/search/${encodeURIComponent(query)}`;

    console.log(query);
    console.log(`catalog/${query}`)
    xhr.open("GET", url, true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            feed.innerHTML = xhr.responseText;
            console.log(xhr.responseText);
        } else {
            debugger
            console.log("Error!!!!")
        }
    };

    xhr.send();

    // renderFeed(item => item.title.toLowerCase().includes(query.trim().toLowerCase()));
});

document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const selectedProfileId = localStorage.getItem('selectedProfileId');

    if (!username || !selectedProfileId) {
        window.location.replace('/profiles');
        return;
    }

    const banner = document.createElement('div');
    banner.className = 'greeting-banner';
    banner.textContent = `Hello, ${username}`;
    const nav = document.querySelector('nav.catalog');
    if (nav) nav.insertAdjacentElement('afterend', banner); else document.body.prepend(banner);
});

const signOut = document.getElementById('signOutLink')
    || Array.from(document.querySelectorAll('.dropdown-menu a'))
        .find(a => a.textContent.trim().toLowerCase() === 'sign out');

if (signOut) {
    signOut.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
            await fetch('/logout', { method: 'POST' });
        } catch (error) {
            console.error("Failed to logout from server:", error);
        }

        try {
            localStorage.removeItem('selectedProfileId');
        } catch {}

        window.location.href = '/';
    });
}