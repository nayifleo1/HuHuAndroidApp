package com.huhu.app.videoplayer

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.RCTNativeAppEventEmitter
import java.io.File
import android.util.Log

class TorrentStreamModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val torrentService: TorrentStreamingService = TorrentStreamingService(reactContext)
    private val TAG = "TorrentStreamModule"

    init {
        torrentService.initialize()
    }

    override fun getName() = "TorrentStreamModule"

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "TORRENT_PROGRESS_EVENT" to "torrentProgress"
        )
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            Log.d(TAG, "Sending event $eventName with params: $params")
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built in Event Emitter Compatibility
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built in Event Emitter Compatibility
    }

    @ReactMethod
    fun startStream(magnetUri: String, promise: Promise) {
        try {
            val progressCallback = Callback { progress ->
                val params = Arguments.createMap()
                
                try {
                    if (progress is Map<*, *>) {
                        Log.d(TAG, "Progress callback received: $progress")
                        
                        // Get each property from the map and add it to params
                        if (progress.containsKey("bufferProgress")) {
                            params.putInt("bufferProgress", (progress["bufferProgress"] as? Number)?.toInt() ?: 0)
                        }
                        
                        if (progress.containsKey("downloadSpeed")) {
                            params.putInt("downloadSpeed", (progress["downloadSpeed"] as? Number)?.toInt() ?: 0)
                        }
                        
                        if (progress.containsKey("progress")) {
                            params.putInt("progress", (progress["progress"] as? Number)?.toInt() ?: 0)
                        }
                        
                        if (progress.containsKey("seeds")) {
                            params.putInt("seeds", (progress["seeds"] as? Number)?.toInt() ?: 0)
                        }
                    } else {
                        Log.e(TAG, "Progress callback received invalid object: $progress")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error creating progress event: ${e.message}", e)
                }
                
                if (params.hasKey("bufferProgress") || params.hasKey("downloadSpeed")) {
                    // Only send the event if we have at least some data
                    sendEvent("torrentProgress", params)
                } else {
                    Log.w(TAG, "Not sending empty progress event")
                }
            }

            torrentService.startStream(magnetUri, promise, progressCallback)
        } catch (e: Exception) {
            promise.reject("TORRENT_ERROR", "Failed to start torrent stream: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopStream() {
        torrentService.stopStream()
    }

    @ReactMethod
    fun fileExists(path: String, promise: Promise) {
        try {
            val file = File(path)
            promise.resolve(file.exists() && file.isFile)
        } catch (e: Exception) {
            promise.reject("FILE_ERROR", "Failed to check if file exists: ${e.message}", e)
        }
    }
} 