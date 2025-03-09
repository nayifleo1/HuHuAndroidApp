import React, { useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  SectionList,
  Platform,
  ImageBackground,
  ScrollView,
  StatusBar,
  Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { RootStackParamList } from '../types/navigation';
import { useMetadata } from '../hooks/useMetadata';
import { colors } from '../styles/colors';
import { Stream } from '../types/metadata';
import { tmdbService } from '../services/tmdbService';
import { stremioService } from '../services/stremioService';
import { VideoPlayerService } from '../services/videoPlayerService';
import { useSettings } from '../hooks/useSettings';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  withSpring,
  withTiming,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
  runOnJS,
  cancelAnimation,
  SharedValue
} from 'react-native-reanimated';
import { torrentService } from '../services/torrentService';
import { TorrentProgress } from '../services/torrentService';

const TMDB_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tmdb.new.logo.svg/512px-Tmdb.new.logo.svg.png?20200406190906';
const HDR_ICON = 'https://uxwing.com/wp-content/themes/uxwing/download/video-photography-multimedia/hdr-icon.png';
const DOLBY_ICON = 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/Dolby_Vision_%28logo%29.svg/512px-Dolby_Vision_%28logo%29.svg.png?20220908042900';

// Extracted Components
const StreamCard = memo(({ stream, onPress, index, torrentProgress }: { 
  stream: Stream; 
  onPress: () => void; 
  index: number;
  torrentProgress?: TorrentProgress;
}) => {
  const quality = stream.title?.match(/(\d+)p/)?.[1] || null;
  const isHDR = stream.title?.toLowerCase().includes('hdr');
  const isDolby = stream.title?.toLowerCase().includes('dolby') || stream.title?.includes('DV');
  const size = stream.title?.match(/💾\s*([\d.]+\s*[GM]B)/)?.[1];
  const isTorrent = stream.url?.startsWith('magnet:') || stream.behaviorHints?.isMagnetStream;
  const isDebrid = stream.behaviorHints?.cached;

  const displayTitle = stream.name || stream.title || 'Unnamed Stream';

  const entering = useMemo(() => 
    FadeInDown
      .delay(50 + Math.min(index, 10) * 30)
      .springify()
      .damping(15)
      .mass(0.9)
  , [index]);

  const handlePress = useCallback(() => {
    console.log('StreamCard pressed:', {
      isTorrent,
      isDebrid,
      hasProgress: !!torrentProgress,
      url: stream.url,
      behaviorHints: stream.behaviorHints
    });
    onPress();
  }, [isTorrent, isDebrid, torrentProgress, stream.url, stream.behaviorHints, onPress]);

  // Only disable if it's a torrent that's not debrid and not currently downloading
  const isDisabled = isTorrent && !isDebrid && !torrentProgress && !stream.behaviorHints?.notWebReady;

  return (
    <Animated.View entering={entering}>
      <TouchableOpacity 
        onPress={handlePress}
        style={[
          styles.streamCard,
          isDisabled && styles.streamCardDisabled
        ]}
        activeOpacity={0.7}
        disabled={false} // Never disable the TouchableOpacity to allow starting torrent downloads
      >
        <View style={styles.streamCardLeft}>
          <View style={styles.streamTypeContainer}>
            {torrentProgress ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons 
                name={isTorrent && !isDebrid ? 'download' : 'play-circle-outline'} 
                size={20} 
                color={isTorrent && !isDebrid ? colors.textMuted : colors.text} 
              />
            )}
            {isDebrid && !isTorrent && (
              <MaterialIcons 
                name="cloud-done" 
                size={16} 
                color={colors.success}
                style={styles.debridIcon}
              />
            )}
          </View>

          <View style={styles.streamContent}>
            <Text style={styles.streamTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            
            <View style={styles.primaryTags}>
              {quality && (
                <QualityTag text={`${quality}p`} color={colors.info} />
              )}
              {isHDR && (
                <FastImage
                  source={{ uri: HDR_ICON }}
                  style={styles.hdrIcon}
                  resizeMode={FastImage.resizeMode.contain}
                />
              )}
              {isDolby && (
                <FastImage
                  source={{ uri: DOLBY_ICON }}
                  style={styles.dolbyIcon}
                  tintColor="#ffffff"
                  resizeMode={FastImage.resizeMode.contain}
                />
              )}
              {size && (
                <QualityTag text={size} color={colors.darkGray} />
              )}
              {torrentProgress && (
                <QualityTag 
                  text={`${torrentProgress.bufferProgress}%`} 
                  color={colors.primary} 
                />
              )}
            </View>

            {stream.title && (
              <Text style={[
                styles.sourceText,
                isTorrent && !isDebrid && !torrentProgress && styles.sourceTextDisabled
              ]} numberOfLines={1}>
                {isTorrent && !isDebrid ? (
                  torrentProgress ? 
                    `Downloading... ${(torrentProgress.downloadSpeed / (1024 * 1024)).toFixed(2)} MB/s • ${torrentProgress.seeds} seeds` :
                    'Magnet link - Click to start downloading'
                ) : stream.title}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.streamCardRight}>
          <MaterialIcons 
            name={torrentProgress ? 'downloading' : 'play-arrow'} 
            size={24} 
            color={colors.text} 
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.stream.url === nextProps.stream.url &&
         prevProps.index === nextProps.index &&
         prevProps.torrentProgress?.bufferProgress === nextProps.torrentProgress?.bufferProgress;
});

const QualityTag = React.memo(({ text, color }: { text: string; color: string }) => (
  <View style={[styles.qualityTag, { backgroundColor: color }]}>
    <Text style={styles.tagText}>{text}</Text>
  </View>
));

const ProviderFilter = memo(({ 
  selectedProvider, 
  providers, 
  onSelect 
}: { 
  selectedProvider: string; 
  providers: Array<{ id: string; name: string; }>; 
  onSelect: (id: string) => void;
}) => {
  const renderItem = useCallback(({ item }: { item: { id: string; name: string } }) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.filterChip,
        selectedProvider === item.id && styles.filterChipSelected
      ]}
      onPress={() => onSelect(item.id)}
    >
      <Text style={[
        styles.filterChipText,
        selectedProvider === item.id && styles.filterChipTextSelected
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [selectedProvider, onSelect]);

  return (
    <FlatList
      data={providers}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      bounces={true}
      overScrollMode="never"
      decelerationRate="fast"
      initialNumToRender={5}
      maxToRenderPerBatch={3}
      windowSize={3}
      getItemLayout={(data, index) => ({
        length: 100, // Approximate width of each item
        offset: 100 * index,
        index,
      })}
    />
  );
});

export const StreamsScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Streams'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { id, type, episodeId } = route.params;
  const { settings } = useSettings();

  const {
    metadata,
    episodes,
    groupedStreams,
    loadingStreams,
    episodeStreams,
    loadingEpisodeStreams,
    selectedEpisode,
    loadStreams,
    loadEpisodeStreams,
    setSelectedEpisode,
    groupedEpisodes,
  } = useMetadata({ id, type });

  const [selectedProvider, setSelectedProvider] = React.useState('all');
  const [availableProviders, setAvailableProviders] = React.useState<Set<string>>(new Set());

  // Optimize animation values with cleanup
  const headerOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.95);
  const filterOpacity = useSharedValue(0);

  // Add new state for torrent progress
  const [torrentProgress, setTorrentProgress] = React.useState<{[key: string]: TorrentProgress}>({});
  const [activeTorrent, setActiveTorrent] = React.useState<string | null>(null);

  // Add new state to track video player status
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);

  React.useEffect(() => {
    if (type === 'series' && episodeId) {
      setSelectedEpisode(episodeId);
      loadEpisodeStreams(episodeId);
    } else if (type === 'movie') {
      loadStreams();
    }
  }, [type, episodeId]);

  React.useEffect(() => {
    const streams = type === 'series' ? episodeStreams : groupedStreams;
    const providers = new Set(Object.keys(streams));
    setAvailableProviders(providers);
  }, [type, groupedStreams, episodeStreams]);

  React.useEffect(() => {
    // Trigger entrance animations
    headerOpacity.value = withTiming(1, { duration: 400 });
    heroScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
      mass: 0.9,
      restDisplacementThreshold: 0.01
    });
    filterOpacity.value = withTiming(1, { duration: 500 });

    return () => {
      // Cleanup animations on unmount
      cancelAnimation(headerOpacity);
      cancelAnimation(heroScale);
      cancelAnimation(filterOpacity);
    };
  }, []);

  // Memoize handlers
  const handleBack = useCallback(() => {
    const cleanup = () => {
      headerOpacity.value = withTiming(0, { duration: 200 });
      heroScale.value = withTiming(0.95, { duration: 200 });
      filterOpacity.value = withTiming(0, { duration: 200 });
    };
    cleanup();
    navigation.goBack();
  }, [navigation, headerOpacity, heroScale, filterOpacity]);

  const handleProviderChange = useCallback((provider: string) => {
    setSelectedProvider(provider);
  }, []);

  const currentEpisode = useMemo(() => {
    if (!selectedEpisode) return null;

    // Search through all episodes in all seasons
    const allEpisodes = Object.values(groupedEpisodes).flat();
    return allEpisodes.find(ep => 
      ep.stremioId === selectedEpisode || 
      `${id}:${ep.season_number}:${ep.episode_number}` === selectedEpisode
    );
  }, [selectedEpisode, groupedEpisodes, id]);

  // Update handleStreamPress
  const handleStreamPress = useCallback(async (stream: Stream) => {
    try {
      if (stream.url) {
        console.log('handleStreamPress called with stream:', {
          url: stream.url,
          behaviorHints: stream.behaviorHints,
          isMagnet: stream.url.startsWith('magnet:'),
          isMagnetStream: stream.behaviorHints?.isMagnetStream
        });
        
        // Check if it's a magnet link either directly or through behaviorHints
        const isMagnet = stream.url.startsWith('magnet:') || stream.behaviorHints?.isMagnetStream;
        
        if (isMagnet) {
          console.log('Handling magnet link...');
          // Check if there's already an active torrent
          if (activeTorrent && activeTorrent !== stream.url) {
            Alert.alert(
              'Active Download',
              'There is already an active download. Do you want to stop it and start this one?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Stop and Switch',
                  style: 'destructive',
                  onPress: async () => {
                    console.log('Stopping current torrent and starting new one');
                    await torrentService.stopStreamAndWait();
                    setActiveTorrent(null);
                    setTorrentProgress({});
                    startTorrentStream(stream);
                  }
                }
              ]
            );
            return;
          }

          console.log('Starting torrent stream...');
          startTorrentStream(stream);
        } else {
          console.log('Playing regular stream...');
          // Handle regular streams using VideoPlayerService
          await VideoPlayerService.playVideo(stream.url, {
            title: metadata?.name || '',
            headers: stream.headers,
            subtitleUrl: stream.subtitles?.[0]?.url,
            subtitleLanguage: stream.subtitles?.[0]?.lang || 'en',
            episodeTitle: type === 'series' ? currentEpisode?.name : undefined,
            episodeNumber: type === 'series' ? 
              `S${currentEpisode?.season_number.toString().padStart(2, '0')}E${currentEpisode?.episode_number.toString().padStart(2, '0')}` 
              : undefined,
            releaseDate: metadata?.released
          });
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      Alert.alert(
        'Playback Error',
        error instanceof Error ? error.message : 'An error occurred while playing the video'
      );
    }
  }, [metadata, type, currentEpisode, activeTorrent]);

  // Clean up torrent when video player closes or component unmounts
  React.useEffect(() => {
    return () => {
      console.log('[StreamsScreen] Cleanup effect triggered, stopping torrent');
      if (activeTorrent) {
        torrentService.stopStreamAndWait().catch(error => {
          console.error('[StreamsScreen] Error during cleanup:', error);
        });
        setActiveTorrent(null);
        setTorrentProgress({});
      }
    };
  }, [activeTorrent]);

  const startTorrentStream = useCallback(async (stream: Stream) => {
    if (!stream.url) return;

    try {
      console.log('[StreamsScreen] Starting torrent stream with URL:', stream.url);
      
      // Make sure any existing stream is fully stopped
      if (activeTorrent && activeTorrent !== stream.url) {
        await torrentService.stopStreamAndWait();
        setActiveTorrent(null);
        setTorrentProgress({});
      }
      
      setActiveTorrent(stream.url);
      setIsVideoPlaying(false);
      
      const videoPath = await torrentService.startStream(stream.url, {
        onProgress: (progress) => {
          console.log('[StreamsScreen] Torrent progress update:', {
            url: stream.url,
            progress,
            currentTorrentProgress: torrentProgress[stream.url!]
          });
          setTorrentProgress(prev => ({
            ...prev,
            [stream.url!]: progress
          }));

          // If buffering is complete, start playback
          if (progress.bufferProgress >= 100) {
            console.log('[StreamsScreen] Torrent buffering complete, starting playback');
            setActiveTorrent(null);
            setTorrentProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[stream.url!];
              return newProgress;
            });
          }
        }
      });
      
      console.log('[StreamsScreen] Got video path:', videoPath);
      
      // Once we have the video file path, play it using VideoPlayerService
      setIsVideoPlaying(true);
      
      try {
        await VideoPlayerService.playVideo(`file://${videoPath}`, {
          title: metadata?.name || '',
          episodeTitle: type === 'series' ? currentEpisode?.name : undefined,
          episodeNumber: type === 'series' ? 
            `S${currentEpisode?.season_number.toString().padStart(2, '0')}E${currentEpisode?.episode_number.toString().padStart(2, '0')}` 
            : undefined,
          releaseDate: metadata?.released
        });
        
        // Video player has closed normally
        console.log('[StreamsScreen] Video playback ended, cleaning up');
        setIsVideoPlaying(false);
        
        // Clean up torrent after video player closes
        await torrentService.stopStreamAndWait();
        setActiveTorrent(null);
        setTorrentProgress({});
        
      } catch (playerError) {
        console.error('[StreamsScreen] Video player error:', playerError);
        setIsVideoPlaying(false);
        throw playerError;
      }
      
    } catch (error) {
      console.error('[StreamsScreen] Torrent error:', error);
      // Clean up on error
      setIsVideoPlaying(false);
      await torrentService.stopStreamAndWait();
      setActiveTorrent(null);
      setTorrentProgress({});
      Alert.alert(
        'Download Error',
        error instanceof Error ? error.message : 'An error occurred while playing the video'
      );
    }
  }, [metadata, type, currentEpisode, torrentProgress, activeTorrent]);

  const filterItems = useMemo(() => {
    const installedAddons = stremioService.getInstalledAddons();
    const streams = type === 'series' ? episodeStreams : groupedStreams;

    return [
      { id: 'all', name: 'All Providers' },
      ...Array.from(availableProviders)
        .sort((a, b) => {
          const indexA = installedAddons.findIndex(addon => addon.id === a);
          const indexB = installedAddons.findIndex(addon => addon.id === b);
          
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return 0;
        })
        .map(provider => {
          const addonInfo = streams[provider];
          const installedAddon = installedAddons.find(addon => addon.id === provider);
          
          let displayName = provider;
          if (provider === 'source_1') displayName = 'Source 1';
          else if (provider === 'source_2') displayName = 'Source 2';
          else if (provider === 'external_sources') displayName = 'External Sources';
          else if (installedAddon) displayName = installedAddon.name;
          else if (addonInfo?.addonName) displayName = addonInfo.addonName;
          
          return { id: provider, name: displayName };
        })
    ];
  }, [availableProviders, type, episodeStreams, groupedStreams]);

  const sections = useMemo(() => {
    const streams = type === 'series' ? episodeStreams : groupedStreams;
    const installedAddons = stremioService.getInstalledAddons();

    // Add test torrent stream for development
    if (__DEV__) {
      streams['test_addon'] = {
        addonName: 'Test Addon',
        streams: [{
          url: 'magnet:?xt=urn:btih:88594aaacbde40ef3e2510c47374ec0aa396c08e&dn=bbb%5Fsunflower%5F1080p%5F30fps%5Fnormal.mp4&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.publicbt.com%3A80%2Fannounce&ws=http%3A%2F%2Fdistribution.bbb3d.renderfarming.net%2Fvideo%2Fmp4%2Fbbb%5Fsunflower%5F1080p%5F30fps%5Fnormal.mp4',
          title: 'Test Torrent Stream (Big Buck Bunny 1080p)',
          name: 'Big Buck Bunny 1080p',
          behaviorHints: {
            notWebReady: true,
          }
        }]
      };
    }

    return Object.entries(streams)
      .filter(([addonId]) => selectedProvider === 'all' || selectedProvider === addonId)
      .sort(([addonIdA], [addonIdB]) => {
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
  }, [selectedProvider, type, episodeStreams, groupedStreams]);

  const episodeImage = useMemo(() => {
    if (!currentEpisode) return null;
    if (currentEpisode.still_path) {
      return tmdbService.getImageUrl(currentEpisode.still_path, 'original');
    }
    return metadata?.poster || null;
  }, [currentEpisode, metadata]);

  const isLoading = type === 'series' ? loadingEpisodeStreams : loadingStreams;
  const streams = type === 'series' ? episodeStreams : groupedStreams;

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
    opacity: headerOpacity.value
  }));

  const filterStyle = useAnimatedStyle(() => ({
    opacity: filterOpacity.value,
    transform: [
      { 
        translateY: interpolate(
          filterOpacity.value,
          [0, 1],
          [20, 0],
          Extrapolate.CLAMP
        )
      }
    ]
  }));

  const renderItem = useCallback(({ item, index }: { item: Stream; index: number }) => (
    <StreamCard 
      stream={item} 
      onPress={() => handleStreamPress(item)}
      index={index}
      torrentProgress={item.url ? torrentProgress[item.url] : undefined}
    />
  ), [handleStreamPress, torrentProgress]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <Animated.View
      entering={FadeInDown.delay(150).springify()}
    >
      <Text style={styles.streamGroupTitle}>{section.title}</Text>
    </Animated.View>
  ), []);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.backButtonContainer]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backButtonText}>
            {type === 'series' ? 'Back to Episodes' : 'Back to Info'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {type === 'series' && currentEpisode && (
        <Animated.View style={[styles.streamsHeroContainer, heroStyle]}>
          <ImageBackground
            source={episodeImage ? { uri: episodeImage } : undefined}
            style={styles.streamsHeroBackground}
            fadeDuration={0}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                'rgba(0,0,0,0)',
                'rgba(0,0,0,0.4)',
                'rgba(0,0,0,0.7)',
                'rgba(0,0,0,0.85)',
                'rgba(0,0,0,0.95)',
                colors.darkBackground
              ]}
              locations={[0, 0.3, 0.5, 0.7, 0.85, 1]}
              style={styles.streamsHeroGradient}
            >
              <View style={styles.streamsHeroContent}>
                <View style={styles.streamsHeroInfo}>
                  <Text style={styles.streamsHeroEpisodeNumber}>
                    {currentEpisode.episodeString}
                  </Text>
                  <Text style={styles.streamsHeroTitle} numberOfLines={1}>
                    {currentEpisode.name}
                  </Text>
                  {currentEpisode.overview && (
                    <Text style={styles.streamsHeroOverview} numberOfLines={2}>
                      {currentEpisode.overview}
                    </Text>
                  )}
                  <View style={styles.streamsHeroMeta}>
                    <Text style={styles.streamsHeroReleased}>
                      {tmdbService.formatAirDate(currentEpisode.air_date)}
                    </Text>
                    {currentEpisode.vote_average > 0 && (
                      <View style={styles.streamsHeroRating}>
                        <FastImage
                          source={{ uri: TMDB_LOGO }}
                          style={styles.tmdbLogo}
                          resizeMode={FastImage.resizeMode.contain}
                        />
                        <Text style={styles.streamsHeroRatingText}>
                          {currentEpisode.vote_average.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        </Animated.View>
      )}

      <View style={[
        styles.streamsMainContent,
        type === 'movie' && styles.streamsMainContentMovie
      ]}>
        <Animated.View style={[styles.filterContainer, filterStyle]}>
          {Object.keys(streams).length > 0 && (
            <ProviderFilter
              selectedProvider={selectedProvider}
              providers={filterItems}
              onSelect={handleProviderChange}
            />
          )}
        </Animated.View>

        {isLoading ? (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.loadingContainer}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Finding available streams...</Text>
          </Animated.View>
        ) : Object.keys(streams).length === 0 ? (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.noStreams}
          >
            <MaterialIcons name="error-outline" size={48} color={colors.textMuted} />
            <Text style={styles.noStreamsText}>No streams available</Text>
          </Animated.View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.url}-${index}`}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            initialNumToRender={8}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews={true}
            contentContainerStyle={styles.streamsContainer}
            style={styles.streamsContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="never"
            getItemLayout={(data, index) => ({
              length: 86, // Height of each stream card + margin
              offset: 86 * index,
              index,
            })}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingTop: Platform.OS === 'android' ? 35 : 45,
  },
  backButtonText: {
    color: colors.highEmphasis,
    fontSize: 13,
    fontWeight: '600',
  },
  streamsMainContent: {
    flex: 1,
    backgroundColor: colors.darkBackground,
    paddingTop: 20,
  },
  streamsMainContentMovie: {
    paddingTop: Platform.OS === 'android' ? 90 : 100,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterScroll: {
    flexGrow: 0,
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
  streamsContent: {
    flex: 1,
    width: '100%',
  },
  streamsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    width: '100%',
  },
  streamGroup: {
    marginBottom: 24,
    width: '100%',
  },
  streamGroupTitle: {
    color: colors.text,
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
    width: '100%',
  },
  streamCardDisabled: {
    backgroundColor: colors.elevation2,
  },
  streamCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
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
    gap: 4,
    marginBottom: 6,
    alignItems: 'center',
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
  sourceText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  sourceTextDisabled: {
    color: colors.error,
    fontStyle: 'normal',
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
    backgroundColor: colors.transparentLight,
    marginRight: 12,
  },
  skeletonText: {
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.transparentLight,
  },
  skeletonTag: {
    width: 60,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.transparentLight,
  },
  noStreams: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noStreamsText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 16,
  },
  streamsHeroContainer: {
    width: '100%',
    height: 300,
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
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streamsHeroTitle: {
    color: colors.highEmphasis,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streamsHeroOverview: {
    color: colors.mediumEmphasis,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streamsHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  streamsHeroReleased: {
    color: colors.mediumEmphasis,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streamsHeroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
  },
  tmdbLogo: {
    width: 20,
    height: 14,
  },
  streamsHeroRatingText: {
    color: '#01b4e4',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  hdrIcon: {
    width: 36,
    height: 16,
    marginRight: 4,
  },
  dolbyIcon: {
    width: 46,
    height: 16,
    marginRight: 4,
  },
});

export default memo(StreamsScreen); 