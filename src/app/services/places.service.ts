// places.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private autocompleteService: google.maps.places.AutocompleteService;
  private geocoder: google.maps.Geocoder;

  constructor() {
    this.autocompleteService = new google.maps.places.AutocompleteService();
    this.geocoder = new google.maps.Geocoder();
  }

  // Existing: get predictions
  getPlacePredictions(input: string): Promise<google.maps.places.AutocompletePrediction[]> {
    return new Promise((resolve, reject) => {
      if (!input) {
        resolve([]);
        return;
      }
      this.autocompleteService.getPlacePredictions(
        { input, types: ['geocode', 'establishment'] },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            resolve(predictions);
          } else {
            reject(status);
          }
        }
      );
    });
  }

  // Existing: get details by place ID
  getPlaceDetails(placeId: string): Promise<google.maps.GeocoderResult> {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ placeId }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else {
          reject(status);
        }
      });
    });
  }

  // NEW: Reverse geocode coordinates to address
  reverseGeocode(lat: number, lng: number): Promise<google.maps.GeocoderResult> {
    return new Promise((resolve, reject) => {
      const latLng = new google.maps.LatLng(lat, lng);
      this.geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else {
          reject(status);
        }
      });
    });
  }
}