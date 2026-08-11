import { Colors } from '@/constants/colors';
import { Device } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import StatusBadge from './StatusBadge';
import SwitchButton from './SwitchButton';

interface Props {
  device: Device;
  onToggle: (id: string) => void;
}

const DEVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  light: 'bulb-outline',
  thermostat: 'thermometer-outline',
  lock: 'lock-closed-outline',
  camera: 'camera-outline',
  fan: 'refresh-outline',
  tv: 'tv-outline',
  speaker: 'volume-high-outline',
  outlet: 'flash-outline',
  iron: 'water-outline',
  multiSwitch: 'apps-outline',
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2-column grid with padding

export default function DeviceCard({ device, onToggle }: Props) {
  const isOn = device.status === 'on';
  const isInteractable = device.status !== 'offline' && device.status !== 'error';
  const accentColor = Colors.device[device.type] ?? Colors.accent.blue;

  const handlePress = useCallback(() => {
    // Route to multi-switch screen for multi-switch devices
    if (device.type === 'multiSwitch') {
      router.push(`/multi-switch/${device.id}`);
    } else {
      router.push(`/device/${device.id}`);
    }
  }, [device.id, device.type]);

  const handleToggle = useCallback(() => {
    onToggle(device.id);
  }, [device.id, onToggle]);

  return (
    <TouchableOpacity
      style={[styles.card, isOn && styles.cardActive]}
      onPress={handlePress}
      activeOpacity={0.75}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${device.name}, ${device.status}`}
    >
      {/* Top row: icon + switch */}
      <View style={styles.topRow}>
        <View style={[styles.iconBadge, { backgroundColor: `${accentColor}22` }]}>
          <Ionicons
            name={DEVICE_ICONS[device.type] ?? 'settings-outline'}
            size={20}
            color={accentColor}
          />
        </View>
        <SwitchButton
          value={isOn}
          onToggle={handleToggle}
          disabled={!isInteractable}
          size="sm"
        />
      </View>

      {/* Device name */}
      <Text style={styles.name} numberOfLines={2}>{device.name}</Text>

      {/* Room */}
      <Text style={styles.room} numberOfLines={1}>{device.roomName}</Text>

      {/* Value + status */}
      <View style={styles.bottomRow}>
        {device.value !== undefined ? (
          <Text style={[styles.value, { color: accentColor }]}>
            {device.value}{device.unit ?? ''}
          </Text>
        ) : (
          <View />
        )}
        <StatusBadge status={device.status} dotOnly />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bg.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 8,
  },
  cardActive: {
    borderColor: 'rgba(77,124,244,0.4)',
    backgroundColor: Colors.bg.elevated,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 18,
  },
  room: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
  },
});
