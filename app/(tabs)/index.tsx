import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { getAlerts, subscribeToAlerts } from '@/services/alertService';
import { addDevice, addFloor, deleteFloor, getDevices, getFloors, subscribeToDevices, subscribeToFloors, updateFloor } from '@/services/deviceService';
import { computeEnergyData, EnergyData } from '@/services/energyService';
import { Device, DeviceType, Floor } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView,
  Modal, NativeScrollEvent, NativeSyntheticEvent,
  Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';

const { width, height } = Dimensions.get('window');
const IOS_TOP    = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD      = 20;
const STAT_TILE_W = 122;
const CATEGORY_W  = (width - H_PAD * 2 - 12 * 2) / 2.3;
const CARD_W      = (width - H_PAD * 2 - 16) / 2;

const FLOOR_LEVEL_ICON: (keyof typeof Ionicons.glyphMap)[] = [
  'home-outline', 'bed-outline', 'telescope-outline',
];
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
const FLOOR_PLAN_IMAGE = require('@/assets/images/floor_plan_preview.png');

const TYPE_ICON: Record<DeviceType, keyof typeof Ionicons.glyphMap> = {
  light: 'bulb-outline', thermostat: 'thermometer-outline', lock: 'lock-closed-outline',
  camera: 'camera-outline', fan: 'refresh-outline', tv: 'tv-outline',
  speaker: 'volume-high-outline', outlet: 'power-outline',
  iron: 'water-outline', multiSwitch: 'apps-outline',
};

interface DeviceCategory {
  id: string; label: string;
  icon: keyof typeof Ionicons.glyphMap; fillIcon: keyof typeof Ionicons.glyphMap;
  types: DeviceType[]; color: string;
}
const CATEGORIES: DeviceCategory[] = [
  { id: 'lights',   label: 'Lights',         icon: 'bulb-outline',   fillIcon: 'bulb',   types: ['light'],   color: Colors.device.light  },
  { id: 'outlets',  label: 'Outlets',        icon: 'power-outline',  fillIcon: 'power',  types: ['outlet'],  color: Colors.device.outlet },
  { id: 'switches', label: 'Switch Panels',  icon: 'apps-outline',   fillIcon: 'apps',   types: [],          color: '#60A5FA'             },
  { id: 'safety',   label: 'Safety Devices', icon: 'flame-outline',  fillIcon: 'flame',  types: [],          color: '#F87171'             },
  { id: 'cameras',  label: 'Cameras',        icon: 'camera-outline', fillIcon: 'camera', types: ['camera'],  color: Colors.device.camera },
];
const QUICK_ACTIONS: { id: string; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'addFloor',  icon: 'add-circle-outline',    label: 'Add Floor'       },
  { id: 'addDevice', icon: 'hardware-chip-outline', label: 'Add Device'      },
  { id: 'multiSwitch', icon: 'apps-outline',        label: 'Multi-Switch'    },
  { id: 'floorPlan', icon: 'map-outline',           label: 'Open Floor Plan' },
];
const TAB_ICONS: Record<string, {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  home:     { active: 'home',      inactive: 'home-outline',      label: 'Home'     },
  floors:   { active: 'layers',    inactive: 'layers-outline',    label: 'Floors'   },
  security: { active: 'shield',    inactive: 'shield-outline',    label: 'Security' },
  energy:   { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Energy'   },
  settings: { active: 'settings',  inactive: 'settings-outline',  label: 'Settings' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}
function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  const email = user?.email;
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix) return prefix.replace(/[._-]+/g, ' ');
  }
  return 'there';
}
function buildActivityText(d: Device): string {
  if (d.type === 'lock')   return `${d.name} ${d.status === 'on' ? 'locked' : 'unlocked'}`;
  if (d.type === 'camera') return d.status === 'offline' ? `${d.name} disconnected` : d.status === 'on' ? `${d.name} connected` : `${d.name} turned off`;
  if (d.status === 'error')   return `${d.name} reported an error`;
  if (d.status === 'offline') return `${d.name} went offline`;
  return `${d.name} turned ${d.status === 'on' ? 'ON' : 'OFF'}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function countFloorDevices(devices: Device[], floorId: string) {
  const all    = devices.filter(d => d.floorId === floorId);
  const active = all.filter(d => d.status === 'on');
  return { total: all.length, active: active.length };
}

// ─── Shared: GlassCard ────────────────────────────────────────────────────────
function GlassCard({ children, bloom, style }: { children: React.ReactNode; bloom?: string; style?: object }) {
  return (
    <View style={[S.glassCardOuter, style]}>
      {bloom && <View style={[S.glassCardBloom, { backgroundColor: bloom }]} />}
      <BlurView intensity={38} tint="dark" style={S.glassCardBlur}>
        <View style={S.glassCardSpecular} />
        <View style={S.glassCardInner}>{children}</View>
      </BlurView>
    </View>
  );
}

// ─── Shared: TabBar ───────────────────────────────────────────────────────────
const TAB_BAR_HEIGHT = 120; // approximate height including bottom inset

function TabBar({ active, onChange, translateY }: {
  active: string;
  onChange: (id: string) => void;
  translateY: Animated.Value | Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Animated.View style={[S.tabOuter, { transform: [{ translateY }] }]}>
      <View style={S.tabBloom} />
      <BlurView intensity={60} tint="dark" style={S.tabPill}>
        <View style={S.tabSpecular} />
        <View style={S.tabContent}>
          {Object.entries(TAB_ICONS).map(([id, tab]) => {
            const isActive = active === id;
            return (
              <TouchableOpacity key={id} style={S.tabItem} onPress={() => onChange(id)}
                activeOpacity={0.6} accessibilityRole="tab"
                accessibilityLabel={tab.label} accessibilityState={{ selected: isActive }}>
                {isActive ? (
                  <BlurView intensity={50} tint="dark" style={S.tabActivePill}>
                    <LinearGradient colors={['rgba(10,132,255,0.28)','rgba(10,132,255,0.12)']}
                      style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                    <View style={S.tabActiveSheen} />
                    <Ionicons name={tab.active} size={20} color="#0A84FF" />
                  </BlurView>
                ) : (
                  <View style={S.tabIconWrap}>
                    <Ionicons name={tab.inactive} size={22} color="rgba(235,235,245,0.5)" />
                  </View>
                )}
                <Text style={[S.tabLabel, { color: isActive ? '#0A84FF' : 'rgba(235,235,245,0.42)' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HomeNavBar({ alerts }: { alerts: number }) {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>LuxeHome</Text>
          </View>
          <TouchableOpacity 
            style={S.navIconBtn} 
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
          >
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.88)" />
            </BlurView>
            {alerts > 0 && <View style={S.navDot} />}
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

function LargeTitle({ issueCount }: { issueCount: number }) {
  const { user } = useAuth();
  const displayName = getDisplayName(user);
  const healthy   = issueCount === 0;
  const pillColor = healthy ? '#30D158' : '#FF375F';
  const pillText  = healthy ? 'All Systems Normal' : `${issueCount} Issue${issueCount > 1 ? 's' : ''} Detected`;
  return (
    <View style={S.largeTitleSection}>
      <Text style={S.largeTitleSub}>{getGreeting()}</Text>
      <Text style={S.largeTitleMain}>{displayName}</Text>
      <View style={S.statusPillOuter}>
        <View style={[S.statusPillBloom, { backgroundColor: `${pillColor}22` }]} />
        <BlurView intensity={45} tint="dark" style={S.statusPillBlur}>
          <View style={S.statusPillSpecular} />
          <View style={S.statusPillContent}>
            <View style={[S.statusPillDot, { backgroundColor: pillColor, shadowColor: pillColor }]} />
            <Text style={[S.statusPillText, { color: pillColor }]}>{pillText}</Text>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

function StatTile({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; color: string }) {
  return (
    <View style={S.statTileOuter}>
      <View style={[S.statTileBloom, { backgroundColor: `${color}14` }]} />
      <BlurView intensity={40} tint="dark" style={S.statTileBlur}>
        <View style={S.statTileSpecular} />
        <View style={S.statTileContent}>
          <View style={[S.statTileIcon, { backgroundColor: `${color}18`, borderColor: `${color}28` }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
          <Text style={S.statTileValue}>{value}</Text>
          <Text style={S.statTileLabel}>{label}</Text>
        </View>
      </BlurView>
    </View>
  );
}

function HomeSummary({ floors, devices }: { floors: Floor[]; devices: Device[] }) {
  const stats = [
    { id: 'floors',  icon: 'layers-outline'           as const, label: 'Floors',      value: floors.length,                                                               color: '#64D2FF'               },
    { id: 'devices', icon: 'grid-outline'              as const, label: 'Devices',     value: devices.length,                                                              color: '#BF5AF2'               },
    { id: 'on',      icon: 'power-outline'             as const, label: 'Devices ON',  value: devices.filter(d => d.status === 'on').length,                               color: '#30D158'               },
    { id: 'off',     icon: 'radio-button-off-outline'  as const, label: 'Devices OFF', value: devices.filter(d => d.status === 'off').length,                              color: 'rgba(255,255,255,0.6)' },
    { id: 'alerts',  icon: 'notifications-outline'     as const, label: 'Alerts',      value: devices.filter(d => d.status === 'error' || d.status === 'offline').length, color: '#FF9F0A'               },
  ];
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Home Summary</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.statScroll} decelerationRate="fast">
        {stats.map(s => <StatTile key={s.id} icon={s.icon} label={s.label} value={s.value} color={s.color} />)}
      </ScrollView>
    </View>
  );
}

function FloorSelector({ floors, selectedId, onSelect }: { floors: Floor[]; selectedId: string; onSelect: (id: string) => void }) {
  const options = [{ id: 'all', name: 'All Floors', level: -1 }, ...floors];
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Floors</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.floorChipRow}>
        {options.map(opt => {
          const active = opt.id === selectedId;
          return (
            <TouchableOpacity key={opt.id} onPress={() => onSelect(opt.id)} activeOpacity={0.8}
              accessibilityRole="button" accessibilityState={{ selected: active }}>
              <BlurView intensity={active ? 50 : 28} tint="dark" style={[S.floorChip, active && S.floorChipActive]}>
                {opt.level >= 0 && (
                  <Ionicons name={FLOOR_LEVEL_ICON[opt.level] ?? 'business-outline'} size={14}
                    color={active ? '#0A84FF' : 'rgba(255,255,255,0.55)'} style={S.floorChipIcon} />
                )}
                <Text style={[S.floorChipText, active && S.floorChipTextActive]}>{opt.name}</Text>
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DeviceCategories({ devices }: { devices: Device[] }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Quick Device Categories</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.categoryScroll} decelerationRate="fast"
        snapToInterval={CATEGORY_W + 12} snapToAlignment="start">
        {CATEGORIES.map(cat => {
          const matched    = devices.filter(d => cat.types.includes(d.type));
          const onCount    = matched.filter(d => d.status === 'on').length;
          const hasDevices = matched.length > 0;
          return (
            <TouchableOpacity key={cat.id} style={S.categoryTileOuter} activeOpacity={0.75}
              accessibilityRole="button" accessibilityLabel={`${cat.label}, ${matched.length} devices`}>
              {hasDevices && <View style={[S.categoryBloom, { backgroundColor: `${cat.color}18` }]} />}
              <BlurView intensity={hasDevices ? 42 : 26} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[S.categorySpecular, hasDevices && { backgroundColor: `${cat.color}40` }]} />
              <View style={[S.categoryInnerBorder as any, hasDevices && { borderTopColor: `${cat.color}35` }]} />
              <View style={S.categoryTileContent}>
                <View style={[S.categoryIconRing, {
                  backgroundColor: hasDevices ? `${cat.color}20` : 'rgba(255,255,255,0.07)',
                  borderColor:     hasDevices ? `${cat.color}35` : 'rgba(255,255,255,0.12)',
                }]}>
                  <Ionicons name={hasDevices ? cat.fillIcon : cat.icon} size={22}
                    color={hasDevices ? cat.color : 'rgba(255,255,255,0.35)'} />
                </View>
                <Text style={[S.categoryLabel, { color: hasDevices ? '#fff' : 'rgba(255,255,255,0.4)' }]}>{cat.label}</Text>
                <Text style={[S.categorySub,   { color: hasDevices ? cat.color : 'rgba(255,255,255,0.28)' }]}>
                  {hasDevices ? `${matched.length} device${matched.length > 1 ? 's' : ''} · ${onCount} on` : 'No devices yet'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RecentActivity({ devices }: { devices: Device[] }) {
  const recent = useMemo(
    () => [...devices].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()).slice(0, 4),
    [devices],
  );
  
  const handleDevicePress = useCallback((device: Device) => {
    if (device.type === 'multiSwitch') {
      router.push(`/multi-switch/${device.id}`);
    } else if (device.type === 'outlet') {
      router.push(`/outlet/${device.id}`);
    } else {
      router.push(`/device/${device.id}`);
    }
  }, []);
  
  if (recent.length === 0) return null;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Recent Device Activity</Text></View>
      <View style={S.activityCard}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.activityCardInnerBorder} />
        {recent.map((d, i) => {
          const color = (Colors.device as Record<string, string>)[d.type] ?? Colors.accent.blue;
          return (
            <View key={d.id}>
              <TouchableOpacity onPress={() => handleDevicePress(d)} activeOpacity={0.7} style={S.activityTouchable}>
                <View style={S.activityRow}>
                  <View style={[S.activityIconRing, { backgroundColor: `${color}18`, borderColor: `${color}28` }]}>
                    <Ionicons name={TYPE_ICON[d.type]} size={17} color={color} />
                  </View>
                  <View style={S.activityBody}>
                    <Text style={S.activityText} numberOfLines={1}>{buildActivityText(d)}</Text>
                    <Text style={S.activitySub}>{d.roomName}</Text>
                  </View>
                  <Text style={S.activityTime}>{formatTime(d.lastUpdated)}</Text>
                </View>
              </TouchableOpacity>
              {i < recent.length - 1 && <View style={S.activitySeparator} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SafetyAlerts({ devices }: { devices: Device[] }) {
  const issues = useMemo(() => devices.filter(d => d.status === 'error' || d.status === 'offline'), [devices]);
  
  const handleDevicePress = useCallback((device: Device) => {
    if (device.type === 'multiSwitch') {
      router.push(`/multi-switch/${device.id}`);
    } else if (device.type === 'outlet') {
      router.push(`/outlet/${device.id}`);
    } else {
      router.push(`/device/${device.id}`);
    }
  }, []);
  
  if (issues.length === 0) return null;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <View style={S.sectionTitleRow}>
          <Text style={S.sectionTitle}>Safety Alerts</Text>
          <View style={S.alertCountBadge}><Text style={S.alertCountText}>{issues.length}</Text></View>
        </View>
      </View>
      <View style={S.activityCard}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.activityCardInnerBorder} />
        {issues.map((d, i) => {
          const isError = d.status === 'error';
          const color   = isError ? '#FF375F' : '#FF9F0A';
          const icon    = (isError ? 'alert-circle-outline' : 'cloud-offline-outline') as keyof typeof Ionicons.glyphMap;
          return (
            <View key={d.id}>
              <TouchableOpacity onPress={() => handleDevicePress(d)} activeOpacity={0.7} style={S.activityTouchable}>
                <View style={S.activityRow}>
                  <View style={[S.alertIconRing, { backgroundColor: `${color}18`, borderColor: `${color}28` }]}>
                    <Ionicons name={icon} size={17} color={color} />
                  </View>
                  <View style={S.alertBody}>
                    <Text style={S.alertTitle}>{isError ? `${d.name} reported an error` : `${d.name} is offline`}</Text>
                    <Text style={S.alertSub}>{d.roomName}</Text>
                  </View>
                  <Text style={S.activityTime}>{formatTime(d.lastUpdated)}</Text>
                </View>
              </TouchableOpacity>
              {i < issues.length - 1 && <View style={S.activitySeparator} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DeviceStatusOverview({ devices }: { devices: Device[] }) {
  const online     = devices.filter(d => d.status === 'on' || d.status === 'off').length;
  const offline    = devices.filter(d => d.status === 'offline').length;
  const errorCount = devices.filter(d => d.status === 'error').length;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Device Status Overview</Text></View>
      <View style={S.activityCard}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.activityCardInnerBorder} />
        <View style={S.activityTouchable}>
          <View style={S.activityRow}>
            <View style={[S.rowIconRing, { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.25)' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#30D158" />
            </View>
            <Text style={S.rowLabel}>Online</Text>
            <Text style={[S.rowValue, { color: '#30D158' }]}>{online}</Text>
          </View>
        </View>
        <View style={S.activitySeparator} />
        <View style={S.activityTouchable}>
          <View style={S.activityRow}>
            <View style={[S.rowIconRing, { backgroundColor: 'rgba(255,159,10,0.15)', borderColor: 'rgba(255,159,10,0.25)' }]}>
              <Ionicons name="cloud-offline-outline" size={18} color="#FF9F0A" />
            </View>
            <Text style={S.rowLabel}>Offline</Text>
            <Text style={[S.rowValue, { color: '#FF9F0A' }]}>{offline}</Text>
          </View>
        </View>
        <View style={S.activitySeparator} />
        <View style={S.activityTouchable}>
          <View style={S.activityRow}>
            <View style={[S.rowIconRing, { backgroundColor: 'rgba(255,55,95,0.15)', borderColor: 'rgba(255,55,95,0.25)' }]}>
              <Ionicons name="alert-circle-outline" size={18} color="#FF375F" />
            </View>
            <Text style={S.rowLabel}>Error</Text>
            <Text style={[S.rowValue, { color: '#FF375F' }]}>{errorCount}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function QuickActionsBar({ onGoFloors, onAddDevice }: { onGoFloors: () => void; onAddDevice: () => void }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Quick Actions</Text></View>
      <View style={S.quickActionGrid}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity key={a.id} style={S.quickActionBtnOuter} activeOpacity={0.75}
            onPress={() => {
              if (a.id === 'addFloor') { onGoFloors(); }
              else if (a.id === 'addDevice') { onAddDevice(); }
              else if (a.id === 'multiSwitch') { router.push('/multi-switch/d17'); }
              else if (a.id === 'floorPlan') { router.push('/floor-plan'); }
            }}
            accessibilityRole="button" accessibilityLabel={a.label}>
            <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={S.quickActionSpecular} />
            <View style={S.quickActionInnerBorder as any} />
            <View style={S.quickActionContent}>
              <View style={S.quickActionIconRing}>
                <Ionicons name={a.icon} size={20} color="#0A84FF" />
              </View>
              <Text style={S.quickActionLabel}>{a.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOORS TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function FloorsNavBar({ onAdd, onAddDevice }: { onAdd: () => void; onAddDevice: () => void }) {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>My Floors</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={S.navIconBtn} onPress={onAddDevice} accessibilityLabel="Add device" accessibilityRole="button">
              <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
                <Ionicons name="hardware-chip-outline" size={18} color="rgba(255,255,255,0.88)" />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={S.navIconBtn} onPress={onAdd} accessibilityLabel="Add floor" accessibilityRole="button">
              <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
                <Ionicons name="add" size={22} color="#0A84FF" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

function RibbonCard({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; color: string }) {
  return (
    <GlassCard bloom={`${color}10`} style={S.ribbonCard}>
      <View style={S.ribbonInner}>
        <View style={[S.ribbonIcon, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[S.ribbonValue, { color }]}>{value}</Text>
        <Text style={S.ribbonLabel}>{label}</Text>
      </View>
    </GlassCard>
  );
}

function FloorCard({ floor, devices, onOpen, onEdit, onDelete }: {
  floor: Floor; devices: Device[];
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { total, active } = countFloorDevices(devices, floor.id);
  const meta       = getLevelMeta(floor.level);
  const hasIssues  = devices.some(d => d.floorId === floor.id && (d.status === 'error' || d.status === 'offline'));
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  // Floors always use the bundled default preview (no Storage upload pipeline).
  const previewSource = FLOOR_PLAN_IMAGE;
  return (
    <Animated.View style={[S.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onOpen} onPressIn={pressIn} onPressOut={pressOut}
        accessibilityRole="button" accessibilityLabel={`${floor.name}, ${total} devices`} style={S.cardTouchable}>
        <View style={[S.cardBloom, { backgroundColor: `${meta.color}18` }]} />
        <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[S.cardSpecular, { backgroundColor: `${meta.color}30` }]} />
        <View style={[S.cardInnerBorder as any, { borderTopColor: `${meta.color}35` }]} />
        <View style={S.previewWrap}>
          <Image source={previewSource} style={S.previewImg} resizeMode="cover" />
          <LinearGradient colors={['transparent','rgba(6,9,26,0.90)']} style={S.previewGradient} />
          <View style={[S.levelBadge, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[S.levelBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {hasIssues && <View style={S.issueDot} />}
        </View>
        <Text style={S.cardTitle} numberOfLines={2}>{floor.name}</Text>
        <View style={S.chipRow}>
          <View style={S.chip}>
            <Ionicons name="grid-outline" size={11} color="rgba(255,255,255,0.5)" />
            <Text style={S.chipText}>{total} device{total !== 1 ? 's' : ''}</Text>
          </View>
          <View style={[S.chip, active > 0 && S.chipActive]}>
            <View style={[S.chipDot, { backgroundColor: active > 0 ? '#30D158' : 'rgba(255,255,255,0.28)' }]} />
            <Text style={[S.chipText, active > 0 && { color: '#30D158' }]}>{active} on</Text>
          </View>
        </View>
        <View style={S.progressTrack}>
          <View style={[S.progressFill, { width: `${total > 0 ? Math.round((active / total) * 100) : 0}%` as any, backgroundColor: meta.color }]} />
        </View>
        <View style={S.cardActions}>
          <TouchableOpacity style={S.actionBtn} onPress={onOpen} accessibilityLabel="Open floor">
            <Ionicons name="arrow-forward-circle-outline" size={20} color="#0A84FF" />
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={onEdit} accessibilityLabel="Edit floor">
            <Ionicons name="pencil-outline" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={onDelete} accessibilityLabel="Delete floor">
            <Ionicons name="trash-outline" size={18} color="#FF375F" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function GhostCard({ onAdd }: { onAdd: () => void }) {
  return (
    <TouchableOpacity style={S.ghostCard} onPress={onAdd} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel="Add new floor">
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.ghostInner}>
        <View style={S.ghostIconRing}><Ionicons name="add" size={28} color="rgba(10,132,255,0.8)" /></View>
        <Text style={S.ghostText}>Add Floor</Text>
      </View>
    </TouchableOpacity>
  );
}

function FloorEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <GlassCard bloom="rgba(10,132,255,0.08)">
      <View style={S.emptyInner}>
        <View style={S.emptyIconRing}><Ionicons name="layers-outline" size={36} color="#0A84FF" /></View>
        <Text style={S.emptyTitle}>No Floors Yet</Text>
        <Text style={S.emptySub}>Add your first floor to start organizing your smart home devices.</Text>
        <TouchableOpacity style={S.emptyAddBtn} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add first floor">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(10,132,255,0.4)','rgba(10,132,255,0.2)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={S.emptyAddBtnText}>Add First Floor</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

function FloorModal({ visible, editingFloor, onClose, onSave }: {
  visible: boolean; editingFloor: Floor | null;
  onClose: () => void; onSave: (name: string, level: number) => void;
}) {
  const [name,  setName]  = useState('');
  const [level, setLevel] = useState(0);
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setName(editingFloor?.name ?? '');
      setLevel(editingFloor?.level ?? 0);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, useNativeDriver: true, duration: 220 }).start();
    }
  }, [visible, editingFloor]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name Required', 'Please enter a floor name.'); return; }
    onSave(trimmed, level);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={StyleSheet.absoluteFillObject} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={S.modalBackdrop} onPress={Keyboard.dismiss} />
        <Animated.View style={[S.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={S.modalHandle} />
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{editingFloor ? 'Edit Floor' : 'New Floor'}</Text>
            <TouchableOpacity style={S.modalCloseBtn} onPress={onClose} accessibilityLabel="Close">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Floor Name */}
          <View style={S.inputSection}>
            <Text style={S.inputLabel}>Floor Name</Text>
            <View style={S.inputWrap}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={S.inputBorder as any} />
              <Ionicons name="layers-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
              <TextInput style={S.textInput} value={name} onChangeText={setName}
                placeholder="e.g. Ground Floor" placeholderTextColor="rgba(255,255,255,0.28)"
                returnKeyType="done" onSubmitEditing={Keyboard.dismiss} accessibilityLabel="Floor name" />
            </View>
          </View>

          {/* Floor Level */}
          <View style={S.inputSection}>
            <Text style={S.inputLabel}>Floor Level</Text>
            <View style={S.levelPicker}>
              {[0,1,2,3,4].map(lvl => {
                const m = getLevelMeta(lvl);
                const active = lvl === level;
                return (
                  <TouchableOpacity key={lvl} style={[S.levelOption, active && { borderColor: `${m.color}66` }]}
                    onPress={() => setLevel(lvl)} accessibilityRole="radio" accessibilityState={{ checked: active }}>
                    <BlurView intensity={active ? 50 : 25} tint="dark" style={StyleSheet.absoluteFillObject} />
                    {active && <LinearGradient colors={[`${m.color}33`,`${m.color}15`]} style={StyleSheet.absoluteFillObject} />}
                    <Ionicons name={m.icon} size={20} color={active ? m.color : 'rgba(255,255,255,0.35)'} />
                    <Text style={[S.levelOptionText, active && { color: m.color }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={S.saveBtn} onPress={handleSave} accessibilityRole="button">
            <LinearGradient colors={['#1a6fff','#0A84FF','#0066dd']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={S.saveBtnSheen} />
            <Ionicons name={editingFloor ? 'checkmark-circle' : 'add-circle'} size={20} color="#fff" />
            <Text style={S.saveBtnText}>{editingFloor ? 'Save Changes' : 'Add Floor'}</Text>
          </TouchableOpacity>
          <View style={{ height: IOS_BOTTOM + 8 }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Device type options ─────────────────────────────────────────────────────
const DEVICE_TYPE_OPTIONS: { type: DeviceType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'light',      label: 'Light',      icon: 'bulb-outline',           color: Colors.device.light      },
  { type: 'thermostat', label: 'Thermostat', icon: 'thermometer-outline',    color: Colors.device.thermostat },
  { type: 'lock',       label: 'Lock',       icon: 'lock-closed-outline',    color: Colors.device.lock       },
  { type: 'camera',     label: 'Camera',     icon: 'camera-outline',         color: Colors.device.camera     },
  { type: 'fan',        label: 'Fan',        icon: 'refresh-outline',        color: Colors.device.fan        },
  { type: 'tv',         label: 'TV',         icon: 'tv-outline',             color: Colors.device.tv         },
  { type: 'speaker',    label: 'Speaker',    icon: 'volume-high-outline',    color: Colors.device.speaker    },
  { type: 'outlet',     label: 'Outlet',     icon: 'flash-outline',          color: Colors.device.outlet     },
];

function AddDeviceModal({ visible, floors, onClose, onSave }: {
  visible: boolean;
  floors: Floor[];
  onClose: () => void;
  onSave: (device: { name: string; type: DeviceType; floorId: string; roomName: string }) => void;
}) {
  const [name,     setName]     = useState('');
  const [roomName, setRoomName] = useState('');
  const [selType,  setSelType]  = useState<DeviceType>('light');
  const [selFloor, setSelFloor] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setName(''); setRoomName(''); setSelType('light');
      setSelFloor(floors.length > 0 ? floors[0].id : '');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, useNativeDriver: true, duration: 220 }).start();
    }
  }, [visible, floors]);

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedRoom = roomName.trim();
    if (!trimmedName) { Alert.alert('Name Required', 'Please enter a device name.'); return; }
    if (!trimmedRoom) { Alert.alert('Room Required', 'Please enter the room name.'); return; }
    if (!selFloor)    { Alert.alert('Floor Required', 'Please select a floor.'); return; }
    onSave({ name: trimmedName, type: selType, floorId: selFloor, roomName: trimmedRoom });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={StyleSheet.absoluteFillObject} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={S.modalBackdrop} onPress={Keyboard.dismiss} />
        <Animated.View style={[S.modalSheet, S.addDeviceSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={S.modalHandle} />
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Add Device</Text>
            <TouchableOpacity style={S.modalCloseBtn} onPress={onClose} accessibilityLabel="Close">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Device Name */}
            <View style={S.inputSection}>
              <Text style={S.inputLabel}>Device Name</Text>
              <View style={S.inputWrap}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={S.inputBorder as any} />
                <Ionicons name="hardware-chip-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                <TextInput style={S.textInput} value={name} onChangeText={setName}
                  placeholder="e.g. Living Room Light" placeholderTextColor="rgba(255,255,255,0.28)"
                  returnKeyType="next" accessibilityLabel="Device name" />
              </View>
            </View>

            {/* Room */}
            <View style={S.inputSection}>
              <Text style={S.inputLabel}>Room</Text>
              <View style={S.inputWrap}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={S.inputBorder as any} />
                <Ionicons name="home-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                <TextInput style={S.textInput} value={roomName} onChangeText={setRoomName}
                  placeholder="e.g. Living Room" placeholderTextColor="rgba(255,255,255,0.28)"
                  returnKeyType="done" onSubmitEditing={Keyboard.dismiss} accessibilityLabel="Room name" />
              </View>
            </View>

            {/* Device Type */}
            <View style={S.inputSection}>
              <Text style={S.inputLabel}>Device Type</Text>
              <View style={S.deviceTypeGrid}>
                {DEVICE_TYPE_OPTIONS.map(opt => {
                  const active = selType === opt.type;
                  return (
                    <TouchableOpacity key={opt.type} style={[S.deviceTypeBtn, active && { borderColor: `${opt.color}66` }]}
                      onPress={() => setSelType(opt.type)} accessibilityRole="radio" accessibilityState={{ checked: active }}>
                      <BlurView intensity={active ? 50 : 25} tint="dark" style={StyleSheet.absoluteFillObject} />
                      {active && <LinearGradient colors={[`${opt.color}33`, `${opt.color}15`]} style={StyleSheet.absoluteFillObject} />}
                      <Ionicons name={opt.icon} size={20} color={active ? opt.color : 'rgba(255,255,255,0.35)'} />
                      <Text style={[S.deviceTypeBtnText, active && { color: opt.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Floor */}
            {floors.length > 0 && (
              <View style={S.inputSection}>
                <Text style={S.inputLabel}>Floor</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.floorChipRowModal}>
                  {floors.map(fl => {
                    const active = selFloor === fl.id;
                    const meta   = getLevelMeta(fl.level);
                    return (
                      <TouchableOpacity key={fl.id} onPress={() => setSelFloor(fl.id)}
                        style={[S.floorChipModal, active && { borderColor: `${meta.color}55` }]}
                        accessibilityRole="radio" accessibilityState={{ checked: active }}>
                        <BlurView intensity={active ? 50 : 25} tint="dark" style={StyleSheet.absoluteFillObject} />
                        {active && <LinearGradient colors={[`${meta.color}28`, `${meta.color}10`]} style={StyleSheet.absoluteFillObject} />}
                        <Ionicons name={meta.icon} size={14} color={active ? meta.color : 'rgba(255,255,255,0.45)'} />
                        <Text style={[S.floorChipModalText, active && { color: meta.color }]}>{fl.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={[S.saveBtn, { marginBottom: 8 }]} onPress={handleSave} accessibilityRole="button">
              <LinearGradient colors={['#1a6fff','#0A84FF','#0066dd']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={S.saveBtnSheen} />
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={S.saveBtnText}>Add Device</Text>
            </TouchableOpacity>
            <View style={{ height: IOS_BOTTOM + 8 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

type CameraStatus = 'online' | 'recording' | 'offline';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  isRecording: boolean;
  resolution: string;
  lastUpdated: string;
  previewIndex: 0 | 1 | 2 | 3;
}

const CAMERA_PREVIEWS = [
  require('@/assets/images/cam_01.jpg'),
  require('@/assets/images/cam_02.jpg'),
  require('@/assets/images/cam_03.jpg'),
  require('@/assets/images/cam_04.jpg'),
] as const;

const MOCK_CAMERAS: Camera[] = [
  {
    id: 'cam-01',
    name: 'Front Porch',
    location: 'Entrance · Sector A',
    status: 'recording',
    isRecording: true,
    resolution: '4K Ultra HD',
    lastUpdated: new Date(Date.now() - 1000 * 15).toISOString(),
    previewIndex: 0,
  },
  {
    id: 'cam-02',
    name: 'Driveway',
    location: 'Exterior · Sector B',
    status: 'online',
    isRecording: false,
    resolution: '1080p HD',
    lastUpdated: new Date(Date.now() - 1000 * 45).toISOString(),
    previewIndex: 1,
  },
  {
    id: 'cam-03',
    name: 'Backyard Pool',
    location: 'Rear Garden',
    status: 'recording',
    isRecording: true,
    resolution: '1080p HD',
    lastUpdated: new Date(Date.now() - 1000 * 30).toISOString(),
    previewIndex: 2,
  },
  {
    id: 'cam-04',
    name: 'Living Room',
    location: 'Interior · Ground Floor',
    status: 'offline',
    isRecording: false,
    resolution: '4K Ultra HD',
    lastUpdated: new Date(Date.now() - 1000 * 120).toISOString(),
    previewIndex: 3,
  },
];

function formatLastUpdated(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function getStatusColor(status: CameraStatus): string {
  switch (status) {
    case 'online': return '#4ade80';
    case 'recording': return '#f87171';
    case 'offline': return '#f59e0b';
  }
}

function getStatusLabel(status: CameraStatus): string {
  switch (status) {
    case 'online': return 'ONLINE';
    case 'recording': return 'REC';
    case 'offline': return 'OFFLINE';
  }
}

function SecurityNavBar() {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>Security</Text>
          </View>
          <TouchableOpacity style={S.navIconBtn} accessibilityLabel="Security settings">
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="shield-outline" size={20} color={Colors.device.camera} />
            </BlurView>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

function CameraCard({ camera }: { camera: Camera }) {
  const [lastUpdated, setLastUpdated] = useState(camera.lastUpdated);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const recPulse = useRef(new Animated.Value(1)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Recording pulse animation
  useEffect(() => {
    if (!camera.isRecording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recPulse, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(recPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [camera.isRecording]);

  // LIVE pulse animation for online cameras
  useEffect(() => {
    if (camera.status === 'offline') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [camera.status]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    Animated.timing(refreshAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => {
      refreshAnim.setValue(0);
      setLastUpdated(new Date().toISOString());
      setRefreshing(false);
    });
  }, [refreshing]);

  const pressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const statusColor = getStatusColor(camera.status);
  const isOffline = camera.status === 'offline';

  const spinInterpolation = refreshAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[S.cameraCardOuter, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} style={S.cameraCardPress}>
        <View style={S.cameraPreviewWrap}>
          {isOffline ? (
            <View style={S.offlinePlaceholder}>
              <LinearGradient colors={['#0d1a30', '#0a1628']} style={StyleSheet.absoluteFillObject} />
              <Ionicons name="videocam-off-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={S.offlineText}>Stream Unavailable</Text>
            </View>
          ) : (
            <Image source={CAMERA_PREVIEWS[camera.previewIndex]} style={S.cameraPreviewImg} resizeMode="cover" />
          )}

          {camera.isRecording && (
            <View style={S.recBadge}>
              <Animated.View style={[S.recDot, { opacity: recPulse }]} />
              <Text style={S.recText}>REC</Text>
            </View>
          )}

          {!isOffline && (
            <Animated.View style={[S.liveBadge, { opacity: livePulse }]}>
              <View style={S.liveDot} />
              <Text style={S.liveText}>LIVE</Text>
            </Animated.View>
          )}

          <LinearGradient colors={['transparent', 'rgba(5,10,24,0.92)']} style={S.cameraGradient} />

          <View style={S.cameraInfo}>
            <Text style={S.cameraName}>{camera.name}</Text>
            <Text style={S.cameraLocation}>{camera.location}</Text>
          </View>

          <Text style={S.lastUpdatedText}>{formatLastUpdated(lastUpdated)}</Text>
        </View>

        <View style={S.cameraFooter}>
          <View style={S.cameraFooterLeft}>
            <View style={[S.statusBadge, { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}18` }]}>
              <View style={[S.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[S.statusText, { color: statusColor }]}>{getStatusLabel(camera.status)}</Text>
            </View>
            <View style={S.resolutionBadge}>
              <Ionicons name="videocam-outline" size={11} color="rgba(255,255,255,0.5)" />
              <Text style={S.resolutionText}>{camera.resolution}</Text>
            </View>
          </View>

          <TouchableOpacity style={S.refreshBtn} onPress={handleRefresh} accessibilityLabel={`Refresh ${camera.name}`}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
              <Ionicons name="refresh-outline" size={18} color={Colors.device.camera} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Activity Log Data
interface ActivityEvent {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  detail: string;
  time: string;
  cameraName: string;
}

const ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: 'evt-1',
    icon: 'walk-outline',
    iconBg: '#60a5fa',
    title: 'Motion Detected',
    detail: 'Person detected at entrance area',
    time: formatTime(new Date(Date.now() - 1000 * 60 * 5).toISOString()),
    cameraName: 'Front Porch',
  },
  {
    id: 'evt-2',
    icon: 'car-outline',
    iconBg: '#4ade80',
    title: 'Vehicle Detected',
    detail: 'Known vehicle entering driveway',
    time: formatTime(new Date(Date.now() - 1000 * 60 * 15).toISOString()),
    cameraName: 'Driveway',
  },
  {
    id: 'evt-3',
    icon: 'alert-circle-outline',
    iconBg: '#f87171',
    title: 'Alert Triggered',
    detail: 'Unusual movement near pool area',
    time: formatTime(new Date(Date.now() - 1000 * 60 * 45).toISOString()),
    cameraName: 'Backyard Pool',
  },
  {
    id: 'evt-4',
    icon: 'videocam-off-outline',
    iconBg: '#f59e0b',
    title: 'Camera Offline',
    detail: 'Living Room camera disconnected',
    time: formatTime(new Date(Date.now() - 1000 * 60 * 90).toISOString()),
    cameraName: 'Living Room',
  },
  {
    id: 'evt-5',
    icon: 'shield-checkmark-outline',
    iconBg: '#4ade80',
    title: 'System Armed',
    detail: 'Security system activated',
    time: formatTime(new Date(Date.now() - 1000 * 60 * 120).toISOString()),
    cameraName: 'System',
  },
];

function SecurityActivityLog() {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>Activity Log</Text>
        <TouchableOpacity accessibilityLabel="View all activity">
          <Text style={S.sectionAction}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={S.activityCard}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.activityCardInnerBorder} />
        {ACTIVITY_EVENTS.map((event, index) => (
          <View key={event.id}>
            <TouchableOpacity activeOpacity={0.7} style={S.activityTouchable}>
              <View style={S.activityRow}>
                <View style={[S.activityIconRing, { backgroundColor: `${event.iconBg}22`, borderColor: `${event.iconBg}44` }]}>
                  <Ionicons name={event.icon} size={18} color={event.iconBg} />
                </View>
                <View style={S.activityBody}>
                  <Text style={S.activityTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={S.activityDetail} numberOfLines={1}>{event.detail}</Text>
                  <View style={S.activityCameraRow}>
                    <Ionicons name="videocam-outline" size={11} color="rgba(255,255,255,0.4)" />
                    <Text style={S.activityCameraText}>{event.cameraName}</Text>
                  </View>
                </View>
                <Text style={S.activityTime}>{event.time}</Text>
              </View>
            </TouchableOpacity>
            {index < ACTIVITY_EVENTS.length - 1 && <View style={S.activitySeparator} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENERGY TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

type TimeFilter = 'today' | 'week' | 'month';

// Human-readable device type labels
const DEVICE_TYPE_LABELS: Record<string, string> = {
  light:       'Smart Light',
  thermostat:  'Air Conditioner',
  lock:        'Smart Lock',
  camera:      'Security Camera',
  fan:         'Ceiling Fan',
  tv:          'Smart TV',
  speaker:     'Smart Speaker',
  outlet:      'Smart Outlet',
  iron:        'Clothes Iron',
  multiSwitch: 'Switch Panel',
};

interface SafetyCutoff {
  id: string;
  deviceName: string;
  timestamp: string;
  reason: string;
  duration: number;
}

function generateSafetyCutoffs(devices: Device[]): SafetyCutoff[] {
  const ironDevices = devices.filter(d => d.type === 'iron');
  const cutoffs: SafetyCutoff[] = [];
  ironDevices.forEach(device => {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));
      cutoffs.push({
        id: `${device.id}-cutoff-${i}`,
        deviceName: device.name,
        timestamp: date.toISOString(),
        reason: 'Safety timeout reached',
        duration: 30 + Math.floor(Math.random() * 90),
      });
    }
  });
  return cutoffs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function formatEnergyDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EnergyNavBar() {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>Power Usage</Text>
          </View>
          <TouchableOpacity style={S.navIconBtn} accessibilityLabel="Energy settings">
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="options-outline" size={20} color="rgba(255,255,255,0.88)" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

// ─── Hero Banner Card ────────────────────────────────────────────────────────
function EnergyHeroCard({ totalKwh, totalCost, filter }: {
  totalKwh: number; totalCost: number; filter: TimeFilter;
}) {
  const periodLabel = filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month';
  return (
    <View style={S.eHeroCard}>
      <LinearGradient
        colors={['rgba(255,214,10,0.18)', 'rgba(10,132,255,0.18)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.eHeroBorder} />
      <View style={S.eHeroContent}>
        <View style={S.eHeroLeft}>
          <Text style={S.eHeroPeriod}>{periodLabel}</Text>
          <Text style={S.eHeroKwh}>{totalKwh.toFixed(1)}</Text>
          <Text style={S.eHeroUnit}>kilowatt-hours used</Text>
        </View>
        <View style={S.eHeroRight}>
          <View style={S.eHeroCostBox}>
            <Ionicons name="cash-outline" size={16} color="#30D158" style={{ marginBottom: 4 }} />
            <Text style={S.eHeroCostLabel}>Estimated Bill</Text>
            <Text style={S.eHeroCostValue}>${totalCost.toFixed(2)}</Text>
          </View>
          <View style={[S.eHeroCostBox, { borderColor: 'rgba(255,214,10,0.3)', marginTop: 10 }]}>
            <Ionicons name="trending-down-outline" size={16} color="#FFD60A" style={{ marginBottom: 4 }} />
            <Text style={S.eHeroCostLabel}>Rate</Text>
            <Text style={[S.eHeroCostValue, { color: '#FFD60A' }]}>$0.15/kWh</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Quick Stats Strip ───────────────────────────────────────────────────────
function EnergyStatChip({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string;
}) {
  return (
    <View style={S.eStatChip}>
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[S.eStatChipBorder, { borderColor: `${color}30` }]} />
      <View style={[S.eStatChipIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={S.eStatChipValue}>{value}</Text>
      <Text style={S.eStatChipLabel}>{label}</Text>
    </View>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function EnergyBarChart({ data }: { data: EnergyData[] }) {
  const chartData = data.slice(0, 8);
  if (chartData.length === 0) {
    return (
      <View style={S.eChartCard}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Text style={S.eChartEmpty}>No devices are currently tracked.</Text>
      </View>
    );
  }
  const maxKwh = Math.max(...chartData.map(d => d.kwh));
  return (
    <View style={S.eChartCard}>
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.eChartTopLine} />
      {/* Y-axis guide labels */}
      <View style={S.eChartYAxis}>
        <Text style={S.eChartYLabel}>{maxKwh.toFixed(1)} kWh</Text>
        <Text style={S.eChartYLabel}>{(maxKwh / 2).toFixed(1)} kWh</Text>
        <Text style={S.eChartYLabel}>0</Text>
      </View>
      <View style={S.eChartBarsWrap}>
        {chartData.map(device => {
          const barPct = maxKwh > 0 ? (device.kwh / maxKwh) : 0;
          const shortName = device.deviceName.length > 9
            ? device.deviceName.substring(0, 8) + '…'
            : device.deviceName;
          const friendlyType = DEVICE_TYPE_LABELS[device.deviceType] ?? device.deviceType;
          return (
            <View key={device.deviceId} style={S.eChartBarCol}>
              <Text style={S.eChartBarKwh}>{device.kwh.toFixed(1)}</Text>
              <View style={S.eChartBarTrack}>
                <View style={[S.eChartBarFill, { flex: barPct }]}>
                  <LinearGradient
                    colors={[device.color, `${device.color}99`]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  />
                </View>
                <View style={{ flex: 1 - barPct }} />
              </View>
              <Text style={S.eChartBarName} numberOfLines={1}>{shortName}</Text>
              <Text style={S.eChartBarType} numberOfLines={1}>{friendlyType}</Text>
            </View>
          );
        })}
      </View>
      <Text style={S.eChartFootnote}>Units in kilowatt-hours (kWh) · higher bars = more electricity used</Text>
    </View>
  );
}

// ─── Device Usage Row Card ───────────────────────────────────────────────────
function DeviceUsageRow({ device, rank }: { device: EnergyData; rank: number }) {
  const isTop3 = rank <= 3;
  const rankColors = ['#FFD60A', '#C0C0C0', '#CD7F32'];
  const rankColor  = isTop3 ? rankColors[rank - 1] : 'rgba(255,255,255,0.25)';
  const friendlyType = DEVICE_TYPE_LABELS[device.deviceType] ?? device.deviceType;
  return (
    <View style={S.eDeviceRow}>
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.eDeviceRowTopLine} />
      <View style={S.eDeviceRowInner}>
        {/* Rank badge */}
        <View style={[S.eRankBadge, { borderColor: isTop3 ? `${rankColor}60` : 'rgba(255,255,255,0.1)' }]}>
          {isTop3
            ? <Ionicons name="trophy" size={14} color={rankColor} />
            : <Text style={[S.eRankNum, { color: 'rgba(255,255,255,0.4)' }]}>#{rank}</Text>
          }
        </View>
        {/* Device icon */}
        <View style={[S.eDeviceIconWrap, { backgroundColor: `${device.color}20`, borderColor: `${device.color}35` }]}>
          <Ionicons name={TYPE_ICON[device.deviceType]} size={20} color={device.color} />
        </View>
        {/* Name & type */}
        <View style={S.eDeviceInfo}>
          <Text style={S.eDeviceName} numberOfLines={1}>{device.deviceName}</Text>
          <Text style={S.eDeviceTypeBadge}>{friendlyType}</Text>
        </View>
        {/* Stats */}
        <View style={S.eDeviceStats}>
          <Text style={S.eDeviceKwh}>{device.kwh.toFixed(2)} kWh</Text>
          <Text style={S.eDeviceCost}>${device.cost.toFixed(2)}</Text>
          <Text style={S.eDevicePct}>{device.percentage.toFixed(0)}% of total</Text>
        </View>
      </View>
      {/* Usage bar */}
      <View style={S.eDeviceProgressTrack}>
        <View style={[S.eDeviceProgressFill, { width: `${device.percentage}%` as any }]}>
          <LinearGradient
            colors={[device.color, `${device.color}66`]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Safety Device Card ──────────────────────────────────────────────────────
function SafetyDeviceCard({ device }: { device: EnergyData }) {
  const friendlyType = DEVICE_TYPE_LABELS[device.deviceType] ?? device.deviceType;
  return (
    <View style={S.eSafetyCard}>
      <LinearGradient
        colors={['rgba(255,55,95,0.12)', 'rgba(255,159,10,0.06)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.eSafetyTopLine} />
      <View style={S.eSafetyInner}>
        <View style={S.eSafetyLeft}>
          <View style={S.eSafetyShieldWrap}>
            <Ionicons name="shield-checkmark" size={18} color="#FF375F" />
          </View>
          <View style={[S.eDeviceIconWrap, { backgroundColor: `${device.color}20`, borderColor: `${device.color}35` }]}>
            <Ionicons name={TYPE_ICON[device.deviceType]} size={18} color={device.color} />
          </View>
          <View style={S.eDeviceInfo}>
            <Text style={S.eDeviceName} numberOfLines={1}>{device.deviceName}</Text>
            <Text style={S.eSafetySubLabel}>{friendlyType} · Auto-off enabled</Text>
          </View>
        </View>
        <View style={S.eDeviceStats}>
          <Text style={S.eDeviceKwh}>{device.kwh.toFixed(2)} kWh</Text>
          <Text style={S.eDeviceCost}>${device.cost.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Auto-Off Event Card ─────────────────────────────────────────────────────
function AutoOffEventCard({ cutoff }: { cutoff: SafetyCutoff }) {
  const durationText = cutoff.duration >= 60
    ? `${Math.floor(cutoff.duration / 60)}h ${cutoff.duration % 60}m`
    : `${cutoff.duration} min`;
  return (
    <View style={S.eAutoOffCard}>
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.eAutoOffContent}>
        <View style={S.eAutoOffIconWrap}>
          <Ionicons name="timer-outline" size={20} color="#FF9F0A" />
        </View>
        <View style={S.eAutoOffBody}>
          <Text style={S.eAutoOffDevice}>{cutoff.deviceName}</Text>
          <Text style={S.eAutoOffDesc}>Automatically turned off after {durationText} of use</Text>
          <Text style={S.eAutoOffTime}>{formatEnergyDate(cutoff.timestamp)}</Text>
        </View>
        <View style={S.eAutoOffBadge}>
          <Text style={S.eAutoOffBadgeText}>Auto-off</Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface SettingsSection {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'toggle' | 'navigate' | 'action';
  value?: boolean;
  badge?: string;
  danger?: boolean;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'account',
    title: 'Account',
    icon: 'person',
    color: '#0A84FF',
    items: [
      { id: 'profile', label: 'Edit Profile', icon: 'person-outline', type: 'navigate' },
      { id: 'preferences', label: 'Preferences', icon: 'options-outline', type: 'navigate' },
      { id: 'language', label: 'Language', icon: 'globe-outline', type: 'navigate', badge: 'English' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'notifications',
    color: '#FF9F0A',
    items: [
      { id: 'push', label: 'Push Notifications', icon: 'notifications-outline', type: 'toggle', value: true },
      { id: 'email', label: 'Email Notifications', icon: 'mail-outline', type: 'toggle', value: false },
      { id: 'alerts', label: 'Device Alerts', icon: 'alert-circle-outline', type: 'toggle', value: true },
      { id: 'safety', label: 'Safety Alerts', icon: 'shield-outline', type: 'toggle', value: true },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    icon: 'lock-closed',
    color: '#FF375F',
    items: [
      { id: 'biometric', label: 'Face ID / Touch ID', icon: 'finger-print-outline', type: 'toggle', value: true },
      { id: 'password', label: 'Change Password', icon: 'key-outline', type: 'navigate' },
      { id: '2fa', label: 'Two-Factor Authentication', icon: 'shield-checkmark-outline', type: 'toggle', value: false },
    ],
  },
  {
    id: 'smart-home',
    title: 'Smart Home',
    icon: 'home',
    color: '#30D158',
    items: [
      { id: 'auto-schedule', label: 'Auto Scheduling', icon: 'time-outline', type: 'toggle', value: true },
      { id: 'energy-save', label: 'Energy Saving Mode', icon: 'leaf-outline', type: 'toggle', value: false },
      { id: 'voice-control', label: 'Voice Control', icon: 'mic-outline', type: 'toggle', value: true },
      { id: 'geofencing', label: 'Geofencing', icon: 'location-outline', type: 'toggle', value: false },
    ],
  },
  {
    id: 'support',
    title: 'Help & Support',
    icon: 'help-circle',
    color: '#BF5AF2',
    items: [
      { id: 'help', label: 'Help Center', icon: 'book-outline', type: 'navigate' },
      { id: 'contact', label: 'Contact Support', icon: 'chatbubble-outline', type: 'navigate' },
      { id: 'feedback', label: 'Send Feedback', icon: 'mail-open-outline', type: 'navigate' },
      { id: 'rate', label: 'Rate App', icon: 'star-outline', type: 'action' },
    ],
  },
  {
    id: 'about',
    title: 'About',
    icon: 'information-circle',
    color: '#64D2FF',
    items: [
      { id: 'version', label: 'App Version', icon: 'code-outline', type: 'navigate', badge: '1.0.0' },
      { id: 'terms', label: 'Terms of Service', icon: 'document-text-outline', type: 'navigate' },
      { id: 'privacy', label: 'Privacy Policy', icon: 'shield-outline', type: 'navigate' },
      { id: 'licenses', label: 'Open Source Licenses', icon: 'code-slash-outline', type: 'navigate' },
    ],
  },
  {
    id: 'danger',
    title: 'Danger Zone',
    icon: 'warning',
    color: '#FF375F',
    items: [
      { id: 'reset', label: 'Reset All Settings', icon: 'refresh-outline', type: 'action', danger: true },
      { id: 'logout', label: 'Log Out', icon: 'log-out-outline', type: 'action', danger: true },
      { id: 'delete', label: 'Delete Account', icon: 'trash-outline', type: 'action', danger: true },
    ],
  },
];

function SettingsNavBar() {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>Settings</Text>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

function UserProfileCard() {
  const { user } = useAuth();
  const displayName = getDisplayName(user);
  const initial = displayName.charAt(0).toUpperCase();
  return (
    <TouchableOpacity style={S.profileCard} activeOpacity={0.8} onPress={() => router.push('/profile')}>
      <View style={[S.profileBloom, { backgroundColor: '#0A84FF15' }]} />
      <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.profileSpecular} />
      <View style={S.profileContent}>
        <View style={S.profileAvatar}>
          <LinearGradient colors={['#1a6fff', '#0A84FF']} style={StyleSheet.absoluteFillObject} />
          <Text style={S.profileInitials}>{initial}</Text>
        </View>
        <View style={S.profileInfo}>
          <Text style={S.profileName}>{displayName}</Text>
          <Text style={S.profileEmail}>januda@smarthome.com</Text>
          <View style={S.profileBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#30D158" />
            <Text style={S.profileBadgeText}>Premium Member</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
      </View>
    </TouchableOpacity>
  );
}

function SettingsSectionCard({ section, onToggle, onNavigate }: {
  section: SettingsSection;
  onToggle: (sectionId: string, itemId: string, value: boolean) => void;
  onNavigate: (sectionId: string, itemId: string) => void;
}) {
  return (
    <View style={S.settingsSectionCard}>
      <View style={S.settingsSectionHeader}>
        <View style={[S.settingsSectionIcon, { backgroundColor: `${section.color}18`, borderColor: `${section.color}30` }]}>
          <Ionicons name={section.icon} size={18} color={section.color} />
        </View>
        <Text style={S.settingsSectionTitle}>{section.title}</Text>
      </View>
      <View style={S.settingsItemsContainer}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={S.settingsItemsInnerBorder} />
        {section.items.map((item, index) => (
          <View key={item.id}>
            <SettingsItemRow
              item={item}
              onToggle={(value) => onToggle(section.id, item.id, value)}
              onPress={() => onNavigate(section.id, item.id)}
            />
            {index < section.items.length - 1 && <View style={S.settingsItemSeparator} />}
          </View>
        ))}
      </View>
    </View>
  );
}

function SettingsItemRow({ item, onToggle, onPress }: {
  item: SettingsItem;
  onToggle: (value: boolean) => void;
  onPress: () => void;
}) {
  const [value, setValue] = useState(item.value || false);

  const handleToggle = () => {
    const newValue = !value;
    setValue(newValue);
    onToggle(newValue);
  };

  return (
    <TouchableOpacity
      style={S.settingsItemRow}
      onPress={item.type === 'toggle' ? handleToggle : onPress}
      activeOpacity={0.7}
    >
      <View style={S.settingsItemLeft}>
        <View style={[S.settingsItemIcon, item.danger && { backgroundColor: '#FF375F18', borderColor: '#FF375F30' }]}>
          <Ionicons
            name={item.icon}
            size={18}
            color={item.danger ? '#FF375F' : 'rgba(255,255,255,0.7)'}
          />
        </View>
        <Text style={[S.settingsItemLabel, item.danger && { color: '#FF375F' }]}>{item.label}</Text>
      </View>
      <View style={S.settingsItemRight}>
        {item.badge && (
          <View style={S.settingsBadge}>
            <Text style={S.settingsBadgeText}>{item.badge}</Text>
          </View>
        )}
        {item.type === 'toggle' && (
          <View style={[S.toggleSwitch, value && S.toggleSwitchActive]}>
            <View style={[S.toggleThumb, value && S.toggleThumbActive]} />
          </View>
        )}
        {item.type === 'navigate' && (
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        )}
        {item.type === 'action' && (
          <Ionicons name="arrow-forward" size={18} color={item.danger ? '#FF375F' : 'rgba(255,255,255,0.4)'} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function SettingsScreen({ onScroll }: { onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const handleToggle = (sectionId: string, itemId: string, value: boolean) => {
    console.log(`Toggle: ${sectionId}.${itemId} = ${value}`);
    // Handle toggle logic here
  };

  const handleNavigate = (sectionId: string, itemId: string) => {
    console.log(`Navigate: ${sectionId}.${itemId}`);
    // Handle navigation logic here
    if (itemId === 'profile') {
      router.push('/profile');
    } else if (itemId === 'notifications-manage') {
      router.push('/notifications');
    } else if (itemId === 'logout') {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => console.log('Logging out...') },
      ]);
    } else if (itemId === 'delete') {
      Alert.alert('Delete Account', 'This action cannot be undone. Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Deleting account...') },
      ]);
    } else if (itemId === 'reset') {
      Alert.alert('Reset Settings', 'This will reset all settings to default. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => console.log('Resetting...') },
      ]);
    }
  };

  return (
    <>
      <SettingsNavBar />
      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={16}>
        <View style={S.heroSection}>
          <Text style={S.heroSub}>Account & Preferences</Text>
          <Text style={S.heroTitle}>Settings</Text>
          <Text style={S.heroDesc}>Customize your smart home experience</Text>
        </View>

        <UserProfileCard />

        {SETTINGS_SECTIONS.map((section) => (
          <SettingsSectionCard
            key={section.id}
            section={section}
            onToggle={handleToggle}
            onNavigate={handleNavigate}
          />
        ))}

        <View style={[S.section, { marginBottom: IOS_BOTTOM + 16 }]}>
          <View style={S.appInfoCard}>
            <Text style={S.appInfoText}>LuxeHome Smart Home</Text>
            <Text style={S.appInfoVersion}>Version 1.0.0 (Build 100)</Text>
            <Text style={S.appInfoCopyright}>© 2026 LuxeHome. All rights reserved.</Text>
          </View>
        </View>

        <View style={{ height: IOS_BOTTOM + 110 }} />
      </ScrollView>
    </>
  );
}

// ─── Main Energy Monitor Screen ──────────────────────────────────────────────
function EnergyMonitorScreen({ onScroll }: { onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState<TimeFilter>('today');
  const [showAllCutoffs, setShowAllCutoffs] = useState(false);
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);

  useEffect(() => {
    getDevices().then(setDevices);
  }, []);

  useEffect(() => subscribeToDevices(() => {
    getDevices().then(setDevices);
  }), []);

  // Recompute real usage whenever the device list or the period filter changes.
  useEffect(() => {
    let active = true;
    computeEnergyData(devices, filter).then((data) => {
      if (active) setEnergyData(data);
    });
    return () => { active = false; };
  }, [devices, filter]);

  const safetyCutoffs = useMemo(() => generateSafetyCutoffs(devices), [devices]);
  const totalKwh  = energyData.reduce((sum, d) => sum + d.kwh, 0);
  const totalCost = energyData.reduce((sum, d) => sum + d.cost, 0);
  const safetyDevices = energyData.filter(d => d.deviceType === 'iron' || d.deviceType === 'outlet');

  const filteredCutoffs = safetyCutoffs.filter(c => {
    const diffDays = Math.floor((Date.now() - new Date(c.timestamp).getTime()) / 86400000);
    return filter === 'today' ? diffDays === 0 : filter === 'week' ? diffDays < 7 : diffDays < 30;
  });

  const FILTER_OPTIONS: { key: TimeFilter; label: string; sublabel: string }[] = [
    { key: 'today', label: 'Today',     sublabel: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) },
    { key: 'week',  label: 'This Week', sublabel: 'Last 7 days' },
    { key: 'month', label: 'This Month', sublabel: new Date().toLocaleDateString([], { month: 'long' }) },
  ];

  return (
    <>
      <EnergyNavBar />
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Period Selector ─────────────────────────────────────── */}
        <View style={S.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.ePeriodRow}
          >
            {FILTER_OPTIONS.map(opt => {
              const active = filter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[S.ePeriodBtn, active && S.ePeriodBtnActive]}
                  onPress={() => setFilter(opt.key)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <BlurView intensity={active ? 52 : 28} tint="dark" style={StyleSheet.absoluteFillObject} />
                  {active && (
                    <LinearGradient
                      colors={['rgba(10,132,255,0.32)', 'rgba(10,132,255,0.14)']}
                      style={StyleSheet.absoluteFillObject}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                  )}
                  <Text style={[S.ePeriodLabel, active && S.ePeriodLabelActive]}>{opt.label}</Text>
                  <Text style={[S.ePeriodSub, active && { color: 'rgba(10,132,255,0.8)' }]}>{opt.sublabel}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Hero Card ───────────────────────────────────────────── */}
        <View style={S.section}>
          <EnergyHeroCard totalKwh={totalKwh} totalCost={totalCost} filter={filter} />
        </View>

        {/* ── Quick Stats Row ─────────────────────────────────────── */}
        <View style={S.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.eStatChipRow}>
            <EnergyStatChip icon="hardware-chip-outline" label="Devices Tracked" value={energyData.length.toString()} color="#0A84FF" />
            <EnergyStatChip icon="shield-checkmark-outline" label="Auto-Off Events" value={filteredCutoffs.length.toString()} color="#FF375F" />
            <EnergyStatChip icon="flash-outline" label="Peak Rate" value="$0.15/kWh" color="#FFD60A" />
            <EnergyStatChip icon="leaf-outline" label="CO₂ Saved" value={`${(totalKwh * 0.4).toFixed(1)}g`} color="#30D158" />
          </ScrollView>
        </View>

        {/* ── Bar Chart ───────────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.eSectionHeader}>
            <Text style={S.eSectionTitle}>Electricity Used by Device</Text>
            <Text style={S.eSectionSub}>Ranked by consumption</Text>
          </View>
          <EnergyBarChart data={energyData} />
        </View>

        {/* ── Device Breakdown ────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.eSectionHeader}>
            <Text style={S.eSectionTitle}>All Devices Ranked</Text>
            <Text style={S.eSectionSub}>Tap to view device details</Text>
          </View>
          <View style={{ gap: 10 }}>
            {energyData.map((device, index) => (
              <DeviceUsageRow key={device.deviceId} device={device} rank={index + 1} />
            ))}
            {energyData.length === 0 && (
              <View style={S.eEmptyState}>
                <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="flash-outline" size={36} color="rgba(255,255,255,0.2)" />
                <Text style={S.eEmptyText}>No devices are on right now</Text>
                <Text style={S.eEmptySub}>Turn on some devices to see their energy usage here.</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Safety Devices ──────────────────────────────────────── */}
        {safetyDevices.length > 0 && (
          <View style={S.section}>
            <View style={S.eSectionHeader}>
              <Text style={S.eSectionTitle}>Safety-Protected Devices</Text>
              <Text style={S.eSectionSub}>These devices have auto-off protection</Text>
            </View>
            <View style={{ gap: 10 }}>
              {safetyDevices.map(device => (
                <SafetyDeviceCard key={device.deviceId} device={device} />
              ))}
            </View>
          </View>
        )}

        {/* ── Auto-Off History ────────────────────────────────────── */}
        {filteredCutoffs.length > 0 && (
          <View style={S.section}>
            <View style={S.eSectionHeader}>
              <Text style={S.eSectionTitle}>Auto-Off History</Text>
              <Text style={S.eSectionSub}>Devices that were automatically switched off</Text>
            </View>
            <View style={{ gap: 8 }}>
              {filteredCutoffs.slice(0, showAllCutoffs ? undefined : 4).map(cutoff => (
                <AutoOffEventCard key={cutoff.id} cutoff={cutoff} />
              ))}
            </View>
            {!showAllCutoffs && filteredCutoffs.length > 4 && (
              <TouchableOpacity style={S.eShowMoreBtn} onPress={() => setShowAllCutoffs(true)} activeOpacity={0.7}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="chevron-down" size={16} color="#0A84FF" />
                <Text style={S.eShowMoreText}>Show {filteredCutoffs.length - 4} more events</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Export Button ───────────────────────────────────────── */}
        <View style={[S.section, { marginBottom: IOS_BOTTOM + 16 }]}>
          <TouchableOpacity style={S.eExportBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Download energy report">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={['rgba(10,132,255,0.28)', 'rgba(10,132,255,0.12)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
            <View style={S.eExportBorder} />
            <Ionicons name="download-outline" size={22} color="#0A84FF" style={{ marginRight: 10 }} />
            <View>
              <Text style={S.eExportTitle}>Download Energy Report</Text>
              <Text style={S.eExportSub}>PDF summary of your usage</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={18} color="rgba(10,132,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={{ height: IOS_BOTTOM + 110 }} />
      </ScrollView>
    </>
  );
}

// ─── Animated tab panel — crossfades in when `visible` becomes true ───────────
function TabPanel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  // Keep mounted so scroll positions are preserved; just hide via opacity + pointer events
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFillObject, { opacity }]}>
      {children}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const [activeTab,       setActiveTab]       = useState('home');
  // Home state
  const [floors,          setFloors]          = useState<Floor[]>([]);
  const [devices,         setDevices]         = useState<Device[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState('all');
  // Floors tab state
  const [floorList,       setFloorList]       = useState<Floor[]>([]);
  const [allDevices,      setAllDevices]       = useState<Device[]>([]);
  const [loadingFloors,   setLoadingFloors]   = useState(true);
  const [modalVisible,    setModalVisible]    = useState(false);
  const [editingFloor,    setEditingFloor]    = useState<Floor | null>(null);
  const [addDeviceModal,  setAddDeviceModal]  = useState(false);
  const [unreadAlerts,    setUnreadAlerts]    = useState(0);

  // ── Tab-bar hide-on-scroll ────────────────────────────────────────────────
  const lastScrollY   = useRef(0);
  const tabBarAnim    = useRef(new Animated.Value(0)).current;
  const tabBarVisible = useRef(true);

  const showTabBar = useCallback(() => {
    if (!tabBarVisible.current) {
      tabBarVisible.current = true;
      Animated.spring(tabBarAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    }
  }, [tabBarAnim]);

  const hideTabBar = useCallback(() => {
    if (tabBarVisible.current) {
      tabBarVisible.current = false;
      Animated.spring(tabBarAnim, { toValue: TAB_BAR_HEIGHT + IOS_BOTTOM + 20, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    }
  }, [tabBarAnim]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff     = currentY - lastScrollY.current;
    lastScrollY.current = currentY;
    // Only trigger after scrolling past a small threshold to avoid jitter
    if (diff > 4 && currentY > 50) {
      hideTabBar();
    } else if (diff < -4) {
      showTabBar();
    }
  }, [hideTabBar, showTabBar]);

  // Show tab bar again whenever the active tab changes
  useEffect(() => {
    showTabBar();
    lastScrollY.current = 0;
  }, [activeTab, showTabBar]);

  useEffect(() => {
    Promise.all([getFloors(), getDevices()]).then(([f, d]) => {
      setFloors(f); setDevices(d);
      setFloorList(f); setAllDevices(d); setLoadingFloors(false);
    });
  }, []);

  // Unread alert count for the home bell badge (independent of device health).
  useEffect(() => {
    getAlerts().then((alerts) => setUnreadAlerts(alerts.filter((a) => !a.read).length));
    const unsubscribe = subscribeToAlerts(() => {
      getAlerts().then((alerts) => setUnreadAlerts(alerts.filter((a) => !a.read).length));
    });
    return unsubscribe;
  }, []);

  // Real-time sync: refetch floors + devices on any DB change so the home and
  // floors tabs stay current without a manual refresh.
  useEffect(() => {
    const unsubscribeDevices = subscribeToDevices(() => {
      Promise.all([getFloors(), getDevices()]).then(([f, d]) => {
        setFloors(f); setDevices(d);
        setFloorList(f); setAllDevices(d); setLoadingFloors(false);
      });
    });
    const unsubscribeFloors = subscribeToFloors(() => {
      Promise.all([getFloors(), getDevices()]).then(([f, d]) => {
        setFloors(f); setDevices(d);
        setFloorList(f); setAllDevices(d); setLoadingFloors(false);
      });
    });
    return () => {
      unsubscribeDevices();
      unsubscribeFloors();
    };
  }, []);

  const filteredDevices = useMemo(
    () => selectedFloorId === 'all' ? devices : devices.filter(d => d.floorId === selectedFloorId),
    [devices, selectedFloorId],
  );
  const issueCount = useMemo(
    () => devices.filter(d => d.status === 'error' || d.status === 'offline').length,
    [devices],
  );
  const totalDevices  = useMemo(() => allDevices.length, [allDevices]);
  const activeDevices = useMemo(() => allDevices.filter(d => d.status === 'on').length, [allDevices]);
  const alertCount    = useMemo(() => allDevices.filter(d => d.status === 'error' || d.status === 'offline').length, [allDevices]);

  const handleFloorSave = useCallback(async (name: string, level: number) => {
    if (editingFloor) {
      await updateFloor(editingFloor.id, { name, level });
      setFloorList(prev => prev.map(f => f.id === editingFloor.id ? { ...f, name, level } : f));
      setFloors(prev => prev.map(f => f.id === editingFloor.id ? { ...f, name, level } : f));
    } else {
      const newFloor = await addFloor(name, level);
      setFloorList(prev => [...prev, newFloor]);
      setFloors(prev => [...prev, newFloor]);
    }
    setModalVisible(false);
  }, [editingFloor]);

  const handleFloorDelete = useCallback((floor: Floor) => {
    Alert.alert('Delete Floor', `Remove "${floor.name}"? All devices on this floor will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteFloor(floor.id);
        setFloorList(prev => prev.filter(f => f.id !== floor.id));
        setFloors(prev => prev.filter(f => f.id !== floor.id));
      }},
    ]);
  }, []);

  const handleOpenFloor = useCallback((floor: Floor) => {
    router.push(`/floor-plan?floorId=${floor.id}`);
  }, []);

  const openAddFloor = () => { setEditingFloor(null); setModalVisible(true); };

  const handleAddDevice = useCallback(async (fields: {
    name: string; type: DeviceType; floorId: string; roomName: string;
  }) => {
    const newDevice = await addDevice(fields);
    setDevices(prev => [...prev, newDevice]);
    setAllDevices(prev => [...prev, newDevice]);
    // Update floor device counts in list
    setFloorList(prev => prev.map(f =>
      f.id === fields.floorId ? { ...f, deviceCount: f.deviceCount + 1 } : f,
    ));
    setFloors(prev => prev.map(f =>
      f.id === fields.floorId ? { ...f, deviceCount: f.deviceCount + 1 } : f,
    ));
    setAddDeviceModal(false);
    // Navigate to the floor plan to place the pin
    router.push(`/floor-plan?floorId=${fields.floorId}&placeDeviceId=${newDevice.id}`);
  }, []);

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#06091a','#0b1530','#0d1f4a','#06091a']}
        locations={[0, 0.35, 0.65, 1]} style={StyleSheet.absoluteFillObject} />
      <View style={S.orb1} /><View style={S.orb2} /><View style={S.orb3} />

      {/* ── HOME TAB ────────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'home'}>
        <HomeNavBar alerts={unreadAlerts} />
        <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}
          onScroll={handleScroll} scrollEventThrottle={16}>
          <LargeTitle issueCount={issueCount} />
          <HomeSummary floors={floors} devices={devices} />
          <FloorSelector floors={floors} selectedId={selectedFloorId} onSelect={setSelectedFloorId} />
          <DeviceCategories devices={filteredDevices} />
          <RecentActivity devices={filteredDevices} />
          <SafetyAlerts devices={filteredDevices} />
          <DeviceStatusOverview devices={filteredDevices} />
          <QuickActionsBar onGoFloors={() => setActiveTab('floors')} onAddDevice={() => setAddDeviceModal(true)} />
          <View style={{ height: IOS_BOTTOM + 110 }} />
        </ScrollView>
      </TabPanel>

      {/* ── FLOORS TAB ──────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'floors'}>
        <FloorsNavBar onAdd={openAddFloor} onAddDevice={() => setAddDeviceModal(true)} />
        <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          onScroll={handleScroll} scrollEventThrottle={16}>
          <View style={S.heroSection}>
            <Text style={S.heroSub}>Smart Home</Text>
            <Text style={S.heroTitle}>Floor Selection</Text>
            <Text style={S.heroDesc}>Manage and navigate all floors of your home</Text>
            <View style={S.ribbonRow}>
              <RibbonCard icon="layers"        value={floorList.length} label="Floors"  color="#0A84FF" />
              <RibbonCard icon="grid-outline"  value={totalDevices}     label="Devices" color="#BF5AF2" />
              <RibbonCard icon="power-outline" value={activeDevices}    label="Active"  color="#30D158" />
              {alertCount > 0 && <RibbonCard icon="warning-outline" value={alertCount} label="Alerts" color="#FF9F0A" />}
            </View>
          </View>
          <View style={S.floorSectionHeader}>
            <View style={S.sectionTitleRow}>
              <Text style={S.sectionTitle}>All Floors</Text>
              {floorList.length > 0 && (
                <View style={S.floorCountBadge}><Text style={S.floorCountText}>{floorList.length}</Text></View>
              )}
            </View>
            <TouchableOpacity style={S.addPill} onPress={openAddFloor} accessibilityRole="button" accessibilityLabel="Add floor">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient colors={['rgba(10,132,255,0.35)','rgba(10,132,255,0.18)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Ionicons name="add" size={16} color="#0A84FF" />
              <Text style={S.addPillText}>Add Floor</Text>
            </TouchableOpacity>
          </View>
          {loadingFloors ? (
            <View style={S.loadingWrap}><Text style={S.loadingText}>Loading floors…</Text></View>
          ) : floorList.length === 0 ? (
            <FloorEmptyState onAdd={openAddFloor} />
          ) : (
            <View style={S.grid}>
              {floorList.map(floor => (
                <FloorCard key={floor.id} floor={floor} devices={allDevices}
                  onOpen={() => handleOpenFloor(floor)}
                  onEdit={() => { setEditingFloor(floor); setModalVisible(true); }}
                  onDelete={() => handleFloorDelete(floor)} />
              ))}
              <GhostCard onAdd={openAddFloor} />
            </View>
          )}
          {floorList.length > 0 && (
            <View style={S.tipSection}>
              <GlassCard bloom="rgba(10,132,255,0.04)">
                <View style={S.tipRow}>
                  <View style={S.tipIconRing}><Ionicons name="information-circle-outline" size={20} color="#0A84FF" /></View>
                  <Text style={S.tipText}>Tap a floor card to view all its devices. Use the pencil to rename or the trash to remove a floor.</Text>
                </View>
              </GlassCard>
            </View>
          )}
          <View style={{ height: IOS_BOTTOM + 130 }} />
        </ScrollView>
        {/* FAB */}
        <TouchableOpacity style={S.fab} onPress={openAddFloor} accessibilityRole="button" accessibilityLabel="Add floor">
          <LinearGradient colors={['#1a6fff','#0A84FF']} style={StyleSheet.absoluteFillObject} />
          <View style={S.fabSheen} />
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </TabPanel>

      {/* ── SECURITY TAB ─────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'security'}>
        <SecurityNavBar />
        <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}>
          <View style={S.heroSection}>
            <Text style={S.heroSub}>Security</Text>
            <Text style={S.heroTitle}>Security Center</Text>
            <Text style={S.heroDesc}>Monitor live camera feeds and security status</Text>
            <View style={S.ribbonRow}>
              <RibbonCard icon="shield-checkmark" value={MOCK_CAMERAS.filter(c => c.status !== 'offline').length} label="Active" color="#30D158" />
              <RibbonCard icon="videocam" value={MOCK_CAMERAS.filter(c => c.isRecording).length} label="Recording" color="#f87171" />
              <RibbonCard icon="warning-outline" value={MOCK_CAMERAS.filter(c => c.status === 'offline').length} label="Offline" color="#f59e0b" />
            </View>
          </View>

          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Camera Feeds</Text>
              <View style={S.cameraCountBadge}>
                <Text style={S.cameraCountText}>{MOCK_CAMERAS.length}</Text>
              </View>
            </View>
            <View style={S.cameraGrid}>
              {MOCK_CAMERAS.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </View>
          </View>

          <SecurityActivityLog />

          <View style={{ height: IOS_BOTTOM + 130 }} />
        </ScrollView>
      </TabPanel>

      {/* ── ENERGY TAB ───────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'energy'}>
        <EnergyMonitorScreen onScroll={handleScroll} />
      </TabPanel>

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'settings'}>
        <SettingsScreen onScroll={handleScroll} />
      </TabPanel>

      <TabBar active={activeTab} onChange={(id) => {
        setActiveTab(id);
      }} translateY={tabBarAnim} />

      <FloorModal visible={modalVisible} editingFloor={editingFloor}
        onClose={() => setModalVisible(false)} onSave={handleFloorSave} />

      <AddDeviceModal visible={addDeviceModal} floors={floorList}
        onClose={() => setAddDeviceModal(false)} onSave={handleAddDevice} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06091a' },
  orb1: { position: 'absolute', width: width*0.9,  height: width*0.9,  borderRadius: width*0.45, backgroundColor: 'rgba(50,110,255,0.12)',  top: -width*0.25,    right: -width*0.25 },
  orb2: { position: 'absolute', width: width*0.7,  height: width*0.7,  borderRadius: width*0.35, backgroundColor: 'rgba(100,60,200,0.09)',  bottom: height*0.15, left: -width*0.2   },
  orb3: { position: 'absolute', width: width*0.5,  height: width*0.5,  borderRadius: width*0.25, backgroundColor: 'rgba(0,160,255,0.07)',   bottom: height*0.35, right: -width*0.1  },
  // Nav
  navOuter:     { paddingHorizontal: H_PAD, paddingTop: IOS_TOP, paddingBottom: 10, zIndex: 20 },
  navBloom:     { position: 'absolute', top: IOS_TOP-10, left: H_PAD+20, right: H_PAD+20, height: 70, borderRadius: 40, backgroundColor: 'rgba(60,110,255,0.18)', shadowColor: '#4080ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 28 },
  navPill:      { borderRadius: 22, overflow: 'hidden', backgroundColor: '#0d1e3c', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 16 },
  navSpecular:  { position: 'absolute', top: 0, left: '12%', right: '12%', height: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', zIndex: 2 },
  navContent:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', borderRadius: 22 },
  navLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogoRing:  { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  navLogoImg:   { width: 24, height: 16 },
  navBrand:     { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  navIconBtn:   { position: 'relative' },
  navIconGlass: { width: 36, height: 36, borderRadius: 11, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  navDot:       { position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF375F', borderWidth: 1.5, borderColor: '#06091a', zIndex: 1 },
  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },
  // Large title
  largeTitleSection:  { paddingHorizontal: 2, marginBottom: 32, marginTop: 12 },
  largeTitleSub:      { fontSize: 17, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  largeTitleMain:     { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1.0, lineHeight: 44, marginBottom: 16 },
  statusPillOuter:    { alignSelf: 'flex-start' },
  statusPillBloom:    { position: 'absolute', top: 2, left: 4, right: 4, height: 32, borderRadius: 20, opacity: 0.6 },
  statusPillBlur:     { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  statusPillSpecular: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  statusPillContent:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 8, borderRadius: 20 },
  statusPillDot:      { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5, elevation: 3 },
  statusPillText:     { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  // GlassCard
  glassCardOuter:    { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 },
  glassCardBloom:    { position: 'absolute', top: 4, left: 12, right: 12, height: 40, borderRadius: 24 },
  glassCardBlur:     { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  glassCardSpecular: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)', zIndex: 2 },
  glassCardInner:    { borderRadius: 20 },
  // Card rows
  cardRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  separator:   { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)', marginLeft: 66 },
  rowIconRing: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1 },
  rowLabel:    { flex: 1, fontSize: 17, fontWeight: '400', color: 'rgba(255,255,255,0.92)', letterSpacing: -0.2 },
  rowValue:    { fontSize: 17, fontWeight: '500', color: 'rgba(255,255,255,0.45)', marginRight: 8 },
  // Sections
  section:          { marginBottom: 32 },
  sectionHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 12 },
  floorSectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 16 },
  sectionTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle:     { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  alertCountBadge:  { backgroundColor: '#FF375F', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, minWidth: 22, alignItems: 'center' },
  alertCountText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  floorCountBadge:  { backgroundColor: 'rgba(10,132,255,0.22)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(10,132,255,0.4)' },
  floorCountText:   { fontSize: 13, fontWeight: '700', color: '#0A84FF' },
  addPill:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,132,255,0.45)' },
  addPillText:      { fontSize: 14, fontWeight: '600', color: '#0A84FF' },
  // Stat tiles
  statScroll:       { paddingHorizontal: 2, paddingBottom: 6, gap: 12 },
  statTileOuter:    { width: STAT_TILE_W, height: 104, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 12 },
  statTileBloom:    { position: 'absolute', top: 4, left: 4, right: 4, height: 40, borderRadius: 20 },
  statTileBlur:     { flex: 1, borderRadius: 20, overflow: 'hidden' },
  statTileSpecular: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  statTileContent:  { flex: 1, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 6, borderRadius: 20 },
  statTileIcon:     { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  statTileValue:    { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statTileLabel:    { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.1 },
  // Floor chips
  floorChipRow:        { paddingHorizontal: 2, paddingBottom: 6, gap: 10 },
  floorChip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0d1e3c', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  floorChipActive:     { backgroundColor: '#0e2548', borderColor: 'rgba(10,132,255,0.5)' },
  floorChipIcon:       { marginRight: 6 },
  floorChipText:       { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  floorChipTextActive: { color: '#0A84FF' },
  // Category tiles
  categoryScroll:      { paddingHorizontal: 2, paddingBottom: 6, gap: 12 },
  categoryTileOuter:   { width: CATEGORY_W, height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  categoryBloom:       { position: 'absolute', top: 4, left: 4, right: 4, height: 60, borderRadius: 20 },
  categorySpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 1, zIndex: 2 },
  categoryInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24 },
  categoryTileContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'space-between' },
  categoryIconRing:    { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  categoryLabel:       { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, lineHeight: 20 },
  categorySub:         { fontSize: 12, fontWeight: '500', letterSpacing: 0.1, lineHeight: 16 },
  // Activity
  activityRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  activityIconRing: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0 },
  activityBody:     { flex: 1, gap: 2 },
  activityText:     { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  activityTitle:    { fontSize: 14, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.2 },
  activityDetail:   { fontSize: 12, color: Colors.text.muted, lineHeight: 16 },
  activitySub:      { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  activityTime:     { fontSize: 13, color: 'rgba(255,255,255,0.32)', fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 0 },
  // Alerts
  alertIconRing: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  alertBody:     { flex: 1 },
  alertTitle:    { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2, marginBottom: 3 },
  alertSub:      { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  alertTime:     { fontSize: 13, color: 'rgba(255,255,255,0.32)' },
  // Quick actions
  quickActionGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionBtnOuter:    { width: (width - H_PAD*2 - 12) / 2, height: 76, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  quickActionSpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, zIndex: 2 },
  quickActionInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18 },
  quickActionContent:     { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  quickActionIconRing:    { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.16)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  quickActionLabel:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  // Hero (floors tab)
  heroSection: { paddingHorizontal: 2, marginBottom: 32, marginTop: 12 },
  heroSub:     { fontSize: 17, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroTitle:   { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1.0, lineHeight: 44, marginBottom: 8 },
  heroDesc:    { fontSize: 15, color: 'rgba(255,255,255,0.42)', marginBottom: 24 },
  ribbonRow:   { flexDirection: 'row', gap: 10 },
  ribbonCard:  { flex: 1 },
  ribbonInner: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, gap: 6 },
  ribbonIcon:  { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  ribbonValue: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  ribbonLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 },
  // Floor card
  cardWrap:        { width: CARD_W, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0f1e3a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 16 },
  cardTouchable:   { flex: 1 },
  cardBloom:       { position: 'absolute', top: 4, left: 4, right: 4, height: 80, borderRadius: 20, opacity: 0.8 },
  cardSpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, borderRadius: 1, zIndex: 2 },
  cardInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22 },
  previewWrap:     { width: '100%', height: 110, position: 'relative', overflow: 'hidden' },
  previewImg:      { width: '100%', height: '100%' },
  previewGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 55 },
  levelBadge:      { position: 'absolute', top: 8, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  levelBadgeText:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  issueDot:        { position: 'absolute', top: 8, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF375F', borderWidth: 1.5, borderColor: '#06091a' },
  cardTitle:       { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  chipRow:         { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10, flexWrap: 'wrap' },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive:      { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: 'rgba(48,209,88,0.25)' },
  chipDot:         { width: 6, height: 6, borderRadius: 3 },
  chipText:        { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  progressTrack:   { height: 3, marginHorizontal: 14, marginBottom: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 2 },
  cardActions:     { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 12, paddingTop: 8, gap: 4 },
  actionBtn:       { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  // Ghost card
  ghostCard:    { width: CARD_W, minHeight: 180, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(10,132,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  ghostInner:   { alignItems: 'center', gap: 10 },
  ghostIconRing:{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.1)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  ghostText:    { fontSize: 14, fontWeight: '600', color: 'rgba(10,132,255,0.7)' },
  // Empty state
  emptyInner:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
  emptyIconRing:   { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.12)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)', marginBottom: 4 },
  emptyTitle:      { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.4 },
  emptySub:        { fontSize: 15, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22 },
  emptyAddBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,132,255,0.5)', marginTop: 8 },
  emptyAddBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Tip
  tipSection: { marginBottom: 24 },
  tipRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  tipIconRing:{ width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.12)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.25)' },
  tipText:    { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19 },
  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  // FAB
  fab:      { position: 'absolute', bottom: IOS_BOTTOM+24+80, right: H_PAD, width: 58, height: 58, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  fabSheen: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 1, zIndex: 2 },
  // Modal
  modalBackdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d1a35', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: H_PAD, paddingTop: 12, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20 },
  modalHandle:     { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  modalTitle:      { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  modalCloseBtn:   { width: 32, height: 32, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  inputSection:    { marginBottom: 20 },
  inputLabel:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  inputWrap:       { flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', height: 52 },
  inputBorder:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderRadius: 16 },
  inputIcon:       { marginLeft: 16 },
  textInput:       { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500', paddingHorizontal: 12, height: '100%' },
  levelPicker:     { flexDirection: 'row', gap: 10 },
  levelOption:     { flex: 1, height: 72, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  levelOptionText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 18, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  saveBtnSheen:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, zIndex: 2 },
  saveBtnText:     { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  // Add Device modal
  addDeviceSheet:    { maxHeight: height * 0.92 },
  deviceTypeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  deviceTypeBtn:     { width: (width - H_PAD * 2 - 10 * 3) / 4, height: 68, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  deviceTypeBtnText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  floorChipRowModal: { gap: 10, paddingBottom: 4 },
  floorChipModal:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', gap: 7 },
  floorChipModalText:{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  // Tab bar
  tabOuter:      { position: 'absolute', bottom: IOS_BOTTOM, left: H_PAD, right: H_PAD, zIndex: 30 },
  tabBloom:      { position: 'absolute', top: 4, left: 20, right: 20, height: 60, borderRadius: 40, backgroundColor: 'rgba(40,90,255,0.18)', shadowColor: '#3060ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 26 },
  tabPill:       { borderRadius: 24, overflow: 'hidden', backgroundColor: '#0d1e3c', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 20 },
  tabSpecular:   { position: 'absolute', top: 0, left: '15%', right: '15%', height: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.5)', zIndex: 2 },
  tabContent:    { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 24 },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  tabActivePill: { width: 44, height: 36, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(10,132,255,0.35)', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  tabActiveSheen:{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 1 },
  tabIconWrap:   { width: 44, height: 36, justifyContent: 'center', alignItems: 'center' },
  tabLabel:      { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
  // Security tab - Camera cards
  cameraGrid:         { gap: 14 },
  cameraCardOuter:    { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(61,107,234,0.22)', backgroundColor: Colors.bg.card },
  cameraCardPress:    { overflow: 'hidden' },
  cameraPreviewWrap:  { width: '100%', height: 200, backgroundColor: Colors.bg.secondary, position: 'relative' },
  cameraPreviewImg:   { width: '100%', height: '100%' },
  offlinePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  offlineText:        { fontSize: 13, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 },
  cameraGradient:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  recBadge:           { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  recDot:             { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#f87171' },
  recText:            { fontSize: 11, fontWeight: '700', color: '#f87171', letterSpacing: 1 },
  cameraInfo:         { position: 'absolute', bottom: 10, left: 12 },
  cameraName:         { fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cameraLocation:     { fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5, marginTop: 2 },
  lastUpdatedText:    { position: 'absolute', bottom: 12, right: 12, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 },
  cameraFooter:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  cameraFooterLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot:          { width: 7, height: 7, borderRadius: 3.5 },
  statusText:         { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  resolutionBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resolutionText:     { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  refreshBtn:         { width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.device.camera}18`, borderWidth: 1, borderColor: `${Colors.device.camera}30`, alignItems: 'center', justifyContent: 'center' },
  cameraCountBadge:   { backgroundColor: 'rgba(10,132,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  cameraCountText:    { fontSize: 12, fontWeight: '700', color: '#0A84FF', letterSpacing: 0.5 },
  // LIVE badge animation
  liveBadge:          { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  liveDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30' },
  liveText:           { fontSize: 11, fontWeight: '800', color: '#ffffff', letterSpacing: 1.2 },
  // Activity Log in Security tab
  activityCard:           { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(61,107,234,0.2)' },
  activityCardInnerBorder:{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  activityTouchable:      { paddingHorizontal: 16, paddingVertical: 14 },
  activityCameraRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  activityCameraText:     { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2 },
  activitySeparator:      { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  sectionAction:          { fontSize: 13, fontWeight: '600', color: '#0A84FF', letterSpacing: 0.2 },
  // ─── Energy tab – new luxury styles ─────────────────────────────────────────
  // Section headers
  eSectionHeader:         { marginBottom: 14 },
  eSectionTitle:          { fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3, marginBottom: 3 },
  eSectionSub:            { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.45)' },

  // Period selector
  ePeriodRow:             { paddingHorizontal: 0, gap: 10 },
  ePeriodBtn:             { width: 130, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  ePeriodBtnActive:       { borderColor: 'rgba(10,132,255,0.45)' },
  ePeriodLabel:           { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 3, zIndex: 1 },
  ePeriodLabelActive:     { color: '#0A84FF' },
  ePeriodSub:             { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.32)', zIndex: 1 },

  // Hero card
  eHeroCard:              { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,214,10,0.22)', minHeight: 150 },
  eHeroBorder:            { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  eHeroContent:           { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 24, zIndex: 1 },
  eHeroLeft:              { flex: 1 },
  eHeroPeriod:            { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  eHeroKwh:               { fontSize: 52, fontWeight: '800', color: '#ffffff', letterSpacing: -2, lineHeight: 56 },
  eHeroUnit:              { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  eHeroRight:             { alignItems: 'flex-end', gap: 0 },
  eHeroCostBox:           { alignItems: 'center', borderWidth: 1, borderColor: 'rgba(48,209,88,0.3)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  eHeroCostLabel:         { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.45)', marginBottom: 2 },
  eHeroCostValue:         { fontSize: 18, fontWeight: '700', color: '#30D158' },

  // Quick stat chips
  eStatChipRow:           { gap: 10, paddingVertical: 4 },
  eStatChip:              { width: 130, height: 96, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 },
  eStatChipBorder:        { position: 'absolute', top: 0, left: 0, right: 0, height: 1, borderTopWidth: 1 },
  eStatChipIcon:          { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  eStatChipValue:         { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  eStatChipLabel:         { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.45)' },

  // Bar chart
  eChartCard:             { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 18, minHeight: 240 },
  eChartTopLine:          { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  eChartYAxis:            { position: 'absolute', top: 18, left: 18, justifyContent: 'space-between', height: 160 },
  eChartYLabel:           { fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.3)' },
  eChartBarsWrap:         { flexDirection: 'row', alignItems: 'flex-end', height: 180, marginLeft: 52, gap: 8, marginBottom: 4 },
  eChartBarCol:           { flex: 1, alignItems: 'center' },
  eChartBarKwh:           { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  eChartBarTrack:         { flex: 1, width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 6 },
  eChartBarFill:          { width: '100%', borderRadius: 8, overflow: 'hidden', minHeight: 8 },
  eChartBarName:          { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  eChartBarType:          { fontSize: 8, fontWeight: '400', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 1 },
  eChartFootnote:         { fontSize: 10, fontWeight: '400', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 },
  eChartEmpty:            { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 50 },

  // Device usage rows
  eDeviceRow:             { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 },
  eDeviceRowTopLine:      { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  eDeviceRowInner:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  eRankBadge:             { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  eRankNum:               { fontSize: 11, fontWeight: '700' },
  eDeviceIconWrap:        { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  eDeviceInfo:            { flex: 1 },
  eDeviceName:            { fontSize: 15, fontWeight: '600', color: '#ffffff', marginBottom: 3 },
  eDeviceTypeBadge:       { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.42)', backgroundColor: 'rgba(255,255,255,0.07)', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  eDeviceStats:           { alignItems: 'flex-end' },
  eDeviceKwh:             { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  eDeviceCost:            { fontSize: 13, fontWeight: '600', color: '#30D158', marginBottom: 2 },
  eDevicePct:             { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  eDeviceProgressTrack:   { height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  eDeviceProgressFill:    { height: '100%', borderRadius: 3, overflow: 'hidden', minWidth: 4 },

  // Safety device cards
  eSafetyCard:            { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,55,95,0.28)', padding: 14 },
  eSafetyTopLine:         { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,55,95,0.2)' },
  eSafetyInner:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eSafetyLeft:            { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  eSafetyShieldWrap:      { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,55,95,0.15)', borderWidth: 1, borderColor: 'rgba(255,55,95,0.3)', alignItems: 'center', justifyContent: 'center' },
  eSafetySubLabel:        { fontSize: 11, fontWeight: '500', color: 'rgba(255,55,95,0.85)' },

  // Auto-off event cards
  eAutoOffCard:           { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,159,10,0.2)', padding: 12 },
  eAutoOffContent:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eAutoOffIconWrap:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,159,10,0.15)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)', alignItems: 'center', justifyContent: 'center' },
  eAutoOffBody:           { flex: 1 },
  eAutoOffDevice:         { fontSize: 14, fontWeight: '600', color: '#ffffff', marginBottom: 2 },
  eAutoOffDesc:           { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.55)', marginBottom: 3 },
  eAutoOffTime:           { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.35)' },
  eAutoOffBadge:          { backgroundColor: 'rgba(255,159,10,0.18)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  eAutoOffBadgeText:      { fontSize: 11, fontWeight: '600', color: '#FF9F0A' },

  // Show more / empty state
  eShowMoreBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(10,132,255,0.2)', gap: 6 },
  eShowMoreText:          { fontSize: 14, fontWeight: '600', color: '#0A84FF', zIndex: 1 },
  eEmptyState:            { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 36, alignItems: 'center', justifyContent: 'center' },
  eEmptyText:             { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 14, marginBottom: 6 },
  eEmptySub:              { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.3)', textAlign: 'center' },

  // Export button
  eExportBtn:             { height: 70, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(10,132,255,0.35)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  eExportBorder:          { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  eExportTitle:           { fontSize: 15, fontWeight: '700', color: '#0A84FF', zIndex: 1 },
  eExportSub:             { fontSize: 12, fontWeight: '400', color: 'rgba(10,132,255,0.65)', zIndex: 1, marginTop: 2 },
  // Settings tab styles
  profileCard:             { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(10,132,255,0.25)', marginBottom: 24 },
  profileBloom:            { position: 'absolute', top: -10, left: -10, right: -10, height: 80, borderRadius: 40 },
  profileSpecular:         { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  profileContent:          { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  profileAvatar:           { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(10,132,255,0.3)' },
  profileInitials:         { fontSize: 24, fontWeight: '700', color: '#ffffff', letterSpacing: 1 },
  profileInfo:             { flex: 1 },
  profileName:             { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4, letterSpacing: -0.3 },
  profileEmail:            { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  profileBadge:            { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(48,209,88,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(48,209,88,0.3)' },
  profileBadgeText:        { fontSize: 11, fontWeight: '600', color: '#30D158', letterSpacing: 0.3 },
  settingsSectionCard:     { marginBottom: 24 },
  settingsSectionHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  settingsSectionIcon:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  settingsSectionTitle:    { fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: -0.3 },
  settingsItemsContainer:  { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  settingsItemsInnerBorder:{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  settingsItemRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingsItemLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingsItemIcon:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  settingsItemLabel:       { fontSize: 15, fontWeight: '500', color: '#ffffff', letterSpacing: -0.2 },
  settingsItemRight:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsBadge:           { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  settingsBadgeText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  settingsItemSeparator:   { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 64 },
  toggleSwitch:            { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 2, justifyContent: 'center' },
  toggleSwitchActive:      { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
  toggleThumb:             { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbActive:       { marginLeft: 20 },
  appInfoCard:             { alignItems: 'center', paddingVertical: 20 },
  appInfoText:             { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  appInfoVersion:          { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.35)', marginBottom: 8 },
  appInfoCopyright:        { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.25)' },
});
