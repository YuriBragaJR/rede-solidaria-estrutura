import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFonts } from 'expo-font';
import {
  AnnieUseYourTelescope_400Regular,
} from '@expo-google-fonts/annie-use-your-telescope';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import AppNavigator from './src/navigation/AppNavigator';

const logo = require('./assets/images/logo.png');
const AnimatedPath = Animated.createAnimatedComponent(Path);
const loadingPath = 'M 12 42 C 30 5 48 5 66 42 S 102 79 120 42 S 156 5 174 42 S 210 79 228 42 S 264 5 288 42';

function LoadingScreen({ progress }) {
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  return (
    <View style={styles.loadingScreen} accessibilityRole="progressbar" accessibilityLabel="Carregando o aplicativo Nutre">
      <Image source={logo} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel="Logo Nutre" />
      <View style={styles.loadingTrack}>
        <Svg width="100%" height={80} viewBox="0 0 300 84">
          <Path d={loadingPath} fill="none" stroke="#f7d8c0" strokeWidth={8} strokeLinecap="round" />
          <AnimatedPath d={loadingPath} fill="none" stroke="#f26a16" strokeWidth={8} strokeLinecap="round" strokeDasharray="300" strokeDashoffset={dashOffset} />
        </Svg>
      </View>
      <Text style={styles.loadingText}>Preparando o Nutre...</Text>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    AnnieUseYourTelescope_400Regular,
  });
  const [ready, setReady] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!fontsLoaded) {
      const timer = setInterval(() => {
        progress.stopAnimation((value) => {
          if (value < 0.9) Animated.timing(progress, { toValue: Math.min(value + 0.035, 0.9), duration: 160, useNativeDriver: false }).start();
        });
      }, 160);
      return () => clearInterval(timer);
    }

    Animated.timing(progress, { toValue: 1, duration: 420, useNativeDriver: false }).start();
    const wait = Math.max(0, 1100 - (Date.now() - startedAt.current));
    const timer = setTimeout(() => setReady(true), wait + 420);
    return () => clearTimeout(timer);
  }, [fontsLoaded, progress]);

  if (!ready) return <LoadingScreen progress={progress} />;

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7ffed', padding: 28 },
  loadingLogo: { width: 250, height: 270, maxWidth: '80%', marginBottom: 20 },
  loadingTrack: { width: '100%', maxWidth: 300, height: 80 },
  // This screen is rendered while Roboto is still loading, so use the platform font here.
  loadingText: { color: '#315e4d', fontSize: 14, fontWeight: '500', marginTop: 12 },
});
