import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

interface Props {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Fade in — logo aparece en tamaño final para coincidir con splash nativo
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // 2. Hold
      Animated.delay(400),
      // 3. Fade out entire splash
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.Image
        source={require('../../assets/vera-logos/vera_logo_transparent.png')}
        style={[styles.logo, { opacity: logoOpacity }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
  },
});
