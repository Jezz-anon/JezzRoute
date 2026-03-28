// Voice alerts system for the app
// Uses Web Speech API for text-to-speech

export interface VoiceAlertPreference {
  enabled: boolean;
  volume: number;
}

class VoiceAlertSystem {
  private synth: SpeechSynthesis;
  private enabled: boolean = false;
  private volume: number = 1;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.synth.cancel();
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private speak(text: string) {
    if (!this.enabled || !this.synth) {
      return;
    }

    // Cancel any previous speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.volume;
    utterance.rate = 1;
    utterance.pitch = 1;

    this.synth.speak(utterance);
  }

  routeCalculated(distance: string, duration: string) {
    this.speak(`Route calculated. ${distance} in ${duration}.`);
  }

  waypointAdded(name: string) {
    this.speak(`Waypoint added: ${name}`);
  }

  waypointRemoved(name: string) {
    this.speak(`Waypoint removed: ${name}`);
  }

  routeCleared() {
    this.speak('Route cleared');
  }

  routeSaved(name: string) {
    this.speak(`Route saved: ${name}`);
  }

  routeLoaded(name: string) {
    this.speak(`Route loaded: ${name}`);
  }

  destinationReached() {
    this.speak('Destination reached');
  }

  turnWarning(turn: string) {
    this.speak(`${turn}`);
  }

  proximityAlert(poiType: string) {
    const alerts: { [key: string]: string } = {
      fuel: 'Fuel station nearby',
      camera: 'Speed camera ahead',
      accommodation: 'Hotel nearby',
      restaurant: 'Restaurant nearby',
      parking: 'Parking available',
    };
    this.speak(alerts[poiType] || 'Point of interest nearby');
  }

  speedCameraWarning(count: number = 1) {
    if (count > 1) {
      this.speak(`Warning: ${count} speed cameras detected ahead`);
    } else {
      this.speak('Warning: Speed camera ahead');
    }
  }
}

export const voiceAlerts = new VoiceAlertSystem();
