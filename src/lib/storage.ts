import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for the Supabase auth session.
 * Native: SecureStore (Keychain / Keystore). SecureStore values are capped around 2 KB,
 * so larger values fall back to AsyncStorage. Web: localStorage via AsyncStorage.
 */
const SECURE_LIMIT = 2000;

export const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return (await SecureStore.getItemAsync(key)) ?? AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS !== 'web' && value.length <= SECURE_LIMIT) {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};
