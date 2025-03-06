import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Keyboard,
  Dimensions,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles';
import { catalogService, StreamingContent } from '../services/catalogService';
import FastImage from '@d11/react-native-fast-image';
import debounce from 'lodash/debounce';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const POSTER_WIDTH = 90;
const POSTER_HEIGHT = 135;

const PLACEHOLDER_POSTER = 'https://placehold.co/300x450/222222/CCCCCC?text=No+Poster';

type SearchFilter = 'all' | 'movie' | 'series';

const SearchScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StreamingContent[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');

  // Set navigation options to hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Categorize results
  const categorizedResults = useMemo(() => {
    if (!results.length) return [];

    const movieResults = results.filter(item => item.type === 'movie');
    const seriesResults = results.filter(item => item.type === 'series');

    const sections = [];
    
    if (activeFilter === 'all' || activeFilter === 'movie') {
      if (movieResults.length > 0) {
        sections.push({
          title: 'Movies',
          data: movieResults,
        });
      }
    }
    
    if (activeFilter === 'all' || activeFilter === 'series') {
      if (seriesResults.length > 0) {
        sections.push({
          title: 'TV Shows',
          data: seriesResults,
        });
      }
    }

    return sections;
  }, [results, activeFilter]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      try {
        const searchResults = await catalogService.searchContentCinemeta(searchQuery);
        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (query.trim().length >= 2) {
      setSearching(true);
      setSearched(true);
      debouncedSearch(query);
    } else {
      setResults([]);
      setSearched(false);
    }
  }, [query, debouncedSearch]);

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setActiveFilter('all');
  };

  const renderSearchFilters = () => {
    const filters: { id: SearchFilter; label: string; icon: string }[] = [
      { id: 'all', label: 'All', icon: 'apps' },
      { id: 'movie', label: 'Movies', icon: 'movie' },
      { id: 'series', label: 'TV Shows', icon: 'tv' },
    ];

    return (
      <View style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterButton,
              activeFilter === filter.id && styles.filterButtonActive,
              { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.border }
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <MaterialIcons
              name={filter.icon}
              size={20}
              color={activeFilter === filter.id ? colors.primary : (isDarkMode ? colors.lightGray : colors.mediumGray)}
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.id && styles.filterTextActive,
                { color: isDarkMode ? colors.white : colors.black }
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderItem = ({ item, index, section }: { item: StreamingContent; index: number; section: { title: string; data: StreamingContent[] } }) => {
    return (
      <Animated.View
        entering={SlideInRight.delay(index * 50).springify()}
      >
        <TouchableOpacity
          style={[
            styles.resultItem,
            { backgroundColor: isDarkMode ? colors.darkBackground : colors.white }
          ]}
          onPress={() => {
            navigation.navigate('Metadata', { id: item.id, type: item.type });
          }}
        >
          <View style={styles.posterContainer}>
            <FastImage
              source={{ uri: item.poster || PLACEHOLDER_POSTER }}
              style={styles.poster}
              resizeMode={FastImage.resizeMode.cover}
            />
          </View>
          
          <View style={styles.itemDetails}>
            <Text 
              style={[styles.itemTitle, { color: isDarkMode ? colors.white : colors.black }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            
            <View style={styles.metaRow}>
              {item.year && (
                <Text style={[styles.yearText, { color: isDarkMode ? colors.lightGray : colors.mediumGray }]}>
                  {item.year}
                </Text>
              )}
              {item.genres && item.genres.length > 0 && (
                <Text style={[styles.genreText, { color: isDarkMode ? colors.lightGray : colors.mediumGray }]}>
                  {item.genres[0]}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSectionHeader = ({ section: { title, data } }: { section: { title: string; data: StreamingContent[] } }) => (
    <View style={[
      styles.sectionHeader,
      { backgroundColor: isDarkMode ? colors.darkBackground : colors.lightBackground }
    ]}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.white : colors.black }]}>
        {title} ({data.length})
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: colors.black }
    ]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.black}
      />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={[
          styles.searchBar, 
          { 
            backgroundColor: colors.darkGray,
            borderColor: 'transparent',
          }
        ]}>
          <MaterialIcons 
            name="search" 
            size={24} 
            color={colors.lightGray}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.white }
            ]}
            placeholder="Search movies, shows..."
            placeholderTextColor={colors.lightGray}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity 
              onPress={handleClearSearch} 
              style={styles.clearButton}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <MaterialIcons 
                name="close" 
                size={20} 
                color={colors.lightGray}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderSearchFilters()}

      {searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[
            styles.loadingText,
            { color: isDarkMode ? colors.lightGray : colors.mediumGray }
          ]}>
            Searching...
          </Text>
        </View>
      ) : searched && categorizedResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name="search-off" 
            size={64} 
            color={isDarkMode ? colors.lightGray : colors.mediumGray}
          />
          <Text style={[
            styles.emptyText,
            { color: isDarkMode ? colors.white : colors.black }
          ]}>
            No results found
          </Text>
          <Text style={[
            styles.emptySubtext,
            { color: isDarkMode ? colors.lightGray : colors.mediumGray }
          ]}>
            Try different keywords or check your spelling
          </Text>
        </View>
      ) : (
        <SectionList
          sections={categorizedResults}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={true}
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
    paddingTop: 40,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterContainer: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.darkBackground,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearText: {
    fontSize: 14,
  },
  genreText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
});

export default SearchScreen; 