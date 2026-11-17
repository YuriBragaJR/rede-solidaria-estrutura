import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, HeartHandshake } from 'lucide-react-native';

const logo = require('../../assets/images/logo.png');

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <View style={styles.brand}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandName}>REDE SOLIDÁRIA</Text>
          </View>
          <View style={styles.odsPill}><HeartHandshake size={15} color="#116451" /><Text style={styles.odsText}>ODS 2 &amp; 12</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.hello}>Bem-vindo à</Text>
          <Text style={styles.title}>Rede Solidária</Text>
          <View style={styles.illustrationHalo}>
            <Image source={logo} resizeMode="contain" style={styles.heroLogo} />
          </View>
          <Text style={styles.description}>Conectamos alimentos excedentes a quem precisa. Juntos, combatemos o desperdício e fortalecemos a comunidade.</Text>
        </View>

        <View style={styles.bottom}>
          <Pressable style={styles.button} onPress={() => navigation.navigate('Onboarding')}>
            <Text style={styles.buttonText}>Conheça a rede</Text><ArrowRight size={19} color="#fff" />
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.loginButton} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.loginButtonText}>Fazer login</Text>
          </Pressable>
          <Text style={styles.footer}>Alimento compartilhado. Vidas transformadas.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7ffed' },
  screen: { flex: 1, paddingHorizontal: 26, paddingTop: 12, paddingBottom: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 36, height: 36 },
  brandName: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 12, letterSpacing: 1.2 },
  odsPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e7f5dc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 11 },
  odsText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  illustrationHalo: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#eef9e6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroLogo: { width: 165, height: 165 },
  hello: { color: '#116451', fontFamily: 'Roboto_500Medium', fontSize: 20, marginBottom: 3 },
  title: { color: '#b83e08', fontFamily: 'AnnieUseYourTelescope_400Regular', fontSize: 48, textAlign: 'center', marginBottom: 1 },
  description: { maxWidth: 340, color: '#246b55', fontFamily: 'Roboto_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 13 },
  bottom: { alignItems: 'center', gap: 10 },
  button: { width: '100%', minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 15, backgroundColor: '#116451', elevation: 4 },
  buttonText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 16 },
  loginButton: { width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1.5, borderColor: '#116451', backgroundColor: '#fff9', },
  loginButtonText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 15 },
  footer: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center' },
});
