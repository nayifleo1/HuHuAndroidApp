import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Dimensions,
  FlatList,
  Platform,
  BackHandler,
  Modal
} from 'react-native';
import { RouteProp, useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import { catalogService, StreamingContent } from '../services/catalogService';
import { stremioService } from '../services/stremioService';
import { tmdbService, TMDBEpisode, TMDBSeason } from '../services/tmdbService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { colors } from '../styles/colors';
import { useSettings } from '../hooks/useSettings';
import { VideoPlayerService } from '../services/videoPlayerService';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  Easing,
  runOnJS,
  cancelAnimation
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler';

interface RouteParams {
  id: string;
  type: string;
}

interface Stream {
  name?: string;
  title?: string;
  url: string;
  addonId?: string;
  addonName?: string;
  behaviorHints?: {
    cached?: boolean;
    [key: string]: any;
  };
  quality?: string;
  type?: string;
  lang?: string;
  headers?: {
    Referer?: string;
    'User-Agent'?: string;
    Origin?: string;
  };
  files?: {
    file: string;
    type: string;
    quality: string;
    lang: string;
  }[];
  subtitles?: {
    url: string;
    lang: string;
  }[];
  addon?: string;
  description?: string;
  infoHash?: string;
  fileIdx?: number;
  size?: number;
  isFree?: boolean;
  isDebrid?: boolean;
}

interface GroupedStreams {
  [addonId: string]: {
    addonName: string;
    streams: Stream[];
  };
}

interface Episode extends TMDBEpisode {
  stremioId?: string;
  episodeString: string;
}

interface GroupedEpisodes {
  [seasonNumber: number]: Episode[];
}

interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  biography?: string;
  birthday?: string;
  place_of_birth?: string;
  known_for_department?: string;
}

// Define the navigation param list type
type RootStackParamList = {
  Player: {
    id: string;
    type: string;
    title?: string;
    poster?: string;
    stream: string;
    headers?: {
      Referer?: string;
      'User-Agent'?: string;
      Origin?: string;
    };
    subtitles?: {
      url: string;
      lang: string;
    }[];
  };
  // ... other screens
};

const MetadataScreen = () => {
  const { settings } = useSettings();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isDarkMode = useColorScheme() === 'dark';
  const { id, type } = route.params;
  
  const [metadata, setMetadata] = useState<StreamingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupedStreams, setGroupedStreams] = useState<GroupedStreams>({});
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showStreamsPage, setShowStreamsPage] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const contentRef = useRef<ScrollView>(null);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  
  // Updated episode state
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [groupedEpisodes, setGroupedEpisodes] = useState<GroupedEpisodes>({});
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [episodeStreams, setEpisodeStreams] = useState<GroupedStreams>({});
  const [loadingEpisodeStreams, setLoadingEpisodeStreams] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  
  // Track loading images - use a ref instead of state to avoid re-renders
  const loadingImages = useRef<Set<string>>(new Set());

  const [lastEpisodesScrollPosition, setLastEpisodesScrollPosition] = useState(0);
  const episodesScrollRef = useRef<ScrollView>(null);

  const [cast, setCast] = useState<Cast[]>([]);
  const [selectedCastMember, setSelectedCastMember] = useState<Cast | null>(null);
  const [loadingCast, setLoadingCast] = useState(false);
  const [loadingCastDetails, setLoadingCastDetails] = useState(false);
  const [modalOffset, setModalOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [availableProviders, setAvailableProviders] = useState<Set<string>>(new Set());
  // Add state for storing scroll position
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  const [isClosing, setIsClosing] = useState(false);
  // Change from position animation to opacity animation
  const fadeAnimation = useSharedValue(0); // 0 = invisible, 1 = visible

  // Unified timing config
  const timingConfig = {
    duration: 300,
    easing: Easing.bezier(0.33, 1, 0.68, 1) // Custom easing for smooth motion
  };

  const restoreScrollPosition = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ y: savedScrollPosition, animated: false });
    }
  }, [savedScrollPosition]);

  const closeWithAnimation = useCallback(() => {
    'worklet';
    setIsClosing(true);
    fadeAnimation.value = withTiming(
      0, // Fade to invisible
      {
        ...timingConfig,
        duration: 250 // Slightly faster for closing
      },
      (finished) => {
        if (finished) {
          runOnJS(setShowStreamsPage)(false);
          runOnJS(setIsClosing)(false);
          runOnJS(setError)(null);
          runOnJS(setSelectedProvider)('all');
          runOnJS(setAvailableProviders)(new Set());
          
          if (type === 'series') {
            runOnJS(setSelectedEpisode)(null);
            runOnJS(setEpisodeStreams)({});
          }
          
          // Use runOnJS to restore scroll position
          runOnJS(restoreScrollPosition)();
        }
      }
    );
  }, [type, restoreScrollPosition]);

  const handleBackFromStreams = useCallback(() => {
    if (!isClosing) {
      closeWithAnimation();
    }
  }, [closeWithAnimation, isClosing]);

  // Update pan gesture to handle opacity change based on horizontal swipe
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      cancelAnimation(fadeAnimation);
    })
    .onUpdate((event) => {
      'worklet';
      if (!isClosing) {
        // Map the horizontal swipe to opacity (0.0-1.0)
        // The further right you swipe, the more transparent it becomes
        const newOpacity = Math.max(0, Math.min(1, 1 - (event.translationX / (width * 0.7))));
        fadeAnimation.value = newOpacity;
      }
    })
    .onEnd((event) => {
      'worklet';
      // Determine if we should dismiss based on velocity or distance
      const shouldDismiss = event.translationX > width * 0.3 || 
                          (event.translationX > 0 && event.velocityX > 500);
      
      if (shouldDismiss) {
        runOnJS(handleBackFromStreams)();
      } else {
        // Restore to full opacity
        fadeAnimation.value = withTiming(1, timingConfig);
      }
    });

  // Update animation style to use opacity
  const streamsAnimatedStyle = useAnimatedStyle(() => {
    const scale = 0.95 + (fadeAnimation.value * 0.05); // Scale from 0.95 to 1.0
    
    return {
      opacity: fadeAnimation.value,
      transform: [
        { scale }
      ],
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: -100,
      backgroundColor: '#000',
      borderRadius: 0,
      overflow: 'hidden',
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 0
      },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
      zIndex: 1000
    };
  }, []);

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 1
    };
  });

  useEffect(() => {
    loadMetadata();
  }, [id, type]);

  // Add back handler for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showStreamsPage) {
          handleBackFromStreams();
          return true; // Prevent default behavior
        }
        return false; // Let default behavior happen (go back)
      });

      return () => backHandler.remove();
    }
  }, [showStreamsPage, lastEpisodesScrollPosition, handleBackFromStreams]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setError(null);
      const content = await catalogService.getContentDetails(type, id);
      if (content) {
        setMetadata(content);
        setInLibrary(content.inLibrary || false);
        
        // Load episodes if this is a series
        if (type === 'series') {
          // First get Stremio metadata
          const metaDetails = await stremioService.getMetaDetails(type, id);
          
          // Try to find TMDB ID from IMDB ID
          const tmdbId = await tmdbService.findTMDBIdByIMDB(id);
          setTmdbId(tmdbId);
          
          if (tmdbId) {
            // Get show details first to get all seasons
            const showDetails = await tmdbService.getTVShowDetails(tmdbId);
            if (showDetails) {
              // Create a map of season numbers to their poster paths
              const seasonPosters = showDetails.seasons
                .filter(season => season.season_number > 0)
                .reduce<{ [key: number]: string | null }>((acc, season) => {
                  acc[season.season_number] = season.poster_path;
                  return acc;
                }, {});

              // Load all seasons in parallel
              const seasonPromises = showDetails.seasons
                .filter(season => season.season_number > 0)
                .map(async (season) => {
                  const seasonDetails = await tmdbService.getSeasonDetails(tmdbId, season.season_number);
                  if (seasonDetails && seasonDetails.episodes) {
                    return {
                      seasonNumber: season.season_number,
                      episodes: seasonDetails.episodes.map(episode => ({
                        ...episode,
                        season_poster_path: seasonPosters[season.season_number],
                        episodeString: `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`,
                        stremioId: `${id}:${episode.season_number}:${episode.episode_number}`
                      }))
                    };
                  }
                  return null;
                });

              const seasonResults = await Promise.all(seasonPromises);
              
              // Group all episodes by season
              const allSeasons = seasonResults.reduce<GroupedEpisodes>((acc, result) => {
                if (result) {
                  acc[result.seasonNumber] = result.episodes;
                }
                return acc;
              }, {});

              setGroupedEpisodes(allSeasons);
              
              // Set initial season episodes
              const firstSeason = Math.min(...Object.keys(allSeasons).map(Number));
              setSelectedSeason(firstSeason);
              setEpisodes(allSeasons[firstSeason] || []);
            }
          } else if (metaDetails && metaDetails.videos) {
            // Fallback to Stremio data if TMDB lookup fails
            const episodeData = metaDetails.videos.map(video => ({
              id: parseInt(video.id.split(':').pop() || '0'),
              name: video.title,
              overview: '',
              episode_number: video.episode || 0,
              season_number: video.season || 0,
              still_path: null,
              air_date: video.released || '',
              vote_average: 0,
              stremioId: video.id,
              episodeString: video.season && video.episode 
                ? `S${video.season.toString().padStart(2, '0')}E${video.episode.toString().padStart(2, '0')}`
                : ''
            }));
            
            // Group episodes by season
            const grouped = episodeData.reduce<GroupedEpisodes>((acc, episode) => {
              const season = episode.season_number;
              if (!acc[season]) {
                acc[season] = [];
              }
              acc[season].push(episode);
              return acc;
            }, {});
            
            setEpisodes(episodeData);
            setGroupedEpisodes(grouped);
            setSelectedSeason(Object.keys(grouped).length > 0 ? parseInt(Object.keys(grouped)[0]) : 1);
          }
        }
        
        // Load streams automatically
        loadStreams();
      } else {
        setError('Content not found');
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  // Modify handleSeasonChange to use preloaded data
  const handleSeasonChange = (seasonNumber: number) => {
    if (selectedSeason === seasonNumber) return;
    
    setSelectedSeason(seasonNumber);
    setEpisodes(groupedEpisodes[seasonNumber] || []);
  };

  const loadStreams = async () => {
    if (loadingStreams) return;
    
    try {
      setLoadingStreams(true);
      
      // Initialize empty grouped streams
      setGroupedStreams({});
      const providers = new Set<string>();

      // Function to update streams for a single source
      const updateStreamsForSource = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        if (newStreams.length > 0) {
          setGroupedStreams(prev => ({
            ...prev,
            [sourceId]: {
              addonName: sourceName,
              streams: newStreams
            }
          }));
          providers.add(sourceId);
          setAvailableProviders(new Set(providers));
        }
      };

      // Start fetching Stremio streams
      stremioService.getStreams(type, id).then(streamResponses => {
        // Group streams by addon
        streamResponses.forEach(response => {
          const addonId = response.addon;
          if (addonId) {
            const streamsWithAddon = response.streams.map(stream => ({
              ...stream,
              name: stream.name || stream.title || 'Unnamed Stream',
              addonId: response.addon,
              addonName: response.addonName
            }));
            updateStreamsForSource(addonId, response.addonName, streamsWithAddon);
          }
        });
      }).catch(error => {
        console.error('Failed to load Stremio streams:', error);
      });

      // Function to fetch external streams
      const fetchExternalStreams = async (url: string, sourceName: string) => {
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.sources && data.sources.length > 0) {
            const source = data.sources[0];
            const streams: Stream[] = source.files.map((file: any) => ({
              name: `${file.quality}`,
              title: `${sourceName} - ${file.quality}`,
              url: file.file,
              quality: file.quality,
              type: file.type,
              lang: file.lang,
              headers: source.headers,
              addonId: 'external_sources',
              addonName: sourceName
            }));
            
            // Add subtitles if available
            if (data.subtitles) {
              streams.forEach(stream => {
                stream.subtitles = data.subtitles;
              });
            }
            
            return streams;
          }
        } catch (error) {
          console.error(`Failed to fetch ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      fetchExternalStreams(`https://nice-month-production.up.railway.app/embedsu/${id}`, 'Source 1')
        .then(streams => {
          if (streams.length > 0) {
            updateStreamsForSource('source_1', 'Source 1', streams);
          }
        });

      fetchExternalStreams(`https://vidsrc-api-js-phz6.onrender.com/embedsu/${id}`, 'Source 2')
        .then(streams => {
          if (streams.length > 0) {
            updateStreamsForSource('source_2', 'Source 2', streams);
          }
        });

    } catch (error) {
      console.error('Failed to load streams:', error);
    } finally {
      setLoadingStreams(false);
    }
  };

  const loadEpisodeStreams = async (episodeId: string) => {
    if (loadingEpisodeStreams) return;
    
    try {
      setLoadingEpisodeStreams(true);
      
      // Initialize empty episode streams
      setEpisodeStreams({});
      const providers = new Set<string>();

      // Function to update streams for a single source
      const updateStreamsForSource = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        if (newStreams.length > 0) {
          setEpisodeStreams(prev => ({
            ...prev,
            [sourceId]: {
              addonName: sourceName,
              streams: newStreams
            }
          }));
          providers.add(sourceId);
          setAvailableProviders(new Set(providers));
        }
      };

      // Start fetching Stremio streams
      stremioService.getStreams('series', episodeId).then(streamResponses => {
        // Group streams by addon
        streamResponses.forEach(response => {
          const addonId = response.addon;
          if (addonId) {
            const streamsWithAddon = response.streams.map(stream => ({
              ...stream,
              name: stream.name || stream.title || 'Unnamed Stream',
              addonId: response.addon,
              addonName: response.addonName
            }));
            updateStreamsForSource(addonId, response.addonName, streamsWithAddon);
          }
        });
      }).catch(error => {
        console.error('Failed to load Stremio streams:', error);
      });

      // Add external streaming sources for episodes
      const episodeInfo = episodeId.split(':');
      const seasonNumber = episodeInfo[1];
      const episodeNumber = episodeInfo[2];
      
      const fetchExternalStreams = async (url: string, sourceName: string) => {
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.sources && data.sources.length > 0) {
            const source = data.sources[0];
            const streams: Stream[] = source.files.map((file: any) => ({
              name: `${file.quality}`,
              title: `${sourceName} - ${file.quality}`,
              url: file.file,
              quality: file.quality,
              type: file.type,
              lang: file.lang,
              headers: source.headers,
              addonId: 'external_sources',
              addonName: sourceName
            }));
            
            // Add subtitles if available
            if (data.subtitles) {
              streams.forEach(stream => {
                stream.subtitles = data.subtitles;
              });
            }
            
            return streams;
          }
        } catch (error) {
          console.error(`Failed to fetch ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      fetchExternalStreams(
        `https://nice-month-production.up.railway.app/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
        'Source 1'
      ).then(streams => {
        if (streams.length > 0) {
          updateStreamsForSource('source_1', 'Source 1', streams);
        }
      });

      fetchExternalStreams(
        `https://vidsrc-api-js-phz6.onrender.com/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
        'Source 2'
      ).then(streams => {
        if (streams.length > 0) {
          updateStreamsForSource('source_2', 'Source 2', streams);
        }
      });

    } catch (error) {
      console.error('Failed to load episode streams:', error);
    } finally {
      setLoadingEpisodeStreams(false);
    }
  };

  // Update handleEpisodeSelect to save scroll position
  const handleEpisodeSelect = (episode: Episode) => {
    const episodeId = episode.stremioId || `${id}:${episode.season_number}:${episode.episode_number}`;
    
    // Save current scroll position before showing streams
    if (contentRef.current) {
      setSavedScrollPosition(lastScrollTop);
    }
    
    setSelectedEpisode(episodeId);
    setShowStreamsPage(true);
    fadeAnimation.value = 0;
    fadeAnimation.value = withTiming(1, timingConfig);
    loadEpisodeStreams(episodeId);
  };

  // Memoize the episode rendering to avoid unnecessary re-renders
  const renderEpisodeCard = useCallback((episode: Episode) => {
    const isSelected = selectedEpisode === (episode.stremioId || `${id}:${episode.season_number}:${episode.episode_number}`);
    
    // Get episode image from TMDB
    let episodeImage = null;
    if (episode.still_path) {
      episodeImage = tmdbService.getImageUrl(episode.still_path, 'original');
    } else if (metadata?.poster) {
      episodeImage = metadata.poster;
    }
    
    // Format the air date
    const formattedAirDate = tmdbService.formatAirDate(episode.air_date);
    
    // Check if this image is loading
    const imageKey = episodeImage || '';
    const isImageLoading = episodeImage ? loadingImages.current.has(imageKey) : false;
    
    // Image loading handlers
    const handleImageLoadStart = () => {
      if (episodeImage) {
        loadingImages.current.add(imageKey);
      }
    };
    
    const handleImageLoadEnd = () => {
      if (episodeImage) {
        loadingImages.current.delete(imageKey);
      }
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.episodeCard,
          isSelected && styles.episodeCardSelected
        ]} 
        onPress={() => handleEpisodeSelect(episode)}
      >
        <View style={styles.episodeImageContainer}>
          {episodeImage ? (
            <>
              <View style={[styles.episodeImage, styles.episodeImagePlaceholder]}>
                <MaterialIcons name="movie" size={24} color="rgba(255,255,255,0.5)" />
              </View>
              {isImageLoading && (
                <View style={[styles.episodeImageLoading, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              <FastImage 
                source={{ uri: episodeImage }}
                style={[styles.episodeImage, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
                resizeMode={FastImage.resizeMode.cover}
                onLoadStart={handleImageLoadStart}
                onLoadEnd={handleImageLoadEnd}
                onError={handleImageLoadEnd}
              />
            </>
          ) : (
            <View style={[styles.episodeImage, styles.episodeImagePlaceholder]}>
              <MaterialIcons name="movie" size={24} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <View style={styles.episodeNumberBadge}>
            <Text style={styles.episodeNumberText}>{episode.episode_number}</Text>
          </View>
        </View>
        
        <View style={styles.episodeInfo}>
          <View style={styles.episodeHeader}>
            <Text style={styles.episodeNumber}>{episode.episodeString}</Text>
            {episode.vote_average > 0 && (
              <View style={styles.episodeRating}>
                <MaterialIcons name="star" size={12} color="#FFD700" />
                <Text style={styles.episodeRatingText}>{episode.vote_average.toFixed(1)}</Text>
              </View>
            )}
          </View>
          
          <Text 
            style={styles.episodeTitle}
            numberOfLines={2}
          >
            {episode.name}
          </Text>
          
          <Text style={styles.episodeReleased}>{formattedAirDate}</Text>
        </View>
        
        <MaterialIcons 
          name="chevron-right" 
          size={24} 
          color={isDarkMode ? "#fff" : "#000"}
          style={styles.episodeExpandIcon}
        />
      </TouchableOpacity>
    );
  }, [metadata, selectedEpisode, isDarkMode, handleEpisodeSelect]);

  const handlePlayStream = async (stream: Stream) => {
    if (settings.useExternalPlayer) {
      try {
        await VideoPlayerService.playVideo(stream.url, {
          useExternalPlayer: true
        });
      } catch (error) {
        console.error('Failed to play in external player:', error);
        // Fallback to internal player
        navigation.navigate('Player', {
          id,
          type,
          title: metadata?.name,
          poster: metadata?.poster,
          stream: stream.url,
          headers: stream.headers,
          subtitles: stream.subtitles
        });
      }
    } else {
      try {
        // Try to use native ExoPlayer
        console.log('Stream data:', JSON.stringify(stream, null, 2));
        
        // Pass all available subtitles and headers to the player
        const options: any = {
          useExternalPlayer: false,
          title: metadata?.name,
          poster: metadata?.poster,
        };
        
        // Add subtitle if available
        if (stream.subtitles && stream.subtitles.length > 0) {
          options.subtitleUrl = stream.subtitles[0].url;
          options.subtitleLanguage = stream.subtitles[0].lang;
          console.log('Using subtitle:', options.subtitleUrl, options.subtitleLanguage);
        }
        
        // Add headers if available
        if (stream.headers) {
          options.headers = stream.headers;
          console.log('Using headers:', JSON.stringify(options.headers, null, 2));
        }
        
        await VideoPlayerService.playVideo(stream.url, options);
      } catch (error) {
        console.error('Failed to play with ExoPlayer:', error);
        // Fallback to React Native Video player
        navigation.navigate('Player', {
          id,
          type,
          title: metadata?.name,
          poster: metadata?.poster,
          stream: stream.url,
          headers: stream.headers,
          subtitles: stream.subtitles
        });
      }
    }
  };

  const toggleLibrary = () => {
    if (!metadata) return;
    
    if (inLibrary) {
      catalogService.removeFromLibrary(type, id);
    } else {
      catalogService.addToLibrary(metadata);
    }
    
    setInLibrary(!inLibrary);
  };

  const renderStreamCard = (stream: Stream) => {
    const quality = stream.title?.match(/(\d+)p/)?.[1] || null;
    const isHDR = stream.title?.toLowerCase().includes('hdr');
    const isDolby = stream.title?.toLowerCase().includes('dolby');
    const size = stream.title?.match(/💾\s*([\d.]+\s*[GM]B)/)?.[1];
    const isTorrent = stream.url?.startsWith('magnet:');
    const isDebrid = stream.behaviorHints?.cached;

    // Use the full stream name for display
    const displayTitle = stream.name || stream.title || 'Unnamed Stream';

    return (
      <TouchableOpacity
        onPress={() => handlePlayStream(stream)}
        style={[
          styles.streamCard,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }
        ]}
      >
        {/* Left side - Stream info */}
        <View style={styles.streamCardLeft}>
          {/* Stream type indicator */}
          <View style={styles.streamTypeContainer}>
            <MaterialIcons 
              name={isTorrent ? 'downloading' : 'play-circle-outline'} 
              size={20} 
              color={isDarkMode ? '#fff' : '#000'} 
            />
            {isDebrid && (
              <MaterialIcons 
                name="cloud-done" 
                size={16} 
                color="#4caf50"
                style={styles.debridIcon}
              />
            )}
          </View>

          {/* Stream content */}
          <View style={styles.streamContent}>
            <Text 
              style={[styles.streamTitle, { color: isDarkMode ? '#fff' : '#000' }]} 
              numberOfLines={2}
            >
              {displayTitle}
            </Text>
            
            {/* Primary tags (Quality, HDR, Dolby) */}
            <View style={styles.primaryTags}>
              {quality && (
                <View style={[styles.qualityTag, { backgroundColor: '#2196f3' }]}>
                  <Text style={styles.tagText}>{quality}p</Text>
                </View>
              )}
              {isHDR && (
                <View style={[styles.qualityTag, { backgroundColor: '#ff9800' }]}>
                  <Text style={styles.tagText}>HDR</Text>
                </View>
              )}
              {isDolby && (
                <View style={[styles.qualityTag, { backgroundColor: '#7b1fa2' }]}>
                  <Text style={styles.tagText}>DOLBY</Text>
                </View>
              )}
              {size && (
                <View style={[styles.qualityTag, { backgroundColor: '#455a64' }]}>
                  <Text style={styles.tagText}>{size}</Text>
                </View>
              )}
            </View>

            {/* Source info */}
            {stream.title && (
              <Text style={styles.sourceText} numberOfLines={1}>
                {stream.title}
              </Text>
            )}
          </View>
        </View>

        {/* Right side - Play button */}
        <View style={styles.streamCardRight}>
          <MaterialIcons 
            name="play-arrow" 
            size={24} 
            color={isDarkMode ? '#fff' : '#000'} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Memoize the season selector to avoid unnecessary re-renders
  const renderSeasonSelector = useCallback(() => {
    if (!tmdbId) return null;
    
    const seasons = Object.keys(groupedEpisodes).map(Number).sort((a, b) => a - b);
    
    return (
      <View style={styles.seasonSelectorWrapper}>
        <Text style={styles.seasonSelectorTitle}>Seasons</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.seasonSelectorContainer}
          contentContainerStyle={styles.seasonSelectorContent}
        >
          {seasons.map(season => {
            // Get season poster from TMDB if available
            const seasonPoster = groupedEpisodes[season]?.[0]?.season_poster_path 
              ? tmdbService.getImageUrl(groupedEpisodes[season][0].season_poster_path, 'w300')
              : metadata?.poster;
            
            return (
              <TouchableOpacity
                key={season}
                style={[
                  styles.seasonButton,
                  selectedSeason === season && styles.selectedSeasonButton
                ]}
                onPress={() => handleSeasonChange(season)}
              >
                <View style={styles.seasonPosterContainer}>
                  {seasonPoster ? (
                    <FastImage
                      source={{ uri: seasonPoster }}
                      style={styles.seasonPoster}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  ) : (
                    <View style={styles.seasonPosterPlaceholder}>
                      <Text style={styles.seasonPosterPlaceholderText}>{season}</Text>
                    </View>
                  )}
                  {selectedSeason === season && (
                    <View style={styles.selectedSeasonIndicator} />
                  )}
                </View>
                <Text 
                  style={[
                    styles.seasonButtonText,
                    selectedSeason === season && styles.selectedSeasonButtonText
                  ]}
                >
                  Season {season}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [tmdbId, groupedEpisodes, metadata, selectedSeason]);

  const renderStreamsHero = () => {
    console.log('Selected Episode ID:', selectedEpisode);
    console.log('Episodes:', episodes);
    
    if (!selectedEpisode) {
      console.log('No selected episode');
      return null;
    }
    
    const episode = episodes.find(ep => 
      ep.stremioId === selectedEpisode || 
      `${id}:${ep.season_number}:${ep.episode_number}` === selectedEpisode
    );
    
    console.log('Found Episode:', episode);
    
    if (!episode) {
      console.log('Episode not found');
      return null;
    }

    let episodeImage = null;
    if (episode.still_path) {
      episodeImage = tmdbService.getImageUrl(episode.still_path, 'original');
    } else if (metadata?.poster) {
      episodeImage = metadata.poster;
    }

    return (
      <View style={styles.streamsHeroContainer}>
        <ImageBackground
          source={episodeImage ? { uri: episodeImage } : undefined}
          style={styles.streamsHeroBackground}
          blurRadius={2}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
            style={styles.streamsHeroGradient}
          >
            <View style={styles.streamsHeroContent}>
              <View style={styles.streamsHeroInfo}>
                <Text style={styles.streamsHeroEpisodeNumber}>{episode.episodeString}</Text>
                <Text style={styles.streamsHeroTitle} numberOfLines={1}>{episode.name}</Text>
                {episode.overview && (
                  <Text style={styles.streamsHeroOverview} numberOfLines={2}>
                    {episode.overview}
                  </Text>
                )}
                <View style={styles.streamsHeroMeta}>
                  <Text style={styles.streamsHeroReleased}>
                    {tmdbService.formatAirDate(episode.air_date)}
                  </Text>
                  {episode.vote_average > 0 && (
                    <View style={styles.streamsHeroRating}>
                      <MaterialIcons name="star" size={16} color="#FFD700" />
                      <Text style={styles.streamsHeroRatingText}>
                        {episode.vote_average.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  };

  const loadCast = async () => {
    try {
      setLoadingCast(true);
      let tmdbId = await tmdbService.findTMDBIdByIMDB(id);
      
      if (tmdbId) {
        const castData = await tmdbService.getCredits(tmdbId, type);
        setCast(castData || []);
      }
    } catch (error) {
      console.error('Failed to load cast:', error);
    } finally {
      setLoadingCast(false);
    }
  };

  const loadCastMemberDetails = async (castId: number) => {
    try {
      setLoadingCastDetails(true);
      const details = await tmdbService.getPersonDetails(castId);
      if (details) {
        setSelectedCastMember(prev => ({
          ...prev!,
          biography: details.biography,
          birthday: details.birthday,
          place_of_birth: details.place_of_birth,
          known_for_department: details.known_for_department
        }));
      }
    } catch (error) {
      console.error('Failed to load cast member details:', error);
    } finally {
      setLoadingCastDetails(false);
    }
  };

  useEffect(() => {
    loadCast();
  }, [id, type]);

  const renderCastSection = useCallback(() => {
    if (loadingCast) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (!cast.length) {
      return null;
    }

    return (
      <View style={styles.castSection}>
        <Text style={styles.sectionTitle}>Cast</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.castScrollContainer}
          contentContainerStyle={styles.castContainer}
          snapToAlignment="start"
        >
          {cast.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={styles.castMember}
              onPress={() => {
                setSelectedCastMember(member);
                loadCastMemberDetails(member.id);
              }}
            >
              <View style={styles.castImageContainer}>
                {member.profile_path && tmdbService.getImageUrl(member.profile_path, 'w185') ? (
                  <FastImage
                    source={{ uri: tmdbService.getImageUrl(member.profile_path, 'w185')! }}
                    style={styles.castImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <MaterialIcons name="person" size={40} color="rgba(255,255,255,0.5)" />
                )}
              </View>
              <Text style={styles.castName} numberOfLines={1}>{member.name}</Text>
              <Text style={styles.castCharacter} numberOfLines={2}>{member.character}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [loadingCast, cast, setSelectedCastMember, loadCastMemberDetails]);

  const renderCastModal = () => {
    if (!selectedCastMember) return null;

    return (
      <Modal
        visible={!!selectedCastMember}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedCastMember(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedCastMember(null)}
          >
            <View 
              style={[
                styles.modalContent,
                {
                  transform: [{ translateY: modalOffset }]
                }
              ]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={() => {
                setIsDragging(true);
              }}
              onResponderMove={(evt) => {
                const { locationY } = evt.nativeEvent;
                const offset = Math.max(0, locationY);
                setModalOffset(offset);
              }}
              onResponderRelease={(evt) => {
                const { locationY } = evt.nativeEvent;
                setIsDragging(false);
                if (locationY > 100) {
                  setSelectedCastMember(null);
                }
                setModalOffset(0);
              }}
            >
              <View style={styles.modalDragHandle} />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedCastMember(null)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalImageContainer}>
                    {selectedCastMember.profile_path && tmdbService.getImageUrl(selectedCastMember.profile_path, 'w300') ? (
                      <FastImage
                        source={{ uri: tmdbService.getImageUrl(selectedCastMember.profile_path, 'w300')! }}
                        style={styles.modalImage}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <View style={[styles.modalImage, styles.castImagePlaceholder]}>
                        <MaterialIcons name="person" size={50} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalName}>{selectedCastMember.name}</Text>
                    <Text style={styles.modalCharacter}>as {selectedCastMember.character}</Text>
                  </View>
                </View>

                {loadingCastDetails ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.modalDetails}>
                    {selectedCastMember.known_for_department && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>Known For</Text>
                        <Text style={styles.modalDetailText}>{selectedCastMember.known_for_department}</Text>
                      </View>
                    )}
                    {selectedCastMember.birthday && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>Birthday</Text>
                        <Text style={styles.modalDetailText}>{tmdbService.formatAirDate(selectedCastMember.birthday)}</Text>
                      </View>
                    )}
                    {selectedCastMember.place_of_birth && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>Place of Birth</Text>
                        <Text style={styles.modalDetailText}>{selectedCastMember.place_of_birth}</Text>
                      </View>
                    )}
                    {selectedCastMember.biography && (
                      <View style={styles.modalBiography}>
                        <Text style={styles.modalDetailLabel}>Biography</Text>
                        <Text style={styles.modalBiographyText}>{selectedCastMember.biography}</Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  const renderStreamFilters = () => {
    return (
      <View style={styles.filterContainer}>
        {/* Provider filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedProvider === 'all' && styles.filterChipSelected
            ]}
            onPress={() => setSelectedProvider('all')}
          >
            <Text style={[
              styles.filterChipText,
              selectedProvider === 'all' && styles.filterChipTextSelected
            ]}>
              All Providers
            </Text>
          </TouchableOpacity>
          {Array.from(availableProviders).map(provider => {
            // Get the addon name from grouped streams
            const addonInfo = (type === 'series' ? episodeStreams : groupedStreams)[provider];
            const displayName = addonInfo?.addonName || 
              (provider === 'source_1' ? 'Source 1' : 
               provider === 'source_2' ? 'Source 2' : 
               provider === 'external_sources' ? 'External Sources' : 
               provider);

            return (
              <TouchableOpacity
                key={provider}
                style={[
                  styles.filterChip,
                  selectedProvider === provider && styles.filterChipSelected
                ]}
                onPress={() => setSelectedProvider(provider)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedProvider === provider && styles.filterChipTextSelected
                ]}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderStreamSkeleton = () => {
    return (
      <View style={styles.streamGroup}>
        <View style={styles.skeletonTitle} />
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={[
            styles.streamCard,
            styles.skeletonCard,
            { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }
          ]}>
            <View style={styles.streamCardLeft}>
              <View style={[styles.skeletonIcon, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.streamContent}>
                <View style={[styles.skeletonText, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', width: '80%' }]} />
                <View style={styles.primaryTags}>
                  <View style={[styles.skeletonTag, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                  <View style={[styles.skeletonTag, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                </View>
                <View style={[styles.skeletonText, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', width: '60%' }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderFilteredStreams = (streams: GroupedStreams) => {
    const filteredEntries = Object.entries(streams).filter(([addonId]) => 
      selectedProvider === 'all' || selectedProvider === addonId
    );

    return filteredEntries.map(([addonId, { addonName, streams }]) => {
      if (streams.length === 0) return null;

      return (
        <View key={addonId} style={styles.streamGroup}>
          <Text style={styles.streamGroupTitle}>{addonName}</Text>
          {streams.map((stream, index) => (
            <View key={index}>
              {renderStreamCard(stream)}
            </View>
          ))}
        </View>
      );
    }).filter(Boolean);
  };

  // Update handleShowStreams to save scroll position
  const handleShowStreams = useCallback(() => {
    // Save current scroll position before showing streams
    if (contentRef.current) {
      setSavedScrollPosition(lastScrollTop);
    }
    
    setShowStreamsPage(true);
    fadeAnimation.value = 0;
    fadeAnimation.value = withTiming(1, timingConfig);
    
    setSelectedProvider('all');
    setAvailableProviders(new Set());
    setError(null);
    
    if (type === 'movie') {
      loadStreams();
    }
  }, [type, lastScrollTop]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !metadata) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={isDarkMode ? '#666' : '#999'} />
          <Text style={[styles.errorText, { color: isDarkMode ? '#fff' : '#000' }]}>
            {error || 'Content not found'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadMetadata}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.infoButtonText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView
          ref={contentRef}
          style={styles.scrollView}
          onScroll={(e) => {
            setLastScrollTop(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
        >
          {/* Hero Section */}
          <ImageBackground
            source={{ uri: metadata.banner || metadata.poster }}
            style={styles.heroSection}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                {metadata.genres && metadata.genres.length > 0 && (
                  <View style={styles.genreContainer}>
                    {metadata.genres.slice(0, 3).map((genre, index) => (
                      <View key={index} style={styles.genreChip}>
                        <Text style={styles.genreText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {metadata.logo ? (
                  <FastImage
                    source={{ uri: metadata.logo }}
                    style={styles.titleLogo}
                    resizeMode={FastImage.resizeMode.contain}
                  />
                ) : (
                  <Text style={styles.titleText}>{metadata.name}</Text>
                )}

                <View style={styles.metaInfo}>
                  {metadata.year && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{metadata.year}</Text>
                    </View>
                  )}
                  {metadata.runtime && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{metadata.runtime}</Text>
                    </View>
                  )}
                  {metadata.imdbRating && (
                    <View style={styles.ratingContainer}>
                      <FastImage 
                        source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/575px-IMDB_Logo_2016.svg.png' }}
                        style={styles.imdbLogo}
                        resizeMode={FastImage.resizeMode.contain}
                      />
                      <Text style={styles.ratingText}>{metadata.imdbRating}</Text>
                    </View>
                  )}
                </View>

                {metadata.description && (
                  <View style={styles.descriptionContainer}>
                    <Text
                      style={styles.description}
                      numberOfLines={showFullDescription ? undefined : 3}
                    >
                      {metadata.description}
                    </Text>
                    {metadata.description.length > 150 && (
                      <TouchableOpacity
                        onPress={() => setShowFullDescription(!showFullDescription)}
                        style={styles.showMoreButton}
                      >
                        <Text style={styles.showMoreText}>
                          {showFullDescription ? 'Show less' : 'Show more'}
                        </Text>
                        <MaterialIcons
                          name={showFullDescription ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                          size={20}
                          color="rgba(255,255,255,0.7)"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.playButton]}
                    onPress={handleShowStreams}
                  >
                    <MaterialIcons name="play-arrow" size={24} color="#000" />
                    <Text style={styles.playButtonText}>Play</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.infoButton]}
                    onPress={toggleLibrary}
                  >
                    <MaterialIcons
                      name={inLibrary ? 'bookmark' : 'bookmark-border'}
                      size={24}
                      color="#fff"
                    />
                    <Text style={styles.infoButtonText}>
                      {inLibrary ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>

          {/* Content based on type */}
          {type === 'series' ? (
            <View style={styles.episodesContainer}>
              {/* Cast section */}
              {renderCastSection()}
              
              <ScrollView
                ref={episodesScrollRef}
                onScroll={(e) => {
                  setLastEpisodesScrollPosition(e.nativeEvent.contentOffset.y);
                }}
                scrollEventThrottle={16}
              >
                {/* Season selector */}
                {Object.keys(groupedEpisodes).length > 1 && renderSeasonSelector()}
                
                {loadingSeasons ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading episodes...</Text>
                  </View>
                ) : episodes.length === 0 ? (
                  <View style={styles.noEpisodes}>
                    <MaterialIcons name="error-outline" size={48} color="#666" />
                    <Text style={styles.noEpisodesText}>No episodes available</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.episodesSectionTitle}>
                      {episodes.length} Episodes
                    </Text>
                    {episodes.map((episode) => (
                      <View key={episode.id}>
                        {renderEpisodeCard(episode)}
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          ) : type === 'movie' ? (
            // Movie content - show streams section
            <View style={styles.streamsContainer}>
              {/* Add cast section for movies */}
              <View style={styles.movieCastSection}>
                {renderCastSection()}
              </View>
              
              {(loadingStreams || Object.keys(groupedStreams).length === 0) && !error ? (
                <ScrollView>
                  {renderStreamFilters()}
                  {[1, 2].map((_, index) => (
                    <View key={index}>
                      {renderStreamSkeleton()}
                    </View>
                  ))}
                </ScrollView>
              ) : error ? (
                <View style={styles.noStreams}>
                  <Text style={styles.noStreamsText}>No streams available</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={loadStreams}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView>
                  {renderStreamFilters()}
                  {renderFilteredStreams(groupedStreams)}
                </ScrollView>
              )}
            </View>
          ) : (
            // Info tab content
            <View style={styles.infoContainer}>
              <View>
                {metadata.description && (
                  <View style={styles.additionalInfo}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.sectionText}>{metadata.description}</Text>
                  </View>
                )}
                {type === 'series' && renderCastSection()}
              </View>
            </View>
          )}
        </ScrollView>

        {showStreamsPage && (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={streamsAnimatedStyle}>
              <TouchableOpacity 
                style={styles.streamsBackButton}
                onPress={handleBackFromStreams}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.streamsBackText}>
                  {type === 'series' ? 'Back to Episodes' : 'Back to Info'}
                </Text>
              </TouchableOpacity>
              
              {type === 'series' ? renderStreamsHero() : null}
              
              <View style={styles.streamsMainContent}>
                {/* Only show cast section for movies */}
                {type === 'movie' && (
                  <View style={styles.movieCastSection}>
                    {renderCastSection()}
                  </View>
                )}
                
                {(loadingEpisodeStreams || loadingStreams || Object.keys(type === 'series' ? episodeStreams : groupedStreams).length === 0) && !error ? (
                  <ScrollView style={styles.streamsContent}>
                    {renderStreamFilters()}
                    {[1, 2].map((_, index) => (
                      <View key={index}>
                        {renderStreamSkeleton()}
                      </View>
                    ))}
                  </ScrollView>
                ) : error ? (
                  <View style={styles.noStreams}>
                    <Text style={styles.noStreamsText}>No streams available</Text>
                    <TouchableOpacity 
                      style={styles.retryButton}
                      onPress={() => type === 'series' ? loadEpisodeStreams(selectedEpisode!) : loadStreams()}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView style={styles.streamsContent}>
                    {renderStreamFilters()}
                    {renderFilteredStreams(type === 'series' ? episodeStreams : groupedStreams)}
                  </ScrollView>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        )}

        {/* Back Button - only show in main view */}
        {!showStreamsPage && lastScrollTop < 50 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {renderCastModal()}
      </GestureHandlerRootView>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  heroSection: {
    width: '100%',
    height: height * 0.75,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroContent: {
    padding: 24,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  titleLogo: {
    width: width * 0.6,
    height: 80,
    marginBottom: 16,
  },
  titleText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  metaChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imdbLogo: {
    width: 40,
    height: 20,
    marginRight: 6,
  },
  ratingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginRight: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 100,
  },
  playButton: {
    backgroundColor: '#fff',
  },
  playButtonText: {
    color: '#000',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  infoButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
  },
  streamsContainer: {
    padding: 16,
  },
  streamsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    marginRight: 16,
  },
  streamsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sourceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  sourceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sourceButtonActive: {
    backgroundColor: '#fff',
  },
  sourceButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  sourceButtonTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  streamGroup: {
    marginBottom: 24,
  },
  streamGroupTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  streamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 80,
  },
  streamCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  streamTypeContainer: {
    marginRight: 12,
    position: 'relative',
  },
  debridIcon: {
    position: 'absolute',
    right: -6,
    bottom: -6,
  },
  streamContent: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  primaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  qualityTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  streamCardRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  loadingStreams: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  noStreams: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noStreamsText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 35 : 45,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodesContainer: {
    flex: 1,
    paddingTop: 16,
  },
  episodesSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  episodeContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  episodeCard: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  episodeCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  episodeImageContainer: {
    position: 'relative',
    width: 160,
    height: 90,
    borderRadius: 4,
    overflow: 'hidden',
  },
  episodeImage: {
    width: 160,
    height: 90,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  episodeImageLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  episodeImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  episodeNumberBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: `${colors.primary}CC`,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  episodeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  episodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  episodeExpandIcon: {
    marginLeft: 8,
  },
  episodeNumber: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginVertical: 4,
  },
  episodeReleased: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  episodeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  episodeRatingText: {
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  streamsContent: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
  },
  streamsBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingTop: Platform.OS === 'android' ? 35 : 45,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  streamsBackText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  streamsMainContent: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? 48 : 56,
  },
  castSection: {
    marginTop: 0,
    paddingLeft: 16,
  },
  castScrollContainer: {
    marginTop: 16,
  },
  castContainer: {
    paddingVertical: 0,
    paddingRight: 16,
    flexDirection: 'row',
  },
  castMember: {
    alignItems: 'center',
    width: 100,
    marginRight: 16,
  },
  castImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  castImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    width: '100%',
    paddingHorizontal: 4,
  },
  castCharacter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    width: '100%',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: '90%',
  },
  modalHeader: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginRight: 16,
  },
  modalImage: {
    width: 120,
    height: 120,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalCharacter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  modalLoading: {
    padding: 24,
    alignItems: 'center',
  },
  modalDetails: {
    padding: 24,
    paddingTop: 0,
  },
  modalDetailRow: {
    marginBottom: 16,
  },
  modalDetailLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  modalDetailText: {
    color: '#fff',
    fontSize: 16,
  },
  modalBiography: {
    marginTop: 8,
  },
  modalBiographyText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  movieCastSection: {
    marginBottom: 24,
    paddingLeft: 0,
  },
  filterContainer: {
    paddingVertical: 16,
    gap: 12,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  sourceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  episodeStreamsContainer: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  episodeStreamGroup: {
    marginBottom: 12,
  },
  episodeStreamAddonName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 8,
  },
  showMoreStreamsButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreStreamsText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  noEpisodes: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noEpisodesText: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },
  infoContainer: {
    padding: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  additionalInfo: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  seasonSelectorWrapper: {
    marginBottom: 16,
  },
  seasonSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  seasonSelectorContainer: {
    marginBottom: 8,
  },
  seasonSelectorContent: {
    paddingHorizontal: 8,
  },
  seasonButton: {
    marginHorizontal: 8,
    alignItems: 'center',
    width: 100,
  },
  seasonPosterContainer: {
    position: 'relative',
    width: 100,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  seasonPoster: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  seasonPosterPlaceholder: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonPosterPlaceholderText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  selectedSeasonIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primary,
  },
  selectedSeasonButton: {
    // No background color needed since we have the indicator
  },
  seasonButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedSeasonButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  episodeOverview: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  streamsHeroContainer: {
    width: '100%',
    height: height * 0.3,
    marginBottom: 24,
    position: 'relative',
  },
  streamsHeroBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  streamsHeroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  streamsHeroContent: {
    width: '100%',
  },
  streamsHeroInfo: {
    width: '100%',
  },
  streamsHeroEpisodeNumber: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streamsHeroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  streamsHeroOverview: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  streamsHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  streamsHeroReleased: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  streamsHeroRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streamsHeroRatingText: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '600',
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonTitle: {
    height: 24,
    width: '40%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  skeletonText: {
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonTag: {
    width: 60,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
  },
});

export default MetadataScreen;