import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
      <Stack.Screen name="log/add" options={{ title: 'Add food' }} />
      <Stack.Screen name="log/scan" options={{ title: 'Scan barcode' }} />
      <Stack.Screen name="log/quick-add" options={{ title: 'Quick add' }} />
      <Stack.Screen name="log/food/[id]" options={{ title: 'Food' }} />
      <Stack.Screen name="log/entry/[id]" options={{ title: 'Edit entry' }} />
      <Stack.Screen name="foods/new" options={{ title: 'New food' }} />
    </Stack>
  );
}
