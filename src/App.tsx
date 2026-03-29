import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MotorcycleRoute, Waypoint, createDefaultRoute } from './types';
import { RouteMap } from './components/RouteMap';
import { RoutePreferencesPanel } from './components/RoutePreferencesPanel';
import { WaypointsList } from './components/WaypointsList';
import { RouteInput } from './components/RouteInput';
import { ExportPanel } from './components/ExportPanel';
import { SavedRoutes } from './components/SavedRoutes';
import { MapPOILayers, POILayerState } from './components/MapPOILayers';
import { importGPXToRoute } from './utils/importUtils';
import { calculateRoute, RouteChunk } from './utils/routing';
import { saveRoute, formatDistance, formatDuration } from './utils/routeStorage';
import { voiceAlerts } from './utils/voiceAlerts';
import 'leaflet/dist/leaflet.css';

function App() {
  const [route, setRoute] = useState<MotorcycleRoute>({
    id: uuidv4(),
    ...createDefaultRoute(),
  });
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeChunks, setRouteChunks] = useState<RouteChunk[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [focusedWaypoint, setFocusedWaypoint] = useState<Waypoint | null>(null);
  const [fromLocation, setFromLocation] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [poiLayers, setPoiLayers] = useState<POILayerState>({
    fuelStations: false,
    speedCameras: false,
    accommodations: false,
    restaurants: false,
    parkingAreas: false,
  });
  const waypointHistoryRef = useRef<Waypoint[][]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(route.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabToggle = useCallback((tab: string) => {
    setActiveTab(prev => prev === tab ? null : tab);
    setShowMenu(false);
  }, []);

  // Calculate route when waypoints or preferences change
  // Use a ref to prevent duplicate concurrent requests
  const calculateRouteRef = useRef<AbortController | null>(null);
  const speedCameraAnnouncedRef = useRef<boolean>(false);
  
  // Handle voice alerts preference changes
  useEffect(() => {
    voiceAlerts.setEnabled(route.preferences.voiceAlerts);
  }, [route.preferences.voiceAlerts]);

  // Handle speed camera alerts
  useEffect(() => {
    if (route.preferences.speedCameraAlerts && poiLayers.speedCameras) {
      if (!speedCameraAnnouncedRef.current) {
        voiceAlerts.speedCameraWarning();
        speedCameraAnnouncedRef.current = true;
      }
    } else {
      speedCameraAnnouncedRef.current = false;
    }
  }, [route.preferences.speedCameraAlerts, poiLayers.speedCameras]);

  // Calculate route when waypoints or preferences change
  useEffect(() => {
    const updateRoute = async () => {
      if (route.waypoints.length < 2) {
        setRouteCoordinates([]);
        return;
      }

      // Cancel previous request if still pending
      if (calculateRouteRef.current) {
        calculateRouteRef.current.abort();
      }
      
      setIsCalculating(true);
      try {
        console.log('Calculating route for waypoints:', route.waypoints.length, 'with preferences:', route.preferences);
        
        const result = await calculateRoute(route.waypoints, route.preferences);
        console.log('Route received:', result.coordinates.length, 'points, distance:', (result.distance/1000).toFixed(1), 'km, duration:', (result.duration/60).toFixed(0), 'min');
        setRouteCoordinates(result.coordinates);
        setRouteChunks(result.chunks || []);

        // Update distance/duration from the route result
        setRoute(prev => ({
          ...prev,
          totalDistance: result.distance,
          estimatedDuration: result.duration,
        }));

        // Announce route via voice if enabled
        if (route.preferences.voiceAlerts) {
          voiceAlerts.routeCalculated(
            `${(result.distance / 1000).toFixed(1)} ${route.preferences.units === 'km' ? 'kilometers' : 'miles'}`,
            `${Math.round(result.duration / 60)} minutes`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to calculate route:', error);
        }
      } finally {
        setIsCalculating(false);
      }
    };

    updateRoute();
  }, [route.waypoints, route.preferences]);

  // Distance from point (px,py) to line segment (x1,y1)-(x2,y2) in degrees
  const ptSegDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  // Handle map click to add waypoint
  // When 2+ waypoints exist, inserts at the nearest segment to preserve start/end
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setRoute(prev => {
      // Save current state for undo
      waypointHistoryRef.current.push([...prev.waypoints]);

      const newWaypoint: Waypoint = {
        id: uuidv4(),
        lat,
        lng,
        name: `Point ${prev.waypoints.length + 1}`,
        order: 0,
      };

      let newWaypoints: Waypoint[];

      if (prev.waypoints.length < 2) {
        // Building initial route: append
        newWaypoints = [...prev.waypoints, newWaypoint];
      } else {
        // Find the nearest segment between existing waypoints and insert there
        let minDist = Infinity;
        let insertAt = prev.waypoints.length - 1;

        for (let i = 0; i < prev.waypoints.length - 1; i++) {
          const wp1 = prev.waypoints[i];
          const wp2 = prev.waypoints[i + 1];
          const dist = ptSegDist(lat, lng, wp1.lat, wp1.lng, wp2.lat, wp2.lng);
          if (dist < minDist) {
            minDist = dist;
            insertAt = i + 1;
          }
        }

        newWaypoints = [
          ...prev.waypoints.slice(0, insertAt),
          newWaypoint,
          ...prev.waypoints.slice(insertAt),
        ];
      }

      // Reorder
      newWaypoints = newWaypoints.map((wp, i) => ({ ...wp, order: i }));

      if (prev.preferences.voiceAlerts) {
        voiceAlerts.waypointAdded(newWaypoint.name);
      }

      return {
        ...prev,
        waypoints: newWaypoints,
        updatedAt: new Date(),
      };
    });
  }, []);

  // Update route properties
  const handleUpdateRoute = useCallback((updates: Partial<MotorcycleRoute>) => {
    setRoute(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date(),
    }));
  }, []);

  // Update route preferences
  const handleUpdatePreferences = useCallback((preferences: MotorcycleRoute['preferences']) => {
    setRoute(prev => ({
      ...prev,
      preferences,
      updatedAt: new Date(),
    }));
  }, []);

  // Remove waypoint
  const handleRemoveWaypoint = useCallback((id: string) => {
    const removedWaypoint = route.waypoints.find(wp => wp.id === id);
    setRoute(prev => {
      waypointHistoryRef.current.push([...prev.waypoints]);
      return {
        ...prev,
        waypoints: prev.waypoints
          .filter(wp => wp.id !== id)
          .map((wp, index) => ({ ...wp, order: index })),
        updatedAt: new Date(),
      };
    });

    // Announce waypoint removal if voice alerts enabled
    if (removedWaypoint && route.preferences.voiceAlerts) {
      voiceAlerts.waypointRemoved(removedWaypoint.name);
    }
  }, [route.waypoints, route.preferences.voiceAlerts]);

  // Rename waypoint
  const handleRenameWaypoint = useCallback((id: string, name: string) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp =>
        wp.id === id ? { ...wp, name } : wp
      ),
      updatedAt: new Date(),
    }));
  }, []);

  // Reorder waypoints
  const handleReorderWaypoints = useCallback((waypoints: Waypoint[]) => {
    setRoute(prev => ({
      ...prev,
      waypoints,
      updatedAt: new Date(),
    }));
  }, []);

  // Clear route
  const handleClearRoute = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all waypoints?')) {
      setRoute(prev => ({
        ...prev,
        waypoints: [],
        updatedAt: new Date(),
      }));
      setRouteCoordinates([]);
      setRouteChunks([]);

      // Announce route cleared if voice alerts enabled
      if (route.preferences.voiceAlerts) {
        voiceAlerts.routeCleared();
      }
    }
  }, [route.preferences.voiceAlerts]);

  // Undo - restore previous waypoint state
  const handleUndo = useCallback(() => {
    const previousWaypoints = waypointHistoryRef.current.pop();
    if (previousWaypoints) {
      setRoute(prev => ({
        ...prev,
        waypoints: previousWaypoints,
        updatedAt: new Date(),
      }));
    }
  }, []);

  // Import GPX
  const handleImportGPX = useCallback((content: string) => {
    try {
      const imported = importGPXToRoute(content);
      setRoute(prev => ({
        ...prev,
        ...imported,
        id: prev.id, // Keep the same route ID
      }));
    } catch (error) {
      alert('Failed to import GPX file. Please check the file format.');
    }
  }, []);

  // Focus on waypoint
  const handleFocusWaypoint = useCallback((waypoint: Waypoint) => {
    setFocusedWaypoint(waypoint);
    setTimeout(() => setFocusedWaypoint(null), 1000);
  }, []);

  // Handle waypoint drag
  const handleWaypointDrag = useCallback((id: string, lat: number, lng: number) => {
    setRoute(prev => {
      waypointHistoryRef.current.push([...prev.waypoints]);
      return {
        ...prev,
        waypoints: prev.waypoints.map(wp =>
          wp.id === id ? { ...wp, lat, lng } : wp
        ),
        updatedAt: new Date(),
      };
    });
  }, []);

  // Manual route calculation
  const handleCalculateRoute = useCallback(async () => {
    if (route.waypoints.length < 2) {
      alert('Please add at least 2 waypoints to calculate a route.');
      return;
    }

    setIsCalculating(true);
    try {
      const result = await calculateRoute(route.waypoints, route.preferences);
      setRouteCoordinates(result.coordinates);

      setRoute(prev => ({
        ...prev,
        totalDistance: result.distance,
        estimatedDuration: result.duration,
      }));
    } catch (error) {
      console.error('Failed to calculate route:', error);
      alert('Failed to calculate route. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [route.waypoints, route.preferences]);

  // Handle setting route from From/To inputs
  const handleSetRouteFromInputs = useCallback((from: Waypoint, to: Waypoint) => {
    setRoute(prev => ({
      ...prev,
      name: `${from.name} to ${to.name}`,
      waypoints: [from, to],
      updatedAt: new Date(),
    }));
    setFromLocation('');
    setToLocation('');
    setRouteChunks([]); // Clear chunks when setting new route
  }, []);

  // Save current route
  const handleSaveRoute = useCallback(() => {
    try {
      saveRoute(route);
      alert(`Route "${route.name}" saved successfully!`);
      
      // Announce route saved if voice alerts enabled
      if (route.preferences.voiceAlerts) {
        voiceAlerts.routeSaved(route.name);
      }
    } catch (error) {
      alert('Failed to save route. Storage might be full.');
      console.error(error);
    }
  }, [route]);

  // Load a route
  const handleLoadRoute = useCallback((loadedRoute: MotorcycleRoute) => {
    setRoute(loadedRoute);
    setRouteCoordinates([]);

    // Announce route loaded if voice alerts enabled
    if (loadedRoute.preferences.voiceAlerts) {
      voiceAlerts.routeLoaded(loadedRoute.name);
    }
  }, []);

  return (
    <div className="relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <RouteMap
          waypoints={route.waypoints}
          routeCoordinates={routeCoordinates}
          routeChunks={routeChunks}
          onMapClick={handleMapClick}
          onWaypointDrag={handleWaypointDrag}
          focusedWaypoint={focusedWaypoint}
          isCalculating={isCalculating}
          poiLayers={poiLayers}
        />
      </div>

      {/* Compact Header */}
      <header className="absolute top-0 left-0 right-0 z-[1001] bg-gray-900/85 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-lg flex-shrink-0">🏍️</span>
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => { if (editName.trim()) handleUpdateRoute({ name: editName.trim() }); setIsEditingName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { if (editName.trim()) handleUpdateRoute({ name: editName.trim() }); setIsEditingName(false); } }}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm font-semibold bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-orange-500"
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-semibold text-white truncate cursor-pointer hover:text-orange-400 transition-colors"
                onClick={() => { setEditName(route.name); setIsEditingName(true); }}
              >
                {route.name}
              </span>
            )}
          </div>

          {route.totalDistance != null && route.totalDistance > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-300 flex-shrink-0 mx-2">
              <span className="text-orange-400">{formatDistance(route.totalDistance, route.preferences.units)}</span>
              {route.estimatedDuration != null && route.estimatedDuration > 0 && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-orange-400">{formatDuration(route.estimatedDuration)}</span>
                </>
              )}
            </div>
          )}

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        </div>

        {isCalculating && (
          <div className="h-0.5 bg-orange-200 overflow-hidden">
            <div className="h-full bg-orange-500 animate-calculating" />
          </div>
        )}
      </header>

      {/* Menu Dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-[1001]" onClick={() => setShowMenu(false)} />
          <div className="absolute top-12 right-2 z-[1002] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden min-w-[180px]" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => handleImportGPX(event.target?.result as string);
                  reader.readAsText(file);
                }
                if (e.target) e.target.value = '';
              }}
              accept=".gpx"
              className="hidden"
            />
            <button
              onClick={() => { handleCalculateRoute(); setShowMenu(false); }}
              disabled={route.waypoints.length < 2 || isCalculating}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent flex items-center gap-3 transition-colors"
            >
              <span>⚡</span>
              {isCalculating ? 'Calculating...' : 'Calculate Route'}
            </button>
            <button
              onClick={() => { handleUndo(); setShowMenu(false); }}
              disabled={route.waypoints.length === 0}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent flex items-center gap-3 transition-colors"
            >
              <span>↩️</span>
              Undo
            </button>
            <button
              onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-3 transition-colors"
            >
              <span>📂</span>
              Import GPX
            </button>
            <button
              onClick={() => { handleSaveRoute(); setShowMenu(false); }}
              disabled={route.waypoints.length < 2}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent flex items-center gap-3 transition-colors"
            >
              <span>💾</span>
              Save Route
            </button>
            <button
              onClick={() => { handleClearRoute(); setShowMenu(false); }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-3 transition-colors border-t border-gray-700"
            >
              <span>🗑️</span>
              Clear Route
            </button>
          </div>
        </>
      )}

      {/* Bottom Panel */}
      {activeTab && (
        <div
          className="absolute left-0 right-0 z-[1001] bottom-panel"
          style={{ bottom: 'calc(44px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200">
            <div className="flex items-center justify-center pt-2 pb-1">
              <div className="w-8 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="max-h-[45vh] overflow-y-auto px-3 pb-3 space-y-3">
              {activeTab === 'route' && (
                <>
                  <RouteInput
                    fromLocation={fromLocation}
                    toLocation={toLocation}
                    onFromChange={setFromLocation}
                    onToChange={setToLocation}
                    onSetWaypoints={handleSetRouteFromInputs}
                    isLoading={isGeocoding}
                  />
                  <SavedRoutes
                    onLoadRoute={handleLoadRoute}
                    currentUnitPreference={route.preferences.units}
                  />
                </>
              )}
              {activeTab === 'points' && (
                <WaypointsList
                  waypoints={route.waypoints}
                  onReorder={handleReorderWaypoints}
                  onRemove={handleRemoveWaypoint}
                  onRename={handleRenameWaypoint}
                  onFocus={handleFocusWaypoint}
                />
              )}
              {activeTab === 'settings' && (
                <>
                  <RoutePreferencesPanel
                    preferences={route.preferences}
                    onChange={handleUpdatePreferences}
                  />
                  <MapPOILayers
                    poiLayers={poiLayers}
                    onChange={setPoiLayers}
                  />
                </>
              )}
              {activeTab === 'export' && (
                <ExportPanel route={route} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <nav
        className="absolute bottom-0 left-0 right-0 z-[1002] bg-gray-900/95 backdrop-blur-sm border-t border-gray-700"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
      >
        <div className="flex items-center justify-around">
          {[
            { id: 'route', icon: '🗺️', label: 'Route' },
            { id: 'points', icon: '📍', label: 'Points' },
            { id: 'settings', icon: '⚙️', label: 'Settings' },
            { id: 'export', icon: '📤', label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabToggle(tab.id)}
              className={`flex flex-col items-center py-2 px-5 transition-colors ${
                activeTab === tab.id
                  ? 'text-orange-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[11px] font-medium mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;
