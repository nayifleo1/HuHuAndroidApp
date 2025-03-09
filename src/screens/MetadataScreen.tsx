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
  Modal,
  SectionList
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
  cancelAnimation,
  withSpring,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeInDown,
  SlideInDown
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import { cacheService } from '../services/cacheService';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';

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
  ShowRatings: { showId: number };
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

  // Cast modal animation values
  const castModalVisible = useSharedValue(0);
  const castModalTranslateY = useSharedValue(0);

  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [availableProviders, setAvailableProviders] = useState<Set<string>>(new Set());
  // Add state for storing scroll position
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  const [isClosing, setIsClosing] = useState(false);
  // Change from position animation to opacity animation
  const fadeAnimation = useSharedValue(0); // 0 = invisible, 1 = visible

  // Add state for season change loading
  const [changingSeasons, setChangingSeasons] = useState(false);
  const fadeAnim = useSharedValue(1);

  // Add state to store preloaded streams
  const [preloadedStreams, setPreloadedStreams] = useState<GroupedStreams>({});
  const [preloadedEpisodeStreams, setPreloadedEpisodeStreams] = useState<{ [episodeId: string]: GroupedStreams }>({});

  // Add new animated values
  const screenScale = useSharedValue(0.8);
  const screenOpacity = useSharedValue(0);
  const heroHeight = useSharedValue(height * 0.75);
  const contentTranslateY = useSharedValue(50);

  // Unified animation configs
  const timingConfig = {
    duration: 400,
    easing: Easing.bezier(0.33, 1, 0.68, 1)
  };

  const springConfig = {
    damping: 15,
    mass: 1,
    stiffness: 100
  };

  // Screen entrance animation
  useEffect(() => {
    screenScale.value = withSpring(1, springConfig);
    screenOpacity.value = withSpring(1, springConfig);
    heroHeight.value = withSpring(height * 0.75, springConfig);
    contentTranslateY.value = withSpring(0, springConfig);
  }, []);

  // Animated styles for the main container
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ scale: screenScale.value }],
    opacity: screenOpacity.value
  }));

  // Animated styles for the hero section
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    width: '100%',
    height: heroHeight.value,
    backgroundColor: colors.black
  }));

  // Animated styles for the content
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentTranslateY.value }],
    opacity: interpolate(
      contentTranslateY.value,
      [50, 0],
      [0, 1],
      Extrapolate.CLAMP
    )
  }));

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
        duration: 250, // Slightly faster for closing
        easing: Easing.bezier(0.33, 1, 0.68, 1)
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
    .onBegin((event) => {
      'worklet';
      // Only cancel animation if it's a horizontal swipe
      if (Math.abs(event.velocityX) > Math.abs(event.velocityY)) {
        cancelAnimation(fadeAnimation);
      }
    })
    .onUpdate((event) => {
      'worklet';
      // Only respond to horizontal movement
      if (Math.abs(event.velocityX) > Math.abs(event.velocityY) * 1.5) {
        if (!isClosing) {
          // Map the horizontal swipe to opacity (0.0-1.0)
          // The further right you swipe, the more transparent it becomes
          const newOpacity = Math.max(0, Math.min(1, 1 - (event.translationX / (width * 0.7))));
          fadeAnimation.value = newOpacity;
        }
      }
    })
    .onEnd((event) => {
      'worklet';
      // Only dismiss for horizontal swipes
      if (Math.abs(event.velocityX) > Math.abs(event.velocityY)) {
        // Determine if we should dismiss based on velocity or distance
        const shouldDismiss = event.translationX > width * 0.3 || 
                            (event.translationX > 0 && event.velocityX > 500);
        
        if (shouldDismiss) {
          runOnJS(handleBackFromStreams)();
        } else {
          // Restore to full opacity
          fadeAnimation.value = withTiming(1, timingConfig);
        }
      } else {
        // For vertical swipes, just restore opacity
        fadeAnimation.value = withTiming(1, timingConfig);
      }
    })
    .activeOffsetX([-20, 20]) // Only activate after 20px horizontal movement
    .failOffsetY([-20, 20]);  // Fail if vertical movement exceeds 20px first

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

      // Check metadata screen cache first
      const cachedScreen = cacheService.getMetadataScreen(id, type);
      if (cachedScreen) {
        setMetadata(cachedScreen.metadata);
        setCast(cachedScreen.cast);
        if (type === 'series' && cachedScreen.episodes) {
          setGroupedEpisodes(cachedScreen.episodes.groupedEpisodes);
          setEpisodes(cachedScreen.episodes.currentEpisodes);
          setSelectedSeason(cachedScreen.episodes.selectedSeason);
          setTmdbId(cachedScreen.tmdbId);
        }
        setLoading(false);
        return;
      }

      // Check regular metadata cache
      const cachedMetadata = cacheService.getMetadata(id, type);
      if (cachedMetadata) {
        setMetadata(cachedMetadata);
        
        // If it's a series, load episodes from TMDB in parallel
        if (type === 'series') {
          setLoadingSeasons(true);
          try {
            // Get TMDB ID from IMDB ID and start loading episodes and show details in parallel
            const tmdbIdResult = await tmdbService.findTMDBIdByIMDB(id);
            if (tmdbIdResult) {
              setTmdbId(tmdbIdResult);
              
              // Load episodes and show details in parallel
              const [allEpisodes, showDetails] = await Promise.all([
                tmdbService.getAllEpisodes(tmdbIdResult),
                tmdbService.getTVShowDetails(tmdbIdResult)
              ]);
              
              // Transform TMDBEpisode objects into Episode objects
              const transformedEpisodes: GroupedEpisodes = {};
              Object.entries(allEpisodes).forEach(([season, episodes]) => {
                // Find season poster from show details
                const seasonInfo = showDetails?.seasons?.find(s => s.season_number === parseInt(season));
                const seasonPosterPath = seasonInfo?.poster_path;
                
                transformedEpisodes[parseInt(season)] = episodes.map(episode => ({
                  ...episode,
                  episodeString: `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`,
                  season_poster_path: seasonPosterPath || null
                }));
              });
              
              setGroupedEpisodes(transformedEpisodes);
              
              // Set initial season episodes
              const firstSeason = Math.min(...Object.keys(allEpisodes).map(Number));
              const initialEpisodes = transformedEpisodes[firstSeason] || [];
              setSelectedSeason(firstSeason);
              setEpisodes(initialEpisodes);

              // Cache the screen data
              cacheService.cacheMetadataScreen(id, type, {
                metadata: cachedMetadata,
                cast: cast,
                episodes: {
                  groupedEpisodes: transformedEpisodes,
                  currentEpisodes: initialEpisodes,
                  selectedSeason: firstSeason
                },
                tmdbId: tmdbIdResult
              });
            }
          } catch (error) {
            console.error('Failed to load episodes:', error);
          } finally {
            setLoadingSeasons(false);
          }
        } else {
          // Cache movie screen data
          cacheService.cacheMetadataScreen(id, type, {
            metadata: cachedMetadata,
            cast: cast
          });
        }
        
        setLoading(false);
        return;
      }

      // Load content details and cast in parallel
      const [content] = await Promise.all([
        catalogService.getContentDetails(type, id),
        loadCast() // Load cast in parallel with metadata
      ]);

      if (content) {
        setMetadata(content);
        // Cache the metadata
        cacheService.setMetadata(id, type, content);
        
        // If it's a series, load episodes from TMDB in parallel
        if (type === 'series') {
          setLoadingSeasons(true);
          try {
            // Get TMDB ID from IMDB ID and start loading episodes and show details in parallel
            const tmdbIdResult = await tmdbService.findTMDBIdByIMDB(id);
            if (tmdbIdResult) {
              setTmdbId(tmdbIdResult);
              
              // Load episodes and show details in parallel
              const [allEpisodes, showDetails] = await Promise.all([
                tmdbService.getAllEpisodes(tmdbIdResult),
                tmdbService.getTVShowDetails(tmdbIdResult)
              ]);
              
              // Transform TMDBEpisode objects into Episode objects
              const transformedEpisodes: GroupedEpisodes = {};
              Object.entries(allEpisodes).forEach(([season, episodes]) => {
                // Find season poster from show details
                const seasonInfo = showDetails?.seasons?.find(s => s.season_number === parseInt(season));
                const seasonPosterPath = seasonInfo?.poster_path;
                
                transformedEpisodes[parseInt(season)] = episodes.map(episode => ({
                  ...episode,
                  episodeString: `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`,
                  season_poster_path: seasonPosterPath || null
                }));
              });
              
              setGroupedEpisodes(transformedEpisodes);
              
              // Set initial season episodes
              const firstSeason = Math.min(...Object.keys(allEpisodes).map(Number));
              const initialEpisodes = transformedEpisodes[firstSeason] || [];
              setSelectedSeason(firstSeason);
              setEpisodes(initialEpisodes);

              // Cache the screen data
              cacheService.cacheMetadataScreen(id, type, {
                metadata: content,
                cast: cast,
                episodes: {
                  groupedEpisodes: transformedEpisodes,
                  currentEpisodes: initialEpisodes,
                  selectedSeason: firstSeason
                },
                tmdbId: tmdbIdResult
              });
            }
          } catch (error) {
            console.error('Failed to load episodes:', error);
          } finally {
            setLoadingSeasons(false);
          }
        } else {
          // Cache movie screen data
          cacheService.cacheMetadataScreen(id, type, {
            metadata: content,
            cast: cast
          });
        }
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

  // Preload streams when entering the screen
  useEffect(() => {
    if (type === 'movie') {
      console.log('🔄 Preloading movie streams for:', id);
      preloadMovieStreams();
    }
  }, [id, type]);

  // Preload movie streams
  const preloadMovieStreams = async () => {
    try {
      // Check cache first
      const cachedStreams = cacheService.getStreams(id, type);
      if (cachedStreams && Object.keys(cachedStreams).length > 0) {
        console.log('📦 Using cached streams for preload:', Object.keys(cachedStreams).length, 'providers');
        setPreloadedStreams(cachedStreams);
        return;
      }

      console.log('🔍 Preloading streams from sources...');
      const providers = new Set<string>();
      const tempStreams: GroupedStreams = {};

      // Function to update preloaded streams
      const updatePreloadedStreams = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        if (newStreams.length > 0) {
          console.log(`🔗 Preloaded ${newStreams.length} streams from ${sourceName}`);
          
          // Add to temporary object
          tempStreams[sourceId] = {
            addonName: sourceName,
            streams: newStreams
          };
          
          // Sort by installed addon order
          const installedAddons = stremioService.getInstalledAddons();
          const sortedKeys = Object.keys(tempStreams).sort((a, b) => {
            const indexA = installedAddons.findIndex(addon => addon.id === a);
            const indexB = installedAddons.findIndex(addon => addon.id === b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
          });
          
          // Create a new object with the sorted keys
          const sortedStreams: GroupedStreams = {};
          sortedKeys.forEach(key => {
            sortedStreams[key] = tempStreams[key];
          });
          
          // Update state
          setPreloadedStreams(sortedStreams);
          
          // Cache the streams
          cacheService.setStreams(id, type, sortedStreams);
        }
      };

      // Start fetching Stremio streams
      stremioService.getStreams(type, id).then(streamResponses => {
        console.log('✅ Preloaded Stremio streams:', streamResponses.length, 'addons responded');
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
            updatePreloadedStreams(addonId, response.addonName, streamsWithAddon);
          }
        });
      }).catch(error => {
        console.error('❌ Failed to preload Stremio streams:', error);
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
          console.error(`❌ Failed to preload ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      fetchExternalStreams(`https://nice-month-production.up.railway.app/embedsu/${id}`, 'Source 1')
        .then(streams => {
          if (streams.length > 0) {
            updatePreloadedStreams('source_1', 'Source 1', streams);
          }
        });

      fetchExternalStreams(`https://vidsrc-api-js-phz6.onrender.com/embedsu/${id}`, 'Source 2')
        .then(streams => {
          if (streams.length > 0) {
            updatePreloadedStreams('source_2', 'Source 2', streams);
          }
        });

    } catch (error) {
      console.error('❌ Failed to preload movie streams:', error);
    }
  };

  // Modify loadStreams to use preloaded streams
  const loadStreams = async () => {
    try {
      console.log('🎬 Starting to load movie streams for:', id);
      setLoadingStreams(true);
      setError(null);

      // Use preloaded streams if available
      if (Object.keys(preloadedStreams).length > 0) {
        console.log('🚀 Using preloaded streams:', Object.keys(preloadedStreams).length, 'providers');
        setGroupedStreams(preloadedStreams);
        
        // Set available providers
        const providers = new Set<string>(Object.keys(preloadedStreams));
        setAvailableProviders(providers);
        
        setLoadingStreams(false);
        return;
      }

      // Check cache as fallback
      const cachedStreams = cacheService.getStreams(id, type);
      if (cachedStreams && Object.keys(cachedStreams).length > 0) {
        console.log('📦 Found cached streams:', Object.keys(cachedStreams).length, 'providers');
        setGroupedStreams(cachedStreams);
        setLoadingStreams(false);
        return;
      }

      // If no preloaded streams, continue with normal loading
      // Initialize empty grouped streams
      setGroupedStreams({});
      const providers = new Set<string>();

      // Function to update streams for a single source
      const updateStreamsForSource = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        console.log(`🔗 Received streams from ${sourceName}:`, newStreams.length, 'streams');
        if (newStreams.length > 0) {
          setGroupedStreams(prev => {
            // Create a new object with the same properties as prev
            const updatedStreams = { ...prev };
            
            // Add the new source
            updatedStreams[sourceId] = {
              addonName: sourceName,
              streams: newStreams
            };
            
            // Sort the keys based on installed addon order
            const installedAddons = stremioService.getInstalledAddons();
            const sortedKeys = Object.keys(updatedStreams).sort((a, b) => {
              const indexA = installedAddons.findIndex(addon => addon.id === a);
              const indexB = installedAddons.findIndex(addon => addon.id === b);
              
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return 0;
            });
            
            // Create a new object with the sorted keys
            const sortedStreams: GroupedStreams = {};
            sortedKeys.forEach(key => {
              sortedStreams[key] = updatedStreams[key];
            });
            
            console.log('📊 Updated streams state:', Object.keys(sortedStreams).length, 'providers');
            
            // Also update preloaded streams for future use
            setPreloadedStreams(sortedStreams);
            
            return sortedStreams;
          });
          
          providers.add(sourceId);
          setAvailableProviders(new Set(providers));
          // Set loading to false as soon as we have any streams
          setLoadingStreams(false);
        } else {
          console.log(`⚠️ No streams received from ${sourceName}`);
        }
      };

      // Start fetching Stremio streams
      console.log('🔍 Fetching Stremio streams...');
      stremioService.getStreams(type, id).then(streamResponses => {
        console.log('✅ Stremio streams response received:', streamResponses.length, 'addons responded');
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
        console.error('❌ Failed to load Stremio streams:', error);
      });

      // Function to fetch external streams
      const fetchExternalStreams = async (url: string, sourceName: string) => {
        console.log(`🌐 Fetching external streams from ${sourceName}...`);
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.sources && data.sources.length > 0) {
            console.log(`✅ Received external streams from ${sourceName}`);
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
          console.error(`❌ Failed to fetch ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      fetchExternalStreams(`https://nice-month-production.up.railway.app/embedsu/${id}`, 'Source 1')
        .then(streams => {
          if (streams.length > 0) {
            updateStreamsForSource('source_1', 'Source 1', streams);
          } else {
            console.log('⚠️ No streams received from Source 1');
          }
        });

      fetchExternalStreams(`https://vidsrc-api-js-phz6.onrender.com/embedsu/${id}`, 'Source 2')
        .then(streams => {
          if (streams.length > 0) {
            updateStreamsForSource('source_2', 'Source 2', streams);
          } else {
            console.log('⚠️ No streams received from Source 2');
          }
        });

      // Cache the streams after a delay to ensure we have most sources
      setTimeout(() => {
        console.log('💾 Caching movie streams...');
        cacheService.setStreams(id, type, groupedStreams);
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to load movie streams:', error);
      setError('Failed to load streams');
    } finally {
      // Set loading to false after 10 seconds if no streams are found
      setTimeout(() => {
        if (loadingStreams) {
          console.log('⚠️ Timeout: Setting loading to false after 10s');
          setLoadingStreams(false);
        }
      }, 10000);
    }
  };

  const loadEpisodeStreams = async (episodeId: string) => {
    try {
      console.log('🎬 Starting to load episode streams for:', episodeId);
      setLoadingEpisodeStreams(true);
      setError(null);

      // Initialize empty episode streams
      setEpisodeStreams({});
      const providers = new Set<string>();

      // Use preloaded streams if available to show something immediately
      if (preloadedEpisodeStreams[episodeId] && Object.keys(preloadedEpisodeStreams[episodeId]).length > 0) {
        console.log('🚀 Using preloaded episode streams:', Object.keys(preloadedEpisodeStreams[episodeId]).length, 'providers');
        setEpisodeStreams(preloadedEpisodeStreams[episodeId]);
        
        // Set available providers
        Object.keys(preloadedEpisodeStreams[episodeId]).forEach(provider => providers.add(provider));
        setAvailableProviders(new Set(providers));
        
        // Don't set loading to false yet, continue loading fresh streams
      } else {
        // Check cache as fallback
        const cachedStreams = cacheService.getEpisodeStreams(id, type, episodeId);
        if (cachedStreams && Object.keys(cachedStreams).length > 0) {
          console.log('📦 Found cached streams:', Object.keys(cachedStreams).length, 'providers');
          setEpisodeStreams(cachedStreams);
          
          // Set available providers
          Object.keys(cachedStreams).forEach(provider => providers.add(provider));
          setAvailableProviders(new Set(providers));
          
          // Don't set loading to false yet, continue loading fresh streams
        }
      }

      // Function to update streams for a single source
      const updateStreamsForSource = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        console.log(`🔗 Received streams from ${sourceName}:`, newStreams.length, 'streams');
        if (newStreams.length > 0) {
          setEpisodeStreams(prev => {
            // Create a new object with the same properties as prev
            const updatedStreams = { ...prev };
            
            // Add the new source
            updatedStreams[sourceId] = {
              addonName: sourceName,
              streams: newStreams
            };
            
            // Sort the keys based on installed addon order
            const installedAddons = stremioService.getInstalledAddons();
            const sortedKeys = Object.keys(updatedStreams).sort((a, b) => {
              const indexA = installedAddons.findIndex(addon => addon.id === a);
              const indexB = installedAddons.findIndex(addon => addon.id === b);
              
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return 0;
            });
            
            // Create a new object with the sorted keys
            const sortedStreams: GroupedStreams = {};
            sortedKeys.forEach(key => {
              sortedStreams[key] = updatedStreams[key];
            });
            
            console.log('📊 Updated streams state:', Object.keys(sortedStreams).length, 'providers');
            
            // Also update preloaded streams for future use
            setPreloadedEpisodeStreams(prevPreloaded => ({
              ...prevPreloaded,
              [episodeId]: sortedStreams
            }));
            
            return sortedStreams;
          });
          
          providers.add(sourceId);
          setAvailableProviders(new Set(providers));
          // Set loading to false as soon as we have any streams
          setLoadingEpisodeStreams(false);
        } else {
          console.log(`⚠️ No streams received from ${sourceName}`);
        }
      };

      // Always fetch fresh Stremio streams regardless of cache
      console.log('🔍 Fetching fresh Stremio streams for episode:', episodeId);
      stremioService.getStreams('series', episodeId).then(streamResponses => {
        console.log('✅ Stremio streams response received:', streamResponses.length, 'addons responded');
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
        console.error('❌ Failed to load Stremio streams:', error);
      });

      // Add external streaming sources for episodes
      const episodeInfo = episodeId.split(':');
      const seasonNumber = episodeInfo[1];
      const episodeNumber = episodeInfo[2];
      
      const fetchExternalStreams = async (url: string, sourceName: string) => {
        console.log(`🌐 Fetching external streams from ${sourceName}...`);
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.sources && data.sources.length > 0) {
            console.log(`✅ Received external streams from ${sourceName}`);
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
            
            updateStreamsForSource('source_' + (sourceName === 'Source 1' ? '1' : '2'), sourceName, streams);
            return streams;
          }
        } catch (error) {
          console.error(`❌ Failed to load ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      Promise.all([
        fetchExternalStreams(
          `https://nice-month-production.up.railway.app/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
          'Source 1'
        ),
        fetchExternalStreams(
          `https://vidsrc-api-js-phz6.onrender.com/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
          'Source 2'
        )
      ]).catch(error => {
        console.error('❌ Failed to load external sources:', error);
      });

      // Cache the streams after a delay to ensure we have most sources
      setTimeout(() => {
        console.log('💾 Caching episode streams...');
        cacheService.setEpisodeStreams(id, type, episodeId, episodeStreams);
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to load episode streams:', error);
      setError('Failed to load streams');
    } finally {
      // Set loading to false after 10 seconds if no streams are found
      setTimeout(() => {
        if (loadingEpisodeStreams) {
          console.log('⚠️ Timeout: Setting loading to false after 10s');
          setLoadingEpisodeStreams(false);
        }
      }, 10000);
    }
  };

  // Update handleSeasonChange
  const handleSeasonChange = useCallback((seasonNumber: number) => {
    if (selectedSeason === seasonNumber) return;
    
    setChangingSeasons(true);
    
    // Use requestAnimationFrame to batch the updates
    requestAnimationFrame(() => {
      // Update metadata first
      setSelectedSeason(seasonNumber);
      // Use a memoized episodes array
      setEpisodes(groupedEpisodes[seasonNumber] || []);
      
      // Optimize animation
      fadeAnim.value = withTiming(0, { 
        duration: 150,
        easing: Easing.out(Easing.ease)
      }, () => {
        fadeAnim.value = withTiming(1, { 
          duration: 200,
          easing: Easing.in(Easing.ease)
        }, () => {
          runOnJS(setChangingSeasons)(false);
        });
      });
    });
  }, [selectedSeason, groupedEpisodes, fadeAnim]);

  // Modify handleEpisodeSelect to always load fresh streams
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
    
    // Start preloading episode streams in the background
    if (!preloadedEpisodeStreams[episodeId]) {
      console.log('🔄 Preloading episode streams for:', episodeId);
      preloadEpisodeStreams(episodeId);
    } else {
      console.log('🚀 Using preloaded episode streams for:', episodeId);
    }
    
    // Always load fresh streams
    loadEpisodeStreams(episodeId);
  };

  // Create the animated style outside the render function
  const episodeCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [{ scale: 0.95 + (fadeAnim.value * 0.05) }]
    };
  }, []);

  // Optimize episode rendering with memo
  const renderEpisodeCard = useCallback((episode: Episode) => {
    const isSelected = selectedEpisode === (episode.stremioId || `${id}:${episode.season_number}:${episode.episode_number}`);
    
    // Get episode image from TMDB
    let episodeImage = null;
    if (episode.still_path) {
      episodeImage = tmdbService.getImageUrl(episode.still_path, 'w300');
    } else if (metadata?.poster) {
      episodeImage = metadata.poster;
    }
    
    return (
      <Animated.View style={[styles.episodeContainer, episodeCardAnimatedStyle]}>
        <TouchableOpacity
          onPress={() => handleEpisodeSelect(episode)}
          style={[
            styles.episodeCard,
            isSelected && styles.episodeCardSelected
          ]}
        >
          <View style={styles.episodeImageContainer}>
            {episodeImage ? (
              <FastImage
                source={{
                  uri: episodeImage,
                  priority: FastImage.priority.normal,
                  cache: FastImage.cacheControl.immutable
                }}
                style={styles.episodeImage}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={[styles.episodeImage, styles.episodeImagePlaceholder]}>
                <MaterialIcons name="image" size={24} color="#666" />
              </View>
            )}
            <View style={styles.episodeNumberBadge}>
              <Text style={styles.episodeNumberText}>{episode.episode_number}</Text>
            </View>
          </View>

          <View style={styles.episodeInfo}>
            <View style={styles.episodeHeader}>
              <Text style={styles.episodeNumber}>{episode.episodeString}</Text>
            </View>
            <Text style={styles.episodeTitle} numberOfLines={2}>
              {episode.name}
            </Text>
            {episode.air_date && (
              <Text style={styles.episodeReleased}>
                {new Date(episode.air_date).toLocaleDateString()}
              </Text>
            )}
            {episode.vote_average > 0 && (
              <View style={styles.episodeRating}>
                <MaterialIcons name="star" size={12} color="#FFD700" />
                <Text style={styles.episodeRatingText}>
                  {episode.vote_average.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [selectedEpisode, metadata?.poster, handleEpisodeSelect, episodeCardAnimatedStyle]);

  // Update episodes section rendering with FlatList for better performance
  const renderEpisodesSection = useCallback(() => {
    if (loadingSeasons) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading episodes...</Text>
        </View>
      );
    }

    if (episodes.length === 0) {
      return (
        <View style={styles.noEpisodes}>
          <MaterialIcons name="error-outline" size={48} color="#666" />
          <Text style={styles.noEpisodesText}>No episodes available</Text>
        </View>
      );
    }

    return (
      <>
        <Text style={styles.episodesSectionTitle}>
          {episodes.length} Episodes
        </Text>
        <FlatList
          data={episodes}
          renderItem={({ item }) => renderEpisodeCard(item)}
          keyExtractor={(item) => item.id.toString()}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.episodesList}
        />
      </>
    );
  }, [episodes, loadingSeasons, renderEpisodeCard]);

  const handlePlayStream = async (stream: Stream) => {
    // Get the current episode information if we're playing a series
    const currentEpisode = selectedEpisode ? episodes.find(ep => 
      ep.stremioId === selectedEpisode || 
      `${id}:${ep.season_number}:${ep.episode_number}` === selectedEpisode
    ) : null;

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
          releaseDate: type === 'movie' ? metadata?.year?.toString() : undefined
        };

        // Add episode information if available
        if (currentEpisode) {
          options.episodeTitle = currentEpisode.name;
          options.episodeNumber = currentEpisode.episodeString;
        }
        
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
          { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.03)' }
        ]}
      >
        {/* Left side - Stream info */}
        <View style={styles.streamCardLeft}>
          {/* Stream type indicator */}
          <View style={styles.streamTypeContainer}>
            <MaterialIcons 
              name={isTorrent ? 'downloading' : 'play-circle-outline'} 
              size={20} 
              color={isDarkMode ? colors.text : colors.black} 
            />
            {isDebrid && (
              <MaterialIcons 
                name="cloud-done" 
                size={16} 
                color={colors.success}
                style={styles.debridIcon}
              />
            )}
          </View>

          {/* Stream content */}
          <View style={styles.streamContent}>
            <Text 
              style={[styles.streamTitle, { color: isDarkMode ? colors.text : colors.black }]} 
              numberOfLines={2}
            >
              {displayTitle}
            </Text>
            
            {/* Primary tags (Quality, HDR, Dolby) */}
            <View style={styles.primaryTags}>
              {quality && (
                <View style={[styles.qualityTag, { backgroundColor: colors.info }]}>
                  <Text style={styles.tagText}>{quality}p</Text>
                </View>
              )}
              {isHDR && (
                <View style={[styles.qualityTag, { backgroundColor: colors.warning }]}>
                  <Text style={styles.tagText}>HDR</Text>
                </View>
              )}
              {isDolby && (
                <View style={[styles.qualityTag, { backgroundColor: colors.accentDark }]}>
                  <Text style={styles.tagText}>DOLBY</Text>
                </View>
              )}
              {size && (
                <View style={[styles.qualityTag, { backgroundColor: colors.darkGray }]}>
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
            color={isDarkMode ? colors.text : colors.black} 
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
            colors={[
              `${colors.darkBackground}00`, // fully transparent
              `${colors.darkBackground}15`, // 8% opacity
              `${colors.darkBackground}40`, // 25% opacity
              `${colors.darkBackground}B3`, // 70% opacity
              `${colors.darkBackground}E6`, // 90% opacity
              colors.darkBackground      // solid background color
            ]}
            locations={[0, 0.4, 0.6, 0.8, 0.9, 1]}
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

      // Check cache first
      const cachedCast = cacheService.getCast(id, type);
      if (cachedCast) {
        setCast(cachedCast);
        setLoadingCast(false);
        return;
      }

      const tmdbId = await tmdbService.findTMDBIdByIMDB(id);
      
      if (tmdbId) {
        // Load cast data and any other necessary data in parallel
        const castData = await tmdbService.getCredits(tmdbId, type);
        if (castData) {
          setCast(castData);
          // Cache the cast data
          cacheService.setCast(id, type, castData);
        }
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
                    source={{ 
                      uri: tmdbService.getImageUrl(member.profile_path, 'w185')!,
                      priority: FastImage.priority.normal,
                      cache: FastImage.cacheControl.immutable
                    }}
                    style={styles.castImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <MaterialIcons 
                    name="person" 
                    size={40} 
                    color={colors.textMuted} 
                  />
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

  // Background opacity style
  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: castModalVisible.value,
    };
  }, []);

  // Modal content style
  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: castModalTranslateY.value }
      ],
    };
  }, []);

  // Cast modal pan gesture
  const castPanGesture = useMemo(() => 
    Gesture.Pan()
      .onBegin(() => {
        'worklet';
        cancelAnimation(castModalTranslateY);
      })
      .onUpdate((event) => {
        'worklet';
        // Only allow downward dragging
        if (event.translationY > 0) {
          castModalTranslateY.value = event.translationY;
        }
      })
      .onEnd((event) => {
        'worklet';
        // Determine if we should dismiss based on velocity or distance
        const shouldDismiss = event.translationY > 150 || 
                            (event.translationY > 0 && event.velocityY > 500);
        
        if (shouldDismiss) {
          // Animate out and close modal
          castModalTranslateY.value = withTiming(500, timingConfig, () => {
            'worklet';
            castModalVisible.value = withTiming(0, {
              duration: 150,
              easing: Easing.out(Easing.ease)
            }, () => {
              runOnJS(setSelectedCastMember)(null);
              castModalTranslateY.value = 0;
            });
          });
        } else {
          // Return to original position
          castModalTranslateY.value = withTiming(0, timingConfig);
        }
      }),
    [timingConfig]
  );

  // Handle cast modal visibility
  useEffect(() => {
    if (selectedCastMember) {
      castModalVisible.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.ease)
      });
      castModalTranslateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.back(1.5))
      });
    }
  }, [selectedCastMember]);

  const handleCloseCastModal = useCallback(() => {
    castModalVisible.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease)
    }, () => {
      runOnJS(setSelectedCastMember)(null);
    });
  }, []);

  const renderCastModal = useCallback(() => {
    if (!selectedCastMember) return null;

    return (
      <View style={styles.modalContainer}>
        <Animated.View 
          style={[styles.modalOverlay, backgroundAnimatedStyle]}
        >
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={handleCloseCastModal}
          />
          <GestureDetector gesture={castPanGesture}>
            <Animated.View 
              style={[
                styles.modalContent,
                modalAnimatedStyle
              ]}
            >
              <View style={styles.modalDragHandle} />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseCastModal}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalImageContainer}>
                    {selectedCastMember.profile_path && tmdbService.getImageUrl(selectedCastMember.profile_path, 'w300') ? (
                      <FastImage
                        source={{ 
                          uri: tmdbService.getImageUrl(selectedCastMember.profile_path, 'w300')!,
                          priority: FastImage.priority.normal,
                          cache: FastImage.cacheControl.immutable
                        }}
                        style={styles.modalImage}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <View style={[styles.modalImage, styles.castImagePlaceholder]}>
                        <MaterialIcons 
                          name="person" 
                          size={50} 
                          color={colors.textMuted} 
                        />
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
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </View>
    );
  }, [selectedCastMember, loadingCastDetails, backgroundAnimatedStyle, modalAnimatedStyle, castPanGesture, handleCloseCastModal]);

  const renderStreamFilters = useCallback(() => {
    // Create an array of filter items
    const filterItems = [
      { id: 'all', name: 'All Providers' },
      ...Array.from(availableProviders).sort((a, b) => {
        const installedAddons = stremioService.getInstalledAddons();
        const indexA = installedAddons.findIndex(addon => addon.id === a);
        const indexB = installedAddons.findIndex(addon => addon.id === b);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      }).map(provider => {
        const addonInfo = (type === 'series' ? episodeStreams : groupedStreams)[provider];
        const displayName = addonInfo?.addonName || 
          (provider === 'source_1' ? 'Source 1' : 
           provider === 'source_2' ? 'Source 2' : 
           provider === 'external_sources' ? 'External Sources' : 
           provider);
        
        return { id: provider, name: displayName };
      })
    ];

    const renderFilterItem = ({ item }: { item: { id: string, name: string } }) => (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.filterChip,
          selectedProvider === item.id && styles.filterChipSelected
        ]}
        onPress={() => {
          if (selectedProvider !== item.id) {
            setSelectedProvider(item.id);
          }
        }}
      >
        <Text style={[
          styles.filterChipText,
          selectedProvider === item.id && styles.filterChipTextSelected
        ]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.filterContainer}>
        <FlatList
          data={filterItems}
          renderItem={renderFilterItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          bounces={true}
          overScrollMode="never"
          decelerationRate="fast"
        />
      </View>
    );
  }, [selectedProvider, availableProviders, type, episodeStreams, groupedStreams]);

  const renderStreamSkeleton = () => {
    return (
      <View style={styles.streamGroup}>
        <View style={styles.skeletonTitle} />
        {[1, 2, 3].map((_, index) => (
          <View 
            key={index}
            style={[
              styles.streamCard, 
              styles.skeletonCard, 
              { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.03)' }
            ]}
          >
            <View style={styles.streamCardLeft}>
              <View style={[styles.skeletonIcon, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.streamContent}>
                <View style={[styles.skeletonText, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)', width: '80%' }]} />
                <View style={styles.primaryTags}>
                  <View style={[styles.skeletonTag, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)' }]} />
                  <View style={[styles.skeletonTag, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)' }]} />
                </View>
                <View style={[styles.skeletonText, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)', width: '60%' }]} />
              </View>
            </View>
            <View style={styles.streamCardRight}>
              <View style={[styles.skeletonIcon, { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.1)' }]} />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderFilteredStreams = useCallback((streams: GroupedStreams) => {
    console.log('🎯 Rendering streams:', Object.keys(streams).length, 'providers');
    
    // Transform streams data into sections for SectionList
    const sections = Object.entries(streams)
      .filter(([addonId]) => selectedProvider === 'all' || selectedProvider === addonId)
      .sort(([addonIdA], [addonIdB]) => {
        const installedAddons = stremioService.getInstalledAddons();
        const indexA = installedAddons.findIndex(addon => addon.id === addonIdA);
        const indexB = installedAddons.findIndex(addon => addon.id === addonIdB);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      })
      .map(([addonId, { addonName, streams }]) => ({
        title: addonName,
        addonId,
        data: streams
      }));

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        renderItem={({ item }) => renderStreamCard(item)}
        renderSectionHeader={({ section }) => (
          <Text style={styles.streamGroupTitle}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews={true}
        contentContainerStyle={styles.streamsContainer}
        style={styles.streamsContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        getItemLayout={(data, index) => ({
          length: 100, // Approximate height of a stream card
          offset: 100 * index + (Math.floor(index / 3) * 40), // Add header height every 3 items
          index,
        })}
      />
    );
  }, [selectedProvider, renderStreamCard]);

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

  // Preload episode streams function - optimized to not block rendering
  const preloadEpisodeStreams = async (episodeId: string) => {
    try {
      // Check cache first but don't return early
      const cachedStreams = cacheService.getEpisodeStreams(id, type, episodeId);
      if (cachedStreams && Object.keys(cachedStreams).length > 0) {
        console.log('📦 Using cached episode streams for preload:', Object.keys(cachedStreams).length, 'providers');
        // Update state but continue loading in the background
        setPreloadedEpisodeStreams(prev => ({
          ...prev,
          [episodeId]: cachedStreams
        }));
      }

      // Always fetch fresh streams in the background
      console.log('🔍 Preloading episode streams from sources...');
      const tempStreams: GroupedStreams = {};

      // Function to update preloaded streams
      const updatePreloadedStreams = (sourceId: string, sourceName: string, newStreams: Stream[]) => {
        if (newStreams.length > 0) {
          console.log(`🔗 Preloaded ${newStreams.length} episode streams from ${sourceName}`);
          
          // Add to temporary object
          tempStreams[sourceId] = {
            addonName: sourceName,
            streams: newStreams
          };
          
          // Sort by installed addon order
          const installedAddons = stremioService.getInstalledAddons();
          const sortedKeys = Object.keys(tempStreams).sort((a, b) => {
            const indexA = installedAddons.findIndex(addon => addon.id === a);
            const indexB = installedAddons.findIndex(addon => addon.id === b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
          });
          
          // Create a new object with the sorted keys
          const sortedStreams: GroupedStreams = {};
          sortedKeys.forEach(key => {
            sortedStreams[key] = tempStreams[key];
          });
          
          // Update state
          setPreloadedEpisodeStreams(prev => ({
            ...prev,
            [episodeId]: sortedStreams
          }));
          
          // Cache the streams
          cacheService.setEpisodeStreams(id, type, episodeId, sortedStreams);
        }
      };

      // Start fetching Stremio streams in the background
      stremioService.getStreams('series', episodeId).then(streamResponses => {
        // Process in the background without blocking
        setTimeout(() => {
          console.log('✅ Processing preloaded Stremio streams:', streamResponses.length, 'addons responded');
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
              updatePreloadedStreams(addonId, response.addonName, streamsWithAddon);
            }
          });
        }, 0);
      }).catch(error => {
        console.error('❌ Failed to preload Stremio streams:', error);
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
            
            updatePreloadedStreams('source_' + (sourceName === 'Source 1' ? '1' : '2'), sourceName, streams);
            return streams;
          }
        } catch (error) {
          console.error(`❌ Failed to preload ${sourceName}:`, error);
        }
        return [];
      };

      // Fetch external sources independently
      Promise.all([
        fetchExternalStreams(
          `https://nice-month-production.up.railway.app/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
          'Source 1'
        ),
        fetchExternalStreams(
          `https://vidsrc-api-js-phz6.onrender.com/embedsu/${tmdbId}?s=${seasonNumber}&e=${episodeNumber}`,
          'Source 2'
        )
      ]).catch(error => {
        console.error('❌ Failed to preload external sources:', error);
      });

    } catch (error) {
      console.error('❌ Failed to preload episode streams:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.darkBackground : colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !metadata) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.darkBackground : colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={isDarkMode ? colors.textMuted : colors.mediumGray} />
          <Text style={[styles.errorText, { color: isDarkMode ? colors.text : colors.black }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.darkBackground : colors.white }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={containerAnimatedStyle}>
          <ScrollView
            ref={contentRef}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              setLastScrollTop(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
          >
            {/* Hero Section */}
            <Animated.View style={heroAnimatedStyle}>
              <ImageBackground
                source={{ uri: metadata.banner || metadata.poster }}
                style={styles.heroSection}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={[
                    `${colors.darkBackground}00`, // fully transparent
                    `${colors.darkBackground}15`, // 8% opacity
                    `${colors.darkBackground}40`, // 25% opacity
                    `${colors.darkBackground}B3`, // 70% opacity
                    `${colors.darkBackground}E6`, // 90% opacity
                    colors.darkBackground      // solid background color
                  ]}
                  locations={[0, 0.4, 0.6, 0.8, 0.9, 1]}
                  style={styles.heroGradient}
                >
                  <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.heroContent}>
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
                        source={{ 
                          uri: metadata.logo,
                          priority: FastImage.priority.normal,
                          cache: FastImage.cacheControl.immutable
                        }}
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

                      {type === 'series' && tmdbId && (
                        <TouchableOpacity
                          style={[styles.iconButton]}
                          onPress={() => navigation.navigate('ShowRatings', { showId: tmdbId })}
                        >
                          <MaterialIcons name="analytics" size={24} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Animated.View>
                </LinearGradient>
              </ImageBackground>
            </Animated.View>

            {/* Main Content */}
            <Animated.View style={contentAnimatedStyle}>
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
                // Movie content - show info and cast section
                <View style={styles.movieInfoContainer}>
                  {/* Add cast section for movies */}
                  <View style={styles.movieCastSection}>
                    {renderCastSection()}
                  </View>
                  
                  {/* Movie info section */}
                  <View style={styles.additionalInfo}>
                    {/* Remove the duplicate description section since it's already in the hero section */}
                    
                    {/* Additional metadata if available */}
                    {(metadata as any).director && (
                      <View style={styles.metadataRow}>
                        <Text style={styles.metadataLabel}>Director:</Text>
                        <Text style={styles.metadataValue}>{(metadata as any).director}</Text>
                      </View>
                    )}
                    
                    {(metadata as any).writer && (
                      <View style={styles.metadataRow}>
                        <Text style={styles.metadataLabel}>Writer:</Text>
                        <Text style={styles.metadataValue}>{(metadata as any).writer}</Text>
                      </View>
                    )}
                    
                    {(metadata as any).cast?.length > 0 && (
                      <View style={styles.metadataRow}>
                        <Text style={styles.metadataLabel}>Cast:</Text>
                        <Text style={styles.metadataValue}>{(metadata as any).cast.slice(0, 5).join(', ')}</Text>
                      </View>
                    )}
                  </View>
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
            </Animated.View>
          </ScrollView>

          {/* Streams Page */}
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
                  
                  {(loadingEpisodeStreams || loadingStreams) && 
                   Object.keys(type === 'series' ? episodeStreams : groupedStreams).length === 0 && 
                   !error ? (
                    <>
                      <View style={styles.filterContainer}>
                        {renderStreamFilters()}
                      </View>
                      <ScrollView 
                        style={styles.streamsContent}
                        showsVerticalScrollIndicator={false}
                        bounces={true}
                        overScrollMode="never"
                      >
                        {[1, 2].map((_, index) => (
                          <View key={index}>
                            {renderStreamSkeleton()}
                          </View>
                        ))}
                      </ScrollView>
                    </>
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
                    <>
                      <View style={styles.filterContainer}>
                        {renderStreamFilters()}
                      </View>
                      {renderFilteredStreams(type === 'series' ? episodeStreams : groupedStreams)}
                    </>
                  )}
                </View>
              </Animated.View>
            </GestureDetector>
          )}

          {/* Back Button */}
          {!showStreamsPage && lastScrollTop < 50 && (
            <Animated.View entering={FadeIn.delay(300).springify()}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Cast Modal */}
          {selectedCastMember && renderCastModal()}
        </Animated.View>
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
    backgroundColor: colors.black,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  heroContent: {
    padding: 24,
    paddingBottom: 16,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  genreChip: {
    backgroundColor: colors.elevation3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreText: {
    color: colors.highEmphasis,
    fontSize: 12,
    fontWeight: '600',
  },
  titleLogo: {
    width: width * 0.65,
    height: 90,
    marginBottom: 16,
  },
  titleText: {
    color: colors.highEmphasis,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metaChip: {
    backgroundColor: colors.elevation3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaChipText: {
    color: colors.highEmphasis,
    fontSize: 12,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevation3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    marginBottom: 28,
  },
  description: {
    color: colors.mediumEmphasis,
    fontSize: 15,
    lineHeight: 24,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    color: colors.highEmphasis,
    fontSize: 14,
    marginRight: 4,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.elevation3,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playButton: {
    backgroundColor: colors.white,
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
    paddingHorizontal: 16,
    paddingTop: 0,
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 0,
    backgroundColor: 'transparent',
  },
  streamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 70,
    backgroundColor: colors.elevation1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: colors.highEmphasis,
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
    color: colors.highEmphasis,
    fontSize: 12,
    fontWeight: '600',
  },
  streamCardRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.elevation2,
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
    color: colors.highEmphasis,
    marginTop: 16,
    fontSize: 16,
  },
  noStreams: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noStreamsText: {
    color: colors.highEmphasis,
    marginTop: 16,
    fontSize: 16,
  },
  episodesContainer: {
    flex: 1,
    paddingTop: 16,
  },
  episodesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.highEmphasis,
    marginBottom: 16,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  episodeContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  episodeCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.elevation1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    elevation: 2,
  },
  episodeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.elevation2,
    borderWidth: 2,
  },
  episodeImageContainer: {
    width: 140,
    height: 80,
    position: 'relative',
  },
  episodeImage: {
    width: '100%',
    height: '100%',
  },
  episodeImagePlaceholder: {
    backgroundColor: colors.elevation2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeNumberBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  episodeNumberText: {
    color: colors.textDark,
    fontSize: 10,
    fontWeight: 'bold',
  },
  episodeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  episodeHeader: {
    marginBottom: 4,
  },
  episodeNumber: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  episodeTitle: {
    color: colors.highEmphasis,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  episodeReleased: {
    color: colors.mediumEmphasis,
    fontSize: 12,
  },
  episodeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  episodeRatingText: {
    color: colors.mediumEmphasis,
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  castSection: {
    marginTop: 0,
    paddingLeft: 0,
  },
  castScrollContainer: {
    marginTop: 8,
  },
  castContainer: {
    marginVertical: 8,
  },
  castTitle: {
    color: colors.highEmphasis,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 16,
  },
  castList: {
    paddingLeft: 16,
    paddingRight: 0,
  },
  castMember: {
    width: 100,
    marginRight: 16,
    alignItems: 'center',
  },
  castImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.elevation2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  castImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  castImagePlaceholder: {
    backgroundColor: colors.elevation2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: colors.highEmphasis,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  castCharacter: {
    color: colors.mediumEmphasis,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  movieInfoContainer: {
    padding: 16,
  },
  seasonSelectorWrapper: {
    marginBottom: 16,
  },
  seasonSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
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
    backgroundColor: colors.transparentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonPosterPlaceholderText: {
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedSeasonButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  episodeOverview: {
    color: colors.textDark,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  streamsHeroContainer: {
    width: '100%',
    height: height * 0.40,
    marginBottom: 0,
    position: 'relative',
    backgroundColor: colors.black,
  },
  streamsHeroBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.black,
  },
  streamsHeroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 24,
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
    marginBottom: 2,
  },
  streamsHeroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streamsHeroOverview: {
    color: colors.textDark,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  streamsHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  streamsHeroReleased: {
    color: colors.textMuted,
    fontSize: 14,
  },
  streamsHeroRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streamsHeroRatingText: {
    color: '#FFD700', // Keeping gold color for ratings
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
    backgroundColor: colors.transparentLight,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: colors.white,
    fontSize: 12,
    marginTop: 4,
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
    backgroundColor: colors.transparentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  filterScroll: {
    flexGrow: 0,
    paddingVertical: 0,
  },
  filterChip: {
    backgroundColor: colors.transparentLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  filterChipSelected: {
    backgroundColor: colors.transparentLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  sourceText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  episodeStreamsContainer: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.transparentLight,
  },
  episodeStreamGroup: {
    marginBottom: 12,
  },
  episodeStreamAddonName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  showMoreStreamsButton: {
    padding: 8,
    backgroundColor: colors.transparentLight,
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
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metadataLabel: {
    color: colors.mediumEmphasis,
    fontSize: 15,
    fontWeight: '600',
    width: 90,
  },
  metadataValue: {
    color: colors.highEmphasis,
    fontSize: 15,
    flex: 1,
  },
  sectionTitle: {
    color: colors.highEmphasis,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionText: {
    color: colors.mediumEmphasis,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.elevation1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: colors.elevation2,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    color: colors.highEmphasis,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalCharacter: {
    color: colors.mediumEmphasis,
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
    color: colors.mediumEmphasis,
    fontSize: 14,
    marginBottom: 4,
  },
  modalDetailText: {
    color: colors.highEmphasis,
    fontSize: 16,
  },
  modalBiography: {
    marginTop: 8,
  },
  modalBiographyText: {
    color: colors.mediumEmphasis,
    fontSize: 15,
    lineHeight: 22,
  },
  movieCastSection: {
    marginBottom: 20,
    marginTop: 0,
    paddingLeft: 0,
  },
  additionalInfo: {
    marginBottom: 24,
  },
  streamsContent: {
    flex: 1,
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
    color: colors.highEmphasis,
    fontSize: 13,
    fontWeight: '600',
  },
  streamsMainContent: {
    flex: 1,
    backgroundColor: colors.darkBackground,
    paddingTop: 20,
  },
  episodesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default MetadataScreen;
