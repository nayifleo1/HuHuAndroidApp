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
import { useNavigation } from '@react-navigation/native';
import { StreamingContent, CatalogContent, catalogService } from '../services/catalogService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { colors } from '../styles/colors';

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

const HomeScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('movie');
  const [featuredContent, setFeaturedContent] = useState<StreamingContent | null>(null);
  const [allFeaturedContent, setAllFeaturedContent] = useState<StreamingContent[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogContent[]>([]);

  // Function to rotate featured content
  const rotateFeaturedContent = useCallback(() => {
    if (allFeaturedContent.length > 0) {
      const currentIndex = allFeaturedContent.findIndex(item => item.id === featuredContent?.id);
      const nextIndex = (currentIndex + 1) % allFeaturedContent.length;
      setFeaturedContent(allFeaturedContent[nextIndex]);
    }
  }, [allFeaturedContent, featuredContent]);

  // Set up rotation interval
  useEffect(() => {
    const interval = setInterval(rotateFeaturedContent, 10000); // Rotate every 10 seconds
    return () => clearInterval(interval);
  }, [rotateFeaturedContent]);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load catalogs from service
      const homeCatalogs = await catalogService.getHomeCatalogs();
      
      // Filter for Cinemeta catalogs only
      const allCinemetaCatalogs = homeCatalogs.filter(catalog => 
        catalog.addon === 'com.linvo.cinemeta'
      );

      // Create a map to store unique catalogs by their content
      const uniqueCatalogsMap = new Map();
      
      allCinemetaCatalogs.forEach(catalog => {
        // Create a key based on the items' IDs to detect duplicate content
        const contentKey = catalog.items.map(item => item.id).sort().join(',');
        
        // Only keep the first occurrence of each unique content collection
        if (!uniqueCatalogsMap.has(contentKey)) {
          uniqueCatalogsMap.set(contentKey, catalog);
        }
      });

      // Convert map back to array
      const cinemetaCatalogs = Array.from(uniqueCatalogsMap.values());

      // Find popular content from Cinemeta
      const popularCatalog = cinemetaCatalogs.find(catalog => 
        catalog.name.toLowerCase().includes('popular') || 
        catalog.name.toLowerCase().includes('top') ||
        catalog.id.toLowerCase().includes('top')
      );

      // Set catalogs showing only unique Cinemeta content
      setCatalogs(cinemetaCatalogs);
      
      // Set featured content from popular Cinemeta content
      if (popularCatalog && popularCatalog.items.length > 0) {
        setAllFeaturedContent(popularCatalog.items);
        const randomIndex = Math.floor(Math.random() * popularCatalog.items.length);
        setFeaturedContent(popularCatalog.items[randomIndex]);
      } else if (cinemetaCatalogs.length > 0 && cinemetaCatalogs[0].items.length > 0) {
        // Fall back to first Cinemeta catalog
        setAllFeaturedContent(cinemetaCatalogs[0].items);
        setFeaturedContent(cinemetaCatalogs[0].items[0]);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadContent();
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const renderFeaturedContent = () => {
    if (!featuredContent) return null;

    return (
      <TouchableOpacity
        style={styles.featuredContainer}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Metadata', { 
          id: featuredContent.id, 
          type: featuredContent.type
        })}
      >
        <ImageBackground
          source={{ uri: featuredContent.banner || featuredContent.poster }}
          style={styles.featuredBanner}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={styles.featuredGradient}
          >
            <View style={styles.featuredContent}>
              {featuredContent.logo ? (
                <FastImage
                  source={{ uri: featuredContent.logo }}
                  style={styles.featuredLogo}
                  resizeMode={FastImage.resizeMode.contain}
                />
              ) : (
                <Text style={styles.featuredTitle}>{featuredContent.name}</Text>
              )}
              
              {featuredContent.genres && featuredContent.genres.length > 0 && (
                <View style={styles.genreContainer}>
                  {featuredContent.genres.slice(0, 3).map((genre, index) => (
                    <View key={index} style={styles.genreChip}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.featuredMeta}>
                {featuredContent.year && (
                  <View style={styles.yearChip}>
                    <Text style={styles.yearText}>{featuredContent.year}</Text>
                  </View>
                )}
                {featuredContent.imdbRating && (
                  <View style={styles.ratingContainer}>
                    <Image 
                      source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/575px-IMDB_Logo_2016.svg.png' }}
                      style={styles.imdbLogo}
                    />
                    <Text style={styles.ratingText}>{featuredContent.imdbRating}</Text>
                  </View>
                )}
              </View>

              {featuredContent.description && (
                <Text style={styles.description} numberOfLines={3}>
                  {featuredContent.description}
                </Text>
              )}
              
              <View style={styles.featuredButtons}>
                <TouchableOpacity 
                  style={[styles.featuredButton, styles.playButton]}
                  onPress={() => navigation.navigate('Player', { 
                    id: featuredContent?.id, 
                    type: featuredContent?.type
                  })}
                >
                  <MaterialIcons name="play-arrow" color="#000000" size={24} />
                  <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.featuredButton, styles.infoButton]}
                  onPress={() => navigation.navigate('Metadata', { 
                    id: featuredContent?.id, 
                    type: featuredContent?.type
                  })}
                >
                  <MaterialIcons name="info-outline" color="#FFFFFF" size={20} />
                  <Text style={styles.infoButtonText}>More Info</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
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
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDarkMode ? '#FFFFFF' : '#121212'} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
      </ScrollView>
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
  playButton: {
    backgroundColor: '#FFFFFF',
  },
  playButtonText: {
    color: '#000000',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  infoButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
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
});

export default HomeScreen; 