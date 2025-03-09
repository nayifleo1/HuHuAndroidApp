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
import android.view.WindowManager
import android.view.LayoutInflater
import android.view.ViewGroup
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
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.huhu.app.R
import java.util.HashMap
import java.util.Locale
import androidx.media3.common.PlaybackException
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.exoplayer.DefaultLoadControl
import com.google.android.material.bottomsheet.BottomSheetDialog
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

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
        
        // Keep screen on during video playback
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        setContentView(R.layout.activity_exo_player)
        
        // Force landscape orientation
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        
        // Setup fullscreen
        setupFullscreen()
        hideSystemUi()
        
        playerView = findViewById(R.id.player_view)
        
        // Configure PlayerView with auto-hiding controls
        playerView.controllerShowTimeoutMs = 3000 // Hide after 3 seconds
        playerView.controllerHideOnTouch = true // Hide on touch
        playerView.setShowNextButton(false)
        playerView.setShowPreviousButton(false)
        
        // Override the controller visibility listener
        playerView.setControllerVisibilityListener(androidx.media3.ui.PlayerView.ControllerVisibilityListener { visibility ->
            // Update button states when controller visibility changes
            if (visibility == View.VISIBLE) {
                subtitleButton?.apply {
                    this.visibility = View.VISIBLE
                    isEnabled = true
                    alpha = 1.0f
                }
                audioButton?.apply {
                    this.visibility = View.VISIBLE
                    isEnabled = true
                    alpha = 1.0f
                }
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
            setParameters(buildUponParameters()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                .setSelectUndeterminedTextLanguage(true)
                .setDisabledTextTrackSelectionFlags(0)
                // Optimize initial quality selection
                .setMaxVideoSize(1280, 720)  // Start with 720p for faster initial load
                .setMaxVideoBitrate(2000000) // Limit initial bitrate to 2Mbps
                .setForceHighestSupportedBitrate(false)
                .setExceedRendererCapabilitiesIfNecessary(true)
                .setTunnelingEnabled(true)
                .build())
        }
        
        // Create the player with optimized settings
        player = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .setMediaSourceFactory(
                DefaultMediaSourceFactory(this)
                    .setLiveMaxOffsetMs(0)  // Minimize live stream latency
                    .setLiveTargetOffsetMs(0)
            )
            .setLoadControl(
                DefaultLoadControl.Builder()
                    .setBufferDurationsMs(
                        2500,   // Minimum buffer (reduced from 10000)
                        15000,  // Maximum buffer (reduced from 30000)
                        500,    // Buffer for playback (reduced from 1500)
                        500     // Buffer for playback after rebuffer (reduced from 1500)
                    )
                    .setBackBuffer(0, false) // Disable back buffer
                    .setPrioritizeTimeOverSizeThresholds(true)
                    .build()
            )
            .setReleaseTimeoutMs(2000)
            .build()
            .also { exoPlayer ->
                playerView.player = exoPlayer
                
                // Set player properties for faster startup
                exoPlayer.setHandleAudioBecomingNoisy(false) // Disable audio focus handling
                exoPlayer.setWakeMode(C.WAKE_MODE_NONE) // Disable wake mode
                
                // Create media item with headers if needed
                val mediaItemBuilder = MediaItem.Builder()
                    .setUri(Uri.parse(videoUrl))
                    // Set live playback optimization
                    .setLiveConfiguration(
                        MediaItem.LiveConfiguration.Builder()
                            .setMaxPlaybackSpeed(1.02f)
                            .setMinPlaybackSpeed(0.98f)
                            .setMaxOffsetMs(0)
                            .setTargetOffsetMs(0)
                            .build()
                    )
                
                // Add headers if available
                if (headers.isNotEmpty()) {
                    val headerBundle = Bundle()
                    headers.forEach { (key, value) ->
                        headerBundle.putString(key, value)
                    }
                    
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
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT or C.SELECTION_FLAG_AUTOSELECT)
                            .build()
                        
                        mediaItemBuilder.setSubtitleConfigurations(listOf(subtitleConfig))
                        hasExternalSubtitles = true
                        subtitlesEverDetected = true
                        
                        Log.d(TAG, "External subtitle added successfully")
                    } catch (e: Exception) {
                        Log.e(TAG, "Error adding subtitle: ${e.message}")
                        hasExternalSubtitles = false
                    }
                }
                
                val mediaItem = mediaItemBuilder.build()
                exoPlayer.setMediaItem(mediaItem)
                
                exoPlayer.playWhenReady = true // Force immediate playback
                exoPlayer.seekTo(currentItem, playbackPosition)
                
                // Add listener for player events
                exoPlayer.addListener(object : Player.Listener {
                    override fun onTracksChanged(tracks: Tracks) {
                        super.onTracksChanged(tracks)
                        updateSubtitleButtonState(tracks)
                        logTrackInfo(tracks)
                    }
                    
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        super.onPlaybackStateChanged(playbackState)
                        when (playbackState) {
                            Player.STATE_IDLE -> {
                                Log.d(TAG, "Playback State: IDLE")
                            }
                            Player.STATE_BUFFERING -> {
                                Log.d(TAG, "Playback State: BUFFERING")
                                findViewById<View>(R.id.loading_indicator)?.visibility = View.VISIBLE
                            }
                            Player.STATE_READY -> {
                                Log.d(TAG, "Playback State: READY")
                                findViewById<View>(R.id.loading_indicator)?.visibility = View.GONE
                                
                                // Once playback starts, gradually increase quality
                                trackSelector.setParameters(
                                    trackSelector.buildUponParameters()
                                        .setMaxVideoSize(1920, 1080)
                                        .setMaxVideoBitrate(Integer.MAX_VALUE)
                                        .build()
                                )
                            }
                            Player.STATE_ENDED -> {
                                Log.d(TAG, "Playback State: ENDED")
                                finish()
                            }
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, "Player error: ${error.localizedMessage}")
                        Toast.makeText(this@ExoPlayerActivity, 
                            "Playback error: ${error.localizedMessage}", 
                            Toast.LENGTH_LONG).show()
                        findViewById<View>(R.id.loading_indicator)?.visibility = View.GONE
                    }
                })
                
                // Prepare and play immediately
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
            locale.getDisplayLanguage(Locale.getDefault()).capitalize(Locale.getDefault())
        } catch (e: Exception) {
            languageCode
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
            val trackGroups = mutableListOf<Tracks.Group>()
            val trackDescriptions = mutableListOf<TrackOption>()
            val trackIndices = mutableListOf<Int>()
            
            // Add "Disabled" option
            trackDescriptions.add(TrackOption("Off", null))
            
            // Find current selected track
            var currentSelectedTrack = -1
            
            // Collect all text tracks
            for (group in tracks.groups) {
                if (group.type == C.TRACK_TYPE_TEXT) {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        
                        // Build a descriptive name for the track
                        val language = format.language ?: "unknown"
                        val languageName = getLanguageDisplayName(language)
                        val label = format.label
                        
                        // Construct track name in format: "Label (Language)" or just "Language" if no label
                        val trackName = when {
                            !label.isNullOrEmpty() && label != languageName -> "$label ($languageName)"
                            else -> languageName
                        }
                        
                        // Check if this track is selected
                        if (group.isTrackSelected(i)) {
                            currentSelectedTrack = trackDescriptions.size
                        }
                        
                        trackGroups.add(group)
                        trackIndices.add(i)
                        trackDescriptions.add(TrackOption(trackName, null))
                    }
                }
            }
            
            // Show bottom sheet if we have subtitle options
            if (trackDescriptions.size > 1 || hasExternalSubtitles) {
                showTrackSelectionBottomSheet(
                    getString(R.string.exo_player_subtitles),
                    trackDescriptions,
                    currentSelectedTrack
                ) { selectedIndex ->
                    if (selectedIndex == 0) {
                        // Disable subtitles
                        trackSelector.setParameters(
                            trackSelector.buildUponParameters()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                                .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                                .build()
                        )
                    } else {
                        // Enable selected subtitle track
                        val selectedGroup = trackGroups[selectedIndex - 1]
                        val selectedTrackIndex = trackIndices[selectedIndex - 1]
                        
                        // Create override for the selected track
                        trackSelector.setParameters(
                            trackSelector.buildUponParameters()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                .setOverrideForType(
                                    TrackSelectionOverride(selectedGroup.mediaTrackGroup, selectedTrackIndex)
                                )
                                .build()
                        )
                    }
                }
            } else {
                Toast.makeText(this, "No subtitles available", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun showAudioTrackOptions() {
        player?.let { exoPlayer ->
            val tracks = exoPlayer.currentTracks
            val trackGroups = mutableListOf<Tracks.Group>()
            val trackDescriptions = mutableListOf<TrackOption>()
            val trackIndices = mutableListOf<Int>()
            
            // Find current selected track
            var currentSelectedTrack = 0
            
            // Collect all audio tracks
            for (group in tracks.groups) {
                if (group.type == C.TRACK_TYPE_AUDIO) {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        
                        // Build a descriptive name for the track
                        val language = format.language ?: "unknown"
                        val languageName = getLanguageDisplayName(language)
                        val label = format.label
                        
                        // Get audio properties
                        val bitrate = format.bitrate
                        val channelCount = format.channelCount
                        
                        // Construct track name with format: "Label (Language) - Quality"
                        val trackName = buildString {
                            // Add label and language
                            if (!label.isNullOrEmpty() && label != languageName) {
                                append(label)
                                append(" ($languageName)")
                            } else {
                                append(languageName)
                            }
                        }
                        
                        // Build quality info
                        val qualityInfo = buildString {
                            // Add channel configuration
                            when (channelCount) {
                                6 -> append("5.1")
                                8 -> append("7.1")
                                2 -> append("Stereo")
                                1 -> append("Mono")
                            }
                            
                            // Add bitrate if available
                            if (bitrate > 0) {
                                if (isNotEmpty()) append(" • ")
                                append("${bitrate / 1000} kbps")
                            }
                        }
                        
                        // Check if this track is selected
                        if (group.isTrackSelected(i)) {
                            currentSelectedTrack = trackDescriptions.size
                        }
                        
                        trackGroups.add(group)
                        trackIndices.add(i)
                        trackDescriptions.add(TrackOption(trackName, qualityInfo))
                    }
                }
            }
            
            // Show bottom sheet if we have audio options
            if (trackDescriptions.isNotEmpty()) {
                showTrackSelectionBottomSheet(
                    getString(R.string.exo_player_audio_track),
                    trackDescriptions,
                    currentSelectedTrack
                ) { selectedIndex ->
                    val selectedGroup = trackGroups[selectedIndex]
                    val selectedTrackIndex = trackIndices[selectedIndex]
                    
                    // Create override for the selected track
                    trackSelector.setParameters(
                        trackSelector.buildUponParameters()
                            .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                            .setOverrideForType(
                                TrackSelectionOverride(selectedGroup.mediaTrackGroup, selectedTrackIndex)
                            )
                            .build()
                    )
                }
            } else {
                Toast.makeText(this, "No audio tracks available", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private data class TrackOption(
        val name: String,
        val info: String?
    )
    
    private fun showTrackSelectionBottomSheet(
        title: String,
        options: List<TrackOption>,
        selectedIndex: Int,
        onOptionSelected: (Int) -> Unit
    ) {
        val bottomSheetView = layoutInflater.inflate(R.layout.track_selection_bottom_sheet, null)
        val bottomSheetDialog = BottomSheetDialog(this, R.style.BottomSheetDialogTheme)
        
        // Set up the title
        bottomSheetView.findViewById<TextView>(R.id.titleText).text = title
        
        // Set up the RecyclerView
        val recyclerView = bottomSheetView.findViewById<RecyclerView>(R.id.recyclerView)
        recyclerView.layoutManager = LinearLayoutManager(this)
        
        // Create and set the adapter
        val adapter = TrackSelectionAdapter(options, selectedIndex) { index ->
            onOptionSelected(index)
            bottomSheetDialog.dismiss()
        }
        recyclerView.adapter = adapter
        
        // Show the bottom sheet
        bottomSheetDialog.setContentView(bottomSheetView)
        
        // Force expand the bottom sheet when shown
        bottomSheetDialog.setOnShowListener { dialog ->
            val d = dialog as BottomSheetDialog
            val bottomSheet = d.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
            bottomSheet?.let {
                val behavior = com.google.android.material.bottomsheet.BottomSheetBehavior.from(it)
                behavior.state = com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_EXPANDED
                behavior.skipCollapsed = true
            }
        }
        
        bottomSheetDialog.show()
    }
    
    private class TrackSelectionAdapter(
        private val options: List<TrackOption>,
        private var selectedIndex: Int,
        private val onItemClick: (Int) -> Unit
    ) : RecyclerView.Adapter<TrackSelectionAdapter.ViewHolder>() {
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.track_selection_item, parent, false)
            return ViewHolder(view)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val option = options[position]
            holder.bind(option, position == selectedIndex)
            holder.itemView.setOnClickListener {
                val previousSelected = selectedIndex
                selectedIndex = position
                notifyItemChanged(previousSelected)
                notifyItemChanged(selectedIndex)
                onItemClick(position)
            }
            holder.itemView.isSelected = position == selectedIndex
        }
        
        override fun getItemCount() = options.size
        
        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            private val radioButton: ImageView = view.findViewById(R.id.radioButton)
            private val trackName: TextView = view.findViewById(R.id.trackName)
            private val trackInfo: TextView = view.findViewById(R.id.trackInfo)
            
            fun bind(option: TrackOption, isSelected: Boolean) {
                itemView.isSelected = isSelected
                radioButton.isSelected = isSelected
                trackName.text = option.name
                trackName.setTextColor(if (isSelected) 0xFF0A84FF.toInt() else 0xFFFFFFFF.toInt())
                
                if (option.info != null) {
                    trackInfo.text = option.info
                    trackInfo.visibility = View.VISIBLE
                } else {
                    trackInfo.visibility = View.GONE
                }
            }
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
        // Reset to default controller behavior
        playerView.controllerHideOnTouch = true
        playerView.controllerShowTimeoutMs = 3000
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

    override fun onDestroy() {
        super.onDestroy()
        // Clear the flag when activity is destroyed
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
} 