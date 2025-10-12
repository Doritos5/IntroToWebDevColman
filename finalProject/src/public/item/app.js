const likeButton = document.getElementById('likeButton');
const likeButtonLabel = document.getElementById('likeButtonLabel');
const likeCountElement = document.getElementById('likeCount');
const metaLikeCountElement = document.getElementById('metaLikeCount');
const bodyElement = document.body;
const videoElement = document.getElementById('detailVideoPlayer');
const videoShell = document.getElementById('videoShell');
const videoPanelElement = document.querySelector('.video-panel');
const overlayPlayButton = document.getElementById('overlayPlayButton');
const playPauseButton = document.getElementById('playPauseButton');
const rewindButton = document.getElementById('rewindButton');
const forwardButton = document.getElementById('forwardButton');
const videoSeekBar = document.getElementById('videoSeekBar');
const currentTimeLabel = document.getElementById('currentTimeLabel');
const durationTimeLabel = document.getElementById('durationTimeLabel');
const fullscreenButton = document.getElementById('fullscreenButton');
const nextEpisodeButton = document.getElementById('nextEpisodeButton');
const episodeListButton = document.getElementById('episodeListButton');
const episodeDrawerElement = document.getElementById('episodeDrawer');
const episodeDrawerLabel = document.getElementById('episodeDrawerLabel');
const episodeListElement = document.getElementById('episodeList');
const defaultEpisodeLabel = episodeDrawerLabel?.textContent?.trim() || 'Episodes';

let currentVideoId = getVideoId();
let resumePosition = 0;
let isSeeking = false;
let progressInterval = null;
let episodeDrawerInstance = null;
let currentSeriesId = null;
let episodesLoaded = false;
let loadedSeriesId = null;
let episodeOrder = [];
const episodesMap = new Map();
const seriesEpisodesCache = new Map();
let videoEventsBound = false;

function getVideoId() {
    return bodyElement?.dataset?.videoId || '';
}

function getProfileId() {
    const datasetProfile = bodyElement?.dataset?.profileId;
    if (datasetProfile) {
        return datasetProfile;
    }
    return localStorage.getItem('selectedProfileId');
}

function getProfileName() {
    return localStorage.getItem('selectedProfileName');
}

function ensureProfileSelected() {
    const profileId = getProfileId();
    const profileName = getProfileName();

    if (!profileId || !profileName) {
        window.location.href = '/profiles_page';
        return false;
    }

    if (bodyElement) {
        bodyElement.dataset.profileId = profileId;
    }

    return true;
}

function getInitialVideoMetadata() {
    const metadata = {
        id: currentVideoId,
        type: 'movie',
        seriesId: null,
        seriesTitle: '',
        episodeNumber: null,
    };

    if (!videoPanelElement) {
        return metadata;
    }

    if (videoPanelElement.dataset.videoType) {
        metadata.type = videoPanelElement.dataset.videoType;
    }

    if (videoPanelElement.dataset.seriesId) {
        metadata.seriesId = videoPanelElement.dataset.seriesId;
    }

    if (videoPanelElement.dataset.seriesTitle) {
        metadata.seriesTitle = videoPanelElement.dataset.seriesTitle;
    }

    const rawEpisodeNumber = Number(videoPanelElement.dataset.episodeNumber);
    if (Number.isFinite(rawEpisodeNumber)) {
        metadata.episodeNumber = rawEpisodeNumber;
    }

    return metadata;
}


function updateLikePresentation(isLiked) {
    if (!likeButton || !likeButtonLabel) {
        return;
    }

    likeButton.classList.toggle('liked', isLiked);
    likeButtonLabel.textContent = isLiked ? 'Liked' : 'Like';
    likeButton.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
    bodyElement.dataset.liked = String(isLiked);
}

function setLikeCount(newCount) {
    const safeCount = Number.isFinite(Number(newCount)) ? Number(newCount) : 0;
    if (likeCountElement) {
        likeCountElement.textContent = safeCount;
    }
    if (metaLikeCountElement) {
        metaLikeCountElement.textContent = safeCount;
    }
}

async function toggleLike() {
    if (!likeButton) {
        return;
    }

    const videoId = getVideoId();
    const profileId = getProfileId();

    if (!videoId) {
        console.error('Missing video identifier.');
        return;
    }

    if (!profileId) {
        alert('Please pick a profile before liking titles.');
        window.location.href = '/profiles_page';
        return;
    }

    const currentlyLiked = bodyElement.dataset.liked === 'true';
    const endpoint = currentlyLiked ? '/likes/unlike' : '/likes/like';

    likeButton.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: videoId, profileId }),
        });

        const payload = await response.json();

        if (!response.ok) {
            const message = payload?.message || 'Unable to update like right now.';
            throw new Error(message);
        }

        updateLikePresentation(!currentlyLiked);
        setLikeCount(payload.newLikesCount);
    } catch (error) {
        console.error('Failed to toggle like:', error);
        alert(error.message || 'Unable to update like right now.');
    } finally {
        likeButton.disabled = false;
    }
}

function setupSignOut() {
    const signOut = document.getElementById('signOutLink');
    if (!signOut) {
        return;
    }

    signOut.addEventListener('click', (event) => {
        event.preventDefault();
        try {
            localStorage.removeItem('selectedProfileId');
            localStorage.removeItem('selectedProfileName');
        } catch (error) {
            console.warn('Failed to clear profile selection', error);
        }
        window.location.replace('/');
    });
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
    if (!videoElement) return;

    const duration = Number.isFinite(videoElement.duration) ? Math.floor(videoElement.duration) : 0;
    const current = Number.isFinite(videoElement.currentTime) ? Math.floor(videoElement.currentTime) : 0;

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
    if (!videoElement) return;
    isSeeking = true;
    const target = event?.target ?? videoSeekBar;
    if (!target) return;
    const newTime = Number(target.value || 0);
    if (currentTimeLabel) {
        currentTimeLabel.textContent = formatTime(newTime);
    }
}

function handleSeekCommit(event) {
    if (!videoElement) return;
    const target = event?.target ?? videoSeekBar;
    if (!target) return;
    const newTime = Number(target.value || 0);
    videoElement.currentTime = newTime;
    isSeeking = false;
    updateTimelineDisplay();
}

function togglePlay() {
    if (!videoElement) return;

    if (videoElement.paused || videoElement.ended) {
        videoElement.play().catch(() => {});
    } else {
        videoElement.pause();
    }
}

function skipPlayback(offsetSeconds) {
    if (!videoElement || !Number.isFinite(videoElement.duration)) {
        return;
    }

    const target = Math.min(
        Math.max((videoElement.currentTime || 0) + offsetSeconds, 0),
        videoElement.duration,
    );
    videoElement.currentTime = target;
    updateTimelineDisplay();
}

function toggleFullscreen() {
    const target = videoShell || videoElement;
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

async function sendProgress(isFinal = false) {
    if (!currentVideoId || !videoElement) return;
    const profileId = getProfileId();
    if (!profileId) return;

    try {
        await fetch(`/catalog/video/${currentVideoId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId,
                positionSeconds: Math.floor(videoElement.currentTime || 0),
                durationSeconds: Math.floor(videoElement.duration || 0),
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

function updateSeriesControls(meta) {
    const isSeries = meta?.type === 'series' && Boolean(meta.seriesId);
    currentSeriesId = isSeries ? meta.seriesId : null;

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
        episodesMap.clear();
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
        if (episodeDrawerLabel) {
            episodeDrawerLabel.textContent = defaultEpisodeLabel;
        }
        return;
    }

    if (episodeDrawerLabel) {
        episodeDrawerLabel.textContent = meta.seriesTitle
            ? `${meta.seriesTitle} · Episodes`
            : defaultEpisodeLabel;
    }
}

function updateEpisodeHighlight(activeId) {
    if (episodeListElement) {
        const items = episodeListElement.querySelectorAll('[data-episode-id]');
        items.forEach((item) => {
            const isActive = item.dataset.episodeId === activeId;
            item.classList.toggle('active', isActive);
        });
    }

    if (nextEpisodeButton) {
        if (!currentSeriesId) {
            nextEpisodeButton.disabled = true;
            return;
        }

        if (!episodeOrder.length) {
            nextEpisodeButton.disabled = false;
            return;
        }

        const index = episodeOrder.indexOf(activeId);
        nextEpisodeButton.disabled = index === -1 || index >= episodeOrder.length - 1;
    }
}

async function fetchSeriesEpisodes(seriesId, { limit = 500 } = {}) {
    if (!seriesId) {
        return { items: [], series: null };
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
        episodeDrawerLabel.textContent = seriesTitle
            ? `${seriesTitle} · Episodes`
            : defaultEpisodeLabel;
    }

    const fragment = document.createDocumentFragment();
    episodes.forEach((episode) => {
        if (!episode || !episode.id) return;
        episodesMap.set(episode.id, episode);

        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.dataset.episodeId = episode.id;
        const thumb = episode.poster
            ? `<img src="${episode.poster}" alt="${episode.title}" class="episode-thumb" />`
            : '<div class="episode-thumb"></div>';
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
        episodesLoaded = false;
        loadedSeriesId = null;
        episodeOrder = [];
        episodesMap.clear();
        if (episodeListElement) {
            episodeListElement.innerHTML = '';
        }
        if (episodeDrawerLabel) {
            episodeDrawerLabel.textContent = defaultEpisodeLabel;
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
        episodesLoaded = true;
        loadedSeriesId = currentSeriesId;
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
        episodesLoaded = true;
        loadedSeriesId = currentSeriesId;
    } catch (error) {
        console.error('Failed to load episodes list', error);
    }
}

function navigateToEpisode(episodeId) {
    if (!episodeId || episodeId === currentVideoId) {
        return;
    }

    const profileId = getProfileId();
    sendProgress(true);
    clearProgressInterval();

    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    window.location.href = `/catalog/item/${episodeId}${query}`;
}

function handleEpisodeListClick(event) {
    const target = event.target.closest('[data-episode-id]');
    if (!target) {
        return;
    }

    const { episodeId } = target.dataset;
    if (!episodeId) {
        return;
    }

    navigateToEpisode(episodeId);
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
            navigateToEpisode(nextId);
            return;
        }
    }

    try {
        const response = await fetch(`/catalog/video/${currentVideoId}/next`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const nextVideo = data?.video;
        if (nextVideo?.id) {
            navigateToEpisode(nextVideo.id);
        } else {
            updateEpisodeHighlight(currentVideoId);
        }
    } catch (error) {
        console.error('Failed to fetch next episode', error);
    }
}

function setupVideoEvents() {
    if (videoEventsBound || !videoElement) {
        return;
    }
    videoEventsBound = true;

    videoElement.addEventListener('play', () => {
        updatePlayState(true);
        startProgressInterval();
    });

    videoElement.addEventListener('pause', () => {
        updatePlayState(false);
        sendProgress(false);
        clearProgressInterval();
    });

    videoElement.addEventListener('ended', () => {
        updatePlayState(false);
        sendProgress(true);
        clearProgressInterval();
        updateEpisodeHighlight(currentVideoId);
    });

    videoElement.addEventListener('timeupdate', updateTimelineDisplay);
    videoElement.addEventListener('loadedmetadata', updateTimelineDisplay);
    videoElement.addEventListener('seeking', updateTimelineDisplay);

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

    if (episodeDrawerElement && window.bootstrap?.Offcanvas) {
        episodeDrawerInstance = window.bootstrap.Offcanvas.getOrCreateInstance(episodeDrawerElement);
        episodeDrawerElement.addEventListener('show.bs.offcanvas', ensureEpisodesLoaded);
    }
}

async function initializeVideoPlayer() {
    if (!videoElement) {
        return;
    }

    try {
        videoElement.removeAttribute('controls');
    } catch (error) {
        // Ignore failures removing native controls
    }
    videoElement.controls = false;

    setupVideoEvents();

    if (videoSeekBar) {
        videoSeekBar.value = 0;
        videoSeekBar.max = 0;
    }
    updateTimelineDisplay();
    updatePlayState(false);

    const metadata = getInitialVideoMetadata();
    episodesMap.set(currentVideoId, metadata);
    updateSeriesControls(metadata);
    updateEpisodeHighlight(currentVideoId);

    if (metadata.type === 'SERIES' && metadata.seriesId) {
        ensureEpisodesLoaded();
    }

    const resumeAt = await loadVideoProgress(currentVideoId);
    resumePosition = resumeAt;

    const handleLoadedMetadata = () => {
        updateTimelineDisplay();
        if (resumePosition > 0 && resumePosition < videoElement.duration) {
            try {
                videoElement.currentTime = resumePosition;
            } catch (error) {
                console.warn('Unable to set resume position', error);
            }
        }
    };

    if (videoElement.readyState >= 1) {
        handleLoadedMetadata();
    } else {
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    }
}

function initializeState() {
    const likedFlag = bodyElement?.dataset?.liked === 'true';
    updateLikePresentation(likedFlag);
}

async function initializeItemPage() {
    if (!ensureProfileSelected()) {
        return;
    }

    setupSignOut();
    initializeState();

    if (likeButton) {
        likeButton.addEventListener('click', toggleLike);
    }

    try {
        await initializeVideoPlayer();
    } catch (error) {
        console.error('Failed to initialize video player', error);
    }
}

document.addEventListener('DOMContentLoaded', initializeItemPage);
