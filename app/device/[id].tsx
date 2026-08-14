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
import { getDeviceById, getStatusLabel, subscribeToDevices, toggleDevice, updateDevice } from '@/services/deviceService';
import { Device } from '@/types/device';

// ─── Icon map ────────────────────────────────────────────────────────────────

const DEVICE_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
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

// ─── Reusable primitives ─────────────────────────────────────────────────────

function SectionCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={panelStyles.card}>
      <View style={panelStyles.cardHeader}>
        <View style={[panelStyles.cardAccentBar, { backgroundColor: accentColor }]} />
        <Text style={panelStyles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={panelStyles.infoRow}>
      <Text style={panelStyles.infoLabel}>{label}</Text>
      <Text style={[panelStyles.infoValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

// ─── Brightness Slider ───────────────────────────────────────────────────────

function BrightnessSlider({
  value,
  accentColor,
  onChange,
}: {
  value: number;
  accentColor: string;
  onChange: (v: number) => void;
}) {
  const levels = [0, 25, 50, 75, 100];
  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${value}%`, backgroundColor: accentColor }]} />
      </View>
      <View style={sliderStyles.steps}>
        {levels.map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={[
              sliderStyles.step,
              value >= lvl && { backgroundColor: accentColor },
            ]}
            onPress={() => onChange(lvl)}
          >
            <Text style={sliderStyles.stepLabel}>{lvl}%</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── LIGHT PANEL ─────────────────────────────────────────────────────────────

function LightPanel({ device, accentColor, onUpdate }: { device: Device; accentColor: string; onUpdate: (d: Device) => void }) {
  const brightness = device.value ?? 0;
  const colorTemps = [
    { label: '🕯️ Warm', value: 'warm' },
    { label: '☀️ Daylight', value: 'day' },
    { label: '❄️ Cool', value: 'cool' },
  ];
  const [colorTemp, setColorTemp] = useState('day');
  const [scheduleOn, setScheduleOn] = useState(false);

  const handleBrightness = useCallback(
    async (v: number) => {
      const updated = await updateDevice(device.id, { value: v });
      if (updated) onUpdate(updated);
    },
    [device.id, onUpdate],
  );

  const usageWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(usageWidth, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <>
      {/* Brightness */}
      <SectionCard title="Brightness" accentColor={accentColor}>
        <View style={lightStyles.brightnessRow}>
          <Ionicons name="sunny-outline" size={18} color={Colors.text.muted} />
          <Text style={[lightStyles.brightnessValue, { color: accentColor }]}>{brightness}%</Text>
          <Ionicons name="sunny" size={22} color={accentColor} />
        </View>
        <BrightnessSlider value={brightness} accentColor={accentColor} onChange={handleBrightness} />
      </SectionCard>

      {/* Color Temperature */}
      <SectionCard title="Color Temperature" accentColor={accentColor}>
        <View style={lightStyles.tempRow}>
          {colorTemps.map((ct) => (
            <TouchableOpacity
              key={ct.value}
              style={[
                lightStyles.tempChip,
                colorTemp === ct.value && { borderColor: accentColor, backgroundColor: `${accentColor}22` },
              ]}
              onPress={() => setColorTemp(ct.value)}
            >
              <Text style={[lightStyles.tempChipText, colorTemp === ct.value && { color: accentColor }]}>
                {ct.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {/* Schedule & Usage */}
      <SectionCard title="Schedule & Usage" accentColor={accentColor}>
        <View style={lightStyles.scheduleRow}>
          <View>
            <Text style={panelStyles.infoLabel}>Auto Schedule</Text>
            <Text style={lightStyles.scheduleTime}>07:00 – 23:00</Text>
          </View>
          <SwitchButton value={scheduleOn} onToggle={() => setScheduleOn((p) => !p)} size="sm" />
        </View>
        <View style={lightStyles.usageBarBg}>
          <Animated.View
            style={[
              lightStyles.usageBarFill,
              {
                backgroundColor: accentColor,
                width: usageWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.min(brightness, 100)}%`] }),
              },
            ]}
          />
        </View>
        <View style={lightStyles.usageLabels}>
          <Text style={panelStyles.infoLabel}>Daily Usage</Text>
          <Text style={[panelStyles.infoValue, { color: accentColor }]}>{(brightness / 100 * 4.8).toFixed(1)} kWh</Text>
        </View>
      </SectionCard>
    </>
  );
}

// ─── OUTLET PANEL ────────────────────────────────────────────────────────────

function OutletPanel({ device, accentColor }: { device: Device; accentColor: string }) {
  const wattage = 340 + Math.round(Math.random() * 20);
  const powerUsage = 2.4;
  const maxPower = 3.5;
  const pct = Math.min((powerUsage / maxPower) * 100, 100);
  const gaugeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(gaugeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  const statusHistory = ['on', 'off', 'on', 'on', 'off', 'on', 'on', 'on'];

  return (
    <>
      <SectionCard title="Power Consumption" accentColor={accentColor}>
        {/* Wattage readout */}
        <View style={outletStyles.wattageRow}>
          <View style={[outletStyles.wattageIcon, { backgroundColor: `${accentColor}22` }]}>
            <Ionicons name="flash" size={28} color={accentColor} />
          </View>
          <View>
            <Text style={[outletStyles.wattage, { color: accentColor }]}>{wattage} W</Text>
            <Text style={panelStyles.infoLabel}>Live Draw</Text>
          </View>
          <View style={outletStyles.separator} />
          <View>
            <Text style={[outletStyles.wattage, { color: Colors.text.secondary }]}>{powerUsage} kWh</Text>
            <Text style={panelStyles.infoLabel}>Today</Text>
          </View>
        </View>

        {/* Usage gauge */}
        <View style={outletStyles.gaugeLabel}>
          <Text style={panelStyles.infoLabel}>Load</Text>
          <Text style={[panelStyles.infoValue, { color: accentColor }]}>{pct.toFixed(0)}%</Text>
        </View>
        <View style={outletStyles.gaugeBg}>
          <Animated.View
            style={[
              outletStyles.gaugeFill,
              {
                backgroundColor: accentColor,
                width: gaugeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] }),
              },
            ]}
          />
        </View>
      </SectionCard>

      <SectionCard title="Status History (last 8 hrs)" accentColor={accentColor}>
        <View style={outletStyles.historyRow}>
          {statusHistory.map((s, i) => (
            <View
              key={i}
              style={[
                outletStyles.historyBar,
                { backgroundColor: s === 'on' ? accentColor : Colors.bg.elevated },
              ]}
            />
          ))}
        </View>
        <View style={outletStyles.historyLabels}>
          <Text style={panelStyles.infoLabel}>8 hrs ago</Text>
          <Text style={panelStyles.infoLabel}>Now</Text>
        </View>
        <InfoRow label="Voltage" value="230 V" />
        <InfoRow label="Current" value="1.48 A" />
        <InfoRow label="Power Factor" value="0.98" valueColor={Colors.status.on} />
      </SectionCard>
    </>
  );
}

// ─── MULTI-SWITCH PANEL ───────────────────────────────────────────────────────

const MULTI_CIRCUITS = [
  { id: 'c1', label: 'Circuit 1 — Ceiling Light', defaultOn: true },
  { id: 'c2', label: 'Circuit 2 — Wall Lamp', defaultOn: false },
  { id: 'c3', label: 'Circuit 3 — Desk Lamp', defaultOn: true },
  { id: 'c4', label: 'Circuit 4 — Fan', defaultOn: false },
];

function MultiSwitchPanel({ accentColor }: { accentColor: string }) {
  const [circuits, setCircuits] = useState(
    MULTI_CIRCUITS.map((c) => ({ ...c, on: c.defaultOn })),
  );
  const activeCount = circuits.filter((c) => c.on).length;

  const toggle = (id: string) => {
    setCircuits((prev) => prev.map((c) => (c.id === id ? { ...c, on: !c.on } : c)));
  };

  return (
    <>
      <SectionCard title="Individual Switches" accentColor={accentColor}>
        <View style={multiStyles.overallRow}>
          <View style={[multiStyles.badge, { backgroundColor: `${accentColor}22`, borderColor: accentColor }]}>
            <Text style={[multiStyles.badgeText, { color: accentColor }]}>{activeCount}/{circuits.length} ON</Text>
          </View>
          <Text style={panelStyles.infoLabel}>Overall Status</Text>
        </View>
        {circuits.map((circuit, idx) => (
          <View
            key={circuit.id}
            style={[multiStyles.circuitRow, idx < circuits.length - 1 && multiStyles.circuitBorder]}
          >
            <View style={multiStyles.circuitLeft}>
              <View style={[multiStyles.statusDot, { backgroundColor: circuit.on ? accentColor : Colors.bg.elevated }]} />
              <View>
                <Text style={multiStyles.circuitLabel}>{circuit.label}</Text>
                <Text style={panelStyles.infoLabel}>{circuit.on ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
            <SwitchButton value={circuit.on} onToggle={() => toggle(circuit.id)} size="sm" />
          </View>
        ))}
      </SectionCard>
    </>
  );
}

// ─── IRON / FAN / SAFETY PANEL ────────────────────────────────────────────────

function SafetyPanel({
  device,
  accentColor,
}: {
  device: Device;
  accentColor: string;
}) {
  const [maxDuration, setMaxDuration] = useState(30);
  const [autoCutoff, setAutoCutoff] = useState(true);
  const isIron = device.type === 'iron';

  const heatLevels = ['Low', 'Medium', 'High', 'Max'];
  const [heatLevel, setHeatLevel] = useState('Medium');

  return (
    <>
      {/* Max Duration */}
      <SectionCard title={isIron ? 'Iron Timer' : 'Run Duration'} accentColor={accentColor}>
        <View style={safetyStyles.durationRow}>
          <TouchableOpacity
            style={safetyStyles.durationBtn}
            onPress={() => setMaxDuration((p) => Math.max(5, p - 5))}
          >
            <Ionicons name="remove" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={safetyStyles.durationDisplay}>
            <Text style={[safetyStyles.durationValue, { color: accentColor }]}>{maxDuration}</Text>
            <Text style={safetyStyles.durationUnit}>min</Text>
          </View>
          <TouchableOpacity
            style={safetyStyles.durationBtn}
            onPress={() => setMaxDuration((p) => Math.min(120, p + 5))}
          >
            <Ionicons name="add" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {isIron && (
          <>
            <Text style={[panelStyles.infoLabel, { marginTop: 12, marginBottom: 8 }]}>Heat Setting</Text>
            <View style={safetyStyles.heatRow}>
              {heatLevels.map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    safetyStyles.heatChip,
                    heatLevel === lvl && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}
                  onPress={() => setHeatLevel(lvl)}
                >
                  <Text style={[safetyStyles.heatChipText, heatLevel === lvl && { color: '#fff' }]}>{lvl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </SectionCard>

      {/* Safety Status */}
      <SectionCard title="Safety Status" accentColor={accentColor}>
        <View style={[safetyStyles.statusBanner, { borderLeftColor: Colors.status.on }]}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.status.on} />
          <Text style={[safetyStyles.statusBannerText, { color: Colors.status.on }]}>
            All safety checks passed
          </Text>
        </View>
        <InfoRow label="Overheat Protection" value="✓ Active" valueColor={Colors.status.on} />
        <InfoRow label="Last Safety Check" value="2 min ago" />
        <InfoRow label="Tip-over Sensor" value={isIron ? '✓ OK' : 'N/A'} />

        <View style={safetyStyles.autoCutoffRow}>
          <View>
            <Text style={panelStyles.infoValue}>Auto Cutoff</Text>
            <Text style={panelStyles.infoLabel}>Turns off after {maxDuration} min</Text>
          </View>
          <SwitchButton value={autoCutoff} onToggle={() => setAutoCutoff((p) => !p)} size="sm" />
        </View>
      </SectionCard>
    </>
  );
}

// ─── CAMERA PANEL ────────────────────────────────────────────────────────────

function CameraPanel({ device, accentColor }: { device: Device; accentColor: string }) {
  const [streaming, setStreaming] = useState(false);
  const [motionAlert, setMotionAlert] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    if (streaming) loop.start();
    else loop.stop();
    return () => loop.stop();
  }, [streaming]);

  const isOnline = device.status === 'on';
  const connectionQuality = isOnline ? 'Excellent' : 'Offline';
  const connectionColor = isOnline ? Colors.status.on : Colors.status.offline;

  return (
    <>
      {/* Snapshot / Stream */}
      <SectionCard title="Camera View" accentColor={accentColor}>
        <View style={cameraStyles.viewPort}>
          <LinearGradient
            colors={['#0d2044', '#0a1628']}
            style={StyleSheet.absoluteFillObject}
          />
          {streaming ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="videocam" size={48} color={accentColor} />
            </Animated.View>
          ) : (
            <View style={cameraStyles.snapshotContent}>
              <Ionicons name="camera-outline" size={48} color={Colors.text.muted} />
              <Text style={cameraStyles.snapshotText}>Tap to load snapshot</Text>
            </View>
          )}
          {streaming && (
            <View style={cameraStyles.liveTag}>
              <View style={cameraStyles.liveDot} />
              <Text style={cameraStyles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={cameraStyles.controls}>
          <TouchableOpacity
            style={[cameraStyles.ctaBtn, streaming && { backgroundColor: Colors.status.error + '33', borderColor: Colors.status.error }]}
            onPress={() => setStreaming((p) => !p)}
            disabled={!isOnline}
          >
            <Ionicons
              name={streaming ? 'stop-circle-outline' : 'play-circle-outline'}
              size={20}
              color={streaming ? Colors.status.error : accentColor}
            />
            <Text style={[cameraStyles.ctaBtnText, { color: streaming ? Colors.status.error : accentColor }]}>
              {streaming ? 'Stop Stream' : 'Live Stream'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cameraStyles.snapshotBtn}
            disabled={!isOnline}
          >
            <Ionicons name="camera" size={18} color={Colors.text.secondary} />
            <Text style={cameraStyles.snapshotBtnText}>Snapshot</Text>
          </TouchableOpacity>
        </View>
      </SectionCard>

      {/* Connection & Alerts */}
      <SectionCard title="Connection & Alerts" accentColor={accentColor}>
        <View style={[cameraStyles.connectionRow, { borderLeftColor: connectionColor }]}>
          <View style={[cameraStyles.connectionDot, { backgroundColor: connectionColor }]} />
          <View>
            <Text style={[cameraStyles.connectionLabel, { color: connectionColor }]}>{connectionQuality}</Text>
            <Text style={panelStyles.infoLabel}>Connection Quality</Text>
          </View>
        </View>
        <InfoRow label="Resolution" value="1080p HD" />
        <InfoRow label="Night Vision" value="Auto" />
        <InfoRow label="Storage" value="Cloud + Local" />

        <View style={safetyStyles.autoCutoffRow}>
          <View>
            <Text style={panelStyles.infoValue}>Motion Alerts</Text>
            <Text style={panelStyles.infoLabel}>Notify on movement detected</Text>
          </View>
          <SwitchButton value={motionAlert} onToggle={() => setMotionAlert((p) => !p)} size="sm" />
        </View>
      </SectionCard>
    </>
  );
}

// ─── DEVICE-SPECIFIC PANEL DISPATCHER ───────────────────────────────────────

function DeviceSpecificPanel({
  device,
  accentColor,
  onUpdate,
}: {
  device: Device;
  accentColor: string;
  onUpdate: (d: Device) => void;
}) {
  switch (device.type) {
    case 'light':
      return <LightPanel device={device} accentColor={accentColor} onUpdate={onUpdate} />;
    case 'outlet':
      return <OutletPanel device={device} accentColor={accentColor} />;
    case 'multiSwitch':
      return <MultiSwitchPanel accentColor={accentColor} />;
    case 'iron':
    case 'fan':
    case 'thermostat':
      return <SafetyPanel device={device} accentColor={accentColor} />;
    case 'camera':
      return <CameraPanel device={device} accentColor={accentColor} />;
    default:
      return null;
  }
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

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

  // Real-time sync for this single device: merge payload into local state.
  useEffect(() => {
    if (!id) return;
    return subscribeToDevices((event, updated) => {
      if (event === 'DELETE') {
        setDevice(null);
      } else if (updated) {
        setDevice(updated);
      }
    }, `id=eq.${id}`);
  }, [id]);

  const handleToggle = useCallback(async () => {
    if (!device) return;
    const updated = await toggleDevice(device.id);
    if (updated) setDevice(updated);
  }, [device]);

  const handleUpdate = useCallback((updated: Device) => {
    setDevice(updated);
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

  const isOn = device.status === 'on';
  const isInteractable = device.status !== 'offline' && device.status !== 'error';
  const accentColor = (Colors.device as Record<string, string>)[device.type] ?? Colors.accent.blue;
  const iconName = DEVICE_ICON_MAP[device.type] ?? 'settings-outline';

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
          <Text style={styles.headerTitle}>Device Detail</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View style={[styles.heroCard, isOn && styles.heroCardActive]}>
            {/* Glow ring behind icon */}
            {isOn && (
              <View
                style={[styles.glowRing, { shadowColor: accentColor }]}
                pointerEvents="none"
              />
            )}

            {/* Icon */}
            <View style={[styles.heroIconWrapper, { backgroundColor: `${accentColor}22` }]}>
              <Ionicons name={iconName} size={44} color={accentColor} />
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

          {/* ── Device-specific panels ── */}
          <DeviceSpecificPanel device={device} accentColor={accentColor} onUpdate={handleUpdate} />

          {/* Details table */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Details</Text>
            <InfoRow label="Type" value={device.type.charAt(0).toUpperCase() + device.type.slice(1)} />
            <InfoRow label="Floor" value={device.floorId.toUpperCase()} />
            <InfoRow label="Room" value={device.roomName} />
            <InfoRow label="Status" value={getStatusLabel(device.status)} />
            <InfoRow
              label="Last Updated"
              value={new Date(device.lastUpdated).toLocaleTimeString()}
            />
          </View>

          {/* Quick actions */}
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <ActionButton label="Schedule" icon="time-outline" accentColor={accentColor} onPress={() => router.push(`/schedule/${device.id}`)} />
              <ActionButton label="Automate" icon="git-branch-outline" accentColor={accentColor} onPress={() => {}} />
              <ActionButton label="History" icon="bar-chart-outline" accentColor={accentColor} onPress={() => {}} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  accentColor,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
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
      <View style={[actionStyles.iconBg, { backgroundColor: `${accentColor}18` }]}>
        <Ionicons name={icon} size={22} color={accentColor} />
      </View>
      <Text style={actionStyles.label}>{label}</Text>
    </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },

  // Hero
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
    borderColor: 'rgba(77,124,244,0.45)',
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

  // Details card
  detailsCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 10,
  },

  // Actions card
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

const actionStyles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    minWidth: 80,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 12, color: Colors.text.secondary, fontWeight: '600' },
});

// ─── Panel shared styles ──────────────────────────────────────────────────────

const panelStyles = StyleSheet.create({
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
  cardAccentBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  infoLabel: { fontSize: 13, color: Colors.text.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
});

// ─── Light specific ───────────────────────────────────────────────────────────

const lightStyles = StyleSheet.create({
  brightnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brightnessValue: { fontSize: 32, fontWeight: '800' },
  tempRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tempChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.elevated,
  },
  tempChipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '600' },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  scheduleTime: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginTop: 2 },
  usageBarBg: {
    height: 8,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  usageBarFill: { height: '100%', borderRadius: 4 },
  usageLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});

// ─── Slider styles ────────────────────────────────────────────────────────────

const sliderStyles = StyleSheet.create({
  container: { gap: 10 },
  track: {
    height: 6,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  step: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  stepLabel: { fontSize: 11, color: Colors.text.muted, fontWeight: '600' },
});

// ─── Outlet specific ──────────────────────────────────────────────────────────

const outletStyles = StyleSheet.create({
  wattageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  wattageIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wattage: { fontSize: 22, fontWeight: '800' },
  separator: { width: 1, height: 36, backgroundColor: Colors.border.subtle, marginHorizontal: 4 },
  gaugeLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gaugeBg: { height: 10, backgroundColor: Colors.bg.elevated, borderRadius: 5, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 5 },
  historyRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
    height: 36,
    alignItems: 'flex-end',
  },
  historyBar: {
    flex: 1,
    height: 36,
    borderRadius: 4,
  },
  historyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});

// ─── Multi-switch specific ────────────────────────────────────────────────────

const multiStyles = StyleSheet.create({
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  circuitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  circuitBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  circuitLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  circuitLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
});

// ─── Safety / Iron / Fan specific ─────────────────────────────────────────────

const safetyStyles = StyleSheet.create({
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  durationBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationDisplay: { alignItems: 'center' },
  durationValue: { fontSize: 40, fontWeight: '900', lineHeight: 46 },
  durationUnit: { fontSize: 14, color: Colors.text.muted, fontWeight: '600' },
  heatRow: { flexDirection: 'row', gap: 8 },
  heatChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
  },
  heatChipText: { fontSize: 12, fontWeight: '600', color: Colors.text.muted },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${Colors.status.on}15`,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  statusBannerText: { fontSize: 14, fontWeight: '600' },
  autoCutoffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
});

// ─── Camera specific ──────────────────────────────────────────────────────────

const cameraStyles = StyleSheet.create({
  viewPort: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: Colors.bg.primary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  snapshotContent: { alignItems: 'center', gap: 8 },
  snapshotText: { color: Colors.text.muted, fontSize: 13 },
  liveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.status.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  controls: { flexDirection: 'row', gap: 10 },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.elevated,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700' },
  snapshotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.elevated,
  },
  snapshotBtnText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '600' },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  connectionDot: { width: 10, height: 10, borderRadius: 5 },
  connectionLabel: { fontSize: 15, fontWeight: '700' },
});
