export function isWeightWithinVehicleCapacity(
  weightKg: number,
  capacityKg: number,
) {
  return weightKg <= capacityKg;
}

export function canAssignDriverToActiveTrip(activeAssignments: number) {
  return activeAssignments === 0;
}
