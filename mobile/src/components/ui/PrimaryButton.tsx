import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  style?: StyleProp<ViewStyle>;
}

const variantStyles = {
  primary: { backgroundColor: COLORS.primary, textColor: '#fff' },
  secondary: { backgroundColor: COLORS.surface, textColor: COLORS.primary },
  success: { backgroundColor: COLORS.success, textColor: '#fff' },
  danger: { backgroundColor: COLORS.danger, textColor: '#fff' },
};

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const { backgroundColor, textColor } = variantStyles[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor, opacity: disabled ? 0.6 : 1 }, style]}
    >
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
