// Local storage functionality
let tracks = [];
let albumInfo = {};
let musicVideos = [];
let singlesViewActive = false;
// columnPositions is no longer needed for drag mode, but updateArtistHeader still uses a .draggable class that allows for relative positioning.
// The left values are calculated dynamically in updateArtistHeader, so no need to store or load them from here.
// The padding values were only relevant for vertical dragging which is removed.
// We'll retain columnPositions as an empty object for compatibility if some stray code tries to access it,
// but it won't hold persistent drag data.
let columnPositions = {};

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Helper function to apply album data and re-render the UI
function _loadAlbumData(albumData) {
    tracks = JSON.parse(JSON.stringify(albumData.tracks || config.defaultTracks.map(track => ({...track, lyrics: ''}))));
    tracks.forEach(track => {
        if (!track.hasOwnProperty('lyrics')) {
            track.lyrics = '';
        }
        if (!track.hasOwnProperty('trackId')) {
            track.trackId = generateUniqueId();
        }
    });
    musicVideos = JSON.parse(JSON.stringify(albumData.musicVideos || []));
    musicVideos.forEach(video => {
        // Ensure both videoMode and singleMode thumbnail URLs exist
        if (!video.thumbnailUrl_videoMode) {
            video.thumbnailUrl_videoMode = video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
        }
        if (!video.thumbnailUrl_singleMode) {
            video.thumbnailUrl_singleMode = video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
        }
        // Ensure singleMode specific properties exist
        if (!video.hasOwnProperty('singleMode_thumbnailFit')) {
            video.singleMode_thumbnailFit = 'cover';
        }
        if (!video.hasOwnProperty('singleMode_aspectRatio')) {
            video.singleMode_aspectRatio = '16:9';
        }
        // Ensure videoMode_thumbnailFit exists
        if (!video.hasOwnProperty('videoMode_thumbnailFit')) {
            video.videoMode_thumbnailFit = 'cover';
        }
        // Remove the old generic thumbnailUrl as it's replaced by two specific ones
        delete video.thumbnailUrl;
    });

    albumInfo = JSON.parse(JSON.stringify(albumData.albumInfo || config.defaultAlbumInfo));
    // Load plannerScenes if present so generated/uploaded scenes persist
    try {
        plannerScenes = JSON.parse(JSON.stringify(albumData.plannerScenes || []));
    } catch (e) {
        plannerScenes = albumData.plannerScenes || [];
    }

    // columnPositions no longer loaded or applied here as edit/drag mode is removed.

    // Ensure any existing inline styles (from previous drag mode) are cleared
    document.querySelectorAll('#trackList th .draggable, #trackList tbody tr td').forEach(el => {
        el.style.left = '';
        el.style.position = ''; 
    });
    document.querySelectorAll('#trackList th').forEach(th => {
        th.style.paddingBottom = ''; 
        th.style.paddingTop = ''; 
    });
    document.querySelectorAll('#trackList tbody tr').forEach(row => {
        Array.from(row.cells).forEach(cell => {
            cell.style.paddingTop = ''; 
            cell.style.paddingBottom = ''; 
        });
    });

    // Save the new state to local storage for the current working album
    saveToLocalStorage();

    // Re-render everything
    renderTracks();
    renderAlbumInfo();
    renderMusicVideos();
    updateArtistHeader(); // Re-align artist header
    updateAlbumCoverStyle(); // Ensure cover style is correct after loading
    updateNowPlaying(); // Ensure now playing displays correct album info
}

function loadFromLocalStorage() {
    // This function now specifically loads the *currently active editing album* state
    // It no longer manages the list of saved albums in the Library.

    const storedTracks = localStorage.getItem('tracks');
    if (storedTracks) {
        tracks = JSON.parse(storedTracks);
        // Ensure tracks have lyrics property
        tracks.forEach(track => {
            if (!track.hasOwnProperty('lyrics')) {
                track.lyrics = '';
            }
            if (!track.hasOwnProperty('trackId')) {
                track.trackId = generateUniqueId();
            }
        });
    } else {
        // Default tracks if nothing is stored
        tracks = config.defaultTracks.map(track => ({
            ...track,
            lyrics: '',
            trackId: generateUniqueId()
        }));
    }

    const storedAlbumInfo = localStorage.getItem('albumInfo');
    if (storedAlbumInfo) {
        albumInfo = JSON.parse(storedAlbumInfo);
    } else {
        albumInfo = config.defaultAlbumInfo;
    }

    // Load album cover dimensions
    const savedDimensions = localStorage.getItem('albumCoverDimensions');
    if (savedDimensions) {
        const { width, height } = JSON.parse(savedDimensions);
        const albumCover = document.getElementById('albumCover');
        albumCover.style.width = `${width}px`;
        albumCover.style.height = `${height}px`;
    }

    const storedMusicVideos = localStorage.getItem('musicVideos');
    if (storedMusicVideos) {
        musicVideos = JSON.parse(storedMusicVideos);
        // Ensure new properties are initialized for existing data
        musicVideos.forEach(video => {
            if (!video.thumbnailUrl_videoMode) {
                video.thumbnailUrl_videoMode = video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
            }
            if (!video.thumbnailUrl_singleMode) {
                video.thumbnailUrl_singleMode = video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
            }
            if (!video.hasOwnProperty('singleMode_thumbnailFit')) {
                video.singleMode_thumbnailFit = 'cover';
            }
            if (!video.hasOwnProperty('singleMode_aspectRatio')) {
                video.singleMode_aspectRatio = '16:9';
            }
            // Ensure videoMode_thumbnailFit exists
            if (!video.hasOwnProperty('videoMode_thumbnailFit')) {
                video.videoMode_thumbnailFit = 'cover';
            }
            delete video.thumbnailUrl; // Clean up old property
        });
    } else {
        musicVideos = config.defaultMusicVideos.map(video => {
            const newVideo = {
                ...video,
                thumbnailUrl_videoMode: video.thumbnailUrl_videoMode || video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg",
                thumbnailUrl_singleMode: video.thumbnailUrl_singleMode || video.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg",
                videoMode_thumbnailFit: video.videoMode_thumbnailFit || 'cover', // NEW
                singleMode_thumbnailFit: video.singleMode_thumbnailFit || 'cover',
                singleMode_aspectRatio: video.singleMode_aspectRatio || '16:9',
            };
            delete newVideo.thumbnailUrl; // Ensure old property is removed from defaults
            return newVideo;
        });
    }
    
    singlesViewActive = localStorage.getItem('singlesViewActive') === 'true';

    // Apply singles view state to UI immediately so the mode persists across reloads
    try {
        // Ensure the variable exists and UI helper is available
        if (typeof singlesViewActive !== 'undefined') {
            // update header text and rendering if functions exist
            if (typeof updateSinglesViewHeader === 'function') {
                updateSinglesViewHeader();
            }
            if (typeof renderMusicVideos === 'function') {
                renderMusicVideos();
            }
        }
    } catch (e) {
        console.warn('Error applying singlesViewActive state on load:', e);
    }

    const musicVideosContainer = document.querySelector('.music-videos-container');
    const wasCollapsed = localStorage.getItem('musicVideosCollapsed') === 'true';
    if (musicVideosContainer) {
        if (wasCollapsed) {
            musicVideosContainer.classList.add('collapsed');
        } else {
            musicVideosContainer.classList.remove('collapsed');
        }
    }
}

function saveToLocalStorage() {
    // This function now specifically saves the *currently active editing album* state.
    localStorage.setItem('tracks', JSON.stringify(tracks));
    localStorage.setItem('albumInfo', JSON.stringify(albumInfo));
    localStorage.setItem('musicVideos', JSON.stringify(musicVideos));
    localStorage.setItem('singlesViewActive', singlesViewActive);
    // Persist plannerScenes so AI/uploaded scenes survive reload
    try {
        localStorage.setItem('plannerScenes', JSON.stringify(plannerScenes || []));
    } catch (e) {
        console.warn('Failed to persist plannerScenes:', e);
    }
}

async function saveAlbum() {
    const albumName = albumInfo.title ? albumInfo.title.trim() : 'Unnamed Album';

    if (albumName === '') {
        alert("Album title cannot be empty. Please enter a title before saving.");
        return;
    }

    try {
        const albumDataToSave = {
            tracks: tracks,
            albumInfo: albumInfo,
            musicVideos: musicVideos
        };

        const albums = typeof getLibraryAlbums === 'function' ? getLibraryAlbums() : [];
        const now = new Date().toISOString();
        const normalizedName = albumName.toLowerCase();
        const existing = albums.find(album => (album.album_name || '').toLowerCase() === normalizedName);
        if (existing) {
            existing.album_name = albumName;
            existing.album_data = albumDataToSave;
            existing.updated_at = now;
        } else {
            albums.push({
                id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                album_name: albumName,
                album_data: albumDataToSave,
                isFavorited: false,
                created_at: now,
                updated_at: now
            });
        }
        if (typeof setLibraryAlbums === 'function') setLibraryAlbums(albums);
        localStorage.setItem('vaultTracklistAlbum', JSON.stringify(albumDataToSave));
        localStorage.setItem(`vaultTracklistAlbum_${albumName}`, JSON.stringify(albumDataToSave));
        saveToLocalStorage();
        if (typeof loadLibraryAlbums === 'function' && document.getElementById('libraryPage')?.style.display !== 'none') {
            loadLibraryAlbums();
        }
        alert(`Album "${albumName}" saved on this device.`);

    } catch (error) {
        console.error('Error saving album:', error);
        alert('Failed to save album on this device. Please try again.');
    }
}

function clearAlbum() {
    // Reset the album cover URL
    albumInfo.coverUrl = ""; // This ensures default image is set consistently
    
    const defaultAlbumData = {
        tracks: config.defaultTracks.map(track => ({ ...track, lyrics: '' })), // Ensure lyrics property
        albumInfo: config.defaultAlbumInfo,
        musicVideos: config.defaultMusicVideos.map(video => { // Map default music videos to new structure
            const newVideo = { ...video };
            if (!newVideo.thumbnailUrl_videoMode) newVideo.thumbnailUrl_videoMode = newVideo.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
            if (!newVideo.thumbnailUrl_singleMode) newVideo.thumbnailUrl_singleMode = newVideo.thumbnailUrl || "white-screen-background-sw1bnff9381f1zrq.jpg";
            if (!newVideo.hasOwnProperty('singleMode_thumbnailFit')) newVideo.singleMode_thumbnailFit = 'cover';
            if (!newVideo.hasOwnProperty('singleMode_aspectRatio')) newVideo.singleMode_aspectRatio = '16:9';
            if (!newVideo.hasOwnProperty('videoMode_thumbnailFit')) newVideo.videoMode_thumbnailFit = 'cover'; // NEW
            delete newVideo.thumbnailUrl; // Remove old property
            return newVideo;
        })
        // columnPositions no longer used for defaults.
    };
    _loadAlbumData(defaultAlbumData); // Call the new helper function with default data

    // Reset album cover dimensions in localStorage and style
    localStorage.removeItem('albumCoverDimensions');
    const albumCover = document.getElementById('albumCover');
    albumCover.style.backgroundImage = `url('default_itunes.png')`; // Ensure default image is set

    // Reset the content of editable text elements to their placeholders or empty
    document.querySelector('.album-header h1.editable').textContent = albumInfo.title;
    document.querySelector('.album-header p:nth-child(2).editable').textContent = albumInfo.artist;
    document.querySelector('.album-header .genre-year span:first-child.editable').textContent = albumInfo.genre;
    document.querySelector('.album-header .genre-year span:last-child.editable').textContent = albumInfo.year;
    document.querySelector('.editors-notes p.editable').textContent = albumInfo.editorNotes;
    document.querySelector('.album-info p:nth-child(1) span.editable').textContent = albumInfo.releaseDate;
    document.querySelector('.album-info p:nth-child(2) span.editable').textContent = albumInfo.label;
    document.getElementById('trackCountDisplay').textContent = '0 Songs, 0 Minutes'; // Reset track count

    // Ensure singles view is off when clearing album
    singlesViewActive = false;
    localStorage.setItem('singlesViewActive', 'false');
    updateSinglesViewHeader(); // Update the header text
    renderMusicVideos(); // Re-render to show video mode

    alert("Album cleared to default settings.");
}
