import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Apple, Croissant, Fish, Milk, Salad, Soup } from 'lucide-react-native';
import { supabase } from '../services/supabase';

const categories = [
  { label: 'Padaria', icon: Croissant, color: '#b83e08' },
  { label: 'Hortifruti', icon: Apple, color: '#2f9b58' },
  { label: 'Restaurante', icon: Soup, color: '#dc7d17' },
  { label: 'Supermercado', icon: Salad, color: '#498d68' },
  { label: 'Laticínios', icon: Milk, color: '#4480a0' },
  { label: 'Mercado', icon: Fish, color: '#8b6f9d' },
];

export default function ExploreScreen({ navigation }) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    supabase.from('donations').select('category').eq('status', 'disponivel').then(({ data }) => {
      const next = {};
      (data || []).forEach(({ category }) => { next[category] = (next[category] || 0) + 1; });
      setCounts(next);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>ENCONTRE PERTO DE VOCÊ</Text>
          <Text style={styles.title}>Explorar doações</Text>
        </View>
        <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>Ao vivo</Text></View>
      </View>
      <Text style={styles.subtitle}>Escolha uma categoria para ver o que a rede está compartilhando.</Text>
      <View style={styles.grid}>
        {categories.map(({ label, icon: Icon, color }) => (
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${counts[label] || 0} doações disponíveis`} accessibilityHint="Abre o mural filtrado por esta categoria" style={styles.categoryCard} onPress={() => navigation.navigate('Home', { categoryFilter: label })}>
            <View style={[styles.categoryIcon, { backgroundColor: `${color}16` }]}><Icon size={22} color={color} /></View>
            <Text style={styles.categoryName}>{label}</Text>
            <View style={styles.cardBottom}><Text style={styles.count}>{counts[label] || 0} disponíveis</Text><ArrowRight size={15} color="#116451" /></View>
          </Pressable>
        ))}
      </View>
      <View style={styles.note}><Text style={styles.noteTitle}>A rede começa com uma escolha</Text><Text style={styles.noteText}>Reserve somente o que consegue retirar dentro do horário combinado com o estabelecimento.</Text></View>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7ffed' },
  screen: { flex: 1, backgroundColor: '#f7ffed' },
  content: { padding: 22, paddingTop: 12, paddingBottom: 36 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrow: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1.3, marginBottom: 6 },
  title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 27 },
  subtitle: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 22 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, backgroundColor: '#e4f4d9', paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#43ad68' },
  liveText: { color: '#26714e', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  categoryCard: { width: '48%', minHeight: 142, backgroundColor: '#fff', borderColor: '#e7efe0', borderWidth: 1, borderRadius: 19, padding: 15 },
  categoryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryName: { color: '#214b3c', fontFamily: 'Roboto_700Bold', fontSize: 14 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  count: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12 },
  note: { marginTop: 25, padding: 17, borderRadius: 18, backgroundColor: '#eaf6df' },
  noteTitle: { color: '#17614c', fontFamily: 'Roboto_700Bold', fontSize: 14 },
  noteText: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, lineHeight: 18, marginTop: 5 },
});
