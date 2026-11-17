import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CheckCircle2, ImagePlus, PackagePlus, Sparkles } from 'lucide-react-native';
import { supabase } from '../services/supabase';

const CATEGORIES = ['Padaria', 'Hortifruti', 'Restaurante', 'Supermercado', 'Laticínios'];
const blank = { title: '', description: '', quantity: '', category: 'Padaria', pickupTime: '', weight: '', people: '' };

export default function MerchantHome({ navigation }) {
  const [form, setForm] = useState(blank);
  const [photo, setPhoto] = useState(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const returnToHome = () => {
    setShowSuccess(false);
    navigation.navigate('Home');
  };
  const change = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const pickPhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permissão necessária', 'Permita o acesso às fotos para anexar a imagem da doação.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75 });
      if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    } catch (error) {
      Alert.alert('Não foi possível abrir suas fotos', error.message || 'Tente novamente.');
    }
  };
  const takePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permissão necessária', 'Permita o acesso à câmera para fotografar a doação.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75 });
      if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    } catch (error) {
      Alert.alert('Não foi possível abrir a câmera', error.message || 'Tente novamente.');
    }
  };

  const publish = async () => {
    setNotice(null);
    if (!form.title.trim() || !form.quantity.trim()) return setNotice({ type: 'error', text: 'Informe o alimento e a quantidade para publicar.' });
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Entre novamente na sua conta.');
      const { data: profile, error: profileError } = await supabase.from('profiles').select('business_name,neighborhood').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      let photoUrl = null;
      if (photo?.uri) {
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const path = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('donation-photos').upload(path, blob, { contentType: photo.mimeType || 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from('donation-photos').getPublicUrl(path).data.publicUrl;
      }
      let deadline = null;
      if (form.pickupTime.trim()) {
        const match = form.pickupTime.match(/^(\d{1,2}):(\d{2})$/);
        if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Use o horário no formato HH:MM.');
        const now = new Date();
        deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]));
        if (deadline.getTime() <= now.getTime()) deadline.setDate(deadline.getDate() + 1);
      }
      const { error } = await supabase.from('donations').insert({
        merchant_id: user.id, merchant_name: profile?.business_name || user.user_metadata?.business_name || 'Comércio parceiro',
        merchant_neighborhood: profile?.neighborhood || null, title: form.title.trim(), description: form.description.trim(),
        quantity: form.quantity.trim(), category: form.category, status: 'disponivel', pickup_deadline: deadline?.toISOString() || null,
        photo_url: photoUrl, estimated_weight_kg: Number(form.weight.replace(',', '.')) || 0, people_served: Number(form.people) || 0,
      });
      if (error) throw error;
      setForm(blank); setPhoto(null);
      setNotice(null);
      setShowSuccess(true);
    } catch (error) {
      const migrationIssue = ['42703', 'PGRST204', 'PGRST200'].includes(error.code) || /column .* does not exist|schema cache/i.test(error.message || '');
      setNotice({ type: 'error', text: migrationIssue ? 'O banco ainda não tem os campos necessários. Execute a migration 202611160003_mobile_tabs_donations.sql no SQL Editor do Supabase e tente novamente.' : (error.message || 'Verifique sua conexão e tente novamente.') });
    }
    finally { setLoading(false); }
  };

  return <SafeAreaView style={styles.safeArea} edges={['top']}><ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>COMPARTILHE O QUE PODE ALIMENTAR</Text><Text style={styles.title}>Nova doação</Text><Text style={styles.subtitle}>Cada excedente pode fazer diferença para alguém.</Text>
    {notice ? <View accessibilityRole="alert" style={[styles.notice, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}><Text style={[styles.noticeText, notice.type === 'success' ? styles.noticeSuccessText : styles.noticeErrorText]}>{notice.text}</Text></View> : null}
    <Pressable style={styles.photoBox} onPress={() => setShowPhotoOptions(true)} accessibilityRole="button" accessibilityLabel={photo ? 'Trocar foto da doação' : 'Adicionar foto da doação'} accessibilityHint="Escolha uma foto da galeria ou tire uma nova foto">{photo ? <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Prévia da foto escolhida" /> : <><ImagePlus size={25} color="#116451" accessibilityElementsHidden importantForAccessibility="no" /><Text style={styles.photoTitle}>Adicionar foto</Text><Text style={styles.hint}>Escolha da galeria ou tire uma foto</Text></>}</Pressable>
    <Modal visible={showPhotoOptions} transparent animationType="fade" onRequestClose={() => setShowPhotoOptions(false)}>
      <View style={photoOptionStyles.backdrop}><View accessibilityViewIsModal style={photoOptionStyles.card}>
        <Text style={photoOptionStyles.title}>Adicionar imagem</Text>
        <Text style={photoOptionStyles.description}>Escolha uma imagem existente ou fotografe a doação.</Text>
        <Pressable accessibilityRole="button" style={photoOptionStyles.button} onPress={pickPhoto}><ImagePlus size={19} color="#116451" /><Text style={photoOptionStyles.buttonText}>Escolher da galeria</Text></Pressable>
        <Pressable accessibilityRole="button" style={photoOptionStyles.button} onPress={takePhoto}><Camera size={19} color="#116451" /><Text style={photoOptionStyles.buttonText}>Tirar uma foto</Text></Pressable>
        <Pressable accessibilityRole="button" style={photoOptionStyles.cancel} onPress={() => setShowPhotoOptions(false)}><Text style={photoOptionStyles.cancelText}>Cancelar</Text></Pressable>
      </View></View>
    </Modal>
    <Text style={styles.label}>Categoria</Text><View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Categoria da doação">{CATEGORIES.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: form.category === item }} onPress={() => change('category')(item)} style={[styles.chip, form.category === item && styles.chipActive]}><Text style={[styles.chipText, form.category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <Text style={styles.label}>O que será doado?</Text><TextInput accessibilityLabel="Nome do alimento" style={styles.input} placeholder="Ex.: pães e bolos do dia" value={form.title} onChangeText={change('title')} />
    <Text style={styles.label}>Quantidade</Text><TextInput accessibilityLabel="Quantidade da doação" style={styles.input} placeholder="Ex.: 30 unidades" value={form.quantity} onChangeText={change('quantity')} />
    <Text style={styles.label}>Descrição (opcional)</Text><TextInput accessibilityLabel="Descrição da doação, opcional" style={[styles.input, styles.multiline]} multiline value={form.description} onChangeText={change('description')} placeholder="Conservação, ingredientes ou observações" />
    <Text style={styles.label}>Retirada até (opcional)</Text><TextInput accessibilityLabel="Horário limite para retirada, opcional" style={styles.input} placeholder="HH:MM, por exemplo 19:00" value={form.pickupTime} onChangeText={change('pickupTime')} keyboardType="numbers-and-punctuation" />
    <View style={styles.twoCols}><View style={styles.col}><Text style={styles.label}>Peso estimado (kg)</Text><TextInput accessibilityLabel="Peso estimado em quilogramas, opcional" style={styles.input} placeholder="0" value={form.weight} onChangeText={change('weight')} keyboardType="decimal-pad" /></View><View style={styles.col}><Text style={styles.label}>Pessoas atendidas</Text><TextInput accessibilityLabel="Número estimado de pessoas atendidas, opcional" style={styles.input} placeholder="0" value={form.people} onChangeText={change('people')} keyboardType="number-pad" /></View></View>
    <Pressable style={styles.submit} disabled={loading} onPress={publish}>{loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.submitText}>Disponibilizar na rede</Text></>}</Pressable>
    <View style={styles.note}><PackagePlus size={15} color="#52665b" /><Text style={styles.noteText}>O endereço cadastrado no perfil será usado para orientar a retirada.</Text></View>
    <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={returnToHome}>
      <View style={styles.successBackdrop}><View accessibilityViewIsModal style={styles.successCard}>
        <View style={styles.successIcon}><CheckCircle2 size={34} color="#fff" /></View>
        <Text accessibilityRole="header" style={styles.successTitle}>Doação cadastrada!</Text>
        <Text style={styles.successText}>Ela já está disponível no mural para ONGs e pessoas voluntárias.</Text>
        <Pressable accessibilityRole="button" style={styles.successButton} onPress={returnToHome}><Text style={styles.successButtonText}>Voltar ao início</Text></Pressable>
      </View></View>
    </Modal>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#f7ffed' }, screen: { flex: 1, backgroundColor: '#f7ffed' }, content: { padding: 22, paddingTop: 12, paddingBottom: 36 }, eyebrow: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1.1 }, title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 27, marginTop: 5 }, subtitle: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 5, marginBottom: 18 }, notice: { borderRadius: 12, padding: 12, marginBottom: 13, borderWidth: 1 }, noticeSuccess: { backgroundColor: '#e8f5e7', borderColor: '#b8dabb' }, noticeError: { backgroundColor: '#fff0e9', borderColor: '#f1c5b3' }, noticeText: { fontFamily: 'Roboto_500Medium', fontSize: 12, lineHeight: 18 }, noticeSuccessText: { color: '#246946' }, noticeErrorText: { color: '#a44125' }, photoBox: { minHeight: 145, borderRadius: 17, backgroundColor: '#eaf5e3', borderWidth: 1, borderColor: '#d9e9d2', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 15, overflow: 'hidden' }, photo: { width: '100%', height: 145 }, photoTitle: { color: '#286d4e', fontFamily: 'Roboto_700Bold', fontSize: 14, marginTop: 7 }, hint: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 4 }, label: { color: '#315e4d', fontFamily: 'Roboto_700Bold', fontSize: 13, marginBottom: 7, marginTop: 7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 8 }, chip: { minHeight: 44, justifyContent: 'center', backgroundColor: '#fff', borderColor: '#e1ecdd', borderWidth: 1, borderRadius: 22, paddingVertical: 8, paddingHorizontal: 14 }, chipActive: { backgroundColor: '#116451', borderColor: '#116451' }, chipText: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 12 }, chipTextActive: { color: '#fff' }, input: { minHeight: 48, backgroundColor: '#fff', borderRadius: 12, borderColor: '#e4ede1', borderWidth: 1, padding: 12, color: '#214b3c', fontFamily: 'Roboto_400Regular', fontSize: 15, marginBottom: 8 }, multiline: { minHeight: 88, textAlignVertical: 'top' }, twoCols: { flexDirection: 'row', gap: 10 }, col: { flex: 1 }, submit: { minHeight: 48, backgroundColor: '#b83e08', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 }, submitText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 14 }, note: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 13 }, noteText: { flex: 1, color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, lineHeight: 18 }, successBackdrop: { flex: 1, backgroundColor: 'rgba(15, 35, 27, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }, successCard: { width: '100%', maxWidth: 380, alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 26 }, successIcon: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#267747', marginBottom: 16 }, successTitle: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 22, textAlign: 'center' }, successText: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 }, successButton: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: '#116451', borderRadius: 13, marginTop: 22 }, successButtonText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 15 } });

const photoOptionStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 35, 27, 0.55)', justifyContent: 'flex-end', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 10 },
  title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 19 },
  description: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 12 },
  button: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#eff3ed' },
  buttonText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 14 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14 },
  cancelText: { color: '#52665b', fontFamily: 'Roboto_700Bold', fontSize: 14 },
});
