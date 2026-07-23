import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
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

// ─── Layout constants ─────────────────────────────────────────────────────────
const IOS_TOP    = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD      = 20;
// Show ~2.3 tiles so user knows there are more — each tile is a comfortable square
const TILE       = (width - H_PAD * 2 - 12 * 2) / 2.3;

// ─── Data ─────────────────────────────────────────────────────────────────────
const USER_NAME = 'Januda';

const HOME = {
  totalDevices: 24,
  devicesOn: 14,
  alerts: 2,
  armed: true,
  temp: 22,
  humidity: 45,
  power: '1.2',
};

const ACTIONS = [
  { id: 'lights',  icon: 'bulb-outline'      as const, fillIcon: 'bulb'        as const, label: 'Lights',  sub: '8 on',     on: true,  color: '#FF9F0A' },
  { id: 'lock',    icon: 'lock-open-outline'  as const, fillIcon: 'lock-closed' as const, label: 'Locks',   sub: 'Unlocked', on: false, color: '#BF5AF2' },
  { id: 'ac',      icon: 'snow-outline'       as const, fillIcon: 'snow'        as const, label: 'A/C',     sub: '22°C',     on: true,  color: '#32ADE6' },
  { id: 'cameras', icon: 'camera-outline'     as const, fillIcon: 'camera'      as const, label: 'Cameras', sub: '4 live',   on: true,  color: '#30D158' },
  { id: 'fan',     icon: 'refresh-outline'    as const, fillIcon: 'refresh'     as const, label: 'Fan',     sub: 'Speed 2',  on: true,  color: '#64D2FF' },
  { id: 'night',   icon: 'moon-outline'       as const, fillIcon: 'moon'        as const, label: 'Night',   sub: 'Scene',    on: false, color: '#FF375F' },
];

const ALERTS = [
  { id: 1, icon: 'person-outline' as const, title: 'Motion Detected', sub: 'Front Porch · Zone A', time: '10:42 AM', color: '#FF9F0A' },
  { id: 2, icon: 'wifi-outline'   as const, title: 'Device Offline',  sub: 'Garage Camera',        time: '09:05 AM', color: '#FF375F' },
];

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  home:     { active: 'home',      inactive: 'home-outline',      label: 'Home'     },
  devices:  { active: 'layers',    inactive: 'layers-outline',    label: 'Devices'  },
  security: { active: 'shield',    inactive: 'shield-outline',    label: 'Security' },
  energy:   { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Energy'   },
  settings: { active: 'settings',  inactive: 'settings-outline',  label: 'Settings' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Liquid glass grouped card ────────────────────────────────────────────────
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

// ─── Table row with optional separator ───────────────────────────────────────
function CardRow({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <View style={S.cardRow}>{children}</View>
      {!last && <View style={S.separator} />}
    </>
  );
}

// ─── Nav bar — iOS 26 liquid glass floating capsule ──────────────────────────
function NavBar({ alerts }: { alerts: number }) {
  return (
    <View style={S.navOuter}>
      {/* soft glow bloom behind the pill */}
      <View style={S.navBloom} />

      {/* liquid glass pill */}
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        {/* specular top-edge highlight (the "liquid" sheen) */}
        <View style={S.navSpecular} />

        <View style={S.navContent}>
          {/* logo + brand */}
          <View style={S.navLeft}>
            <View style={S.navLogoRing}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={S.navLogoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={S.navBrand}>LuxeHome</Text>
          </View>

          {/* notification button */}
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

// ─── Large title ──────────────────────────────────────────────────────────────
function LargeTitle() {
  const secured = HOME.armed;
  const pillColor = secured ? '#30D158' : '#FF375F';
  return (
    <View style={S.largeTitleSection}>
      <Text style={S.largeTitleSub}>{getGreeting()}</Text>
      <Text style={S.largeTitleMain}>{USER_NAME}</Text>

      {/* liquid glass status pill */}
      <View style={S.statusPillOuter}>
        <View style={[S.statusPillBloom, { backgroundColor: `${pillColor}22` }]} />
        <BlurView intensity={45} tint="dark" style={S.statusPillBlur}>
          <View style={S.statusPillSpecular} />
          <View style={S.statusPillContent}>
            <View style={[S.statusPillDot, { backgroundColor: pillColor, shadowColor: pillColor }]} />
            <Text style={[S.statusPillText, { color: pillColor }]}>
              {secured ? 'Home Secured' : 'Security Off'}
            </Text>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

// ─── Status summary ───────────────────────────────────────────────────────────
function StatusSummary() {
  return (
    <View style={S.section}>
      <GlassCard bloom="rgba(50,100,255,0.08)">
        <CardRow>
          <View style={[S.rowIconRing, { backgroundColor: 'rgba(50,173,230,0.15)', borderColor: 'rgba(50,173,230,0.25)' }]}>
            <Ionicons name="layers-outline" size={18} color="#32ADE6" />
          </View>
          <Text style={S.rowLabel}>Total Devices</Text>
          <Text style={S.rowValue}>{HOME.totalDevices}</Text>
          <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.2)" />
        </CardRow>
        <CardRow>
          <View style={[S.rowIconRing, { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.25)' }]}>
            <Ionicons name="power-outline" size={18} color="#30D158" />
          </View>
          <Text style={S.rowLabel}>Devices On</Text>
          <Text style={[S.rowValue, { color: '#30D158' }]}>{HOME.devicesOn}</Text>
          <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.2)" />
        </CardRow>
        <CardRow last>
          <View style={[S.rowIconRing, { backgroundColor: HOME.alerts > 0 ? 'rgba(255,159,10,0.15)' : 'rgba(48,209,88,0.15)', borderColor: HOME.alerts > 0 ? 'rgba(255,159,10,0.25)' : 'rgba(48,209,88,0.25)' }]}>
            <Ionicons name="notifications-outline" size={18} color={HOME.alerts > 0 ? '#FF9F0A' : '#30D158'} />
          </View>
          <Text style={S.rowLabel}>Active Alerts</Text>
          {HOME.alerts > 0
            ? <View style={S.inlineBadge}><Text style={S.inlineBadgeText}>{HOME.alerts}</Text></View>
            : <Text style={[S.rowValue, { color: '#30D158' }]}>None</Text>}
          <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.2)" />
        </CardRow>
      </GlassCard>
    </View>
  );
}

// ─── Climate strip ────────────────────────────────────────────────────────────
function ClimateStrip() {
  const items = [
    { icon: 'thermometer-outline' as const, val: `${HOME.temp}°`,    label: 'Indoor',   color: '#FF9F0A' },
    { icon: 'water-outline'       as const, val: `${HOME.humidity}%`, label: 'Humidity', color: '#32ADE6' },
    { icon: 'flash-outline'       as const, val: `${HOME.power} kW`,  label: 'Usage',    color: '#FFD60A' },
  ];
  return (
    <View style={S.section}>
      <View style={S.climateRow}>
        {items.map((item) => (
          <View key={item.label} style={S.climateTileOuter}>
            <View style={[S.climateTileBloom, { backgroundColor: `${item.color}14` }]} />
            <BlurView intensity={40} tint="dark" style={S.climateTileBlur}>
              <View style={S.climateTileSpecular} />
              <View style={S.climateTileContent}>
                <View style={[S.climateTileIcon, { backgroundColor: `${item.color}18`, borderColor: `${item.color}28` }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={S.climateVal}>{item.val}</Text>
                <Text style={S.climateSub}>{item.label}</Text>
              </View>
            </BlurView>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────
function QuickActions() {
  const [actions, setActions] = useState(ACTIONS);
  const toggle = (id: string) =>
    setActions((p) => p.map((a) => (a.id === id ? { ...a, on: !a.on } : a)));

  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity><Text style={S.sectionLink}>See All</Text></TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.actionScroll}
        decelerationRate="fast"
        snapToInterval={TILE + 12}
        snapToAlignment="start"
        pagingEnabled={false}
      >
        {actions.map((a) => {
          const on = a.on;
          return (
            <TouchableOpacity
              key={a.id}
              style={S.actionTileOuter}
              onPress={() => toggle(a.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${a.label} ${on ? 'on' : 'off'}`}
            >
              {/* bloom */}
              {on && <View style={[S.actionBloom, { backgroundColor: `${a.color}18` }]} />}
              {/* blur base */}
              <BlurView intensity={on ? 42 : 26} tint="dark" style={StyleSheet.absoluteFillObject} />
              {/* coloured gradient overlay when ON */}
              {on && (
                <LinearGradient
                  colors={[`${a.color}26`, `${a.color}0a`]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
              )}
              {/* specular sheen */}
              <View style={[S.actionSpecular, on && { backgroundColor: `${a.color}40` }]} />
              {/* inner border highlight */}
              <View style={[S.actionInnerBorder, on && { borderTopColor: `${a.color}35` }]} />

              {/* content */}
              <View style={S.actionTileContent}>
                {/* icon glass ring */}
                <View style={[S.actionIconRing, {
                  backgroundColor: on ? `${a.color}20` : 'rgba(255,255,255,0.07)',
                  borderColor: on ? `${a.color}35` : 'rgba(255,255,255,0.12)',
                  shadowColor: on ? a.color : 'transparent',
                }]}>
                  <Ionicons name={on ? a.fillIcon : a.icon} size={22} color={on ? a.color : 'rgba(255,255,255,0.35)'} />
                </View>
                <Text style={[S.actionTileLabel, { color: on ? '#fff' : 'rgba(255,255,255,0.4)' }]}>{a.label}</Text>
                <Text style={[S.actionTileSub,  { color: on ? a.color : 'rgba(255,255,255,0.18)' }]}>{a.sub}</Text>
                {/* ON/OFF pill */}
                <View style={[S.actionStatePill, { backgroundColor: on ? `${a.color}20` : 'rgba(255,255,255,0.06)', borderColor: on ? `${a.color}30` : 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[S.actionStateText, { color: on ? a.color : 'rgba(255,255,255,0.22)' }]}>
                    {on ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsSection() {
  if (HOME.alerts === 0) return null;
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <View style={S.sectionTitleRow}>
          <Text style={S.sectionTitle}>Alerts</Text>
          <View style={S.alertCountBadge}><Text style={S.alertCountText}>{HOME.alerts}</Text></View>
        </View>
        <TouchableOpacity><Text style={S.sectionLink}>View All</Text></TouchableOpacity>
      </View>
      <GlassCard bloom="rgba(255,55,55,0.06)">
        {ALERTS.map((a, i) => (
          <CardRow key={a.id} last={i === ALERTS.length - 1}>
            <View style={[S.alertIconRing, { backgroundColor: `${a.color}18`, borderColor: `${a.color}28` }]}>
              <Ionicons name={a.icon} size={17} color={a.color} />
            </View>
            <View style={S.alertBody}>
              <Text style={S.alertTitle}>{a.title}</Text>
              <Text style={S.alertSub}>{a.sub}</Text>
            </View>
            <Text style={S.alertTime}>{a.time}</Text>
            <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.2)" style={{ marginLeft: 6 }} />
          </CardRow>
        ))}
      </GlassCard>
    </View>
  );
}

// ─── Tab bar — iOS 26 liquid glass floating capsule ──────────────────────────
function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <View style={S.tabOuter}>
      {/* soft bloom glow behind the pill */}
      <View style={S.tabBloom} />

      {/* liquid glass pill */}
      <BlurView intensity={60} tint="dark" style={S.tabPill}>
        {/* specular top-edge sheen */}
        <View style={S.tabSpecular} />

        <View style={S.tabContent}>
          {Object.entries(TAB_ICONS).map(([id, tab]) => {
            const isActive = active === id;
            return (
              <TouchableOpacity
                key={id}
                style={S.tabItem}
                onPress={() => onChange(id)}
                activeOpacity={0.6}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
              >
                {isActive ? (
                  <BlurView intensity={50} tint="dark" style={S.tabActivePill}>
                    <LinearGradient
                      colors={['rgba(10,132,255,0.28)', 'rgba(10,132,255,0.12)']}
                      style={StyleSheet.absoluteFillObject}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
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
  const [activeTab, setActiveTab] = useState('home');

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

      <NavBar alerts={HOME.alerts} />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitle />
        <StatusSummary />
        <ClimateStrip />
        <QuickActions />
        <AlertsSection />
        <View style={{ height: IOS_BOTTOM + 110 }} />
      </ScrollView>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06091a' },

  // Ambient orbs
  orb1: { position: 'absolute', width: width * 0.9,  height: width * 0.9,  borderRadius: width * 0.45, backgroundColor: 'rgba(50,110,255,0.12)', top: -width * 0.25,  right: -width * 0.25 },
  orb2: { position: 'absolute', width: width * 0.7,  height: width * 0.7,  borderRadius: width * 0.35, backgroundColor: 'rgba(100,60,200,0.09)', bottom: height * 0.15, left: -width * 0.2  },
  orb3: { position: 'absolute', width: width * 0.5,  height: width * 0.5,  borderRadius: width * 0.25, backgroundColor: 'rgba(0,160,255,0.07)',  bottom: height * 0.35, right: -width * 0.1 },

  // Nav bar — liquid glass floating capsule
  navOuter: {
    paddingHorizontal: H_PAD,
    paddingTop: IOS_TOP,
    paddingBottom: 10,
    zIndex: 20,
    alignItems: 'stretch',
  },
  navBloom: {
    position: 'absolute',
    top: IOS_TOP - 10,
    left: H_PAD + 20,
    right: H_PAD + 20,
    height: 70,
    borderRadius: 40,
    backgroundColor: 'rgba(60,110,255,0.18)',
    // shadow creates a soft glow
    shadowColor: '#4080ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 0,
  },
  navPill: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    // deep shadow for the floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  // bright thin line at the very top — the specular/liquid sheen
  navSpecular: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 1.2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 2,
  },
  navContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    // inner top highlight
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderRadius: 22,
  },
  navLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogoRing: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  navLogoImg: { width: 24, height: 16 },
  navBrand:   { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  navIconBtn: { position: 'relative' },
  navIconGlass: {
    width: 36,
    height: 36,
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  navDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF375F',
    borderWidth: 1.5,
    borderColor: '#06091a',
    zIndex: 1,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },

  // ── Large title ──────────────────────────────────────────────────────────────
  largeTitleSection: { paddingHorizontal: 2, marginBottom: 32, marginTop: 12 },
  largeTitleSub:  { fontSize: 17, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: 0.1 },
  largeTitleMain: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1.0, lineHeight: 44, marginBottom: 16 },

  // Status pill (liquid glass)
  statusPillOuter:    { alignSelf: 'flex-start' },
  statusPillBloom:    { position: 'absolute', top: 2, left: 4, right: 4, height: 32, borderRadius: 20, opacity: 0.6 },
  statusPillBlur:     { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  statusPillSpecular: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  statusPillContent:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 20 },
  statusPillDot:      { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5, elevation: 3 },
  statusPillText:     { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  // (unused legacy — kept so no missing-key errors)
  armedBadge: { flexDirection: 'row' as const },
  armedDot:   { width: 7, height: 7, borderRadius: 4 },
  armedText:  { fontSize: 13 },

  // ── GlassCard shell ──────────────────────────────────────────────────────────
  glassCardOuter:    { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 20, elevation: 12 },
  glassCardBloom:    { position: 'absolute', top: 4, left: 12, right: 12, height: 40, borderRadius: 24 },
  glassCardBlur:     { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  glassCardSpecular: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)', zIndex: 2 },
  glassCardInner: {
    borderTopWidth: 1,    borderTopColor:    'rgba(255,255,255,0.16)',
    borderLeftWidth: 1,   borderLeftColor:   'rgba(255,255,255,0.07)',
    borderRightWidth: 1,  borderRightColor:  'rgba(255,255,255,0.04)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
  },
  // unused legacy
  groupCard:      { borderRadius: 16 },
  groupCardInner: { borderRadius: 16 },

  // ── Table rows (iOS Settings style) ──────────────────────────────────────────
  // Standard iOS row height: 52–56pt
  cardRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 0, height: 56 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)', marginLeft: 66 },
  // iOS icon container: 30×30 rounded square inside a 36×36 hit area
  rowIconRing: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1 },
  rowIcon:     { marginRight: 16 },
  rowLabel:    { flex: 1, fontSize: 17, fontWeight: '400', color: 'rgba(255,255,255,0.92)', letterSpacing: -0.2 },
  rowValue:    { fontSize: 17, fontWeight: '500', color: 'rgba(255,255,255,0.45)', marginRight: 8 },
  inlineBadge:     { backgroundColor: '#FF9F0A', borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3, marginRight: 8 },
  inlineBadgeText: { fontSize: 13, fontWeight: '700', color: '#000' },

  // ── Section headers ───────────────────────────────────────────────────────────
  section:         { marginBottom: 32 },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  sectionLink:     { fontSize: 16, fontWeight: '500', color: '#0A84FF' },
  alertCountBadge: { backgroundColor: '#FF375F', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, minWidth: 22, alignItems: 'center' },
  alertCountText:  { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Climate — 3 equal liquid glass tiles, fixed height ───────────────────────
  climateRow:         { flexDirection: 'row', gap: 12 },
  climateTileOuter:   { flex: 1, height: 130, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },
  climateTileBloom:   { position: 'absolute', top: 4, left: 4, right: 4, height: 44, borderRadius: 20 },
  climateTileBlur:    { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  climateTileSpecular:{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1, zIndex: 2 },
  climateTileContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderRadius: 20 },
  climateTileIcon:    { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 4 },
  climateVal:         { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.4 },
  climateSub:         { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.42)', letterSpacing: 0.2 },
  // unused legacy
  climateStrip: { flexDirection: 'row' as const },
  climateCell: { flex: 1 },
  vertDivider: { position: 'absolute' as const },
  climateCellContent: { alignItems: 'center' as const },
  climateIconWrap: { width: 36, height: 36 },

  // ── Quick action tiles — fixed 160pt tall, comfortable reading ────────────────
  actionScroll:     { paddingHorizontal: 2, paddingBottom: 6, gap: 12 },
  // TILE width set at top of file — ~2.3 tiles visible
  actionTileOuter:  { width: TILE, height: 160, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  actionBloom:      { position: 'absolute', top: 4, left: 4, right: 4, height: 60, borderRadius: 20 },
  actionSpecular:   { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 1, zIndex: 2 },
  actionInnerBorder:{ ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 24 } as any,
  actionTileContent:{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'space-between' },
  // icon: 48×48 ring — matches iOS Home app tile icon size
  actionIconRing:   { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  actionTileLabel:  { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, lineHeight: 20 },
  actionTileSub:    { fontSize: 13, fontWeight: '500', letterSpacing: 0.1, lineHeight: 17 },
  actionStatePill:  { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  actionStateText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  // unused legacy
  actionTile:       { width: TILE },
  actionIconCircle: { width: 44, height: 44 },
  actionDot:        { width: 6, height: 6 },

  // ── Alert rows ────────────────────────────────────────────────────────────────
  alertIconRing: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  alertIconWrap: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  alertBody:  { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '600', color: '#fff', letterSpacing: -0.2, marginBottom: 3 },
  alertSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  alertTime:  { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.32)' },

  // Tab bar — liquid glass floating capsule
  tabOuter: {
    position: 'absolute',
    bottom: IOS_BOTTOM,
    left: H_PAD,
    right: H_PAD,
    zIndex: 20,
  },
  tabBloom: {
    position: 'absolute',
    top: 4,
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 40,
    backgroundColor: 'rgba(40,90,255,0.16)',
    shadowColor: '#3060ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 0,
  },
  tabPill: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 18,
  },
  // specular top sheen
  tabSpecular: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1.2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    zIndex: 2,
  },
  tabContent: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  // active tab: nested mini glass pill
  tabActivePill: {
    width: 44,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.35)',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  // inner sheen on the active pill
  tabActiveSheen: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 1,
  },
  tabIconWrap: {
    width: 44,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
});
