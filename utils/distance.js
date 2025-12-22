// Calculate distance between two Lambert 31370 coordinates
// Returns distance in kilometers
function calculateDistance(x1, y1, x2, y2) {
  // Euclidean distance for Lambert coordinates
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distanceMeters = Math.sqrt(dx * dx + dy * dy);
  const distanceKm = distanceMeters / 1000;
  
  return Math.round(distanceKm * 10) / 10; // Round to 1 decimal
}

module.exports = { calculateDistance };
