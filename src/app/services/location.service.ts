import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor() {}

  // Get the current GPS position
  async getCurrentPosition(): Promise<Position | null> {
    try {
      // Check and request permissions
      const permStatus = await Geolocation.checkPermissions();
      if (permStatus.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          return null;
        }
      }
      // Fetch the location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return position;
    } catch (error) {
      console.error('Error getting location', error);
      return null;
    }
  }
}