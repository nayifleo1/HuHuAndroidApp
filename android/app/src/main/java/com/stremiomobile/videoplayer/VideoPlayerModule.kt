package com.stremiomobile.videoplayer

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableArray

class VideoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "VideoPlayerModule"

    @ReactMethod
    fun playVideo(url: String, options: ReadableMap, promise: Promise) {
        try {
            val useExternalPlayer = if (options.hasKey("useExternalPlayer")) options.getBoolean("useExternalPlayer") else false
            val title = if (options.hasKey("title")) options.getString("title") else "Video"
            val poster = if (options.hasKey("poster")) options.getString("poster") else null
            
            // Handle subtitles
            val subtitleUrl = if (options.hasKey("subtitleUrl")) options.getString("subtitleUrl") else null
            val subtitleLanguage = if (options.hasKey("subtitleLanguage")) options.getString("subtitleLanguage") else null
            
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
                    putExtra("SUBTITLE_URL", subtitleUrl)
                    putExtra("SUBTITLE_LANGUAGE", subtitleLanguage)
                    
                    // Add headers if available
                    if (headers != null) {
                        if (headers.hasKey("Referer")) {
                            putExtra("HEADER_REFERER", headers.getString("Referer"))
                        }
                        if (headers.hasKey("User-Agent")) {
                            putExtra("HEADER_USER_AGENT", headers.getString("User-Agent"))
                        }
                        if (headers.hasKey("Origin")) {
                            putExtra("HEADER_ORIGIN", headers.getString("Origin"))
                        }
                    }
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("VIDEO_PLAYER_ERROR", e.message)
        }
    }
    
    // For backward compatibility
    @ReactMethod
    fun playVideo(url: String, promise: Promise) {
        try {
            // Use ExoPlayer by default
            val intent = Intent(reactApplicationContext, ExoPlayerActivity::class.java).apply {
                putExtra("VIDEO_URL", url)
                putExtra("VIDEO_TITLE", "Video")
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VIDEO_PLAYER_ERROR", e.message)
        }
    }
}