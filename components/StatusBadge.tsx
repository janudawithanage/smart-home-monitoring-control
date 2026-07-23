import { Colors } from '@/constants/colors';
import { getStatusLabel } from '@/services/deviceService';
import { DeviceStatus } from '@/types/device';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  status: DeviceStatus;
  /** Show only the dot without text */
  dotOnly?: boolean;
}

export default function StatusBadge({ status, dotOnly = false }: Props) {
  const color = Colors.status[status];

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {!dotOnly && (
        <Text style={[styles.label, { color }]}>{getStatusLabel(status)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
