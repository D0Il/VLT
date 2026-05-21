// Main application entry point for the Visualizer iframe

// Import necessary components
import { Scene } from './components/scene.js';
import { ParticleSystem } from './components/particle-system.js';
import { AudioProcessor } from './components/audio-processor.js'; // This will be a dummy data holder
import { GalaxyBackground } from './components/galaxy-background.js';

// Detect if user is on mobile
const isMobile = /Android|webOS|iPhone|iPad|Poco|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Set particle count based on device
const PARTICLE_COUNT = isMobile ? 1500 : 5000;

// Add global error handler - simplified as visualizer won't handle media playback directly
window.addEventListener('unhandledrejection', function(event) {
    console.error('Visualizer: Unhandled rejection in visualizer iframe:', event.reason);
});

// Initialize all components
const scene = new Scene('visualizer');
const particleSystem = new ParticleSystem(scene.scene, PARTICLE_COUNT, isMobile);
// AudioProcessor now only acts as a data provider, not an actual audio processor.
const audioProcessor = new AudioProcessor(); // Simplified AudioProcessor instance
const galaxyBackground = new GalaxyBackground(scene.scene);

// Store the current audio data and playing state received from the parent
let receivedIsPlaying = false; // Flag to track if parent reports audio is playing
let isRenderingPaused = true; // Start in a paused state

// Listen for messages from parent window to receive audio data and state
window.addEventListener('message', function(event) {
    // Only process messages from trusted origins in a production environment
    // For this example, '*' is used as the origin is dynamic.
    if (event.data.type === 'audioDataUpdate') {
        // Debugging: Log data being received extensively
        console.log("Visualizer: Received audioDataUpdate:", {
            averageFrequency: event.data.averageFrequency,
            dataArrayLength: event.data.dataArray.length,
            firstFewBytes: event.data.dataArray.slice(0, 10),
            isPlaying: event.data.isPlaying
        });
        const { dataArray, averageFrequency, isPlaying } = event.data;
        // Update the dummy audio processor with the received data
        audioProcessor.setAudioData(dataArray, averageFrequency);
        receivedIsPlaying = isPlaying; // Update received playing state
    } else if (event.data.type === 'exitFullscreen') {
        console.log("Visualizer: Received exitFullscreen request.");
        exitFullscreen();
    } else if (event.data.type === 'pauseRendering') {
        console.log("Visualizer: Received pauseRendering request.");
        isRenderingPaused = true;
    } else if (event.data.type === 'resumeRendering') {
        console.log("Visualizer: Received resumeRendering request.");
        isRenderingPaused = false;
    }
});

// Function to control fullscreen mode
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.querySelector('.container').requestFullscreen().catch(err => {
            console.error('Visualizer: Error attempting to enable fullscreen:', err);
        });
        document.getElementById('exitFullscreenButton').classList.remove('hidden');
    } else {
        exitFullscreen();
    }
}

function exitFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen()
            .catch(err => console.error('Visualizer: Error exiting fullscreen:', err));
    }
    document.getElementById('exitFullscreenButton').classList.add('hidden');
}

// Attach exit fullscreen button listener
document.getElementById('exitFullscreenButton').addEventListener('click', exitFullscreen);

// Listen for ESC key to exit fullscreen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.fullscreenElement) {
        exitFullscreen();
    }
});

// Start animation loop
let lastTime = 0;
scene.startAnimation((time) => {
    // If rendering is paused, skip the update and render cycle.
    if (isRenderingPaused) {
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    const audioData = audioProcessor.getAudioData(); // Get the latest data received from parent
    
    galaxyBackground.animate(deltaTime, audioData);
    particleSystem.updateWithAudio(audioData);

    // Dynamic rotation for particles
    if (receivedIsPlaying) { // Use the received 'isPlaying' flag
        const avgFrequency = audioData.average;
        particleSystem.rotate(avgFrequency);
    } else {
        // Subtle rotation when paused
        particleSystem.rotate(0);
    }
});

// Handle window resize
window.addEventListener('resize', () => scene.onResize());

// Expose functions to parent for control (e.g., fullscreen)
window.toggleVisualizerFullscreen = toggleFullscreen;
window.exitVisualizerFullscreen = exitFullscreen;