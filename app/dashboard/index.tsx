import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeviceCard from '@/components/DeviceCard';
import FloorCard from '@/components/FloorCard';
import { Colors } from '@/constants/colors';
import { countActiveDevices, getDevices, getFloors, toggleDevice } from '@/services/deviceService';
import { Device, Floor } from '@/types/device';

export default function DashboardScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [d, f] = await Promise.all([getDevices(), getFloors()]);
    setDevices(d);
    setFloors(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(async (id: string) => {
    const updated = await toggleDevice(id);
    if (updated) {
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    }
  }, []);

  const activeCount = countActiveDevices(devices);
  const recentDevices = devices.slice(0, 6);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0a1628', '#0d2044', '#0a1628']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good morning 👋</Text>
              <Text style={styles.subtitle}>Your home, at a glance</Text>
            </View>
            <TouchableOpacity
              style={styles.profileBtn}
              accessible
              accessibilityLabel="Profile"
            >
              <Text style={styles.profileInitial}>J</Text>
            </TouchableOpacity>
          </View>

          {/* ── Summary Cards ── */}
          <View style={styles.summaryRow}>
            <SummaryTile
              label="Total Devices"
              value={String(devices.length)}
              emoji="🏠"
            />
            <SummaryTile
              label="Active Now"
              value={String(activeCount)}
              emoji="✅"
              accent={Colors.status.on}
            />
            <SummaryTile
              label="Floors"
              value={String(floors.length)}
              emoji="🏢"
            />
          </View>

          {/* ── Floors ── */}
          <SectionHeader
            title="Floors"
            onSeeAll={() => router.push('/dashboard/floors')}
          />
          {floors.map((floor) => (
            <FloorCard key={floor.id} floor={floor} />
          ))}

          {/* ── Recent Devices ── */}
          <SectionHeader
            title="Recent Devices"
            onSeeAll={() => router.push('/dashboard/devices')}
          />
          <View style={styles.deviceGrid}>
            {recentDevices.map((device) => (
              <DeviceCard key={device.id} device={device} onToggle={handleToggle} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  emoji,
  accent,
}: {
  label: string;
  value: string;
  emoji: string;
  accent?: string;
}) {
  return (
    <View style={summaryStyles.tile}>
      <Text style={summaryStyles.emoji}>{emoji}</Text>
      <Text style={[summaryStyles.value, accent ? { color: accent } : {}]}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} accessible accessibilityLabel={`See all ${title}`}>
          <Text style={sectionStyles.seeAll}>See all →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
  },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 2,
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },

  deviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
});

const summaryStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  emoji: { fontSize: 22 },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  label: {
    fontSize: 11,
    color: Colors.text.muted,
    textAlign: 'center',
  },
});

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent.blue,
  },
});
