// Track management functionality
function renderTracks() {
    const tbody = document.querySelector('#trackList tbody');
    tbody.innerHTML = '';
    
    // Filter out hidden tracks and render only visible ones with correct numbering
    const visibleTracks = tracks.filter(track => !track.hidden);
    
    visibleTracks.forEach((track, visibleIndex) => {
        const actualIndex = tracks.indexOf(track); // Get the actual index from main tracks array
        const explicitSymbol = track.explicit ? ' <span class="explicit-symbol">🅴</span>' : '';
        
        const row = `
            <tr>
                <td>
                    ${track.isSingle ? '<span class="single-star">★</span>' : ''}
                    <span class="track-number">${visibleIndex + 1}</span>
                    <button class="play-button" onclick="playTrack(${actualIndex})">▶</button>
                </td>
                <td class="song-title"><span class="editable" contenteditable="true" oninput="updateTrack(${actualIndex}, 'title', this.textContent)">${track.title}</span>${explicitSymbol}</td>
                <td class="artist-name"><span class="editable" contenteditable="true" oninput="updateTrack(${actualIndex}, 'artist', this.textContent); updateArtistHeader();">${track.artist}</span></td>
                <td class="time-column"><span class="editable" contenteditable="true" oninput="updateTrack(${actualIndex}, 'time', this.textContent)">${track.time}</span></td>
                        <td>                    <button onclick="openManageAudioModal(${actualIndex})" class="action-button ${track.audioUrl ? 'has-audio' : ''}" data-tooltip="${track.audioUrl ? 'Manage attached vault song' : 'Choose vault song'}">⋮</button>
                    <button onmousedown="startReorderDrag(event, ${actualIndex})" onclick="event.preventDefault()" class="action-button" data-tooltip="Drag to change position">↑</button>
                    <button onmousedown="startReorderDrag(event, ${actualIndex})" onclick="event.preventDefault()" class="action-button" data-tooltip="Drag to change position">↓</button>
                    <button onclick="removeTrack(${actualIndex})" class="action-button" data-tooltip="Remove track">✕</button>
                    <button onclick="toggleSingle(${actualIndex})" class="action-button" data-tooltip="Toggle single">★</button>
                    <button onclick="toggleExplicit(${actualIndex})" class="action-button" data-tooltip="Toggle explicit">🅴</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    
    updateTrackCountDisplay();
    updateArtistHeader(); // Update artist header alignment after rendering tracks
}

// --- Manage Audio modal helpers ---
let _manageAudioTargetIndex = null;
let _vaultAudioChoices = [];

function vaultObjectUrl(key) {
    return key ? `/api/object?key=${encodeURIComponent(key)}` : '';
}

async function fetchVaultAudioChoices() {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error(`Could not load vault songs (${response.status})`);
    const vaultState = await response.json();
    return (vaultState.recordings || [])
        .filter(recording => recording.mainKey)
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

function renderVaultAudioChoices(filter = '') {
    const list = document.getElementById('manageAudioVaultList');
    if (!list) return;
    const q = filter.trim().toLowerCase();
    const choices = _vaultAudioChoices.filter(song => {
        const text = `${song.title || ''} ${song.section || ''} ${song.mainName || ''}`.toLowerCase();
        return !q || text.includes(q);
    });

    if (!choices.length) {
        list.innerHTML = '<div style="padding:12px;color:#666;text-align:center;">No vault songs found.</div>';
        return;
    }

    list.innerHTML = '';
    choices.forEach(song => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'track-list-button more-btn';
        button.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;background:#fff;color:#111;border:1px solid #eee;padding:9px 10px;border-radius:8px;';
        button.innerHTML = `
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <strong>${escapeTrackChoice(song.title || 'Untitled')}</strong>
                <small style="display:block;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeTrackChoice(song.mainName || song.mainKey)}</small>
            </span>
            <small style="color:#666;text-transform:capitalize;">${escapeTrackChoice(song.section || '')}</small>
        `;
        button.addEventListener('click', () => attachVaultSongToTrack(song));
        list.appendChild(button);
    });
}

function escapeTrackChoice(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function attachVaultSongToTrack(song) {
    if (_manageAudioTargetIndex === null || !tracks[_manageAudioTargetIndex]) return;
    const track = tracks[_manageAudioTargetIndex];
    track.title = song.title || track.title || 'Untitled';
    track.artist = albumInfo.artist || track.artist || 'Artist';
    track.audioUrl = vaultObjectUrl(song.mainKey);
    track.originalFileName = song.mainName || song.title || song.mainKey;
    track.vaultRecordingId = song.id;
    track.vaultRecordingKey = song.mainKey;
    track.uploadedAt = song.updatedAt || song.createdAt || new Date().toISOString();

    const tempAudio = new Audio(track.audioUrl);
    tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration || 0;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        track.time = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        saveToLocalStorage();
        renderTracks();
        updateNowPlaying();
        openManageAudioModal(_manageAudioTargetIndex);
    };
    tempAudio.onerror = () => {
        saveToLocalStorage();
        renderTracks();
        updateNowPlaying();
        openManageAudioModal(_manageAudioTargetIndex);
    };

    document.getElementById('manageAudioStatus').textContent = 'Attached';
}

async function openManageAudioModal(trackIndex) {
    const modal = document.getElementById('manageAudioModal');
    const fileNameEl = document.getElementById('manageAudioFileName');
    const attachedStatusEl = document.getElementById('manageAudioAttachedStatus');
    const statusEl = document.getElementById('manageAudioStatus');
    const deleteBtn = document.getElementById('manageAudioDeleteBtn');
    const searchInput = document.getElementById('manageAudioSearch');
    const list = document.getElementById('manageAudioVaultList');

    if (!modal || !fileNameEl || !attachedStatusEl || !statusEl || !deleteBtn || !searchInput || !list) return;

    _manageAudioTargetIndex = trackIndex;
    const track = tracks[trackIndex];

    if (track && track.audioUrl) {
        fileNameEl.textContent = track.title || track.originalFileName || 'Attached song';
        fileNameEl.title = track.originalFileName || track.audioUrl;
        attachedStatusEl.textContent = 'Song attached';
        deleteBtn.disabled = false;
        const sourceEl = document.getElementById('manageAudioUploadDate');
        if (sourceEl) {
            sourceEl.textContent = track.vaultRecordingKey ? 'Vault' : 'Local';
            sourceEl.title = track.vaultRecordingKey || track.audioUrl || '';
        }
    } else {
        fileNameEl.textContent = '�';
        fileNameEl.title = '';
        attachedStatusEl.textContent = 'No song attached';
        deleteBtn.disabled = true;
        const sourceEl = document.getElementById('manageAudioUploadDate');
        if (sourceEl) {
            sourceEl.textContent = '�';
            sourceEl.title = '';
        }
    }

    document.getElementById('manageAudioClose').onclick = closeManageAudioModal;
    deleteBtn.onclick = async () => {
        const confirmed = await showCustomConfirm('Detach the song from this track?');
        if (!confirmed || _manageAudioTargetIndex === null) return;
        delete tracks[_manageAudioTargetIndex].originalFileName;
        delete tracks[_manageAudioTargetIndex].vaultRecordingId;
        delete tracks[_manageAudioTargetIndex].vaultRecordingKey;
        tracks[_manageAudioTargetIndex].audioUrl = null;
        tracks[_manageAudioTargetIndex].time = '0:00';
        saveToLocalStorage();
        renderTracks();
        updateNowPlaying();
        openManageAudioModal(_manageAudioTargetIndex);
    };

    searchInput.value = '';
    searchInput.oninput = () => renderVaultAudioChoices(searchInput.value);
    list.innerHTML = '<div style="padding:12px;color:#666;text-align:center;">Loading vault songs...</div>';
    statusEl.textContent = 'Loading';

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    try {
        _vaultAudioChoices = await fetchVaultAudioChoices();
        renderVaultAudioChoices();
        statusEl.textContent = `${_vaultAudioChoices.length} songs`;
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div style="padding:12px;color:#b33;text-align:center;">${escapeTrackChoice(error.message || 'Could not load vault songs.')}</div>`;
        statusEl.textContent = 'Failed';
    }
}

function closeManageAudioModal() {
    const modal = document.getElementById('manageAudioModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    _manageAudioTargetIndex = null;
}
function addTrack() {
    tracks.push({ title: "New Track", artist: "Artist Name", time: "0:00", explicit: false, hidden: false, isSingle: false, lyrics: "", audioUrl: null, trackId: generateUniqueId() });
    renderTracks();
    saveToLocalStorage();
}

function removeTrack(index) {
    if (tracks.length > 0) {
        tracks.splice(index, 1);
        renderTracks();
        saveToLocalStorage();
    }
}

function updateTrack(index, field, value) {
    tracks[index][field] = value;
    updateTrackCountDisplay();
    saveToLocalStorage();
}

/* Replaced discrete moveUp/moveDown functions with a drag-to-reorder implementation.
   The old moveTrackUp/moveTrackDown were removed to avoid unused UI. */
let _reorderState = {
    dragging: false,
    startY: 0,
    originIndex: -1,
    placeholder: null,
    draggedRow: null
};

function startReorderDrag(e, index) {
    // Normalize touch/mouse events
    if (e.type === 'touchstart') e = e.touches[0];
    e.preventDefault();
    _reorderState.dragging = true;
    _reorderState.startY = e.clientY;
    _reorderState.originIndex = index;

    const tbody = document.querySelector('#trackList tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const actualRow = rows.find(r => {
        // Determine row by comparing play button onclick index if present
        return r.querySelector('.play-button') && r.querySelector('.play-button').getAttribute('onclick')?.includes(`playTrack(${index})`);
    }) || rows[index];

    if (!actualRow) {
        _reorderState.dragging = false;
        return;
    }

    // Create a placeholder
    const placeholder = document.createElement('tr');
    placeholder.className = 'reorder-placeholder';
    placeholder.style.height = `${actualRow.offsetHeight}px`;
    placeholder.style.background = 'rgba(0,0,0,0.03)';
    placeholder.style.transition = 'background .18s';
    actualRow.parentNode.insertBefore(placeholder, actualRow.nextSibling);

    // Clone the row visually for dragging
    const draggedClone = actualRow.cloneNode(true);
    draggedClone.style.position = 'fixed';
    draggedClone.style.left = `${actualRow.getBoundingClientRect().left}px`;
    draggedClone.style.top = `${actualRow.getBoundingClientRect().top}px`;
    draggedClone.style.width = `${actualRow.getBoundingClientRect().width}px`;
    draggedClone.style.pointerEvents = 'none';
    draggedClone.style.opacity = '0.95';
    draggedClone.style.zIndex = 9999;
    draggedClone.classList.add('dragging-clone');

    document.body.appendChild(draggedClone);

    actualRow.style.visibility = 'collapse'; // hide original row while dragging

    _reorderState.placeholder = placeholder;
    _reorderState.draggedRow = draggedClone;

    // Attach move/end listeners
    const moveHandler = (ev) => handleReorderMove(ev);
    const upHandler = (ev) => finishReorderDrag(ev, moveHandler, upHandler);

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchend', upHandler);
}

function handleReorderMove(e) {
    if (!_reorderState.dragging) return;
    // Normalize touch/mouse events
    const ev = (e.type.startsWith('touch')) ? (e.touches[0] || e.changedTouches[0]) : e;
    if (!ev) return;
    e.preventDefault();

    const y = ev.clientY;
    const dy = y - _reorderState.startY;
    const draggedClone = _reorderState.draggedRow;
    draggedClone.style.top = `${parseFloat(draggedClone.style.top || 0) + dy}px`;
    _reorderState.startY = y;

    // Determine new placeholder position
    const tbody = document.querySelector('#trackList tbody');
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.classList.contains('reorder-placeholder') && r.style.visibility !== 'collapse');

    for (let row of rows) {
        const rect = row.getBoundingClientRect();
        if (y > rect.top && y < rect.bottom) {
            // Insert placeholder before or after depending on midline
            const midpoint = rect.top + rect.height / 2;
            if (y < midpoint && row.previousSibling !== _reorderState.placeholder) {
                tbody.insertBefore(_reorderState.placeholder, row);
            } else if (y >= midpoint && row.nextSibling !== _reorderState.placeholder) {
                tbody.insertBefore(_reorderState.placeholder, row.nextSibling);
            }
            break;
        }
    }
}

function finishReorderDrag(e, moveHandler, upHandler) {
    if (!_reorderState.dragging) return;

    // Remove listeners
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('touchmove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
    document.removeEventListener('touchend', upHandler);

    // Find final index from placeholder position
    const tbody = document.querySelector('#trackList tbody');
    const placeholder = _reorderState.placeholder;
    if (!placeholder) {
        cleanupReorderState();
        return;
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const finalIndexInVisible = rows.indexOf(placeholder); // zero-based among visible rows
    // Map visible indices to actual tracks array indices
    const visibleTracks = tracks.filter(t => !t.hidden);
    // compute target track index in `tracks` array
    const targetVisibleIndex = finalIndexInVisible; // because placeholder occupies where the dragged item will go
    // Remove the original track from tracks and re-insert
    const originTrack = tracks.splice(_reorderState.originIndex, 1)[0];
    // Determine actual insertion index in tracks array relative to origin removal:
    // We need to map visible position to global index:
    const beforeTrack = visibleTracks[targetVisibleIndex] || null;
    let insertIndex;
    if (beforeTrack) {
        // insert before this visible track in the global tracks array
        insertIndex = tracks.indexOf(beforeTrack);
        if (insertIndex === -1) {
            // fallback to push
            insertIndex = tracks.length;
        }
    } else {
        // Append to end
        insertIndex = tracks.length;
    }
    tracks.splice(insertIndex, 0, originTrack);

    // Cleanup and re-render
    cleanupReorderState();
    renderTracks();
    saveToLocalStorage();
}

function cleanupReorderState() {
    if (_reorderState.draggedRow && _reorderState.draggedRow.parentNode) {
        _reorderState.draggedRow.parentNode.removeChild(_reorderState.draggedRow);
    }
    if (_reorderState.placeholder && _reorderState.placeholder.parentNode) {
        _reorderState.placeholder.parentNode.removeChild(_reorderState.placeholder);
    }
    // reveal any hidden original row
    const tbody = document.querySelector('#trackList tbody');
    Array.from(tbody.querySelectorAll('tr')).forEach(r => r.style.visibility = '');
    _reorderState.dragging = false;
    _reorderState.startY = 0;
    _reorderState.originIndex = -1;
    _reorderState.placeholder = null;
    _reorderState.draggedRow = null;
}

function toggleExplicit(index) {
    tracks[index].explicit = !tracks[index].explicit;
    renderTracks();
    saveToLocalStorage();
}

function toggleSingle(index) {
    tracks[index].isSingle = !tracks[index].isSingle;
    renderTracks();
    saveToLocalStorage();
}

async function toggleHideTrack() {
    // Use custom prompt modal instead of native prompt
    const trackNumberInput = await showCustomPrompt("Enter the track number to hide:", "");
    if (trackNumberInput !== null) {
        const trackNumber = parseInt(trackNumberInput, 10);
        
        // Adjust for zero-indexing and only visible tracks
        const visibleTracks = tracks.filter(track => !track.hidden);
        
        if (Number.isInteger(trackNumber) && trackNumber > 0 && trackNumber <= visibleTracks.length) {
            // Find the actual index of the track to hide
            const trackToHideIndex = tracks.indexOf(visibleTracks[trackNumber - 1]);
            
            // Count visible tracks to ensure we're not hiding the last visible track
            if (visibleTracks.length > 1) {
                tracks[trackToHideIndex].hidden = true;
                renderTracks();
                saveToLocalStorage();
                
                // Refresh dropdown if it's visible
                toggleHiddenTracksDropdown();

            } else {
                alert("You must have at least one visible track.");
            }
        } else {
            alert("Invalid track number. Please enter a valid track number.");
        }
    }
}

function unhideTrack(index) {
    if (index >= 0 && index < tracks.length) {  
        tracks[index].hidden = false;
        renderTracks();
        saveToLocalStorage();
        toggleHiddenTracksDropdown(); // Refresh the dropdown
    }
}

function updateTrackCountDisplay() {
    const totalTracks = tracks.filter(track => !track.hidden).length;
    let totalSeconds = 0;
    tracks.filter(track => !track.hidden).forEach(track => {
        const [minutes, seconds] = track.time.split(':').map(Number);
        totalSeconds += minutes * 60 + seconds;
    });
    const totalMinutes = Math.floor(totalSeconds / 60);
    document.getElementById('trackCountDisplay').textContent = `${totalTracks} Songs, ${totalMinutes} Minutes`;
}

async function handleAudioUpload(index, event) {
    const file = event.target.files[0];
    if (file) {
        try {
            const audioUrl = await window.vaultLocalUpload(file);

            // Record uploaded timestamp for traceability
            tracks[index].uploadedAt = new Date().toISOString();

            const tempAudio = new Audio(audioUrl);
            tempAudio.crossOrigin = "anonymous";
            tempAudio.onloadedmetadata = function() {
                const duration = tempAudio.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                updateTrack(index, 'time', formattedTime);
                tracks[index].audioUrl = audioUrl;
                renderTracks();
                saveToLocalStorage();
                // If Manage Audio modal is open for this track, update its displayed upload date
                const uploadDateEl = document.getElementById('manageAudioUploadDate');
                if (uploadDateEl && _manageAudioTargetIndex === index) {
                    uploadDateEl.textContent = new Date(tracks[index].uploadedAt).toLocaleString();
                    uploadDateEl.title = tracks[index].uploadedAt;
                }
            };
            tempAudio.onerror = function(error) {
                console.error("Error loading audio metadata:", error);
                alert("Error loading audio. Ensure it's a supported format.");
            };
        } catch (error) {
            console.error('Error uploading audio file:', error);
            alert('Failed to upload audio file. Please try again.');
        }
    }
}

function importMultipleAudioFiles() {
    // Toggle the visible dropzone instead of opening the file picker immediately
    const dropzone = document.getElementById('multiImportDropzone');
    if (!dropzone) {
        console.warn('Multi import dropzone not found.');
        return;
    }
    const isVisible = dropzone.style.display === 'block';
    if (isVisible) {
        hideMultiImportDropzone();
    } else {
        showMultiImportDropzone();
    }
}

function showMultiImportDropzone() {
    const dropzone = document.getElementById('multiImportDropzone');
    const fileInput = document.getElementById('multipleAudioUpload');
    const chooseBtn = document.getElementById('multiImportChooseBtn');
    const cancelBtn = document.getElementById('multiImportCancelBtn');
    const dropArea = document.getElementById('multiImportDropArea');
    const summaryEl = document.getElementById('multiImportSummary');
    const progressSummary = document.getElementById('multiImportProgressSummary');
    const detailsPanel = document.getElementById('multiImportDetails');

    if (!dropzone || !fileInput || !chooseBtn || !cancelBtn || !dropArea || !detailsPanel) return;

    // Reveal modal and set focused state
    dropzone.style.display = 'block';
    dropzone.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Reset UI
    summaryEl.textContent = 'Files queued: 0';
    progressSummary.textContent = 'Idle';
    // Add an import disclaimer at the top of the console so users know large imports may take time
    detailsPanel.innerHTML = '<div class="import-disclaimer" style="font-size:13px;color:#666;margin-bottom:8px;">This might take a minute or two, especially if you imported many files!</div>';
    dropArea.classList.remove('drag-over');

    // Prevent clicks on drop area from propagating
    dropArea.addEventListener('click', (e) => e.stopPropagation());

    // Choose files button
    chooseBtn.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
    };

    // Close/hide
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        hideMultiImportDropzone();
    };

    // Visual helpers
    const setDropHint = (text, color = '#666') => {
        const msg = document.getElementById('multiImportMessage');
        if (msg) { msg.textContent = text; msg.style.color = color; }
    };

    // Drag handlers for the left area only (keeps modal responsive)
    const onDragOver = (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
        setDropHint('Release to import files', '#0b66c3');
    };
    const onDragLeave = (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        setDropHint('Drag & drop audio files to import newest versions (or)');
    };
    const onDrop = async (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        const dt = e.dataTransfer;
        if (!dt || !dt.files || dt.files.length === 0) {
            setDropHint('No files detected.', '#b33');
            return;
        }
        const files = Array.from(dt.files);
        await startImportFlow(files);
    };

    // File picker flow shares the same handler
    fileInput.onchange = async function(evt) {
        const files = Array.from(evt.target.files || []);
        if (files.length === 0) return;
        await startImportFlow(files);
        // clear input so same files can be re-selected later
        evt.target.value = '';
    };

    // Start import sequence (concurrent, with per-file console updates)
    async function startImportFlow(files) {
        // Clear previous list and set header, include disclaimer
        detailsPanel.innerHTML = '<div class="import-disclaimer" style="font-size:13px;color:#666;margin-bottom:8px;">This might take a minute or two, especially if you imported many files!</div>';
        summaryEl.textContent = `Files queued: ${files.length}`;
        progressSummary.textContent = `0 / ${files.length} processed`;

        // Create an initial card for each file so the console looks immediate
        const fileCards = {};
        files.forEach(f => {
            const card = document.createElement('div');
            card.className = 'import-card';
            card.style.display = 'flex';
            card.style.gap = '10px';
            card.style.alignItems = 'flex-start';
            card.style.padding = '8px';
            card.style.borderBottom = '1px solid #f2f2f2';

            const thumb = document.createElement('div');
            thumb.style.width = '52px';
            thumb.style.height = '52px';
            thumb.style.borderRadius = '8px';
            thumb.style.background = '#fafafa';
            thumb.style.border = '1px solid #eee';
            thumb.style.display = 'flex';
            thumb.style.alignItems = 'center';
            thumb.style.justifyContent = 'center';
            thumb.style.fontSize = '12px';
            thumb.style.color = '#999';
            thumb.textContent = 'AUD';

            const meta = document.createElement('div');
            meta.style.flex = '1';
            meta.style.minWidth = '0';

            const title = document.createElement('div');
            title.style.display = 'flex';
            title.style.justifyContent = 'space-between';
            title.style.alignItems = 'center';
            title.style.gap = '8px';

            const name = document.createElement('div');
            name.style.fontWeight = 700;
            name.style.fontSize = '13px';
            name.style.color = '#111';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            name.textContent = f.name;

            const stateBadge = document.createElement('div');
            stateBadge.style.fontSize = '12px';
            stateBadge.style.padding = '4px 8px';
            stateBadge.style.borderRadius = '999px';
            stateBadge.style.background = 'rgba(0,0,0,0.06)';
            stateBadge.style.color = '#444';
            stateBadge.textContent = 'queued';

            title.appendChild(name);
            title.appendChild(stateBadge);

            const subtitle = document.createElement('div');
            subtitle.style.fontSize = '12px';
            subtitle.style.color = '#666';
            subtitle.style.marginTop = '6px';
            subtitle.textContent = 'Awaiting match...';

            const progressWrap = document.createElement('div');
            progressWrap.style.display = 'flex';
            progressWrap.style.alignItems = 'center';
            progressWrap.style.gap = '8px';
            progressWrap.style.marginTop = '8px';

            const bar = document.createElement('div');
            bar.style.flex = '1';
            bar.style.height = '8px';
            bar.style.background = '#f3f3f3';
            bar.style.borderRadius = '999px';
            bar.style.overflow = 'hidden';
            const fill = document.createElement('div');
            fill.style.height = '100%';
            fill.style.width = '0%';
            fill.style.background = '#007aff';
            fill.style.transition = 'width 200ms linear';
            bar.appendChild(fill);

            const pct = document.createElement('div');
            pct.style.fontSize = '12px';
            pct.style.color = '#444';
            pct.textContent = '0%';

            progressWrap.appendChild(bar);
            progressWrap.appendChild(pct);

            const statusLine = document.createElement('div');
            statusLine.style.fontSize = '12px';
            statusLine.style.color = '#666';
            statusLine.style.marginTop = '8px';
            statusLine.textContent = 'Ready';

            meta.appendChild(title);
            meta.appendChild(subtitle);
            meta.appendChild(progressWrap);
            meta.appendChild(statusLine);

            card.appendChild(thumb);
            card.appendChild(meta);

            detailsPanel.appendChild(card);

            fileCards[f.name] = { card, refs: { stateBadge, subtitle, fill, pct, statusLine, thumb } };
        });

        // Provide a progress updater to pass into handleImportedAudioFiles
        let processed = 0;
        const progressCallback = (detail) => {
            const entry = fileCards[detail.fileName];
            if (!entry) return;
            const refs = entry.refs;
            refs.stateBadge.textContent = detail.status || refs.stateBadge.textContent;
            // style badge based on status
            const s = (detail.status || '').toLowerCase();
            if (s.includes('error')) {
                refs.stateBadge.style.background = '#ffecec';
                refs.stateBadge.style.color = '#b33';
            } else if (s.includes('upload')) {
                refs.stateBadge.style.background = '#fff7e6';
                refs.stateBadge.style.color = '#b36b00';
            } else if (s.includes('import') || s.includes('imported')) {
                refs.stateBadge.style.background = '#e6ffef';
                refs.stateBadge.style.color = '#1a7f37';
            } else {
                refs.stateBadge.style.background = 'rgba(0,0,0,0.06)';
                refs.stateBadge.style.color = '#444';
            }

            if (detail.matchedTrackTitle) refs.subtitle.textContent = `Matched → "${detail.matchedTrackTitle}"`;
            if (typeof detail.progress === 'number') {
                const pctVal = Math.max(0, Math.min(100, Math.round(detail.progress)));
                refs.fill.style.width = `${pctVal}%`;
                refs.pct.textContent = `${pctVal}%`;
            } else if (detail.duration) {
                refs.fill.style.width = '100%';
                refs.pct.textContent = detail.duration;
            }
            if (detail.error) {
                refs.statusLine.textContent = `Error: ${detail.error}`;
                refs.statusLine.style.color = '#b33';
            } else {
                refs.statusLine.textContent = detail.status || refs.statusLine.textContent;
                refs.statusLine.style.color = '#666';
            }

            // Update global summary if present
            if (detail.summary && summaryEl) summaryEl.textContent = detail.summary;

            // update processed count and progress summary
            if (detail.status && (detail.status.toLowerCase().includes('imported') || detail.status.toLowerCase().includes('error') || detail.status.toLowerCase().includes('uploaded'))) {
                // Count finished states by checking fill == 100 or explicit imported status
                // We'll compute processed as number of cards with pct == 100 or error indicated
                processed = Object.values(fileCards).filter(c => {
                    const p = parseInt(c.refs.pct.textContent, 10);
                    const err = c.refs.statusLine.textContent.toLowerCase().includes('error');
                    return (!isNaN(p) && p >= 100) || err;
                }).length;
                progressSummary.textContent = `${processed} / ${files.length} processed`;
            }
        };

        // Kick off heavy-lift import function (concurrent)
        try {
            const result = await handleImportedAudioFiles(files, progressCallback);
            const importedCount = (result && result.importedCount) || 0;
            const importErrors = (result && result.importErrors) || [];

            summaryEl.textContent = `Imported: ${importedCount}, Errors: ${importErrors.length}`;
            progressSummary.textContent = `${importedCount} successful • ${importErrors.length} errors`;

            // provide a short toast in message area
            setDropHint(`${importedCount} imported • ${importErrors.length} errors`, importErrors.length ? '#b33' : '#1a7f37');
        } catch (err) {
            console.error('Import flow failed:', err);
            setDropHint('Import failed; check console for details', '#b33');
            summaryEl.textContent = 'Import failed';
        }
    }

    // Wire drag events
    dropArea.addEventListener('dragover', onDragOver);
    dropArea.addEventListener('dragleave', onDragLeave);
    dropArea.addEventListener('drop', onDrop);

    // Save handlers for cleanup when hiding
    dropzone._handlers = { onDragOver, onDragLeave, onDrop };

    // Focus the Choose button to encourage next action
    chooseBtn.focus();
}

function hideMultiImportDropzone() {
    const dropzone = document.getElementById('multiImportDropzone');
    if (!dropzone) return;
    dropzone.style.display = 'none';
    const fileInput = document.getElementById('multipleAudioUpload');
    if (fileInput) {
        fileInput.value = '';
    }

    // Remove drag/drop handlers if set
    if (dropzone._handlers) {
        dropzone.removeEventListener('dragover', dropzone._handlers.onDragOver);
        dropzone.removeEventListener('dragleave', dropzone._handlers.onDragLeave);
        dropzone.removeEventListener('drop', dropzone._handlers.onDrop);
        delete dropzone._handlers;
    }
}

// Show a persistent import complete modal summarizing results
function showImportCompleteModal(importedCount = 0, importErrors = []) {
    try {
        // Ensure dropzone is hidden when showing the result
        hideMultiImportDropzone();
        const modal = document.getElementById('importCompleteModal');
        const messageEl = document.getElementById('importCompleteMessage');
        const viewBtn = document.getElementById('importCompleteViewDetails');
        const closeBtn = document.getElementById('importCompleteOk');
        const closeX = document.getElementById('importCompleteClose');

        if (!modal || !messageEl || !viewBtn || !closeBtn || !closeX) {
            console.warn('Import complete modal elements missing.');
            return;
        }

        // Build summary text
        let text = `${importedCount} file${importedCount !== 1 ? 's' : ''} imported successfully.`;
        if (importErrors && importErrors.length > 0) {
            text += ` ${importErrors.length} error${importErrors.length !== 1 ? 's' : ''}: ${importErrors.slice(0,3).join(', ')}${importErrors.length > 3 ? '...' : ''}.`;
        }
        messageEl.textContent = text;

        // Wire buttons
        const onClose = () => closeImportCompleteModal();
        closeBtn.onclick = onClose;
        closeX.onclick = onClose;

        viewBtn.onclick = (e) => {
            e.stopPropagation();
            // Open the import modal again and populate details panel if available
            showMultiImportDropzone();
            // If details are available in the dropzone, ensure it's scrolled into view
            const details = document.getElementById('multiImportDetails');
            if (details) {
                details.scrollTop = 0;
            }
            // Close the summary modal
            closeImportCompleteModal();
        };

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    } catch (err) {
        console.error('Error showing import complete modal:', err);
    }
}

function closeImportCompleteModal() {
    const modal = document.getElementById('importCompleteModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

 // New shared handler used by both picker and drop
async function handleImportedAudioFiles(files, progressCallback = null) {
    // Build a map of baseName -> { file, version }
    // We keep the suffix/version resolution logic (_2, _3) when multiple files reference the same base token.
    const latestFilesByBaseName = {};

    files.forEach(file => {
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        // capture trailing _N suffix if present
        const match = rawName.match(/^(.*?)(?:_(\d+))?$/);
        const basePart = match && match[1] ? match[1] : rawName;
        const versionPart = match && match[2] ? parseInt(match[2], 10) : 0;
        const normalizedBaseName = basePart.toLowerCase().replace(/\s+/g, '');
        const existing = latestFilesByBaseName[normalizedBaseName];
        if (!existing || versionPart > existing.version) {
            latestFilesByBaseName[normalizedBaseName] = {
                file,
                rawName,
                version: versionPart
            };
        }
    });

    // Track how many files were successfully matched+imported
    let importedCount = 0;
    const importErrors = [];
    const details = []; // Per-file detail objects for UI

    // Helper to emit progress updates
    const emitProgress = (detail) => {
        if (progressCallback && typeof progressCallback === 'function') {
            // Provide a rolling summary for UI
            const summary = `Imported: ${importedCount} • Errors: ${importErrors.length}`;
            progressCallback({ ...detail, summary });
        }
    };

    // Precompute normalized track names for matching
    const normalizedTracks = tracks.map((t, idx) => ({
        index: idx,
        title: t.title || '',
        normalized: (t.title || '').toLowerCase().replace(/\s+/g, '')
    }));

    // Create processing tasks for each file (parallel)
    const fileEntries = Object.values(latestFilesByBaseName);

    // Early exit if no files
    if (fileEntries.length === 0) {
        return { importedCount, importErrors, details };
    }

    // For each file prepare a task promise that handles matching, uploading, metadata, and UI progress
    const tasks = fileEntries.map(({ file, rawName }) => (async () => {
        const fullNameNormalized = rawName.toLowerCase().replace(/\s+/g, '');

        // Find tracks where the track name appears anywhere in the filename OR vice-versa
        const candidateTracks = normalizedTracks.filter(nt => {
            if (!nt.normalized) return false;
            return fullNameNormalized.includes(nt.normalized) || nt.normalized.includes(fullNameNormalized);
        });

        // Prepare a detail record for UI
        const detail = {
            fileName: file.name,
            matchedTrackTitle: null,
            status: 'skipped', // will be updated
            duration: null,
            error: null
        };

        // If multiple different tracks match the filename, treat as ambiguous and skip
        if (candidateTracks.length === 0) {
            detail.status = 'no-match';
            details.push(detail);
            emitProgress(detail);
            return detail;
        } else if (candidateTracks.length > 1) {
            // Ambiguous match: multiple tracks match the same filename -> skip to avoid wrong assignment
            detail.status = 'ambiguous';
            detail.error = `Matches multiple tracks (${candidateTracks.map(c => tracks[c.index].title).slice(0,3).join(', ')})`;
            details.push(detail);
            emitProgress(detail);
            return detail;
        }

        const matched = candidateTracks[0];
        const trackIndex = matched.index;
        detail.matchedTrackTitle = tracks[trackIndex].title;

        try {
            // Update UI: uploading
            detail.status = 'uploading';
            details.push(detail);
            emitProgress(detail);

            // Start upload (this runs concurrently across files)
            const audioUrl = await window.vaultLocalUpload(file);

            // Update detail for uploaded URL
            detail.status = 'uploaded';
            detail.uploadUrl = audioUrl;
            emitProgress(detail);

            // Assign audio URL and attempt to read metadata
            tracks[trackIndex].audioUrl = audioUrl;

            const tempAudio = new Audio();
            tempAudio.crossOrigin = "anonymous";

            // Await metadata to determine duration
            await new Promise((resolve) => {
                tempAudio.onloadedmetadata = function() {
                    const duration = tempAudio.duration || 0;
                    const minutes = Math.floor(duration / 60);
                    const seconds = Math.floor(duration % 60);
                    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    tracks[trackIndex].time = formattedTime;
                    detail.duration = formattedTime;
                    detail.status = 'imported';
                    // Render/save per-file so user sees results as they complete
                    renderTracks();
                    saveToLocalStorage();
                    importedCount++;
                    emitProgress(detail);
                    resolve();
                };
                tempAudio.onerror = function(error) {
                    console.error(`Error loading audio metadata for file: ${file.name}`, error);
                    importErrors.push(file.name);
                    detail.status = 'metadata-error';
                    detail.error = 'Could not read audio metadata';
                    emitProgress(detail);
                    resolve(); // resolve to continue other files
                };
                // Start loading
                tempAudio.src = audioUrl;
            });

            return detail;
        } catch (error) {
            console.error(`Error uploading file: ${file.name}`, error);
            importErrors.push(file.name);
            detail.status = 'upload-error';
            detail.error = (error && error.message) ? error.message : String(error);
            details.push(detail);
            emitProgress(detail);
            return detail;
        }
    })());

    // Run all tasks in parallel, but collect results so UI can be updated as each settles
    const results = await Promise.allSettled(tasks);

    // Ensure any rejected promises are captured into importErrors/details
    results.forEach((res, idx) => {
        if (res.status === 'rejected') {
            const fileName = fileEntries[idx].file.name;
            importErrors.push(fileName);
            const detail = {
                fileName,
                matchedTrackTitle: null,
                status: 'error',
                duration: null,
                error: res.reason ? String(res.reason) : 'Unknown error'
            };
            details.push(detail);
            emitProgress(detail);
        }
    });

    // Final UI update: ensure track rendering reflects all imports
    renderTracks();
    saveToLocalStorage();

    // Return summary object so callers can provide user feedback
    return { importedCount, importErrors, details };
}



document.getElementById('multipleAudioUpload').addEventListener('change', async function(event) {
    const files = Array.from(event.target.files);

    // Provide immediate visual feedback in the modal if present
    const dropzone = document.getElementById('multiImportDropzone');
    const messageEl = document.getElementById('multiImportMessage');
    const detailsList = document.getElementById('multiImportDetails');
    const summary = document.getElementById('multiImportSummary');

    if (messageEl) {
        messageEl.textContent = 'Importing files...';
        messageEl.style.color = '#444';
    }
    if (detailsList) detailsList.innerHTML = '';
    if (summary) summary.textContent = 'Import in progress...';

    // Rich progress callback for file-picker flow (shared UI with drop handler)
    const progressCallback = (detail) => {
        if (!detailsList) return;
        if (detail.progress && detail.progress <= 1) {
            detail.progress = Math.round(detail.progress * 100);
        }

        let card = detailsList.querySelector(`li[data-file-name="${CSS.escape(detail.fileName)}"]`);
        if (!card) {
            card = document.createElement('li');
            card.dataset.fileName = detail.fileName;
            card.style.listStyle = 'none';
            card.style.padding = '10px';
            card.style.borderBottom = '1px solid #f3f3f3';
            card.style.display = 'flex';
            card.style.gap = '12px';
            card.style.alignItems = 'center';
            detailsList.appendChild(card);

            const thumb = document.createElement('div');
            thumb.className = 'import-thumb';
            thumb.style.width = '56px';
            thumb.style.height = '56px';
            thumb.style.borderRadius = '6px';
            thumb.style.background = '#fafafa';
            thumb.style.border = '1px solid #eee';
            thumb.style.display = 'flex';
            thumb.style.alignItems = 'center';
            thumb.style.justifyContent = 'center';
            thumb.style.fontSize = '12px';
            thumb.style.color = '#999';
            thumb.textContent = 'AUD';

            const meta = document.createElement('div');
            meta.style.flex = '1';
            meta.style.minWidth = '0';

            const titleLine = document.createElement('div');
            titleLine.className = 'import-title';
            titleLine.style.display = 'flex';
            titleLine.style.justifyContent = 'space-between';
            titleLine.style.alignItems = 'center';
            titleLine.style.gap = '8px';

            const name = document.createElement('div');
            name.className = 'import-filename';
            name.style.fontSize = '13px';
            name.style.fontWeight = '600';
            name.style.color = '#111';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            name.textContent = detail.fileName;

            const badge = document.createElement('div');
            badge.className = 'import-badge';
            badge.style.fontSize = '12px';
            badge.style.padding = '4px 8px';
            badge.style.borderRadius = '999px';
            badge.style.background = 'rgba(0,0,0,0.06)';
            badge.style.color = '#444';
            badge.textContent = detail.status || 'queued';

            titleLine.appendChild(name);
            titleLine.appendChild(badge);

            const subtitle = document.createElement('div');
            subtitle.className = 'import-sub';
            subtitle.style.fontSize = '12px';
            subtitle.style.color = '#666';
            subtitle.style.marginTop = '6px';
            subtitle.style.whiteSpace = 'nowrap';
            subtitle.style.overflow = 'hidden';
            subtitle.style.textOverflow = 'ellipsis';
            subtitle.textContent = detail.matchedTrackTitle ? `Matched → "${detail.matchedTrackTitle}"` : 'No matching track yet';

            const progressWrap = document.createElement('div');
            progressWrap.style.marginTop = '8px';
            progressWrap.style.display = 'flex';
            progressWrap.style.alignItems = 'center';
            progressWrap.style.gap = '8px';

            const bar = document.createElement('div');
            bar.className = 'import-progress-bar';
            bar.style.flex = '1';
            bar.style.height = '8px';
            bar.style.background = '#f0f0f0';
            bar.style.borderRadius = '999px';
            bar.style.overflow = 'hidden';
            bar.style.minWidth = '80px';

            const fill = document.createElement('div');
            fill.className = 'import-progress-fill';
            fill.style.width = '0%';
            fill.style.height = '100%';
            fill.style.background = '#007aff';
            fill.style.transition = 'width 300ms linear';

            bar.appendChild(fill);

            const pct = document.createElement('div');
            pct.className = 'import-progress-pct';
            pct.style.fontSize = '12px';
            pct.style.color = '#444';
            pct.textContent = '0%';

            progressWrap.appendChild(bar);
            progressWrap.appendChild(pct);

            const statusLine = document.createElement('div');
            statusLine.className = 'import-status';
            statusLine.style.fontSize = '12px';
            statusLine.style.color = '#666';
            statusLine.style.marginTop = '8px';
            statusLine.textContent = detail.status || '';

            meta.appendChild(titleLine);
            meta.appendChild(subtitle);
            meta.appendChild(progressWrap);
            meta.appendChild(statusLine);

            card.appendChild(thumb);
            card.appendChild(meta);

            card._refs = { badge, name, subtitle, fill, pct, statusLine, thumb };
        }

        const refs = card._refs;
        if (detail.matchedTrackTitle) {
            refs.subtitle.textContent = `Matched → "${detail.matchedTrackTitle}"`;
        } else {
            refs.subtitle.textContent = 'No matching track';
        }

        const statusLower = (detail.status || '').toLowerCase();
        refs.badge.textContent = detail.status || 'pending';
        if (statusLower.includes('import')) {
            refs.badge.style.background = '#e6ffef';
            refs.badge.style.color = '#1a7f37';
        } else if (statusLower.includes('upload') || statusLower.includes('uploading')) {
            refs.badge.style.background = '#fff7e6';
            refs.badge.style.color = '#b36b00';
        } else if (statusLower.includes('error') || statusLower.includes('failed') || detail.error) {
            refs.badge.style.background = '#ffecec';
            refs.badge.style.color = '#b33';
        } else if (statusLower.includes('uploaded') || statusLower.includes('imported')) {
            refs.badge.style.background = '#e6f7ff';
            refs.badge.style.color = '#0b66c3';
        } else {
            refs.badge.style.background = 'rgba(0,0,0,0.06)';
            refs.badge.style.color = '#444';
        }

        const percent = typeof detail.progress === 'number' ? Math.max(0, Math.min(100, Math.round(detail.progress))) : null;
        if (percent !== null) {
            refs.fill.style.width = `${percent}%`;
            refs.pct.textContent = `${percent}%`;
        } else if (detail.duration) {
            refs.fill.style.width = `100%`;
            refs.pct.textContent = detail.duration;
        }

        if (detail.error) {
            refs.statusLine.textContent = `Error: ${detail.error}`;
            refs.statusLine.style.color = '#b33';
        } else {
            refs.statusLine.textContent = detail.status || '';
            refs.statusLine.style.color = '#666';
        }

        if (detail.thumbUrl) {
            refs.thumb.style.backgroundImage = `url('${detail.thumbUrl}')`;
            refs.thumb.style.backgroundSize = 'cover';
            refs.thumb.style.backgroundPosition = 'center';
            refs.thumb.textContent = '';
        }

        if (detail.summary && summary) {
            summary.textContent = detail.summary;
        }
    };

    // Keep result variable in outer scope so finally can reference it safely
    let result = null;
    try {
        result = await handleImportedAudioFiles(files, progressCallback);
        const { importedCount, importErrors } = result || { importedCount: 0, importErrors: [] };

        if (importedCount > 0) {
            if (messageEl) {
                messageEl.textContent = `Imported ${importedCount} file${importedCount !== 1 ? 's' : ''} successfully.`;
                messageEl.style.color = '#1a7f37';
            }
            if (summary) summary.textContent = `Imported ${importedCount} file${importedCount !== 1 ? 's' : ''} successfully.`;
        } else if (importErrors.length > 0) {
            if (messageEl) {
                messageEl.textContent = `Imported 0 files. Errors: ${importErrors.slice(0,3).join(', ')}`;
                messageEl.style.color = '#b33';
            }
            if (summary) summary.textContent = `Errors importing ${importErrors.length} file(s).`;
        } else {
            if (messageEl) {
                messageEl.textContent = 'No matching tracks found for the selected files.';
                messageEl.style.color = '#b33';
            }
            if (summary) summary.textContent = 'No matching tracks found.';
        }
    } catch (err) {
        console.error('Error during import via file picker:', err);
        if (messageEl) {
            messageEl.textContent = 'An error occurred while importing files.';
            messageEl.style.color = '#b33';
        }
        if (summary) summary.textContent = 'Import failed';
    } finally {
        // Clear the file input so the same files can be selected again if needed
        event.target.value = '';

        // Show a persistent "Import Complete" modal so AFK users can see the result,
        // and leave the import dropzone hidden but not immediately destroyed.
        try {
            const importedCount = result?.importedCount || 0;
            const importErrors = result?.importErrors || [];
            showImportCompleteModal(importedCount, importErrors);
        } catch (e) {
            console.error('Error showing import complete modal:', e);
            hideMultiImportDropzone();
        }
    }
});

// Dynamically calculate the 'left' offset for the 'Artist' header
function updateArtistHeader() {
    // Get the artist header's draggable span
    const artistHeaderDraggable = document.querySelector('#trackList th:nth-child(3) .draggable');
    if (!artistHeaderDraggable) return;

    // Get the first visible artist cell's editable span
    // Ensure we pick a visible track's artist cell
    const firstArtistCellEditable = document.querySelector('#trackList tbody tr:not(.hidden) .artist-name .editable');
    if (!firstArtistCellEditable) {
        // If no visible tracks, reset header alignment
        artistHeaderDraggable.style.left = ''; // Revert to CSS default
        return;
    }

    // Get the bounding rectangles of the draggable span (header text)
    // and the editable span (first artist name text)
    const headerTextRect = artistHeaderDraggable.getBoundingClientRect();
    const cellTextRect = firstArtistCellEditable.getBoundingClientRect();

    // Get the current 'left' style value applied to the header draggable span
    // (This is its offset relative to its natural position within the TH)
    const currentAppliedLeft = parseFloat(artistHeaderDraggable.style.left) || 0;

    // Calculate the 'natural' absolute left position of the header text
    // (where it would be if its 'left' style was 0, considering its parent's 'text-align: right')
    const naturalHeaderTextAbsoluteLeft = headerTextRect.left - currentAppliedLeft;

    // Calculate the new relative 'left' value needed for artistHeaderDraggable
    // to make its absolute left position match the cell's absolute left position.
    // We want: naturalHeaderTextAbsoluteLeft + newRelativeLeft = cellTextRect.left
    // So: newRelativeLeft = cellTextRect.left - naturalHeaderTextAbsoluteLeft
    // Add 5px to account for the 2px padding on the editable span and 3 additional pixels as requested.
    const newRelativeLeft = (cellTextRect.left - naturalHeaderTextAbsoluteLeft) + 3;

    // Apply the dynamically calculated offset to the header text
    artistHeaderDraggable.style.left = `${newRelativeLeft}px`;

    console.log('--- Artist Header Alignment Debug ---');
    console.log('Header draggable span rect:', headerTextRect);
    console.log('Cell editable span rect:', cellTextRect);
    console.log('Current applied left to header draggable:', currentAppliedLeft);
    console.log('Natural header text absolute left (without current style):', naturalHeaderTextAbsoluteLeft);
    console.log('Target cell text absolute left:', cellTextRect.left);
    console.log('Calculated new relative left for header:', newRelativeLeft);
    console.log('-----------------------------------');
}

function toggleDropdown(event) {
    event.stopPropagation();
    const dropdownContent = event.target.nextElementSibling;
    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
}

// New function to fill artist names
function fillArtistNames() {
    const albumArtist = albumInfo.artist || 'Artist Name'; // Get the album artist name

    tracks.forEach(track => {
        track.artist = albumArtist; // Update each track's artist
    });

    renderTracks(); // Re-render the track list to show updated artists
    saveToLocalStorage(); // Save changes
    alert(`All track artists updated to "${albumArtist}".`);
}

// Clear all saved audio files from the tracklist so users can re-upload fresh versions
async function clearAllAudioFiles() {
    // Confirm with custom modal if available, otherwise fallback to native confirm
    let confirmed = false;
    try {
        confirmed = await showCustomConfirm('Remove all attached audio files from every track? This will clear audio URLs and reset durations to 0:00. You can re-upload fresh files after this.', 'Clear audio files');
    } catch (e) {
        confirmed = confirm('Remove all attached audio files from every track? This will clear audio URLs and reset durations to 0:00. You can re-upload fresh files after this.');
    }
    if (!confirmed) return;

    const clearedIndices = [];
    tracks.forEach((track, idx) => {
        if (track.audioUrl) {
            track.audioUrl = null;
            track.time = '0:00';
            clearedIndices.push(idx);
        }
    });

    // Clear any file input elements bound to tracks so UI shows fresh state
    clearedIndices.forEach(i => {
        const input = document.getElementById(`audio${i}`);
        if (input) {
            try { input.value = ''; } catch (e) { /* ignore read-only file input errors */ }
        }
    });

    // Persist and re-render
    renderTracks();
    saveToLocalStorage();
    updateNowPlaying(); // refresh toolbar now-playing state
    // Provide user feedback
    try {
        await showCustomAlert(`Cleared audio for ${clearedIndices.length} track${clearedIndices.length !== 1 ? 's' : ''}. You can now upload fresh files.`, 'Audio cleared');
    } catch (e) {
        alert(`Cleared audio for ${clearedIndices.length} track${clearedIndices.length !== 1 ? 's' : ''}.`);
    }
}