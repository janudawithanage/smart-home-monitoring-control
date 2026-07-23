import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatusBadge from '@/components/StatusBadge';
import SwitchButton from '@/components/SwitchButton';
import { Colors } from '@/constants/colors';
import { getDeviceById, getStatusLabel, toggleDevice } from '@/services/deviceService';
import { Device } from '@/types/device';

const DEVICE_ICONS: Record<string, string> = {
  light: '💡',
  thermostat: '🌡️',
  lock: '🔒',
  camera: '📷',
  fan: '🌀',
  tv: '📺',
  speaker: '🔊',
  outlet: '🔌',
};

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDeviceById(id).then((d) => {
      setDevice(d ?? null);
      setLoading(false);
    });
  }, [id]);

  const handleToggle = useCallback(async () => {
    if (!device) return;
    const updated = await toggleDevice(device.id);
    if (updated) setDevice(updated);
  }, [device]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent.blue} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Device not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOn = device.status === 'on';
  const isInteractable = device.status !== 'offline' && device.status !== 'error';
  const accentColor = Colors.device[device.type] ?? Colors.accent.blue;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0a1628', '#0d2044', '#0a1628']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessible
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Device Detail</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View style={[styles.heroCard, isOn && styles.heroCardActive]}>
            {/* Big icon */}
            <View style={[styles.heroIconWrapper, { backgroundColor: `${accentColor}22` }]}>
              <Text style={styles.heroIcon}>{DEVICE_ICONS[device.type] ?? '⚙️'}</Text>
            </View>

            {/* Name & room */}
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={styles.deviceRoom}>{device.roomName}</Text>

            {/* Status badge */}
            <View style={styles.badgeRow}>
              <StatusBadge status={device.status} />
            </View>

            {/* Big value */}
            {device.value !== undefined && (
              <Text style={[styles.bigValue, { color: accentColor }]}>
                {device.value}
                <Text style={styles.unit}> {device.unit}</Text>
              </Text>
            )}

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{isOn ? 'Turn Off' : 'Turn On'}</Text>
              <SwitchButton
                value={isOn}
                onToggle={handleToggle}
                disabled={!isInteractable}
                size="md"
              />
            </View>
          </View>

          {/* Details table */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Details</Text>
            <DetailRow label="Type" value={device.type.charAt(0).toUpperCase() + device.type.slice(1)} />
            <DetailRow label="Floor" value={device.floorId.toUpperCase()} />
            <DetailRow label="Room" value={device.roomName} />
            <DetailRow label="Status" value={getStatusLabel(device.status)} />
            <DetailRow
              label="Last Updated"
              value={new Date(device.lastUpdated).toLocaleTimeString()}
            />
          </View>

          {/* Quick actions */}
          <View style={styles.actionsCard}>
            <Text style={styles.detailsTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <ActionButton
                label="Schedule"
                emoji="⏰"
                onPress={() => {/* TODO */}}
              />
              <ActionButton
                label="Automate"
                emoji="🤖"
                onPress={() => {/* TODO */}}
              />
              <ActionButton
                label="History"
                emoji="📊"
                onPress={() => {/* TODO */}}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  emoji,
  onPress,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={actionStyles.btn}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={actionStyles.emoji}>{emoji}</Text>
      <Text style={actionStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
  },
  errorText: { color: Colors.text.muted, fontSize: 16, marginBottom: 16 },
  backBtnCenter: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.accent.blue,
    borderRadius: 12,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },

  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bg.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  backIcon: { fontSize: 24, color: Colors.text.primary, lineHeight: 28 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },

  // Hero
  heroCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 10,
  },
  heroCardActive: {
    borderColor: 'rgba(77,124,244,0.45)',
    backgroundColor: Colors.bg.elevated,
  },
  heroIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroIcon: { fontSize: 44 },
  deviceName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  deviceRoom: { fontSize: 14, color: Colors.text.muted },
  badgeRow: { marginVertical: 2 },
  bigValue: {
    fontSize: 40,
    fontWeight: '900',
    marginVertical: 4,
  },
  unit: { fontSize: 20, fontWeight: '400', color: Colors.text.secondary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  // Details
  detailsCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 4,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 10,
  },

  // Actions
  actionsCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  label: { fontSize: 14, color: Colors.text.muted },
  value: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
});

const actionStyles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.bg.elevated,
    minWidth: 80,
  },
  emoji: { fontSize: 24 },
  label: { fontSize: 12, color: Colors.text.secondary, fontWeight: '600' },
});
