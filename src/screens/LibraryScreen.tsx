import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles';
import FastImage from '@d11/react-native-fast-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { catalogService } from '../services/catalogService';
import type { StreamingContent } from '../services/catalogService';

// Types
interface LibraryItem extends StreamingContent {
  progress?: number;
  lastWatched?: string;
}

const SkeletonLoader = () => {
  const pulseAnim = React.useRef(new RNAnimated.Value(0)).current;
  const { width } = useWindowDimensions();
  const itemWidth = (width - 48) / 2;

  React.useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const renderSkeletonItem = () => (
    <View style={[styles.itemContainer, { width: itemWidth }]}>
      <RNAnimated.View 
        style={[
          styles.posterContainer,
          { opacity, backgroundColor: colors.darkBackground }
        ]} 
      />
      <RNAnimated.View 
        style={[
          styles.skeletonTitle,
          { opacity, backgroundColor: colors.darkBackground }
        ]} 
      />
    </View>
  );

  return (
    <View style={styles.skeletonContainer}>
      {[...Array(6)].map((_, index) => (
        <View key={index} style={{ width: itemWidth }}>
          {renderSkeletonItem()}
        </View>
      ))}
    </View>
  );
};

const LibraryScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'movies' | 'series'>('all');

  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      try {
        const items = await catalogService.getLibraryItems();
        setLibraryItems(items);
      } catch (error) {
        console.error('Failed to load library:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();

    // Subscribe to library updates
    const unsubscribe = catalogService.subscribeToLibraryUpdates((items) => {
      setLibraryItems(items);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredItems = libraryItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'movies') return item.type === 'movie';
    if (filter === 'series') return item.type === 'series';
    return true;
  });

  const itemWidth = (width - 48) / 2; // 2 items per row with padding

  const renderItem = ({ item }: { item: LibraryItem }) => {
    return (
      <TouchableOpacity
        style={[styles.itemContainer, { width: itemWidth }]}
        onPress={() => {
          navigation.navigate('Metadata', { id: item.id, type: item.type });
        }}
      >
        <View style={styles.posterContainer}>
          <FastImage
            source={{ uri: item.poster }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
          {item.progress !== undefined && item.progress < 1 && (
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${item.progress * 100}%` }
                ]} 
              />
            </View>
          )}
          {item.type === 'series' && (
            <View style={styles.badgeContainer}>
              <MaterialIcons
                name="tv"
                size={12}
                color={colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.badgeText}>Series</Text>
            </View>
          )}
        </View>
        <Text 
          style={[styles.itemTitle, { color: isDarkMode ? colors.white : colors.black }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {item.lastWatched && (
          <Text style={[styles.lastWatched, { color: isDarkMode ? colors.lightGray : colors.mediumGray }]}>
            {item.lastWatched}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilter = (filterType: 'all' | 'movies' | 'series', label: string, icon: string) => {
    const isActive = filter === filterType;
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          isActive && styles.filterButtonActive,
          { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.border }
        ]}
        onPress={() => setFilter(filterType)}
      >
        <MaterialIcons
          name={icon}
          size={20}
          color={isActive ? colors.primary : (isDarkMode ? colors.lightGray : colors.mediumGray)}
          style={styles.filterIcon}
        />
        <Text
          style={[
            styles.filterText,
            isActive && styles.filterTextActive,
            { color: isDarkMode ? colors.white : colors.black }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.black }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.black}
      />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <View style={styles.filtersContainer}>
        {renderFilter('all', 'All', 'apps')}
        {renderFilter('movies', 'Movies', 'movie')}
        {renderFilter('series', 'TV Shows', 'tv')}
      </View>

      {loading ? (
        <SkeletonLoader />
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name="video-library" 
            size={64} 
            color={isDarkMode ? colors.lightGray : colors.mediumGray}
          />
          <Text style={[
            styles.emptyText,
            { color: isDarkMode ? colors.white : colors.black }
          ]}>
            Your library is empty
          </Text>
          <Text style={[
            styles.emptySubtext,
            { color: isDarkMode ? colors.lightGray : colors.mediumGray }
          ]}>
            Add items to your library by marking them as favorites
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.black,
    gap: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.darkGray,
    backgroundColor: 'transparent',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  filterIcon: {
    marginRight: 2,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    marginBottom: 24,
    marginHorizontal: 8,
  },
  posterContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 2/3,
    marginBottom: 8,
    backgroundColor: colors.darkBackground,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  lastWatched: {
    fontSize: 12,
    lineHeight: 16,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  skeletonContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonTitle: {
    height: 20,
    borderRadius: 4,
    marginTop: 8,
    width: '80%',
  },
});

export default LibraryScreen; 