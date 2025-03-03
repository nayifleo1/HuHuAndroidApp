package com.stremiomobile.videoplayer

import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.os.bundleOf
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.stremiomobile.R
import java.util.HashMap

class ExoPlayerActivity : AppCompatActivity() {

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private var playWhenReady = true
    private var currentItem = 0
    private var playbackPosition = 0L
    private var videoTitle: String? = null
    private var subtitleUrl: String? = null
    private var subtitleLanguage: String? = null
    private var headers: HashMap<String, String> = HashMap()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_exo_player)
        
        // Force landscape orientation
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        
        // Setup fullscreen
        setupFullscreen()
        
        playerView = findViewById(R.id.player_view)
        
        // Get video URL and title from intent
        val videoUrl = intent.getStringExtra("VIDEO_URL") ?: ""
        videoTitle = intent.getStringExtra("VIDEO_TITLE") ?: "Video"
        subtitleUrl = intent.getStringExtra("SUBTITLE_URL")
        subtitleLanguage = intent.getStringExtra("SUBTITLE_LANGUAGE")
        
        // Get headers if available
        intent.getStringExtra("HEADER_REFERER")?.let { headers["Referer"] = it }
        intent.getStringExtra("HEADER_USER_AGENT")?.let { headers["User-Agent"] = it }
        intent.getStringExtra("HEADER_ORIGIN")?.let { headers["Origin"] = it }
        
        // Set video title in the player
        findViewById<TextView>(R.id.video_title)?.text = videoTitle
        
        // Setup back button
        findViewById<ImageButton>(R.id.back_button)?.setOnClickListener {
            finish()
        }
        
        // Initialize player
        initializePlayer(videoUrl)
        
        // Setup playback speed button
        findViewById<ImageButton>(R.id.exo_playback_speed)?.setOnClickListener {
            showSpeedOptions()
        }
        
        // Setup subtitle button
        findViewById<ImageButton>(R.id.exo_subtitle)?.setOnClickListener {
            toggleSubtitles()
        }
    }

    private fun initializePlayer(videoUrl: String) {
        player = ExoPlayer.Builder(this)
            .build()
            .also { exoPlayer ->
                playerView.player = exoPlayer
                
                // Create media item with headers if needed
                val mediaItemBuilder = MediaItem.Builder()
                    .setUri(Uri.parse(videoUrl))
                
                // Add headers if available
                if (headers.isNotEmpty()) {
                    // Create a bundle with headers
                    val headerBundle = Bundle()
                    headers.forEach { (key, value) ->
                        headerBundle.putString(key, value)
                    }
                    
                    // Set request metadata with headers
                    val requestMetadata = MediaItem.RequestMetadata.Builder()
                        .setMediaUri(Uri.parse(videoUrl))
                        .setExtras(headerBundle)
                        .build()
                    
                    mediaItemBuilder.setRequestMetadata(requestMetadata)
                }
                
                // Add subtitle track if available
                if (subtitleUrl != null && subtitleLanguage != null) {
                    try {
                        val subtitleConfig = MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                            .setMimeType(MimeTypes.APPLICATION_SUBRIP)
                            .setLanguage(subtitleLanguage)
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                            .build()
                        
                        mediaItemBuilder.setSubtitleConfigurations(listOf(subtitleConfig))
                    } catch (e: Exception) {
                        // If subtitle configuration fails, continue without subtitles
                    }
                }
                
                val mediaItem = mediaItemBuilder.build()
                exoPlayer.setMediaItem(mediaItem)
                
                exoPlayer.playWhenReady = playWhenReady
                exoPlayer.seekTo(currentItem, playbackPosition)
                exoPlayer.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        super.onPlaybackStateChanged(playbackState)
                        if (playbackState == Player.STATE_ENDED) {
                            finish()
                        }
                    }
                })
                exoPlayer.prepare()
            }
    }

    private fun setupFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun hideSystemUi() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }

    private fun showSpeedOptions() {
        val speeds = arrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        val currentSpeed = player?.playbackParameters?.speed ?: 1.0f
        
        val speedDialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(getString(R.string.exo_player_speed))
            .setSingleChoiceItems(
                speeds.map { "${it}x" }.toTypedArray(),
                speeds.indexOf(currentSpeed)
            ) { dialog, which ->
                player?.setPlaybackSpeed(speeds[which])
                dialog.dismiss()
            }
            .create()
        
        speedDialog.show()
    }
    
    private fun toggleSubtitles() {
        player?.let { exoPlayer ->
            val trackSelector = exoPlayer.trackSelectionParameters
            val builder = trackSelector.buildUpon()
            
            // Toggle subtitles on/off
            val currentSubtitleState = trackSelector.disabledTrackTypes.contains(C.TRACK_TYPE_TEXT)
            
            if (currentSubtitleState) {
                // Enable subtitles - remove TEXT from disabled types
                val newDisabledTypes = trackSelector.disabledTrackTypes.toMutableSet()
                newDisabledTypes.remove(C.TRACK_TYPE_TEXT)
                builder.setDisabledTrackTypes(newDisabledTypes)
            } else {
                // Disable subtitles
                builder.setDisabledTrackTypes(setOf(C.TRACK_TYPE_TEXT))
            }
            
            exoPlayer.trackSelectionParameters = builder.build()
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
    }

    override fun onPause() {
        super.onPause()
        releasePlayer()
    }

    override fun onStop() {
        super.onStop()
        releasePlayer()
    }

    private fun releasePlayer() {
        player?.let { exoPlayer ->
            playbackPosition = exoPlayer.currentPosition
            currentItem = exoPlayer.currentMediaItemIndex
            playWhenReady = exoPlayer.playWhenReady
            exoPlayer.release()
        }
        player = null
    }
} 