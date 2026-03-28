import React, { useCallback, useRef, useState, useEffect } from 'react';
import { RoutePreferences as RoutePreferencesType } from '../types';
import ToggleOption from './ToggleOption';

interface Props {
  preferences: RoutePreferencesType;
  onChange: (preferences: RoutePreferencesType) => void;
}

export const RoutePreferencesPanel: React.FC<Props> = ({ preferences, onChange }) => {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [localCurviness, setLocalCurviness] = useState(preferences.curviness);

  // Sync local curviness when preferences change externally
  useEffect(() => {
    setLocalCurviness(preferences.curviness);
  }, [preferences.curviness]);

  const handleChange = useCallback(
    (key: keyof RoutePreferencesType, value: boolean | number) => {
      onChange({ ...preferences, [key]: value });
    },
    [preferences, onChange]
  );

  // Debounced curviness slider handler
  const handleCurvinessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setLocalCurviness(value);

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer - call onChange after slider stops moving
      debounceTimerRef.current = setTimeout(() => {
        onChange({ ...preferences, curviness: value });
      }, 300); // Wait 300ms after slider stops moving
    },
    [preferences, onChange]
  );

  const getCurvinessLabel = (value: number): string => {
    if (value < 25) return 'Direct';
    if (value < 50) return 'Moderate';
    if (value < 75) return 'Curvy';
    return 'Very Curvy';
  };

  return (
    <div className="bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-lg p-5 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        Route Preferences
      </h3>

      {/* Curviness Slider */}
      <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-800">Curviness Level</label>
          <span className="px-3 py-1 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full">{getCurvinessLabel(localCurviness)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={localCurviness}
          onChange={handleCurvinessChange}
          className="w-full h-3 bg-gradient-to-r from-gray-300 to-orange-300 rounded-lg appearance-none cursor-pointer accent-orange-600 shadow-sm"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-3 font-medium">
          <span>🏁 Direct Route</span>
          <span>🛣️ Scenic Route</span>
        </div>
      </div>

      {/* Toggle Options */}
      <div className="space-y-3">
        {/* Units Toggle */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <span className="text-sm font-semibold text-gray-800 flex-1">Distance Units</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleChange('units', 'km')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                preferences.units === 'km'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              km
            </button>
            <button
              onClick={() => handleChange('units', 'miles')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                preferences.units === 'miles'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              mi
            </button>
          </div>
        </div>

        <ToggleOption
          label="Avoid Highways"
          description="Skip major highways and motorways"
          icon="🚧"
          checked={preferences.avoidHighways}
          onChange={(checked) => handleChange('avoidHighways', checked)}
        />

        <ToggleOption
          label="Avoid Tolls"
          description="Skip toll roads and bridges"
          icon="💳"
          checked={preferences.avoidTolls}
          onChange={(checked) => handleChange('avoidTolls', checked)}
        />

        <ToggleOption
          label="Avoid Ferries"
          description="Skip ferry crossings"
          icon="⛴️"
          checked={preferences.avoidFerries}
          onChange={(checked) => handleChange('avoidFerries', checked)}
        />

        <ToggleOption
          label="Prefer Scenic Routes"
          description="Prioritize scenic roads"
          icon="🌄"
          checked={preferences.preferScenic}
          onChange={(checked) => handleChange('preferScenic', checked)}
        />

        <ToggleOption
          label="Voice Alerts"
          description="Speak turn-by-turn directions"
          icon="🔊"
          checked={preferences.voiceAlerts}
          onChange={(checked) => handleChange('voiceAlerts', checked)}
        />

        <ToggleOption
          label="Speed Camera Alerts"
          description="Alert when speed cameras detected"
          icon="📹"
          checked={preferences.speedCameraAlerts}
          onChange={(checked) => handleChange('speedCameraAlerts', checked)}
        />
      </div>
    </div>
  );
};
