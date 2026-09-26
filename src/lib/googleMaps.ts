// Google Maps Platform Integration
export interface GoogleRoutesRequest { origin: any; destination: any }
export async function computeGoogleRoute() { return null }
export async function geocodeAddress() { return null }
export async function reverseGeocode() { return null }
export async function getPlaceAutocomplete() { return [] }
export async function getPlaceDetails() { return null }
export function isGoogleMapsConfigured() { return false }
export function loadGoogleMapsJS() { return Promise.resolve() }