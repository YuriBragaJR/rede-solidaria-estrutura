import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import Illustration from '../components/Illustrations';

const slides = [
  { kind: 'merchant', title: 'Salve alimentos', body: 'Cadastre o excedente de produção do seu estabelecimento em poucos toques. Evite o descarte de alimentos próprios para consumo.' },
  { kind: 'basket', title: 'Rede em tempo real', body: 'As doações aparecem no mural para ONGs e voluntários da região encontrarem e reservarem.' },
  { kind: 'volunteer', title: 'Nutra vidas', body: 'O voluntário retira a doação no comércio e leva a quem precisa. Assim, o alimento cumpre seu melhor destino.' },
];
const reducedMotionPreference = () => Platform.OS === 'web'
  ? typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : AccessibilityInfo.isReduceMotionEnabled();

export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(24)).current;
  const transitioning = useRef(false);
  const slide = slides[index];

  useEffect(() => {
    Promise.resolve(reducedMotionPreference()).then((enabled) => {
      setReduceMotion(enabled);
      if (enabled) {
        translateX.setValue(0);
        if (Platform.OS === 'web') {
          Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
        } else {
          opacity.setValue(1);
        }
        return;
      }
      if (Platform.OS !== 'web') {
        opacity.setValue(1);
        translateX.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }).catch(() => { opacity.setValue(1); translateX.setValue(0); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const changeSlide = (nextIndex) => {
    if (transitioning.current) return;
    if (reduceMotion) {
      transitioning.current = true;
      Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
        setIndex(nextIndex);
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start(() => { transitioning.current = false; });
      });
      return;
    }
    transitioning.current = true;
    const direction = nextIndex > index ? 1 : -1;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -direction * 28, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setIndex(nextIndex);
      translateX.setValue(direction * 28);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => { transitioning.current = false; });
    });
  };

  const next = () => index < slides.length - 1
    ? changeSlide(index + 1)
    : navigation.replace('Auth');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a etapa anterior" onPress={() => index > 0 ? changeSlide(index - 1) : navigation.goBack()} style={styles.back}>
            <ArrowLeft size={19} color="#116451" /><Text style={styles.backText}>Voltar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Pular apresentação e abrir login ou cadastro" onPress={() => navigation.replace('Auth')} style={styles.skipButton}><Text style={styles.skip}>Pular</Text></Pressable>
        </View>
        <Animated.View style={[styles.transitionContent, { opacity, transform: [{ translateX }] }]}>
          <View style={styles.artArea} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Illustration kind={slide.kind} size={270} /></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        </Animated.View>
        <View style={styles.bottom}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{slides.map((item, dot) => <View key={item.title} style={[styles.dot, dot === index && styles.dotActive]} />)}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={index === slides.length - 1 ? 'Começar e abrir login ou cadastro' : `Continuar para a etapa ${index + 2}`} style={styles.button} onPress={next}>
            <Text style={styles.buttonText}>{index === slides.length - 1 ? 'Começar agora' : 'Continuar'}</Text>
            <ArrowRight size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7ffed' },
  screen: { flex: 1, paddingHorizontal: 24, paddingTop: 5, paddingBottom: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingRight: 12 },
  backText: { color: '#116451', fontFamily: 'Roboto_500Medium', fontSize: 13 },
  skip: { color: '#648778', fontFamily: 'Roboto_500Medium', fontSize: 13, padding: 10 },
  skipButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 12, marginBottom: 5 },
  transitionContent: { flex: 1 },
  artArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 260 },
  copy: { alignItems: 'center', paddingHorizontal: 4, marginBottom: 26 },
  title: { color: '#b83e08', fontFamily: 'AnnieUseYourTelescope_400Regular', fontSize: 38, textAlign: 'center', marginBottom: 7 },
  body: { maxWidth: 360, color: '#246b55', fontFamily: 'Roboto_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  bottom: { gap: 19 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#b9df9c' },
  dotActive: { width: 23, backgroundColor: '#116451' },
  button: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, backgroundColor: '#116451' },
  buttonText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 15 },
});
