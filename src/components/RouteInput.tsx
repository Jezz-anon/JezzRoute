import React, { useState } from 'react';
import { Waypoint } from '../types';

interface Props {
  fromLocation: string;
  toLocation: string;
  onFromChange: (location: string) => void;
  onToChange: (location: string) => void;
  onSetWaypoints: (from: Waypoint, to: Waypoint) => void;
  isLoading: boolean;
}

export const RouteInput: React.FC<Props> = ({
  fromLocation,
  toLocation,
  onFromChange,
  onToChange,
  onSetWaypoints,
  isLoading,
}) => {
  const [error, setError] = useState<string>('');

  // Geocode address using Nominatim (OpenStreetMap)
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address.trim()) {
      setError('Please enter a location');
      return null;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const results = await response.json();

      if (results.length === 0) {
        setError(`Could not find location: ${address}`);
        return null;
      }

      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
    } catch (err) {
      setError('Failed to geocode address');
      console.error(err);
      return null;
    }
  };

  const handleSetRoute = async () => {
    setError('');

    if (!fromLocation.trim() || !toLocation.trim()) {
      setError('Please enter both "From" and "To" locations');
      return;
    }

    const from = await geocodeAddress(fromLocation);
    const to = await geocodeAddress(toLocation);

    if (from && to) {
      console.log('Setting waypoints:', { from, to });
      onSetWaypoints(
        {
          id: `from-${Date.now()}`,
          lat: from.lat,
          lng: from.lng,
          name: fromLocation,
          order: 0,
        },
        {
          id: `to-${Date.now()}`,
          lat: to.lat,
          lng: to.lng,
          name: toLocation,
          order: 1,
        }
      );
    } else {
      console.error('Failed to geocode one or both addresses');
    }
  };

  const handleUseCurrentLocation = () => {
    setError('');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`Got location: ${latitude}, ${longitude}, accuracy: ${accuracy}m`);
          
          // High accuracy reverse geocoding with full address details
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`
          )
            .then(res => res.json())
            .then(data => {
              const address = data.address;
              console.log('Reverse geocoding result:', address);
              
              // UK postcode takes priority
              let displayAddress = address?.postcode;
              
              if (!displayAddress) {
                // If no postcode, try specific locations in order
                displayAddress = 
                  address?.hamlet ||
                  address?.village ||
                  address?.neighbourhood ||
                  address?.suburb ||
                  address?.residential ||
                  address?.town ||
                  address?.city;
              }
              
              // Fallback to coordinates if nothing else found
              if (!displayAddress) {
                displayAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
              }
              
              // Add county/district for context
              if (displayAddress && displayAddress !== `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`) {
                const context = address?.county || address?.state_district || address?.district;
                if (context) {
                  displayAddress = `${displayAddress}, ${context}`;
                }
              }
              
              console.log('Display address:', displayAddress);
              onFromChange(displayAddress);
            })
            .catch((err) => {
              console.error('Reverse geocoding failed:', err);
              onFromChange(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            });
        },
        (error) => {
          setError(`Geolocation error: ${error.message}`);
          console.error(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      setError('Geolocation not supported by your browser');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        Route Planner
      </h3>

      <div className="space-y-3">
        {/* From Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <span className="text-green-600">●</span> From
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={fromLocation}
              onChange={(e) => onFromChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetRoute()}
              placeholder="Enter starting location..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={handleUseCurrentLocation}
              title="Use my current location"
              className="px-2.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex-shrink-0 text-sm font-semibold"
            >
              📍
            </button>
          </div>
        </div>

        {/* To Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <span className="text-red-600">●</span> To
          </label>
          <input
            type="text"
            value={toLocation}
            onChange={(e) => onToChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetRoute()}
            placeholder="Enter destination..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Set Route Button */}
        <button
          onClick={handleSetRoute}
          disabled={isLoading || !fromLocation.trim() || !toLocation.trim()}
          className="w-full py-2 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {isLoading ? 'Locating...' : 'Set Route'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Press Enter or click Set Route to geocode locations
        </p>
      </div>
    </div>
  );
};
