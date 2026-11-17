import React from 'react';
import { Image, } from 'react-native';
import MerchantArt from '../../assets/images/Chef.png';
import BasketArt from '../../assets/images/Network.png';
import VolunteerArt from '../../assets/images/salad-77.png';

export default function Illustration({ kind, size = 230 }) {
  const source = kind === 'merchant' ? MerchantArt : kind === 'basket' ? BasketArt : VolunteerArt;
  return <Image source={source} resizeMode="contain" style={{ width: size, height: size }} accessible={false} />;
}
