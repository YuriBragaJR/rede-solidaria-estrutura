import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpRight, CheckCircle2, Clock3, MapPin, Package, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../services/supabase';

export default function ActionsScreen({ route, navigation }) {
  const role = route.params?.role || 'volunteer';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pickupCode, setPickupCode] = useState('');
  const [stage, setStage] = useState('reservadas');
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewAnswers, setReviewAnswers] = useState({ quantity: true, safe: true, packed: true, cordial: true });
  const [reviewComment, setReviewComment] = useState('');
  const [distributionItem, setDistributionItem] = useState(null);
  const [distributionNote, setDistributionNote] = useState('');
  const [distributionPeople, setDistributionPeople] = useState('');
  const [distributionPhoto, setDistributionPhoto] = useState(null);
  const [promptedReviewIds] = useState(() => new Set());
  const userIdRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setItems([]); setLoading(false); return; }
    userIdRef.current = user.id;
    if (role === 'merchant') {
      const { data, error } = await supabase.from('donations').select('*').eq('merchant_id', user.id).order('created_at', { ascending: false });
      if (error) Alert.alert('Não foi possível carregar suas doações', error.message);
      const loadedItems = data || [];
      setItems(loadedItems);
    } else {
      const { data, error } = await supabase.rpc('get_my_reserved_donations');
      if (error) Alert.alert('Não foi possível carregar suas reservas', error.message);
      const loadedItems = data || [];
      setItems(loadedItems);
      const requestedId = route.params?.reviewDonationId;
      const pendingReview = loadedItems.find((item) => String(item.donation_id) === String(requestedId) && item.status === 'em_rota' && !item.has_review && !promptedReviewIds.has(String(item.donation_id)))
        || loadedItems.find((item) => item.status === 'em_rota' && !item.has_review && !promptedReviewIds.has(String(item.donation_id)));
      if (pendingReview) {
        promptedReviewIds.add(String(pendingReview.donation_id));
        setStage('reservadas');
        setReviewItem(pendingReview);
      }
    }
    setLoading(false);
  }, [promptedReviewIds, role, route.params?.reviewDonationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!route.params?.reviewRequestedAt) return undefined;
    setStage('reservadas');
    const timer = setTimeout(load, 700);
    navigation.setParams({ reviewDonationId: undefined, reviewRequestedAt: undefined });
    return () => clearTimeout(timer);
  }, [load, navigation, route.params?.reviewRequestedAt]);

  const confirmCollection = async () => {
    const code = pickupCode.trim().toUpperCase();
    if (code.length < 6) return Alert.alert('Código incompleto', 'Digite o código de retirada informado pela pessoa voluntária.');
    setUpdatingId(selectedItem?.id || selectedItem?.donation_id);
    const { data, error } = await supabase.rpc('confirm_pickup_code', { p_code: code });
    setUpdatingId(null);
    if (error) return Alert.alert('Não foi possível confirmar a retirada', error.message);
    setSelectedItem(null); setPickupCode('');
    await load();
    Alert.alert('Retirada confirmada', `A doação “${data || 'alimento'}” está em rota para distribuição.`);
  };

  const submitReview = async () => {
    if (!reviewItem) return;
    setUpdatingId('review');
    const { error } = await supabase.rpc('submit_donation_review', {
      p_donation_id: String(reviewItem.donation_id),
      p_quality_score: reviewScore,
      p_quantity_matched: reviewAnswers.quantity,
      p_food_safe: reviewAnswers.safe,
      p_packaging_ok: reviewAnswers.packed,
      p_service_cordial: reviewAnswers.cordial,
      p_comment: reviewComment.trim() || null,
    });
    setUpdatingId(null);
    if (error) return Alert.alert('Não foi possível enviar a avaliação', error.message);
    const needsReview = !reviewAnswers.safe;
    setReviewItem(null); setReviewComment('');
    await load();
    Alert.alert(needsReview ? 'Sinalização enviada' : 'Obrigado pela avaliação', needsReview ? 'A equipe Nutre recebeu o alerta de segurança para analisar o caso.' : 'Sua avaliação ajuda a rede a doar alimentos com mais qualidade.');
  };

  const chooseDistributionPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permissão necessária', 'Permita o acesso às fotos para anexar o registro da distribuição.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75 });
      if (!result.canceled && result.assets?.[0]) setDistributionPhoto(result.assets[0]);
    } catch (error) {
      Alert.alert('Não foi possível abrir suas fotos', error.message || 'Tente novamente.');
    }
  };

  const submitDistribution = async () => {
    if (!distributionItem) return;
    setUpdatingId('distribution');
    try {
      let photoUrl = null;
      if (distributionPhoto?.uri) {
        const response = await fetch(distributionPhoto.uri);
        const blob = await response.blob();
        const path = `${userIdRef.current}/distribution-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('donation-photos').upload(path, blob, { contentType: distributionPhoto.mimeType || 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from('donation-photos').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.rpc('complete_donation_distribution', {
        p_donation_id: String(distributionItem.donation_id),
        p_note: distributionNote.trim() || null,
        p_photo_url: photoUrl,
        p_people_served: distributionPeople ? Math.max(0, Number.parseInt(distributionPeople, 10) || 0) : null,
      });
      if (error) throw error;
      setDistributionItem(null); setDistributionNote(''); setDistributionPeople(''); setDistributionPhoto(null);
      setStage('historico');
      await load();
      Alert.alert('Distribuição concluída', 'O registro foi salvo no seu histórico de impacto.');
    } catch (error) {
      Alert.alert('Não foi possível concluir a distribuição', error.message || 'Tente novamente.');
    } finally { setUpdatingId(null); }
  };

  const shareHistory = async () => {
    const completed = items.filter((item) => item.status === 'retirado');
    if (!completed.length) return Alert.alert('Histórico vazio', 'As distribuições concluídas aparecerão aqui.');
    const columns = [['completed_at', 'Concluída em'], ['business_name', 'Estabelecimento'], ['title', 'Doação'], ['quantity', 'Quantidade'], ['estimated_weight_kg', 'Peso estimado kg'], ['distribution_note', 'Relato']];
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = ['\ufeff' + columns.map(([, label]) => quote(label)).join(';'), ...completed.map((item) => columns.map(([key]) => quote(key === 'completed_at' && item[key] ? new Date(item[key]).toLocaleDateString('pt-BR') : item[key])).join(';'))].join('\r\n');
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.href = fileUrl;
      link.download = `nutre-historico-coletas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } else {
      const fileUri = `${FileSystem.cacheDirectory}nutre-historico-coletas-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exportar histórico de coletas' });
      } else {
        await Share.share({ title: 'Histórico de coletas Nutre', message: csv });
      }
    }
  };

  const openMap = (item) => {
    const address = [item.street, item.street_number, item.complement, item.neighborhood, item.cep].filter(Boolean).join(', ');
    if (!address) return Alert.alert('Endereço indisponível', 'Entre em contato com o estabelecimento para combinar a retirada.');
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
  };

  const contactMerchant = (item) => {
    const digits = String(item.merchant_phone || '').replace(/\D/g, '');
    if (!digits) return Alert.alert('WhatsApp indisponível', 'O estabelecimento não cadastrou um telefone para contato.');
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const message = `Olá, sou voluntário(a) do Nutre e estou a caminho para retirar ${item.title}. Meu código de retirada é ${item.pickup_code}. Aviso por aqui se houver atraso.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
  };

  const renderItem = ({ item }) => {
    const completed = item.status === 'retirado';
    const reserved = item.status === 'reservado';
    const inRoute = item.status === 'em_rota';
    const storeName = item.merchant_name || item.business_name || 'Seu estabelecimento';
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={[styles.iconBox, completed && styles.iconDone]}>{completed ? <CheckCircle2 size={19} color="#267747" /> : <Package size={19} color="#116451" />}</View>
          <View style={styles.titleGroup}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.quantity}>{item.quantity}</Text></View>
          <View style={[styles.status, completed ? styles.statusDone : inRoute ? styles.statusRoute : reserved ? styles.statusReserved : styles.statusAvailable]}><Text style={styles.statusText}>{completed ? 'Distribuída' : inRoute ? 'Em rota' : reserved ? 'Reservada' : 'Disponível'}</Text></View>
        </View>
        {role === 'volunteer' ? (
          <>
            <Text style={styles.storeName}>{storeName}</Text>
            <View style={styles.address}><MapPin size={14} color="#52665b" /><Text style={styles.addressText}>{[item.street, item.street_number, item.complement, item.neighborhood, item.cep].filter(Boolean).join(', ') || 'Endereço combinado com o parceiro'}</Text></View>
          </>
        ) : (
          <Text style={styles.storeName}>{reserved ? 'Aguardando retirada no estabelecimento.' : inRoute ? 'Retirada confirmada. A doação está com a ONG ou pessoa voluntária.' : completed ? 'Distribuição concluída. Obrigado por fortalecer a rede.' : 'Disponível para retirada no mural.'}</Text>
        )}
        {item.estimated_weight_kg ? <Text style={styles.weight}>Peso estimado: {Number(item.estimated_weight_kg).toLocaleString('pt-BR')} kg</Text> : null}
        {item.pickup_deadline ? <View style={styles.deadline}><Clock3 size={14} color="#8c4a08" /><Text style={styles.deadlineText}>Retirar até {new Date(item.pickup_deadline).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View> : item.pickup_hours ? <View style={styles.deadline}><Clock3 size={14} color="#8c4a08" /><Text style={styles.deadlineText}>Horário padrão: {item.pickup_hours}</Text></View> : null}
        {role === 'volunteer' && reserved && !completed ? <View style={styles.voucher}><Text style={styles.voucherLabel}>CÓDIGO DE RETIRADA</Text><Text selectable style={styles.voucherCode}>{item.pickup_code || 'Indisponível'}</Text><Text style={styles.voucherHint}>Mostre este código no estabelecimento para confirmar a coleta.</Text></View> : null}
        {role === 'volunteer' && reserved && !completed ? (
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Abrir GPS para retirar ${item.title}`} style={styles.secondaryButton} onPress={() => openMap(item)}><ArrowUpRight size={15} color="#116451" /><Text style={styles.secondaryText}>Abrir no GPS</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Avisar atraso ou falar com ${storeName} pelo WhatsApp`} style={styles.secondaryButton} onPress={() => contactMerchant(item)}><Text style={styles.secondaryText}>Avisar atraso / falar com a loja</Text></Pressable>
          </View>
        ) : null}
        {role === 'volunteer' && inRoute ? <View style={styles.actions}>
          {!item.has_review ? <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => { setReviewItem(item); setReviewScore(5); setReviewAnswers({ quantity: true, safe: true, packed: true, cordial: true }); setReviewComment(''); }}><Text style={styles.secondaryText}>Avaliar o doador</Text></Pressable> : <Text style={styles.reviewSaved}>Avaliação enviada</Text>}
          <Pressable accessibilityRole="button" style={styles.completeButton} onPress={() => { setDistributionItem(item); setDistributionNote(''); setDistributionPeople(''); setDistributionPhoto(null); }}><Text style={styles.completeText}>Distribuição concluída</Text></Pressable>
        </View> : null}
        {role === 'volunteer' && completed && !item.has_review ? <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => { setReviewItem(item); setReviewScore(5); setReviewAnswers({ quantity: true, safe: true, packed: true, cordial: true }); setReviewComment(''); }}><Text style={styles.secondaryText}>Avaliar doador</Text></Pressable> : null}
        {role === 'volunteer' && completed && item.distribution_note ? <View style={styles.distributionReport}><Text style={styles.voucherLabel}>RELATO DA DISTRIBUIÇÃO</Text><Text style={styles.reportText}>{item.distribution_note}</Text></View> : null}
        {role === 'volunteer' && completed && item.distribution_photo_url ? <Image source={{ uri: item.distribution_photo_url }} accessibilityLabel={`Foto da distribuição de ${item.title}`} style={styles.distributionPhoto} resizeMode="cover" /> : null}
        {role === 'merchant' && reserved ? <Pressable accessibilityRole="button" accessibilityLabel={`Validar código da retirada de ${item.title}`} style={styles.completeButton} onPress={() => { setSelectedItem(item); setPickupCode(''); }}><Text style={styles.completeText}>Confirmar entrega</Text></Pressable> : null}
      </View>
    );
  };

  const visibleItems = role === 'merchant' ? items : items.filter((item) => (
    stage === 'reservadas' ? ['reservado', 'em_rota'].includes(item.status) : item.status === 'retirado'
  ));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.heading}><Text style={styles.eyebrow}>{role === 'merchant' ? 'ACOMPANHE SUAS PUBLICAÇÕES' : 'SUAS COLETAS'}</Text><Text style={styles.title}>{role === 'merchant' ? 'Minhas doações' : 'Minhas coletas'}</Text><Text style={styles.subtitle}>{role === 'merchant' ? 'Veja o que está aguardando retirada e o que já foi concluído.' : 'Acompanhe suas reservas e consulte o histórico de distribuições.'}</Text></View>
      {role === 'volunteer' ? <View style={styles.stages}>{[['reservadas', 'Reservadas'], ['historico', 'Histórico']].map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: stage === key }} onPress={() => setStage(key)} style={[styles.stageButton, stage === key && styles.stageButtonActive]}><Text style={[styles.stageText, stage === key && styles.stageTextActive]}>{label}</Text></Pressable>)}</View> : null}
      {role === 'volunteer' && stage === 'historico' && visibleItems.length ? <Pressable accessibilityRole="button" style={styles.exportButton} onPress={shareHistory}><Text style={styles.exportText}>Exportar histórico CSV</Text></Pressable> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#116451" /></View> : (
        <FlatList data={visibleItems} keyExtractor={(item) => String(item.id || item.donation_id)} renderItem={renderItem} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#116451" />} ListEmptyComponent={<View style={styles.empty}><Package size={28} color="#60786a" /><Text style={styles.emptyTitle}>{role === 'merchant' ? 'Ainda não há ações por aqui' : stage === 'reservadas' ? 'Nenhuma reserva ativa' : 'Seu histórico ainda está vazio'}</Text><Text style={styles.emptyText}>{role === 'merchant' ? 'Suas doações publicadas vão aparecer nesta lista.' : stage === 'reservadas' ? 'Reserve uma doação no mural para organizar a retirada.' : 'Conclua a distribuição para registrar sua prestação de contas.'}</Text></View>} />
      )}
      <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Validar retirada</Text><Text style={styles.modalDescription}>Peça o código de 6 caracteres à pessoa voluntária e digite abaixo.</Text><TextInput accessibilityLabel="Código de retirada" autoCapitalize="characters" autoCorrect={false} maxLength={6} value={pickupCode} onChangeText={(value) => setPickupCode(value.replace(/[^a-f0-9]/gi, '').toUpperCase())} placeholder="Ex.: A7C21F" style={styles.codeInput} /><Pressable accessibilityRole="button" style={styles.completeButton} disabled={!!updatingId} onPress={confirmCollection}>{updatingId ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeText}>Confirmar entrega</Text>}</Pressable><Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setSelectedItem(null)}><Text style={styles.secondaryText}>Voltar</Text></Pressable></View></View>
      </Modal>
      <Modal visible={!!reviewItem} transparent animationType="fade" onRequestClose={() => setReviewItem(null)}>
        <View style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.modalTitle}>Como foi a doação?</Text>
          <Text style={styles.modalDescription}>Sua avaliação ajuda a manter a rede segura e confiável.</Text>
          <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Nota da doação">
            {[1, 2, 3, 4, 5].map((score) => <Pressable key={score} accessibilityRole="radio" accessibilityLabel={`${score} ${score === 1 ? 'estrela' : 'estrelas'}`} accessibilityState={{ selected: reviewScore === score }} onPress={() => setReviewScore(score)} style={styles.starButton}><Star size={29} color={reviewScore >= score ? '#b83e08' : '#9aac9f'} fill={reviewScore >= score ? '#b83e08' : 'transparent'} /></Pressable>)}
          </View>
          {[
            ['quantity', 'A quantidade estava correta?'],
            ['safe', 'O alimento estava próprio para consumo?'],
            ['packed', 'O alimento estava bem embalado?'],
            ['cordial', 'O atendimento foi cordial?'],
          ].map(([key, question]) => <View key={key} style={styles.reviewQuestion}><Text style={styles.reviewQuestionText}>{question}</Text><View style={styles.answerGroup} accessibilityRole="radiogroup" accessibilityLabel={question}>{[[true, 'Sim'], [false, 'Não']].map(([answer, label]) => <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: reviewAnswers[key] === answer }} onPress={() => setReviewAnswers((current) => ({ ...current, [key]: answer }))} style={[styles.answerButton, reviewAnswers[key] === answer && styles.answerButtonActive]}><Text style={[styles.answerText, reviewAnswers[key] === answer && styles.answerTextActive]}>{label}</Text></Pressable>)}</View></View>)}
          <TextInput accessibilityLabel="Comentário opcional sobre a doação" value={reviewComment} onChangeText={setReviewComment} placeholder="Comentário opcional" multiline maxLength={300} style={[styles.codeInput, styles.multilineInput]} />
          <Pressable accessibilityRole="button" style={styles.completeButton} disabled={!!updatingId} onPress={submitReview}>{updatingId === 'review' ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeText}>Enviar avaliação</Text>}</Pressable>
          <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setReviewItem(null)}><Text style={styles.secondaryText}>Avaliar depois</Text></Pressable>
        </View></View>
      </Modal>
      <Modal visible={!!distributionItem} transparent animationType="fade" onRequestClose={() => setDistributionItem(null)}>
        <View style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.modalTitle}>Registrar distribuição</Text>
          <Text style={styles.modalDescription}>Conte como a doação chegou à comunidade. O relato e a foto são opcionais.</Text>
          <TextInput accessibilityLabel="Número de pessoas atendidas, opcional" value={distributionPeople} onChangeText={(value) => setDistributionPeople(value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="Pessoas atendidas (opcional)" keyboardType="number-pad" maxLength={6} style={[styles.codeInput, styles.numberInput]} />
          <TextInput accessibilityLabel="Relato da distribuição, opcional" value={distributionNote} onChangeText={setDistributionNote} placeholder="Ex.: Serviu 20 refeições na casa de acolhimento" multiline maxLength={500} style={[styles.codeInput, styles.multilineInput]} />
          <Text style={styles.privacyHint}>Se anexar uma foto, evite mostrar o rosto de quem recebeu a doação.</Text>
          {distributionPhoto ? <Image source={{ uri: distributionPhoto.uri }} style={styles.distributionPreview} accessibilityLabel="Prévia da foto da distribuição" /> : null}
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={chooseDistributionPhoto}><Text style={styles.secondaryText}>{distributionPhoto ? 'Trocar foto' : 'Anexar foto (opcional)'}</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.completeButton} disabled={!!updatingId} onPress={submitDistribution}>{updatingId === 'distribution' ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeText}>Concluir distribuição</Text>}</Pressable>
          <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setDistributionItem(null)}><Text style={styles.secondaryText}>Voltar</Text></Pressable>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7ffed', paddingTop: 8 },
  heading: { paddingHorizontal: 22, marginBottom: 18 },
  eyebrow: { color: '#347557', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 27 },
  subtitle: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  list: { paddingHorizontal: 18, paddingBottom: 25, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#e5eee0' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#eaf6df', alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: '#e4f4e8' },
  titleGroup: { flex: 1 },
  cardTitle: { color: '#244d3d', fontFamily: 'Roboto_700Bold', fontSize: 14 },
  quantity: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 3 },
  status: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8 },
  statusDone: { backgroundColor: '#e4f4e8' },
  statusReserved: { backgroundColor: '#fff2df' },
  statusRoute: { backgroundColor: '#e6f0fa' },
  statusAvailable: { backgroundColor: '#edf3ec' },
  statusText: { color: '#385f4d', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  storeName: { color: '#385f4d', fontFamily: 'Roboto_500Medium', fontSize: 12, marginTop: 13 },
  address: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  addressText: { flex: 1, color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  deadlineText: { color: '#8c4a08', fontFamily: 'Roboto_500Medium', fontSize: 12 },
  weight: { color: '#52665b', fontFamily: 'Roboto_500Medium', fontSize: 12, marginTop: 8 },
  voucher: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#9fc8a7', backgroundColor: '#f5fbf1', borderRadius: 14, padding: 14, marginTop: 14 },
  voucherLabel: { color: '#385f4d', fontFamily: 'Roboto_700Bold', fontSize: 11, letterSpacing: 1 },
  voucherCode: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 30, letterSpacing: 5, marginVertical: 5 },
  voucherHint: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center' },
  reviewSaved: { color: '#267747', fontFamily: 'Roboto_700Bold', fontSize: 12, textAlign: 'center', marginTop: 10 },
  distributionReport: { backgroundColor: '#f5fbf1', borderRadius: 12, padding: 12, marginTop: 12 },
  reportText: { color: '#385f4d', fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 19, marginTop: 5 },
  distributionPhoto: { width: '100%', height: 180, borderRadius: 12, marginTop: 12 },
  actions: { flexDirection: 'column', gap: 8, marginTop: 14 },
  secondaryButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, borderWidth: 1, borderColor: '#d6e8d3' },
  secondaryText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  completeButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#116451', paddingHorizontal: 12, marginTop: 12 },
  completeText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 11 },
  empty: { marginTop: 50, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: '#315e4d', fontFamily: 'Roboto_700Bold', fontSize: 15, textAlign: 'center', marginTop: 12 },
  emptyText: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 35, 27, 0.55)', justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { color: '#174d3e', fontFamily: 'Roboto_700Bold', fontSize: 20 },
  modalDescription: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20, marginTop: 8 },
  codeInput: { minHeight: 54, borderWidth: 1, borderColor: '#c9ddc7', borderRadius: 12, marginTop: 16, marginBottom: 8, paddingHorizontal: 14, textAlign: 'center', color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 22, letterSpacing: 5 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  stages: { flexDirection: 'row', marginHorizontal: 18, marginBottom: 12, padding: 4, borderRadius: 13, backgroundColor: '#eaf3e5', gap: 3 },
  stageButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 4 },
  stageButtonActive: { backgroundColor: '#116451' },
  stageText: { color: '#385f4d', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  stageTextActive: { color: '#fff' },
  exportButton: { minHeight: 42, alignSelf: 'flex-end', justifyContent: 'center', marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 10 },
  exportText: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
  starButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  reviewQuestion: { borderTopWidth: 1, borderTopColor: '#eff3ed', paddingVertical: 8 },
  reviewQuestionText: { color: '#315e4d', fontFamily: 'Roboto_500Medium', fontSize: 13 },
  answerGroup: { flexDirection: 'row', gap: 8, marginTop: 6 },
  answerButton: { minWidth: 58, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d6e8d3', borderRadius: 18 },
  answerButtonActive: { backgroundColor: '#116451', borderColor: '#116451' },
  answerText: { color: '#385f4d', fontFamily: 'Roboto_700Bold', fontSize: 12 },
  answerTextActive: { color: '#fff' },
  multilineInput: { minHeight: 78, textAlign: 'left', textAlignVertical: 'top', letterSpacing: 0, fontFamily: 'Roboto_400Regular', fontSize: 14, paddingTop: 12 },
  numberInput: { minHeight: 48, fontSize: 15, letterSpacing: 0 },
  privacyHint: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 11, lineHeight: 16, marginTop: 6 },
  distributionPreview: { width: '100%', height: 150, borderRadius: 12, marginBottom: 8 },
});
