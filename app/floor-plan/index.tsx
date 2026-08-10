/**
 * Floor Plan Screen
 *
 * Interactive floor plan viewer with device pins, status badges, and a
 * bottom-sheet detail panel for each device. Matches the dark glassmorphism
 * theme used throughout the rest of the app.
 */

import { Colors } from '@/constants/colors';
import {
    CAMERA_DEVICE_TYPES,
    FLOOR_PLAN_CONFIGS,
    getFloorPlanConfig,
    MULTI_SWITCH_TYPES,
    SAFETY_INFO,
    setDevicePin
} from '@/data/floorPlanData';
import { getDevices, getFloors, toggleDevice } from '@/services/deviceService';
import { Device, DeviceStatus, DeviceType, Floor } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    GestureResponderEvent,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// ─── Constants ─────────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const IOS_TOP    = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD      = 20;
const PIN_SIZE   = 42;

// ─── Type icons ────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<DeviceType, keyof typeof Ionicons.glyphMap> = {
  light:      'bulb-outline',
  thermostat: 'thermometer-outline',
  lock:       'lock-closed-outline',
  camera:     'camera-outline',
  fan:        'refresh-outline',
  tv:         'tv-outline',
  speaker:    'volume-high-outline',
  outlet:     'flash-outline',
  iron:       'water-outline',
  multiSwitch:'apps-outline',
};
const TYPE_ICON_FILLED: Record<DeviceType, keyof typeof Ionicons.glyphMap> = {
  light:      'bulb',
  thermostat: 'thermometer',
  lock:       'lock-closed',
  camera:     'camera',
  fan:        'refresh',
  tv:         'tv',
  speaker:    'volume-high',
  outlet:     'flash',
  iron:       'water',
  multiSwitch:'apps',
};

// ─── Status helpers ────────────────────────────────────────────────────────────
function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'on':      return '#30D158';
    case 'off':     return 'rgba(255,255,255,0.35)';
    case 'error':   return '#FF375F';
    case 'offline': return '#FF9F0A';
  }
}
function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'on':      return 'ON';
    case 'off':     return 'OFF';
    case 'error':   return 'ERROR';
    case 'offline': return 'DISCONNECTED';
  }
}
function getStatusIcon(status: DeviceStatus): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'on':      return 'checkmark-circle';
    case 'off':     return 'radio-button-off';
    case 'error':   return 'alert-circle';
    case 'offline': return 'cloud-offline';
  }
}

function getTypeColor(type: DeviceType): string {
  return (Colors.device as Record<string, string>)[type] ?? '#0A84FF';
}

// ─── Level meta (matching home screen) ─────────────────────────────────────────
const LEVEL_META: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'G',  icon: 'home-outline',      color: '#30D158' },
  { label: '1F', icon: 'bed-outline',        color: '#0A84FF' },
  { label: '2F', icon: 'telescope-outline',  color: '#BF5AF2' },
  { label: '3F', icon: 'business-outline',   color: '#FF9F0A' },
  { label: '4F', icon: 'flag-outline',       color: '#FF375F' },
];
function getLevelMeta(level: number) {
  return LEVEL_META[level] ?? { label: `${level}F`, icon: 'business-outline' as keyof typeof Ionicons.glyphMap, color: '#64D2FF' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV BAR
// ═══════════════════════════════════════════════════════════════════════════════
function FloorPlanNavBar({ floor }: { floor: Floor | null }) {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <TouchableOpacity style={S.navBackBtn} onPress={() => router.back()}
            accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.88)" />
          </TouchableOpacity>
          <View style={S.navCenter}>
            <Text style={S.navTitle} numberOfLines={1}>
              {floor ? floor.name : 'Floor Plan'}
            </Text>
            {floor && (
              <View style={[S.navLevelBadge, { borderColor: `${getLevelMeta(floor.level).color}55` }]}>
                <Ionicons name={getLevelMeta(floor.level).icon} size={11}
                  color={getLevelMeta(floor.level).color} />
                <Text style={[S.navLevelText, { color: getLevelMeta(floor.level).color }]}>
                  {getLevelMeta(floor.level).label}
                </Text>
              </View>
            )}
          </View>
          <View style={S.navIconBtn}>
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="map-outline" size={18} color="rgba(255,255,255,0.88)" />
            </BlurView>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════
function FloorSelectorBar({
  floors, selectedId, onSelect,
}: {
  floors: Floor[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={S.selectorOuter}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.selectorScroll}>
        {floors.map((floor) => {
          const active = floor.id === selectedId;
          const meta   = getLevelMeta(floor.level);
          return (
            <TouchableOpacity key={floor.id} onPress={() => onSelect(floor.id)}
              activeOpacity={0.8} accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <BlurView intensity={active ? 50 : 26} tint="dark"
                style={[S.selectorChip, active && { borderColor: `${meta.color}55` }]}>
                {active && (
                  <LinearGradient
                    colors={[`${meta.color}28`, `${meta.color}10`]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                )}
                <Ionicons name={meta.icon} size={14}
                  color={active ? meta.color : 'rgba(255,255,255,0.45)'} />
                <Text style={[S.selectorChipText, active && { color: meta.color }]}>
                  {floor.name}
                </Text>
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE PIN
// ═══════════════════════════════════════════════════════════════════════════════
function DevicePin({
  device, x, y, canvasWidth, canvasHeight, onPress, dimmed = false,
}: {
  device: Device;
  x: number;   // 0–100 %
  y: number;   // 0–100 %
  canvasWidth: number;
  canvasHeight: number;
  onPress: () => void;
  dimmed?: boolean;
}) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  // Pulse animation for active devices
  useEffect(() => {
    if (device.status === 'on') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
  }, [device.status]);

  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 10 }).start();

  const statusColor = getStatusColor(device.status);
  const typeColor   = getTypeColor(device.type);
  const isActive    = device.status === 'on';
  const isError     = device.status === 'error' || device.status === 'offline';

  // Convert % to absolute px on the canvas
  const pinX = (x / 100) * canvasWidth - PIN_SIZE / 2;
  const pinY = (y / 100) * canvasHeight - PIN_SIZE / 2;

  return (
    <Animated.View
      style={[
        S.pinAbsolute,
        { left: pinX, top: pinY, transform: [{ scale: scaleAnim }], opacity: dimmed ? 0.35 : 1 },
      ]}
    >
      {/* Pulse ring for active devices */}
      {isActive && (
        <Animated.View style={[S.pinPulse, { borderColor: typeColor, transform: [{ scale: pulseAnim }] }]} />
      )}
      {/* Error ring flash */}
      {isError && (
        <View style={[S.pinErrorRing, { borderColor: statusColor }]} />
      )}

      <TouchableOpacity
        style={[S.pinBtn, {
          backgroundColor: isActive ? `${typeColor}22` : 'rgba(6,9,26,0.75)',
          borderColor: isActive ? `${typeColor}55` : 'rgba(255,255,255,0.2)',
        }]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`${device.name}, ${getStatusLabel(device.status)}`}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.pinSpecular} />
        <Ionicons
          name={isActive ? TYPE_ICON_FILLED[device.type] : TYPE_ICON[device.type]}
          size={18}
          color={isActive ? typeColor : 'rgba(255,255,255,0.5)'}
        />
        {/* Status dot */}
        <View style={[S.pinDot, { backgroundColor: statusColor }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR PLAN LEGEND
// ═══════════════════════════════════════════════════════════════════════════════
function Legend() {
  const items = [
    { label: 'ON',           color: '#30D158' },
    { label: 'OFF',          color: 'rgba(255,255,255,0.35)' },
    { label: 'ERROR',        color: '#FF375F' },
    { label: 'DISCONNECTED', color: '#FF9F0A' },
  ];
  return (
    <View style={S.legendOuter}>
      <BlurView intensity={35} tint="dark" style={S.legendBlur}>
        <View style={S.legendContent}>
          {items.map((it) => (
            <View key={it.label} style={S.legendItem}>
              <View style={[S.legendDot, { backgroundColor: it.color }]} />
              <Text style={S.legendText}>{it.label}</Text>
            </View>
          ))}
        </View>
      </BlurView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════════════════════════════════════════
function StatsBar({ devices }: { devices: Device[] }) {
  const on      = devices.filter((d) => d.status === 'on').length;
  const off     = devices.filter((d) => d.status === 'off').length;
  const issues  = devices.filter((d) => d.status === 'error' || d.status === 'offline').length;
  const items = [
    { label: 'Devices',  value: devices.length, color: '#64D2FF',  icon: 'grid-outline'            as const },
    { label: 'Active',   value: on,             color: '#30D158',  icon: 'checkmark-circle-outline' as const },
    { label: 'Inactive', value: off,            color: 'rgba(255,255,255,0.4)', icon: 'radio-button-off-outline' as const },
    { label: 'Alerts',   value: issues,         color: '#FF375F',  icon: 'alert-circle-outline'     as const },
  ];
  return (
    <View style={S.statsRow}>
      {items.map((it) => (
        <View key={it.label} style={S.statCard}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={S.statCardBorder} />
          <Ionicons name={it.icon} size={14} color={it.color} />
          <Text style={[S.statValue, { color: it.color }]}>{it.value}</Text>
          <Text style={S.statLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE DETAIL BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════════════════
function DeviceDetailSheet({
  device, visible, onClose, onToggle,
}: {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, speed: 22, bounciness: 3,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height, useNativeDriver: true, duration: 230,
      }).start();
    }
  }, [visible]);

  if (!device) return null;

  const statusColor = getStatusColor(device.status);
  const typeColor   = getTypeColor(device.type);
  const canToggle   = device.status === 'on' || device.status === 'off';
  const isOn        = device.status === 'on';
  const safetyInfo  = SAFETY_INFO[device.type];
  const isCamera    = CAMERA_DEVICE_TYPES.includes(device.type as any);
  const isMulti     = MULTI_SWITCH_TYPES.includes(device.type as any);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={S.sheetBackdrop} onPress={onClose} />

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={S.sheetHandle} />

        {/* Header */}
        <View style={S.sheetHeader}>
          {/* Device icon */}
          <View style={[S.sheetIconRing, {
            backgroundColor: `${typeColor}18`,
            borderColor: `${typeColor}40`,
          }]}>
            <Ionicons
              name={isOn ? TYPE_ICON_FILLED[device.type] : TYPE_ICON[device.type]}
              size={28}
              color={isOn ? typeColor : 'rgba(255,255,255,0.5)'}
            />
          </View>
          <View style={S.sheetHeaderText}>
            <Text style={S.sheetDeviceName} numberOfLines={1}>{device.name}</Text>
            <Text style={S.sheetRoomName}>{device.roomName}</Text>
          </View>
          <TouchableOpacity style={S.sheetCloseBtn} onPress={onClose}
            accessibilityLabel="Close" accessibilityRole="button">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Status Badge */}
        <View style={[S.statusBadgeRow, { backgroundColor: `${statusColor}14`, borderColor: `${statusColor}40` }]}>
          <Ionicons name={getStatusIcon(device.status)} size={16} color={statusColor} />
          <Text style={[S.statusBadgeText, { color: statusColor }]}>
            {getStatusLabel(device.status)}
          </Text>
          {device.value !== undefined && (
            <Text style={[S.statusBadgeValue, { color: statusColor }]}>
              {device.value}{device.unit}
            </Text>
          )}
        </View>

        {/* Toggle Row */}
        {canToggle && (
          <View style={S.toggleRow}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={S.toggleRowBorder} />
            <View style={S.toggleLeft}>
              <View style={[S.toggleIconWrap, {
                backgroundColor: isOn ? `${typeColor}18` : 'rgba(255,255,255,0.07)',
                borderColor: isOn ? `${typeColor}35` : 'rgba(255,255,255,0.12)',
              }]}>
                <Ionicons name="power" size={18}
                  color={isOn ? typeColor : 'rgba(255,255,255,0.35)'} />
              </View>
              <View>
                <Text style={S.toggleLabel}>{isOn ? 'Turn Off' : 'Turn On'}</Text>
                <Text style={S.toggleSub}>
                  {isOn ? 'Device is currently active' : 'Device is currently inactive'}
                </Text>
              </View>
            </View>
            <Switch
              value={isOn}
              onValueChange={() => onToggle(device.id)}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${typeColor}60` }}
              thumbColor={isOn ? typeColor : 'rgba(255,255,255,0.7)'}
              ios_backgroundColor="rgba(255,255,255,0.15)"
              accessibilityLabel={isOn ? 'Turn off' : 'Turn on'}
            />
          </View>
        )}

        {/* Camera Placeholder */}
        {isCamera && (
          <View style={S.cameraSection}>
            <Text style={S.sectionLabel}>CAMERA FEED</Text>
            <View style={S.cameraPlaceholder}>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={S.cameraOverlay}>
                {device.status === 'on' ? (
                  <>
                    {/* Simulated live indicator */}
                    <View style={S.cameraLiveRow}>
                      <View style={S.cameraLiveDot} />
                      <Text style={S.cameraLiveText}>LIVE</Text>
                    </View>
                    <Ionicons name="camera" size={36} color="rgba(96,165,250,0.6)" />
                    <Text style={S.cameraPlaceholderText}>Camera Feed Active</Text>
                    <Text style={S.cameraPlaceholderSub}>Tap to open full view</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={36} color="rgba(255,255,255,0.25)" />
                    <Text style={S.cameraOffText}>Camera Offline</Text>
                    <Text style={S.cameraPlaceholderSub}>Enable camera to view feed</Text>
                  </>
                )}
              </View>
              {/* Corner markers */}
              <View style={[S.camCorner, S.camTL]} />
              <View style={[S.camCorner, S.camTR]} />
              <View style={[S.camCorner, S.camBL]} />
              <View style={[S.camCorner, S.camBR]} />
            </View>
          </View>
        )}

        {/* Multi-Switch Controls */}
        {isMulti && (
          <View style={S.multiSection}>
            <Text style={S.sectionLabel}>SWITCH CONTROLS</Text>
            <View style={S.multiGrid}>
              {['Main', 'Circuit A', 'Circuit B'].map((label, i) => {
                const swOn = i === 0 ? isOn : i === 1;
                return (
                  <View key={label} style={S.multiSwitchCard}>
                    <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
                    <View style={S.multiSwitchBorder} />
                    <Text style={S.multiSwitchLabel}>{label}</Text>
                    <View style={[S.multiSwitchDot, { backgroundColor: swOn ? '#30D158' : 'rgba(255,255,255,0.2)' }]} />
                    <Switch
                      value={i === 0 ? isOn : i === 1}
                      onValueChange={i === 0 ? () => onToggle(device.id) : undefined}
                      trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(48,209,88,0.5)' }}
                      thumbColor={swOn ? '#30D158' : 'rgba(255,255,255,0.7)'}
                      ios_backgroundColor="rgba(255,255,255,0.12)"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Safety Information */}
        {safetyInfo && (
          <View style={S.safetySection}>
            <Text style={S.sectionLabel}>SAFETY INFO</Text>
            <View style={S.safetyCard}>
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={S.safetyCardBorder} />
              <View style={S.safetyRow}>
                <View style={S.safetyIconRing}>
                  <Ionicons name={safetyInfo.icon as keyof typeof Ionicons.glyphMap}
                    size={18} color="#FF9F0A" />
                </View>
                <View style={S.safetyBody}>
                  <Text style={S.safetyTitle}>{safetyInfo.title}</Text>
                  <Text style={S.safetyText}>{safetyInfo.body}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Last Updated */}
        <Text style={S.lastUpdated}>
          Last updated: {new Date(device.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        <View style={{ height: IOS_BOTTOM + 8 }} />
      </Animated.View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR PLAN CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
function FloorPlanCanvas({
  floorId, devices, onPinPress, placingDevice, onPlacePin,
}: {
  floorId: string;
  devices: Device[];
  onPinPress: (device: Device) => void;
  /** When set, the canvas is in placement mode for this device */
  placingDevice?: Device | null;
  /** Called with (x%, y%) when user taps the canvas in placement mode */
  onPlacePin?: (x: number, y: number) => void;
}) {
  // Re-read config on each render so we always get the latest (including user uploads)
  const config = getFloorPlanConfig(floorId);
  // Also read from FLOOR_PLAN_CONFIGS directly to pick up the image even for floors
  // that were just created with an uploaded image
  const floor = FLOOR_PLAN_CONFIGS.find((c) => c.floorId === floorId);
  const canvasW = config?.canvasWidth ?? floor?.canvasWidth ?? 360;
  const canvasH = config?.canvasHeight ?? floor?.canvasHeight ?? 432;
  const image   = config?.image ?? floor?.image ?? null;
  const pins    = config?.pins ?? floor?.pins ?? [];

  const handleCanvasTap = useCallback((e: GestureResponderEvent) => {
    if (!placingDevice || !onPlacePin) return;
    const { locationX, locationY } = e.nativeEvent;
    const xPct = Math.min(100, Math.max(0, (locationX / canvasW) * 100));
    const yPct = Math.min(100, Math.max(0, (locationY / canvasH) * 100));
    onPlacePin(xPct, yPct);
  }, [placingDevice, onPlacePin, canvasW, canvasH]);

  if (!image) {
    return (
      <View style={S.emptyCanvas}>
        <Ionicons name="map-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={S.emptyCanvasText}>No floor plan uploaded</Text>
        <Text style={S.emptyCanvasSub}>Edit this floor to upload a floor plan image.</Text>
      </View>
    );
  }

  // Image source: file:// URI string or require() number
  const imageSource = typeof image === 'string' ? { uri: image } : image;

  return (
    <View style={S.canvasWrapper}>
      <Pressable
        style={[S.canvasInner, { width: canvasW, height: canvasH }]}
        onPress={handleCanvasTap}
        accessibilityLabel={placingDevice ? `Tap to place ${placingDevice.name}` : undefined}
      >
        <Image source={imageSource} style={{ width: canvasW, height: canvasH }} resizeMode="cover" />
        {/* Tint overlay */}
        <View style={[S.canvasTint, placingDevice && S.canvasTintPlacing]} />

        {/* Placement crosshair hint */}
        {placingDevice && (
          <View style={S.placingOverlay} pointerEvents="none">
            <View style={S.placingHint}>
              <Ionicons name="add-circle" size={32} color="#0A84FF" />
              <Text style={S.placingHintText}>Tap to place "{placingDevice.name}"</Text>
            </View>
          </View>
        )}

        {/* Existing device pins */}
        {pins.map((pin) => {
          const device = devices.find((d) => d.id === pin.deviceId);
          if (!device) return null;
          // Dim non-placing pins when in placement mode
          const dimmed = placingDevice && placingDevice.id !== pin.deviceId;
          return (
            <DevicePin
              key={pin.deviceId}
              device={device}
              x={pin.x}
              y={pin.y}
              canvasWidth={canvasW}
              canvasHeight={canvasH}
              onPress={() => { if (!placingDevice) onPinPress(device); }}
              dimmed={dimmed ?? false}
            />
          );
        })}
      </Pressable>

      {!placingDevice && <Legend />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE LIST (below the map)
// ═══════════════════════════════════════════════════════════════════════════════
function DeviceList({
  devices, onPress, onPlacePin, floorHasPlan,
}: {
  devices: Device[];
  onPress: (device: Device) => void;
  onPlacePin: (device: Device) => void;
  floorHasPlan: boolean;
}) {
  if (devices.length === 0) return null;
  return (
    <View style={S.deviceListSection}>
      <View style={S.deviceListHeader}>
        <Text style={S.deviceListTitle}>Devices on this floor</Text>
        {floorHasPlan && (
          <View style={S.deviceListHint}>
            <Ionicons name="location-outline" size={12} color="rgba(10,132,255,0.8)" />
            <Text style={S.deviceListHintText}>Tap pin to place</Text>
          </View>
        )}
      </View>
      <View style={S.deviceListCard}>
        <BlurView intensity={38} tint="dark" style={S.deviceListBlur}>
          <View style={S.deviceListSpecular} />
          <View style={S.deviceListInner}>
            {devices.map((d, i) => {
              const typeColor   = getTypeColor(d.type);
              const statusColor = getStatusColor(d.status);
              return (
                <React.Fragment key={d.id}>
                  <TouchableOpacity style={S.deviceRow} onPress={() => onPress(d)}
                    activeOpacity={0.7} accessibilityRole="button"
                    accessibilityLabel={`${d.name}, ${getStatusLabel(d.status)}`}>
                    <View style={[S.deviceRowIcon, {
                      backgroundColor: `${typeColor}18`,
                      borderColor: `${typeColor}30`,
                    }]}>
                      <Ionicons
                        name={d.status === 'on' ? TYPE_ICON_FILLED[d.type] : TYPE_ICON[d.type]}
                        size={16} color={d.status === 'on' ? typeColor : 'rgba(255,255,255,0.4)'}
                      />
                    </View>
                    <View style={S.deviceRowBody}>
                      <Text style={S.deviceRowName} numberOfLines={1}>{d.name}</Text>
                      <Text style={S.deviceRowRoom}>{d.roomName}</Text>
                    </View>
                    {d.value !== undefined && (
                      <Text style={[S.deviceRowValue, { color: typeColor }]}>
                        {d.value}{d.unit}
                      </Text>
                    )}
                    <View style={[S.deviceRowStatus, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}45` }]}>
                      <View style={[S.deviceRowDot, { backgroundColor: statusColor }]} />
                      <Text style={[S.deviceRowStatusText, { color: statusColor }]}>
                        {getStatusLabel(d.status)}
                      </Text>
                    </View>
                    {/* Place pin button — only shown when floor has a plan */}
                    {floorHasPlan && (
                      <TouchableOpacity
                        style={S.deviceRowPinBtn}
                        onPress={(e) => { e.stopPropagation(); onPlacePin(d); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Place ${d.name} on floor plan`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="location-outline" size={16} color="#0A84FF" />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
                  </TouchableOpacity>
                  {i < devices.length - 1 && <View style={S.deviceRowSep} />}
                </React.Fragment>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function FloorPlanScreen() {
  const params = useLocalSearchParams<{ floorId?: string; placeDeviceId?: string }>();

  const [floors,          setFloors]          = useState<Floor[]>([]);
  const [devices,         setDevices]         = useState<Device[]>([]);
  const [selectedFloor,   setSelectedFloor]   = useState<string>('');
  const [selectedDevice,  setSelectedDevice]  = useState<Device | null>(null);
  const [sheetVisible,    setSheetVisible]    = useState(false);
  // Pin placement state
  const [placingDevice,   setPlacingDevice]   = useState<Device | null>(null);
  // Trigger a canvas re-render after a pin is placed
  const [pinVersion,      setPinVersion]      = useState(0);

  useEffect(() => {
    Promise.all([getFloors(), getDevices()]).then(([f, d]) => {
      setFloors(f);
      setDevices(d);
      const target = params.floorId && f.some((fl) => fl.id === params.floorId)
        ? params.floorId
        : f.length > 0 ? f[0].id : '';
      setSelectedFloor(target);

      // If we arrived with a device to place, enter placement mode
      if (params.placeDeviceId) {
        const dev = d.find((x) => x.id === params.placeDeviceId);
        if (dev) setPlacingDevice(dev);
      }
    });
  }, []);

  const floorDevices = useMemo(
    () => devices.filter((d) => d.floorId === selectedFloor),
    [devices, selectedFloor, pinVersion],
  );

  const currentFloor = useMemo(
    () => floors.find((f) => f.id === selectedFloor) ?? null,
    [floors, selectedFloor],
  );

  const handlePinPress = useCallback((device: Device) => {
    router.push(`/device/${device.id}`);
  }, []);

  const handleToggle = useCallback(async (deviceId: string) => {
    const updated = await toggleDevice(deviceId);
    if (updated) {
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
      setSelectedDevice((prev) => (prev?.id === deviceId ? updated : prev));
    }
  }, []);

  /** Called when user taps the canvas in placement mode */
  const handlePlacePin = useCallback((x: number, y: number) => {
    if (!placingDevice || !selectedFloor) return;
    setDevicePin(selectedFloor, placingDevice.id, x, y);
    setPinVersion((v) => v + 1); // force canvas re-render
    setPlacingDevice(null);
  }, [placingDevice, selectedFloor]);

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#06091a', '#0b1530', '#0d1f4a', '#06091a']}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={S.orb1} />
      <View style={S.orb2} />
      <View style={S.orb3} />

      {/* Nav bar */}
      <FloorPlanNavBar floor={currentFloor} />

      {/* Placement mode banner */}
      {placingDevice && (
        <View style={S.placingBanner}>
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={S.placingBannerContent}>
            <Ionicons name="location-outline" size={18} color="#0A84FF" />
            <Text style={S.placingBannerText} numberOfLines={1}>
              Tap the floor plan to place "{placingDevice.name}"
            </Text>
            <TouchableOpacity onPress={() => setPlacingDevice(null)}
              accessibilityLabel="Cancel placement" accessibilityRole="button">
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floor selector */}
      {floors.length > 0 && (
        <FloorSelectorBar
          floors={floors}
          selectedId={selectedFloor}
          onSelect={(id) => { setSelectedFloor(id); setPlacingDevice(null); }}
        />
      )}

      {/* Main scroll content — disable scroll in placement mode so taps register */}
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!placingDevice}
      >
        <StatsBar devices={floorDevices} />

        <View style={S.section}>
          <Text style={S.sectionTitle}>Floor Map</Text>
          <View style={S.canvasCard}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={[S.canvasCardBorder, placingDevice && { borderColor: 'rgba(10,132,255,0.5)' }]} />
            {/* Disable horizontal scroll while placing so the tap registers */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.canvasScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={0.8}
              bouncesZoom
              scrollEnabled={!placingDevice}
            >
              <FloorPlanCanvas
                key={`${selectedFloor}-${pinVersion}`}
                floorId={selectedFloor}
                devices={floorDevices}
                onPinPress={handlePinPress}
                placingDevice={placingDevice}
                onPlacePin={handlePlacePin}
              />
            </ScrollView>
          </View>
        </View>

        {!placingDevice && (
          <DeviceList
            devices={floorDevices}
            onPress={handlePinPress}
            onPlacePin={(device) => setPlacingDevice(device)}
            floorHasPlan={!!(FLOOR_PLAN_CONFIGS.find(c => c.floorId === selectedFloor)?.image)}
          />
        )}

        <View style={{ height: IOS_BOTTOM + 40 }} />
      </ScrollView>

      <DeviceDetailSheet
        device={selectedDevice}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onToggle={handleToggle}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06091a' },
  orb1: { position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, backgroundColor: 'rgba(50,110,255,0.10)', top: -width * 0.25, right: -width * 0.25 },
  orb2: { position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, backgroundColor: 'rgba(100,60,200,0.08)', bottom: height * 0.2, left: -width * 0.2 },
  orb3: { position: 'absolute', width: width * 0.5, height: width * 0.5, borderRadius: width * 0.25, backgroundColor: 'rgba(0,160,255,0.06)', bottom: height * 0.4, right: -width * 0.1 },

  // ── Nav ───────────────────────────────────────────────────────────────────
  navOuter:    { paddingHorizontal: H_PAD, paddingTop: IOS_TOP, paddingBottom: 10, zIndex: 20 },
  navBloom:    { position: 'absolute', top: IOS_TOP - 10, left: H_PAD + 20, right: H_PAD + 20, height: 70, borderRadius: 40, backgroundColor: 'rgba(60,110,255,0.16)', shadowColor: '#4080ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 26 },
  navPill:     { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 16 },
  navSpecular: { position: 'absolute', top: 0, left: '12%', right: '12%', height: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', zIndex: 2 },
  navContent:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderRadius: 22, gap: 10 },
  navBackBtn:  { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  navCenter:   { flex: 1, alignItems: 'center', gap: 4 },
  navTitle:    { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  navLevelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  navLevelText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  navIconBtn:  { position: 'relative' },
  navIconGlass:{ width: 36, height: 36, borderRadius: 11, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // ── Floor selector ─────────────────────────────────────────────────────────
  selectorOuter: { paddingBottom: 8, zIndex: 10 },
  selectorScroll: { paddingHorizontal: H_PAD, gap: 10 },
  selectorChip:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', gap: 7 },
  selectorChipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 4 },

  // ── Section ────────────────────────────────────────────────────────────────
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.4, marginBottom: 12 },

  // ── Stats bar ──────────────────────────────────────────────────────────────
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:  { flex: 1, height: 78, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.13)', gap: 3 },
  statCardBorder: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1, zIndex: 2 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.2 },

  // ── Canvas card ────────────────────────────────────────────────────────────
  canvasCard:        { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
  canvasCardBorder:  { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1, zIndex: 2 },
  canvasScrollContent: { alignItems: 'center', justifyContent: 'center' },
  canvasWrapper:    { position: 'relative' },
  canvasInner:      { position: 'relative', overflow: 'hidden' },
  canvasTint:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,9,26,0.42)' },

  // ── Legend ─────────────────────────────────────────────────────────────────
  legendOuter:   { position: 'absolute', bottom: 10, right: 10 },
  legendBlur:    { borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)' },
  legendContent: { flexDirection: 'column', paddingHorizontal: 10, paddingVertical: 8, gap: 5 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 7, height: 7, borderRadius: 4 },
  legendText:    { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.2 },

  // ── Device pin ─────────────────────────────────────────────────────────────
  pinAbsolute:  { position: 'absolute', width: PIN_SIZE, height: PIN_SIZE, justifyContent: 'center', alignItems: 'center' },
  pinPulse:     { position: 'absolute', width: PIN_SIZE, height: PIN_SIZE, borderRadius: PIN_SIZE / 2, borderWidth: 1.5, opacity: 0.55 },
  pinErrorRing: { position: 'absolute', width: PIN_SIZE + 4, height: PIN_SIZE + 4, borderRadius: (PIN_SIZE + 4) / 2, borderWidth: 1.5, opacity: 0.7, top: -2, left: -2 },
  pinBtn:   { width: PIN_SIZE, height: PIN_SIZE, borderRadius: PIN_SIZE / 2, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, overflow: 'hidden' },
  pinSpecular: { position: 'absolute', top: 0, left: '25%', right: '25%', height: 0, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  pinDot:   { position: 'absolute', bottom: 4, right: 4, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#06091a', zIndex: 3 },

  // ── Empty canvas ───────────────────────────────────────────────────────────
  emptyCanvas:     { height: 220, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyCanvasText: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  emptyCanvasSub:  { fontSize: 14, color: 'rgba(255,255,255,0.28)', textAlign: 'center' },

  // ── Placing mode ──────────────────────────────────────────────────────────
  canvasTintPlacing: { backgroundColor: 'rgba(6,9,26,0.20)' },
  placingOverlay:    { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 18 },
  placingHint:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,132,255,0.85)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  placingHintText:   { fontSize: 13, fontWeight: '600', color: '#fff', flexShrink: 1 },
  placingBanner:     { marginHorizontal: H_PAD, marginBottom: 6, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,132,255,0.45)', zIndex: 10 },
  placingBannerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(10,132,255,0.35)', borderRadius: 16 },
  placingBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0A84FF' },
  deviceListSection: { marginBottom: 24 },
  deviceListHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deviceListTitle:   { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.4 },
  deviceListHint:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(10,132,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  deviceListHintText:{ fontSize: 11, fontWeight: '600', color: '#0A84FF' },
  deviceListCard:    { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 20, elevation: 12 },
  deviceListBlur:    { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  deviceListSpecular:{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)', zIndex: 2 },
  deviceListInner:   { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 20 },
  deviceRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  deviceRowSep:   { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)', marginLeft: 64 },
  deviceRowPinBtn:{ width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.12)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  deviceRowIcon:  { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  deviceRowBody:  { flex: 1 },
  deviceRowName:  { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  deviceRowRoom:  { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  deviceRowValue: { fontSize: 14, fontWeight: '700', marginRight: 6 },
  deviceRowStatus:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  deviceRowDot:   { width: 6, height: 6, borderRadius: 3 },
  deviceRowStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d1a35', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: H_PAD, paddingTop: 12, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 24 },
  sheetHandle:    { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  sheetIconRing:  { width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  sheetHeaderText:{ flex: 1 },
  sheetDeviceName:{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  sheetRoomName:  { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  sheetCloseBtn:  { width: 32, height: 32, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // Status badge
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  statusBadgeText:{ flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  statusBadgeValue:{ fontSize: 15, fontWeight: '800' },

  // Toggle row
  toggleRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 16, gap: 12 },
  toggleRowBorder: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, zIndex: 2 },
  toggleLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIconWrap:  { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  toggleLabel:     { fontSize: 15, fontWeight: '600', color: '#fff' },
  toggleSub:       { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 2 },

  // Section label
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  // Camera
  cameraSection:        { marginBottom: 16 },
  cameraPlaceholder:    { height: 160, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(96,165,250,0.25)', position: 'relative' },
  cameraOverlay:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  cameraLiveRow:        { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,59,48,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  cameraLiveDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  cameraLiveText:       { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  cameraPlaceholderText:{ fontSize: 16, fontWeight: '600', color: 'rgba(96,165,250,0.85)' },
  cameraOffText:        { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  cameraPlaceholderSub: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  // Corner markers
  camCorner: { position: 'absolute', width: 14, height: 14, borderColor: 'rgba(96,165,250,0.5)' },
  camTL: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  camTR: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  camBL: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  camBR: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },

  // Multi-switch
  multiSection:      { marginBottom: 16 },
  multiGrid:         { flexDirection: 'row', gap: 10 },
  multiSwitchCard:   { flex: 1, borderRadius: 16, overflow: 'hidden', alignItems: 'center', paddingVertical: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  multiSwitchBorder: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)', zIndex: 2 },
  multiSwitchLabel:  { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  multiSwitchDot:    { width: 8, height: 8, borderRadius: 4 },

  // Safety
  safetySection:  { marginBottom: 16 },
  safetyCard:     { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,159,10,0.3)' },
  safetyCardBorder:{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(255,159,10,0.35)', zIndex: 2 },
  safetyRow:      { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  safetyIconRing: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)' },
  safetyBody:     { flex: 1 },
  safetyTitle:    { fontSize: 14, fontWeight: '700', color: '#FF9F0A', marginBottom: 5 },
  safetyText:     { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19 },

  lastUpdated: { fontSize: 12, color: 'rgba(255,255,255,0.28)', textAlign: 'center', marginBottom: 8 },
});
