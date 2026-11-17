import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { HeartHandshake, Store, Users, ArrowRight, Sparkles } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.card,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.badge}>
          <Sparkles size={14} color="#15803d" />
          <Text style={styles.badgeText}>ODS 2 & 12 • Combate ao Desperdício</Text>
        </View>

        <View style={styles.iconWrapper}>
          <HeartHandshake size={42} color="#16a34a" />
        </View>

        <Text style={styles.title}>Rede Solidária</Text>
        <Text style={styles.subtitle}>
          Conectando estabelecimentos com excedentes alimentares a ONGs e voluntários em tempo real.
        </Text>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryCardBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MerchantHome')}
          >
            <View style={styles.btnIconBoxPrimary}>
              <Store size={24} color="#ffffff" />
            </View>
            <View style={styles.btnTextContainer}>
              <Text style={styles.btnTitlePrimary}>Sou Comerciante</Text>
              <Text style={styles.btnDescPrimary}>Cadastrar sobras e gerenciar doações</Text>
            </View>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCardBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VolunteerFeed')}
          >
            <View style={styles.btnIconBoxSecondary}>
              <Users size={24} color="#16a34a" />
            </View>
            <View style={styles.btnTextContainer}>
              <Text style={styles.btnTitleSecondary}>Sou ONG / Voluntário</Text>
              <Text style={styles.btnDescSecondary}>Ver mural de alimentos disponíveis e reservar</Text>
            </View>
            <ArrowRight size={20} color="#16a34a" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: '100vh' },
  card: { width: '100%', maxWidth: 460, backgroundColor: '#ffffff', borderRadius: 24, padding: 32, alignItems: 'center', shadowColor: '#14532d', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 20, gap: 6 },
  badgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  iconWrapper: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#dcfce7' },
  title: { fontSize: 30, fontWeight: '800', color: '#14532d', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  actionsContainer: { width: '100%', gap: 14 },
  primaryCardBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16a34a', padding: 18, borderRadius: 16, gap: 14 },
  btnIconBoxPrimary: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  btnTextContainer: { flex: 1 },
  btnTitlePrimary: { fontSize: 17, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  btnDescPrimary: { fontSize: 13, color: '#dcfce7' },
  secondaryCardBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 18, borderRadius: 16, borderWidth: 1.5, borderColor: '#bbf7d0', gap: 14 },
  btnIconBoxSecondary: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  btnTitleSecondary: { fontSize: 17, fontWeight: '700', color: '#14532d', marginBottom: 2 },
  btnDescSecondary: { fontSize: 13, color: '#64748b' },
});