import React, { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '../services/supabase';
import Illustration from '../components/Illustrations';

const merchantCategories = ['Padaria', 'Hortifruti', 'Restaurante', 'Supermercado', 'Mercado', 'Outro'];
const transports = ['A pé / bicicleta', 'Moto', 'Carro', 'Furgão'];
const logo = require('../../assets/images/logo.png');

function Field({ label, value, onChangeText, placeholder, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        accessibilityLabel={label}
        accessibilityHint={placeholder || `Digite ${label.toLowerCase()}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#52665b"
        autoCapitalize={props.keyboardType === 'email-address' ? 'none' : props.autoCapitalize || 'sentences'}
        {...props}
      />
    </View>
  );
}

function OptionGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={[styles.option, value === option && styles.optionSelected]}>
            <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function AuthScreen({ navigation }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('merchant');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [values, setValues] = useState({
    responsibleName: '', email: '', password: '', phone: '', businessName: '', cnpj: '',
    cep: '', street: '', number: '', complement: '', neighborhood: '', category: 'Padaria',
    pickupHours: '', institutionName: '', cpfCnpj: '', serviceArea: '', transport: 'A pé / bicicleta',
  });
  const update = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const goToProfile = (selectedRole) => navigation.replace('MainTabs', { role: selectedRole });

  const submit = async () => {
    setMessage('');
    if (mode === 'register') {
      const commonMissing = !values.responsibleName.trim() || !values.phone.trim() || !values.email.trim() || !values.password;
      const roleMissing = role === 'merchant'
        ? !values.businessName.trim() || !values.cep.trim() || !values.street.trim() || !values.number.trim() || !values.neighborhood.trim() || !values.pickupHours.trim()
        : !values.cpfCnpj.trim() || !values.serviceArea.trim();
      if (commonMissing || roleMissing) {
        setMessage('Preencha os campos obrigatórios para continuar.');
        return;
      }
      if (values.password.length < 6) {
        setMessage('Use uma senha com pelo menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (error) throw error;
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.role) {
          setMessage('Sua conta ainda não tem um perfil. Faça o cadastro novamente ou fale com a equipe.');
        } else {
          goToProfile(profile.role);
        }
      } else {
        const metadata = {
          role,
          responsible_name: values.responsibleName.trim(),
          phone: values.phone.trim(),
          business_name: role === 'merchant' ? values.businessName.trim() : null,
          cnpj: role === 'merchant' ? values.cnpj.trim() || null : null,
          cep: role === 'merchant' ? values.cep.trim() : null,
          street: role === 'merchant' ? values.street.trim() : null,
          street_number: role === 'merchant' ? values.number.trim() : null,
          complement: role === 'merchant' ? values.complement.trim() || null : null,
          neighborhood: role === 'merchant' ? values.neighborhood.trim() : null,
          business_category: role === 'merchant' ? values.category : null,
          pickup_hours: role === 'merchant' ? values.pickupHours.trim() : null,
          institution_name: role === 'volunteer' ? values.institutionName.trim() || null : null,
          cpf_cnpj: role === 'volunteer' ? values.cpfCnpj.trim() : null,
          service_area: role === 'volunteer' ? values.serviceArea.trim() : null,
          transport: role === 'volunteer' ? values.transport : null,
        };
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: { data: metadata },
        });
        if (error) throw error;
        if (data.session) goToProfile(role);
        else setMessage('Cadastro criado! Confirme seu e-mail para ativar a conta e depois entre no app.');
      }
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <SafeAreaView style={styles.safe}>
        <Image source={logo} resizeMode="contain" pointerEvents="none" accessibilityIgnoresInvertColors style={styles.watermark} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar para a tela anterior" hitSlop={6}>
              <ArrowLeft size={20} color="#116451" />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>
            <View style={styles.tabs}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'login' }} onPress={() => { setMode('login'); setMessage(''); }} style={[styles.tab, mode === 'login' && styles.tabActive]}><Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Entrar</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'register' }} onPress={() => { setMode('register'); setMessage(''); }} style={[styles.tab, mode === 'register' && styles.tabActive]}><Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Cadastrar</Text></Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.title}>{mode === 'login' ? 'LOGIN' : 'CADASTRO'}</Text>
              {mode === 'login' ? (
                <>
                  <Field label="E-mail" value={values.email} onChangeText={update('email')} keyboardType="email-address" autoComplete="email" />
                  <Field label="Senha" value={values.password} onChangeText={update('password')} secureTextEntry autoComplete="password" />
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                  <Pressable style={styles.submit} onPress={submit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Entrar</Text>}
                  </Pressable>
                  <Text style={styles.helper}>Ainda não tem conta? Toque em Cadastrar acima.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Quem está chegando à rede?</Text>
                  <View style={styles.roleRow}>
                    <Pressable accessibilityRole="radio" accessibilityLabel="Comerciante. Quero doar alimentos." accessibilityState={{ selected: role === 'merchant' }} onPress={() => setRole('merchant')} style={[styles.roleCard, role === 'merchant' && styles.roleCardActive]}>
                      <Illustration kind="merchant" size={68} />
                      <Text style={[styles.roleTitle, role === 'merchant' && styles.roleTextActive]}>Comerciante</Text>
                      <Text style={styles.roleCaption}>Quero doar alimentos</Text>
                    </Pressable>
                    <Pressable accessibilityRole="radio" accessibilityLabel="ONG ou voluntário. Quero receber doações." accessibilityState={{ selected: role === 'volunteer' }} onPress={() => setRole('volunteer')} style={[styles.roleCard, role === 'volunteer' && styles.roleCardActive]}>
                      <Illustration kind="volunteer" size={68} />
                      <Text style={[styles.roleTitle, role === 'volunteer' && styles.roleTextActive]}>ONG / Voluntário</Text>
                      <Text style={styles.roleCaption}>Quero receber doações</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.sectionTitle}>Dados do responsável</Text>
                  <Field label="Nome do responsável *" value={values.responsibleName} onChangeText={update('responsibleName')} autoComplete="name" />
                  <Field label="E-mail *" value={values.email} onChangeText={update('email')} keyboardType="email-address" autoComplete="email" />
                  <Field label="Senha *" value={values.password} onChangeText={update('password')} secureTextEntry autoComplete="new-password" />
                  <Field label="Telefone / WhatsApp *" value={values.phone} onChangeText={update('phone')} keyboardType="phone-pad" placeholder="(00) 00000-0000" />
                  {role === 'merchant' ? (
                    <>
                      <Text style={styles.sectionTitle}>Dados do estabelecimento</Text>
                      <Field label="Nome do estabelecimento *" value={values.businessName} onChangeText={update('businessName')} placeholder="Ex.: Padaria Central" />
                      <Field label="CNPJ (opcional)" value={values.cnpj} onChangeText={update('cnpj')} keyboardType="numeric" />
                      <View style={styles.twoColumns}>
                        <View style={styles.flex}><Field label="CEP *" value={values.cep} onChangeText={update('cep')} keyboardType="numeric" /></View>
                        <View style={styles.flex}><Field label="Número *" value={values.number} onChangeText={update('number')} /></View>
                      </View>
                      <Field label="Rua *" value={values.street} onChangeText={update('street')} />
                      <Field label="Complemento" value={values.complement} onChangeText={update('complement')} />
                      <Field label="Bairro *" value={values.neighborhood} onChangeText={update('neighborhood')} />
                      <OptionGroup label="Categoria do comércio" options={merchantCategories} value={values.category} onChange={update('category')} />
                      <Field label="Horário padrão de retirada *" value={values.pickupHours} onChangeText={update('pickupHours')} placeholder="Ex.: Todos os dias, das 18h às 19h" />
                    </>
                  ) : (
                    <>
                      <Text style={styles.sectionTitle}>Dados de quem vai receber</Text>
                      <Field label="Nome da instituição (opcional)" value={values.institutionName} onChangeText={update('institutionName')} />
                      <Field label="CPF ou CNPJ *" value={values.cpfCnpj} onChangeText={update('cpfCnpj')} keyboardType="numeric" />
                      <Field label="Bairros ou cidades de atuação *" value={values.serviceArea} onChangeText={update('serviceArea')} placeholder="Ex.: Centro, Vila Nova" />
                      <OptionGroup label="Meio de transporte" options={transports} value={values.transport} onChange={update('transport')} />
                    </>
                  )}
                  <Text style={styles.requiredNote}>* Campos obrigatórios</Text>
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                  <Pressable style={styles.submit} onPress={submit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Criar minha conta</Text>}
                  </Pressable>
                  <Text style={styles.helper}>Ao criar sua conta, você poderá acessar a Rede Solidária com seu e-mail e senha.</Text>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7ffed', overflow: 'hidden' },
  watermark: { position: 'absolute', zIndex: 0, width: 390, height: 390, alignSelf: 'center', bottom: -82, opacity: 0.12 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  backText: { color: '#116451', fontFamily: 'Roboto_500Medium', fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 18 },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#a4dc78' },
  tabText: { color: '#52665b', fontFamily: 'Roboto_700Bold', fontSize: 15 },
  tabTextActive: { color: '#116451' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 22, borderRadius: 25, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2efd2', shadowColor: '#14532d', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  title: { color: '#b83e08', fontFamily: 'AnnieUseYourTelescope_400Regular', fontSize: 36, textAlign: 'center', marginBottom: 18 },
  sectionTitle: { color: '#116451', fontFamily: 'Roboto_700Bold', fontSize: 15, marginTop: 12, marginBottom: 10 },
  fieldWrap: { marginBottom: 12 },
  label: { color: '#315b4b', fontFamily: 'Roboto_500Medium', fontSize: 13, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1.5, borderColor: '#116451', borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 11, color: '#173d32', fontFamily: 'Roboto_400Regular', fontSize: 15 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  roleCard: { flex: 1, minHeight: 140, justifyContent: 'center', alignItems: 'center', padding: 12, borderWidth: 1.5, borderColor: '#d9e8d5', borderRadius: 16, backgroundColor: '#fbfff6' },
  roleCardActive: { borderColor: '#116451', backgroundColor: '#e9f8df' },
  roleTitle: { marginTop: 6, color: '#587364', fontFamily: 'Roboto_700Bold', fontSize: 13, textAlign: 'center' },
  roleTextActive: { color: '#116451' },
  roleCaption: { marginTop: 3, color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 12, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#d6e6d1', borderRadius: 999, backgroundColor: '#fbfff6', paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#e0f2d4', borderColor: '#116451' },
  optionText: { color: '#597463', fontFamily: 'Roboto_500Medium', fontSize: 12 },
  optionTextSelected: { color: '#116451' },
  twoColumns: { flexDirection: 'row', gap: 12 },
  requiredNote: { color: '#52665b', fontFamily: 'Roboto_400Regular', fontSize: 11, marginVertical: 4 },
  message: { color: '#9f2d20', backgroundColor: '#fff1ed', padding: 11, borderRadius: 10, overflow: 'hidden', fontFamily: 'Roboto_500Medium', fontSize: 13, marginVertical: 8 },
  submit: { minHeight: 50, borderRadius: 14, backgroundColor: '#116451', alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 18 },
  submitText: { color: '#fff', fontFamily: 'Roboto_700Bold', fontSize: 16 },
  helper: { color: '#52665b', textAlign: 'center', fontFamily: 'Roboto_400Regular', fontSize: 12, lineHeight: 18, marginTop: 13 },
});
