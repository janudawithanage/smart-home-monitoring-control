import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloorCard from '@/components/FloorCard';
import { Colors } from '@/constants/colors';
import { getFloors } from '@/services/deviceService';
import { Floor } from '@/types/device';

export default function FloorsScreen() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFloors().then((f) => {
      setFloors(f);
      setLoading(false);
    });
  }, []);

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
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Floors</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.accent.blue}
            style={{ marginTop: 60 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>
              {floors.length} floor{floors.length !== 1 ? 's' : ''} in your home
            </Text>
            {floors.map((floor) => (
              <FloorCard key={floor.id} floor={floor} />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
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
  backIcon: {
    fontSize: 24,
    color: Colors.text.primary,
    lineHeight: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },

  scrollContent: { paddingTop: 8, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14,
    color: Colors.text.muted,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
});
