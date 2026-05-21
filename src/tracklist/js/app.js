window.addEventListener('DOMContentLoaded', function () {
  loadFromLocalStorage();
  renderTracks();
  renderAlbumInfo();
  renderMusicVideos();
  if (typeof updateAlbumCoverStyle === 'function') updateAlbumCoverStyle();
  if (typeof updateArtistHeader === 'function') updateArtistHeader();
  if (typeof updateNowPlaying === 'function') updateNowPlaying();

  const shuffleButton = document.getElementById('shuffleButton');
  if (shuffleButton) shuffleButton.setAttribute('data-shuffle-mode', 'false');

  const videosHeading = document.querySelector('.music-videos-container h2');
  if (videosHeading && typeof toggleMusicVideosCollapse === 'function') {
    videosHeading.addEventListener('click', toggleMusicVideosCollapse);
  }

  const nowPlayingCover = document.getElementById('nowPlayingCover');
  if (nowPlayingCover && typeof openPlayerModal === 'function') {
    nowPlayingCover.addEventListener('click', () => openPlayerModal('expanded'));
  }

  const mainSearchBar = document.getElementById('mainSearchBar');
  if (mainSearchBar) {
    mainSearchBar.addEventListener('input', () => {
      if (document.getElementById('libraryPage')?.style.display !== 'none') loadLibraryAlbums();
    });
  }

  document.querySelectorAll('#toolbarPlayerPopup .toolbar-player-tab').forEach(tab => {
    tab.addEventListener('click', event => {
      if (typeof switchPlayerSection === 'function') switchPlayerSection(event.target.dataset.section, 'toolbar');
    });
  });

  document.querySelectorAll('#expandedAlbumViewPopup .expanded-album-view-section-tab').forEach(tab => {
    tab.addEventListener('click', event => {
      if (typeof switchPlayerSection === 'function') switchPlayerSection(event.target.dataset.section, 'expanded');
    });
  });
});

function hideTracklistPages() {
  const libraryPage = document.getElementById('libraryPage');
  const rolloutPage = document.getElementById('rolloutPage');
  if (libraryPage) libraryPage.style.display = 'none';
  if (rolloutPage) rolloutPage.style.display = 'none';
}

function switchToCreate() {
  document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
  const createBtn = document.querySelector('.nav-button[onclick="switchToCreate()"]');
  if (createBtn) createBtn.classList.add('active');
  hideTracklistPages();
  document.querySelectorAll('.content, .main-content, .left-column, .right-column, #trackList, .album-header, .album-info, #albumCover, .music-videos-container').forEach(el => {
    el.style.display = '';
  });
}

function switchToLibrary() {
  document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
  const libBtn = document.querySelector('.nav-button[onclick="switchToLibrary()"]');
  if (libBtn) libBtn.classList.add('active');
  document.querySelectorAll('.content, .music-videos-container').forEach(el => {
    el.style.display = 'none';
  });
  const rolloutPage = document.getElementById('rolloutPage');
  if (rolloutPage) rolloutPage.style.display = 'none';
  const libraryPage = document.getElementById('libraryPage');
  if (libraryPage) libraryPage.style.display = 'block';
  loadLibraryAlbums();
}

function getLibraryAlbums() {
  try {
    return JSON.parse(localStorage.getItem('vaultTracklistLibrary') || '[]');
  } catch (error) {
    console.error('Could not read local tracklist library:', error);
    return [];
  }
}

function setLibraryAlbums(albums) {
  localStorage.setItem('vaultTracklistLibrary', JSON.stringify(albums));
}

function currentAlbumPayload() {
  return {
    tracks: JSON.parse(JSON.stringify(tracks || [])),
    albumInfo: JSON.parse(JSON.stringify(albumInfo || {})),
    musicVideos: JSON.parse(JSON.stringify(musicVideos || []))
  };
}

function loadLibraryAlbums() {
  const albumsGrid = document.getElementById('albumsGrid');
  const favoritesGrid = document.getElementById('favoritesGrid');
  const favoritesHeader = document.getElementById('favoritesHeader');
  if (!albumsGrid || !favoritesGrid) return;

  const query = (document.getElementById('mainSearchBar')?.value || '').trim().toLowerCase();
  const albums = getLibraryAlbums()
    .filter(album => {
      const info = album.album_data?.albumInfo || {};
      const haystack = `${album.album_name || ''} ${info.title || ''} ${info.artist || ''}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  const favorites = albums.filter(album => album.isFavorited);
  const regular = albums.filter(album => !album.isFavorited);

  renderAlbums(regular, albumsGrid);
  renderAlbums(favorites, favoritesGrid);

  if (favoritesHeader) favoritesHeader.style.display = favorites.length ? 'block' : 'none';
  if (!albums.length) albumsGrid.innerHTML = '<div class="no-albums">No saved albums found. Create and save an album to see it here.</div>';
}

function renderAlbums(savedAlbums, albumsGrid) {
  albumsGrid.innerHTML = '';
  if (!savedAlbums.length) {
    albumsGrid.innerHTML = '<div class="no-albums">No saved albums found. Create and save an album to see it here.</div>';
    return;
  }

  savedAlbums.forEach(album => {
    const albumData = album.album_data || {};
    const info = albumData.albumInfo || {};
    const coverImage = info.coverUrl || 'default_itunes.png';
    const visibleTracks = (albumData.tracks || []).filter(track => !track.hidden);
    const card = document.createElement('div');
    card.className = 'album-card';
    card.onclick = event => {
      if (event.target.closest('.delete-album-btn') || event.target.closest('.favorite-album-btn')) return;
      loadAlbumFromLibrary(album.id);
    };
    card.innerHTML = `
      <div class="album-card-cover" style="background-image: url('${coverImage}')"></div>
      <div class="album-card-info">
        <h3>${escapeTracklistHtml(info.title || album.album_name || 'Unnamed Album')}</h3>
        <p class="album-artist">${escapeTracklistHtml(info.artist || 'Unknown Artist')}</p>
        <p class="album-meta">${visibleTracks.length} song${visibleTracks.length !== 1 ? 's' : ''} • ${escapeTracklistHtml(info.year || 'Unknown')}</p>
      </div>
      <button class="delete-album-btn" type="button" aria-label="Delete">×</button>
      <button class="favorite-album-btn ${album.isFavorited ? 'is-favorite' : ''}" type="button" aria-label="Favorite">♡</button>
    `;
    card.querySelector('.delete-album-btn').addEventListener('click', event => deleteAlbum(event, album.id));
    card.querySelector('.favorite-album-btn').addEventListener('click', event => toggleFavoriteAlbum(event, album.id));
    albumsGrid.appendChild(card);
  });
}

function escapeTracklistHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function loadAlbumFromLibrary(albumId) {
  const album = getLibraryAlbums().find(item => item.id === albumId);
  if (!album || !album.album_data) {
    alert('Album not found in your library.');
    return;
  }
  _loadAlbumData(album.album_data);
  switchToCreate();
}

async function deleteAlbum(event, albumId) {
  if (event) event.stopPropagation();
  const album = getLibraryAlbums().find(item => item.id === albumId);
  const name = album?.album_data?.albumInfo?.title || album?.album_name || 'this album';
  const confirmed = window.showCustomConfirm
    ? await window.showCustomConfirm(`Delete "${name}" from Library?`, 'Delete album')
    : confirm(`Delete "${name}" from Library?`);
  if (!confirmed) return;
  setLibraryAlbums(getLibraryAlbums().filter(item => item.id !== albumId));
  loadLibraryAlbums();
}

function toggleFavoriteAlbum(event, albumId) {
  if (event) event.stopPropagation();
  const albums = getLibraryAlbums();
  const album = albums.find(item => item.id === albumId);
  if (!album) return;
  album.isFavorited = !album.isFavorited;
  album.updated_at = new Date().toISOString();
  setLibraryAlbums(albums);
  loadLibraryAlbums();
}

document.addEventListener('click', function (event) {
  document.querySelectorAll('.dropdown-content').forEach(dropdown => {
    const moreButton = dropdown.previousElementSibling;
    if (moreButton && !moreButton.contains(event.target) && !dropdown.contains(event.target)) dropdown.style.display = 'none';
  });

  const hiddenTracksDropdown = document.getElementById('hiddenTracksDropdown');
  const searchBar = document.getElementById('mainSearchBar');
  if (hiddenTracksDropdown && searchBar && !searchBar.contains(event.target) && !hiddenTracksDropdown.contains(event.target)) {
    hiddenTracksDropdown.style.display = 'none';
  }

  document.querySelectorAll('.music-video-dropdown').forEach(dropdown => {
    const actionButton = dropdown.previousElementSibling;
    if (actionButton && !actionButton.contains(event.target) && !dropdown.contains(event.target)) dropdown.style.display = 'none';
  });

  const toolbarPlayerPopup = document.getElementById('toolbarPlayerPopup');
  const toolbarMenuButton = document.getElementById('toolbarMenuButton');
  if (toolbarPlayerPopup && toolbarMenuButton && toolbarPlayerPopup.style.display === 'flex' && !toolbarPlayerPopup.contains(event.target) && !toolbarMenuButton.contains(event.target)) {
    closeToolbarPlayerMenu();
  }
});

window.switchToCreate = switchToCreate;
window.switchToLibrary = switchToLibrary;
window.loadLibraryAlbums = loadLibraryAlbums;
window.loadAlbumFromLibrary = loadAlbumFromLibrary;
window.deleteAlbum = deleteAlbum;
window.toggleFavoriteAlbum = toggleFavoriteAlbum;
window.getLibraryAlbums = getLibraryAlbums;
window.setLibraryAlbums = setLibraryAlbums;
window.currentAlbumPayload = currentAlbumPayload;
