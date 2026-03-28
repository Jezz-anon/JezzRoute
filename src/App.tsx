import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MotorcycleRoute, Waypoint, createDefaultRoute } from './types';
import { RouteMap } from './components/RouteMap';
import { RouteToolbar } from './components/RouteToolbar';
import { RoutePreferencesPanel } from './components/RoutePreferencesPanel';
import { WaypointsList } from './components/WaypointsList';
import { RouteInput } from './components/RouteInput';
import { ExportPanel } from './components/ExportPanel';
import { RouteInfo } from './components/RouteInfo';
import { SavedRoutes } from './components/SavedRoutes';
import { MapPOILayers, POILayerState } from './components/MapPOILayers';
import { importGPXToRoute } from './utils/importUtils';
import { calculateRoute, RouteChunk } from './utils/routing';
import { saveRoute } from './utils/routeStorage';
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
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header/Toolbar */}
      <RouteToolbar
        route={route}
        onUpdateRoute={handleUpdateRoute}
        onClearRoute={handleClearRoute}
        onImportGPX={handleImportGPX}
        onCalculateRoute={handleCalculateRoute}
        onSaveRoute={handleSaveRoute}
        onUndo={handleUndo}
        isCalculating={isCalculating}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-3 p-3 relative">
        {/* Sidebar */}
        <div className="w-72 bg-gray-50 border border-gray-300 rounded-lg shadow-md overflow-y-auto p-3 space-y-3">
          {/* Route Input - From/To */}
          <RouteInput
            fromLocation={fromLocation}
            toLocation={toLocation}
            onFromChange={setFromLocation}
            onToChange={setToLocation}
            onSetWaypoints={handleSetRouteFromInputs}
            isLoading={isGeocoding}
          />

          {/* Route Preferences */}
          <RoutePreferencesPanel
            preferences={route.preferences}
            onChange={handleUpdatePreferences}
          />

          {/* Waypoints List */}
          <WaypointsList
            waypoints={route.waypoints}
            onReorder={handleReorderWaypoints}
            onRemove={handleRemoveWaypoint}
            onRename={handleRenameWaypoint}
            onFocus={handleFocusWaypoint}
          />

          {/* Map Layers Panel */}
          <MapPOILayers
            poiLayers={poiLayers}
            onChange={setPoiLayers}
          />

          {/* Export Panel */}
          <ExportPanel route={route} />
        </div>

        {/* Map */}
        <div className="flex-1 h-full overflow-hidden">
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
          
          {/* Route Info Overlay */}
          {false && (
            <RouteInfo route={route} isCalculating={isCalculating} />
          )}



          {/* Saved Routes Panel */}
          <SavedRoutes
            onLoadRoute={handleLoadRoute}
            currentUnitPreference={route.preferences.units}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
