import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles';
import { catalogService, StreamingContent } from '../services/catalogService';
import FastImage from '@d11/react-native-fast-image';
import debounce from 'lodash/debounce';

const { width } = Dimensions.get('window');

const PLACEHOLDER_POSTER = 'https://placehold.co/300x450/222222/CCCCCC?text=No+Poster';

const SearchScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StreamingContent[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

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
  };

  const renderItem = ({ item }: { item: StreamingContent }) => {
    return (
      <TouchableOpacity
        style={[
          styles.resultItem,
          { backgroundColor: isDarkMode ? colors.darkBackground : colors.white }
        ]}
        onPress={() => {
          // @ts-ignore - We'll fix navigation types later
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
            <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.typeText}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? colors.darkBackground : colors.lightBackground }
    ]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? colors.darkBackground : colors.lightBackground}
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color={isDarkMode ? colors.white : colors.black}
          />
        </TouchableOpacity>

        <View style={[
          styles.searchBar, 
          { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.white,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.border,
          }
        ]}>
          <MaterialIcons 
            name="search" 
            size={24} 
            color={isDarkMode ? colors.lightGray : colors.mediumGray}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDarkMode ? colors.white : colors.black }
            ]}
            placeholder="Search movies, shows, channels..."
            placeholderTextColor={isDarkMode ? colors.lightGray : colors.mediumGray}
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
                color={isDarkMode ? colors.lightGray : colors.mediumGray}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
      ) : searched && results.length === 0 ? (
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
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={results.length > 0 ? (
            <Text style={[
              styles.resultsCount,
              { color: isDarkMode ? colors.lightGray : colors.mediumGray }
            ]}>
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </Text>
          ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  resultsList: {
    padding: 16,
  },
  resultsCount: {
    fontSize: 14,
    marginBottom: 16,
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
    width: 90,
    height: 135,
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
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
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