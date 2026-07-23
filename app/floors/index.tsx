import {
    addFloor,
    deleteFloor,
    getDevices,
    getFloors,
    updateFloor,
} from '@/services/deviceService';
import { Device, Floor } from '@/types/device';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const IOS_TOP    = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD      = 20;
const CARD_W     = (width - H_PAD * 2 - 16) / 2;

// ─── Floor level config ───────────────────────────────────────────────────────
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

// ─── Floor plan preview image ─────────────────────────────────────────────────
// This image appears as a thumbnail at the top of every floor card in the grid.
const FLOOR_PLAN_IMAGE = require('@/assets/images/floor_plan_preview.png');

function countFloorDevices(devices: Device[], floorId: string) {
  const all    = devices.filter(d => d.floorId === floorId);
  const active = all.filter(d => d.status === 'on');
  return { total: all.length, active: active.length };
}

// ─── GlassCard ────────────────────────────────────────────────────────────────
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

// ─── NavBar ───────────────────────────────────────────────────────────────────
function NavBar({ onBack, onAdd }: { onBack: () => void; onAdd: () => void }) {
  return (
    <View style={S.navOuter}>
      <View style={S.navBloom} />
      <BlurView intensity={55} tint="dark" style={S.navPill}>
        <View style={S.navSpecular} />
        <View style={S.navContent}>
          <TouchableOpacity style={S.navIconBtn} onPress={onBack}
            accessibilityLabel="Go back" accessibilityRole="button">
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.88)" />
            </BlurView>
          </TouchableOpacity>
          <View style={S.navCenter}>
            <View style={S.navLogoRing}>
              <Image source={require('@/assets/images/logo.png')} style={S.navLogoImg} resizeMode="contain" />
            </View>
            <Text style={S.navBrand}>My Floors</Text>
          </View>
          <TouchableOpacity style={S.navIconBtn} onPress={onAdd}
            accessibilityLabel="Add floor" accessibilityRole="button">
            <BlurView intensity={40} tint="dark" style={S.navIconGlass}>
              <Ionicons name="add" size={22} color="#0A84FF" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

// ─── Summary ribbon ───────────────────────────────────────────────────────────
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

// ─── Floor card ───────────────────────────────────────────────────────────────
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
        {/* Bloom */}
        <View style={[S.cardBloom, { backgroundColor: `${meta.color}18` }]} />
        <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[S.cardSpecular, { backgroundColor: `${meta.color}30` }]} />
        <View style={[S.cardInnerBorder as any, { borderTopColor: `${meta.color}35` }]} />

        {/* ── Floor plan image preview ──────────────────────────────────── */}
        <View style={S.previewWrap}>
          <Image source={FLOOR_PLAN_IMAGE} style={S.previewImg} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.90)']}
            style={S.previewGradient}
          />
          {/* Level badge — top-left corner of the image */}
          <View style={[S.levelBadge, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[S.levelBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {/* Alert dot — top-right corner of the image */}
          {hasIssues && <View style={S.issueDot} />}
        </View>

        {/* Floor name */}
        <Text style={S.cardTitle} numberOfLines={2}>{floor.name}</Text>

        {/* Stats chips */}
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

        {/* Progress bar */}
        <View style={S.progressTrack}>
          <View style={[S.progressFill, {
            width: `${total > 0 ? Math.round((active / total) * 100) : 0}%` as any,
            backgroundColor: meta.color,
          }]} />
        </View>

        {/* Action buttons */}
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

// ─── Ghost add card ───────────────────────────────────────────────────────────
function GhostCard({ onAdd }: { onAdd: () => void }) {
  return (
    <TouchableOpacity style={S.ghostCard} onPress={onAdd} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel="Add new floor">
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={S.ghostInner}>
        <View style={S.ghostIconRing}>
          <Ionicons name="add" size={28} color="rgba(10,132,255,0.8)" />
        </View>
        <Text style={S.ghostText}>Add Floor</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <GlassCard bloom="rgba(10,132,255,0.08)">
      <View style={S.emptyInner}>
        <View style={S.emptyIconRing}>
          <Ionicons name="layers-outline" size={36} color="#0A84FF" />
        </View>
        <Text style={S.emptyTitle}>No Floors Yet</Text>
        <Text style={S.emptySub}>Add your first floor to start organizing your smart home devices.</Text>
        <TouchableOpacity style={S.emptyAddBtn} onPress={onAdd}
          accessibilityRole="button" accessibilityLabel="Add first floor">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(10,132,255,0.4)','rgba(10,132,255,0.2)']}
            style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={S.emptyAddBtnText}>Add First Floor</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
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
      <KeyboardAvoidingView style={StyleSheet.absoluteFillObject}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

          {/* Name input */}
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

          {/* Level picker */}
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

          {/* Save button */}
          <TouchableOpacity style={S.saveBtn} onPress={handleSave} accessibilityRole="button">
            <LinearGradient colors={['#1a6fff','#0A84FF','#0066dd']} style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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

// ─── Root screen ──────────────────────────────────────────────────────────────
export default function FloorSelectionScreen() {
  const [floors,        setFloors]        = useState<Floor[]>([]);
  const [devices,       setDevices]       = useState<Device[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [editingFloor,  setEditingFloor]  = useState<Floor | null>(null);

  const totalDevices  = useMemo(() => devices.length, [devices]);
  const activeDevices = useMemo(() => devices.filter(d => d.status === 'on').length, [devices]);
  const alertCount    = useMemo(() => devices.filter(d => d.status === 'error' || d.status === 'offline').length, [devices]);

  useEffect(() => {
    Promise.all([getFloors(), getDevices()]).then(([f, d]) => {
      setFloors(f); setDevices(d); setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (name: string, level: number) => {
    if (editingFloor) {
      await updateFloor(editingFloor.id, { name, level });
      setFloors(prev => prev.map(f => f.id === editingFloor.id ? { ...f, name, level } : f));
    } else {
      const newFloor = await addFloor(name, level);
      setFloors(prev => [...prev, newFloor]);
    }
    setModalVisible(false);
  }, [editingFloor]);

  const handleDelete = useCallback((floor: Floor) => {
    Alert.alert('Delete Floor', `Remove "${floor.name}"? All devices on this floor will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteFloor(floor.id);
        setFloors(prev => prev.filter(f => f.id !== floor.id));
      }},
    ]);
  }, []);

  const handleOpenFloor = useCallback((floor: Floor) => {
    Alert.alert(floor.name, `${floor.deviceCount} devices · ${floor.activeDeviceCount} active\n\nDevice detail view coming soon.`);
  }, []);

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#06091a','#0b1530','#0d1f4a','#06091a']}
        locations={[0, 0.35, 0.65, 1]} style={StyleSheet.absoluteFillObject} />
      <View style={S.orb1} /><View style={S.orb2} /><View style={S.orb3} />

      <NavBar onBack={() => router.back()} onAdd={() => { setEditingFloor(null); setModalVisible(true); }} />

      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={S.heroSection}>
          <Text style={S.heroSub}>Smart Home</Text>
          <Text style={S.heroTitle}>Floor Selection</Text>
          <Text style={S.heroDesc}>Manage and navigate all floors of your home</Text>
          <View style={S.ribbonRow}>
            <RibbonCard icon="layers"         value={floors.length}  label="Floors"  color="#0A84FF" />
            <RibbonCard icon="grid-outline"   value={totalDevices}   label="Devices" color="#BF5AF2" />
            <RibbonCard icon="power-outline"  value={activeDevices}  label="Active"  color="#30D158" />
            {alertCount > 0 && <RibbonCard icon="warning-outline" value={alertCount} label="Alerts" color="#FF9F0A" />}
          </View>
        </View>

        {/* Section header */}
        <View style={S.sectionHeader}>
          <View style={S.sectionTitleRow}>
            <Text style={S.sectionTitle}>All Floors</Text>
            {floors.length > 0 && (
              <View style={S.floorCountBadge}><Text style={S.floorCountText}>{floors.length}</Text></View>
            )}
          </View>
          <TouchableOpacity style={S.addPill} onPress={() => { setEditingFloor(null); setModalVisible(true); }}
            accessibilityRole="button" accessibilityLabel="Add floor">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(10,132,255,0.35)','rgba(10,132,255,0.18)']}
              style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Ionicons name="add" size={16} color="#0A84FF" />
            <Text style={S.addPillText}>Add Floor</Text>
          </TouchableOpacity>
        </View>

        {/* Grid */}
        {loading ? (
          <View style={S.loadingWrap}><Text style={S.loadingText}>Loading floors…</Text></View>
        ) : floors.length === 0 ? (
          <EmptyState onAdd={() => { setEditingFloor(null); setModalVisible(true); }} />
        ) : (
          <View style={S.grid}>
            {floors.map(floor => (
              <FloorCard key={floor.id} floor={floor} devices={devices}
                onOpen={() => handleOpenFloor(floor)}
                onEdit={() => { setEditingFloor(floor); setModalVisible(true); }}
                onDelete={() => handleDelete(floor)} />
            ))}
            <GhostCard onAdd={() => { setEditingFloor(null); setModalVisible(true); }} />
          </View>
        )}

        {/* Tip */}
        {floors.length > 0 && (
          <View style={S.tipSection}>
            <GlassCard bloom="rgba(10,132,255,0.04)">
              <View style={S.tipRow}>
                <View style={S.tipIconRing}>
                  <Ionicons name="information-circle-outline" size={20} color="#0A84FF" />
                </View>
                <Text style={S.tipText}>
                  Tap a floor card to view all its devices. Use the pencil to rename or the trash to remove a floor.
                </Text>
              </View>
            </GlassCard>
          </View>
        )}

        <View style={{ height: IOS_BOTTOM + 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={S.fab} onPress={() => { setEditingFloor(null); setModalVisible(true); }}
        accessibilityRole="button" accessibilityLabel="Add floor">
        <LinearGradient colors={['#1a6fff','#0A84FF']} style={StyleSheet.absoluteFillObject} />
        <View style={S.fabSheen} />
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FloorModal visible={modalVisible} editingFloor={editingFloor}
        onClose={() => setModalVisible(false)} onSave={handleSave} />
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
  navCenter:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogoRing:  { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  navLogoImg:   { width: 24, height: 16 },
  navBrand:     { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  navIconBtn:   { position: 'relative' },
  navIconGlass: { width: 36, height: 36, borderRadius: 11, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },

  // Hero
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

  // GlassCard
  glassCardOuter:    { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 20, elevation: 12 },
  glassCardBloom:    { position: 'absolute', top: 4, left: 12, right: 12, height: 40, borderRadius: 24 },
  glassCardBlur:     { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  glassCardSpecular: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)', zIndex: 2 },
  glassCardInner:    { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 20 },

  // Section header
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  floorCountBadge: { backgroundColor: 'rgba(10,132,255,0.22)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(10,132,255,0.4)' },
  floorCountText:  { fontSize: 13, fontWeight: '700', color: '#0A84FF' },
  addPill:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,132,255,0.45)' },
  addPillText:     { fontSize: 14, fontWeight: '600', color: '#0A84FF' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 },

  // Floor card
  cardWrap:        { width: CARD_W, borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  cardTouchable:   { flex: 1 },
  cardBloom:       { position: 'absolute', top: 4, left: 4, right: 4, height: 80, borderRadius: 20, opacity: 0.7 },
  cardSpecular:    { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, borderRadius: 1, zIndex: 2 },
  cardInnerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderRadius: 22 },

  // Floor plan image thumbnail
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
  emptyInner:    { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
  emptyIconRing: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.12)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)', marginBottom: 4 },
  emptyTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.4 },
  emptySub:      { fontSize: 15, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22 },
  emptyAddBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,132,255,0.5)', marginTop: 8 },
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
  fab:      { position: 'absolute', bottom: IOS_BOTTOM+24, right: H_PAD, width: 58, height: 58, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  fabSheen: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 1, zIndex: 2 },

  // Modal
  modalBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d1a35', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: H_PAD, paddingTop: 12, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.14)', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20 },
  modalHandle:    { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  modalTitle:     { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  modalCloseBtn:  { width: 32, height: 32, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  inputSection:   { marginBottom: 20 },
  inputLabel:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', height: 52 },
  inputBorder:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', borderRadius: 16 },
  inputIcon:      { marginLeft: 16 },
  textInput:      { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500', paddingHorizontal: 12, height: '100%' },
  levelPicker:    { flexDirection: 'row', gap: 10 },
  levelOption:    { flex: 1, height: 72, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  levelOptionText:{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  saveBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 18, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  saveBtnSheen:   { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, zIndex: 2 },
  saveBtnText:    { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
});
