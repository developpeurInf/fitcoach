import { Stack } from 'expo-router';

export default function SessionLayout() {
  // No swipe-back: a stray gesture mid-set must not leave the session.
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
