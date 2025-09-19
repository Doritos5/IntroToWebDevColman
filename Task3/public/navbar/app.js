
const feed = document.getElementById('feed');
const searchIcon = document.querySelector('.bi-search');
    const searchBoxInput = document.getElementById('searchInput');

let catalog = [
    { id: 1,  title: 'The Silent Code', year: 2024, genres: ['Thriller','Sci‑Fi'], likes: 128, poster: 'https://picsum.photos/seed/silentcode/600/338' },
    { id: 2,  title: 'Sunset Alley',   year: 2022, genres: ['Drama'],        likes: 92,  poster: 'https://picsum.photos/seed/sunset/600/338' },
    { id: 3,  title: 'Quantum Heist',  year: 2023, genres: ['Action','Sci‑Fi'], likes: 301, poster: 'https://picsum.photos/seed/quantum/600/338' },
    { id: 4,  title: 'Cedar Falls',    year: 2021, genres: ['Mystery'],      likes: 77,  poster: 'https://picsum.photos/seed/cedar/600/338' },
    { id: 5,  title: 'Pixel Hearts',   year: 2020, genres: ['Romance','Comedy'], likes: 211, poster: 'https://picsum.photos/seed/pixel/600/338' },
    { id: 6,  title: 'Desert Line',    year: 2019, genres: ['Adventure'],    likes: 64,  poster: 'https://picsum.photos/seed/desert/600/338' },
    { id: 7,  title: 'Nordic Lights',  year: 2024, genres: ['Documentary'],  likes: 18,  poster: 'https://picsum.photos/seed/nordic/600/338' },
    { id: 8,  title: 'Crimson Tide',   year: 2018, genres: ['Action'],       likes: 154, poster: 'https://picsum.photos/seed/crimson/600/338' },
    { id: 9,  title: 'Byte Me',        year: 2023, genres: ['Comedy'],       likes: 87,  poster: 'https://picsum.photos/seed/byte/600/338' },
    { id: 10, title: 'Echoes',         year: 2022, genres: ['Drama','Mystery'], likes: 190, poster: 'https://picsum.photos/seed/echoes/600/338' },
];


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

function getFeedPageData(parse = false){
    const data = localStorage.getItem('feedPage.list');
    if (parse) return JSON.parse(data);

    return data;
}

function renderFeed(filterFunc = null){
    const cachedFeedItems = getFeedPageData(true);

    let feedCatalog = filterFunc
        ? cachedFeedItems.filter(filterFunc)
        : cachedFeedItems;

    feedCatalog = feedCatalog.slice().sort((a, b) =>
        a.title.localeCompare(b.title)
    );

    feed.innerHTML = feedCatalog.map(cardHTML).join('');
}

function saveItemsToLocalStorage(){
    localStorage.setItem('feedPage.list', JSON.stringify(catalog));
}

function feedToLocalStorage(){
    const tempLocalStorage = getFeedPageData();
    if(tempLocalStorage === null || tempLocalStorage === []) {
        saveItemsToLocalStorage();
        return;
    }
    catalog = getFeedPageData(true);
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
// ------------------------- Listeners -------------------------
document.addEventListener('DOMContentLoaded', () => {
    feedToLocalStorage();
    renderFeed();

});

// Scrolls up when the page finishes loading
window.addEventListener("load", () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
});

feed.addEventListener('click', (e) => {
    // "closest:" -> When I click on the "feed" area,
    // it looks for the first ancestor (including itself) that matches the selector.
    const btn = e.target.closest('.btn-outline-light');

    // Nothing found
    if(!btn) return;

    const itemId = Number(btn.getAttribute('value'));

    const hardCodedCatalogItem = catalog.find(x => x.id === itemId);
    hardCodedCatalogItem.likes += 1;
    saveItemsToLocalStorage();

    const likesSpan = document.querySelector(`[data-likes="${itemId}"]`);
    if(likesSpan) likesSpan.textContent = hardCodedCatalogItem.likes;

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
    const query = e.target.value.toLowerCase();
    renderFeed(item => item.title.toLowerCase().includes(query.trim().toLowerCase()));
});

document.addEventListener('DOMContentLoaded',()=>{
    let u=null; try{u=localStorage.getItem('selectedProfile')}catch{}
    if(!u){location.replace('../profile/profilePage.html');return;}
    const b=document.createElement('div');
    b.className='greeting-banner';
    b.textContent=`Hello "${u}"`;
    const nav=document.querySelector('nav.navbar');
    if(nav) nav.insertAdjacentElement('afterend',b); else document.body.prepend(b);
});

const signOut = document.getElementById('signOutLink')
    || Array.from(document.querySelectorAll('.dropdown-menu a'))
        .find(a => a.textContent.trim().toLowerCase() === 'sign out');

if (signOut) {
    signOut.addEventListener('click', (e) => {
        e.preventDefault();
        try { localStorage.removeItem('selectedProfile'); } catch {}
        window.location.href = '../profile/profilePage.html';
    });
}
