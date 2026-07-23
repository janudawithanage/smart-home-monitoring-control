import { Colors } from '@/constants/colors';
import React, { useRef } from 'react';
import {
    Animated,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

interface Props {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const SIZE = { sm: { w: 40, h: 22, thumb: 16 }, md: { w: 52, h: 30, thumb: 22 } };

export default function SwitchButton({
  value,
  onToggle,
  disabled = false,
  size = 'md',
}: Props) {
  const { w, h, thumb } = SIZE[size];
  const translateX = useRef(new Animated.Value(value ? w - thumb - 4 : 2)).current;

  const handlePress = () => {
    if (disabled) return;
    const toValue = value ? 2 : w - thumb - 4;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
    onToggle();
  };

  const trackColor = value ? Colors.accent.blue : Colors.bg.elevated;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      disabled={disabled}
      accessible
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={value ? 'Turn off' : 'Turn on'}
    >
      <View
        style={[
          styles.track,
          {
            width: w,
            height: h,
            borderRadius: h / 2,
            backgroundColor: trackColor,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumb,
              height: thumb,
              borderRadius: thumb / 2,
              top: (h - thumb) / 2,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
