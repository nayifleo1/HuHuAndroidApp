import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles';
import { catalogService, StreamingContent } from '../services/catalogService';
import FastImage from '@d11/react-native-fast-image';

interface Category {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'channel' | 'tv';
}

const CATEGORIES: Category[] = [
  { id: 'movie', name: 'Movies', type: 'movie' },
  { id: 'series', name: 'TV Shows', type: 'series' },
  { id: 'channel', name: 'Channels', type: 'channel' },
  { id: 'tv', name: 'Live TV', type: 'tv' },
];

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const isDarkMode = useColorScheme() === 'dark';
  const [selectedCategory, setSelectedCategory] = useState<Category>(CATEGORIES[0]);
  const [content, setContent] = useState<StreamingContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent(selectedCategory);
  }, [selectedCategory]);

  const loadContent = async (category: Category) => {
    setLoading(true);
    try {
      const catalogs = await catalogService.getCatalogByType(category.type);
      const allContent: StreamingContent[] = [];
      catalogs.forEach(catalog => {
        allContent.push(...catalog.items);
      });
      setContent(allContent);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPress = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleSearchPress = () => {
    // @ts-ignore - We'll fix navigation types later
    navigation.navigate('Search');
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.categoryButton,
          isSelected && { 
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 3,
          }
        ]}
        onPress={() => handleCategoryPress(item)}
      >
        <Text
          style={[
            styles.categoryText,
            isSelected && { color: colors.white, fontWeight: '600' }
          ]}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContentItem = ({ item }: { item: StreamingContent }) => {
    return (
      <TouchableOpacity
        style={styles.contentItem}
        onPress={() => {
          // @ts-ignore - We'll fix navigation types later
          navigation.navigate('Metadata', { id: item.id, type: item.type });
        }}
      >
        <View style={styles.posterContainer}>
          <FastImage
            source={{ uri: item.poster || 'https://via.placeholder.com/300x450' }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
        </View>
        <Text 
          style={[styles.contentTitle, { color: isDarkMode ? colors.white : colors.black }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.year && (
          <Text style={styles.contentYear}>{item.year}</Text>
        )}
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
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? colors.white : colors.black }]}>
            Discover
          </Text>
          <TouchableOpacity onPress={handleSearchPress} style={styles.searchButton}>
            <View style={styles.searchIconContainer}>
              <MaterialIcons name="search" size={24} color={isDarkMode ? colors.white : colors.black} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          renderItem={renderCategory}
          keyExtractor={item => item.id}
          style={styles.categoriesList}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={content}
          renderItem={renderContentItem}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.contentList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const itemWidth = (width - 48) / 3; // 48 = padding and margins

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  searchButton: {
    padding: 8,
  },
  searchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  categoryContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  categoriesList: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 12,
  },
  categoryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: 'transparent',
  },
  categoryText: {
    color: colors.mediumGray,
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentList: {
    padding: 12,
  },
  contentItem: {
    width: itemWidth,
    margin: 6,
  },
  posterContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  poster: {
    aspectRatio: 2/3,
    width: '100%',
  },
  contentTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  contentYear: {
    fontSize: 11,
    color: colors.mediumGray,
  },
});

export default DiscoverScreen; 