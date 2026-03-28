import L from 'leaflet';

export const createCustomIcon = (
  color: string,
  index: number,
  isStart: boolean,
  isEnd: boolean
): L.Icon => {
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
        <path d="M16 0C9.4 0 4 5.4 4 12c0 6.6 12 28 12 28s12-21.4 12-28c0-6.6-5.4-12-12-12Z" fill="${color}"/>
        ${isStart ? `<circle cx="16" cy="12" r="5" fill="white"/>` : ''}
        ${isEnd ? `<text x="16" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">END</text>` : ''}
        ${!isStart && !isEnd ? `<text x="16" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${index + 1}</text>` : ''}
      </svg>
    `)}`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
    shadowSize: [41, 41],
    shadowAnchor: [12, 41],
  });
};
