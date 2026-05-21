// Music videos functionality
function renderMusicVideos() {
    const musicVideosGrid = document.getElementById('musicVideosGrid');
    musicVideosGrid.innerHTML = ''; // Clear existing grid content

    musicVideos.forEach((video, index) => {
        const videoItem = createMusicVideoElement(video, index);
        musicVideosGrid.appendChild(videoItem);
    });
}

function createMusicVideoElement(video, index) {
    const videoItem = document.createElement('div');
    videoItem.className = 'music-video-item';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'file-input';
    fileInput.id = `musicVideoThumbnail${index}`;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (event) => handleVideoThumbnailUpload(index, event));

    const youtubeInput = document.createElement('input');
    youtubeInput.type = 'text';
    youtubeInput.placeholder = 'YouTube Video ID';
    youtubeInput.className = 'youtube-input';
    youtubeInput.style.display = 'none';
    youtubeInput.addEventListener('change', (event) => handleYouTubeVideoId(index, event));

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'music-video-thumbnail-container';

    const img = document.createElement('img');
    img.alt = `${video.title} Music Video`;

    // Determine which thumbnail and fit/ratio properties to use based on mode
    let currentThumbnailUrl, currentThumbnailFit, currentAspectRatio;

    if (singlesViewActive) {
        currentThumbnailUrl = video.thumbnailUrl_singleMode;
        currentThumbnailFit = video.singleMode_thumbnailFit;
        currentAspectRatio = video.singleMode_aspectRatio;
    } else {
        currentThumbnailUrl = video.thumbnailUrl_videoMode;
        currentThumbnailFit = video.videoMode_thumbnailFit; // Use videoMode_thumbnailFit for video mode
        currentAspectRatio = '16:9'; // Video mode always 16:9
    }

    img.src = currentThumbnailUrl;

    // Apply aspect ratio
    if (currentAspectRatio === '1:1') {
        thumbnailContainer.classList.add('square-ratio');
    } else {
        thumbnailContainer.classList.remove('square-ratio');
    }

    // Apply fit (zoomed-out effect)
    if (currentThumbnailFit === 'contain') {
        thumbnailContainer.classList.add('zoomed-out');
        // Set CSS variable for the background image, used by ::before pseudo-element
        thumbnailContainer.style.setProperty('--thumbnail-url', `url('${currentThumbnailUrl}')`);
        // Also set directly for broader compatibility for the container itself
        thumbnailContainer.style.backgroundImage = `var(--thumbnail-url)`;
    } else {
        thumbnailContainer.classList.remove('zoomed-out');
        thumbnailContainer.style.backgroundImage = 'none'; // Clear pseudo-element background if not zoomed
    }

    if (singlesViewActive) {
        // In singles mode, clicking the container plays the song.
        thumbnailContainer.style.cursor = 'pointer';
        thumbnailContainer.onclick = () => playSingleFromVideo(video.title);

        const playOverlay = document.createElement('div');
        playOverlay.className = 'play-overlay';

        const playButtonIconContainer = document.createElement('div');
        playButtonIconContainer.className = 'play-button-icon';

        playOverlay.appendChild(playButtonIconContainer);
        thumbnailContainer.appendChild(playOverlay);
    } else {
        // In music video mode, clicking the image opens YouTube.
        img.addEventListener('click', () => openYouTubeVideo(video.videoId));
    }

    thumbnailContainer.appendChild(img);

    const titlePara = document.createElement('p');
    titlePara.className = 'editable';
    titlePara.contentEditable = true;
    titlePara.addEventListener('input', () => updateMusicVideoInfo(index, 'title', titlePara.textContent));

    const titleText = document.createTextNode(video.title);
    titlePara.appendChild(titleText);

    // Add explicit symbol with conditional text
    const explicitSymbol = document.createElement('span');
    explicitSymbol.className = 'music-video-explicit';
    explicitSymbol.textContent = video.explicit ? '🅴' : '';
    titlePara.appendChild(explicitSymbol);

    const artistPara = document.createElement('p');
    artistPara.textContent = video.artist;
    artistPara.className = 'editable';
    artistPara.contentEditable = true;
    artistPara.addEventListener('input', () => updateMusicVideoInfo(index, 'artist', artistPara.textContent));

    const actionButton = document.createElement('button');
    actionButton.textContent = '';
    actionButton.className = 'music-video-action';
    actionButton.addEventListener('click', (event) => toggleMusicVideoMenu(event, index));

    const menuContainer = document.createElement('div');
    menuContainer.className = 'music-video-dropdown';
    
    let menuHtml = `
        <a href="#" onclick="document.getElementById('musicVideoThumbnail${index}').click()">Change Thumbnail</a>
        <a href="#" onclick="removeThumbnail(${index})">Remove Thumbnail</a>
        <a href="#" onclick="document.querySelector('#musicVideoThumbnail${index}').nextElementSibling.style.display='block'">Add YouTube Link</a>
        <a href="#" onclick="removeYouTubeLink(${index})">Remove YouTube Link</a>
        <a href="#" onclick="toggleThumbnailZoom(${index})">Toggle Thumbnail Fit</a>
        ${singlesViewActive ? `<a href="#" onclick="toggleAspectRatio(${index})">Toggle Ratio</a>` : ''}
        <a href="#" onclick="removeMusicVideo(${index})">Remove Music Video</a>
        <a href="#" onclick="toggleMusicVideoExplicit(${index})">Toggle Explicit</a>
    `;
    menuContainer.innerHTML = menuHtml;

    // Modify the order of elements
    videoItem.appendChild(fileInput);
    videoItem.appendChild(youtubeInput);
    videoItem.appendChild(thumbnailContainer);
    
    // Add title and artist before action button and menu
    videoItem.appendChild(titlePara);
    videoItem.appendChild(artistPara);
    
    // Add action button and menu at the end
    videoItem.appendChild(actionButton);
    videoItem.appendChild(menuContainer);

    return videoItem;
}

function addMusicVideo() {
    const defaultVideo = {
        title: "New Music Video",
        artist: "Artist Name",
        videoId: "",
        thumbnailUrl_videoMode: "white-screen-background-sw1bnff9381f1zrq.jpg", // Default for video mode
        thumbnailUrl_singleMode: "white-screen-background-sw1bnff9381f1zrq.jpg", // Default for single mode
        explicit: false,
        videoMode_thumbnailFit: 'cover', // Default fit state for video mode
        singleMode_thumbnailFit: 'cover', // Default fit state for singles mode
        singleMode_aspectRatio: '16:9' // Default aspect ratio for singles mode
    };

    musicVideos.push(defaultVideo);
    renderMusicVideos();
    saveToLocalStorage();
}

function removeMusicVideo(index) {
    if (musicVideos.length > 0) { // Allow removing the last one now
        musicVideos.splice(index, 1);
        renderMusicVideos();
        saveToLocalStorage();
    }
}

// Remove all music videos after user confirmation
function removeAllMusicVideos() {
    if (!musicVideos || musicVideos.length === 0) {
        if (window.showCustomAlert) {
            window.showCustomAlert('There are no music videos to remove.', 'No videos');
        } else {
            alert('There are no music videos to remove.');
        }
        return;
    }

    // Use custom confirm modal if available
    const confirmPromise = window.showCustomConfirm ? 
        window.showCustomConfirm('Remove ALL music videos for this album? This cannot be undone.', 'Confirm removal') :
        Promise.resolve(confirm('Remove ALL music videos for this album? This cannot be undone.'));

    confirmPromise.then(confirmed => {
        if (!confirmed) return;
        musicVideos = [];
        renderMusicVideos();
        saveToLocalStorage();
        if (window.showCustomAlert) {
            window.showCustomAlert('All music videos have been removed.', 'Removed');
        } else {
            alert('All music videos have been removed.');
        }
    }).catch(err => {
        console.error('removeAllMusicVideos confirm error:', err);
        // Fallback synchronous confirm
        try {
            if (confirm('Remove ALL music videos for this album? This cannot be undone.')) {
                musicVideos = [];
                renderMusicVideos();
                saveToLocalStorage();
                alert('All music videos have been removed.');
            }
        } catch (e) {
            console.warn('Fallback confirm failed', e);
        }
    });
}

// NEW: Function to toggle aspect ratio
function toggleAspectRatio(index) {
    if (!singlesViewActive) {
        alert("Toggle Ratio is only available in Singles mode.");
        return;
    }
    const video = musicVideos[index];
    if (video) {
        // Toggle the aspect ratio property, handling undefined for older data
        video.singleMode_aspectRatio = (video.singleMode_aspectRatio === '1:1') ? '16:9' : '1:1';
        renderMusicVideos();
        saveToLocalStorage();
    }
}

async function handleVideoThumbnailUpload(index, event) {
    const file = event.target.files[0];
    if (file) {
        try {
            // preserve original filename for traceability
            const originalName = file.name;
            // Upload the file to get a permanent URL instead of using base64
            const thumbnailUrl = await window.vaultLocalUpload(file);

            console.info(`Video thumbnail upload: original filename="${originalName}" -> uploaded URL="${thumbnailUrl}"`);

            if (singlesViewActive) {
                musicVideos[index].thumbnailUrl_singleMode = thumbnailUrl;
                musicVideos[index].originalThumbnailName_singleMode = originalName;
            } else {
                musicVideos[index].thumbnailUrl_videoMode = thumbnailUrl;
                musicVideos[index].originalThumbnailName_videoMode = originalName;
            }
            renderMusicVideos();
            saveToLocalStorage();
        } catch (error) {
            console.error('Error uploading video thumbnail:', error);
            alert('Failed to upload video thumbnail. Please try again.');
        }
    }
}

function handleYouTubeVideoId(index, event) {
    const videoId = event.target.value.trim();
    musicVideos[index].videoId = videoId;
    renderMusicVideos();
    saveToLocalStorage();
    event.target.style.display = 'none';
}

function openYouTubeVideo(videoId) {
    if (videoId) {
        // Ensure the video ID is a full YouTube URL if it's not already
        let url = videoId;
        if (!videoId.startsWith('http')) {
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }
        window.open(url, '_blank');
    }
}

function updateMusicVideoInfo(index, field, value) {
    musicVideos[index][field] = value;
    saveToLocalStorage();
}

function toggleMusicVideoExplicit(index) {
    musicVideos[index].explicit = !musicVideos[index].explicit;
    renderMusicVideos(); // Re-render the entire music videos grid
    saveToLocalStorage();
}

function toggleThumbnailZoom(index) {
    const video = musicVideos[index];
    if (video) {
        if (singlesViewActive) {
            // Toggle for singles mode
            video.singleMode_thumbnailFit = video.singleMode_thumbnailFit === 'cover' ? 'contain' : 'cover';
        } else {
            // Toggle for video mode
            video.videoMode_thumbnailFit = video.videoMode_thumbnailFit === 'cover' ? 'contain' : 'cover';
        }
        renderMusicVideos();
        saveToLocalStorage();
    }
}

function toggleMusicVideoMenu(event, index) {
    event.stopPropagation();
    const dropdown = event.target.parentElement.querySelector('.music-video-dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function removeThumbnail(index) {
    // Reset to the default thumbnail based on the current mode
    if (singlesViewActive) {
        musicVideos[index].thumbnailUrl_singleMode = "white-screen-background-sw1bnff9381f1zrq.jpg";
        musicVideos[index].singleMode_thumbnailFit = 'cover'; // Reset fit when removing
        musicVideos[index].singleMode_aspectRatio = '16:9'; // Reset ratio when removing
    } else {
        musicVideos[index].thumbnailUrl_videoMode = "white-screen-background-sw1bnff9381f1zrq.jpg";
        musicVideos[index].videoMode_thumbnailFit = 'cover'; // Reset fit for video mode
    }
    renderMusicVideos();
    saveToLocalStorage();
}

function removeYouTubeLink(index) {
    // Clear the YouTube video ID
    musicVideos[index].videoId = "";
    renderMusicVideos();
    saveToLocalStorage();
}

function playSingleFromVideo(videoTitle) {
    if (!videoTitle) return;

    const normalizedVideoTitle = videoTitle.trim().toLowerCase();
    const trackToPlay = tracks.find(track => track.title.trim().toLowerCase() === normalizedVideoTitle);

    if (trackToPlay && trackToPlay.audioUrl) {
        const trackIndex = tracks.indexOf(trackToPlay);
        playTrack(trackIndex);
    } else if (trackToPlay && !trackToPlay.audioUrl) {
        alert(`Song "${videoTitle}" found in tracklist, but no audio is attached.`);
    } else {
        alert(`Song "${videoTitle}" not found in the tracklist.`);
    }
}

function toggleSinglesView() {
    singlesViewActive = !singlesViewActive; // Toggle the state FIRST

    // When turning singles mode ON, default all videos to 1:1 aspect for single mode
    if (singlesViewActive) {
        musicVideos.forEach(video => {
            video.singleMode_aspectRatio = '1:1';
            if (!video.hasOwnProperty('singleMode_thumbnailFit')) {
                video.singleMode_thumbnailFit = 'cover';
            }
        });
    } else {
        // Optionally leave existing ratios intact when turning off, but ensure save
    }

    updateSinglesViewHeader();
    renderMusicVideos(); // Re-render to apply new mode and thumbnail/ratio
    saveToLocalStorage();
}