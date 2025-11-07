import masterTableService from './masterTableService';

class LocationService {
  constructor() {
    this.currentPosition = null;
    this.locationPermission = null;
    this.nearbyMarkets = [];
  }

  /**
   * Request location permission from user
   */
  async requestLocationPermission() {
    if (!navigator.geolocation) {
      return {
        success: false,
        error: 'Geolocation is not supported by your browser'
      };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });

      this.currentPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };

      this.locationPermission = 'granted';
      
      // Get location details from coordinates
      const locationDetails = await this.getLocationFromCoordinates(
        position.coords.latitude, 
        position.coords.longitude
      );

      return {
        success: true,
        position: this.currentPosition,
        locationDetails
      };
    } catch (error) {
      this.locationPermission = 'denied';
      
      let errorMessage = 'Unable to get your location';
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location services.';
      } else if (error.code === 2) {
        errorMessage = 'Location information is unavailable.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out.';
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: error.code
      };
    }
  }

  /**
   * Get location details from coordinates using reverse geocoding
   */
  async getLocationFromCoordinates(latitude, longitude) {
    try {
      // Using OpenStreetMap's Nominatim API for reverse geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'AgriGuru Market Price App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get location details');
      }

      const data = await response.json();
      
      // Extract relevant location information
      const address = data.address || {};
      
      return {
        city: address.city || address.town || address.village || null,
        district: address.county || address.state_district || null,
        state: address.state || null,
        country: address.country || 'India',
        displayName: data.display_name || '',
        raw: address
      };
    } catch (error) {
      console.error('Error getting location from coordinates:', error);
      return null;
    }
  }

  /**
   * Get nearby markets based on current location
   */
  async getNearbyMarkets(limit = 10, maxDistance = 150) {
    if (!this.currentPosition) {
      const locationResult = await this.requestLocationPermission();
      if (!locationResult.success) {
        return {
          success: false,
          error: locationResult.error
        };
      }
    }

    try {
      // Get location details
      const locationDetails = await this.getLocationFromCoordinates(
        this.currentPosition.latitude,
        this.currentPosition.longitude
      );

      if (!locationDetails) {
        return {
          success: false,
          error: 'Unable to determine your location'
        };
      }

      // Get nearby markets from master table service with actual coordinates
      const nearbyMarkets = await masterTableService.getNearbyMarketsWithCoords(
        this.currentPosition.latitude,
        this.currentPosition.longitude,
        limit,
        maxDistance
      );

      this.nearbyMarkets = nearbyMarkets;

      return {
        success: true,
        markets: nearbyMarkets,
        userLocation: locationDetails
      };
    } catch (error) {
      console.error('Error getting nearby markets:', error);
      return {
        success: false,
        error: 'Failed to get nearby markets'
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  /**
   * Get current position
   */
  getCurrentPosition() {
    return this.currentPosition;
  }

  /**
   * Check if location permission is granted
   */
  hasLocationPermission() {
    return this.locationPermission === 'granted';
  }

  /**
   * Clear cached location
   */
  clearLocation() {
    this.currentPosition = null;
    this.nearbyMarkets = [];
  }
}

export default new LocationService();
