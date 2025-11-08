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
    const buttonText = isLiked ? 'Liked' : 'Like';
    const buttonClass = isLiked ? 'btn-danger' : 'btn-outline-light';
    const badges = (item.genres || [])
        .map((genre) => `<span class="badge text-bg-secondary me-1 mb-1">${genre}</span>`)
        .join('');

    const descriptionSnippet = item.description
        ? `<p class="card-text text-white-50 small mb-3">${item.description.slice(0, 90)}${item.description.length > 90 ? '…' : ''}</p>`
        : '';

    return `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        <div class="card h-100 bg-dark text-white" data-video-id="${item.id}">
          <img src="${item.poster}" class="card-img-top" alt="${item.title}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${item.title}</h5>
            <div class="small text-white-50 mb-2">${item.year ?? ''}</div>
            ${descriptionSnippet}
            <div class="mb-3">${badges}</div>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="small">
                <i class="bi bi-heart-fill text-danger me-1"></i>
                <span data-likes-id="${item.id}">${item.likes ?? 0}</span>
              </span>
              <button class="btn btn-sm ${buttonClass}" data-item-id="${item.id}" data-like-button>${buttonText}</button>
            </div>
          </div>
        </div>
      </div>`;
}

// Make createCardHTML and caches available globally for use in EJS view
window.createCardHTML = createCardHTML;
window.videoCache = videoCache;
window.episodesMap = episodesMap;

function appendVideos(videos) {
    const fragment = document.createDocumentFragment();
    videos.forEach((video) => {
        videoCache.set(video.id, video);
        episodesMap.set(video.id, video);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = createCardHTML(video);
        fragment.appendChild(wrapper.firstElementChild);
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

    try {
        const response = await fetch(`/catalog/data?${params.toString()}`);
        
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
        
        const catalogItems = Array.isArray(data.catalog) ? data.catalog : [];
        appendVideos(catalogItems);

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
            
            if (window.appendMostPopularSection) {
                window.appendMostPopularSection(mostPopularToShow);
            }
        }

        // Handle search results and no-results message for all categories
        if (activeSearchTerm && isFirstBatch) {
            if (activeSortBy === 'home') {
                // Home category: Handle Continue Watching section
                const pageHeader = document.getElementById('pageHeader');
                if (pageHeader) {
                    // Hide pageHeader if there are no Continue Watching results
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
            } else {
                window.mainResultsCount = catalogItems.length;
            }
            hideNoResultsMessage();
        }

        nextOffset += catalogItems.length;
        const totalFromResponse = Number(data.total);
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

async function setSortBy(sortBy) {
    if (activeSortBy !== sortBy) {
        activeSortBy = sortBy;
        
        // Update page header based on category
        const pageHeader = document.getElementById('pageHeader');
        if (pageHeader) {
            // Always show the header when switching categories (not during search)
            pageHeader.style.display = 'block';
            if (sortBy === 'home') {
                pageHeader.textContent = 'Continue Watching';
            } else if (sortBy.startsWith('genre:')) {
                const genre = sortBy.replace('genre:', '');
                pageHeader.textContent = genre;
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

            const response = await fetch(`/catalog/data?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                
                // Check if response matches current category (drop stale responses)
                if (data.requestCategory && data.requestCategory !== activeSortBy) {
                    return;
                }
                
                // Atomically replace content to prevent stutter
                feed.innerHTML = '';
                updateLikedIds(data.likedContent);
                appendVideos(data.catalog || []);

                // Reset pagination state for new sort
                const itemsLoaded = (data.catalog || []).length;
                nextOffset = itemsLoaded;
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
    
    // Show pageHeader and hide no-results message when search is cleared
    if (activeSortBy === 'home') {
        const pageHeader = document.getElementById('pageHeader');
        if (pageHeader) {
            pageHeader.style.display = 'block';
        }
    }
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
                
                // Show pageHeader and hide no-results message when search is cleared
                if (!activeSearchTerm) {
                    if (activeSortBy === 'home') {
                        const pageHeader = document.getElementById('pageHeader');
                        if (pageHeader) {
                            pageHeader.style.display = 'block';
                        }
                    }
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
        
        if (activeSortBy === 'home') {
            const pageHeader = document.getElementById('pageHeader');
            if (pageHeader) {
                pageHeader.style.display = 'block';
            }
        }
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
    const likeButton = event.target.closest('[data-like-button]');
    if (likeButton) {
        handleLikeButton(likeButton);
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

async function handleLikeButton(button) {
    const itemId = button.dataset.itemId;
    const profileId = getProfileId();

    if (!itemId || !profileId) {
        alert('Profile not selected!');
        return;
    }

    const isUnlike = button.classList.contains('btn-danger');
    const endpoint = isUnlike ? '/likes/unlike' : '/likes/like';

    button.disabled = true;

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

        const likesSpan = document.querySelector(`[data-likes-id="${itemId}"]`);
        if (likesSpan) {
            likesSpan.textContent = result.newLikesCount;
        }

        if (isUnlike) {
            likedIds.delete(itemId);
            button.textContent = 'Like';
            button.classList.remove('btn-danger');
            button.classList.add('btn-outline-light');
        } else {
            likedIds.add(itemId);
            button.textContent = 'Liked';
            button.classList.remove('btn-outline-light');
            button.classList.add('btn-danger');
            popHeart(button);
            rainbow(button);
        }
    } catch (error) {
        console.error('Like/Unlike error:', error);
        alert(error.message);
    } finally {
        button.disabled = false;
    }
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
    if (signOut) {
        signOut.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                localStorage.removeItem('selectedProfileId');
                localStorage.removeItem('selectedProfileName');
            } catch (err) {
                console.warn('Unable to clear profile selection', err);
            }
            window.location.replace('/');
        });
    }
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

    feed.addEventListener('click', handleFeedClick);

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