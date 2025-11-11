// ------------------------- State -------------------------
const searchInput = document.getElementById('searchInput');
const searchIcon = document.querySelector('.bi-search');
const feed = document.getElementById('feed');
const sentinel = document.getElementById('feedSentinel');
const greetingBanner = document.querySelector('.greeting-banner');
const modalElement = document.getElementById('videoModal');
const videoPlayer = document.getElementById('catalogVideoPlayer');
const modalTitle = document.getElementById('videoModalLabel');
const modalDescription = document.getElementById('videoModalDescription');
const videoShell = document.getElementById('videoShell');
const overlayPlayButton = document.getElementById('overlayPlayButton');
const playPauseButton = document.getElementById('playPauseButton');
const rewindButton = document.getElementById('rewindButton');
const forwardButton = document.getElementById('forwardButton');
const videoSeekBar = document.getElementById('videoSeekBar');
const currentTimeLabel = document.getElementById('currentTimeLabel');
const durationTimeLabel = document.getElementById('durationTimeLabel');
const fullscreenButton = document.getElementById('fullscreenButton');
const nextEpisodeButton = document.getElementById('nextEpisodeButton');
const episodeDrawerElement = document.getElementById('episodeDrawer');
const episodeDrawerLabel = document.getElementById('episodeDrawerLabel');
const episodeListElement = document.getElementById('episodeList');
const episodeListButton = document.getElementById('episodeListButton');
const initialLoadSize = feed?.dataset.initialSize;
const standardLoadSize = feed?.dataset.pageSize;
const MINIMUM_LOADER_DURATION_MS = 2000;
const feedLoader = document.getElementById('feedLoader');
const watchedToggle = document.getElementById('watchedOnlyToggle');
const watchedToggleContainer = document.getElementById('watchedToggleContainer');

if (feedLoader) {
    feedLoader.classList.remove('is-visible');
    feedLoader.setAttribute('aria-hidden', 'true');
}

let nextOffset = 0;
let totalItems = Infinity;
let isFirstBatch = true;
let isLoading = false;
let currentRequestId = 0;
let activeSearchTerm = '';
let activeSortBy = 'home';
let likedIds = new Set();
let observer;
let modalInstance;
let currentVideoId = null;
let videoCache = new Map();
let episodesMap = new Map();
let progressInterval = null;
let resumePosition = 0;
let isSeeking = false;
let searchDebounceTimer = null;
let episodesLoaded = false;
let episodeDrawerInstance = null;
let episodeOrder = [];
let currentSeriesId = null;
let loadedSeriesId = null;
let seriesEpisodesCache = new Map();
let watchedOnly = false; // applies only to genre categories
let watchedFilterCache = {
    profileId: null,
    genre: null,
    movieIds: new Set(),
    seriesIds: new Set(),
    videoIds: new Set(),
    loaded: false,
};

function normalizeId(val) {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        // Handle Buffer-like shape from JSON
        if (val.type === 'Buffer' && Array.isArray(val.data)) {
            try { return Array.from(val.data).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (_) { /* ignore */ }
        }
        if (typeof val.toString === 'function') {
            const s = val.toString();
            if (s && s !== '[object Object]') return s;
        }
    }
    return null;
}

async function loadWatchedSetsForGenre(profileId, genre) {
    try {
        if (
            watchedFilterCache.loaded &&
            watchedFilterCache.profileId === profileId &&
            watchedFilterCache.genre === genre
        ) {
            return watchedFilterCache;
        }
        const url = `/catalog/debug/viewing-sessions?profileId=${encodeURIComponent(profileId)}&genre=${encodeURIComponent(genre)}&_=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load watched sets');
        const data = await res.json();
        watchedFilterCache = {
            profileId,
            genre,
            movieIds: new Set(Array.isArray(data.watchedMovieIds) ? data.watchedMovieIds : []),
            seriesIds: new Set(Array.isArray(data.watchedSeriesIds) ? data.watchedSeriesIds : []),
            videoIds: new Set(Array.isArray(data.watchedVideoIds) ? data.watchedVideoIds : []),
            loaded: true,
        };
        return watchedFilterCache;
    } catch (_) {
    watchedFilterCache = { profileId: null, genre: null, movieIds: new Set(), seriesIds: new Set(), videoIds: new Set(), loaded: false };
        return watchedFilterCache;
    }
}

function applyWatchedFilterIfNeeded(items, currentProfileId, currentSortBy) {
    if (!items || !Array.isArray(items)) return [];
    if (!(currentSortBy && currentSortBy.startsWith('genre:'))) return items;
    if (!watchedOnly) return items;
    const filtered = items.filter((item) => {
        const id = normalizeId(item.id);
        const seriesId = normalizeId(item.seriesId);
        if (watchedFilterCache.loaded) {
            if (watchedFilterCache.movieIds.has(id) || watchedFilterCache.videoIds.has(id)) return true;
            if (seriesId && watchedFilterCache.seriesIds.has(seriesId)) return true;
            return false;
        }
        return false;
    });
    return filtered;
}

// ------------------------- Helpers -------------------------

function ensureProfileSelected() {
    const selectedProfileId = localStorage.getItem('selectedProfileId');
    const profileName = localStorage.getItem('selectedProfileName');

    if (!selectedProfileId || !profileName) {
        window.location.href = '/profiles_page';
        return null;
    }

    if (greetingBanner) {
        greetingBanner.textContent = `Hi, ${profileName}`;
    }

    return { selectedProfileId, profileName };
}

function createCardHTML(item) {
    const isLiked = likedIds.has(item.id);
    const badges = (item.genres || [])
        .map((genre) => `<span class="badge text-bg-secondary me-1 mb-1">${genre}</span>`)
        .join('');

    const descriptionSnippet = item.description
        ? `<p class="card-text text-white-50 small mb-3">${item.description.slice(0, 90)}${item.description.length > 90 ? '…' : ''}</p>`
        : '';

    // Determine content type
    const isMovie = item.type === 'movie';
    const typeIcon = isMovie 
        ? '<i class="bi bi-film text-warning"></i>' 
        : '<i class="bi bi-collection-play text-warning"></i>';
    const typeTooltip = isMovie ? 'Movie' : 'Series';

    return `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        <div class="card h-100 bg-dark text-white position-relative" data-video-id="${item.id}">
          <div class="type-icon-badge" title="${typeTooltip}">
            ${typeIcon}
          </div>
          <img src="${item.poster}" class="card-img-top" alt="${item.title}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${item.title}</h5>
            <div class="small text-white-50 mb-2">${item.year ?? ''}</div>
            ${descriptionSnippet}
            <div class="mb-3">${badges}</div>
            <div class="mt-auto">
              <div class="d-flex justify-content-between align-items-center">
                <div class="like-container" data-item-id="${item.id}" data-like-button>
                  <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'} like-heart ${isLiked ? 'liked' : ''}" 
                     data-item-id="${item.id}"></i>
                  <span class="like-count ms-1" data-likes-id="${item.id}">${item.likes ?? 0}</span>
                </div>
                <span class="text-warning rating-display">
                  <i class="bi bi-star-fill me-1"></i>
                  ${item.rating ? item.rating.toFixed(1) : '0.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
}

// Make createCardHTML and caches available globally for use in EJS view
window.createCardHTML = createCardHTML;
window.videoCache = videoCache;
window.episodesMap = episodesMap;

function addInteractions() {
    // Add parallax effect to cards
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const deltaX = (e.clientX - centerX) / rect.width;
            const deltaY = (e.clientY - centerY) / rect.height;
            
            // Tilt effect
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
                const rotateY = deltaX * 5;
                const rotateX = -deltaY * 5;
                
                card.style.transform = `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateZ(10px)`;
            } else {
                card.style.transform = '';
            }
        });
    });

    // Reset transforms when mouse leaves the page
    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.like-container, .card').forEach(el => {
            el.style.transform = '';
            el.style.filter = '';
        });
    });
}

// Initialize interactions when page loads
setTimeout(addInteractions, 1000);

function appendVideos(videos) {
    const fragment = document.createDocumentFragment();
    videos.forEach((video) => {
        videoCache.set(video.id, video);
        episodesMap.set(video.id, video);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = createCardHTML(video);
        const card = wrapper.firstElementChild;
        if (watchedOnly && activeSortBy && activeSortBy.startsWith('genre:')) {
            const badge = document.createElement('div');
            badge.className = 'position-absolute top-0 end-0 m-2 px-2 py-1 bg-success text-black fw-semibold rounded-2';
            badge.style.fontSize = '0.7rem';
            badge.style.opacity = '0.85';
            badge.textContent = 'Watched';
            card.querySelector('.card')?.appendChild(badge);
        }
        fragment.appendChild(card);
    });
    feed.appendChild(fragment);
}

function setLoadingState(active) {
    if (!sentinel) return;

    // Don't show loading indicator during search
    if (activeSearchTerm && activeSearchTerm.trim()) {
        active = false;
    }

    sentinel.classList.toggle('active', active);

    if (feedLoader) {
        feedLoader.classList.toggle('is-visible', active);
        feedLoader.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
}

function loadingTime(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}


function resetFeed() {
    nextOffset = 0;
    totalItems = Infinity;
    isFirstBatch = true;
    feed.innerHTML = '';
    videoCache = new Map();
    setLoadingState(false);
    if (sentinel) {
        // Hide sentinel during search, show for normal pagination
        if (activeSearchTerm && activeSearchTerm.trim()) {
            sentinel.classList.add('hidden');
        } else {
            sentinel.classList.remove('hidden');
        }
    }
    if (observer && sentinel && (!activeSearchTerm || !activeSearchTerm.trim())) {
        observer.observe(sentinel);
    }
}

function updateLikedIds(likedContent) {
    if (Array.isArray(likedContent)) {
        likedIds = new Set(likedContent);
    }
}

function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) {
        return '0:00';
    }

    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updatePlayState(isPlaying) {
    const playIcon = playPauseButton?.querySelector('i');
    if (playIcon) {
        playIcon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }

    if (overlayPlayButton) {
        overlayPlayButton.classList.toggle('hidden', isPlaying);
    }
}

function updateTimelineDisplay() {
    if (!videoPlayer) return;

    const duration = Number.isFinite(videoPlayer.duration) ? Math.floor(videoPlayer.duration) : 0;
    const current = Number.isFinite(videoPlayer.currentTime) ? Math.floor(videoPlayer.currentTime) : 0;

    if (!isSeeking && videoSeekBar) {
        videoSeekBar.max = duration;
        videoSeekBar.value = Math.min(current, duration);
    }

    if (currentTimeLabel) {
        currentTimeLabel.textContent = formatTime(current);
    }

    if (durationTimeLabel) {
        durationTimeLabel.textContent = formatTime(duration);
    }
}

function handleSeekInput(event) {
    if (!videoPlayer) return;
    isSeeking = true;
    const target = event?.target ?? videoSeekBar;
    if (!target) return;
    const newTime = Number(target.value || 0);
    if (currentTimeLabel) {
        currentTimeLabel.textContent = formatTime(newTime);
    }
}

function handleSeekCommit(event) {
    if (!videoPlayer) return;
    const target = event?.target ?? videoSeekBar;
    if (!target) return;
    videoPlayer.currentTime = Number(target.value || 0);
    isSeeking = false;
    updateTimelineDisplay();
}

function toggleFullscreen() {
    const target = videoShell || videoPlayer;
    if (!target) return;

    if (!document.fullscreenElement) {
        if (target.requestFullscreen) {
            target.requestFullscreen().catch(() => {});
        }
        return;
    }

    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
}

function updateFullscreenIcon() {
    const icon = fullscreenButton?.querySelector('i');
    if (!icon) return;

    icon.className = document.fullscreenElement ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
}

function updateSeriesControls(video) {
    const isSeries = video?.type === 'series' && Boolean(video.seriesId);
    currentSeriesId = isSeries ? video.seriesId : null;

    if (episodeListButton) {
        episodeListButton.classList.toggle('d-none', !isSeries);
        episodeListButton.disabled = !isSeries;
    }

    if (nextEpisodeButton) {
        nextEpisodeButton.classList.toggle('d-none', !isSeries);
        nextEpisodeButton.disabled = !isSeries;
    }

    if (!isSeries) {
        episodesLoaded = false;
        loadedSeriesId = null;
        episodeOrder = [];
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
        if (episodeDrawerLabel) {
            episodeDrawerLabel.textContent = 'Episodes';
        }
        if (episodeDrawerInstance) {
            episodeDrawerInstance.hide();
        }
        updateEpisodeHighlight(null);
        return;
    }

    const cached = seriesEpisodesCache.get(currentSeriesId);
    if (cached) {
        loadedSeriesId = currentSeriesId;
        episodesLoaded = true;
        renderEpisodeList(cached.episodes, cached.seriesTitle);
    } else {
        loadedSeriesId = null;
        episodesLoaded = false;
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
    }
}

function updateEpisodeHighlight(videoId) {
    if (!episodeListElement) return;
    const items = episodeListElement.querySelectorAll('[data-episode-id]');
    items.forEach((item) => {
        const isActive = item.dataset.episodeId === videoId;
        item.classList.toggle('active', isActive);
    });

    if (nextEpisodeButton) {
        if (!currentSeriesId || !episodeOrder.length) {
            nextEpisodeButton.disabled = true;
            return;
        }

        const index = episodeOrder.indexOf(videoId);
        nextEpisodeButton.disabled = index === -1 || index >= episodeOrder.length - 1;
    }
}

function togglePlay() {
    if (!videoPlayer) return;

    if (videoPlayer.paused || videoPlayer.ended) {
        videoPlayer.play().catch(() => {});
    } else {
        videoPlayer.pause();
    }
}

function skipPlayback(offsetSeconds) {
    if (!videoPlayer || !Number.isFinite(videoPlayer.duration)) {
        return;
    }

    videoPlayer.currentTime = Math.min(Math.max((videoPlayer.currentTime || 0) + offsetSeconds, 0), videoPlayer.duration);
    updateTimelineDisplay();
}

async function goToNextEpisode() {
    if (!currentVideoId || !currentSeriesId) {
        return;
    }

    if (episodeOrder.length) {
        const index = episodeOrder.indexOf(currentVideoId);
        if (index !== -1) {
            if (index >= episodeOrder.length - 1) {
                updateEpisodeHighlight(currentVideoId);
                return;
            }

            const nextId = episodeOrder[index + 1];
            const nextVideo = episodesMap.get(nextId) || videoCache.get(nextId);
            if (nextVideo) {
                await openVideoModal(nextVideo);
                return;
            }
        }
    }

    try {
        if (nextEpisodeButton) {
            nextEpisodeButton.disabled = true;
        }

        const response = await fetch(`/catalog/video/${currentVideoId}/next`);
        if (!response.ok) {
            throw new Error('No next episode available');
        }

        const data = await response.json();
        if (data?.video) {
            await openVideoModal(data.video);
            return;
        }
    } catch (error) {
        console.error('Unable to load next episode', error);
    } finally {
        updateEpisodeHighlight(currentVideoId);
    }
}

async function fetchSeriesEpisodes(seriesId, { limit = 200 } = {}) {
    if (!seriesId) {
        return { items: [], total: 0, series: null };
    }

    const params = new URLSearchParams({
        seriesId,
        limit: String(limit),
        page: '1',
    });

    const response = await fetch(`/catalog/videos?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to load episodes list');
    }

    return response.json();
}

function renderEpisodeList(episodes, seriesTitle = '') {
    if (!episodeListElement) return;

    episodeOrder = episodes.filter((episode) => episode && episode.id).map((episode) => episode.id);
    if (episodeDrawerLabel) {
        episodeDrawerLabel.textContent = seriesTitle ? `${seriesTitle} · Episodes` : 'Episodes';
    }

    const fragment = document.createDocumentFragment();
    episodes.forEach((episode) => {
        if (!episode || !episode.id) return;
        episodesMap.set(episode.id, episode);
        if (!videoCache.has(episode.id)) {
            videoCache.set(episode.id, episode);
        }

        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.dataset.episodeId = episode.id;
        const thumb = episode.poster ? `<img src="${episode.poster}" alt="${episode.title}" class="episode-thumb" />` : '<div class="episode-thumb"></div>';
        const episodeNumber = Number.isFinite(Number(episode.episodeNumber))
            ? `<span class="episode-number">Episode ${episode.episodeNumber}</span>`
            : '';
        li.innerHTML = `
            ${thumb}
            <div class="episode-meta">
                <span class="episode-title">${episode.title}</span>
                ${episodeNumber}
                ${episode.year ? `<span class="episode-year text-white-50 small">${episode.year}</span>` : ''}
            </div>
            <button type="button" class="episode-play">Play</button>
        `;
        fragment.appendChild(li);
    });

    episodeListElement.innerHTML = '';
    episodeListElement.appendChild(fragment);
    updateEpisodeHighlight(currentVideoId);
}

async function ensureEpisodesLoaded() {
    if (!currentSeriesId) {
        episodeOrder = [];
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
        if (episodeDrawerLabel) {
            episodeDrawerLabel.textContent = 'Episodes';
        }
        return;
    }

    if (episodesLoaded && loadedSeriesId === currentSeriesId) {
        updateEpisodeHighlight(currentVideoId);
        return;
    }

    const cached = seriesEpisodesCache.get(currentSeriesId);
    if (cached) {
        renderEpisodeList(cached.episodes, cached.seriesTitle);
        loadedSeriesId = currentSeriesId;
        episodesLoaded = true;
        updateEpisodeHighlight(currentVideoId);
        return;
    }

    try {
        const data = await fetchSeriesEpisodes(currentSeriesId, { limit: 500 });
        const episodes = Array.isArray(data.items) ? data.items : [];
        const seriesTitle = data?.series?.title || '';

        seriesEpisodesCache.set(currentSeriesId, {
            episodes,
            seriesTitle,
        });

        renderEpisodeList(episodes, seriesTitle);
        loadedSeriesId = currentSeriesId;
        episodesLoaded = true;
    } catch (error) {
        console.error('Failed to load episodes list', error);
    }
}

function handleEpisodeListClick(event) {
    const item = event.target.closest('[data-episode-id]');
    if (!item) {
        return;
    }

    const { episodeId } = item.dataset;
    if (!episodeId) {
        return;
    }

    const video = episodesMap.get(episodeId) || videoCache.get(episodeId);
    if (video) {
        openVideoModal(video);
        if (episodeDrawerInstance) {
            episodeDrawerInstance.hide();
        }
    }
}

async function fetchCatalogPage() {
    if (isLoading || nextOffset >= totalItems) return;

    const profileData = ensureProfileSelected();
    if (!profileData) return;

    // Capture the category, offset, and request ID at the time this request starts
    const requestCategory = activeSortBy;
    const expectedOffset = nextOffset;
    const requestId = currentRequestId;
    
    // Additional validation: if offset doesn't make sense, prevent the request
    if (nextOffset > totalItems && totalItems !== Infinity) {
        return;
    }
    
    isLoading = true;
    
    // Don't show loading elements during search
    if (!activeSearchTerm || !activeSearchTerm.trim()) {
        sentinel?.classList.remove('hidden');
        setLoadingState(true);
    }

    const limit = isFirstBatch ? initialLoadSize : standardLoadSize;
    const safeLimit = limit > 0 ? limit : initialLoadSize;
    
    const params = new URLSearchParams({
        offset: String(nextOffset),
        limit: String(safeLimit),
        profileId: profileData.selectedProfileId,
    });

    if (activeSearchTerm) {
        params.set('search', activeSearchTerm);
    }

    if (activeSortBy) {
        params.set('sortBy', activeSortBy);
    }

    // Add category identifier to track request origin
    params.set('requestCategory', requestCategory);

    // Add watchedOnly when on a genre category
    if (activeSortBy && activeSortBy.startsWith('genre:') && watchedOnly) {
        params.set('watchedOnly', '1');
    }

    try {
        // If watchedOnly for genre, ensure watched sets are loaded before fetching
        if (activeSortBy && activeSortBy.startsWith('genre:') && watchedOnly) {
            const { selectedProfileId } = profileData;
            const genre = activeSortBy.replace('genre:', '');
            await loadWatchedSetsForGenre(selectedProfileId, genre);
        }
        if (activeSortBy && activeSortBy.startsWith('genre:')) {
            params.set('_', String(Date.now()));
            if (watchedOnly) params.set('debug', '1');
        }
        const url = `/catalog/data?${params.toString()}`;
        const response = await fetch(url);
        
        // Check if this request is still valid BEFORE processing response
        if (requestId !== currentRequestId) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
        if (requestCategory !== activeSortBy) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load catalog page');
        }

        const data = await response.json();
        
        // CRITICAL: Validate BEFORE processing any content to prevent wrong videos from being displayed
        if (requestId !== currentRequestId) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
        if (data.requestCategory && data.requestCategory !== activeSortBy) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
        if (requestCategory !== activeSortBy) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
        updateLikedIds(data.likedContent);
        const waitTime = Math.max(0, MINIMUM_LOADER_DURATION_MS);
        if (!isFirstBatch && waitTime > 0) {
            await loadingTime(waitTime);
        }
        
        // CRITICAL: Final validation right before adding content to prevent wrong videos
        if (requestId !== currentRequestId || requestCategory !== activeSortBy) {
            isLoading = false;
            setLoadingState(false);
            return;
        }
        
    let originalItems = Array.isArray(data.catalog) ? data.catalog : [];
    const originalCount = originalItems.length;
    let catalogItems = applyWatchedFilterIfNeeded(originalItems, profileData.selectedProfileId, activeSortBy);
    appendVideos(catalogItems);
    // Watched-only empty state message
    if (activeSortBy && activeSortBy.startsWith('genre:') && watchedOnly) {
        const genreName = activeSortBy.replace('genre:', '');
        if (isFirstBatch && catalogItems.length === 0) {
            try { window.showWatchedEmptyMessage ? window.showWatchedEmptyMessage(genreName) : null; } catch (_) {}
        } else if (catalogItems.length > 0) {
            try { window.hideWatchedEmptyMessage ? window.hideWatchedEmptyMessage() : null; } catch (_) {}
        }
    } else {
        try { window.hideWatchedEmptyMessage ? window.hideWatchedEmptyMessage() : null; } catch (_) {}
    }

        // Clear Most Popular section if we're searching (it will be recreated below if there are matching results)
        if (activeSearchTerm && activeSearchTerm.trim()) {
            const existingSection = document.getElementById('most-popular-section');
            const existingHeader = document.getElementById('most-popular-header');
            if (existingSection) existingSection.remove();
            if (existingHeader) existingHeader.remove();
        }

        // Handle Most Popular section for Home category only
        if (activeSortBy === 'home' && data.mostPopular && Array.isArray(data.mostPopular) && data.mostPopular.length > 0) {
            let mostPopularToShow = data.mostPopular;
            
            // Filter Most Popular based on search if searching
            if (activeSearchTerm && activeSearchTerm.trim()) {
                const searchLower = activeSearchTerm.toLowerCase().trim();
                mostPopularToShow = data.mostPopular.filter(video => 
                    video.title && video.title.toLowerCase().includes(searchLower)
                );
            }
            
            // Only show Most Popular section if there are items to display after filtering
            if (window.appendMostPopularSection && mostPopularToShow.length > 0) {
                window.appendMostPopularSection(mostPopularToShow);
            }
        }

        // Handle search results and no-results message for all categories
        if (activeSearchTerm && isFirstBatch) {
            if (activeSortBy === 'home') {
                // Home category: Handle Continue Watching section
                const pageHeader = document.getElementById('pageHeader');
                if (pageHeader) {
                    // During search: show only if there are Continue Watching results
                    pageHeader.style.display = catalogItems.length > 0 ? 'block' : 'none';
                }
                
                // Store Continue Watching results count for no-results check
                window.continueWatchingResultsCount = catalogItems.length;
                
                // Check for no results after a delay to let genre sections load
                setTimeout(() => {
                    checkAndShowNoResults(activeSearchTerm);
                }, 200);
            } else {
                // Other categories: Track main results and check immediately
                window.mainResultsCount = catalogItems.length;
                checkAndShowNoResults(activeSearchTerm);
            }
        } else if (!activeSearchTerm) {
            // Reset counters and hide message when not searching
            if (activeSortBy === 'home') {
                window.continueWatchingResultsCount = catalogItems.length;
                window.genreSectionsResultsCount = 0; // Will be set by genre sections
                // Outside of search: show header only if there are items in Continue Watching
                const pageHeader = document.getElementById('pageHeader');
                if (pageHeader) {
                    const hasItems = (catalogItems.length > 0) || (feed && feed.children && feed.children.length > 0);
                    pageHeader.style.display = hasItems ? 'block' : 'none';
                }
            } else {
                window.mainResultsCount = catalogItems.length;
            }
            hideNoResultsMessage();
        }

    // Advance pagination based on server-returned count to avoid infinite loop when client filters everything out
    const totalFromResponse = Number(data.total);
    const respOffset = Number.isFinite(Number(data.offset)) ? Number(data.offset) : expectedOffset;
    nextOffset = Math.max(nextOffset, respOffset + originalCount);
    totalItems = Number.isFinite(totalFromResponse) ? totalFromResponse : totalItems;
        isFirstBatch = false;
        isLoading = false;

    } catch (error) {
        console.error(error);
        isLoading = false;
    } finally {
        setLoadingState(false);
        if (nextOffset >= totalItems || (activeSearchTerm && activeSearchTerm.trim())) {
            sentinel?.classList.add('hidden');
        } else {
            ensureContentFill();
        }
    }
}

function initializeObserver() {
    
    try {
        window.addEventListener('scroll', handleScrollFallback, { passive: true });
    } catch (error) {
        window.addEventListener('scroll', handleScrollFallback);
    }
    window.addEventListener('resize', ensureContentFill);

    if (!('IntersectionObserver' in window) || !sentinel) {
        ensureContentFill();
        return;
    }

    if (observer) {
        observer.disconnect();
    }

    // This is lazy loading to load videos when we are at the bottom of the page
    observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                fetchCatalogPage();
            }
        });
    }, {
        root: null,
        rootMargin: '200px 0px',
    });

    observer.observe(sentinel);
    ensureContentFill();

}

function handleScrollFallback() {
    if (isLoading || nextOffset >= totalItems) {
        return;
    }
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        fetchCatalogPage();
    }
}

function ensureContentFill() {
    if (isLoading || nextOffset >= totalItems) {
        return;
    }
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(doc?.scrollHeight || 0, body?.scrollHeight || 0);
    const clientHeight = window.innerHeight || doc?.clientHeight || 0;

    if (scrollHeight - clientHeight < 200) {
        fetchCatalogPage();
    }
}

function resetFeedForSort() {
    nextOffset = 0;
    totalItems = Infinity;
    isFirstBatch = true;
    feed.innerHTML = '';
    videoCache = new Map();
    setLoadingState(false);
    
    if (sentinel) {
        // Hide sentinel during search, show for normal pagination
        if (activeSearchTerm && activeSearchTerm.trim()) {
            sentinel.classList.add('hidden');
        } else {
            sentinel.classList.remove('hidden');
        }
    }
    if (observer && sentinel && (!activeSearchTerm || !activeSearchTerm.trim())) {
        observer.observe(sentinel);
    }
}

async function setSortBy(sortBy, forceReload = false) {
    if (activeSortBy !== sortBy || forceReload) {
        const previousSort = activeSortBy;
        activeSortBy = sortBy;
        // Reset watched-only toggle when switching to a different genre
        if (watchedToggle) {
            const wasGenre = previousSort.startsWith('genre:');
            const isGenre = activeSortBy.startsWith('genre:');
            const prevGenreName = wasGenre ? previousSort.slice(6) : null;
            const newGenreName = isGenre ? activeSortBy.slice(6) : null;
            if (!isGenre) {
                // Leaving genre view -> clear
                watchedOnly = false;
                watchedToggle.checked = false;
                try { hideWatchedEmptyMessage(); } catch (_) {}
            } else if (wasGenre && prevGenreName !== newGenreName) {
                // Switching between different genres
                watchedOnly = false;
                watchedToggle.checked = false;
                try { hideWatchedEmptyMessage(); } catch (_) {}
            }
        }
        
        // Update header area based on category
        const pageHeader = document.getElementById('pageHeader');
        if (pageHeader) {
            if (sortBy === 'home') {
                // Set title but hide until we confirm items exist
                pageHeader.textContent = 'Continue Watching';
                pageHeader.style.display = 'none';
                // Hide watched-only toggle on home
                if (watchedToggleContainer) watchedToggleContainer.style.display = 'none';
            } else if (sortBy.startsWith('genre:')) {
                // For genre categories, hide the section name
                pageHeader.textContent = '';
                pageHeader.style.display = 'none';
                // Show watched-only toggle on genre
                if (watchedToggleContainer) watchedToggleContainer.style.display = '';
            } else {
                // Default fallback: show header
                pageHeader.style.display = 'block';
            }
        }
        
        // Close search when switching categories
        if (activeSearchTerm || (searchInput && searchInput.classList.contains('active'))) {
            closeSearch();
            return; // closeSearch already handles the rest
        }
        
        // Hide no-results message when switching categories
        hideNoResultsMessage();
        
        // Reset pagination state when switching categories
        nextOffset = 0;
        totalItems = Infinity;
        isFirstBatch = true;
        currentRequestId++; // Invalidate any pending requests
        
        try {
            // Fetch new content while keeping current content visible (no stutter)
            const profileData = ensureProfileSelected();
            if (!profileData) return;

            isLoading = true;
            
            // Don't show loading elements during search
            if (!activeSearchTerm || !activeSearchTerm.trim()) {
                setLoadingState(true);
            }
            
            const params = new URLSearchParams({
                offset: '0',
                limit: String(standardLoadSize || 5),
                profileId: profileData.selectedProfileId,
            });

            if (activeSearchTerm) {
                params.set('search', activeSearchTerm);
            }

            if (activeSortBy) {
                params.set('sortBy', activeSortBy);
            }

            // Add category identifier to track request origin
            params.set('requestCategory', activeSortBy);

            // Add watchedOnly when on a genre category
            const isGenre = activeSortBy && activeSortBy.startsWith('genre:');
            const genreName = isGenre ? activeSortBy.replace('genre:', '') : null;
            if (isGenre && watchedOnly) {
                // Preload watched sets before issuing catalog request to ensure cache.loaded is true
                try {
                    await loadWatchedSetsForGenre(profileData.selectedProfileId, genreName);
                } catch (_) {}
                params.set('watchedOnly', '1');
            }

            if (isGenre) {
                params.set('_', String(Date.now()));
                if (watchedOnly) params.set('debug', '1');
            }
            const url = `/catalog/data?${params.toString()}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                
                // Check if response matches current category (drop stale responses)
                if (data.requestCategory && data.requestCategory !== activeSortBy) {
                    return;
                }
                
                // Atomically replace content to prevent stutter
                feed.innerHTML = '';
                updateLikedIds(data.likedContent);
                let originalItems = Array.isArray(data.catalog) ? data.catalog : [];
                const originalCount = originalItems.length;
                let catalogItems = applyWatchedFilterIfNeeded(originalItems, profileData.selectedProfileId, activeSortBy);
                appendVideos(catalogItems);
                if (isGenre && watchedOnly) {
                    if (catalogItems.length === 0) {
                        try { showWatchedEmptyMessage(genreName); } catch (_) {}
                    } else {
                        try { hideWatchedEmptyMessage(); } catch (_) {}
                    }
                } else {
                    try { hideWatchedEmptyMessage(); } catch (_) {}
                }

                // Reset pagination state for new sort
                // Use original count to advance offset even if client filtered everything out
                nextOffset = originalCount;
                const totalFromResponse = Number(data.total);
                totalItems = Number.isFinite(totalFromResponse) ? totalFromResponse : Infinity;
                isFirstBatch = false;
                
                // Disable infinite scroll if we've loaded all available items
                if (nextOffset >= totalItems) {
                    sentinel?.classList.add('hidden');
                    if (observer && sentinel) {
                        observer.unobserve(sentinel);
                    }
                } else {
                    sentinel?.classList.remove('hidden');
                }
            } else {
                throw new Error('Failed to load catalog with new sort');
            }
            
        } catch (error) {
            console.error('Error in setSortBy:', error);
        } finally {
            isLoading = false;
            setLoadingState(false);
        }
    }
}

// Make setSortBy available globally for genre title clicks
window.setSortBy = setSortBy;

// Initialize watched-only toggle events
document.addEventListener('DOMContentLoaded', () => {
    if (watchedToggle) {
        watchedToggle.addEventListener('change', () => {
            watchedOnly = watchedToggle.checked;
            if (!watchedOnly) {
                try { hideWatchedEmptyMessage(); } catch (_) {}
            }
            // When toggling inside a genre, clear and immediately refetch with current category
            if (activeSortBy && activeSortBy.startsWith('genre:')) {
                // Reset feed and re-observe sentinel for proper infinite scroll
                resetFeedForSort();
                // Force reload current category so server applies watchedOnly filter
                setSortBy(activeSortBy, true);
            }
        });
    }
});

function openSearch() {
    if (!searchInput) return;
    searchInput.classList.add('active');
    searchInput.disabled = false;
    
    // Add class to disable magnifying glass
    document.body.classList.add('search-active');
    
    searchInput.focus();
}

function closeSearch() {
    if (!searchInput) return;
    
    // Clear debounce timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Clear search
    searchInput.value = '';
    activeSearchTerm = '';
    
    // Close and disable input
    searchInput.classList.remove('active');
    searchInput.disabled = true;
    
    // Remove class to re-enable magnifying glass
    document.body.classList.remove('search-active');
    
    hideNoResultsMessage();
    
    resetFeed();
    fetchCatalogPage();
}

function toggleSearchInput() {
    if (!searchInput) return;
    if (searchInput.classList.contains('active')) {
        closeSearch();
    } else {
        openSearch();
    }
}

function showNoResultsMessage(searchTerm, category) {
    // Remove existing no-results message
    const existingMessage = document.getElementById('no-results-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Generate category-specific message
    let categoryText = '';
    if (category === 'home') {
        categoryText = '';
    } else if (category === 'popular') {
        categoryText = ' in Most Popular';
    } else if (category && category.startsWith('genre:')) {
        const genre = category.replace('genre:', '');
        categoryText = ` in ${genre}`;
    } else {
        categoryText = ` in this category`;
    }
    
    // Create new no-results message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'no-results-message';
    messageDiv.className = 'text-center mt-5 mb-5';
    messageDiv.innerHTML = `
        <div class="text-white-50">
            <i class="bi bi-search mb-3" style="font-size: 3rem;"></i>
            <h3 class="h4 mb-2">No matching titles found</h3>
            <p class="mb-0">We couldn't find any content matching "${searchTerm}"${categoryText}</p>
            <p class="small">Try adjusting your search or browse our categories</p>
        </div>
    `;
    
    // Insert after the main header
    const mainElement = document.querySelector('main.container-xxl');
    const headerElement = mainElement ? mainElement.querySelector('header') : null;
    if (headerElement) {
        headerElement.insertAdjacentElement('afterend', messageDiv);
    }
}

function hideNoResultsMessage() {
    try {
        const existingMessage = document.getElementById('no-results-message');
        if (existingMessage && existingMessage.parentNode) {
            existingMessage.remove();
        }
    } catch (error) {
        console.error('Error hiding no-results message:', error);
    }
}

// Watched-only empty state helpers
function showWatchedEmptyMessage(genre) {
    try {
        hideWatchedEmptyMessage();
        const mainElement = document.querySelector('main.container-xxl') || document.querySelector('main');
        if (!mainElement) return;
        const headerElement = mainElement.querySelector('header');
        const messageDiv = document.createElement('div');
        messageDiv.id = 'watched-empty-message';
        messageDiv.className = 'text-center mt-5 mb-5';
        const genreText = genre ? ` in ${genre}` : '';
        messageDiv.innerHTML = `
            <div class="text-white-50">
                <i class=\"bi bi-eye-slash mb-3\" style=\"font-size: 3rem;\"></i>
                <h3 class=\"h5 mb-2\">No watched items${genreText} yet</h3>
                <p class=\"mb-0\">Turn off &quot;Watched only&quot; to browse all titles</p>
            </div>
        `;
        if (headerElement) {
            headerElement.insertAdjacentElement('afterend', messageDiv);
        } else {
            mainElement.prepend(messageDiv);
        }
    } catch (error) {
        console.error('Error showing watched empty message:', error);
    }
}

function hideWatchedEmptyMessage() {
    try {
        const existing = document.getElementById('watched-empty-message');
        if (existing && existing.parentNode) existing.remove();
    } catch (error) {
        console.error('Error hiding watched empty message:', error);
    }
}

function checkAndShowNoResults(searchTerm, category = null) {
    // Only check during active search
    if (!searchTerm || !searchTerm.trim()) {
        hideNoResultsMessage();
        return;
    }
    
    const currentCategory = category || activeSortBy;
    
    if (currentCategory === 'home') {
        // For Home category, check if both Continue Watching and genre sections are empty
        const continueWatchingCount = window.continueWatchingResultsCount || 0;
        const genreSectionsCount = window.genreSectionsResultsCount || 0;
        
        if (continueWatchingCount === 0 && genreSectionsCount === 0) {
            showNoResultsMessage(searchTerm, currentCategory);
        } else {
            hideNoResultsMessage();
        }
    } else {
        // For other categories, check if main results are empty
        const mainResultsCount = window.mainResultsCount || 0;
        
        if (mainResultsCount === 0) {
            showNoResultsMessage(searchTerm, currentCategory);
        } else {
            hideNoResultsMessage();
        }
    }
}

// Make functions globally accessible for EJS template
window.checkAndShowNoResults = checkAndShowNoResults;

function debouncedSearch(searchTerm) {
    try {
        // Clear existing timer
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        // Set new timer
        searchDebounceTimer = setTimeout(() => {
            try {
                activeSearchTerm = searchTerm;
                
                if (!activeSearchTerm) {
                    hideNoResultsMessage();
                }
                
                // Don't change category when searching - search within current category
                resetFeed();
                fetchCatalogPage();
            } catch (error) {
                console.error('Error in debounced search:', error);
            }
        }, 300); // 300ms delay
    } catch (error) {
        console.error('Error setting up debounced search:', error);
    }
}

function handleSearchInput(event) {
    const newTerm = event.target.value.trim();
    
    // If search is cleared immediately, handle it without delay
    if (newTerm === '' && activeSearchTerm !== '') {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        activeSearchTerm = '';
        hideNoResultsMessage();
        
        resetFeed();
        fetchCatalogPage();
        return;
    }
    
    // For other changes, use debounced search
    if (newTerm !== activeSearchTerm) {
        debouncedSearch(newTerm);
    }
}

function getProfileId() {
    return localStorage.getItem('selectedProfileId');
}

async function sendProgress(isFinal = false) {
    if (!currentVideoId) return;
    const profileId = getProfileId();
    if (!profileId) return;

    try {
        await fetch(`/catalog/video/${currentVideoId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId,
                positionSeconds: Math.floor(videoPlayer.currentTime || 0),
                durationSeconds: Math.floor(videoPlayer.duration || 0),
                isFinal,
            }),
        });
    } catch (error) {
        console.error('Failed to persist video progress', error);
    }
}

function clearProgressInterval() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function startProgressInterval() {
    if (!progressInterval) {
        progressInterval = setInterval(() => sendProgress(false), 10_000);
    }
}

async function loadVideoProgress(videoId) {
    const profileId = getProfileId();
    if (!profileId) return 0;

    try {
        const response = await fetch(`/catalog/video/${videoId}/progress?profileId=${encodeURIComponent(profileId)}`);
        if (!response.ok) {
            return 0;
        }

        const data = await response.json();
        return Number(data.positionSeconds || 0);
    } catch (error) {
        console.error('Failed to load progress', error);
        return 0;
    }
}

async function openVideoModal(video) {
    const profileId = getProfileId();
    if (!profileId || !video) return;

    videoPlayer.pause();
    await sendProgress(true);
    clearProgressInterval();
    currentVideoId = video.id;
    if (video.id) {
        videoCache.set(video.id, video);
        episodesMap.set(video.id, video);
    }
    updateSeriesControls(video);
    modalTitle.textContent = video.title;
    modalDescription.textContent = video.description || '';

    updatePlayState(false);
    if (videoSeekBar) {
        videoSeekBar.value = 0;
        videoSeekBar.max = 0;
    }
    updateTimelineDisplay();
    updateEpisodeHighlight(video.id);

    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();

    const resumeAt = await loadVideoProgress(video.id);
    resumePosition = resumeAt;

    const sourceUrl = `/catalog/video/${video.id}/stream`;
    videoPlayer.src = sourceUrl;
    videoPlayer.load();

    const handleLoadedMetadata = () => {
        updateTimelineDisplay();
        if (resumePosition > 0 && resumePosition < videoPlayer.duration) {
            try {
                videoPlayer.currentTime = resumePosition;
            } catch (error) {
                console.warn('Unable to set resume position', error);
            }
        }
    };

    if (videoPlayer.readyState >= 1) {
        handleLoadedMetadata();
    } else {
        videoPlayer.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    }

    modalInstance.show();
    ensureEpisodesLoaded();
}

function handleFeedClick(event) {
    const likeContainer = event.target.closest('[data-like-button]');
    if (likeContainer) {
        handleHeartLike(likeContainer);
        event.stopPropagation();
        return;
    }

    const card = event.target.closest('[data-video-id]');
    if (card) {
        const videoId = card.dataset.videoId;
        const profileId = getProfileId();
        if (videoId) {
            const targetUrl = profileId
                ? `/catalog/item/${videoId}?profileId=${encodeURIComponent(profileId)}`
                : `/catalog/item/${videoId}`;
            window.location.href = targetUrl;
        }
    }
}

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

async function handleHeartLike(likeContainer) {
    const itemId = likeContainer.dataset.itemId;
    const profileId = getProfileId();

    if (!itemId || !profileId) {
        alert('Profile not selected!');
        return;
    }

    const heartIcon = likeContainer.querySelector('.like-heart');
    const likesSpan = likeContainer.querySelector('.like-count');
    
    if (!heartIcon || !likesSpan) return;

    const isCurrentlyLiked = heartIcon.classList.contains('liked');
    const endpoint = isCurrentlyLiked ? '/likes/unlike' : '/likes/like';

    // Prevent double-clicking
    if (likeContainer.dataset.processing === 'true') return;
    likeContainer.dataset.processing = 'true';

    // Add ripple effect
    likeContainer.classList.add('ripple');
    setTimeout(() => {
        likeContainer.classList.remove('ripple');
    }, 600);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, profileId }),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to process request');
        }

        if (isCurrentlyLiked) {
            likedIds.delete(itemId);
            heartIcon.classList.remove('liked', 'bi-heart-fill');
            heartIcon.classList.add('bi-heart');
            
            animateCounterDown(likesSpan, parseInt(likesSpan.textContent), result.newLikesCount);
            
        } else {
            likedIds.add(itemId);
            heartIcon.classList.remove('bi-heart');
            heartIcon.classList.add('bi-heart-fill', 'liked');
            
            createParticleBurst(likeContainer);
            createFloatingHearts(likeContainer);
            animateCounterUp(likesSpan, parseInt(likesSpan.textContent), result.newLikesCount);
        }
    } catch (error) {
        console.error('Like/Unlike error:', error);
        alert(error.message);
    } finally {
        setTimeout(() => {
            likeContainer.dataset.processing = 'false';
        }, 200);
    }
}

function createParticleBurst(container) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const burstContainer = document.createElement('div');
    burstContainer.className = 'particle-burst';
    burstContainer.style.left = centerX + 'px';
    burstContainer.style.top = centerY + 'px';
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const angle = (i / 12) * Math.PI * 2;
        const velocity = 20 + Math.random() * 30;
        const size = 3 + Math.random() * 4;
        
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = '0px';
        particle.style.top = '0px';
        
        // Set custom animation with random trajectory
        const endX = Math.cos(angle) * velocity;
        const endY = Math.sin(angle) * velocity;
        
        particle.style.setProperty('--end-x', endX + 'px');
        particle.style.setProperty('--end-y', endY + 'px');
        
        // Dynamic animation keyframes
        particle.style.animation = `particleExplode 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
        particle.style.transform = `translate(${endX}px, ${endY}px)`;
        
        burstContainer.appendChild(particle);
    }
    
    document.body.appendChild(burstContainer);
    
    // Clean up
    setTimeout(() => {
        burstContainer.remove();
    }, 1200);
}

function createFloatingHearts(container) {
    const rect = container.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height / 2;
    
    for (let i = 1; i <= 3; i++) {
        const heart = document.createElement('i');
        heart.className = `bi bi-heart-fill floating-heart-modern heart-${i}`;
        
        // Slight offset for each heart
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 10;
        
        heart.style.left = (baseX + offsetX) + 'px';
        heart.style.top = (baseY + offsetY) + 'px';
        
        document.body.appendChild(heart);
        
        // Clean up after animation
        const animationDuration = i === 2 ? 2200 : i === 3 ? 1800 : 2000;
        setTimeout(() => {
            heart.remove();
        }, animationDuration);
    }
}

function animateCounterUp(element, startValue, endValue) {
    element.classList.add('animate-up');
    
    // Create number morphing effect
    const duration = 800;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smooth animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = endValue;
            setTimeout(() => {
                element.classList.remove('animate-up');
            }, 100);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

function animateCounterDown(element, startValue, endValue) {
    element.classList.add('animate-down');
    
    // Simple fade and scale animation for down
    const duration = 600;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = endValue;
            setTimeout(() => {
                element.classList.remove('animate-down');
            }, 100);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

function setupModalEvents() {
    if (!modalElement || !videoPlayer) {
        return;
    }

    modalInstance = new bootstrap.Modal(modalElement);
    if (episodeDrawerElement) {
        episodeDrawerInstance = bootstrap.Offcanvas.getOrCreateInstance(episodeDrawerElement);
        episodeDrawerElement.addEventListener('show.bs.offcanvas', ensureEpisodesLoaded);
    }

    modalElement.addEventListener('hidden.bs.modal', () => {
        sendProgress(true);
        clearProgressInterval();
        currentVideoId = null;
        currentSeriesId = null;
        loadedSeriesId = null;
        episodesLoaded = false;
        episodeOrder = [];
        resumePosition = 0;
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        updatePlayState(false);
        if (videoSeekBar) {
            videoSeekBar.value = 0;
            videoSeekBar.max = 0;
        }
        updateTimelineDisplay();
        updateEpisodeHighlight(null);
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
        if (episodeDrawerLabel) {
            episodeDrawerLabel.textContent = 'Episodes';
        }
        if (episodeListButton) {
            episodeListButton.classList.add('d-none');
            episodeListButton.disabled = true;
        }
        if (nextEpisodeButton) {
            nextEpisodeButton.classList.add('d-none');
            nextEpisodeButton.disabled = true;
        }
        if (episodeDrawerInstance) {
            episodeDrawerInstance.hide();
        }
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    });

    videoPlayer.addEventListener('play', () => {
        updatePlayState(true);
        startProgressInterval();
    });

    videoPlayer.addEventListener('pause', () => {
        updatePlayState(false);
        sendProgress(false);
        clearProgressInterval();
    });

    videoPlayer.addEventListener('ended', () => {
        updatePlayState(false);
        sendProgress(true);
        clearProgressInterval();
    });

    videoPlayer.addEventListener('timeupdate', updateTimelineDisplay);
    videoPlayer.addEventListener('loadedmetadata', updateTimelineDisplay);
    videoPlayer.addEventListener('seeking', updateTimelineDisplay);
}

function setupSignOut() {
    const signOut = document.getElementById('signOutLink') || Array.from(document.querySelectorAll('.dropdown-menu a')).find((a) => a.textContent.trim().toLowerCase() === 'sign out');
    if (!signOut) return;
    signOut.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            localStorage.removeItem('selectedProfileId');
            localStorage.removeItem('selectedProfileName');
        } catch (err) {
            console.warn('Unable to clear profile selection', err);
        }
        try {
            const resp = await fetch('/logout', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }});
            if (!resp.ok) {
                console.warn('Logout request failed', resp.status);
            }
        } catch (err) {
            console.warn('Logout network error', err);
        } finally {
            window.location.replace('/login');
        }
    });
}

// ------------------------- Event Wiring -------------------------

document.addEventListener('DOMContentLoaded', () => {
    const profileData = ensureProfileSelected();
    if (!profileData) {
        return;
    }

    setupModalEvents();
    setupSignOut();
    initializeObserver();
    fetchCatalogPage();

    // Add click handler to feed for Continue Watching section
    feed.addEventListener('click', handleFeedClick);
    
    // Add click handler to main container for Most Popular and Genre sections
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
        mainContainer.addEventListener('click', handleFeedClick);
    }

    // Navigation links
    const homeLink = document.getElementById('homeLink');
    
    homeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        // Only process if not already active
        if (!homeLink.classList.contains('active')) {
            setSortBy('home');
            homeLink.classList.add('active');
            // Clear active state from all genre links
            document.querySelectorAll('[data-genre]').forEach(link => {
                link.classList.remove('active');
            });
        }
    });

    // Genre navigation links
    document.querySelectorAll('[data-genre]').forEach(genreLink => {
        genreLink.addEventListener('click', (e) => {
            e.preventDefault();
            const genre = e.target.getAttribute('data-genre');
            // Only process if not already active
            if (!genreLink.classList.contains('active')) {
                setSortBy(`genre:${genre}`);
                genreLink.classList.add('active');
                homeLink?.classList.remove('active');
                // Clear active state from other genre links
                document.querySelectorAll('[data-genre]').forEach(link => {
                    if (link !== genreLink) {
                        link.classList.remove('active');
                    }
                });
            }
        });
    });

    searchIcon?.addEventListener('click', toggleSearchInput);
    searchInput?.addEventListener('input', handleSearchInput);
    
    // Close button event listener
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    searchCloseBtn?.addEventListener('click', closeSearch);
    
    // Add keyboard support for search
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
        }
    });

    overlayPlayButton?.addEventListener('click', togglePlay);
    playPauseButton?.addEventListener('click', togglePlay);
    rewindButton?.addEventListener('click', () => skipPlayback(-10));
    forwardButton?.addEventListener('click', () => skipPlayback(10));
    videoSeekBar?.addEventListener('input', handleSeekInput);
    videoSeekBar?.addEventListener('change', handleSeekCommit);
    videoSeekBar?.addEventListener('mouseup', handleSeekCommit);
    videoSeekBar?.addEventListener('touchend', handleSeekCommit);
    fullscreenButton?.addEventListener('click', toggleFullscreen);
    nextEpisodeButton?.addEventListener('click', goToNextEpisode);
    episodeListButton?.addEventListener('click', ensureEpisodesLoaded);
    episodeListElement?.addEventListener('click', handleEpisodeListClick);
    document.addEventListener('fullscreenchange', updateFullscreenIcon);

    window.addEventListener('beforeunload', () => {
        sendProgress(true);
    });
});