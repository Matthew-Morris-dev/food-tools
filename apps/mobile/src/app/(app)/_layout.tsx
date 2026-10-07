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
      <Stack.Screen name="goal/setup" options={{ title: 'Your goal' }} />
      <Stack.Screen name="weights/index" options={{ title: 'Weigh-ins' }} />
      <Stack.Screen name="weights/log" options={{ title: 'Log weight' }} />
      <Stack.Screen name="check-in" options={{ title: 'Weekly check-in' }} />
      <Stack.Screen name="support" options={{ title: 'Support' }} />
      <Stack.Screen name="meals/new" options={{ title: 'Save meal' }} />
      <Stack.Screen name="meals/[id]" options={{ title: 'Meal' }} />
    </Stack>
  );
}
