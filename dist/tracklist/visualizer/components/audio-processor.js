import * as THREE from 'three'; // Import THREE if needed, otherwise remove

// This AudioProcessor is now a dummy, it only stores and retrieves audio data
// sent from the parent window. It does not handle audio processing itself.
export class AudioProcessor {
    constructor() {
        this.dataArray = new Uint8Array(256); // Default size, might be overridden by parent data
        this.averageFrequency = 0;
    }

    // This method is called by main.js to update the audio data from the parent
    setAudioData(dataArray, averageFrequency) {
        this.dataArray = new Uint8Array(dataArray); // Ensure it's a Uint8Array
        this.averageFrequency = averageFrequency;
    }

    // Methods to provide the data to other components
    getAudioData() {
        return {
            data: this.dataArray,
            average: this.averageFrequency
        };
    }

    getAverageFrequency() {
        return this.averageFrequency;
    }
}