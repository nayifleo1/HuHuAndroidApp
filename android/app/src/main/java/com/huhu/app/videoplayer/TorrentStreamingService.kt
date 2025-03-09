package com.huhu.app.videoplayer

import android.content.Context
import android.os.Environment
import android.util.Log
import com.github.se_bastiaan.torrentstream.StreamStatus
import com.github.se_bastiaan.torrentstream.Torrent
import com.github.se_bastiaan.torrentstream.TorrentOptions
import com.github.se_bastiaan.torrentstream.TorrentStream
import com.github.se_bastiaan.torrentstream.listeners.TorrentListener
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import java.io.File

class TorrentStreamingService(private val context: Context) : TorrentListener {
    private var torrentStream: TorrentStream? = null
    private var currentPromise: Promise? = null
    private var progressCallback: Callback? = null
    private var currentTorrent: Torrent? = null
    private var isCachedFile: Boolean = false
    private var currentMagnetUri: String? = null

    companion object {
        private const val TAG = "TorrentStreamingService"
    }

    fun initialize() {
        val torrentOptions = TorrentOptions.Builder()
            .saveLocation(context.getExternalFilesDir(null))
            .removeFilesAfterStop(false)
            .maxDownloadSpeed(0) // No speed limit
            .maxUploadSpeed(0) // No speed limit
            .maxConnections(200) // Increase max connections
            .autoDownload(true)
            .build()

        torrentStream = TorrentStream.init(torrentOptions)
        torrentStream?.addListener(this)
    }

    fun startStream(magnetUri: String, promise: Promise, callback: Callback) {
        currentPromise = promise
        progressCallback = callback
        currentMagnetUri = magnetUri
        
        try {
            // Check if the file already exists in the save location
            val infoHash = magnetUri.substringAfter("btih:").substringBefore("&")
            val saveLocation = context.getExternalFilesDir(null)
            val files = saveLocation?.listFiles { file -> 
                file.isFile && file.name.contains(infoHash, ignoreCase = true)
            }
            
            isCachedFile = files?.isNotEmpty() == true
            
            if (isCachedFile) {
                Log.d(TAG, "Found cached file for torrent with hash: $infoHash")
                // Even for cached files, start the stream to maintain the session
                torrentStream?.startStream(magnetUri)
                // But immediately resolve with the cached file path
                files?.firstOrNull()?.let { file ->
                    promise.resolve(file.absolutePath)
                }
            } else {
                Log.d(TAG, "Starting new torrent download with hash: $infoHash")
                torrentStream?.startStream(magnetUri)
            }
        } catch (e: Exception) {
            promise.reject("TORRENT_ERROR", "Failed to start torrent stream", e)
        }
    }

    fun stopStream() {
        currentTorrent = null
        currentPromise = null
        progressCallback = null
        isCachedFile = false
        currentMagnetUri = null
        
        try {
            torrentStream?.stopStream()
            Log.d(TAG, "Successfully stopped torrent stream")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping torrent stream", e)
        }
    }

    override fun onStreamPrepared(torrent: Torrent) {
        Log.d(TAG, "Stream prepared")
        currentTorrent = torrent
    }

    override fun onStreamStarted(torrent: Torrent) {
        Log.d(TAG, "Stream started")
    }

    override fun onStreamError(torrent: Torrent, e: Exception) {
        Log.e(TAG, "Stream error", e)
        if (!isCachedFile) {
            currentPromise?.reject("TORRENT_ERROR", "Torrent streaming error", e)
        }
        currentTorrent = null
    }

    override fun onStreamReady(torrent: Torrent) {
        Log.d(TAG, "Stream ready - Video file ready for playback")
        if (!isCachedFile) {
            val videoFile = torrent.videoFile
            if (videoFile != null && videoFile.exists()) {
                Log.d(TAG, "Resolved with video file path: ${videoFile.absolutePath}")
                
                // Save this file to our cache mapping
                currentMagnetUri?.let { magnetUri ->
                    Log.d(TAG, "Saving magnet URI to cache: $magnetUri -> ${videoFile.absolutePath}")
                }
                
                currentPromise?.resolve(videoFile.absolutePath)
            } else {
                Log.e(TAG, "No video file found in torrent")
                currentPromise?.reject("TORRENT_ERROR", "No video file found in torrent")
            }
        }
    }

    override fun onStreamProgress(torrent: Torrent, status: StreamStatus) {
        try {
            val bufferProgress = status.bufferProgress
            val downloadSpeed = status.downloadSpeed
            val seeds = status.seeds
            val progress = status.progress
            
            Log.d(TAG, "Stream progress - Buffer: ${bufferProgress}%, Speed: ${downloadSpeed}, Seeds: ${seeds}, Progress: ${progress}%")
            
            val progressMap = HashMap<String, Any>()
            progressMap["bufferProgress"] = bufferProgress
            progressMap["downloadSpeed"] = downloadSpeed
            progressMap["progress"] = progress
            progressMap["seeds"] = seeds
            
            // Check if we have a callback to invoke
            if (progressCallback != null) {
                progressCallback?.invoke(progressMap)
            } else {
                Log.w(TAG, "Progress callback is null, can't send update")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in progress callback", e)
        }
    }

    override fun onStreamStopped() {
        Log.d(TAG, "Stream stopped")
        currentTorrent = null
        isCachedFile = false
        currentMagnetUri = null
    }
} 