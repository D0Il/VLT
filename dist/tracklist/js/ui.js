let activePlayerModal = null;
let currentQuickViewAlbumRecord = null;
let currentPublicLyrics = [];

function showCustomPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
        const modal = document.getElementById('customTextInputModal');
        const titleEl = document.getElementById('customTextInputTitle');
        const messageEl = document.getElementById('customTextInputMessage');
        const inputEl = document.getElementById('customTextInputField');
        const okBtn = document.getElementById('customTextInputOk');
        const cancelBtn = document.getElementById('customTextInputCancel');
        const closeBtn = document.getElementById('customTextInputClose');

        if (!modal || !inputEl || !okBtn) {
            const fallback = window.prompt(message, defaultValue);
            resolve(fallback === null ? null : String(fallback));
            return;
        }

        titleEl.textContent = 'Input';
        messageEl.textContent = message;
        inputEl.style.display = '';
        cancelBtn.style.display = '';
        closeBtn.style.display = '';
        okBtn.textContent = 'OK';
        inputEl.value = defaultValue;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        inputEl.focus();
        inputEl.select();

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            inputEl.removeEventListener('keydown', onKey);
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
        const onOk = () => {
            const value = inputEl.value;
            cleanup();
            resolve(value);
        };
        const onCancel = () => {
            cleanup();
            resolve(null);
        };
        const onKey = event => {
            if (event.key === 'Enter') onOk();
            if (event.key === 'Escape') onCancel();
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
        inputEl.addEventListener('keydown', onKey);
    });
}

function showCustomAlert(message, title = 'Message') {
    return new Promise(resolve => {
        const modal = document.getElementById('customTextInputModal');
        const titleEl = document.getElementById('customTextInputTitle');
        const messageEl = document.getElementById('customTextInputMessage');
        const inputEl = document.getElementById('customTextInputField');
        const okBtn = document.getElementById('customTextInputOk');
        const cancelBtn = document.getElementById('customTextInputCancel');
        const closeBtn = document.getElementById('customTextInputClose');

        if (!modal || !okBtn) {
            window.alert(message);
            resolve();
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        inputEl.style.display = 'none';
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'none';
        okBtn.textContent = 'OK';
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        const onOk = () => {
            okBtn.removeEventListener('click', onOk);
            inputEl.style.display = '';
            cancelBtn.style.display = '';
            closeBtn.style.display = '';
            modal.style.display = 'none';
            document.body.style.overflow = '';
            resolve();
        };
        okBtn.addEventListener('click', onOk);
    });
}

function showCustomConfirm(message, title = 'Confirm') {
    return new Promise(resolve => {
        const modal = document.getElementById('customTextInputModal');
        const titleEl = document.getElementById('customTextInputTitle');
        const messageEl = document.getElementById('customTextInputMessage');
        const inputEl = document.getElementById('customTextInputField');
        const okBtn = document.getElementById('customTextInputOk');
        const cancelBtn = document.getElementById('customTextInputCancel');
        const closeBtn = document.getElementById('customTextInputClose');

        if (!modal || !okBtn || !cancelBtn) {
            resolve(window.confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        inputEl.style.display = 'none';
        cancelBtn.style.display = '';
        closeBtn.style.display = '';
        okBtn.textContent = 'OK';
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            inputEl.style.display = '';
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
        const onOk = () => {
            cleanup();
            resolve(true);
        };
        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
    });
}

function updateAlbumCoverStyle() {
    const albumCover = document.getElementById('albumCover');
    const nowPlayingCover = document.getElementById('nowPlayingCover');
    const coverUrl = albumInfo && albumInfo.coverUrl ? albumInfo.coverUrl : 'default_itunes.png';
    if (albumCover) {
        albumCover.style.backgroundImage = `url("${coverUrl}")`;
        albumCover.style.backgroundSize = 'cover';
        albumCover.style.backgroundPosition = 'center';
    }
    if (nowPlayingCover && currentPlayingIndex === -1) {
        nowPlayingCover.style.backgroundImage = coverUrl ? `url("${coverUrl}")` : '';
    }
}

function toggleDropdown(event) {
    if (event) event.stopPropagation();
    const button = event ? event.currentTarget || event.target : null;
    const dropdown = button ? button.nextElementSibling : null;
    if (!dropdown) return;
    document.querySelectorAll('.dropdown-content, .music-video-dropdown, .hidden-tracks-dropdown').forEach(el => {
        if (el !== dropdown) el.style.display = 'none';
    });
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function openFullDropdownWindow(event) {
     if (event) event.stopPropagation();

     // Close any inline or other menus
     document.querySelectorAll('.dropdown-content, .music-video-dropdown, .hidden-tracks-dropdown').forEach(d => d.style.display = 'none');

     const button = event && event.currentTarget ? event.currentTarget : (event ? event.target : null);
     let source = null;
     if (button && button.nextElementSibling && button.nextElementSibling.classList && button.nextElementSibling.classList.contains('dropdown-content')) {
         source = button.nextElementSibling;
     } else {
         // prefer a visible dropdown if present, otherwise fall back to first .dropdown-content
         source = Array.from(document.querySelectorAll('.dropdown-content')).find(d => d.style.display === 'block') || document.querySelector('.dropdown-content');
     }

     const modal = document.getElementById('fullDropdownModal');
     const inner = document.getElementById('fullDropdownInner');
     const closeBtn = document.getElementById('fullDropdownClose');

     if (!modal || !inner || !closeBtn) {
         console.error('Full dropdown modal elements missing.');
         return;
     }

     // Build a clean, professional header and content area
     inner.innerHTML = ''; // clear

     const header = document.createElement('div');
     header.style.display = 'flex';
     header.style.justifyContent = 'space-between';
     header.style.alignItems = 'center';
     header.style.padding = '8px 12px';
     header.style.borderBottom = '1px solid #eee';
     header.style.background = '#fafafa';
     header.style.fontWeight = '600';
     header.textContent = 'Menu';

     const actionsContainer = document.createElement('div');
     actionsContainer.style.padding = '12px';
     actionsContainer.style.display = 'flex';
     actionsContainer.style.flexDirection = 'column';
     actionsContainer.style.gap = '8px';

     if (source) {
         // If the source dropdown contains .dropdown-section groups, copy those sections preserving structure.
         const sections = source.querySelectorAll('.dropdown-section');
         if (sections && sections.length) {
             sections.forEach(sec => {
                 const secClone = document.createElement('div');
                 secClone.className = 'dropdown-section';
                 secClone.style.padding = sec.style.padding || '6px 8px';
                 // For each actionable child inside section (a, button), clone into a similar block preserving icons/tooltips.
                 Array.from(sec.children).forEach(child => {
                     const tag = child.tagName && child.tagName.toLowerCase();
                     const item = document.createElement(tag === 'a' ? 'a' : 'button');
                     item.style.display = 'block';
                     item.style.width = '100%';
                     item.style.textAlign = 'left';
                     item.style.padding = '8px 10px';
                     item.style.border = 'none';
                     item.style.background = 'transparent';
                     item.style.color = '#111';
                     item.style.fontSize = '14px';
                     item.style.cursor = 'pointer';
                     // copy inner content but strip any .info-icon to re-add as description
                     const temp = document.createElement('div');
                     temp.innerHTML = child.innerHTML;
                     // extract info-icon tooltip if present
                     const infoIcon = temp.querySelector('.info-icon');
                     let tooltipText = null;
                     if (infoIcon && infoIcon.getAttribute('data-tooltip')) {
                         tooltipText = infoIcon.getAttribute('data-tooltip');
                         infoIcon.remove();
                     } else if (child.getAttribute && child.getAttribute('data-tooltip')) {
                         tooltipText = child.getAttribute('data-tooltip');
                     }
                     item.innerHTML = temp.innerHTML;
                     if (tooltipText) {
                         const desc = document.createElement('div');
                         desc.className = 'item-desc';
                         desc.textContent = tooltipText;
                         desc.style.marginTop = '6px';
                         desc.style.fontSize = '13px';
                         desc.style.color = '#6b6f76';
                         item.appendChild(desc);
                     }
                     // preserve href or onclick where applicable
                     if (tag === 'a' && child.getAttribute('href')) {
                         item.href = child.getAttribute('href');
                         item.target = child.getAttribute('target') || '_self';
                     } else {
                         item.type = 'button';
                         if (child.getAttribute && child.getAttribute('onclick')) {
                             // keep inline attribute as a fallback for environments that expect it
                             item.setAttribute('onclick', child.getAttribute('onclick'));
                         }
                     }
                     // small interactions
                     item.addEventListener('mouseenter', () => item.style.background = '#f7f9fc');
                     item.addEventListener('mouseleave', () => item.style.background = 'transparent');

                     // Ensure the cloned item triggers the original source element's click handler so behavior is identical.
                     // Use event delegation to call the original element's click, then close the modal shortly after.
                     item.addEventListener('click', (ev) => {
                         ev.preventDefault();
                         try {
                             // Invoke the original element's click() to preserve any event listeners, inline onclicks, or behavior.
                             child.click();
                         } catch (e) {
                             // Fallback: evaluate inline onclick if present
                             const inline = child.getAttribute && child.getAttribute('onclick');
                             if (inline) {
                                 try { /* eslint-disable no-eval */ eval(inline); /* eslint-enable no-eval */ } catch (ex) { console.warn('Failed to eval inline onclick:', ex); }
                             }
                         }
                         // Close modal after a short delay to allow the action to run
                         setTimeout(() => closeFullDropdownModal(), 60);
                     });

                     secClone.appendChild(item);
                 });
                 actionsContainer.appendChild(secClone);

                 // add dividing spacer between sections for visual parity with inline dropdown
                 const divider = document.createElement('div');
                 divider.className = 'divider';
                 divider.style.margin = '6px 0';
                 actionsContainer.appendChild(divider);
             });
         } else {
             // Fallback: if no .dropdown-section groups, copy individual items preserving behavior.
             const items = source.querySelectorAll('a, button');
             items.forEach((it) => {
                 const clone = document.createElement(it.tagName.toLowerCase() === 'a' ? 'a' : 'button');
                 clone.className = it.className || '';
                 clone.style.display = 'block';
                 clone.style.width = '100%';
                 clone.style.textAlign = 'left';
                 clone.style.padding = '10px 12px';
                 clone.style.border = 'none';
                 clone.style.borderRadius = '8px';
                 clone.style.background = '#fff';
                 clone.style.cursor = 'pointer';
                 clone.style.fontSize = '14px';
                 clone.style.color = '#111';

                 const tempWrapper = document.createElement('div');
                 tempWrapper.innerHTML = it.innerHTML;
                 const infoIcon = tempWrapper.querySelector('.info-icon');
                 let tooltipText = null;
                 if (infoIcon && infoIcon.getAttribute('data-tooltip')) {
                     tooltipText = infoIcon.getAttribute('data-tooltip');
                     infoIcon.remove();
                 } else if (it.getAttribute && it.getAttribute('data-tooltip')) {
                     tooltipText = it.getAttribute('data-tooltip');
                 }
                 clone.innerHTML = tempWrapper.innerHTML;
                 if (tooltipText) {
                     const desc = document.createElement('div');
                     desc.className = 'item-desc';
                     desc.textContent = tooltipText;
                     desc.style.marginTop = '6px';
                     desc.style.fontSize = '13px';
                     desc.style.color = '#6b6f76';
                     clone.appendChild(desc);
                 }
                 if (it.tagName.toLowerCase() === 'a' && it.getAttribute('href')) {
                     clone.href = it.getAttribute('href');
                     clone.target = it.getAttribute('target') || '_self';
                 } else {
                     clone.type = 'button';
                     if (it.getAttribute && it.getAttribute('onclick')) {
                         // preserve inline attribute as fallback
                         clone.setAttribute('onclick', it.getAttribute('onclick'));
                     }
                 }
                 clone.addEventListener('mouseenter', () => clone.style.background = '#f7f9fc');
                 clone.addEventListener('mouseleave', () => clone.style.background = '#fff');

                 // Make the cloned control call the original source element to preserve identical behavior.
                 clone.addEventListener('click', (ev) => {
                     ev.preventDefault();
                     try {
                         it.click();
                     } catch (e) {
                         const inline = it.getAttribute && it.getAttribute('onclick');
                         if (inline) {
                             try { /* eslint-disable no-eval */ eval(inline); /* eslint-enable no-eval */ } catch (ex) { console.warn('Failed to eval inline onclick:', ex); }
                         }
                     }
                     setTimeout(() => closeFullDropdownModal(), 60);
                 });

                 actionsContainer.appendChild(clone);
             });
         }
     } else {
         const emptyMsg = document.createElement('div');
         emptyMsg.style.padding = '12px';
         emptyMsg.style.color = '#666';
         emptyMsg.textContent = 'No menu content available.';
         actionsContainer.appendChild(emptyMsg);
     }

     // Remove previous header if any and append new structure
     const existingHeader = document.getElementById('fullDropdownHeader');
     if (existingHeader) existingHeader.remove();

     header.id = 'fullDropdownHeader';
     inner.appendChild(header);
     inner.appendChild(actionsContainer);

     // Make modal visible with proper aria and focus management
     modal.style.display = 'flex';
     modal.setAttribute('aria-hidden', 'false');
     document.body.style.overflow = 'hidden';

     // Focus trap basics: focus close button first
     closeBtn.focus();

     function closeFullDropdownModal(e) {
         if (e) e.stopPropagation();
         modal.setAttribute('aria-hidden', 'true');
         modal.style.display = 'none';
         document.body.style.overflow = 'auto';
         document.removeEventListener('keydown', escHandler);
         modal.removeEventListener('click', outsideClickHandler);
     }

     function outsideClickHandler(e) {
         const content = document.getElementById('fullDropdownContent');
         if (content && !content.contains(e.target)) {
             closeFullDropdownModal();
         }
     }

     function escHandler(e) {
         if (e.key === 'Escape') closeFullDropdownModal();
     }

     // Attach handlers
     closeBtn.removeEventListener('click', closeFullDropdownModal);
     closeBtn.addEventListener('click', closeFullDropdownModal);
     modal.addEventListener('click', outsideClickHandler);
     document.addEventListener('keydown', escHandler);

     // Prevent clicks inside content from bubbling to modal outer and closing immediately
     const contentEl = document.getElementById('fullDropdownContent');
     if (contentEl) {
         contentEl.addEventListener('click', (ev) => ev.stopPropagation());
     }
 }


function toggleHiddenTracksDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('hiddenTracksDropdown');
    if (!dropdown) return;
    const hiddenTracks = tracks.filter(track => track.hidden);
    dropdown.innerHTML = '';

    if (!hiddenTracks.length) {
        dropdown.innerHTML = '<div class="hidden-track-item">No hidden tracks</div>';
    } else {
        hiddenTracks.forEach(track => {
            const index = tracks.indexOf(track);
            const item = document.createElement('div');
            item.className = 'hidden-track-item';
            item.innerHTML = `<span>${track.title}</span><button class="unhide-button" type="button">Unhide</button>`;
            item.querySelector('button').addEventListener('click', clickEvent => {
                clickEvent.stopPropagation();
                unhideTrack(index);
            });
            dropdown.appendChild(item);
        });
    }

    if (event) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleMusicVideosCollapse() {
    const container = document.querySelector('.music-videos-container');
    if (!container) return;
    container.classList.toggle('collapsed');
    localStorage.setItem('musicVideosCollapsed', container.classList.contains('collapsed'));
}

function toolbarGoBack() {
    switchToLibrary();
}

function toolbarGoForward() {
    switchToCreate();
}

function toggleMusicDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('toolbarMusicDropdown');
    if (!menu) return;
    menu.innerHTML = '';
    const music = document.createElement('button');
    music.setAttribute('role', 'menuitem');
    music.innerHTML = '<img src="note.png" alt="" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;">Music';
    music.onclick = () => selectMusicOption('music');
    const rollout = document.createElement('button');
    rollout.setAttribute('role', 'menuitem');
    rollout.innerHTML = '<img src="mic.png" alt="" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;">Rollout';
    rollout.onclick = () => selectMusicOption('rollout');
    menu.appendChild(music);
    menu.appendChild(rollout);
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function selectMusicOption(option = 'music') {
    const selector = document.querySelector('.toolbar-selector .sel-text');
    const icon = document.querySelector('.toolbar-selector .toolbar-note-icon');
    const menu = document.getElementById('toolbarMusicDropdown');
    if (menu) menu.style.display = 'none';
    if (option === 'rollout') {
        if (selector) selector.textContent = 'Rollout';
        if (icon) icon.src = 'mic.png';
        switchToRollout();
        return;
    }
    if (selector) selector.textContent = 'Music';
    if (icon) icon.src = 'note.png';
    switchToCreate();
}

function switchToRollout() {
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    let rolloutBtn = document.querySelector('.nav-button.rollout-nav');
    if (!rolloutBtn) {
        rolloutBtn = document.createElement('button');
        rolloutBtn.className = 'nav-button rollout-nav';
        rolloutBtn.textContent = 'Rollout';
        rolloutBtn.onclick = () => switchToRollout();
        document.querySelector('.navigation-bar')?.appendChild(rolloutBtn);
    }
    rolloutBtn.classList.add('active');

    document.querySelectorAll('.content, .music-videos-container, #libraryPage').forEach(el => {
        if (el) el.style.display = 'none';
    });

    let page = document.getElementById('rolloutPage');
    if (!page) {
        page = document.createElement('section');
        page.id = 'rolloutPage';
        page.className = 'rollout-page';
        document.querySelector('.itunes-window')?.appendChild(page);
    }
    page.style.display = 'block';
    renderRolloutPage();
}

function renderRolloutPage() {
    const page = document.getElementById('rolloutPage');
    if (!page) return;
    const timeline = Array.isArray(albumInfo.rollout) ? albumInfo.rollout : [];
    page.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <button id="rolloutAddBtnHeader" title="Add single" aria-label="Add single" style="background:#e6e6e8;border:none;color:#333;font-size:20px;width:40px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;">+</button>
                <h2 style="margin:0;font-size:18px;text-align:center;">Rollout Planner</h2>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
                <button id="rolloutSaveBtn" style="background:#007aff;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Save</button>
                <button id="rolloutClearBtn" style="background:#fff;color:#d33;border:1px solid #d0d0d0;padding:6px 10px;border-radius:8px;cursor:pointer;">CLEAR</button>
            </div>
        </div>
        <div id="rolloutSinglesDropdown" style="display:none;background:#fff;border:1px solid #eee;border-radius:8px;padding:8px;max-height:38vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,0.06);margin-bottom:12px;"></div>
        <div id="rolloutTimelineCanvas" style="width:100%;background:#f7f8fa;border:1px solid #eee;border-radius:12px;padding:18px 12px;box-sizing:border-box;min-height:460px;max-height:84vh;overflow:auto;"></div>
    `;
    document.getElementById('rolloutAddBtnHeader')?.addEventListener('click', toggleRolloutPicker);
    document.getElementById('rolloutSaveBtn')?.addEventListener('click', () => {
        saveToLocalStorage();
        showCustomAlert('Rollout saved to album and local storage.', 'Saved');
    });
    document.getElementById('rolloutClearBtn')?.addEventListener('click', async () => {
        const confirmed = await showCustomConfirm('Clear the rollout timeline?', 'Clear rollout');
        if (!confirmed) return;
        albumInfo.rollout = [];
        saveToLocalStorage();
        renderRolloutTimeline();
    });
    renderRolloutTimeline();
}

function toggleRolloutPicker(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('rolloutSinglesDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const addCustom = document.createElement('button');
    addCustom.className = 'track-list-button more-btn';
    addCustom.textContent = 'Add Custom';
    addCustom.onclick = () => {
        addRolloutItem({ type: 'custom', title: 'Custom Item', cover: 'default_itunes.png' });
        dropdown.style.display = 'none';
    };
    dropdown.appendChild(addCustom);
    (tracks || []).filter(track => !track.hidden).forEach(track => {
        const button = document.createElement('button');
        button.className = 'track-list-button more-btn';
        button.style.display = 'block';
        button.style.width = '100%';
        button.style.textAlign = 'left';
        button.textContent = track.title || 'Untitled';
        button.onclick = () => {
            addRolloutItem({
                type: 'single',
                title: track.title || 'Untitled',
                artist: track.artist || albumInfo.artist || '',
                cover: albumInfo.coverUrl || 'default_itunes.png',
                date: ''
            });
            dropdown.style.display = 'none';
        };
        dropdown.appendChild(button);
    });
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function addRolloutItem(item) {
    albumInfo.rollout = Array.isArray(albumInfo.rollout) ? albumInfo.rollout : [];
    albumInfo.rollout.push({ id: `rollout_${Date.now()}`, ...item });
    saveToLocalStorage();
    renderRolloutTimeline();
}

function renderRolloutTimeline() {
    const canvas = document.getElementById('rolloutTimelineCanvas');
    if (!canvas) return;
    const timeline = Array.isArray(albumInfo.rollout) ? albumInfo.rollout : [];
    if (!timeline.length) {
        canvas.innerHTML = '<div style="color:#666;text-align:center;padding:80px 20px;">No rollout items yet.</div>';
        return;
    }
    canvas.innerHTML = '';
    timeline.forEach((item, index) => {
        const tile = document.createElement('div');
        tile.className = 'timeline-tile';
        tile.style.cssText = 'display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eee;border-radius:10px;padding:10px;margin-bottom:10px;';
        tile.innerHTML = `
            <div style="width:54px;height:54px;border-radius:8px;background:#f0f0f0 center/cover no-repeat;background-image:url('${item.cover || 'default_itunes.png'}');"></div>
            <div style="flex:1;min-width:0;">
                <div contenteditable="true" data-field="title" style="font-weight:700;outline:none;">${escapeUiHtml(item.title || 'Untitled')}</div>
                <div contenteditable="true" data-field="artist" style="font-size:12px;color:#666;outline:none;">${escapeUiHtml(item.artist || albumInfo.artist || '')}</div>
            </div>
            <input type="date" value="${item.date || ''}" style="border:1px solid #ddd;border-radius:8px;padding:7px;">
            <button class="track-list-button more-btn" type="button">Remove</button>
        `;
        tile.querySelectorAll('[contenteditable]').forEach(editable => {
            editable.addEventListener('input', () => {
                item[editable.dataset.field] = editable.textContent.trim();
                saveToLocalStorage();
            });
        });
        tile.querySelector('input').addEventListener('input', event => {
            item.date = event.target.value;
            saveToLocalStorage();
        });
        tile.querySelector('button').addEventListener('click', () => {
            albumInfo.rollout.splice(index, 1);
            saveToLocalStorage();
            renderRolloutTimeline();
        });
        canvas.appendChild(tile);
    });
}

function escapeUiHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function openPlayerModal(mode = 'expanded') {
    activePlayerModal = mode;
    const expanded = document.getElementById('expandedAlbumViewPopup');
    const toolbar = document.getElementById('toolbarPlayerPopup');
    if (mode === 'toolbar') {
        if (toolbar) toolbar.style.display = 'flex';
        if (expanded) expanded.style.display = 'none';
    } else {
        if (expanded) expanded.style.display = 'block';
        if (toolbar) toolbar.style.display = 'none';
    }
    if (typeof updatePlayerModalContent === 'function') updatePlayerModalContent();
}

function closeExpandedAlbumView() {
    const expanded = document.getElementById('expandedAlbumViewPopup');
    if (expanded) expanded.style.display = 'none';
    activePlayerModal = null;
}

function toggleToolbarPlayerMenu(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('toolbarPlayerPopup');
    if (!popup) return;
    if (popup.style.display === 'flex') {
        closeToolbarPlayerMenu();
    } else {
        openPlayerModal('toolbar');
    }
}

function closeToolbarPlayerMenu() {
    const popup = document.getElementById('toolbarPlayerPopup');
    if (popup) popup.style.display = 'none';
    if (activePlayerModal === 'toolbar') activePlayerModal = null;
}

function switchPlayerSection(section, mode) {
    const root = mode === 'expanded' ? document.getElementById('expandedAlbumViewPopup') : document.getElementById('toolbarPlayerPopup');
    if (!root || !section) return;
    root.querySelectorAll('[data-section]').forEach(tab => tab.classList.toggle('active', tab.dataset.section === section));
    root.querySelectorAll('.expanded-album-view-section-content, .toolbar-player-section-content').forEach(panel => panel.classList.remove('active'));
    const panel = root.querySelector(`#${mode === 'expanded' ? 'expanded-player' : 'toolbar-player'}-${section}`);
    if (panel) panel.classList.add('active');
    if (typeof updatePlayerModalContent === 'function') updatePlayerModalContent();
}

function openVisualizerPopout(event) {
    if (event) event.stopPropagation();
    const popout = document.getElementById('visualizerPopout');
    if (popout) popout.style.display = 'block';
    if (typeof syncVisualizerStateAndData === 'function') syncVisualizerStateAndData();
}

function closeVisualizerPopout() {
    const popout = document.getElementById('visualizerPopout');
    if (popout) popout.style.display = 'none';
}

document.addEventListener('click', event => {
    document.querySelectorAll('.dropdown-content, .music-video-dropdown').forEach(dropdown => {
        const button = dropdown.previousElementSibling;
        if (!dropdown.contains(event.target) && (!button || !button.contains(event.target))) dropdown.style.display = 'none';
    });
    const hidden = document.getElementById('hiddenTracksDropdown');
    const search = document.getElementById('mainSearchBar');
    if (hidden && search && !hidden.contains(event.target) && !search.contains(event.target)) hidden.style.display = 'none';
    const musicMenu = document.getElementById('toolbarMusicDropdown');
    const musicButton = document.querySelector('.toolbar-selector');
    if (musicMenu && musicButton && !musicMenu.contains(event.target) && !musicButton.contains(event.target)) musicMenu.style.display = 'none';
});

window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;
