import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const HELPLINES = [
  { country: 'England', number: '0808 801 0677' },
  { country: 'Scotland', number: '0808 801 0432' },
  { country: 'Wales', number: '0808 801 0433' },
  { country: 'Northern Ireland', number: '0808 801 0434' },
];

const BEAT = 'https://www.beateatingdisorders.org.uk/get-information-and-support/get-help-for-myself/support-now/';

export default function SupportScreen() {
  return (
    <FormScreen>
      <ThemedText>
        Tracking food can be unhelpful for some people. If counting, weighing or food rules are taking over, or you&apos;re
        worried about your relationship with food, you&apos;re not alone and support is available.
      </ThemedText>

      <Card>
        <ThemedText type="smallBold">Beat, the UK eating disorder charity</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Free helplines, one-to-one webchat and support groups.
        </ThemedText>
        {HELPLINES.map((h) => (
          <Pressable key={h.country} onPress={() => Linking.openURL(`tel:${h.number.replace(/\s/g, '')}`)}>
            <View style={styles.row}>
              <ThemedText>{h.country}</ThemedText>
              <ThemedText type="linkPrimary">{h.number}</ThemedText>
            </View>
          </Pressable>
        ))}
        <Pressable onPress={() => Linking.openURL(BEAT)}>
          <ThemedText type="linkPrimary">Opening hours, webchat and email: beateatingdisorders.org.uk</ThemedText>
        </Pressable>
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        Your GP can also help. In an emergency, call 999.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.one },
});
