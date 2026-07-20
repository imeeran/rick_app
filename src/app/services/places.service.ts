// places.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private geocoder: google.maps.Geocoder;

  constructor() {
    this.geocoder = new google.maps.Geocoder();
  }

  // ---- New Places API (New) Autocomplete ----
  async getPlacePredictions(input: string): Promise<google.maps.places.AutocompleteSuggestion[]> {
    if (!input || input.trim().length === 0) {
      return [];
    }

    try {
      const sessionToken = new google.maps.places.AutocompleteSessionToken();

      const request: google.maps.places.AutocompleteRequest = {
        input: input,
        includedTypes: ['address'],   // ✅ Fixed: use includedTypes
        sessionToken: sessionToken
        // Optional: locationBias: { lat: 25.2048, lng: 55.2708 }
      }as google.maps.places.AutocompleteRequest;

      const response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      return response.suggestions || [];
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  // ---- Geocoding (Place Details) ----
  getPlaceDetails(placeId: string): Promise<google.maps.GeocoderResult> {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ placeId }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  // ---- Reverse Geocoding ----
  reverseGeocode(lat: number, lng: number): Promise<google.maps.GeocoderResult> {
    return new Promise((resolve, reject) => {
      const latLng = new google.maps.LatLng(lat, lng);
      this.geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }
}