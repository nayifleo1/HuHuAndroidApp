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
import Animated, { FadeIn, FadeOut, SlideInRight, Layout } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

interface Category {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'channel' | 'tv';
  icon: string;
}

const CATEGORIES: Category[] = [
  { id: 'movie', name: 'Movies', type: 'movie', icon: 'movie' },
  { id: 'series', name: 'TV Shows', type: 'series', icon: 'tv' }
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
      setContent([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPress = (category: Category) => {
    if (category.id !== selectedCategory.id) {
      setSelectedCategory(category);
    }
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
            transform: [{ scale: 1.05 }],
          }
        ]}
        onPress={() => handleCategoryPress(item)}
      >
        <MaterialIcons 
          name={item.icon} 
          size={24} 
          color={isSelected ? colors.white : colors.mediumGray} 
          style={styles.categoryIcon}
        />
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

  const renderContentItem = ({ item, index }: { item: StreamingContent; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.contentItem}
        onPress={() => {
          navigation.navigate('Metadata', { id: item.id, type: item.type });
        }}
      >
        <View style={styles.posterContainer}>
          <FastImage
            source={{ uri: item.poster || 'https://via.placeholder.com/300x450' }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.posterGradient}
          >
            <Text style={styles.contentTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {item.year && (
              <Text style={styles.contentYear}>{item.year}</Text>
            )}
          </LinearGradient>
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
      
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? colors.white : colors.black }]}>
              Discover
            </Text>
            <TouchableOpacity 
              onPress={handleSearchPress} 
              style={styles.searchButton}
            >
              <View style={[
                styles.searchIconContainer,
                { backgroundColor: isDarkMode ? colors.transparentLight : 'rgba(0,0,0,0.05)' }
              ]}>
                <MaterialIcons 
                  name="search" 
                  size={24} 
                  color={isDarkMode ? colors.white : colors.black} 
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.categoryContainer}>
          <View style={styles.categoriesContent}>
            {CATEGORIES.map((category) => (
              <View key={category.id}>
                {renderCategory({ item: category })}
              </View>
            ))}
          </View>
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
            numColumns={2}
            contentContainerStyle={styles.contentList}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.contentRow}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const itemWidth = (width - 40) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchButton: {
    padding: 8,
  },
  searchIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  categoriesContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryText: {
    color: colors.mediumGray,
    fontWeight: '500',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentList: {
    padding: 12,
  },
  contentRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  contentItem: {
    width: itemWidth,
    marginVertical: 8,
  },
  posterContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.transparentLight,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  poster: {
    aspectRatio: 2/3,
    width: '100%',
  },
  posterGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    justifyContent: 'flex-end',
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  contentYear: {
    fontSize: 12,
    color: colors.textDark,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default DiscoverScreen; 