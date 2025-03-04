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

class VideoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val TAG = "VideoPlayerModule"
    
    override fun getName() = "VideoPlayerModule"

    @ReactMethod
    fun playVideo(url: String, options: ReadableMap, promise: Promise) {
        try {
            Log.d(TAG, "Playing video: $url")
            Log.d(TAG, "Options: ${options.toString()}")
            
            val useExternalPlayer = if (options.hasKey("useExternalPlayer")) options.getBoolean("useExternalPlayer") else false
            val title = if (options.hasKey("title")) options.getString("title") else "Video"
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
                promise.resolve(true)
            } else {
                // Use ExoPlayer
                val intent = Intent(reactApplicationContext, ExoPlayerActivity::class.java).apply {
                    putExtra("VIDEO_URL", url)
                    putExtra("VIDEO_TITLE", title)
                    putExtra("POSTER_URL", poster)
                    
                    // Add subtitle info if available
                    if (subtitleUrl != null) {
                        Log.d(TAG, "Adding subtitle to intent: $subtitleUrl")
                        putExtra("SUBTITLE_URL", subtitleUrl)
                        putExtra("SUBTITLE_LANGUAGE", subtitleLanguage ?: "en")
                    }
                    
                    // Add headers if available
                    if (headers != null) {
                        Log.d(TAG, "Headers available: ${headers.toString()}")
                        if (headers.hasKey("Referer")) {
                            val referer = headers.getString("Referer")
                            Log.d(TAG, "Adding Referer header: $referer")
                            putExtra("HEADER_REFERER", referer)
                        }
                        if (headers.hasKey("User-Agent")) {
                            val userAgent = headers.getString("User-Agent")
                            Log.d(TAG, "Adding User-Agent header: $userAgent")
                            putExtra("HEADER_USER_AGENT", userAgent)
                        }
                        if (headers.hasKey("Origin")) {
                            val origin = headers.getString("Origin")
                            Log.d(TAG, "Adding Origin header: $origin")
                            putExtra("HEADER_ORIGIN", origin)
                        }
                    }
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing video: ${e.message}", e)
            promise.reject("VIDEO_PLAYER_ERROR", e.message)
        }
    }
    
    // For backward compatibility
    @ReactMethod
    fun playVideo(url: String, promise: Promise) {
        try {
            Log.d(TAG, "Playing video (backward compatibility): $url")
            // Use ExoPlayer by default
            val intent = Intent(reactApplicationContext, ExoPlayerActivity::class.java).apply {
                putExtra("VIDEO_URL", url)
                putExtra("VIDEO_TITLE", "Video")
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error playing video: ${e.message}", e)
            promise.reject("VIDEO_PLAYER_ERROR", e.message)
        }
    }
}