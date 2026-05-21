// Album information management
function renderAlbumInfo() {
    document.querySelector('.album-header h1').textContent = albumInfo.title;
    document.querySelector('.album-header p:nth-child(2)').textContent = albumInfo.artist;
    document.querySelector('.album-header .genre-year span:first-child').textContent = albumInfo.genre;
    document.querySelector('.album-header .genre-year span:last-child').textContent = albumInfo.year;
    document.querySelector('.editors-notes p').textContent = albumInfo.editorNotes;
    document.querySelector('.album-info p:nth-child(1) span').textContent = albumInfo.releaseDate;
    document.querySelector('.album-info p:nth-child(2) span').textContent = albumInfo.label;
    
    const albumCover = document.getElementById('albumCover');
    if (albumInfo.coverUrl) {
        albumCover.style.backgroundImage = `url('${albumInfo.coverUrl}')`;
    } else {
        albumCover.style.backgroundImage = `url('default_itunes.png')`;
    }
}

function saveAlbumInfo(element, field) {
    albumInfo[field] = element.textContent;
    saveToLocalStorage();
}

function saveEditorNotes(element) {
    albumInfo.editorNotes = element.textContent;
    saveToLocalStorage();
}

// Cover upload handler
document.getElementById('coverUpload').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (file) {
        try {
            // Upload the file to get a permanent URL instead of using base64
            const coverUrl = await window.vaultLocalUpload(file);
            document.getElementById('albumCover').style.backgroundImage = `url('${coverUrl}')`;
            albumInfo.coverUrl = coverUrl;
            saveToLocalStorage();
            if (currentPlayingIndex !== -1) {
                document.getElementById('nowPlayingCover').style.backgroundImage = `url('${coverUrl}')`;
            }
        } catch (error) {
            console.error('Error uploading cover image:', error);
            alert('Failed to upload cover image. Please try again.');
        }
    }
});