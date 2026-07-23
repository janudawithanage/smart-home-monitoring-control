import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignIn = () => {
    // Navigate to the dashboard after sign in
    router.replace('/dashboard');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#0a1628', '#0d2044', '#0f2a5c', '#0a1628']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative background circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Card */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoCard}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Manage your sanctuary with precision.
              </Text>
            </View>

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                <Text style={styles.inputIcon}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@luxury.com"
                  placeholderTextColor="#4a5a7a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#4a5a7a"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#3d6bea', '#4d7cf4', '#5a8aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                <Text style={styles.signInText}>Sign In</Text>
                <Text style={styles.signInArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialLabel}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <Text style={styles.appleGrid}>⊞</Text>
                <Text style={styles.socialLabel}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to the platform? </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.footerLink}>Request Access</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
  },

  // Background decoration
  bgCircle1: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(61, 107, 234, 0.08)',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: 'rgba(61, 107, 234, 0.05)',
    bottom: height * 0.2,
    left: -width * 0.15,
  },

  // Logo
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCard: {
    width: 120,
    height: 120,
    backgroundColor: '#0f1e3a',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3d6bea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(61, 107, 234, 0.2)',
  },
  logoImage: {
    width: 100,
    height: 60,
  },

  // Card
  card: {
    width: width - 32,
    backgroundColor: '#0f1e3a',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(61, 107, 234, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },

  // Header
  header: {
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#8a9bc0',
    lineHeight: 24,
  },

  // Form fields
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c0cce8',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4d7cf4',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1628',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(61, 107, 234, 0.2)',
    paddingHorizontal: 14,
    height: 54,
  },
  inputWrapperFocused: {
    borderColor: '#4d7cf4',
    backgroundColor: '#0d1e38',
    shadowColor: '#4d7cf4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    fontSize: 16,
    color: '#4a5a7a',
    marginRight: 10,
    width: 20,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    color: '#e8f0fe',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },

  // Sign In Button
  signInButton: {
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3d6bea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  signInGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 17,
    gap: 10,
  },
  signInText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signInArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(61, 107, 234, 0.2)',
  },
  dividerText: {
    fontSize: 11,
    color: '#4a5a7a',
    fontWeight: '600',
    letterSpacing: 1.5,
  },

  // Social Buttons
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a1628',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(61, 107, 234, 0.2)',
    paddingVertical: 14,
    gap: 8,
  },
  googleG: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
  },
  appleGrid: {
    fontSize: 16,
    color: '#c0cce8',
  },
  socialLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c0cce8',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
    color: '#6a7a98',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4d7cf4',
  },
});
