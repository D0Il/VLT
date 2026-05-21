// Audio player functionality
let currentPlayingIndex = -1;
let isPlaying = false;
let audio = new Audio();
let isExpandedVolumeSliderVisible = false; // New: To track volume slider visibility

// AudioContext and Analyser for visualizer data
let visualizerAudioContext = null;
let visualizerAnalyser = null;
let visualizerDataArray = null;
let visualizerAudioSource = null;

function initVisualizerAudioContext() {
    if (!visualizerAudioContext) {
        visualizerAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        visualizerAnalyser = visualizerAudioContext.createAnalyser();
        visualizerAnalyser.fftSize = 256;
        visualizerAnalyser.smoothingTimeConstant = 0.4;
        visualizerDataArray = new Uint8Array(visualizerAnalyser.frequencyBinCount);

        // Connect the main audio element to the analyser
        visualizerAudioSource = visualizerAudioContext.createMediaElementSource(audio);
        visualizerAudioSource.connect(visualizerAnalyser);
        // Connect analyser back to destination so audio is still heard
        visualizerAnalyser.connect(visualizerAudioContext.destination);

        // Attempt to resume context immediately on user gesture (e.g., first play)
        if (visualizerAudioContext.state === 'suspended') {
            console.log('Player: AudioContext is suspended, attempting to resume...');
            visualizerAudioContext.resume().then(() => {
                console.log('Player: AudioContext resumed successfully for visualizer. State:', visualizerAudioContext.state);
            }).catch(e => console.error("Player: Error resuming audio context during init:", e));
        } else {
            console.log('Player: AudioContext is already running for visualizer. State:', visualizerAudioContext.state);
        }
    }
}

// Ensure audio context is initialized when the first track is loaded or played
audio.addEventListener('play', initVisualizerAudioContext);
audio.addEventListener('canplaythrough', initVisualizerAudioContext);

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function playTrack(index) {
    const shuffleButton = document.getElementById('shuffleButton');
    
    // Reset shuffle mode when playing a specific track
    shuffleButton.setAttribute('data-shuffle-mode', 'false');
    shuffleButton.style.color = '#007aff';
    
    if (tracks[index].audioUrl) {
        audio.onerror = function(error) {
            console.error("Player: Audio playback error:", error);
            alert("Error playing audio. Ensure the file is valid.");
        };
        // Set crossOrigin for audio analysis BEFORE setting src
        audio.crossOrigin = "anonymous";
        audio.src = tracks[index].audioUrl;
        audio.onloadedmetadata = function() {
            console.log("Player: Audio metadata loaded successfully.");
        };
        
        if (currentPlayingIndex === index && isPlaying) {
            audio.pause();
            isPlaying = false;
        } else {
            // Ensure context is running before playing
            if (visualizerAudioContext && visualizerAudioContext.state === 'suspended') {
                visualizerAudioContext.resume().then(() => {
                    console.log('Player: AudioContext resumed for visualizer');
                    audio.play();
                }).catch(e => console.error("Player: Error resuming audio context:", e));
            } else {
                audio.play();
            }
            currentPlayingIndex = index;
            isPlaying = true;
        }
        updatePlayPauseButton();
        updateNowPlaying();
        
        // Update player views if open
        updatePlayerModalContent();
        
        // Ensure initial state is sent to visualizer immediately after play state changes
        syncVisualizerStateAndData();
    } else {
        alert('No audio file assigned to this track. Please import an audio file first.');
    }
}

function togglePlayPause() {
    if (currentPlayingIndex !== -1) {
        if (isPlaying) {
            audio.pause();
        } else {
            // Ensure context is running before playing
            if (visualizerAudioContext && visualizerAudioContext.state === 'suspended') {
                visualizerAudioContext.resume().then(() => {
                    console.log('Player: AudioContext resumed for visualizer');
                    audio.play();
                }).catch(e => console.error("Player: Error resuming audio context:", e));
            } else {
                audio.play();
            }
        }
        isPlaying = !isPlaying;
        updatePlayPauseButton();
    } else {
        // If no track is selected, play the first visible track
        const visibleTracks = tracks.filter(track => !track.hidden);
        if (visibleTracks.length > 0) {
            playTrack(tracks.indexOf(visibleTracks[0]));
        } else {
             alert('No tracks available to play.');
        }
    }

    // Sync with embedded visualizer after state has been updated
    syncVisualizerStateAndData();
}

function updatePlayPauseButton() {
    const playPauseButton = document.getElementById('playPauseButton');
    const expandedAlbumViewPlayPause = document.getElementById('expandedAlbumViewPlayPause');
    
    const buttonText = isPlaying ? '❚❚' : '▶';
    playPauseButton.textContent = buttonText;
    
    if (expandedAlbumViewPlayPause) {
        expandedAlbumViewPlayPause.textContent = buttonText;
    }
}

function updateNowPlaying() {
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');
    const nowPlayingArtist = document.getElementById('nowPlayingArtist');
    const nowPlayingAlbum = document.getElementById('nowPlayingAlbum');
    const nowPlayingCover = document.getElementById('nowPlayingCover');
    const nowPlayingOverlay = document.getElementById('nowPlayingOverlay'); // Get the overlay element

    if (!nowPlayingTitle || !nowPlayingArtist || !nowPlayingAlbum || !nowPlayingCover || !nowPlayingOverlay) {
        console.error("Player: Now playing UI elements not found.");
        return;
    }

    if (currentPlayingIndex !== -1 && tracks[currentPlayingIndex]) {
        const currentTrack = tracks[currentPlayingIndex];
        nowPlayingTitle.textContent = currentTrack.title;
        nowPlayingArtist.textContent = currentTrack.artist;
        nowPlayingCover.style.backgroundImage = `url('${albumInfo.coverUrl || 'default_itunes.png'}')`; // Use default if coverUrl is empty
        nowPlayingAlbum.textContent = albumInfo.title;
        
        // Ensure click handler is attached
        nowPlayingCover.style.cursor = 'pointer';
        // Assuming openPlayerModal is a global function defined in app.js
        if (typeof openPlayerModal === 'function') {
            nowPlayingCover.onclick = () => openPlayerModal('expanded');
        } else {
            console.warn("Player: openPlayerModal function not found.");
            nowPlayingCover.onclick = null;
        }

        // Hide the overlay when a song is playing
        nowPlayingOverlay.style.display = 'none';
        
        // Update expanded album view if open
        updateExpandedAlbumViewInfo();

        // Sync with visualizer when the "Now Playing" info updates
        syncVisualizerStateAndData();
    } else {
        nowPlayingTitle.textContent = '';
        nowPlayingArtist.textContent = '';
        nowPlayingAlbum.textContent = albumInfo.title || 'Album Name'; // Show current album title or placeholder
        nowPlayingCover.style.backgroundImage = ''; // Clear cover image
        nowPlayingCover.style.cursor = 'default';
        nowPlayingCover.onclick = null;

        // Show the overlay when no song is playing
        nowPlayingOverlay.style.display = 'block';
        
        // Update expanded album view if open
        updateExpandedAlbumViewInfo();
    }
}

function previousTrack() {
    // Filter out hidden tracks to only include visible tracks
    const visibleTracks = tracks.filter(track => !track.hidden);

    // Check if there are any visible tracks and if a track is currently playing
    if (visibleTracks.length === 0 || currentPlayingIndex === -1) {
        return; // Cannot go back if no visible tracks or no track is playing
    }

    // Find the index of the current track in visible tracks
    const visibleIndex = visibleTracks.findIndex(track => tracks[currentPlayingIndex] === track);

    // Determine the previous track index in the visible tracks list
    // Wrap around to the last track if currently playing the first visible track
    const prevVisibleIndex = (visibleIndex - 1 + visibleTracks.length) % visibleTracks.length;

    // Get the actual index of the previous track in the original 'tracks' array
    const prevTrackIndex = tracks.indexOf(visibleTracks[prevVisibleIndex]);

    // Play the previous track
    playTrack(prevTrackIndex);
}

function nextTrack() {
    const shuffleButton = document.getElementById('shuffleButton');
    const isShuffleActive = shuffleButton.getAttribute('data-shuffle-mode') === 'true';
    
    const visibleTracks = tracks.filter(track => !track.hidden);

     if (visibleTracks.length === 0) {
          alert('No visible tracks available.');
          return;
     }

    if (isShuffleActive) {
        playRandomTrack();
    } else {
        if (currentPlayingIndex === -1) {
            // If no track is playing, start from the first visible track
            playTrack(tracks.indexOf(visibleTracks[0]));
        } else {
            // Find the index of the current track in visible tracks
            const visibleIndex = visibleTracks.findIndex(track => tracks[currentPlayingIndex] === track);
            
            // Determine the next track index in the visible tracks list
            // Wrap around to the first track if currently playing the last visible track
            const nextVisibleIndex = (visibleIndex + 1) % visibleTracks.length;
            const nextTrackIndex = tracks.indexOf(visibleTracks[nextVisibleIndex]);
            
            playTrack(nextTrackIndex);
        }
    }
}

function playRandomTrack() {
    // Filter out hidden tracks to only include visible tracks
    const visibleTracks = tracks.filter(track => !track.hidden);

    // Check if there are any visible tracks
    if (visibleTracks.length === 0) {
        alert('No visible tracks available to play.');
        return;
    }

    // Generate a random index within the range of visible tracks
    const randomIndex = Math.floor(Math.random() * visibleTracks.length);

    // Get the actual index of the randomly selected track in the original 'tracks' array
    const randomTrackIndex = tracks.indexOf(visibleTracks[randomIndex]);

    // Play the randomly selected track
    playTrack(randomTrackIndex);
}

function updateVolume(value) {
    audio.volume = value / 100;
    // Update main toolbar volume slider background
    const mainVolumeSlider = document.querySelector('.toolbar .volume-control input[type="range"]');
    if (mainVolumeSlider) {
        // The main toolbar slider has a solid background, no dynamic gradient fill needed
        // The thumb color is handled by CSS
    }

    // Update expanded album view volume slider background
    const expandedVolumeSlider = document.querySelector('#expandedVolumeSliderContainer input[type="range"]');
    if (expandedVolumeSlider) {
        updateExpandedVolumeSliderBackground(expandedVolumeSlider);
    }
}

// Function to update the background of the expanded album view volume slider
function updateExpandedVolumeSliderBackground(slider) {
    const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.background = `linear-gradient(to right, #007aff 0%, #007aff ${value}%, #ccc ${value}%, #ccc 100%)`;
}

// New: Toggle visibility of the expanded album view volume slider
function toggleExpandedVolumeSlider(event) {
    if (event) {
        event.stopPropagation(); // Prevent immediate closing due to document click listener
    }
    const sliderContainer = document.getElementById('expandedVolumeSliderContainer');
    if (!sliderContainer) return;

    isExpandedVolumeSliderVisible = !isExpandedVolumeSliderVisible;

    if (isExpandedVolumeSliderVisible) {
        sliderContainer.classList.add('active');
        // Set the initial slider value to the current audio volume
        const volumeSlider = sliderContainer.querySelector('input[type="range"]');
        if (volumeSlider) {
            volumeSlider.value = audio.volume * 100;
            updateExpandedVolumeSliderBackground(volumeSlider); // Update background gradient on toggle
        }
    } else {
        sliderContainer.classList.remove('active');
    }
}

// Set up audio event listeners
audio.addEventListener('timeupdate', function() {
    const progress = (audio.currentTime / audio.duration) * 100;
    const progressBar = document.getElementById('progressBar');
    const currentTime = document.getElementById('currentTime');

    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    if (currentTime) {
         currentTime.textContent = formatTime(audio.currentTime);
    }

    // Update expanded album view if open
    const expandedAlbumViewProgressBar = document.getElementById('expandedAlbumViewProgressBar');
    const expandedAlbumViewCurrentTime = document.getElementById('expandedAlbumViewCurrentTime');
    if (expandedAlbumViewProgressBar) {
        expandedAlbumViewProgressBar.style.width = `${progress}%`;
    }
    if (expandedAlbumViewCurrentTime) {
        expandedAlbumViewCurrentTime.textContent = formatTime(audio.currentTime);
    }

    // Sync time and audio data with embedded visualizer on every frame
    syncVisualizerStateAndData();
});

audio.addEventListener('loadedmetadata', function() {
    const totalTime = document.getElementById('totalTime');
    if (totalTime) {
        totalTime.textContent = formatTime(audio.duration);
    }
    
    // Update expanded album view total time if open
    const expandedAlbumViewTotalTime = document.getElementById('expandedAlbumViewTotalTime');
    if (expandedAlbumViewTotalTime) {
        expandedAlbumViewTotalTime.textContent = formatTime(audio.duration);
    }

    // Initialize the expanded volume slider background if it's there
    const expandedVolumeSlider = document.querySelector('#expandedVolumeSliderContainer input[type="range"]');
    if (expandedVolumeSlider) {
        updateExpandedVolumeSliderBackground(expandedVolumeSlider);
    }
});

audio.addEventListener('ended', function() {
    const shuffleButton = document.getElementById('shuffleButton');
    const isShuffleActive = shuffleButton.getAttribute('data-shuffle-mode') === 'true';
    
    if (isShuffleActive) {
        playRandomTrack();
    } else {
        nextTrack(); // Play the next visible track or loop back
    }
    
    // Update player modal content after track change
    updatePlayerModalContent();
    // Stop sending audio data if playback ended
    syncVisualizerStateAndData();
});

// Allow seeking through the track by clicking on the progress bar
document.getElementById('progressBarContainer').addEventListener('click', function(e) {
    const progressBar = this.getBoundingClientRect();
    // Ensure click is within the progress bar width
    if (e.clientX >= progressBar.left && e.clientX <= progressBar.right) {
         const percent = (e.clientX - progressBar.left) / progressBar.width;
         if (audio.duration) {
             audio.currentTime = percent * audio.duration;
             // Sync seek is now handled by the 'timeupdate' event listener
         }
    }
});

function updatePlayerModalContent() {
    // Only update content if a player modal is currently active
    if (activePlayerModal === 'expanded' || activePlayerModal === 'toolbar') {
        updateUpNextList();
        loadTrackLyrics();
    }
    // Always update expanded view info regardless of its active status (for consistency)
    updateExpandedAlbumViewInfo();
}

function updateExpandedAlbumViewInfo() {
    const expandedAlbumViewAlbumCover = document.getElementById('expandedAlbumViewAlbumCover');
    const expandedAlbumViewTrackTitle = document.getElementById('expandedAlbumViewTrackTitle');
    const expandedAlbumViewTrackArtist = document.getElementById('expandedAlbumViewTrackArtist');
    const expandedAlbumViewTrackAlbum = document.getElementById('expandedAlbumViewTrackAlbum');
    const expandedAlbumViewPlayPause = document.getElementById('expandedAlbumViewPlayPause');

    if (!expandedAlbumViewAlbumCover || !expandedAlbumViewTrackTitle || !expandedAlbumViewTrackArtist || !expandedAlbumViewTrackAlbum || !expandedAlbumViewPlayPause) {
        // If elements are not found, the expanded album view is likely not open, so do nothing.
        return;
    }

    if (currentPlayingIndex !== -1 && tracks[currentPlayingIndex]) {
        const currentTrack = tracks[currentPlayingIndex];
        let coverUrl = '';
        if (albumInfo.coverUrl && albumInfo.coverUrl.trim() !== '') {
            coverUrl = albumInfo.coverUrl;
        } else {
            coverUrl = 'default_itunes.png';
        }

        expandedAlbumViewAlbumCover.style.backgroundImage = `url("${coverUrl}")`;
        expandedAlbumViewAlbumCover.style.backgroundSize = 'cover';
        expandedAlbumViewAlbumCover.style.backgroundPosition = 'center';
        expandedAlbumViewAlbumCover.style.backgroundRepeat = 'no-repeat';

        expandedAlbumViewTrackTitle.textContent = currentTrack.title;
        expandedAlbumViewTrackArtist.textContent = currentTrack.artist;
        expandedAlbumViewTrackAlbum.textContent = albumInfo.title;

        const buttonText = isPlaying ? '❚❚' : '▶';
        expandedAlbumViewPlayPause.textContent = buttonText;
    } else {
        expandedAlbumViewAlbumCover.style.backgroundImage = `url("default_itunes.png")`;
        expandedAlbumViewAlbumCover.style.backgroundSize = 'cover';
        expandedAlbumViewAlbumCover.style.backgroundPosition = 'center';
        expandedAlbumViewAlbumCover.style.backgroundRepeat = 'no-repeat';
        expandedAlbumViewTrackTitle.textContent = 'No Track Playing';
        expandedAlbumViewTrackArtist.textContent = '';
        expandedAlbumViewTrackAlbum.textContent = '';

        expandedAlbumViewPlayPause.textContent = '▶';
    }
}

function updateUpNextList() {
    const sharedUpNextList = document.getElementById('sharedUpNextList');
    if (!sharedUpNextList) return;

    sharedUpNextList.innerHTML = '';

    if (currentPlayingIndex === -1) {
        sharedUpNextList.innerHTML = '<div class="no-tracks" style="text-align: center; color: #666; font-size: 14px; padding: 20px;">No tracks in queue</div>';
        return;
    }

    const visibleTracks = tracks.filter(track => !track.hidden);
    const currentVisibleIndex = visibleTracks.findIndex(track => tracks[currentPlayingIndex] === track);

    // If the current track is the last visible track, there are no upcoming tracks
    if (currentVisibleIndex === visibleTracks.length - 1 && !document.getElementById('shuffleButton').getAttribute('data-shuffle-mode') === 'true') {
         sharedUpNextList.innerHTML = '<div class="no-tracks" style="text-align: center; color: #666; font-size: 14px; padding: 20px;">No tracks up next</div>';
         return;
    }

    const upcomingTracks = [];
    const totalVisibleTracks = visibleTracks.length;

    // Populate upcoming tracks, wrapping around if not in shuffle mode
    if (document.getElementById('shuffleButton').getAttribute('data-shuffle-mode') === 'true') {
         // In shuffle mode, there's no predictable "up next" list from the sequence
         // We could show the rest of the shuffled list if we stored it,
         // but for simplicity, we'll just indicate shuffle is active.
         sharedUpNextList.innerHTML = '<div class="no-tracks" style="text-align: center; color: #666; font-size: 14px; padding: 20px;">Shuffle is active</div>';
         return;
    } else {
        for (let i = 1; i <= totalVisibleTracks; i++) {
             const nextVisibleIndex = (currentVisibleIndex + i) % totalVisibleTracks;
             upcomingTracks.push(visibleTracks[nextVisibleIndex]);
        }
         // The first item in upcomingTracks will be the currently playing track itself,
         // and the last item will be the one before the currently playing one due to wrap around.
         // We only want the ones AFTER the current track.
         upcomingTracks.shift(); // Remove the currently playing track from the list
    }

    if (upcomingTracks.length === 0) {
        sharedUpNextList.innerHTML = '<div class="no-tracks" style="text-align: center; color: #666; font-size: 14px; padding: 20px;">No tracks up next</div>';
        return;
    }

    upcomingTracks.forEach((track) => {
        const trackIndex = tracks.indexOf(track); // Get the actual index

        const upNextItem = document.createElement('div');
        upNextItem.className = 'up-next-item';
        upNextItem.onclick = () => playTrack(trackIndex); // Play the actual track index

        let coverUrl = albumInfo.coverUrl?.trim() || 'default_itunes.png';

        upNextItem.innerHTML = `
            <div class="up-next-number" style="background-image: url('${coverUrl}')"></div>
            <div class="up-next-info">
                <div class="up-next-title">${track.title}</div>
                <div class="up-next-artist">${track.artist}</div>
            </div>
            <div class="up-next-time">${track.time}</div>
        `;

        sharedUpNextList.appendChild(upNextItem);
    });
    // Add the class for basic styling that matches the expanded view
    sharedUpNextList.classList.add('up-next-list');
}

function loadTrackLyrics() {
    const lyricsInput = document.getElementById('sharedLyricsInput');
    if (!lyricsInput) return;

    if (currentPlayingIndex !== -1 && tracks[currentPlayingIndex]) {
        const currentTrack = tracks[currentPlayingIndex];
        
        // If the album is public, check for lyrics in the subscribed data
        const publicAlbumRecord = currentQuickViewAlbumRecord; // This is set when quick view is opened
        
        if (publicAlbumRecord) {
            // This is a public album, check for lyrics in `currentPublicLyrics`
            const trackId = currentTrack.trackId;
            const publicLyricRecord = currentPublicLyrics.find(lyric => lyric.album_id === publicAlbumRecord.id && lyric.trackId === trackId);
            if (publicLyricRecord) {
                lyricsInput.value = publicLyricRecord.lyrics;
                lyricsInput.oninput = null; // Disable editing for public lyrics for now
                lyricsInput.readOnly = true; // Make textarea readonly
                return;
            }
        }

        // Fallback to local lyrics if not a public album or no public lyrics found
        lyricsInput.value = currentTrack.lyrics || '';
        lyricsInput.readOnly = false;
        lyricsInput.oninput = function() {
            if (currentPlayingIndex !== -1 && tracks[currentPlayingIndex]) {
                tracks[currentPlayingIndex].lyrics = this.value;
                saveToLocalStorage();
            }
        };
    } else {
        lyricsInput.value = '';
        lyricsInput.oninput = null;
    }
}

function seekExpandedAlbumView(event) {
    const progressContainer = event.currentTarget;
    if (audio.duration && progressContainer) {
        const rect = progressContainer.getBoundingClientRect();
        // Use clientX from the event object
        const clientX = event.clientX;
        if (clientX >= rect.left && clientX <= rect.right) {
            const percent = (clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
            // Sync seek is now handled by the 'timeupdate' event listener
        }
    }
}

// Function to send current audio state and frequency data to visualizer
function syncVisualizerStateAndData() {
    const visualizerPopout = document.getElementById('visualizerPopout');
    // Only process and send data if the visualizer popout is visible.
    if (!visualizerPopout || visualizerPopout.style.display === 'none') {
        return;
    }

    const iframe = document.getElementById('visualizerIframe');
    if (iframe && iframe.contentWindow) {
        if (visualizerAnalyser && visualizerDataArray && visualizerAudioContext && visualizerAudioContext.state === 'running') {
            visualizerAnalyser.getByteFrequencyData(visualizerDataArray);
            let sum = 0;
            for (let i = 0; i < visualizerDataArray.length; i++) {
                sum += visualizerDataArray[i];
            }
            const average = sum / visualizerDataArray.length / 255;

            const message = {
                type: 'audioDataUpdate',
                dataArray: Array.from(visualizerDataArray), // Send a copy
                averageFrequency: average,
                isPlaying: isPlaying && !audio.paused && !audio.ended
            };
            iframe.contentWindow.postMessage(message, '*');
        } else {
            iframe.contentWindow.postMessage({
                type: 'audioDataUpdate',
                dataArray: new Array(256).fill(0), // Send an empty array
                averageFrequency: 0,
                isPlaying: false
            }, '*');
        }
    }
}

// Expose syncVisualizerStateAndData to the global scope for app.js to use
window.syncVisualizerStateAndData = syncVisualizerStateAndData;