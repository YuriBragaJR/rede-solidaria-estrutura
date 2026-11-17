import React, { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Compass, Home, Plus, UserRound } from 'lucide-react-native';
import VolunteerFeed from '../screens/VolunteerFeed';
import MerchantHome from '../screens/MerchantHome';
import ActionsScreen from '../screens/ActionsScreen';
import ExploreScreen from '../screens/ExploreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { supabase } from '../services/supabase';

const Tab = createBottomTabNavigator();
const GREEN = '#116451';
const MUTED = '#52665b';

export default function MainTabs({ route, navigation }) {
  const role = route.params?.role || 'volunteer';
  const isMerchant = role === 'merchant';

  useEffect(() => {
    if (role !== 'volunteer') return undefined;
    let active = true;
    let channel;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      channel = supabase.channel(`collection-alerts-${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'donations', filter: `reserved_by=eq.${user.id}` }, (payload) => {
          if (payload.new.status !== 'em_rota') return;
          Alert.alert('Doação retirada na loja', 'Avalie a qualidade e registre a distribuição para atualizar seu impacto.', [
            { text: 'Avaliar agora', onPress: () => navigation.navigate('MainTabs', { screen: 'Actions', params: { role, reviewDonationId: String(payload.new.id), reviewRequestedAt: Date.now() } }) },
            { text: 'Depois', style: 'cancel' },
          ]);
        })
        .subscribe();
    });
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [navigation, role]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: MUTED,
          tabBarLabelStyle: { fontFamily: 'Roboto_500Medium', fontSize: 12, marginBottom: 4 },
          tabBarItemStyle: { minHeight: 48 },
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 5,
          backgroundColor: '#fffefb',
          borderTopColor: '#e4efdf',
          elevation: 12,
          shadowColor: '#154d3d',
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarIcon: ({ color, focused }) => {
          const iconProps = { size: 21, color, strokeWidth: focused ? 2.5 : 2 };
          if (tabRoute.name === 'Home') return <Home {...iconProps} />;
          if (tabRoute.name === 'Create') return <Plus {...iconProps} />;
          if (tabRoute.name === 'Explore') return <Compass {...iconProps} />;
          if (tabRoute.name === 'Actions') return <ClipboardList {...iconProps} />;
          return <UserRound {...iconProps} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={VolunteerFeed} initialParams={{ role }} options={{ title: 'Início', tabBarLabel: 'Mural' }} />
      <Tab.Screen name="Actions" component={ActionsScreen} initialParams={{ role }} options={{ title: isMerchant ? 'Minhas doações' : 'Minhas coletas', tabBarLabel: isMerchant ? 'Histórico' : 'Coletas' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ role }} options={{ title: 'Perfil', tabBarLabel: 'Perfil' }} />
      {isMerchant ? (
        <Tab.Screen
          name="Create"
          component={MerchantHome}
          initialParams={{ role }}
          options={{
            title: 'Nova doação',
            tabBarLabel: 'Doar',
            tabBarActiveTintColor: '#b83e08',
            tabBarIcon: ({ focused }) => (
              <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#b83e08', alignItems: 'center', justifyContent: 'center', marginTop: -20, elevation: focused ? 7 : 4 }}>
                <Plus size={24} color="#fff" strokeWidth={2.8} />
              </View>
            ),
            tabBarItemStyle: { marginTop: -4 },
          }}
        />
      ) : (
        <Tab.Screen name="Explore" component={ExploreScreen} initialParams={{ role }} options={{ title: 'Explorar', tabBarLabel: 'Explorar' }} />
      )}
    </Tab.Navigator>
  );
}
