import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
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
import { getDeviceById, updateDevice } from '@/services/deviceService';
import { Device, DeviceStatus } from '@/types/device';

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [powerUsage, setPowerUsage] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    getDeviceById(id).then((d) => {
      if (d) {
        setDevice(d);
        // Simulate power usage when outlet is on
        if (d.status === 'on') {
          setPowerUsage(Math.floor(Math.random() * 150 + 50)); // 50-200W
        } else {
          setPowerUsage(0);
        }
      }
      setLoading(false);
    });
  }, [id]);

  const handleToggle = useCallback(async () => {
    if (!device) return;
    if (device.status === 'error' || device.status === 'offline') return;
    
    const newStatus: DeviceStatus = device.status === 'on' ? 'off' : 'on';
    
    // Update local state immediately for responsiveness
    setDevice((prev) => (prev ? { ...prev, status: newStatus } : null));
    
    // Simulate power usage update
    if (newStatus === 'on') {
      setPowerUsage(Math.floor(Math.random() * 150 + 50));
    } else {
      setPowerUsage(0);
    }

    // Update backend
    const updated = await updateDevice(device.id, { status: newStatus });
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
        <Text style={styles.errorText}>Electrical Outlet not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accentColor = Colors.device.outlet;
  const isActive = device.status === 'on';
  const isError = device.status === 'error' || device.status === 'offline';

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
            <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Electrical Outlet</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Card */}
          <HeroCard
            device={device}
            accentColor={accentColor}
            isActive={isActive}
            isError={isError}
            onToggle={handleToggle}
          />

          {/* Power Usage Card */}
          <PowerUsageCard
            powerUsage={powerUsage}
            isActive={isActive}
            accentColor={accentColor}
          />

          {/* Status Card */}
          <StatusCard device={device} accentColor={accentColor} />

          {/* Details */}
          <DetailsCard device={device} />

          {/* Quick Actions */}
          <QuickActionsCard accentColor={accentColor} deviceId={device.id} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Hero Card ───────────────────────────────────────────────────────────────

function HeroCard({
  device,
  accentColor,
  isActive,
  isError,
  onToggle,
}: {
  device: Device;
  accentColor: string;
  isActive: boolean;
  isError: boolean;
  onToggle: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isActive]);

  return (
    <View style={[styles.heroCard, isActive && styles.heroCardActive]}>
      {isActive && (
        <View style={[styles.glowRing, { shadowColor: accentColor }]} pointerEvents="none" />
      )}

      <Animated.View
        style={[
          styles.heroIconWrapper,
          { backgroundColor: `${accentColor}22`, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons name="power" size={52} color={accentColor} />
      </Animated.View>

      <Text style={styles.deviceName}>{device.name}</Text>
      <Text style={styles.deviceRoom}>{device.roomName}</Text>

      <View style={styles.badgeRow}>
        <StatusBadge status={device.status} />
      </View>

      <View style={styles.statusIndicator}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isError
                ? Colors.status.error
                : isActive
                ? accentColor
                : Colors.text.muted,
              shadowColor: isActive ? accentColor : Colors.status.error,
            },
          ]}
        />
        <Text style={styles.statusText}>
          {isError
            ? device.status.toUpperCase()
            : isActive
            ? 'POWERED ON'
            : 'POWERED OFF'}
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          {isActive ? 'Turn Off' : 'Turn On'}
        </Text>
        <SwitchButton
          value={isActive}
          onToggle={onToggle}
          disabled={isError}
          size="md"
        />
      </View>
    </View>
  );
}

// ─── Power Usage Card ────────────────────────────────────────────────────────

function PowerUsageCard({
  powerUsage,
  isActive,
  accentColor,
}: {
  powerUsage: number;
  isActive: boolean;
  accentColor: string;
}) {
  // Estimate daily usage and cost (assuming 8 hours per day, $0.12/kWh)
  const estimatedDailyKWh = (powerUsage * 8) / 1000;
  const estimatedDailyCost = estimatedDailyKWh * 0.12;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>Power Consumption</Text>
      </View>

      <View style={styles.powerDisplay}>
        <View style={[styles.powerIconBg, { backgroundColor: `${accentColor}18` }]}>
          <Ionicons name="flash" size={32} color={accentColor} />
        </View>
        <Text style={[styles.powerValue, { color: isActive ? accentColor : Colors.text.muted }]}>
          {powerUsage}
        </Text>
        <Text style={styles.powerUnit}>Watts</Text>
      </View>

      {isActive && (
        <View style={styles.estimatesRow}>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Est. Daily</Text>
            <Text style={styles.estimateValue}>{estimatedDailyKWh.toFixed(2)} kWh</Text>
          </View>
          <View style={styles.estimateDivider} />
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Est. Cost/Day</Text>
            <Text style={styles.estimateValue}>${estimatedDailyCost.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {!isActive && (
        <Text style={styles.inactiveNote}>Outlet is powered off — no consumption</Text>
      )}
    </View>
  );
}

// ─── Status Card ─────────────────────────────────────────────────────────────

function StatusCard({
  device,
  accentColor,
}: {
  device: Device;
  accentColor: string;
}) {
  const statusInfo = [
    {
      icon: 'power-outline' as const,
      label: 'Power State',
      value: device.status === 'on' ? 'ON' : device.status === 'off' ? 'OFF' : device.status.toUpperCase(),
      color:
        device.status === 'on'
          ? Colors.status.on
          : device.status === 'off'
          ? Colors.text.muted
          : Colors.status.error,
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Connection',
      value: device.status === 'offline' ? 'Offline' : 'Connected',
      color: device.status === 'offline' ? Colors.status.error : Colors.status.on,
    },
    {
      icon: 'location-outline' as const,
      label: 'Location',
      value: device.roomName,
      color: accentColor,
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'Device Type',
      value: 'Power Outlet',
      color: Colors.text.secondary,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>Status Overview</Text>
      </View>
      <View style={styles.statusGrid}>
        {statusInfo.map((info, idx) => (
          <StatusTile key={idx} {...info} />
        ))}
      </View>
    </View>
  );
}

function StatusTile({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statusTile}>
      <View style={[styles.statusIconBg, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statusTileLabel}>{label}</Text>
      <Text style={[styles.statusTileValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Details Card ────────────────────────────────────────────────────────────

function DetailsCard({ device }: { device: Device }) {
  const details = [
    { label: 'Device Name', value: device.name },
    { label: 'Type', value: 'Electrical Outlet' },
    { label: 'Floor', value: device.floorId.toUpperCase() },
    { label: 'Room', value: device.roomName },
    { label: 'Status', value: device.status.charAt(0).toUpperCase() + device.status.slice(1) },
    { label: 'Last Updated', value: new Date(device.lastUpdated).toLocaleString() },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: Colors.device.outlet }]} />
        <Text style={styles.cardTitle}>Device Information</Text>
      </View>
      {details.map((detail, idx) => (
        <DetailRow key={idx} {...detail} isLast={idx === details.length - 1} />
      ))}
    </View>
  );
}

function DetailRow({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Quick Actions Card ──────────────────────────────────────────────────────

function QuickActionsCard({ accentColor, deviceId }: { accentColor: string; deviceId: string }) {
  const actions = [
    { icon: 'time-outline' as const, label: 'Schedule', onPress: () => router.push(`/schedule/${deviceId}`) },
    { icon: 'git-branch-outline' as const, label: 'Automate', onPress: () => {} },
    { icon: 'bar-chart-outline' as const, label: 'Usage History', onPress: () => {} },
    { icon: 'settings-outline' as const, label: 'Settings', onPress: () => {} },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>Quick Actions</Text>
      </View>
      <View style={styles.actionsGrid}>
        {actions.map((action, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.actionBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
          >
            <View style={[styles.actionIconBg, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons name={action.icon} size={22} color={accentColor} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
  },
  errorText: {
    color: Colors.text.muted,
    fontSize: 16,
    marginBottom: 16,
  },
  backBtnCenter: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.accent.blue,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  safe: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 12,
    overflow: 'hidden',
  },
  heroCardActive: {
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: Colors.bg.elevated,
  },
  glowRing: {
    position: 'absolute',
    top: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 0,
  },
  heroIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  deviceName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  deviceRoom: {
    fontSize: 15,
    color: Colors.text.muted,
  },
  badgeRow: {
    marginVertical: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  // Card shared styles
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  accentBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // Power Display
  powerDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  powerIconBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  powerValue: {
    fontSize: 48,
    fontWeight: '900',
  },
  powerUnit: {
    fontSize: 16,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  estimatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  estimateItem: {
    alignItems: 'center',
    flex: 1,
  },
  estimateDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border.subtle,
  },
  estimateLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  inactiveNote: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Status Grid
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bg.elevated,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  statusIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTileLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  statusTileValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.text.muted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  // Actions
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    gap: 8,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    flex: 1,
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
