import { Colors } from '@/constants/colors';
import { getDevices, getFloors } from '@/services/deviceService';
import { Device, DeviceType, Floor } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const IOS_TOP    = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD      = 20;
const STAT_TILE_W = 122;
const CATEGORY_W  = (width - H_PAD * 2 - 12 * 2) / 2.3;
const USER_NAME  = 'Januda';

const FLOOR_LEVEL_ICON: (keyof typeof Ionicons.glyphMap)[] = [
  'home-outline', 'bed-outline', 'telescope-outline',
];

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
  label: string; route?: string;
}> = {
  home:     { active: 'home',      inactive: 'home-outline',      label: 'Home'     },
  floors:   { active: 'layers',    inactive: 'layers-outline',    label: 'Floors',   route: '/floors' },
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

// ─── GlassCard ────────────────────────────────────────────────────────────────
function GlassCard({ children, bloom }: { children: React.ReactNode; bloom?: string }) {
  return (
    <View style={S.glassCardOuter}>
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

// ─── NavBar ───────────────────────────────────────────────────────────────────
function NavBar({ alerts }: { alerts: number }) {
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

// ─── LargeTitle ───────────────────────────────────────────────────────────────
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

// ─── HomeSummary ──────────────────────────────────────────────────────────────
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
    { id: 'floors',  icon: 'layers-outline'            as const, label: 'Floors',       value: floors.length,                                                                color: '#64D2FF'               },
    { id: 'devices', icon: 'grid-outline'               as const, label: 'Devices',      value: devices.length,                                                               color: '#BF5AF2'               },
    { id: 'on',      icon: 'power-outline'              as const, label: 'Devices ON',   value: devices.filter(d => d.status === 'on').length,                                color: '#30D158'               },
    { id: 'off',     icon: 'radio-button-off-outline'   as const, label: 'Devices OFF',  value: devices.filter(d => d.status === 'off').length,                               color: 'rgba(255,255,255,0.6)' },
    { id: 'alerts',  icon: 'notifications-outline'      as const, label: 'Alerts',       value: devices.filter(d => d.status === 'error' || d.status === 'offline').length,  color: '#FF9F0A'               },
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

// ─── FloorSelector ────────────────────────────────────────────────────────────
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

// ─── DeviceCategories ─────────────────────────────────────────────────────────
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

// ─── RecentActivity ───────────────────────────────────────────────────────────
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

// ─── SafetyAlerts ─────────────────────────────────────────────────────────────
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

// ─── DeviceStatusOverview ─────────────────────────────────────────────────────
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

// ─── QuickActionsBar ──────────────────────────────────────────────────────────
function QuickActionsBar() {
  const handlePress = (id: string) => {
    if (id === 'addFloor')  router.push('/floors' as any);
    if (id === 'addDevice') router.push('/floors' as any);
  };
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}><Text style={S.sectionTitle}>Quick Actions</Text></View>
      <View style={S.quickActionGrid}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity key={a.id} style={S.quickActionBtnOuter} activeOpacity={0.75}
            onPress={() => handlePress(a.id)} accessibilityRole="button" accessibilityLabel={a.label}>
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

// ─── TabBar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const handlePress = (id: string) => {
    onChange(id);
    const route = TAB_ICONS[id]?.route;
    if (route) router.push(route as any);
  };
  return (
    <View style={S.tabOuter}>
      <View style={S.tabBloom} />
      <BlurView intensity={60} tint="dark" style={S.tabPill}>
        <View style={S.tabSpecular} />
        <View style={S.tabContent}>
          {Object.entries(TAB_ICONS).map(([id, tab]) => {
            const isActive = active === id;
            return (
              <TouchableOpacity key={id} style={S.tabItem} onPress={() => handlePress(id)}
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
    </View>
  );
}

// ─── Root screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [activeTab,       setActiveTab]       = useState('home');
  const [floors,          setFloors]          = useState<Floor[]>([]);
  const [devices,         setDevices]         = useState<Device[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState('all');

  useEffect(() => {
    getFloors().then(setFloors);
    getDevices().then(setDevices);
  }, []);

  const filteredDevices = useMemo(
    () => selectedFloorId === 'all' ? devices : devices.filter(d => d.floorId === selectedFloorId),
    [devices, selectedFloorId],
  );

  const issueCount = useMemo(
    () => devices.filter(d => d.status === 'error' || d.status === 'offline').length,
    [devices],
  );

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#06091a','#0b1530','#0d1f4a','#06091a']}
        locations={[0, 0.35, 0.65, 1]} style={StyleSheet.absoluteFillObject} />
      <View style={S.orb1} /><View style={S.orb2} /><View style={S.orb3} />

      <NavBar alerts={issueCount} />

      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>
        <LargeTitle issueCount={issueCount} />
        <HomeSummary floors={floors} devices={devices} />
        <FloorSelector floors={floors} selectedId={selectedFloorId} onSelect={setSelectedFloorId} />
        <DeviceCategories devices={filteredDevices} />
        <RecentActivity devices={filteredDevices} />
        <SafetyAlerts devices={filteredDevices} />
        <DeviceStatusOverview devices={filteredDevices} />
        <QuickActionsBar />
        <View style={{ height: IOS_BOTTOM + 110 }} />
      </ScrollView>

      <TabBar active={activeTab} onChange={setActiveTab} />
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
  section:         { marginBottom: 32 },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  alertCountBadge: { backgroundColor: '#FF375F', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, minWidth: 22, alignItems: 'center' },
  alertCountText:  { fontSize: 12, fontWeight: '700', color: '#fff' },

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

  // Tab bar
  tabOuter:      { position: 'absolute', bottom: IOS_BOTTOM, left: H_PAD, right: H_PAD, zIndex: 20 },
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
