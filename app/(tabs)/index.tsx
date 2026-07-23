import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATS = [
  { label: 'TOTAL DEVICES', value: '24', unit: 'active', color: '#6aabff' },
  { label: 'ACTIVE ALERTS', value: '12', unit: 'normal', color: '#4ade80' },
  { label: 'POWER USAGE', value: '1.2', unit: 'kW', color: '#facc15' },
];

const QUICK_SCENES = [
  { id: 'leave', icon: 'log-out-outline' as const, label: 'Leave Home' },
  { id: 'arrive', icon: 'home-outline' as const, label: 'Arrive Home' },
  { id: 'night', icon: 'moon-outline' as const, label: 'Night Mode' },
];

const ACTIVITY = [
  {
    id: 1,
    icon: 'person-outline' as const,
    title: 'Motion Detected',
    subtitle: 'Front Porch Camera • Zone A',
    time: '10:42 AM',
    dot: '#4ade80',
  },
  {
    id: 2,
    icon: 'lock-open-outline' as const,
    title: 'Door Unlocked',
    subtitle: "Main Entrance • Alex's Key",
    time: '09:15 AM',
    dot: '#6aabff',
  },
  {
    id: 3,
    icon: 'snow-outline' as const,
    title: 'HVAC Adjusted',
    subtitle: 'Living Room • Eco Mode active',
    time: '07:30 AM',
    dot: 'rgba(255,255,255,0.25)',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <BlurView intensity={50} tint="dark" style={styles.statCard}>
      <View style={styles.statCardInner}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueRow}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statUnit}>{unit}</Text>
        </View>
      </View>
    </BlurView>
  );
}

function TemperatureWidget() {
  const [brightness, setBrightness] = useState(true);

  return (
    <View style={styles.climateRow}>
      {/* Temperature knob */}
      <BlurView intensity={50} tint="dark" style={styles.tempCard}>
        <View style={styles.tempCardInner}>
          <View style={styles.tempKnob}>
            <View style={styles.tempKnobRing} />
            <View style={styles.tempKnobInner}>
              <Text style={styles.tempValue}>22°</Text>
            </View>
          </View>
          <Text style={styles.tempLabel}>TEMPERATURE</Text>
          <View style={styles.tempControls}>
            <TouchableOpacity style={styles.tempBtn}>
              <Ionicons name="remove" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tempBtn}>
              <Ionicons name="add" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Humidity + Brightness */}
      <View style={styles.climateRight}>
        <BlurView intensity={50} tint="dark" style={styles.climateSubCard}>
          <View style={styles.climateSubCardInner}>
            <View style={styles.climateSubHeader}>
              <Ionicons name="water-outline" size={16} color="#6aabff" />
              <Text style={styles.climateOptimal}>OPTIMAL</Text>
            </View>
            <Text style={styles.climatePercent}>45%</Text>
            <Text style={styles.climateSubLabel}>HUMIDITY</Text>
          </View>
        </BlurView>

        <BlurView intensity={50} tint="dark" style={styles.climateSubCard}>
          <View style={styles.climateSubCardInner}>
            <View style={styles.climateSubHeader}>
              <Ionicons name="bulb-outline" size={16} color="#facc15" />
              <Switch
                value={brightness}
                onValueChange={setBrightness}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#3264f5' }}
                thumbColor="#ffffff"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <Text style={styles.climatePercent}>82%</Text>
            <Text style={styles.climateSubLabel}>BRIGHTNESS</Text>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

function QuickSceneButton({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.sceneButton} activeOpacity={0.75}>
      <BlurView intensity={45} tint="dark" style={styles.sceneBlur}>
        <View style={styles.sceneInner}>
          <Ionicons name={icon} size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.sceneLabel}>{label}</Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function ActivityItem({
  icon,
  title,
  subtitle,
  time,
  dot,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  time: string;
  dot: string;
}) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityDot, { backgroundColor: dot }]} />
      <BlurView intensity={40} tint="dark" style={styles.activityCard}>
        <View style={styles.activityCardInner}>
          <View style={styles.activityIconWrap}>
            <Ionicons name={icon} size={18} color="rgba(255,255,255,0.7)" />
          </View>
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>{title}</Text>
            <Text style={styles.activitySubtitle}>{subtitle}</Text>
          </View>
          <Text style={styles.activityTime}>{time}</Text>
        </View>
      </BlurView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'security' | 'energy'>('home');

  const TAB_ITEMS = [
    { id: 'home' as const, icon: 'home-outline', activeIcon: 'home' },
    { id: 'devices' as const, icon: 'layers-outline', activeIcon: 'layers' },
    { id: 'security' as const, icon: 'shield-outline', activeIcon: 'shield' },
    { id: 'energy' as const, icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient — same palette as login */}
      <LinearGradient
        colors={['#06091a', '#0b1530', '#0d1f4a', '#06091a']}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.topLogo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>LuxeHome</Text>
        </View>
        <TouchableOpacity style={styles.shieldBtn}>
          <Ionicons name="shield-checkmark-outline" size={22} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingLabel}>{getGreeting()}</Text>
          <Text style={styles.greetingTitle}>{'Welcome\nHome, Alex'}</Text>
        </View>

        {/* Status banner */}
        <BlurView intensity={55} tint="dark" style={styles.statusBanner}>
          <View style={styles.statusBannerInner}>
            <View style={styles.statusIconWrap}>
              <Ionicons name="shield-checkmark" size={22} color="#4ade80" />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>System Secure</Text>
              <Text style={styles.statusSubtitle}>All 24 devices are currently online</Text>
            </View>
          </View>
        </BlurView>

        {/* Stats */}
        <View style={styles.statsSection}>
          {STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </View>

        {/* Temperature & Climate */}
        <TemperatureWidget />

        {/* Quick Scenes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>QUICK SCENES</Text>
        </View>
        <View style={styles.scenesSection}>
          {QUICK_SCENES.map((scene) => (
            <QuickSceneButton key={scene.id} icon={scene.icon} label={scene.label} />
          ))}
        </View>

        {/* Energy Goal */}
        <BlurView intensity={50} tint="dark" style={styles.energyCard}>
          <View style={styles.energyCardInner}>
            <View style={styles.energyHeader}>
              <Text style={styles.energyGoalLabel}>Monthly Goal</Text>
              <Ionicons name="flash" size={18} color="#facc15" />
            </View>
            <Text style={styles.energyValue}>740 kWh</Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#4ade80', '#22c55e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </View>
            <Text style={styles.energyNote}>
              {"You're tracking 12% lower than last month"}
            </Text>
          </View>
        </BlurView>

        {/* Recent Activity */}
        <View style={[styles.sectionHeader, styles.activityHeader]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          {ACTIVITY.map((item) => (
            <ActivityItem key={item.id} {...item} />
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <BlurView intensity={80} tint="dark" style={styles.tabBar}>
        <View style={styles.tabBarInner}>
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.75}
              >
                {isActive ? (
                  <LinearGradient
                    colors={['rgba(80,130,255,0.9)', 'rgba(50,100,240,0.9)']}
                    style={styles.tabActiveGlow}
                  >
                    <Ionicons
                      name={tab.activeIcon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color="#ffffff"
                    />
                  </LinearGradient>
                ) : (
                  <Ionicons
                    name={tab.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color="rgba(255,255,255,0.4)"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06091a',
  },

  // Ambient orbs (matching login page)
  orb1: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(50, 110, 255, 0.10)',
    top: -width * 0.25,
    right: -width * 0.25,
  },
  orb2: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(100, 60, 200, 0.08)',
    bottom: '20%',
    left: -width * 0.2,
  },
  orb3: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(0, 160, 255, 0.06)',
    top: '42%',
    right: -width * 0.1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  shieldBtn: {
    padding: 4,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Greeting
  greetingSection: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  greetingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 42,
  },

  // Status banner
  statusBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderRadius: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 17,
  },

  // Stats
  statsSection: {
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  statCardInner: {
    padding: 16,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },

  // Climate / Temperature
  climateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tempCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tempCardInner: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  tempKnob: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  tempKnobRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(106,171,255,0.3)',
    borderTopColor: '#6aabff',
    borderRightColor: '#6aabff',
  },
  tempKnobInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tempValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  tempLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  tempControls: {
    flexDirection: 'row',
    gap: 10,
  },
  tempBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  climateRight: {
    flex: 1,
    gap: 12,
  },
  climateSubCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  climateSubCardInner: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'space-between',
  },
  climateSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  climateOptimal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 0.8,
  },
  climatePercent: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  climateSubLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.0,
  },

  // Section header
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.3,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6aabff',
    letterSpacing: 0.8,
  },

  // Quick scenes
  scenesSection: {
    gap: 10,
    marginBottom: 20,
  },
  sceneButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  sceneBlur: {
    borderRadius: 16,
  },
  sceneInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sceneLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },

  // Energy goal
  energyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  energyCardInner: {
    padding: 20,
    borderRadius: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  energyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  energyGoalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  energyValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    width: '62%',
  },
  energyNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },

  // Activity
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  activityCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activityCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  activityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 15,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
  },

  // Bottom tab bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActiveGlow: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4070ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
