/**
 * Calcula la distancia en metros entre dos coordenadas GPS
 * usando la fórmula de Haversine.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

module.exports = { haversineDistance };
