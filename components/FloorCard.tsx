import { Colors } from '@/constants/colors';
import { Floor } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface Props {
  floor: Floor;
}

const FLOOR_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'home-outline',
  'bed-outline',
  'telescope-outline',
];

export default function FloorCard({ floor }: Props) {
  const activeRatio =
    floor.deviceCount > 0 ? floor.activeDeviceCount / floor.deviceCount : 0;

  const handlePress = () => {
    // navigation to devices removed — wire up to new route when ready
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.78}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${floor.name}, ${floor.activeDeviceCount} of ${floor.deviceCount} devices active`}
    >
      {/* Floor icon */}
      <View style={styles.iconWrap}>
        <Ionicons
          name={FLOOR_ICONS[floor.level] ?? 'business-outline'}
          size={22}
          color={Colors.accent.blue}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name}>{floor.name}</Text>
        <Text style={styles.count}>
          {floor.activeDeviceCount}/{floor.deviceCount} devices active
        </Text>
      </View>

      {/* Mini progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(activeRatio * 100)}%` as unknown as number },
          ]}
        />
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(106,171,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  count: {
    fontSize: 13,
    color: Colors.text.muted,
  },
  progressTrack: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bg.elevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.blue,
    borderRadius: 2,
  },
});
