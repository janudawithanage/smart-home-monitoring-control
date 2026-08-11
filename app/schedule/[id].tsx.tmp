import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { getDeviceById } from '@/services/deviceService';
import {
    addSchedule,
    getScheduleById,
    updateSchedule,
} from '@/services/scheduleService';
import { Device, Schedule } from '@/types/device';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', full: 'Sunday' },
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
];

const QUICK_TIMES = [
  { label: 'Morning', time: '07:00' },
  { label: 'Noon', time: '12:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '22:00' },
];

// ─── Time Picker Component ────────────────────────────────────────────────────

function TimePicker({
  value,
  onChange,
  accentColor,
}: {
  value: string;
  onChange: (time: string) => void;
  accentColor: string;
}) {
  const [hours, minutes] = value.split(':').map(Number);

  const incrementHours = () => {
    const newHours = (hours + 1) % 24;
    onChange(`${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };

  const decrementHours = () => {
    const newHours = hours === 0 ? 23 : hours - 1;
    onChange(`${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };

  const incrementMinutes = () => {
    const newMinutes = (minutes + 5) % 60;
    onChange(`${String(hours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`);
  };

  const decrementMinutes = () => {
    const newMinutes = minutes === 0 ? 55 : minutes - 5;
    onChange(`${String(hours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`);
  };

  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';

  return (
    <View style={timeStyles.container}>
      <View style={timeStyles.quickTimes}>
        {QUICK_TIMES.map((qt) => (
          <TouchableOpacity
            key={qt.label}
            style={[
              timeStyles.quickChip,
              value === qt.time && {
                backgroundColor: accentColor,
                borderColor: accentColor,
              },
            ]}
            onPress={() => onChange(qt.time)}
          >
            <Text
              style={[
                timeStyles.quickChipText,
                value === qt.time && { color: '#fff', fontWeight: '700' },
              ]}
            >
              {qt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={timeStyles.pickerRow}>
        {/* Hours */}
        <View style={timeStyles.pickerColumn}>
          <TouchableOpacity style={timeStyles.pickerBtn} onPress={incrementHours}>
            <Ionicons name="chevron-up" size={24} color={accentColor} />
          </TouchableOpacity>
          <View style={[timeStyles.pickerValue, { borderColor: accentColor }]}>
            <Text style={[timeStyles.pickerValueText, { color: accentColor }]}>
              {String(displayHours).padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity style={timeStyles.pickerBtn} onPress={decrementHours}>
            <Ionicons name="chevron-down" size={24} color={accentColor} />
          </TouchableOpacity>
        </View>

        <Text style={timeStyles.colon}>:</Text>

        {/* Minutes */}
        <View style={timeStyles.pickerColumn}>
          <TouchableOpacity style={timeStyles.pickerBtn} onPress={incrementMinutes}>
            <Ionicons name="chevron-up" size={24} color={accentColor} />
          </TouchableOpacity>
          <View style={[timeStyles.pickerValue, { borderColor: accentColor }]}>
            <Text style={[timeStyles.pickerValueText, { color: accentColor }]}>
              {String(minutes).padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity style={timeStyles.pickerBtn} onPress={decrementMinutes}>
            <Ionicons name="chevron-down" size={24} color={accentColor} />
          </TouchableOpacity>
        </View>

        {/* AM/PM */}
        <View style={[timeStyles.ampmBadge, { backgroundColor: `${accentColor}22`, borderColor: accentColor }]}>
          <Text style={[timeStyles.ampmText, { color: accentColor }]}>{ampm}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditScheduleScreen() {
  const { scheduleId, deviceId } = useLocalSearchParams<{ scheduleId: string; deviceId: string }>();
  const isNew = scheduleId === 'new';

  const [device, setDevice] = useState<Device | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const [time, setTime] = useState('07:00');
  const [action, setAction] = useState<'on' | 'off'>('on');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays by default
  const [loading, setLoading] = useState(true);

  const accentColor = device
    ? (Colors.device as Record<string, string>)[device.type] ?? Colors.accent.blue
    : Colors.accent.blue;

  useEffect(() => {
    if (!deviceId) return;

    const load = async () => {
      const dev = await getDeviceById(deviceId);
      setDevice(dev ?? null);

      if (!isNew && scheduleId) {
        const sch = await getScheduleById(scheduleId);
        if (sch) {
          setSchedule(sch);
          setTime(sch.time ?? '07:00');
          setAction(sch.action ?? 'on');
          setSelectedDays(sch.days ?? [1, 2, 3, 4, 5]);
        }
      }

      setLoading(false);
    };

    load();
  }, [deviceId, scheduleId, isNew]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!device) return;

    if (selectedDays.length === 0) {
      Alert.alert('No Days Selected', 'Please select at least one day for the schedule.');
      return;
    }

    if (isNew) {
      // Create new
      const newSchedule = await addSchedule({
        deviceId: device.id,
        type: 'time',
        enabled: true,
        time,
        action,
        days: selectedDays,
      });

      if (newSchedule) {
        Alert.alert('Schedule Created', 'Your schedule has been saved successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } else {
      // Update existing
      if (!schedule) return;
      const updated = await updateSchedule(schedule.id, { time, action, days: selectedDays });
      if (updated) {
        Alert.alert('Schedule Updated', 'Your changes have been saved.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    }
  };

  if (loading || !device) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNew ? 'New Schedule' : 'Edit Schedule'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Device Info */}
          <View style={styles.deviceCard}>
            <View style={[styles.deviceIcon, { backgroundColor: `${accentColor}22` }]}>
              <Ionicons name="hardware-chip" size={20} color={accentColor} />
            </View>
            <View>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceRoom}>{device.roomName}</Text>
            </View>
          </View>

          {/* Time Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time</Text>
            <TimePicker value={time} onChange={setTime} accentColor={accentColor} />
          </View>

          {/* Action Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  action === 'on' && {
                    backgroundColor: Colors.status.on,
                    borderColor: Colors.status.on,
                  },
                ]}
                onPress={() => setAction('on')}
              >
                <Ionicons
                  name="power"
                  size={20}
                  color={action === 'on' ? '#fff' : Colors.text.secondary}
                />
                <Text style={[styles.actionBtnText, action === 'on' && { color: '#fff', fontWeight: '700' }]}>
                  Turn ON
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  action === 'off' && {
                    backgroundColor: Colors.text.muted,
                    borderColor: Colors.text.muted,
                  },
                ]}
                onPress={() => setAction('off')}
              >
                <Ionicons
                  name="power-outline"
                  size={20}
                  color={action === 'off' ? '#fff' : Colors.text.secondary}
                />
                <Text style={[styles.actionBtnText, action === 'off' && { color: '#fff', fontWeight: '700' }]}>
                  Turn OFF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Days Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeat On</Text>
            <View style={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayChip,
                    selectedDays.includes(day.id) && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      selectedDays.includes(day.id) && { color: '#fff', fontWeight: '700' },
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick presets */}
            <View style={styles.dayPresets}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setSelectedDays([1, 2, 3, 4, 5])}
              >
                <Text style={styles.presetText}>Weekdays</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setSelectedDays([0, 6])}
              >
                <Text style={styles.presetText}>Weekends</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
              >
                <Text style={styles.presetText}>Every Day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary */}
          <View style={[styles.summaryCard, { borderLeftColor: accentColor }]}>
            <Ionicons name="information-circle" size={20} color={accentColor} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Schedule Summary</Text>
              <Text style={styles.summaryText}>
                {device.name} will turn <Text style={{ fontWeight: '700' }}>{action.toUpperCase()}</Text> at{' '}
                <Text style={{ fontWeight: '700' }}>
                  {(() => {
                    const [h, m] = time.split(':').map(Number);
                    const displayHour = h % 12 || 12;
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
                  })()}
                </Text>{' '}
                on{' '}
                {selectedDays.length === 7
                  ? 'every day'
                  : selectedDays.length === 5 &&
                    !selectedDays.includes(0) &&
                    !selectedDays.includes(6)
                  ? 'weekdays'
                  : selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6)
                  ? 'weekends'
                  : selectedDays.map((d) => DAYS_OF_WEEK[d].label).join(', ')}
                .
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accentColor }]} onPress={handleSave}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{isNew ? 'Create Schedule' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
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
  loadingText: { color: Colors.text.muted, fontSize: 14 },

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
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 20 },

  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  deviceRoom: {
    fontSize: 12,
    color: Colors.text.muted,
  },

  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    paddingLeft: 4,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.border.default,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  dayPresets: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  summaryCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.text.muted,
    lineHeight: 20,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

const timeStyles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 18,
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },

  quickTimes: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickerColumn: {
    alignItems: 'center',
    gap: 8,
  },
  pickerBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  pickerValue: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: 16,
    borderWidth: 2,
  },
  pickerValueText: {
    fontSize: 36,
    fontWeight: '800',
  },
  colon: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text.primary,
    marginHorizontal: 4,
  },
  ampmBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  ampmText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
