import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwitchButton from '@/components/SwitchButton';
import { Colors } from '@/constants/colors';
import { getDeviceById } from '@/services/deviceService';
import { addSchedule, deleteSchedule, getSchedulesForDevice, toggleSchedule, updateSchedule } from '@/services/scheduleService';
import { Device, Schedule } from '@/types/device';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function getDaysDisplay(days?: number[]): string {
  if (!days || days.length === 0) return 'Never';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return days.map((d) => DAYS_OF_WEEK[d]).join(', ');
}

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const accentColor = device ? (Colors.device as Record<string, string>)[device.type] ?? Colors.accent.blue : Colors.accent.blue;

  useEffect(() => {
    if (!id) return;
    Promise.all([getDeviceById(id), getSchedulesForDevice(id)]).then(([dev, scheds]) => {
      setDevice(dev ?? null);
      setSchedules(scheds);
      setLoading(false);
    });
  }, [id]);

  const timeSchedules = schedules.filter((s) => s.type === 'time');

  const handleToggleTime = useCallback(async (scheduleId: string) => {
    const updated = await toggleSchedule(scheduleId);
    if (updated) {
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  }, []);

  const handleDeleteTime = useCallback(async (scheduleId: string) => {
    Alert.alert('Delete Schedule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteSchedule(scheduleId);
          if (success) {
            setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
          }
        },
      },
    ]);
  }, []);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a1628', '#0d2044', '#0a1628']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedules</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push(`/schedule/edit/new?deviceId=${device.id}`)}>
            <Ionicons name="add" size={24} color={accentColor} />
          </TouchableOpacity>
        </View>
        <View style={styles.deviceInfo}>
          <View style={[styles.deviceIconWrapper, { backgroundColor: `${accentColor}22` }]}>
            <Ionicons name="time" size={24} color={accentColor} />
          </View>
          <View>
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={styles.deviceRoom}>{device.roomName}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />
              <Text style={styles.cardTitle}>Schedules ({timeSchedules.length})</Text>
            </View>
            {timeSchedules.map((schedule) => (
              <View key={schedule.id} style={styles.scheduleCard}>
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleLeft}>
                    <View style={[styles.scheduleIcon, { backgroundColor: `${accentColor}22` }]}>
                      <Ionicons name={schedule.action === 'on' ? 'power' : 'power-outline'} size={18} color={accentColor} />
                    </View>
                    <View>
                      <Text style={styles.scheduleTime}>{schedule.time ? formatTime(schedule.time) : '--:--'}</Text>
                      <Text style={styles.scheduleDays}>{getDaysDisplay(schedule.days)}</Text>
                      <Text style={[styles.scheduleAction, { color: schedule.action === 'on' ? Colors.status.on : Colors.text.muted }]}>
                        Turn {schedule.action?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <SwitchButton value={schedule.enabled} onToggle={() => handleToggleTime(schedule.id)} size="sm" />
                </View>
                <View style={styles.scheduleActions}>
                  <TouchableOpacity onPress={() => router.push(`/schedule/edit/${schedule.id}?deviceId=${device.id}`)}>
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTime(schedule.id)}>
                    <Text style={[styles.actionText, { color: Colors.status.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {timeSchedules.length === 0 && <Text style={styles.emptyText}>No schedules yet. Tap + to add one.</Text>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.primary },
  errorText: { color: Colors.text.muted, fontSize: 16, marginBottom: 16 },
  backBtnCenter: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.accent.blue, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  deviceIconWrapper: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deviceName: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  deviceRoom: { fontSize: 13, color: Colors.text.muted },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionCard: { backgroundColor: Colors.bg.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.border.default },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardAccentBar: { width: 4, height: 16, borderRadius: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  scheduleCard: { backgroundColor: Colors.bg.elevated, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border.subtle, marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  scheduleIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scheduleTime: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  scheduleDays: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  scheduleAction: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  scheduleActions: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
  actionText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  emptyText: { fontSize: 14, color: Colors.text.muted, textAlign: 'center', paddingVertical: 20 },
});
