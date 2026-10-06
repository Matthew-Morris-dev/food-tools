import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { gtinFromScan } from '@/lib/gs1';
import type { Slot } from '@/lib/types';

export default function ScanScreen() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: Slot }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notProduct, setNotProduct] = useState(false);
  // The camera fires many events per second; only handle the first
  const busy = useRef(false);

  async function lookup(code: string) {
    if (busy.current) return;
    busy.current = true;
    setLooking(true);
    setError(null);
    try {
      const result = await api.barcode(code);
      if (result.status === 'found') {
        router.replace({ pathname: '/log/food/[id]', params: { id: result.food.id, date, slot } });
      } else {
        // Not in Open Food Facts, or missing nutrition: enter it from the label
        const known = result.status === 'incomplete' ? result : { name: null, brand: null };
        router.replace({
          pathname: '/foods/new',
          params: { date, slot, barcode: code, name: known.name ?? '', brand: known.brand ?? '' },
        });
      }
    } catch (err) {
      setError(err);
      busy.current = false;
    } finally {
      setLooking(false);
    }
  }

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const gtin = gtinFromScan(data);
    if (gtin) void lookup(gtin);
    // e.g. a QR code linking to a promotion; keep scanning
    else setNotProduct(true);
  };

  const manualGtin = gtinFromScan(manual);

  const camera =
    Platform.OS === 'web' ? null : !permission ? (
      <Loading />
    ) : !permission.granted ? (
      <View style={styles.permission}>
        <ThemedText>The camera is used to read barcodes on packets.</ThemedText>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    ) : (
      <CameraView
        style={styles.camera}
        facing="back"
        // QR and DataMatrix cover the GS1 2D codes replacing linear barcodes on UK packs
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'datamatrix'] }}
        onBarcodeScanned={looking ? undefined : onScanned}
      />
    );

  return (
    <FormScreen>
      {camera}
      {looking && <Loading />}
      {notProduct && !looking && (
        <ThemedText type="small" themeColor="textSecondary">
          That code isn&apos;t a product barcode. Try the barcode or GS1 QR code on the packet.
        </ThemedText>
      )}
      <ErrorText error={error} />
      <ThemedText type="small" themeColor="textSecondary">
        Or type the numbers under the barcode, or paste a GS1 link:
      </ThemedText>
      <View style={styles.manual}>
        <TextField value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="5000157024671" />
        <Button
          title="Look up"
          variant="secondary"
          onPress={() => manualGtin && lookup(manualGtin)}
          disabled={!manualGtin}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: Spacing.three, overflow: 'hidden' },
  permission: { gap: Spacing.three, paddingVertical: Spacing.four },
  manual: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
});
