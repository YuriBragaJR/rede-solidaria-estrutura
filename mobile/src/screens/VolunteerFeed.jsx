import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, CheckCircle2, Clock3, MapPin, Package, Search, UsersRound } from 'lucide-react-native';
import { supabase } from '../services/supabase';

const filters = ['Todas', 'Padaria', 'Hortifruti', 'Restaurante', 'Supermercado', 'Laticínios'];
const safeImage = require('../../assets/images/logo.png');

function urgency(deadline) {
  if (!deadline) return 'Combine a retirada';
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return 'Prazo encerrado';
  const hours = Math.floor(remaining / 3600000);
  if (hours < 1) return 'Retire em menos de 1 hora';
  if (hours === 1) return 'Retire em até 1 hora';
  return `Retire em até ${hours} horas`;
}

export default function VolunteerFeed({ navigation, route }) {
  const role = route.params?.role || 'volunteer';
  const [name, setName] = useState('');
  const [donations, setDonations] = useState([]);
  const [reputations, setReputations] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [reservingId, setReservingId] = useState(null);
  const [reservationConfirmation, setReservationConfirmation] = useState(null);
  const [loadError, setLoadError] = useState('');

  const fetchDonations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    await supabase.rpc('release_expired_donations');
    let { data, error } = await supabase
      .from('donations')
      .select('id,title,description,quantity,category,status,created_at,pickup_deadline,photo_url,merchant_id,merchant_name,merchant_neighborhood')
      .eq('status', 'disponivel')
      .order('pickup_deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    // Keep the mural usable if the project database has not received migration 0003 yet.
    if (error && (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200')) {
      const fallback = await supabase.from('donations').select('id,title,description,quantity,category,status,created_at').eq('status', 'disponivel').order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      setLoadError(error.message || 'Verifique sua conexão e tente novamente.');
      setDonations([]);
    } else {
      setDonations(data || []);
      const merchantIds = [...new Set((data || []).map((item) => item.merchant_id).filter(Boolean))];
      if (merchantIds.length) {
        const { data: scores } = await supabase.rpc('get_donor_reputations', { p_merchant_ids: merchantIds });
        setReputations(Object.fromEntries((scores || []).map((score) => [score.merchant_id, score])));
      } else setReputations({});
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let refreshTimer;
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('responsible_name').eq('id', user.id).maybeSingle();
      setName(data?.responsible_name?.split(' ')[0] || user.user_metadata?.responsible_name?.split(' ')[0] || '');
    };
    loadProfile();

    // Keep the mural current while it is open. Debouncing avoids duplicate
    // reads when Supabase emits several changes close together.
    const channel = supabase
      .channel('available-donations-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => fetchDonations({ silent: true }), 250);
      })
      .subscribe();
    fetchDonations();

    return () => {
      clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchDonations]));

  useFocusEffect(useCallback(() => {
    const categoryFilter = route.params?.categoryFilter;
    if (categoryFilter) {
      setCategory(categoryFilter);
      navigation.setParams({ categoryFilter: undefined });
    }
  }, [route.params?.categoryFilter, navigation]));

  const reserve = async (item) => {
    setReservingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Entre na sua conta', 'Faça login para reservar uma doação.');
        return;
      }

      const { data, error } = await supabase.rpc('reserve_donation', { p_donation_id: String(item.id) });
      if (error) {
        Alert.alert('Não foi possível reservar', error.message);
        return;
      }

      const code = Array.isArray(data)
        ? data[0]?.pickup_code
        : data?.pickup_code || (typeof data === 'string' ? data : null);

      // A confirmação aparece assim que a reserva é salva. A atualização da lista
      // fica local para não atrasar o aviso enquanto o mural consulta o servidor.
      setDonations((current) => current.filter((donation) => String(donation.id) !== String(item.id)));
      setReservationConfirmation({ title: item.title, code: code || null });
    } catch (error) {
      Alert.alert('Não foi possível reservar', error?.message || 'Verifique sua conexão e tente novamente.');
    } finally {
      setReservingId(null);
    }
  };

  const visible = donations.filter((item) => {
    const matchesCategory = category === 'Todas' || item.category === category;
    const text = `${item.title || ''} ${item.description || ''} ${item.merchant_name || ''} ${item.merchant_neighborhood || ''}`.toLowerCase();
    return matchesCategory && text.includes(query.trim().toLowerCase());
  });

  const renderDonation = ({ item }) => {
    const expired = item.pickup_deadline && new Date(item.pickup_deadline).getTime() < Date.now();
    return (
      <View style={styles.card}>
        <View style={styles.imageFrame}>
          <Image source={item.photo_url ? { uri: item.photo_url } : safeImage} style={styles.foodImage} resizeMode={item.photo_url ? 'cover' : 'contain'} accessibilityLabel={item.photo_url ? `Foto da doação: ${item.title}` : 'Imagem padrão da Nutre'} />
          <View style={[styles.urgency, expired && styles.urgencyExpired]}><Clock3 size={12} color={expired ? '#9f3b20' : '#a8540b'} /><Text style={[styles.urgencyText, expired && styles.urgencyTextExpired]}>{urgency(item.pickup_deadline)}</Text></View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}><Text style={styles.categoryPill}>{item.category || 'Alimento'}</Text><View style={styles.availableRow}><View style={styles.availableDot} /><Text style={styles.available}> Disponível</Text></View></View>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          <View style={styles.storeRow}><View style={styles.storeIcon}><UsersRound size={14} color="#116451" /></View><Text style={styles.storeName}>{item.merchant_name || 'Parceiro da rede'}</Text></View>
          {reputations[item.merchant_id] ? <View style={styles.reputationRow}><Text style={styles.reputationText}>Nota {Number(reputations[item.merchant_id].average_rating).toFixed(1)}/5 · {reputations[item.merchant_id].review_count} avaliações</Text>{reputations[item.merchant_id].donor_gold ? <Text style={styles.goldBadge}>Doador Ouro</Text> : null}{reputations[item.merchant_id].safety_flags > 0 ? <Text style={styles.safetyFlag}>Alerta de segurança em revisão</Text> : null}</View> : null}
          {item.merchant_neighborhood ? <View style={styles.storeRow}><MapPin size={14} color="#52665b" /><Text style={styles.location}>{item.merchant_neighborhood}</Text></View> : null}
          <View style={styles.cardFooter}>
            <View style={styles.quantity}><Package size={15} color="#3f705b" /><Text style={styles.quantityText}>{item.quantity}</Text></View>
            {role === 'volunteer' ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Reservar doação: ${item.title}, ${item.quantity}`} style={[styles.reserveButton, (expired || reservingId === item.id) && styles.disabledButton]} disabled={!!expired || reservingId === item.id} onPress={() => reserve(item)}>
                {reservingId === item.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.reserveText}>Reservar doação</Text>}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>
      <View style={styles.header}>
        <View><Text style={styles.greeting}>Olá{name ? `, ${name}` : ''}! </Text></View>
        <Pressable style={styles.bellButton} onPress={() => navigation.getParent()?.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Abrir configurações e preferências de notificações" hitSlop={8}><Bell size={20} color="#175844" /></Pressable>
      </View>
      <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>REDE EM TEMPO REAL</Text><Text style={styles.title}>Mural de doações</Text></View></View>
      <View style={styles.searchBox}><Search size={18} color="#52665b" accessibilityElementsHidden importantForAccessibility="no" /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar alimento ou comércio" placeholderTextColor="#52665b" accessibilityLabel="Buscar doações por alimento ou comércio" accessibilityHint="Digite para filtrar as doações exibidas" style={styles.searchInput} returnKeyType="search" /></View>
      <ScrollView
        horizontal
        style={styles.filterCarousel}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      >
        {filters.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === category }} onPress={() => setCategory(item)} style={[styles.filter, item === category && styles.filterActive]}><Text style={[styles.filterText, item === category && styles.filterTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#116451" /></View> : loadError ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>Não foi possível carregar o mural</Text><Text style={styles.emptyText}>{loadError}</Text><Pressable onPress={fetchDonations} style={styles.retryButton}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDonation}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feed}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDonations} tintColor="#116451" />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Ainda não há doações nesta busca</Text><Text style={styles.emptyText}>Tente outra categoria ou volte mais tarde.</Text></View>}
        />
      )}
      </View>
      <Modal
        visible={!!reservationConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setReservationConfirmation(null)}
      >
        <View style={styles.confirmationBackdrop}>
          <View accessibilityViewIsModal style={styles.confirmationCard}>
            <CheckCircle2 size={42} color="#116451" accessibilityElementsHidden importantForAccessibility="no" />
            <Text accessibilityRole="header" style={styles.confirmationTitle}>Reserva confirmada!</Text>
            <Text style={styles.confirmationDescription}>
              {reservationConfirmation?.title ? `Você reservou ${reservationConfirmation.title}. ` : ''}
              Consulte sua coleta na aba Coletas.
            </Text>
            {reservationConfirmation?.code ? (
              <View style={styles.confirmationVoucher}>
                <Text style={styles.confirmationCodeLabel}>CÓDIGO DE RETIRADA</Text>
                <Text selectable accessibilityLabel={`Código de retirada ${reservationConfirmation.code}`} style={styles.confirmationCode}>
                  {reservationConfirmation.code}
                </Text>
              </View>
            ) : (
              <Text style={styles.confirmationCodeHint}>Seu código também ficará disponível nos detalhes da coleta.</Text>
            )}
            <Text style={styles.confirmationHint}>Mostre o código no estabelecimento para confirmar a retirada.</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.confirmationPrimary}
              onPress={() => {
                setReservationConfirmation(null);
                navigation.navigate('Actions');
              }}
            >
              <Text style={styles.confirmationPrimaryText}>Ver minhas coletas</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.confirmationSecondary}
              onPress={() => setReservationConfirmation(null)}
            >
              <Text style={styles.confirmationSecondaryText}>Continuar no mural</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7ffed' },
  screen: { flex: 1, backgroundColor: '#f7ffed', paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 22 },
  greeting: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 22 },
  headerSub: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 13, marginTop: 3 },
  bellButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#e8f4df', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 15 },
  eyebrow: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 24 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, minHeight: 48, borderRadius: 15, backgroundColor: '#fff', paddingHorizontal: 14, borderWidth: 1, borderColor: '#e5ede0' },
  searchInput: { flex: 1, color: '#214b3c', fontFamily: 'Roboto_400Regular', fontSize: 14, paddingVertical: 9 },
  filterList: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterCarousel: { height: 64, flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  filter: { minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5ede0' },
  filterActive: { backgroundColor: '#116451', borderColor: '#116451' },
  filterText: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 12 },
  filterTextActive: { color: '#fff' },
  feed: { paddingHorizontal: 18, paddingBottom: 20, gap: 13 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e7efe2', elevation: 2, shadowColor: '#164d3c', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  imageFrame: { height: 150, backgroundColor: '#eef8e7', alignItems: 'center', justifyContent: 'center' },
  foodImage: { width: '100%', height: '100%' },
  urgency: { position: 'absolute', top: 11, right: 11, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#fff5e8' },
  urgencyExpired: { backgroundColor: '#fff0eb' },
  urgencyText: { color: '#8c4a08', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  urgencyTextExpired: { color: '#9f3b20' },
  cardBody: { padding: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryPill: { color: '#245e42', backgroundColor: '#eaf6df', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, fontFamily: 'Roboto_700Bold', fontSize: 12, overflow: 'hidden' },
  available: { color: '#26714e', fontFamily: 'Roboto_500Medium', fontSize: 12 },
  availableRow: { flexDirection: 'row', alignItems: 'center' },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#39a567' },
  itemTitle: { color: '#203f34', fontFamily: 'Roboto_700Bold', fontSize: 17, marginTop: 11 },
  description: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  storeIcon: { width: 23, height: 23, borderRadius: 8, backgroundColor: '#e9f4e0', alignItems: 'center', justifyContent: 'center' },
  storeName: { color: '#315e4d', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  reputationRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 7 },
  reputationText: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 12 },
  goldBadge: { color: '#694400', backgroundColor: '#fff0c2', overflow: 'hidden', borderRadius: 14, paddingVertical: 3, paddingHorizontal: 8, fontFamily: 'Roboto_700Bold', fontSize: 11 },
  safetyFlag: { color: '#8e3420', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  location: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 11 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#eff3ed', paddingTop: 12, marginTop: 13 },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  quantityText: { color: '#3f705b', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  reserveButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#116451', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15 },
  disabledButton: { backgroundColor: '#9caf9f' },
  reserveText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  empty: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 18, marginTop: 5 },
  emptyTitle: { color: '#315e4d', fontFamily: 'Roboto_700Bold', fontSize: 15, textAlign: 'center' },
  emptyText: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center', marginTop: 5 },
  retryButton: { minHeight: 44, marginTop: 13, borderRadius: 10, backgroundColor: '#116451', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  confirmationBackdrop: { flex: 1, backgroundColor: 'rgba(21, 42, 32, 0.52)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmationCard: { width: '100%', maxWidth: 420, backgroundColor: '#fffefb', borderRadius: 22, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e4efdf' },
  confirmationTitle: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 21, textAlign: 'center', marginTop: 12 },
  confirmationDescription: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  confirmationVoucher: { width: '100%', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#9fc8a7', backgroundColor: '#f5fbf1', borderRadius: 15, padding: 14, marginTop: 18 },
  confirmationCodeLabel: { color: '#385f4d', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1 },
  confirmationCode: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 32, letterSpacing: 5, marginTop: 5 },
  confirmationCodeHint: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 13, textAlign: 'center', marginTop: 18 },
  confirmationHint: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 11 },
  confirmationPrimary: { width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: '#116451', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  confirmationPrimaryText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 15 },
  confirmationSecondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4, paddingHorizontal: 14 },
  confirmationSecondaryText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 14 },
});
