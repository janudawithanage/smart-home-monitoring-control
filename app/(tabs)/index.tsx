import { Colors } from '@/constants/colors';
import { addFloor, deleteFloor, getDevices, getFloors, updateFloor } from '@/services/deviceService';
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
const USER_NAME  = 'Januda';

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
  speaker: 'volume-high-outline', outlet: 'flash-outline',
};

interface DeviceCategory {
  id: string; label: string;
  icon: keyof typeof Ionicons.glyphMap; fillIcon: keyof typeof Ionicons.glyphMap;
  types: DeviceType[]; color: string;
}
const CATEGORIES: DeviceCategory[] = [
  { id: 'lights',   label: 'Lights',         icon: 'bulb-outline',   fillIcon: 'bulb',   types: ['light'],   color: Colors.device.light  },
  { id: 'outlets',  label: 'Outlets',        icon: 'flash-outline',  fillIcon: 'flash',  types: ['outlet'],  color: Colors.device.outlet },
  { id: 'switches', label: 'Switch Panels',  icon: 'apps-outline',   fillIcon: 'apps',   types: [],          color: '#60A5FA'             },
  { id: 'safety',   label: 'Safety Devices', icon: 'flame-outline',  fillIcon: 'flame',  types: [],          color: '#F87171'             },
  { id: 'cameras',  label: 'Cameras',        icon: 'camera-outline', fillIcon: 'camera', types: ['camera'],  color: Colors.device.camera },
];
const QUICK_ACTIONS: { id: string; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'addFloor',  icon: 'add-circle-outline',    label: 'Add Floor'       },
  { id: 'addDevice', icon: 'hardware-chip-outline', label: 'Add Device'      },
  { id: 'reports',   icon: 'bar-chart-outline',     label: 'View Reports'    },
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
function CardRow({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <View style={S.cardRow}>{children}</View>
      {!last && <View style={S.separator} />}
    </>
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
          <TouchableOpacity style={S.navIconBtn} accessibilityLabel="Notifications">
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
  const healthy   = issueCount === 0;
  const pillColor = healthy ? '#30D158' : '#FF375F';
  const pillText  = healthy ? 'All Systems Normal' : `${issueCount} Issue${issueCount > 1 ? 's' : ''} Detected`;
  return (
    <View style={S.largeTitleSection}>
      <Text style={S.largeTitleSub}>{getGreeting()}</Text>
      <Text style={S.largeTitleMain}>{USER_NAME}</Text>
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
  if (recent.length === 0) return null;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Recent Device Activity</Text></View>
      <GlassCard bloom="rgba(80,140,255,0.06)">
        {recent.map((d, i) => {
          const color = (Colors.device as Record<string, string>)[d.type] ?? Colors.accent.blue;
          return (
            <CardRow key={d.id} last={i === recent.length - 1}>
              <View style={[S.activityIconRing, { backgroundColor: `${color}18`, borderColor: `${color}28` }]}>
                <Ionicons name={TYPE_ICON[d.type]} size={17} color={color} />
              </View>
              <View style={S.activityBody}>
                <Text style={S.activityText} numberOfLines={1}>{buildActivityText(d)}</Text>
                <Text style={S.activitySub}>{d.roomName}</Text>
              </View>
              <Text style={S.activityTime}>{formatTime(d.lastUpdated)}</Text>
            </CardRow>
          );
        })}
      </GlassCard>
    </View>
  );
}

function SafetyAlerts({ devices }: { devices: Device[] }) {
  const issues = useMemo(() => devices.filter(d => d.status === 'error' || d.status === 'offline'), [devices]);
  if (issues.length === 0) return null;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <View style={S.sectionTitleRow}>
          <Text style={S.sectionTitle}>Safety Alerts</Text>
          <View style={S.alertCountBadge}><Text style={S.alertCountText}>{issues.length}</Text></View>
        </View>
      </View>
      <GlassCard bloom="rgba(255,55,55,0.06)">
        {issues.map((d, i) => {
          const isError = d.status === 'error';
          const color   = isError ? '#FF375F' : '#FF9F0A';
          const icon    = (isError ? 'alert-circle-outline' : 'cloud-offline-outline') as keyof typeof Ionicons.glyphMap;
          return (
            <CardRow key={d.id} last={i === issues.length - 1}>
              <View style={[S.alertIconRing, { backgroundColor: `${color}18`, borderColor: `${color}28` }]}>
                <Ionicons name={icon} size={17} color={color} />
              </View>
              <View style={S.alertBody}>
                <Text style={S.alertTitle}>{isError ? `${d.name} reported an error` : `${d.name} is offline`}</Text>
                <Text style={S.alertSub}>{d.roomName}</Text>
              </View>
              <Text style={S.alertTime}>{formatTime(d.lastUpdated)}</Text>
            </CardRow>
          );
        })}
      </GlassCard>
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
      <GlassCard bloom="rgba(80,255,150,0.05)">
        <CardRow>
          <View style={[S.rowIconRing, { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.25)' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#30D158" />
          </View>
          <Text style={S.rowLabel}>Online</Text>
          <Text style={[S.rowValue, { color: '#30D158' }]}>{online}</Text>
        </CardRow>
        <CardRow>
          <View style={[S.rowIconRing, { backgroundColor: 'rgba(255,159,10,0.15)', borderColor: 'rgba(255,159,10,0.25)' }]}>
            <Ionicons name="cloud-offline-outline" size={18} color="#FF9F0A" />
          </View>
          <Text style={S.rowLabel}>Offline</Text>
          <Text style={[S.rowValue, { color: '#FF9F0A' }]}>{offline}</Text>
        </CardRow>
        <CardRow last>
          <View style={[S.rowIconRing, { backgroundColor: 'rgba(255,55,95,0.15)', borderColor: 'rgba(255,55,95,0.25)' }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#FF375F" />
          </View>
          <Text style={S.rowLabel}>Error</Text>
          <Text style={[S.rowValue, { color: '#FF375F' }]}>{errorCount}</Text>
        </CardRow>
      </GlassCard>
    </View>
  );
}

function QuickActionsBar({ onGoFloors }: { onGoFloors: () => void }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Quick Actions</Text></View>
      <View style={S.quickActionGrid}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity key={a.id} style={S.quickActionBtnOuter} activeOpacity={0.75}
            onPress={() => {
              if (a.id === 'addFloor' || a.id === 'addDevice') { onGoFloors(); }
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

function FloorsNavBar({ onAdd }: { onAdd: () => void }) {
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
          <TouchableOpacity style={S.navIconBtn} onPress={onAdd} accessibilityLabel="Add floor" accessibilityRole="button">
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="add" size={22} color="#0A84FF" />
            </BlurView>
          </TouchableOpacity>
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
  return (
    <Animated.View style={[S.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onOpen} onPressIn={pressIn} onPressOut={pressOut}
        accessibilityRole="button" accessibilityLabel={`${floor.name}, ${total} devices`} style={S.cardTouchable}>
        <View style={[S.cardBloom, { backgroundColor: `${meta.color}18` }]} />
        <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[S.cardSpecular, { backgroundColor: `${meta.color}30` }]} />
        <View style={[S.cardInnerBorder as any, { borderTopColor: `${meta.color}35` }]} />
        <View style={S.previewWrap}>
          <Image source={FLOOR_PLAN_IMAGE} style={S.previewImg} resizeMode="cover" />
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

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#06091a','#0b1530','#0d1f4a','#06091a']}
        locations={[0, 0.35, 0.65, 1]} style={StyleSheet.absoluteFillObject} />
      <View style={S.orb1} /><View style={S.orb2} /><View style={S.orb3} />

      {/* ── HOME TAB ────────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'home'}>
        <HomeNavBar alerts={issueCount} />
        <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}
          onScroll={handleScroll} scrollEventThrottle={16}>
          <LargeTitle issueCount={issueCount} />
          <HomeSummary floors={floors} devices={devices} />
          <FloorSelector floors={floors} selectedId={selectedFloorId} onSelect={setSelectedFloorId} />
          <DeviceCategories devices={filteredDevices} />
          <RecentActivity devices={filteredDevices} />
          <SafetyAlerts devices={filteredDevices} />
          <DeviceStatusOverview devices={filteredDevices} />
          <QuickActionsBar onGoFloors={() => setActiveTab('floors')} />
          <View style={{ height: IOS_BOTTOM + 110 }} />
        </ScrollView>
      </TabPanel>

      {/* ── FLOORS TAB ──────────────────────────────────────────────────── */}
      <TabPanel visible={activeTab === 'floors'}>
        <FloorsNavBar onAdd={openAddFloor} />
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

      <TabBar active={activeTab} onChange={setActiveTab} translateY={tabBarAnim} />

      <FloorModal visible={modalVisible} editingFloor={editingFloor}
        onClose={() => setModalVisible(false)} onSave={handleFloorSave} />
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
  navPill:      { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 16 },
  navSpecular:  { position: 'absolute', top: 0, left: '12%', right: '12%', height: 1.2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', zIndex: 2 },
  navContent:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 22 },
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
  statusPillBlur:     { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  statusPillSpecular: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  statusPillContent:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 20 },
  statusPillDot:      { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5, elevation: 3 },
  statusPillText:     { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  // GlassCard
  glassCardOuter:    { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 20, elevation: 12 },
  glassCardBloom:    { position: 'absolute', top: 4, left: 12, right: 12, height: 40, borderRadius: 24 },
  glassCardBlur:     { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  glassCardSpecular: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)', zIndex: 2 },
  glassCardInner:    { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 20 },
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
  statTileOuter:    { width: STAT_TILE_W, height: 104, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },
  statTileBloom:    { position: 'absolute', top: 4, left: 4, right: 4, height: 40, borderRadius: 20 },
  statTileBlur:     { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  statTileSpecular: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  statTileContent:  { flex: 1, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 20 },
  statTileIcon:     { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  statTileValue:    { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statTileLabel:    { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.1 },
  // Floor chips
  floorChipRow:        { paddingHorizontal: 2, paddingBottom: 6, gap: 10 },
  floorChip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  floorChipActive:     { borderColor: 'rgba(10,132,255,0.4)' },
  floorChipIcon:       { marginRight: 6 },
  floorChipText:       { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  floorChipTextActive: { color: '#0A84FF' },
  // Category tiles
  categoryScroll:      { paddingHorizontal: 2, paddingBottom: 6, gap: 12 },
  categoryTileOuter:   { width: CATEGORY_W, height: 150, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  categoryBloom:       { position: 'absolute', top: 4, left: 4, right: 4, height: 60, borderRadius: 20 },
  categorySpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 1, zIndex: 2 },
  categoryInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 24 },
  categoryTileContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'space-between' },
  categoryIconRing:    { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  categoryLabel:       { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, lineHeight: 20 },
  categorySub:         { fontSize: 12, fontWeight: '500', letterSpacing: 0.1, lineHeight: 16 },
  // Activity
  activityIconRing: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  activityBody:     { flex: 1 },
  activityText:     { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  activitySub:      { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  activityTime:     { fontSize: 13, color: 'rgba(255,255,255,0.32)' },
  // Alerts
  alertIconRing: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  alertBody:     { flex: 1 },
  alertTitle:    { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2, marginBottom: 3 },
  alertSub:      { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  alertTime:     { fontSize: 13, color: 'rgba(255,255,255,0.32)' },
  // Quick actions
  quickActionGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionBtnOuter:    { width: (width - H_PAD*2 - 12) / 2, height: 76, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  quickActionSpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, zIndex: 2 },
  quickActionInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 18 },
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
  cardWrap:        { width: CARD_W, borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  cardTouchable:   { flex: 1 },
  cardBloom:       { position: 'absolute', top: 4, left: 4, right: 4, height: 80, borderRadius: 20, opacity: 0.7 },
  cardSpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, borderRadius: 1, zIndex: 2 },
  cardInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 22 },
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
  // Tab bar
  tabOuter:      { position: 'absolute', bottom: IOS_BOTTOM, left: H_PAD, right: H_PAD, zIndex: 30 },
  tabBloom:      { position: 'absolute', top: 4, left: 20, right: 20, height: 60, borderRadius: 40, backgroundColor: 'rgba(40,90,255,0.16)', shadowColor: '#3060ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 26 },
  tabPill:       { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 28, elevation: 18 },
  tabSpecular:   { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1.2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.5)', zIndex: 2 },
  tabContent:    { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 24 },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  tabActivePill: { width: 44, height: 36, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(10,132,255,0.35)', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  tabActiveSheen:{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 1 },
  tabIconWrap:   { width: 44, height: 36, justifyContent: 'center', alignItems: 'center' },
  tabLabel:      { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
});
