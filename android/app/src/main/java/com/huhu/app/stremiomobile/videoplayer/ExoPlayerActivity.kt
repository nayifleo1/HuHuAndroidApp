package com.huhu.app.videoplayer

import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.os.bundleOf
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.huhu.app.R
import java.util.HashMap
import java.util.Locale

class ExoPlayerActivity : AppCompatActivity() {

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private lateinit var trackSelector: DefaultTrackSelector
    private var playWhenReady = true
    private var currentItem = 0
    private var playbackPosition = 0L
    private var videoTitle: String? = null
    private var subtitleUrl: String? = null
    private var subtitleLanguage: String? = null
    private var headers: HashMap<String, String> = HashMap()
    private var currentAspectRatio = 0 // 0: fit, 1: fill, 2: zoom, 3: 16:9, 4: 4:3
    private val TAG = "ExoPlayerActivity"
    // Flag to track if we have external subtitles
    private var hasExternalSubtitles = false
    // Reference to subtitle button to avoid repeated findViewById calls
    private var subtitleButton: ImageButton? = null
    private var audioButton: ImageButton? = null
    // Flag to track if we've detected subtitles at any point
    private var subtitlesEverDetected = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_exo_player)
        
        // Force landscape orientation
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        
        // Setup fullscreen
        setupFullscreen()
        hideSystemUi()
        
        playerView = findViewById(R.id.player_view)
        
        // Configure PlayerView to prevent auto-hiding of controls
        playerView.controllerShowTimeoutMs = 0 // Prevent auto-hiding of controls
        playerView.controllerHideOnTouch = false // Don't hide controls on touch
        playerView.setShowNextButton(false)
        playerView.setShowPreviousButton(false)
        
        // Override the controller visibility listener to prevent hiding
        playerView.setControllerVisibilityListener(androidx.media3.ui.PlayerView.ControllerVisibilityListener { visibility ->
            // If controller is trying to hide (visibility = GONE), force it to stay visible
            if (visibility == View.GONE) {
                // Schedule showing the controller again
                Handler(Looper.getMainLooper()).post {
                    playerView.showController()
                    // Ensure our subtitle button stays visible and enabled
                    subtitleButton?.apply {
                        this.visibility = View.VISIBLE
                        isEnabled = true
                        alpha = 1.0f
                        setColorFilter(android.graphics.Color.WHITE)
                        invalidate()
                    }
                }
                Log.d(TAG, "Controller tried to hide, forcing it to stay visible")
            }
        })
        
        // Get video URL and title from intent
        val videoUrl = intent.getStringExtra("VIDEO_URL") ?: ""
        videoTitle = intent.getStringExtra("VIDEO_TITLE") ?: "Video"
        subtitleUrl = intent.getStringExtra("SUBTITLE_URL")
        subtitleLanguage = intent.getStringExtra("SUBTITLE_LANGUAGE")
        
        // Check if we have external subtitles
        hasExternalSubtitles = subtitleUrl != null
        
        // Log for debugging
        Log.d(TAG, "Video URL: $videoUrl")
        Log.d(TAG, "Subtitle URL: $subtitleUrl, Language: $subtitleLanguage")
        Log.d(TAG, "External subtitles available: $hasExternalSubtitles")
        
        // Get headers if available
        intent.getStringExtra("HEADER_REFERER")?.let { 
            headers["Referer"] = it
            Log.d(TAG, "Header Referer: $it")
        }
        intent.getStringExtra("HEADER_USER_AGENT")?.let { 
            headers["User-Agent"] = it
            Log.d(TAG, "Header User-Agent: $it")
        }
        intent.getStringExtra("HEADER_ORIGIN")?.let { 
            headers["Origin"] = it
            Log.d(TAG, "Header Origin: $it")
        }
        
        // Set video title in the player
        findViewById<TextView>(R.id.video_title)?.text = videoTitle
        
        // Setup back button
        findViewById<ImageButton>(R.id.back_button)?.setOnClickListener {
            finish()
        }
        
        // Cache references to buttons
        subtitleButton = findViewById(R.id.exo_subtitle)
        audioButton = findViewById(R.id.exo_audio_track)
        
        // Setup subtitle button - ALWAYS visible and enabled
        subtitleButton?.apply {
            visibility = View.VISIBLE
            isEnabled = true
            alpha = 1.0f
            setColorFilter(android.graphics.Color.WHITE)
            setOnClickListener {
                showSubtitleOptions()
            }
            Log.d(TAG, "Subtitle button initialized: VISIBLE and enabled")
        }
        
        // Setup audio track button - ALWAYS visible and enabled
        audioButton?.apply {
            visibility = View.VISIBLE
            isEnabled = true
            alpha = 1.0f
            setColorFilter(android.graphics.Color.WHITE)
            setOnClickListener {
                showAudioTrackOptions()
            }
            Log.d(TAG, "Audio track button initialized: VISIBLE and enabled")
        }
        
        // Setup aspect ratio button
        findViewById<ImageButton>(R.id.exo_aspect_ratio)?.setOnClickListener {
            toggleAspectRatio()
        }
        
        // Setup periodic check to ensure subtitle button remains enabled
        val handler = Handler(Looper.getMainLooper())
        val runnableCode = object : Runnable {
            override fun run() {
                // Check if we should keep the subtitle button enabled
                subtitleButton?.apply {
                    // Always keep the subtitle button visible and enabled
                    if (!isEnabled || alpha < 1.0f || visibility != View.VISIBLE) {
                        Log.d(TAG, "Periodic check: Re-enabling subtitle button")
                        isEnabled = true
                        visibility = View.VISIBLE
                        alpha = 1.0f
                        setColorFilter(android.graphics.Color.WHITE)
                        invalidate() // Force redraw
                    }
                }
                // Run more frequently to catch visibility changes (200ms instead of 1000ms)
                handler.postDelayed(this, 200)
            }
        }
        // Start the periodic check
        handler.post(runnableCode)
        
        // Initialize player
        initializePlayer(videoUrl)
    }

    private fun initializePlayer(videoUrl: String) {
        // Create a track selector with default parameters
        trackSelector = DefaultTrackSelector(this).apply {
            // Ensure tracks are not disabled by default and set up subtitle preferences
            setParameters(buildUponParameters()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                .setPreferredTextLanguage(subtitleLanguage ?: "en")
                .setSelectUndeterminedTextLanguage(true)  // Select text track even if language is undetermined
                .setDisabledTextTrackSelectionFlags(0)  // Don't disable any text tracks
                .setForceHighestSupportedBitrate(true)  // Use highest quality available
                .build())
        }
        
        // Log track selector parameters
        Log.d(TAG, "Track selector initialized with parameters: ${trackSelector.parameters}")
        
        // Create the player with the track selector
        player = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
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
                if (subtitleUrl != null) {
                    try {
                        val language = subtitleLanguage ?: "en"
                        Log.d(TAG, "Adding subtitle: $subtitleUrl, language: $language")
                        
                        val subtitleConfig = MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                            .setMimeType(MimeTypes.APPLICATION_SUBRIP)
                            .setLanguage(language)
                            .setLabel(getLanguageDisplayName(language))
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT or C.SELECTION_FLAG_AUTOSELECT)  // Make it default and auto-select
                            .build()
                        
                        mediaItemBuilder.setSubtitleConfigurations(listOf(subtitleConfig))
                        hasExternalSubtitles = true
                        subtitlesEverDetected = true  // Consider external subtitles as detected
                        
                        Log.d(TAG, "External subtitle added successfully")
                    } catch (e: Exception) {
                        // If subtitle configuration fails, continue without subtitles
                        Log.e(TAG, "Error adding subtitle: ${e.message}")
                        hasExternalSubtitles = false
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
                        } else if (playbackState == Player.STATE_READY) {
                            // Check tracks when playback is ready (for debugging only)
                            val tracks = exoPlayer.currentTracks
                            logTrackInfo(tracks)
                            Log.d(TAG, "Playback STATE_READY, track info logged")
                            
                            // Update subtitle button immediately when playback is ready
                            updateSubtitleButtonState(tracks)
                            
                            // Keep controls visible
                            keepControlsVisible()
                        }
                    }
                    
                    override fun onTracksChanged(tracks: Tracks) {
                        super.onTracksChanged(tracks)
                        // Log track information for debugging
                        logTrackInfo(tracks)
                        
                        // Update subtitle button visibility based on available subtitle tracks
                        updateSubtitleButtonState(tracks)
                        
                        // Verify subtitle track selection
                        verifySubtitleTrackSelection(tracks)
                        
                        // Force redraw of the subtitle button to update its appearance
                        subtitleButton?.invalidate()
                    }
                    
                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        super.onPlayerError(error)
                        Log.e(TAG, "Player error: ${error.localizedMessage}")
                        // Even on error, keep subtitle button enabled if we detected subtitles earlier
                        if (subtitlesEverDetected || hasExternalSubtitles) {
                            subtitleButton?.apply {
                                isEnabled = true
                                visibility = View.VISIBLE
                                alpha = 1.0f
                                setColorFilter(android.graphics.Color.WHITE)
                            }
                            Log.d(TAG, "Keeping subtitle button enabled despite player error")
                        }
                    }
                })
                exoPlayer.prepare()
            }
    }
    
    private fun updateSubtitleButtonState(tracks: Tracks) {
        // Count all text tracks for subtitles
        var hasTextTracks = false
        
        for (group in tracks.groups) {
            if (group.type == C.TRACK_TYPE_TEXT) {
                if (group.length > 0) {
                    hasTextTracks = true
                    subtitlesEverDetected = true  // Remember we've seen subtitles at least once
                    break
                }
            }
        }
        
        // Use previously detected subtitles flag to prevent disabling after detection
        val hasSubtitles = hasTextTracks || hasExternalSubtitles || subtitlesEverDetected
        
        // Update subtitle button appearance
        subtitleButton?.apply {
            // Always enable the subtitle button if there are text tracks or we've ever detected them
            isEnabled = hasSubtitles
            
            // Always keep the button visible
            visibility = View.VISIBLE
            
            // Update the button's appearance based on availability
            if (hasSubtitles) {
                // Make it fully opaque and white when subtitles are available
                alpha = 1.0f
                // Set the tint to white to make it clearly visible
                setColorFilter(android.graphics.Color.WHITE)
            } else {
                // Make it semi-transparent and grey when no subtitles are available
                alpha = 0.5f
                // Set the tint to grey for disabled state
                setColorFilter(android.graphics.Color.GRAY)
            }
            
            Log.d(TAG, "Subtitle button updated: hasTextTracks=$hasTextTracks, hasExternalSubtitles=$hasExternalSubtitles, subtitlesEverDetected=$subtitlesEverDetected, isEnabled=$isEnabled, alpha=$alpha")
        }
        
        // Also update the audio track button visibility since we have audio tracks
        audioButton?.apply {
            visibility = View.VISIBLE
            isEnabled = true
            alpha = 1.0f
            setColorFilter(android.graphics.Color.WHITE)
        }
    }
    
    private fun getLanguageDisplayName(languageCode: String): String {
        return try {
            val locale = Locale(languageCode)
            val displayName = locale.getDisplayLanguage(Locale.ENGLISH)
            
            // If we got back same as input or empty, it's an invalid code
            if (displayName == languageCode || displayName.isEmpty()) {
                "Track ($languageCode)"
            } else {
                displayName
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting language name: ${e.message}")
            "Track ($languageCode)"
        }
    }
    
    private fun logTrackInfo(tracks: Tracks) {
        Log.d(TAG, "Track groups count: ${tracks.groups.size}")
        
        tracks.groups.forEachIndexed { index, group ->
            Log.d(TAG, "Group $index - Type: ${getTrackTypeString(group.type)}, Length: ${group.length}")
            
            for (i in 0 until group.length) {
                val format = group.getTrackFormat(i)
                Log.d(TAG, "  Track $i - Language: ${format.language}, Label: ${format.label}, " +
                        "Mime: ${format.sampleMimeType}, Bitrate: ${format.bitrate}")
            }
        }
    }
    
    private fun getTrackTypeString(trackType: Int): String {
        return when (trackType) {
            C.TRACK_TYPE_AUDIO -> "AUDIO"
            C.TRACK_TYPE_VIDEO -> "VIDEO"
            C.TRACK_TYPE_TEXT -> "TEXT"
            else -> "OTHER"
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
    
    private fun showSubtitleOptions() {
        player?.let { exoPlayer ->
            val tracks = exoPlayer.currentTracks
            
            // Count all text tracks for subtitles
            val subtitleTracks = mutableListOf<Pair<Int, Int>>() // Group index, track index
            
            tracks.groups.forEachIndexed { groupIndex, group ->
                if (group.type == C.TRACK_TYPE_TEXT) {
                    for (trackIndex in 0 until group.length) {
                        subtitleTracks.add(Pair(groupIndex, trackIndex))
                        // Remember we found subtitles
                        subtitlesEverDetected = true
                    }
                }
            }
            
            // If we ever detected subtitles but they're not present now, force the memory flag
            if (subtitlesEverDetected && subtitleTracks.isEmpty()) {
                Log.d(TAG, "No subtitle tracks currently present, but we've detected them before")
            }
            
            // Log subtitle track count for debugging
            Log.d(TAG, "Subtitle tracks found: ${subtitleTracks.size}, Has external: $hasExternalSubtitles, Ever detected: $subtitlesEverDetected")
            
            // Create subtitle options - first option is always "Off"
            val subtitleOptions = mutableListOf("Off")
            
            // Add all found subtitle tracks
            subtitleTracks.forEachIndexed { index, pair ->
                val group = tracks.groups[pair.first]
                val format = group.getTrackFormat(pair.second)
                val trackName = when {
                    !format.label.isNullOrEmpty() -> format.label.toString()
                    !format.language.isNullOrEmpty() -> getLanguageDisplayName(format.language!!)
                    else -> "Track ${index + 1}"
                }
                subtitleOptions.add(trackName)
                
                Log.d(TAG, "Found subtitle track: $trackName")
            }
            
            // If we have an external subtitle but no in-stream subtitles, add it as an option
            if (hasExternalSubtitles) {
                val displayName = if (subtitleLanguage != null) {
                    getLanguageDisplayName(subtitleLanguage!!)
                } else {
                    "External"
                }
                subtitleOptions.add(displayName)
                Log.d(TAG, "Added external subtitle option: $displayName")
            }
            
            // Determine current selection
            val parameters = trackSelector.parameters
            val subtitleDisabled = parameters.disabledTrackTypes.contains(C.TRACK_TYPE_TEXT)
            var selectedIndex = 0 // Default to "Off"
            
            if (!subtitleDisabled && (subtitleTracks.isNotEmpty() || hasExternalSubtitles)) {
                // If subtitles are enabled, select the first option after "Off"
                selectedIndex = 1
            }
            
            // Prepare dialog message
            val dialogMessage = if (subtitleOptions.size <= 1) {
                "No subtitle tracks available for this video"
            } else {
                "Select subtitle track:"
            }
            
            Log.d(TAG, "Creating subtitle dialog with ${subtitleOptions.size} options, selected: $selectedIndex")
            
            // Show dialog - always show a dialog, even if no subtitles are available
            val builder = AlertDialog.Builder(this)
                .setTitle("Subtitles")
            
            // If we have options other than just "Off", show a choice dialog
            if (subtitleOptions.size > 1) {
                builder.setSingleChoiceItems(
                    subtitleOptions.toTypedArray(),
                    selectedIndex
                ) { dialog, which ->
                    if (which == 0) {
                        // Disable subtitles
                        val newParameters = trackSelector.buildUponParameters()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                            .build()
                        trackSelector.parameters = newParameters
                        Log.d(TAG, "Subtitles disabled by user")
                        Toast.makeText(this, "Subtitles disabled", Toast.LENGTH_SHORT).show()
                    } else {
                        // Enable subtitles and select the specific track
                        try {
                            val trackIndex = which - 1 // Subtract 1 because first option is "Off"
                            if (trackIndex < subtitleTracks.size) {
                                // It's an in-stream subtitle track
                                val (groupIndex, trackIdx) = subtitleTracks[trackIndex]
                                val group = tracks.groups[groupIndex]
                                val format = group.getTrackFormat(trackIdx)
                                
                                val newParameters = trackSelector.buildUponParameters()
                                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                    .setPreferredTextLanguage(format.language)
                                    .build()
                                trackSelector.parameters = newParameters
                                
                                Log.d(TAG, "Selected in-stream subtitle track: ${format.language}")
                            } else if (hasExternalSubtitles) {
                                // It's the external subtitle track
                                val newParameters = trackSelector.buildUponParameters()
                                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                    .setPreferredTextLanguage(subtitleLanguage ?: "en")
                                    .build()
                                trackSelector.parameters = newParameters
                                
                                Log.d(TAG, "Selected external subtitle track")
                            }
                            
                            // Force a tracks refresh by recreating the player
                            player?.let { currentPlayer ->
                                val position = currentPlayer.currentPosition
                                val mediaItem = currentPlayer.currentMediaItem
                                currentPlayer.release()
                                initializePlayer(mediaItem?.localConfiguration?.uri.toString())
                                player?.seekTo(position)
                            }
                            
                            Toast.makeText(this, "Subtitles enabled: ${subtitleOptions[which]}", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Log.e(TAG, "Error selecting subtitle track: ${e.message}")
                            Toast.makeText(this, "Failed to select subtitle track", Toast.LENGTH_SHORT).show()
                        }
                    }
                    dialog.dismiss()
                }
            } else {
                // Just show a message if no subtitle options
                builder.setMessage(dialogMessage)
                    .setPositiveButton("OK") { dialog, _ -> dialog.dismiss() }
            }
            
            builder.create().show()
        }
    }
    
    private fun showAudioTrackOptions() {
        player?.let { exoPlayer ->
            val tracks = exoPlayer.currentTracks
            val audioTracks = mutableListOf<Pair<Int, Int>>() // Group index, track index
            val audioOptions = mutableListOf<String>()
            
            // Find all audio tracks
            tracks.groups.forEachIndexed { groupIndex, group ->
                if (group.type == C.TRACK_TYPE_AUDIO) {
                    for (trackIndex in 0 until group.length) {
                        val format = group.getTrackFormat(trackIndex)
                        
                        // Get more descriptive track name
                        val trackName = when {
                            !format.label.isNullOrEmpty() -> format.label.toString()
                            !format.language.isNullOrEmpty() -> getLanguageDisplayName(format.language!!)
                            else -> "Track ${audioTracks.size + 1}"
                        }
                        
                        val channelCount = format.channelCount
                        val bitrate = format.bitrate
                        
                        // Add audio quality information
                        val qualityInfo = StringBuilder()
                        
                        // Add channel information
                        if (channelCount > 0) {
                            qualityInfo.append(getAudioChannelLabel(channelCount))
                        }
                        
                        // Add bitrate information if available
                        if (bitrate > 0) {
                            if (qualityInfo.isNotEmpty()) qualityInfo.append(", ")
                            qualityInfo.append("${bitrate / 1000} kbps")
                        }
                        
                        // Check if it has descriptive audio
                        val isDescriptive = format.roleFlags and C.ROLE_FLAG_DESCRIBES_VIDEO != 0
                        if (isDescriptive) {
                            if (qualityInfo.isNotEmpty()) qualityInfo.append(", ")
                            qualityInfo.append("Descriptive")
                        }
                        
                        // Combine all information
                        val label = if (qualityInfo.isNotEmpty()) {
                            "$trackName ($qualityInfo)"
                        } else {
                            trackName
                        }
                        
                        audioOptions.add(label)
                        audioTracks.add(Pair(groupIndex, trackIndex))
                    }
                }
            }
            
            // Log audio tracks for debugging
            Log.d(TAG, "Found ${audioTracks.size} audio tracks for selection")
            
            // If no audio tracks, show a message dialog but don't return
            if (audioTracks.isEmpty()) {
                AlertDialog.Builder(this)
                    .setTitle("Audio Tracks")
                    .setMessage("No additional audio tracks available for this video")
                    .setPositiveButton("OK") { dialog, _ -> dialog.dismiss() }
                    .show()
                return
            }
            
            // Show dialog with options
            AlertDialog.Builder(this)
                .setTitle("Audio Track")
                .setItems(audioOptions.toTypedArray()) { dialog, which ->
                    val (groupIndex, trackIndex) = audioTracks[which]
                    val group = tracks.groups[groupIndex]
                    
                    // For Media3, we need to use the track selector to select tracks
                    try {
                        // Make sure audio is not disabled but KEEP subtitle settings
                        // We need to preserve existing parameters for other track types
                        val currentParameters = trackSelector.parameters
                        val newParameters = currentParameters.buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                            .setPreferredAudioLanguage(group.getTrackFormat(trackIndex).language)
                            .build()
                        
                        trackSelector.parameters = newParameters
                        
                        Toast.makeText(this, "Selected: ${audioOptions[which]}", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Log.e(TAG, "Error selecting audio track: ${e.message}")
                        Toast.makeText(this, "Failed to select audio track", Toast.LENGTH_SHORT).show()
                    }
                    
                    dialog.dismiss()
                }
                .create()
                .show()
        }
    }
    
    private fun getAudioChannelLabel(channelCount: Int): String {
        return when (channelCount) {
            1 -> "Mono"
            2 -> "Stereo"
            6 -> "5.1"
            8 -> "7.1"
            else -> "${channelCount}ch"
        }
    }
    
    private fun toggleAspectRatio() {
        // Cycle through aspect ratio options
        currentAspectRatio = (currentAspectRatio + 1) % 5
        
        when (currentAspectRatio) {
            0 -> { // Fit
                playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                Toast.makeText(this, "Aspect Ratio: Fit", Toast.LENGTH_SHORT).show()
            }
            1 -> { // Fill
                playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
                Toast.makeText(this, "Aspect Ratio: Fill", Toast.LENGTH_SHORT).show()
            }
            2 -> { // Zoom
                playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                Toast.makeText(this, "Aspect Ratio: Zoom", Toast.LENGTH_SHORT).show()
            }
            3 -> { // 16:9
                playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIXED_WIDTH
                Toast.makeText(this, "Aspect Ratio: 16:9", Toast.LENGTH_SHORT).show()
            }
            4 -> { // 4:3
                playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIXED_HEIGHT
                Toast.makeText(this, "Aspect Ratio: 4:3", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        keepControlsVisible()
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

    // Add this method to ensure controls always stay visible
    private fun keepControlsVisible() {
        // Force controller to be visible
        playerView.showController()
        playerView.controllerHideOnTouch = false
        playerView.controllerShowTimeoutMs = 0
    }

    private fun verifySubtitleTrackSelection(tracks: Tracks) {
        // If subtitles are enabled but no text track is selected, try to force selection
        val hasEnabledTextTrack = tracks.groups.any { group ->
            group.type == C.TRACK_TYPE_TEXT && group.isSelected
        }
        
        if (!hasEnabledTextTrack && (subtitlesEverDetected || hasExternalSubtitles)) {
            Log.d(TAG, "No text track selected, attempting to force selection")
            
            // Find the first available text track
            tracks.groups.forEachIndexed { groupIndex, group ->
                if (group.type == C.TRACK_TYPE_TEXT && group.length > 0) {
                    try {
                        val format = group.getTrackFormat(0)
                        val newParameters = trackSelector.buildUponParameters()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                            .setPreferredTextLanguage(format.language)
                            .build()
                        trackSelector.parameters = newParameters
                        
                        Log.d(TAG, "Forced selection of text track: ${format.language}")
                        return
                    } catch (e: Exception) {
                        Log.e(TAG, "Error forcing text track selection: ${e.message}")
                    }
                }
            }
        }
    }
} 