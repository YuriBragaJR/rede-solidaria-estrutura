import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, CircleHelp, HeartHandshake, LogOut, Settings, UserRound } from 'lucide-react-native';
import { supabase } from '../services/supabase';

export default function ProfileScreen({ navigation, route }) {
  const role = route.params?.role || 'volunteer';
  const [profile, setProfile] = useState(null);
  const [impact, setImpact] = useState({ people: 0, kg: 0, co2: 0, count: 0 });
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const reputationRequest = role === 'merchant'
      ? supabase.rpc('get_donor_reputations', { p_merchant_ids: [user.id] })
      : Promise.resolve({ data: null });
    const [{ data: p }, { data: donations }, { data: reputations }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('donations').select('people_served,estimated_weight_kg').eq('status', 'retirado').eq(role === 'merchant' ? 'merchant_id' : 'reserved_by', user.id),
      reputationRequest,
    ]);
    const totals = (donations || []).reduce((sum, item) => ({ people: sum.people + Number(item.people_served || 0), kg: sum.kg + Number(item.estimated_weight_kg || 0), count: sum.count + 1 }), { people: 0, kg: 0, count: 0 });
    setProfile(p); setEditName(p?.responsible_name || ''); setEditPhone(p?.phone || ''); setImpact({ ...totals, co2: totals.kg * 0.8 }); setReputation(reputations?.[0] || null); setLoading(false);
  }, [role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    } catch (error) {
      setSigningOut(false);
      Alert.alert('Erro ao sair', error.message || 'Não foi possível encerrar sua sessão. Tente novamente.');
    }
  };
  const saveProfile = async () => { const { error } = await supabase.from('profiles').update({ responsible_name: editName.trim(), phone: editPhone.trim() }).eq('id', profile.id); if (error) return Alert.alert('Não foi possível salvar', error.message); setProfile({ ...profile, responsible_name: editName.trim(), phone: editPhone.trim() }); setEditing(false); };
  const name = profile?.responsible_name || profile?.business_name || 'Pessoa da rede';
  const shareImpact = () => Share.share({ message: `${profile?.institution_name || profile?.business_name || name} já salvou ${impact.kg.toFixed(1)} kg de alimentos, estimando ${impact.co2.toFixed(1)} kg de CO₂e evitado, e ajudou a nutrir ${impact.people} pessoas com a rede Nutre Vidas!` });
  return <SafeAreaView style={styles.safeArea} edges={['top']}><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>SUA JORNADA NA REDE</Text><Text style={styles.title}>Perfil</Text>
    {loading ? <ActivityIndicator color="#116451" style={{ margin: 35 }} /> : <>
      <View style={styles.profileCard}><View style={styles.avatar}><UserRound size={26} color="#116451" /></View><View style={{ flex: 1 }}><Text style={styles.name}>{name}</Text><Text style={styles.role}>{role === 'merchant' ? (profile?.business_name || 'Estabelecimento') : (profile?.institution_name || 'Voluntário independente')}</Text><Text style={styles.email}>{profile?.phone || ''}</Text></View></View>
      {editing ? <View style={styles.editCard}><TextInput accessibilityLabel="Nome responsável" style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Nome responsável" /><TextInput accessibilityLabel="Telefone ou WhatsApp" style={styles.editInput} value={editPhone} onChangeText={setEditPhone} placeholder="Telefone / WhatsApp" keyboardType="phone-pad" /><View style={styles.editActions}><Pressable accessibilityRole="button" onPress={() => setEditing(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable accessibilityRole="button" onPress={saveProfile}><Text style={styles.saveText}>Salvar dados</Text></Pressable></View></View> : null}
      <View style={styles.impactCard}><View style={styles.impactTitle}><HeartHandshake size={17} color="#b83e08" /><Text style={styles.impactHeading}>Seu impacto</Text></View><View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{impact.kg.toFixed(1)}</Text><Text style={styles.statLabel}>kg de alimentos salvos</Text></View><View style={styles.stat}><Text style={styles.statValue}>{impact.co2.toFixed(1)}</Text><Text style={styles.statLabel}>kg CO₂e estimados</Text></View><View style={styles.stat}><Text style={styles.statValue}>{impact.people}</Text><Text style={styles.statLabel}>pessoas nutridas</Text></View></View><Text style={styles.impactFootnote}>CO₂e estimado com fator médio de 0,8 kg por kg de alimento salvo. O impacto real varia conforme o alimento.</Text><Text style={styles.impactCount}>{impact.count} distribuições concluídas</Text><Pressable accessibilityRole="button" style={styles.shareButton} onPress={shareImpact}><Text style={styles.shareButtonText}>Compartilhar meu impacto</Text></Pressable></View>
      {role === 'merchant' ? <View style={styles.reputationCard}><Text style={styles.impactHeading}>Reputação do seu estabelecimento</Text><View style={styles.reputationRow}><Text style={styles.reputationScore}>{Number(reputation?.average_rating || 0).toFixed(1)} ★</Text><Text style={styles.reputationMeta}>{reputation?.review_count || 0} avaliações</Text>{reputation?.donor_gold ? <Text style={styles.goldBadge}>Doador Ouro</Text> : null}</View>{reputation?.safety_flags > 0 ? <Text style={styles.safetyFlag}>Atenção: {reputation.safety_flags} avaliação(ões) sinalizaram a segurança de alimentos. Revise os procedimentos de qualidade.</Text> : null}<Text style={styles.impactFootnote}>O selo Ouro é concedido após 5 avaliações e média mínima de 4,7.</Text></View> : null}
      <Text style={styles.menuLabel}>CONTA</Text>
      <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => setEditing((value) => !value)}><UserRound size={18} color="#456d59" /><Text style={styles.menuText}>Editar dados pessoais</Text><ChevronRight size={18} color="#9aac9f" /></Pressable>
      <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => navigation.getParent()?.navigate('Settings')}><Settings size={18} color="#456d59" /><Text style={styles.menuText}>Configurações</Text><ChevronRight size={18} color="#9aac9f" /></Pressable>
      <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => Alert.alert('Ajuda e suporte', 'Fale com a equipe da Rede Solidária pelo canal de atendimento do projeto.')}><CircleHelp size={18} color="#456d59" /><Text style={styles.menuText}>Ajuda e suporte</Text><ChevronRight size={18} color="#9aac9f" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: signingOut }} style={[styles.menuRow, styles.logoutRow]} disabled={signingOut} onPress={logout}><LogOut size={18} color="#bd543c" />{signingOut ? <ActivityIndicator size="small" color="#8e3420" /> : <Text style={styles.logoutText}>Sair da conta</Text>}</Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#f7ffed' }, screen: { flex: 1, backgroundColor: '#f7ffed' }, content: { padding: 22, paddingTop: 12 }, eyebrow: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1.1 }, title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 27, marginTop: 5, marginBottom: 18 }, profileCard: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 18, borderColor: '#e5eee0', borderWidth: 1 }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e8f4df', alignItems: 'center', justifyContent: 'center' }, name: { color: '#244d3d', fontFamily: 'Roboto_700Bold', fontSize: 16 }, role: { color: '#385f4d', fontFamily: 'Roboto_500Medium', fontSize: 12, marginTop: 3 }, email: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 4 }, editCard: { backgroundColor: '#fff', padding: 12, borderRadius: 14, marginTop: 10 }, editInput: { minHeight: 44, borderWidth: 1, borderColor: '#e4ede1', padding: 10, borderRadius: 9, marginBottom: 8, fontFamily: 'Roboto_400Regular' }, editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, padding: 5 }, cancelText: { color: '#52665b', fontFamily: 'Roboto_500Medium' }, saveText: { color: '#116451', fontFamily: 'Roboto_700Bold' }, impactCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 13, borderColor: '#e5eee0', borderWidth: 1 }, impactTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, impactHeading: { color: '#315e4d', fontFamily: 'Roboto_700Bold', fontSize: 13 }, stats: { flexDirection: 'row', marginTop: 15 }, stat: { flex: 1, minWidth: '30%', paddingRight: 4 }, statValue: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 18 }, statLabel: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 3 }, divider: { width: 1, backgroundColor: '#e8efe5', marginHorizontal: 12 }, menuLabel: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 24, marginBottom: 8 }, menuRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, backgroundColor: '#fff', borderBottomColor: '#eff3ed', borderBottomWidth: 1 }, menuText: { flex: 1, color: '#385f4d', fontFamily: 'Roboto_500Medium', fontSize: 13 }, logoutRow: { marginTop: 13, borderRadius: 13, borderBottomWidth: 0 }, logoutText: { flex: 1, color: '#8e3420', fontFamily: 'Roboto_700Bold', fontSize: 13 }, impactFootnote: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 11, lineHeight: 16, marginTop: 10 }, impactCount: { color: '#385f4d', fontFamily: 'Roboto_500Medium', fontSize: 12, marginTop: 5 }, shareButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf6df', borderRadius: 11, marginTop: 12 }, shareButtonText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 13 }, reputationCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 13, borderColor: '#e5eee0', borderWidth: 1 }, reputationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }, reputationScore: { color: '#8c4a08', fontFamily: 'Roboto_700Bold', fontSize: 20 }, reputationMeta: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12 }, goldBadge: { color: '#694400', backgroundColor: '#fff0c2', overflow: 'hidden', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, fontFamily: 'Roboto_700Bold', fontSize: 12 }, safetyFlag: { color: '#8e3420', backgroundColor: '#fff0e9', borderRadius: 10, padding: 10, marginTop: 10, fontFamily: 'Roboto_500Medium', fontSize: 12, lineHeight: 18 } });
