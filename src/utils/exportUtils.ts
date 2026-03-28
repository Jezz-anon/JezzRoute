import { MotorcycleRoute, Waypoint } from '../types';

// Format date for GPX
function formatGPXDate(date: Date): string {
  return date.toISOString();
}

// Calculate distance between two points in km
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate total route distance
export function calculateRouteDistance(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += calculateDistance(
      waypoints[i-1].lat, waypoints[i-1].lng,
      waypoints[i].lat, waypoints[i].lng
    );
  }
  return total;
}

// Export to GPX format (universal) - optionally with route coordinates for accurate track
export function exportToGPX(route: MotorcycleRoute, routeCoordinates?: [number, number][]): string {
  const { name, description, waypoints, createdAt } = route;
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoRoute Planner"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${formatGPXDate(createdAt)}</time>
  </metadata>
`;

  // Add waypoints
  waypoints.forEach((wp, index) => {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}">
    <name>${escapeXml(wp.name || `Waypoint ${index + 1}`)}</name>
    <type>Waypoint</type>
  </wpt>
`;
  });

  // Add route
  if (waypoints.length > 0) {
    gpx += `  <rte>
    <name>${escapeXml(name)}</name>
`;
    waypoints.forEach((wp, index) => {
      gpx += `    <rtept lat="${wp.lat}" lon="${wp.lng}">
      <name>${escapeXml(wp.name || `Point ${index + 1}`)}</name>
    </rtept>
`;
    });
    gpx += `  </rte>
`;
  }

  // Add track (for better compatibility) - use route coordinates if available
  if (waypoints.length > 0) {
    gpx += `  <trk>
    <name>${escapeXml(name)}</name>
    <type>Route</type>
    <trkseg>
`;
    
    // Use route coordinates if available for accurate track
    if (routeCoordinates && routeCoordinates.length > 0) {
      routeCoordinates.forEach((coord) => {
        gpx += `      <trkpt lat="${coord[0]}" lon="${coord[1]}">
      </trkpt>
`;
      });
    } else {
      // Fallback to waypoints
      waypoints.forEach((wp) => {
        gpx += `      <trkpt lat="${wp.lat}" lon="${wp.lng}">
      </trkpt>
`;
      });
    }
    
    gpx += `    </trkseg>
  </trk>
`;
  }

  gpx += `</gpx>`;
  return gpx;
}

// Export to Garmin GPX format (BaseCamp compatible)
export function exportToGarmin(route: MotorcycleRoute, _routeCoordinates?: [number, number][]): string {
  const { name, description, waypoints, preferences, createdAt } = route;
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoRoute Planner - Garmin Export"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd
  http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensions/v3/GpxExtensionsv3.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${formatGPXDate(createdAt)}</time>
    <extensions>
      <gpxx:GarminMetaData>
        <gpxx:RoutePreferences>
          <gpxx:Curviness>${preferences.curviness}</gpxx:Curviness>
          <gpxx:AvoidHighways>${preferences.avoidHighways}</gpxx:AvoidHighways>
          <gpxx:AvoidUnpaved>${preferences.avoidUnpaved}</gpxx:AvoidUnpaved>
          <gpxx:AvoidTolls>${preferences.avoidTolls}</gpxx:AvoidTolls>
        </gpxx:RoutePreferences>
      </gpxx:GarminMetaData>
    </extensions>
  </metadata>
`;

  // Add waypoints as POIs
  waypoints.forEach((wp, index) => {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}">
    <ele>0</ele>
    <name>${escapeXml(wp.name || `Waypoint ${index + 1}`)}</name>
    <sym>Waypoint</sym>
    <type>User Waypoint</type>
  </wpt>
`;
  });

  // Add as Route (Garmin prefers routes for navigation)
  if (waypoints.length > 0) {
    gpx += `  <rte>
    <name>${escapeXml(name)}</name>
    <extensions>
      <gpxx:RouteExtension>
        <gpxx:IsAutoNamed>false</gpxx:IsAutoNamed>
        <gpxx:DisplayColor>Red</gpxx:DisplayColor>
      </gpxx:RouteExtension>
    </extensions>
`;
    waypoints.forEach((wp, index) => {
      gpx += `    <rtept lat="${wp.lat}" lon="${wp.lng}">
      <ele>0</ele>
      <name>${escapeXml(wp.name || `Point ${index + 1}`)}</name>
      <sym>Waypoint</sym>
    </rtept>
`;
    });
    gpx += `  </rte>
`;
  }

  // Add as Track (for track logging)
  if (waypoints.length > 0) {
    gpx += `  <trk>
    <name>${escapeXml(name)}</name>
    <extensions>
      <gpxx:TrackExtension>
        <gpxx:DisplayColor>Red</gpxx:DisplayColor>
      </gpxx:TrackExtension>
    </extensions>
    <trkseg>
`;
    waypoints.forEach((wp, index) => {
      gpx += `      <trkpt lat="${wp.lat}" lon="${wp.lng}">
        <ele>0</ele>
        <name>${escapeXml(wp.name || `Point ${index + 1}`)}</name>
      </trkpt>
`;
    });
    gpx += `    </trkseg>
  </trk>
`;
  }

  gpx += `</gpx>`;
  return gpx;
}

// Export to TomTom ITN format (Itinerary)
export function exportToTomTom(route: MotorcycleRoute): string {
  const { waypoints } = route;
  
  // TomTom ITN format: longitude|latitude|name|0 (0 = waypoint, 1 = via point)
  let itn = '';
  waypoints.forEach((wp, index) => {
    // TomTom uses integer coordinates multiplied by 100000
    const lat = Math.round(wp.lat * 100000);
    const lng = Math.round(wp.lng * 100000);
    const name = wp.name || `Point ${index + 1}`;
    itn += `${lng}|${lat}|${name}|0\n`;
  });
  
  return itn;
}

// Export to TomTom GPX format
export function exportToTomTomGPX(route: MotorcycleRoute): string {
  const { name, description, waypoints, preferences, createdAt } = route;
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoRoute Planner - TomTom Export"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:tt="http://www.tomtom.com/gpx/extensions/v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${formatGPXDate(createdAt)}</time>
    <extensions>
      <tt:RoutePreferences>
        <tt:Curviness>${preferences.curviness}</tt:Curviness>
        <tt:AvoidHighways>${preferences.avoidHighways}</tt:AvoidHighways>
        <tt:AvoidUnpaved>${preferences.avoidUnpaved}</tt:AvoidUnpaved>
        <tt:AvoidTolls>${preferences.avoidTolls}</tt:AvoidTolls>
        <tt:PreferScenic>${preferences.preferScenic}</tt:PreferScenic>
      </tt:RoutePreferences>
    </extensions>
  </metadata>
`;

  waypoints.forEach((wp, index) => {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}">
    <name>${escapeXml(wp.name || `Waypoint ${index + 1}`)}</name>
  </wpt>
`;
  });

  if (waypoints.length > 0) {
    gpx += `  <rte>
    <name>${escapeXml(name)}</name>
`;
    waypoints.forEach((wp, index) => {
      gpx += `    <rtept lat="${wp.lat}" lon="${wp.lng}">
      <name>${escapeXml(wp.name || `Point ${index + 1}`)}</name>
    </rtept>
`;
    });
    gpx += `  </rte>
`;
  }

  gpx += `</gpx>`;
  return gpx;
}

// Helper to escape XML
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Download helper
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate filename from route name
export function generateFilename(routeName: string, extension: string): string {
  const sanitized = routeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${sanitized}_${timestamp}.${extension}`;
}
