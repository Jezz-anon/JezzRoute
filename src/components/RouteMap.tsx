import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Waypoint } from '../types';
import { POILayerState } from './MapPOILayers';
import { fetchPOITypes, getRouteBbox, POIMarker } from '../utils/poiUtils';
import { createCustomIcon } from './createCustomIcon';
import { RouteChunk, filterPOIsByRouteProximity } from '../utils/routing';

// POI colors by type
const poiColors: Record<string, string> = {
  'fuel': '#22c55e',
  'camera': '#ef4444',
  'accommodation': '#8b5cf6',
  'restaurant': '#f97316',
  'parking': '#3b82f6',
};

// POI marker letters for SVG icons
const poiLetters: Record<string, string> = {
  'fuel': 'F',
  'camera': '!',
  'accommodation': 'H',
  'restaurant': 'R',
  'parking': 'P',
};

const poiLabels: Record<string, string> = {
  'fuel': '⛽ Fuel',
  'camera': '📷 Camera',
  'accommodation': '🏨 Hotel',
  'restaurant': '🍴 Restaurant',
  'parking': '🅿️ Parking',
};

// Cached L.Icon instances for POI markers (same SVG data URI approach as waypoint markers)
const poiIconCache: Record<string, L.Icon> = {};
function getPoiIcon(type: string): L.Icon {
  if (!poiIconCache[type]) {
    const color = poiColors[type] || '#6b7280';
    const letter = poiLetters[type] || '?';
    poiIconCache[type] = L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
          <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="14" y="19" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial,sans-serif">${letter}</text>
        </svg>
      `)}`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }
  return poiIconCache[type];
}

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Props {
  waypoints: Waypoint[];
  routeCoordinates?: [number, number][];
  routeChunks?: RouteChunk[];
  onMapClick: (lat: number, lng: number) => void;
  onWaypointDrag: (id: string, lat: number, lng: number) => void;
  focusedWaypoint: Waypoint | null;
  isCalculating?: boolean;
  poiLayers?: POILayerState;
}

export const RouteMap: React.FC<Props> = ({ 
  waypoints, 
  routeCoordinates,
  routeChunks,
  onMapClick, 
  onWaypointDrag, 
  focusedWaypoint,
  isCalculating,
  poiLayers
}) => {
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapController 
        waypoints={waypoints}
        focusedWaypoint={focusedWaypoint}
        onMapClick={onMapClick}
        poiLayers={poiLayers}
        routeChunks={routeChunks}
        routeCoordinates={routeCoordinates}
      />
      
      {/* Route line shadow/glow effect */}
      {waypoints.length > 1 && (
        <>
          <Polyline
            positions={routeCoordinates && routeCoordinates.length > 0 
              ? routeCoordinates
              : waypoints.map(wp => [wp.lat, wp.lng])
            }
            color="#000000"
            weight={8}
            opacity={0.2}
            dashArray="none"
          />
          {/* Main route line */}
          <Polyline
            positions={routeCoordinates && routeCoordinates.length > 0 
              ? routeCoordinates
              : waypoints.map(wp => [wp.lat, wp.lng])
            }
            color={isCalculating ? "#94a3b8" : "#f97316"}
            weight={6}
            opacity={1}
            dashArray="none"
            lineCap="round"
            lineJoin="round"
          />
          {/* Highlight line on top */}
          <Polyline
            positions={routeCoordinates && routeCoordinates.length > 0 
              ? routeCoordinates
              : waypoints.map(wp => [wp.lat, wp.lng])
            }
            color={isCalculating ? "#cbd5e1" : "#fbbf24"}
            weight={2}
            opacity={0.8}
            dashArray="5, 5"
            lineCap="round"
            lineJoin="round"
          />
        </>
      )}

      {/* Markers */}
      {waypoints.map((waypoint, index) => (
        <Marker
          key={waypoint.id}
          position={[waypoint.lat, waypoint.lng]}
          icon={createCustomIcon(
            '#f97316',
            index,
            index === 0,
            index === waypoints.length - 1
          )}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const position = marker.getLatLng();
              onWaypointDrag(waypoint.id, position.lat, position.lng);
            },
          }}
        >
          <Popup>
            <div className="text-center">
              <div className="font-bold text-orange-600">{waypoint.name || `Point ${index + 1}`}</div>
              <div className="text-xs text-gray-500 mt-1">
                {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}
              </div>
              <div className="text-xs text-orange-500 mt-1 italic">Drag to reposition</div>
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* Route chunk markers for navigation */}
    </MapContainer>
  );
};

// Helper component to manage map interactions
const MapController: React.FC<{
  waypoints: Waypoint[];
  focusedWaypoint: Waypoint | null;
  onMapClick: (lat: number, lng: number) => void;
  poiLayers?: POILayerState;
  routeChunks?: RouteChunk[];
  routeCoordinates?: [number, number][];
}> = ({ waypoints, focusedWaypoint, onMapClick, poiLayers, routeChunks, routeCoordinates }) => {
  const mapInstance = useMap();
  const [allPois, setAllPois] = useState<POIMarker[]>([]);
  const [zoom, setZoom] = useState(mapInstance.getZoom());
  const abortRef = useRef<AbortController | null>(null);
  const bboxRef = useRef<string>('');
  // Stable waypoint key: only refetch when count or positions actually change
  const waypointKey = useMemo(
    () => waypoints.map(wp => `${wp.lat.toFixed(3)},${wp.lng.toFixed(3)}`).join('|'),
    [waypoints]
  );

  // Track zoom level for density-based POI display
  const onZoom = useCallback(() => {
    setZoom(mapInstance.getZoom());
  }, [mapInstance]);

  useMapEvents({
    zoomend: onZoom,
  });

  useEffect(() => {
    if (focusedWaypoint) {
      mapInstance.flyTo([focusedWaypoint.lat, focusedWaypoint.lng], 14, {
        duration: 0.5,
      });
    }
  }, [focusedWaypoint, mapInstance]);

  // Fit bounds when waypoints change
  useEffect(() => {
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lng]));
      mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [waypointKey, mapInstance]);

  // Stable route key: only refetch POIs when route actually changes
  const routeKey = useMemo(
    () => routeCoordinates && routeCoordinates.length > 0
      ? `${routeCoordinates.length}-${routeCoordinates[0][0].toFixed(3)},${routeCoordinates[0][1].toFixed(3)}-${routeCoordinates[routeCoordinates.length-1][0].toFixed(3)},${routeCoordinates[routeCoordinates.length-1][1].toFixed(3)}`
      : '',
    [routeCoordinates]
  );

  // Reset POI cache when route changes and fetch ALL types in one query
  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      setAllPois([]);
      bboxRef.current = '';
      return;
    }

    setAllPois([]);
    bboxRef.current = getRouteBbox(routeCoordinates);

    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ac = new AbortController();
    abortRef.current = ac;

    const allTypes: POIMarker['type'][] = ['fuel', 'camera', 'accommodation', 'restaurant', 'parking'];

    const doFetch = async () => {
      try {
        const pois = await fetchPOITypes(allTypes, bboxRef.current, ac.signal);
        if (ac.signal.aborted) return;
        if (pois.length > 0) {
          setAllPois(pois);
          console.log(`POIs loaded: ${pois.length} total`);
        }
      } catch {
        // Aborted or failed
      }
    };

    const timer = setTimeout(doFetch, 200);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [routeKey]);

  // Filter bbox POIs to within ~1.5km of the actual route corridor
  const poiMarkers = useMemo(
    () => routeCoordinates && routeCoordinates.length > 2
      ? filterPOIsByRouteProximity(allPois, routeCoordinates)
      : allPois,
    [allPois, routeCoordinates]
  );

  // Filter by enabled POI layers and zoom-dependent density
  const visiblePois = useMemo(() => {
    // First filter by layer toggles
    const layerFiltered = poiMarkers.filter(poi => {
      if (!poiLayers) return false;
      const layerMap: Record<string, keyof POILayerState> = {
        'fuel': 'fuelStations',
        'camera': 'speedCameras',
        'accommodation': 'accommodations',
        'restaurant': 'restaurants',
        'parking': 'parkingAreas',
      };
      return poiLayers[layerMap[poi.type]] ?? false;
    });

    if (layerFiltered.length === 0) return layerFiltered;

    // Zoom-dependent density PER TYPE so toggling one layer doesn't affect others
    let maxPerType: number;
    if (zoom >= 13) maxPerType = Infinity;
    else if (zoom >= 11) maxPerType = 100;
    else if (zoom >= 9) maxPerType = 40;
    else maxPerType = 15;

    // Group by type, sample each independently
    const byType: Record<string, POIMarker[]> = {};
    for (const poi of layerFiltered) {
      (byType[poi.type] ??= []).push(poi);
    }

    const result: POIMarker[] = [];
    for (const pois of Object.values(byType)) {
      if (pois.length <= maxPerType) {
        result.push(...pois);
      } else {
        const step = pois.length / maxPerType;
        for (let i = 0; result.length < result.length + maxPerType && i < pois.length; i += step) {
          result.push(pois[Math.floor(i)]);
        }
      }
    }
    return result;
  }, [poiMarkers, poiLayers, zoom]);

  return (
    <>
      <MapClickHandler onMapClick={onMapClick} />
      
      {/* POI markers - emoji icons */}
      {visiblePois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={getPoiIcon(poi.type)}
        >
          <Tooltip permanent={false}>{poiLabels[poi.type] || poi.type}: {poi.name}</Tooltip>
          <Popup>
            <div className="text-center p-2">
              <div className="font-bold text-gray-800">{poiLabels[poi.type] || poi.type}</div>
              <div className="text-sm text-gray-600">{poi.name}</div>
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* Route chunk markers for navigation progress */}
      {routeChunks && routeChunks.length > 0 && (
        <>
          {routeChunks.map((chunk) => {
            const chunkIcon = L.divIcon({
              html: `<div style="width: 24px; height: 24px; background: linear-gradient(135deg, #f97316, #ea580c); border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${chunk.index}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              className: 'chunk-marker',
            });

            return (
              <Marker key={`chunk-${chunk.index}`} position={[chunk.lat, chunk.lng]} icon={chunkIcon}>
                <Popup>
                  <div className="text-center text-sm">
                    <div className="font-bold text-orange-600">Segment {chunk.index}</div>
                    <div className="text-gray-600">{(chunk.distance / 1000).toFixed(1)} km</div>
                    <div className="text-gray-500 text-xs">{Math.round(chunk.duration / 60)} min</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </>
      )}
    </>
  );
};

// Component to handle map clicks
const MapClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};
