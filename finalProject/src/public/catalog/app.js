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

const pageSize = Number(feed?.dataset.pageSize || 12);

let currentPage = 0;
let totalPages = Infinity;
let isLoading = false;
let activeSearchTerm = '';
let likedIds = new Set();
let observer;
let modalInstance;
let currentVideoId = null;
let videoCache = new Map();
let episodesMap = new Map();
let progressInterval = null;
let resumePosition = 0;
let isSeeking = false;
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

function resetFeed() {
    currentPage = 0;
    totalPages = Infinity;
    feed.innerHTML = '';
    videoCache = new Map();
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
    const newTime = Number(target.value || 0);
    videoPlayer.currentTime = newTime;
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

    const target = Math.min(Math.max((videoPlayer.currentTime || 0) + offsetSeconds, 0), videoPlayer.duration);
    videoPlayer.currentTime = target;
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
    if (isLoading || currentPage >= totalPages) return;

    const profileData = ensureProfileSelected();
    if (!profileData) return;

    isLoading = true;
    sentinel?.classList.remove('hidden');

    const params = new URLSearchParams({
        page: String(currentPage + 1),
        limit: String(pageSize),
        profileId: profileData.selectedProfileId,
    });

    if (activeSearchTerm) {
        params.set('search', activeSearchTerm);
    }

    try {
        const response = await fetch(`/catalog/data?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Failed to load catalog page');
        }

        const data = await response.json();
        updateLikedIds(data.likedContent);
        appendVideos(data.catalog || []);

        currentPage = data.page || currentPage + 1;
        totalPages = data.totalPages || totalPages;

        if (currentPage >= totalPages) {
            sentinel?.classList.add('hidden');
        }
    } catch (error) {
        console.error(error);
    } finally {
        isLoading = false;
    }
}

function initializeObserver() {
    if (!('IntersectionObserver' in window) || !sentinel) {
        window.addEventListener('scroll', handleScrollFallback);
        return;
    }

    observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                fetchCatalogPage();
            }
        });
    });

    observer.observe(sentinel);
}

function handleScrollFallback() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        fetchCatalogPage();
    }
}

function toggleSearchInput() {
    if (!searchInput) return;
    searchInput.classList.toggle('active');
    if (searchInput.classList.contains('active')) {
        searchInput.focus();
    }
}

function handleSearchInput(event) {
    const newTerm = event.target.value.trim();
    if (newTerm === activeSearchTerm) {
        return;
    }

    activeSearchTerm = newTerm;
    resetFeed();
    fetchCatalogPage();
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

    searchIcon?.addEventListener('click', toggleSearchInput);
    searchInput?.addEventListener('input', handleSearchInput);

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