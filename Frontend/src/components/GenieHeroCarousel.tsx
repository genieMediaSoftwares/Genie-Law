import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useScreenFocus } from '../hooks/useScreenFocused';
import i18n from '../i18n';

import banner1 from '../assets/images/banner1.png';
import banner2 from '../assets/images/banner2.png';
import banner3 from '../assets/images/banner3.png';

export interface CarouselSlide {
  id: string;
  // A bundled image (require/import): a number on native, a URL on web.
  source: any;
  actionType?: 'advocates' | 'ai' | 'cases' | 'documents';
  title?: string;
  // Translated title (home:hero.*); preferred over `title`.
  titleKey?: 'home:hero.slide1' | 'home:hero.slide2' | 'home:hero.slide3';
}

const resolveSlideSource = (slide: CarouselSlide): ImageSourcePropType | null => {
  if (slide.source) {
    if (typeof slide.source === 'number') {
      return slide.source;
    }
    if (typeof slide.source === 'string') {
      return { uri: slide.source };
    }
    if (
      slide.source &&
      typeof slide.source === 'object' &&
      'default' in slide.source &&
      typeof (slide.source as { default: unknown }).default === 'string'
    ) {
      return { uri: (slide.source as { default: string }).default };
    }
    if (
      slide.source &&
      typeof slide.source === 'object' &&
      'uri' in slide.source
    ) {
      return slide.source as ImageSourcePropType;
    }
  }

  return null;
};

export const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    id: '1',
    source: banner1,
    actionType: 'ai',
    titleKey: 'home:hero.slide1',
  },
  {
    id: '2',
    source: banner2,
    actionType: 'advocates',
    titleKey: 'home:hero.slide2',
  },
  {
    id: '3',
    source: banner3,
    actionType: 'ai',
    titleKey: 'home:hero.slide3',
  },
];

export const GenieHeroCarousel: React.FC<{
  slides?: CarouselSlide[];
  onSlidePress?: (slide: CarouselSlide) => void;
}> = ({ slides = DEFAULT_SLIDES, onSlidePress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { focusedRef } = useScreenFocus();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - 32,
  );

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      // Home stays mounted as the first tab; don't auto-advance (setState +
      // native scroll) while another screen is showing.
      if (!focusedRef.current) {
        return;
      }
      setActiveIndex(prev => {
        const nextIndex = (prev + 1) % slides.length;
        scrollViewRef.current?.scrollTo({
          x: nextIndex * containerWidth,
          animated: true,
        });
        return nextIndex;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length, containerWidth, focusedRef]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (containerWidth || 1));
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View
      className="my-3"
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {slides.map(slide => {
          const imageSrc = resolveSlideSource(slide);

          return (
            <View
              key={slide.id}
              style={{ width: containerWidth }}
              className="px-0.5"
            >
              <Pressable
                onPress={() => onSlidePress?.(slide)}
                accessibilityRole="button"
                accessibilityLabel={
                  slide.titleKey
                    ? i18n.t(slide.titleKey)
                    : slide.title || i18n.t('home:hero.slideA11y', { id: slide.id })
                }
                className="h-[180px] w-full overflow-hidden rounded-[12px] border border-border bg-card active:opacity-90"
              >
                {imageSrc ? (
                  <Image
                    source={imageSrc}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View className="mt-2.5 flex-row items-center justify-center gap-1.5">
        {slides.map((slide, idx) => (
          <View
            key={slide.id}
            className={`h-1.5 rounded-pill ${
              idx === activeIndex ? 'w-6 bg-gold' : 'w-1.5 bg-border'
            }`}
          />
        ))}
      </View>
    </View>
  );
};
