export function directionsUrl(p: { latitude: number; longitude: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`
}

export function wazeUrl(p: { latitude: number; longitude: number }) {
  return `https://waze.com/ul?ll=${p.latitude}%2C${p.longitude}&navigate=yes`
}
