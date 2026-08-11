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

// ─── Types for Multi-Switch ──────────────────────────────────────────────────

interface SwitchCircuit {
  id: string;
  name: string;
  status: 'on' | 'off' | 'error' | 'disconnected';
  power?: number; // watts
}

interface MultiSwitchUnit {
  device: Device;
  circuits: SwitchCircuit[];
}

// ─── Mock data for circuits ──────────────────────────────────────────────────
// In a real app, this would come from the backend along with the device data
function getMockCircuits(switchCount: number): SwitchCircuit[] {
  const names = [
    'Ceiling Light',
    'Wall Light',
    'Desk Lamp',
    'Fan',
    'Accent Light',
  ];
  
  return Array.from({ length: switchCount }, (_, i) => ({
    id: `circuit-${i + 1}`,
    name: `Switch ${i + 1} — ${names[i] || 'Device'}`,
    status: i % 2 === 0 ? 'on' : 'off',
    power: i % 2 === 0 ? 40 + Math.random() * 60 : 0,
  })) as SwitchCircuit[];
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MultiSwitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [circuits, setCircuits] = useState<SwitchCircuit[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine switch count from device name or default to 3
  const switchCount = device?.name.match(/(\d)-Switch/)?.[1] 
    ? parseInt(device.name.match(/(\d)-Switch/)![1], 10)
    : 3;

  useEffect(() => {
    if (!id) return;
    getDeviceById(id).then((d) => {
      if (d) {
        setDevice(d);
        // In a real app, fetch circuits from backend
        const mockCircuits = getMockCircuits(switchCount);
        setCircuits(mockCircuits);
      }
      setLoading(false);
    });
  }, [id, switchCount]);

  const handleToggleCircuit = useCallback((circuitId: string) => {
    setCircuits((prev) =>
      prev.map((c) =>
        c.id === circuitId
          ? {
              ...c,
              status: c.status === 'on' ? 'off' : c.status === 'off' ? 'on' : c.status,
              power: c.status === 'off' ? 40 + Math.random() * 60 : 0,
            }
          : c
      )
    );
  }, []);

  const handleToggleAll = useCallback(async () => {
    if (!device) return;
    const allOn = circuits.every((c) => c.status === 'on');
    const newStatus = allOn ? 'off' : 'on';
    
    setCircuits((prev) =>
      prev.map((c) => ({
        ...c,
        status: c.status === 'error' || c.status === 'disconnected' ? c.status : newStatus,
        power: newStatus === 'on' ? 40 + Math.random() * 60 : 0,
      }))
    );

    const updated = await updateDevice(device.id, { status: newStatus as DeviceStatus });
    if (updated) setDevice(updated);
  }, [device, circuits]);

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
        <Text style={styles.errorText}>Multi-Switch Unit not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accentColor = Colors.device.multiSwitch;
  const activeCount = circuits.filter((c) => c.status === 'on').length;
  const errorCount = circuits.filter((c) => c.status === 'error' || c.status === 'disconnected').length;
  const totalPower = circuits.reduce((sum, c) => sum + (c.power || 0), 0);

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
          <Text style={styles.headerTitle}>Multi-Switch Unit</Text>
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
            activeCount={activeCount}
            totalCount={circuits.length}
            onToggleAll={handleToggleAll}
          />

          {/* Status Summary */}
          <StatusSummaryCard
            activeCount={activeCount}
            totalCount={circuits.length}
            errorCount={errorCount}
            totalPower={totalPower}
            accentColor={accentColor}
          />

          {/* Individual Switches */}
          <SwitchesCard
            circuits={circuits}
            accentColor={accentColor}
            onToggle={handleToggleCircuit}
          />

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
  activeCount,
  totalCount,
  onToggleAll,
}: {
  device: Device;
  accentColor: string;
  activeCount: number;
  totalCount: number;
  onToggleAll: () => void;
}) {
  const isActive = activeCount > 0;
  const allOn = activeCount === totalCount;
  
  return (
    <View style={[styles.heroCard, isActive && styles.heroCardActive]}>
      {isActive && (
        <View style={[styles.glowRing, { shadowColor: accentColor }]} pointerEvents="none" />
      )}

      <View style={[styles.heroIconWrapper, { backgroundColor: `${accentColor}22` }]}>
        <Ionicons name="apps" size={44} color={accentColor} />
      </View>

      <Text style={styles.deviceName}>{device.name}</Text>
      <Text style={styles.deviceRoom}>{device.roomName}</Text>

      <View style={styles.badgeRow}>
        <StatusBadge status={device.status} />
      </View>

      <View style={styles.countBadge}>
        <Text style={[styles.countText, { color: accentColor }]}>
          {activeCount}/{totalCount}
        </Text>
        <Text style={styles.countLabel}>Switches Active</Text>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{allOn ? 'Turn All Off' : 'Turn All On'}</Text>
        <SwitchButton
          value={allOn}
          onToggle={onToggleAll}
          disabled={device.status === 'offline' || device.status === 'error'}
          size="md"
        />
      </View>
    </View>
  );
}

// ─── Status Summary Card ─────────────────────────────────────────────────────

function StatusSummaryCard({
  activeCount,
  totalCount,
  errorCount,
  totalPower,
  accentColor,
}: {
  activeCount: number;
  totalCount: number;
  errorCount: number;
  totalPower: number;
  accentColor: string;
}) {
  const stats = [
    {
      icon: 'checkmark-circle-outline' as const,
      label: 'Active',
      value: activeCount.toString(),
      color: Colors.status.on,
    },
    {
      icon: 'radio-button-off-outline' as const,
      label: 'Inactive',
      value: (totalCount - activeCount - errorCount).toString(),
      color: Colors.text.muted,
    },
    {
      icon: 'flash-outline' as const,
      label: 'Power',
      value: `${totalPower.toFixed(0)}W`,
      color: accentColor,
    },
    {
      icon: 'alert-circle-outline' as const,
      label: 'Issues',
      value: errorCount.toString(),
      color: errorCount > 0 ? Colors.status.error : Colors.text.muted,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>Status Summary</Text>
      </View>
      <View style={styles.statsGrid}>
        {stats.map((stat, idx) => (
          <StatTile key={idx} {...stat} />
        ))}
      </View>
    </View>
  );
}

function StatTile({
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
    <View style={styles.statTile}>
      <View style={[styles.statIconBg, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Switches Card ───────────────────────────────────────────────────────────

function SwitchesCard({
  circuits,
  accentColor,
  onToggle,
}: {
  circuits: SwitchCircuit[];
  accentColor: string;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>Individual Switches</Text>
      </View>
      {circuits.map((circuit, idx) => (
        <SwitchRow
          key={circuit.id}
          circuit={circuit}
          accentColor={accentColor}
          onToggle={() => onToggle(circuit.id)}
          isLast={idx === circuits.length - 1}
        />
      ))}
    </View>
  );
}

function SwitchRow({
  circuit,
  accentColor,
  onToggle,
  isLast,
}: {
  circuit: SwitchCircuit;
  accentColor: string;
  onToggle: () => void;
  isLast: boolean;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const isError = circuit.status === 'error' || circuit.status === 'disconnected';
  const statusColor = isError
    ? Colors.status.error
    : circuit.status === 'on'
    ? accentColor
    : Colors.bg.elevated;

  const statusLabel = isError
    ? circuit.status.toUpperCase()
    : circuit.status === 'on'
    ? 'Active'
    : 'Inactive';

  return (
    <Animated.View
      style={[
        styles.switchRow,
        !isLast && styles.switchRowBorder,
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.switchLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor, shadowColor: statusColor }]} />
        <View style={styles.switchInfo}>
          <Text style={styles.switchName}>{circuit.name}</Text>
          <View style={styles.switchMeta}>
            <Text style={[styles.switchStatus, isError && { color: Colors.status.error }]}>
              {statusLabel}
            </Text>
            {circuit.power !== undefined && circuit.power > 0 && (
              <>
                <Text style={styles.switchMetaDot}>•</Text>
                <Text style={styles.switchPower}>{circuit.power.toFixed(0)}W</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <SwitchButton
        value={circuit.status === 'on'}
        onToggle={onToggle}
        disabled={isError}
        size="sm"
      />
    </Animated.View>
  );
}

// ─── Details Card ────────────────────────────────────────────────────────────

function DetailsCard({ device }: { device: Device }) {
  const details = [
    { label: 'Type', value: 'Multi-Switch Unit' },
    { label: 'Floor', value: device.floorId.toUpperCase() },
    { label: 'Room', value: device.roomName },
    { label: 'Status', value: device.status.charAt(0).toUpperCase() + device.status.slice(1) },
    { label: 'Last Updated', value: new Date(device.lastUpdated).toLocaleString() },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.accentBar, { backgroundColor: Colors.device.multiSwitch }]} />
        <Text style={styles.cardTitle}>Details</Text>
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
    { icon: 'bar-chart-outline' as const, label: 'History', onPress: () => {} },
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
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 10,
    overflow: 'hidden',
  },
  heroCardActive: {
    borderColor: 'rgba(45,212,191,0.45)',
    backgroundColor: Colors.bg.elevated,
  },
  glowRing: {
    position: 'absolute',
    top: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 50,
    elevation: 0,
  },
  heroIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  deviceRoom: {
    fontSize: 14,
    color: Colors.text.muted,
  },
  badgeRow: {
    marginVertical: 2,
  },
  countBadge: {
    alignItems: 'center',
    marginVertical: 8,
  },
  countText: {
    fontSize: 36,
    fontWeight: '900',
  },
  countLabel: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
  },
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

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
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
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.muted,
  },

  // Switch rows
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  switchRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  switchInfo: {
    flex: 1,
  },
  switchName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 3,
  },
  switchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchStatus: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  switchMetaDot: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  switchPower: {
    fontSize: 12,
    color: Colors.accent.blue,
    fontWeight: '600',
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
