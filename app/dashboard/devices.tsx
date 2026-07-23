import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeviceCard from '@/components/DeviceCard';
import { Colors } from '@/constants/colors';
import {
    getDevices,
    getDevicesByFloor,
    getFloorById,
    toggleDevice,
} from '@/services/deviceService';
import { Device, DeviceType } from '@/types/device';

const DEVICE_TYPES: Array<DeviceType | 'all'> = [
  'all',
  'light',
  'thermostat',
  'lock',
  'camera',
  'fan',
  'tv',
  'speaker',
  'outlet',
];

export default function DevicesScreen() {
  const { floorId } = useLocalSearchParams<{ floorId?: string }>();

  const [devices, setDevices] = useState<Device[]>([]);
  const [floorName, setFloorName] = useState<string>('All Devices');
  const [filter, setFilter] = useState<DeviceType | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const all = floorId
        ? await getDevicesByFloor(floorId)
        : await getDevices();
      setDevices(all);

      if (floorId) {
        const floor = await getFloorById(floorId);
        if (floor) setFloorName(floor.name);
      }
      setLoading(false);
    };
    load();
  }, [floorId]);

  const handleToggle = useCallback(async (id: string) => {
    const updated = await toggleDevice(id);
    if (updated) {
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    }
  }, []);

  const filtered =
    filter === 'all' ? devices : devices.filter((d) => d.type === filter);

  // Only show filter chips for types that exist in current device list
  const availableTypes: Array<DeviceType | 'all'> = [
    'all',
    ...(Array.from(new Set(devices.map((d) => d.type))) as DeviceType[]),
  ];

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
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{floorName}</Text>
            {!loading && (
              <Text style={styles.subtitle}>
                {filtered.length} device{filtered.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          data={availableTypes}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, filter === item && styles.chipActive]}
              onPress={() => setFilter(item)}
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item }}
              accessibilityLabel={`Filter by ${item}`}
            >
              <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        />

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.accent.blue}
            style={{ marginTop: 60 }}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <DeviceCard device={item} onToggle={handleToggle} />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No devices match this filter.</Text>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerCenter: { alignItems: 'center' },
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
  title: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },

  filterList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  chipActive: {
    backgroundColor: Colors.accent.blue,
    borderColor: Colors.accent.blue,
  },
  chipText: { fontSize: 13, color: Colors.text.muted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  row: { gap: 12, marginBottom: 12 },

  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: Colors.text.muted,
    fontSize: 15,
  },
});
