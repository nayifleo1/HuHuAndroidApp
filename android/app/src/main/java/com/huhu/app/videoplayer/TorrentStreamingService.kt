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

    companion object {
        private const val TAG = "TorrentStreamingService"
    }

    fun initialize() {
        val torrentOptions = TorrentOptions.Builder()
            .saveLocation(context.getExternalFilesDir(null))
            .removeFilesAfterStop(true)
            .build()

        torrentStream = TorrentStream.init(torrentOptions)
        torrentStream?.addListener(this)
    }

    fun startStream(magnetUri: String, promise: Promise, callback: Callback) {
        currentPromise = promise
        progressCallback = callback
        
        try {
            torrentStream?.startStream(magnetUri)
        } catch (e: Exception) {
            promise.reject("TORRENT_ERROR", "Failed to start torrent stream", e)
        }
    }

    fun stopStream() {
        torrentStream?.stopStream()
        currentTorrent = null
        currentPromise = null
        progressCallback = null
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
        currentPromise?.reject("TORRENT_ERROR", "Torrent streaming error", e)
        currentTorrent = null
    }

    override fun onStreamReady(torrent: Torrent) {
        Log.d(TAG, "Stream ready")
        val videoFile = torrent.videoFile
        if (videoFile != null && videoFile.exists()) {
            currentPromise?.resolve(videoFile.absolutePath)
        } else {
            currentPromise?.reject("TORRENT_ERROR", "No video file found in torrent")
        }
    }

    override fun onStreamProgress(torrent: Torrent, status: StreamStatus) {
        val progress = mapOf(
            "bufferProgress" to status.bufferProgress,
            "downloadSpeed" to status.downloadSpeed,
            "progress" to status.progress,
            "seeds" to status.seeds
        )
        progressCallback?.invoke(progress)
    }

    override fun onStreamStopped() {
        Log.d(TAG, "Stream stopped")
        currentTorrent = null
    }
} 