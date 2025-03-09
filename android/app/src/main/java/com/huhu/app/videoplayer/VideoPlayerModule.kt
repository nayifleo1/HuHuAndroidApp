package com.huhu.app.videoplayer

import android.content.Intent
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableArray
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.content.pm.PackageManager
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener

class VideoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener, LifecycleEventListener {
    private val TAG = "VideoPlayerModule"
    private var activePromise: Promise? = null
    private var isPlayerActive = false
    
    init {
        reactContext.addActivityEventListener(this)
        reactContext.addLifecycleEventListener(this)
    }
    
    override fun getName() = "VideoPlayerModule"
    
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == VIDEO_PLAYER_REQUEST_CODE) {
            Log.d(TAG, "Video player activity result received: $resultCode")
            // Video player has closed
            if (isPlayerActive) {
                isPlayerActive = false
                activePromise?.resolve(true)
                activePromise = null
            }
        }
    }
    
    override fun onNewIntent(intent: Intent?) {
        // Not used but required by ActivityEventListener
    }
    
    override fun onHostResume() {
        // When the host app resumes, check if player was active
        if (isPlayerActive) {
            Log.d(TAG, "Host app resumed, assuming video player closed")
            isPlayerActive = false
            activePromise?.resolve(true)
            activePromise = null
        }
    }
    
    override fun onHostPause() {
        // Not used but required by LifecycleEventListener
    }
    
    override fun onHostDestroy() {
        // Clean up any pending promises
        if (isPlayerActive) {
            Log.d(TAG, "Host app destroyed, resolving any pending promises")
            isPlayerActive = false
            activePromise?.resolve(false)
            activePromise = null
        }
    }
    
    @ReactMethod
    fun playVideo(url: String, options: ReadableMap, promise: Promise) {
        try {
            Log.d(TAG, "Playing video: $url")
            Log.d(TAG, "Options: ${options.toString()}")
            
            // Store the promise for later resolution
            activePromise = promise
            isPlayerActive = true
            
            val useExternalPlayer = if (options.hasKey("useExternalPlayer")) options.getBoolean("useExternalPlayer") else false
            val title = if (options.hasKey("title")) options.getString("title") else "Video"
            val episodeTitle = if (options.hasKey("episodeTitle")) options.getString("episodeTitle") else null
            val episodeNumber = if (options.hasKey("episodeNumber")) options.getString("episodeNumber") else null
            val releaseDate = if (options.hasKey("releaseDate")) options.getString("releaseDate") else null
            val poster = if (options.hasKey("poster")) options.getString("poster") else null
            
            // Handle subtitles
            val subtitleUrl = if (options.hasKey("subtitleUrl")) options.getString("subtitleUrl") else null
            val subtitleLanguage = if (options.hasKey("subtitleLanguage")) options.getString("subtitleLanguage") else null
            
            Log.d(TAG, "Subtitle URL: $subtitleUrl, Language: $subtitleLanguage")
            
            // Handle headers
            val headers = if (options.hasKey("headers")) options.getMap("headers") else null
            
            if (useExternalPlayer) {
                // Use external player
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(Uri.parse(url), "video/*")
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
                
                // Can't track external player state, so resolve after a short delay
                // to let the app switch to the external player
                reactApplicationContext.currentActivity?.let {
                    // Don't resolve immediately - external player takes time to open
                    // We'll rely on the app coming back to the foreground to resolve
                } ?: run {
                    // No activity, resolve after a delay
                    Log.d(TAG, "No current activity, resolving promise after short delay")
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (isPlayerActive) {
                            isPlayerActive = false
                            activePromise?.resolve(true)
                            activePromise = null
                        }
                    }, 3000)
                }
            } else {
                // Use ExoPlayer
                val intent = Intent(reactApplicationContext, ExoPlayerActivity::class.java).apply {
                    putExtra("VIDEO_URL", url)
                    putExtra("VIDEO_TITLE", when {
                        episodeTitle != null && episodeNumber != null -> "$title - $episodeNumber: $episodeTitle"
                        episodeTitle != null -> "$title - $episodeTitle"
                        releaseDate != null -> "$title (${releaseDate.take(4)})" // Take just the year from the date
                        else -> title
                    })
                    putExtra("POSTER_URL", poster)
                    
                    // Add subtitle info if available
                    if (subtitleUrl != null) {
                        Log.d(TAG, "Adding subtitle to intent: $subtitleUrl")
                        putExtra("SUBTITLE_URL", subtitleUrl)
                        putExtra("SUBTITLE_LANGUAGE", subtitleLanguage ?: "en")
                    }
                    
                    // Add headers if available
                    if (headers != null) {
                        headers.toHashMap().forEach { (key, value) ->
                            when (key) {
                                "Referer" -> putExtra("HEADER_REFERER", value as String)
                                "User-Agent" -> putExtra("HEADER_USER_AGENT", value as String)
                                "Origin" -> putExtra("HEADER_ORIGIN", value as String)
                            }
                        }
                    }
                }
                
                // Start the activity for result so we can catch when it finishes
                reactApplicationContext.currentActivity?.startActivityForResult(intent, VIDEO_PLAYER_REQUEST_CODE)
                    ?: run {
                        // If no current activity, start normally but we'll rely on app resume to detect completion
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        reactApplicationContext.startActivity(intent)
                    }
                
                // Don't resolve here - wait for activity result
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing video: ${e.message}")
            isPlayerActive = false
            activePromise = null
            promise.reject("ERROR", e.message)
        }
    }
    
    // For backward compatibility
    @ReactMethod
    fun playVideo(url: String, promise: Promise) {
        try {
            Log.d(TAG, "Playing video (backward compatibility): $url")
            
            // Store the promise for later resolution
            activePromise = promise
            isPlayerActive = true
            
            // Use ExoPlayer by default
            val intent = Intent(reactApplicationContext, ExoPlayerActivity::class.java).apply {
                putExtra("VIDEO_URL", url)
                putExtra("VIDEO_TITLE", "Video")
            }
            
            // Start the activity for result so we can catch when it finishes
            reactApplicationContext.currentActivity?.startActivityForResult(intent, VIDEO_PLAYER_REQUEST_CODE)
                ?: run {
                    // If no current activity, start normally but we'll rely on app resume to detect completion
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                }
                
            // Don't resolve here - wait for activity result
        } catch (e: Exception) {
            Log.e(TAG, "Error playing video: ${e.message}", e)
            isPlayerActive = false
            activePromise = null
            promise.reject("VIDEO_PLAYER_ERROR", e.message)
        }
    }
    
    companion object {
        const val VIDEO_PLAYER_REQUEST_CODE = 1001
    }
}