import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Dimensions,
  ImageBackground,
  ScrollView,
  Platform,
  Image
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StreamingContent, CatalogContent, catalogService } from '../services/catalogService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { colors } from '../styles/colors';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  cancelAnimation,
  Easing,
  withDelay
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define interfaces for our data
interface Category {
  id: string;
  name: string;
}

// Sample categories (real app would get these from API)
const SAMPLE_CATEGORIES: Category[] = [
  { id: 'movie', name: 'Movies' },
  { id: 'series', name: 'Series' },
  { id: 'channel', name: 'Channels' },
];

const SkeletonCatalog = () => (
  <View style={styles.catalogContainer}>
    <View style={styles.catalogHeader}>
      <View style={[styles.skeletonBox, { width: 150, height: 24 }]} />
      <View style={[styles.skeletonBox, { width: 80, height: 20 }]} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogList}>
      {[1, 2, 3, 4].map((_, index) => (
        <View key={index} style={[styles.contentItem, styles.skeletonPoster]} />
      ))}
    </ScrollView>
  </View>
);

const SkeletonFeatured = () => (
  <View style={styles.featuredContainer}>
    <View style={[styles.skeletonBox, styles.skeletonFeatured]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        style={styles.featuredGradient}
      >
        <View style={styles.featuredContent}>
          <View style={[styles.skeletonBox, { width: width * 0.6, height: 60, marginBottom: 16 }]} />
          <View style={styles.genreContainer}>
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={[styles.skeletonBox, { width: 80, height: 24, marginRight: 8 }]} />
            ))}
          </View>
          <View style={[styles.skeletonBox, { width: width * 0.8, height: 60, marginTop: 16 }]} />
          <View style={styles.featuredButtons}>
            <View style={[styles.skeletonBox, { flex: 1, height: 50, marginRight: 12, borderRadius: 25 }]} />
            <View style={[styles.skeletonBox, { flex: 1, height: 50, borderRadius: 25 }]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  </View>
);

const HomeScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('movie');
  const [featuredContent, setFeaturedContent] = useState<StreamingContent | null>(null);
  const [allFeaturedContent, setAllFeaturedContent] = useState<StreamingContent[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogContent[]>([]);
  const maxRetries = 3;
  const [lastSettingsUpdate, setLastSettingsUpdate] = useState<number>(Date.now());
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const autoPlayInterval = 8000; // 8 seconds for more comfortable viewing

  // Add new animated values for hero section
  const translateX = useSharedValue(0);
  const logoTranslateX = useSharedValue(0);
  const logoTranslateY = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const imageOpacity = useSharedValue(1);
  const currentIndex = useSharedValue(0);

  // Add preloading state
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  const springConfig = {
    damping: 20,
    mass: 1,
    stiffness: 90
  };

  // Preload function for thumbnails
  const preloadThumbnails = useCallback((contents: StreamingContent[]) => {
    if (!contents.length) return;

    const imagesToPreload = contents.map(content => ({
      uri: content.banner || content.poster,
      priority: FastImage.priority.high,
    }));

    // Also preload logos if available
    const logosToPreload = contents
      .filter(content => content.logo)
      .map(content => ({
        uri: content.logo!,
        priority: FastImage.priority.high,
      }));

    FastImage.preload([...imagesToPreload, ...logosToPreload]);

    // Keep track of preloaded images
    setPreloadedImages(new Set(
      [...imagesToPreload, ...logosToPreload].map(img => img.uri)
    ));
  }, []);

  // Preload next and previous images
  const preloadAdjacentContent = useCallback((currentIdx: number) => {
    if (!allFeaturedContent.length) return;

    const nextIdx = (currentIdx + 1) % allFeaturedContent.length;
    const prevIdx = currentIdx === 0 ? allFeaturedContent.length - 1 : currentIdx - 1;
    
    const adjacentContent = [
      allFeaturedContent[nextIdx],
      allFeaturedContent[prevIdx]
    ];

    preloadThumbnails(adjacentContent);
  }, [allFeaturedContent, preloadThumbnails]);

  // Update the prepareNextContent function for smoother transitions
  const prepareNextContent = useCallback((nextIndex: number) => {
    'worklet';
    // Reset position and scale immediately
    logoTranslateX.value = 0;
    logoScale.value = 1;
    
    // Update content and index
    runOnJS(setFeaturedContent)(allFeaturedContent[nextIndex]);
    currentIndex.value = nextIndex;
  }, [allFeaturedContent]);

  const nextContent = useCallback(() => {
    'worklet';
    if (allFeaturedContent.length > 0) {
      const nextIndex = (currentIndex.value + 1) % allFeaturedContent.length;
      
      // Quick fade out for smooth transition
      const fadeOutConfig = {
        duration: 300,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      };
      
      // Start fade out
      logoOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      });
      
      imageOpacity.value = withTiming(0, fadeOutConfig, () => {
        prepareNextContent(nextIndex);
      });
    }
  }, [allFeaturedContent, prepareNextContent]);

  const prevContent = useCallback(() => {
    'worklet';
    if (allFeaturedContent.length > 0) {
      const prevIndex = currentIndex.value === 0 
        ? allFeaturedContent.length - 1 
        : currentIndex.value - 1;
      
      // Quick fade out for smooth transition
      const fadeOutConfig = {
        duration: 300,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      };
      
      // Start fade out
      logoOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      });
      
      imageOpacity.value = withTiming(0, fadeOutConfig, () => {
        prepareNextContent(prevIndex);
      });
    }
  }, [allFeaturedContent, prepareNextContent]);

  // Pan gesture for hero section
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      runOnJS(setAutoPlayEnabled)(false);
      cancelAnimation(translateX);
      cancelAnimation(logoTranslateX);
      cancelAnimation(logoScale);
      cancelAnimation(logoOpacity);
      cancelAnimation(imageOpacity);
    })
    .onUpdate((event) => {
      'worklet';
      // Only move the logo horizontally
      logoTranslateX.value = event.translationX * 1.2;
      
      // Scale but don't fade during swipe
      const progress = Math.abs(event.translationX) / (width * 0.4);
      logoScale.value = 1 - (progress * 0.1);
      
      // Keep opacity constant during swipe
      logoOpacity.value = 1;
      imageOpacity.value = 1;
    })
    .onEnd((event) => {
      'worklet';
      const shouldSwipe = Math.abs(event.velocityX) > 500 || 
                         Math.abs(event.translationX) > width * 0.3;
      
      if (shouldSwipe) {
        // Smooth fade out with optimized timing
        const fadeOutConfig = {
          duration: 200,
          easing: Easing.bezier(0.33, 0, 0.67, 1)
        };
        
        // Coordinate fade out with content change
        logoOpacity.value = withTiming(0, fadeOutConfig);
        imageOpacity.value = withTiming(0, fadeOutConfig, () => {
          if (event.translationX > 0) {
            prevContent();
          } else {
            nextContent();
          }
          runOnJS(setAutoPlayEnabled)(true);
        });
        
        // Add spring animation for logo movement during fade
        logoTranslateX.value = withSpring(
          event.translationX > 0 ? width : -width,
          {
            damping: 15,
            mass: 0.5,
            stiffness: 120,
            velocity: event.velocityX
          }
        );
      } else {
        // Reset with spring animation
        logoTranslateX.value = withSpring(0, {
          damping: 15,
          mass: 0.5,
          stiffness: 120
        });
        logoScale.value = withSpring(1, {
          damping: 15,
          mass: 0.5,
          stiffness: 120
        });
        
        runOnJS(setAutoPlayEnabled)(true);
      }
    });

  // Animated styles
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: logoTranslateX.value },
      { translateY: logoTranslateY.value },
      { scale: logoScale.value }
    ],
    opacity: logoOpacity.value
  }));

  // Function to check if settings have been updated
  const checkSettingsUpdate = useCallback(async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('catalog_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const timestamp = settings._lastUpdate || 0;
        return timestamp > lastSettingsUpdate;
      }
      return false;
    } catch (error) {
      console.error('Failed to check settings update:', error);
      return false;
    }
  }, [lastSettingsUpdate]);

  // Update loadContent to include preloading
  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      
      // Helper function to delay execution
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Try loading content with retries
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          // Load catalogs from service
          const homeCatalogs = await catalogService.getHomeCatalogs();
          
          // If no catalogs found, wait and retry
          if (homeCatalogs.length === 0) {
            attempt++;
            console.log(`No catalogs found, retrying... (attempt ${attempt})`);
            await delay(2000); // Wait 2 seconds before next attempt
            continue;
          }

          // Set all catalogs
          setCatalogs(homeCatalogs);
          
          // Find popular content from Cinemeta for featured section
          const cinemetaCatalogs = homeCatalogs.filter(catalog => 
            catalog.addon === 'com.linvo.cinemeta'
          );

          const popularCatalog = cinemetaCatalogs.find(catalog => 
            catalog.name.toLowerCase().includes('popular') || 
            catalog.name.toLowerCase().includes('top') ||
            catalog.id.toLowerCase().includes('top')
          );

          // Set featured content from popular Cinemeta content
          if (popularCatalog && popularCatalog.items.length > 0) {
            setAllFeaturedContent(popularCatalog.items);
            const randomIndex = Math.floor(Math.random() * popularCatalog.items.length);
            setFeaturedContent(popularCatalog.items[randomIndex]);
            preloadThumbnails(popularCatalog.items);
          } else if (cinemetaCatalogs.length > 0 && cinemetaCatalogs[0].items.length > 0) {
            // Fall back to first Cinemeta catalog
            setAllFeaturedContent(cinemetaCatalogs[0].items);
            setFeaturedContent(cinemetaCatalogs[0].items[0]);
          }

          // Update last settings update timestamp
          setLastSettingsUpdate(Date.now());

          // If we get here, we've successfully loaded content
          return;

        } catch (error) {
          attempt++;
          console.error(`Failed to load content (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            await delay(2000); // Wait 2 seconds before next attempt
          }
        }
      }

      // If we get here, all retries failed
      console.error('All attempts to load content failed');
      setCatalogs([]);
      setAllFeaturedContent([]);
      setFeaturedContent(null);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maxRetries, preloadThumbnails]);

  // Reset retry count when refreshing manually
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadContent();
  }, [loadContent]);

  // Add useFocusEffect to reload content only when settings have changed
  useFocusEffect(
    useCallback(() => {
      let isSubscribed = true;

      const checkAndLoadContent = async () => {
        const shouldReload = await checkSettingsUpdate();
        if (isSubscribed && shouldReload) {
          loadContent();
        }
      };

      if (!catalogs.length) {
        // Initial load
        loadContent();
      } else {
        // Check if we need to reload
        checkAndLoadContent();
      }

      return () => {
        isSubscribed = false;
      };
    }, [loadContent, checkSettingsUpdate, catalogs.length])
  );

  // Preload adjacent content when current content changes
  useEffect(() => {
    if (featuredContent && allFeaturedContent.length > 0) {
      const currentIdx = allFeaturedContent.findIndex(
        content => content.id === featuredContent.id
      );
      if (currentIdx !== -1) {
        preloadAdjacentContent(currentIdx);
      }
    }
  }, [featuredContent, allFeaturedContent, preloadAdjacentContent]);

  // Add auto-play functionality
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (autoPlayEnabled && allFeaturedContent.length > 1) {
      intervalId = setInterval(() => {
        nextContent();
      }, autoPlayInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoPlayEnabled, allFeaturedContent.length, nextContent]);

  // Add touch handlers to pause auto-play
  const handleTouchStart = useCallback(() => {
    setAutoPlayEnabled(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setAutoPlayEnabled(true);
  }, []);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // Update renderFeaturedContent to optimize image loading
  const renderFeaturedContent = () => {
    if (!featuredContent) return null;

    const imageUri = featuredContent.banner || featuredContent.poster;

    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.featuredContainer}>
          <Animated.View style={[styles.featuredBannerContainer, heroAnimatedStyle]}>
            <FastImage
              source={{ 
                uri: imageUri,
                priority: FastImage.priority.high,
                cache: FastImage.cacheControl.immutable
              }}
              style={styles.featuredBanner}
              resizeMode={FastImage.resizeMode.cover}
              onLoadEnd={() => {
                // Quick fade in for thumbnail, delayed fade for logo
                const fadeInConfig = {
                  duration: 300,
                  easing: Easing.bezier(0.4, 0, 0.2, 1)
                };
                
                // Quick but smooth thumbnail fade-in
                imageOpacity.value = withTiming(1, {
                  duration: 150,
                  easing: Easing.bezier(0.4, 0, 0.6, 1)
                });
                
                // Add longer delay for logo with smooth fade
                logoOpacity.value = withDelay(400, withTiming(1, {
                  duration: 400,
                  easing: Easing.bezier(0.4, 0, 0.2, 1)
                }));
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.featuredTouchable}
                onPress={() => navigation.navigate('Metadata', { 
                  id: featuredContent.id, 
                  type: featuredContent.type
                })}
              >
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0.4)',
                    'rgba(0,0,0,0.6)',
                    'rgba(0,0,0,0.75)',
                    'rgba(0,0,0,0.85)',
                    'rgba(0,0,0,0.95)',
                    '#000'
                  ]}
                  locations={[0, 0.3, 0.5, 0.7, 0.85, 1]}
                  style={styles.featuredGradient}
                >
                  <View style={styles.featuredContent}>
                    <Animated.View style={logoAnimatedStyle}>
                      {featuredContent.logo ? (
                        <FastImage
                          source={{ 
                            uri: featuredContent.logo,
                            priority: FastImage.priority.high,
                            cache: FastImage.cacheControl.immutable
                          }}
                          style={styles.titleLogo}
                          resizeMode={FastImage.resizeMode.contain}
                        />
                      ) : (
                        <Text style={styles.titleText}>{featuredContent.name}</Text>
                      )}
                    </Animated.View>

                    {/* Rest of the featured content */}
                    {featuredContent.genres && featuredContent.genres.length > 0 && (
                      <View style={styles.genreContainer}>
                        {featuredContent.genres.slice(0, 3).map((genre, index) => (
                          <View key={index} style={styles.genreChip}>
                            <Text style={styles.genreText}>{genre}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {featuredContent.description && (
                      <Text style={styles.description} numberOfLines={3}>
                        {featuredContent.description}
                      </Text>
                    )}

                    <View style={styles.featuredButtons}>
                      <TouchableOpacity
                        style={[styles.button, styles.whiteButton]}
                        onPress={() => navigation.navigate('Metadata', {
                          id: featuredContent.id,
                          type: featuredContent.type
                        })}
                      >
                        <View style={styles.buttonInner}>
                          <MaterialIcons name="play-arrow" size={24} color="#000" />
                          <Text style={styles.whiteButtonText}>Play</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, styles.infoButton]}
                        onPress={() => navigation.navigate('Metadata', {
                          id: featuredContent.id,
                          type: featuredContent.type
                        })}
                      >
                        <View style={styles.buttonInner}>
                          <MaterialIcons name="info-outline" size={24} color="#fff" />
                          <Text style={styles.buttonText}>More Info</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </FastImage>
          </Animated.View>
        </View>
      </GestureDetector>
    );
  };

  const renderContentItem = ({ item }: { item: StreamingContent }) => (
    <TouchableOpacity
      style={styles.contentItem}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('Metadata', { 
        id: item.id, 
        type: item.type
      })}
    >
      <FastImage
        source={{ uri: item.poster }}
        style={styles.poster}
        resizeMode={FastImage.resizeMode.cover}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.posterGradient}
      />
    </TouchableOpacity>
  );

  const renderCatalog = ({ item }: { item: CatalogContent }) => {
    return (
      <View style={styles.catalogContainer}>
        <View style={styles.catalogHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.catalogTitle}>{item.name}</Text>
            <View style={styles.titleUnderline} />
          </View>
          <TouchableOpacity
            onPress={() => 
              navigation.navigate('Catalog', {
                id: item.id,
                type: item.type,
                addonId: item.addon
              })
            }
            style={styles.seeAllButton}
          >
            <Text style={styles.seeAllText}>See More</Text>
            <MaterialIcons name="arrow-forward" color={colors.primary} size={16} />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={item.items}
          renderItem={renderContentItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catalogList}
          snapToInterval={POSTER_WIDTH + 16}
          decelerationRate="fast"
          snapToAlignment="start"
        />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Animated.ScrollView 
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonFeatured />
          {[1, 2, 3].map((_, index) => (
            <SkeletonCatalog key={index} />
          ))}
        </Animated.ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <Animated.ScrollView
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDarkMode ? '#FFFFFF' : '#121212'} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Featured Content */}
        {renderFeaturedContent()}

        {/* Catalogs */}
        {catalogs.length > 0 ? (
          <FlatList
            data={catalogs}
            renderItem={renderCatalog}
            keyExtractor={(item, index) => `${item.addon}-${item.id}-${index}`}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyCatalog}>
            <Text style={{ color: isDarkMode ? '#888' : '#666' }}>
              No content available. Pull down to refresh.
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');
const POSTER_WIDTH = (width - 48) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredContainer: {
    width: '100%',
    height: height * 0.75,
    marginTop: -(StatusBar.currentHeight || 0),
  },
  featuredBanner: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  featuredContent: {
    padding: 24,
    paddingBottom: 32,
  },
  featuredLogo: {
    width: width * 0.6,
    height: 100,
    marginBottom: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    minHeight: 60,
    maxHeight: 100,
  },
  featuredTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  genreContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  yearChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
  },
  yearText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 197, 24, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFD700',
    marginLeft: 4,
    fontWeight: '700',
    fontSize: 13,
  },
  featuredButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  featuredButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 100,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  buttonInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  whiteButton: {
    backgroundColor: '#ffffff',
  },
  whiteButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  catalogContainer: {
    marginBottom: 24,
  },
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleContainer: {
    position: 'relative',
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleUnderline: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    width: 30,
    height: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.3,
    borderRadius: 1,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.9,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  catalogList: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  contentItem: {
    width: POSTER_WIDTH,
    aspectRatio: 2/3,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  posterGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  imdbLogo: {
    width: 35,
    height: 17,
    marginRight: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  emptyCatalog: {
    padding: 24,
    alignItems: 'center',
  },
  skeletonBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonFeatured: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skeletonPoster: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  featuredBannerContainer: {
    width: '100%',
    height: '100%',
  },
  titleLogo: {
    width: width * 0.6,
    height: 60,
    marginBottom: 16,
  },
  titleText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  featuredTouchable: {
    flex: 1,
    width: '100%',
  },
});

export default HomeScreen; 