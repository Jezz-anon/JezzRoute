import React, { useState } from 'react';

export interface POILayerState {
  fuelStations: boolean;
  speedCameras: boolean;
  accommodations: boolean;
  restaurants: boolean;
  parkingAreas: boolean;
}

interface Props {
  poiLayers: POILayerState;
  onChange: (layers: POILayerState) => void;
}

export const MapPOILayers: React.FC<Props> = ({ poiLayers, onChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleToggle = (key: keyof POILayerState) => {
    onChange({
      ...poiLayers,
      [key]: !poiLayers[key],
    });
  };

  const poiOptions = [
    { key: 'fuelStations', label: 'Fuel Stations', icon: '⛽', color: 'yellow' },
    { key: 'speedCameras', label: 'Speed Cameras', icon: '📹', color: 'red' },
    { key: 'accommodations', label: 'Accommodations', icon: '🛏️', color: 'blue' },
    { key: 'restaurants', label: 'Restaurants', icon: '🍴', color: 'green' },
    { key: 'parkingAreas', label: 'Parking Areas', icon: '🅿️', color: 'purple' },
  ] as const;

  const activeCount = Object.values(poiLayers).filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-orange-50 flex items-center justify-between transition-colors bg-gradient-to-r from-white to-gray-50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <span className="text-lg">📍</span>
          <span>Map Layers</span>
          {activeCount > 0 && (
            <span className="text-xs font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </h3>
        <button className="text-gray-600 hover:text-orange-600 transition-colors p-0.5">
          {isCollapsed ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-2">
          {poiOptions.map(({ key, label, icon }) => (
            <div
              key={key}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-orange-50 border border-transparent"
              onClick={() => handleToggle(key)}
            >
              <input
                type="checkbox"
                checked={poiLayers[key]}
                onChange={() => handleToggle(key)}
                className="w-4 h-4 rounded cursor-pointer accent-orange-600 shadow-sm flex-shrink-0"
              />
              <span className="text-lg flex-shrink-0">{icon}</span>
              <label className="text-sm font-medium text-gray-800 cursor-pointer flex-1">
                {label}
              </label>
              {poiLayers[key] && (
                <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-lg"></div>
              )}
            </div>
          ))}
          <div className="text-xs text-gray-600 px-3 py-2 mt-3 border-t border-gray-200 pt-3 bg-gray-50 rounded-lg font-medium">
            <p>📍 POI data from OpenStreetMap (beta)</p>
          </div>
        </div>
      )}
    </div>
  );
};
