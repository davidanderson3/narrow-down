package com.example.dashboard.weather

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Helper class that retrieves the user's location using the
 * Fused Location Provider API.
 */
class WeatherLocationHelper(context: Context) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    /**
     * Attempts to fetch the device's current location. If the last known
     * location is not available, a high accuracy single update is requested.
     *
     * This method requires the caller to have checked location permissions
     * (ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION).
     */
    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): Location? = suspendCancellableCoroutine { cont ->
        fusedClient.lastLocation
            .addOnSuccessListener { last ->
                if (last != null) {
                    cont.resume(last)
                } else {
                    val request = LocationRequest.Builder(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        10_000L
                    )
                        .setMinUpdateIntervalMillis(5_000L)
                        .setMaxUpdates(1)
                        .build()

                    val callback = object : LocationCallback() {
                        override fun onLocationResult(result: LocationResult) {
                            fusedClient.removeLocationUpdates(this)
                            if (cont.isActive) cont.resume(result.lastLocation)
                        }

                        override fun onLocationAvailability(availability: LocationAvailability) {
                            if (!availability.isLocationAvailable && cont.isActive) {
                                fusedClient.removeLocationUpdates(this)
                                cont.resume(null)
                            }
                        }
                    }

                    fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
                    cont.invokeOnCancellation { fusedClient.removeLocationUpdates(callback) }
                }
            }
            .addOnFailureListener {
                if (cont.isActive) cont.resume(null)
            }
    }
}
