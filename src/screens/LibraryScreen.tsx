import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles/colors';

// Types
interface LibraryItem {
  id: string;
  name: string;
  poster: string;
  type: 'movie' | 'series';
  progress?: number;
  lastWatched?: string;
}

// Sample data - in a real app, this would come from an API or local storage
const SAMPLE_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'tt0944947',
    name: 'Game of Thrones',
    poster: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
    type: 'series',
    progress: 0.7,
    lastWatched: '2 days ago',
  },
  {
    id: 'tt1375666',
    name: 'Inception',
    poster: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    type: 'movie',
    progress: 0.3,
    lastWatched: '1 week ago',
  },
  {
    id: 'tt0468569',
    name: 'The Dark Knight',
    poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    type: 'movie',
    progress: 1.0,
    lastWatched: '3 weeks ago',
  },
];

const LibraryScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'movies' | 'series'>('all');

  useEffect(() => {
    // Simulate loading library items from storage or API
    const loadLibrary = async () => {
      setLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        setLibraryItems(SAMPLE_LIBRARY_ITEMS);
        setLoading(false);
      }, 1000);
    };

    loadLibrary();
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
          // @ts-ignore - We'll fix navigation types later
          navigation.navigate('Metadata', { id: item.id, type: item.type });
        }}
      >
        <View style={styles.posterContainer}>
          <Image
            source={{ uri: item.poster }}
            style={styles.poster}
            resizeMode="cover"
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
              <Text style={styles.badgeText}>TV</Text>
            </View>
          )}
        </View>
        <Text 
          style={[styles.itemTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.lastWatched && (
          <Text style={styles.lastWatched}>
            {item.lastWatched}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilter = (filterType: 'all' | 'movies' | 'series', label: string) => {
    const isActive = filter === filterType;
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          isActive && { backgroundColor: isDarkMode ? '#444444' : '#E0E0E0' }
        ]}
        onPress={() => setFilter(filterType)}
      >
        <Text
          style={[
            styles.filterText,
            { color: isDarkMode ? '#FFFFFF' : '#000000' },
            isActive && { fontWeight: 'bold' }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#F5F5F5' }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
          Library
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {renderFilter('all', 'All')}
        {renderFilter('movies', 'Movies')}
        {renderFilter('series', 'Series')}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="video-library" size={64} color={isDarkMode ? '#444444' : '#CCCCCC'} />
          <Text style={[styles.emptyText, { color: isDarkMode ? '#AAAAAA' : '#777777' }]}>
            Your library is empty
          </Text>
          <Text style={[styles.emptySubtext, { color: isDarkMode ? '#888888' : '#999999' }]}>
            Add items to your library by marking them as favorites in metadata view
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 14,
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
    borderRadius: 8,
    overflow: 'hidden',
    aspectRatio: 2/3,
    marginBottom: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  lastWatched: {
    fontSize: 12,
    color: '#888888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});

export default LibraryScreen; 