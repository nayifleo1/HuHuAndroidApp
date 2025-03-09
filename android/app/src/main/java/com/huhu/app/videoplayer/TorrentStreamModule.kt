package com.huhu.app.videoplayer

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.RCTNativeAppEventEmitter

class TorrentStreamModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val torrentService: TorrentStreamingService = TorrentStreamingService(reactContext)

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
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
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
                val params = Arguments.createMap().apply {
                    if (progress is Map<*, *>) {
                        progress.forEach { (key, value) ->
                            when (value) {
                                is Int -> putInt(key.toString(), value)
                                is Double -> putDouble(key.toString(), value)
                                is String -> putString(key.toString(), value)
                                else -> putString(key.toString(), value.toString())
                            }
                        }
                    }
                }
                
                sendEvent("torrentProgress", params)
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
} 