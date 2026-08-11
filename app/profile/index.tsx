import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert, Image, KeyboardAvoidingView, Platform,
    ScrollView, StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';

const IOS_TOP = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD = 20;

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  avatarUri?: string;
}

const INITIAL_DATA: ProfileData = {
  firstName: 'Januda',
  lastName: 'Withanage',
  email: 'januda@smarthome.com',
  phone: '+1 (555) 123-4567',
  address: '123 Smart Street',
  city: 'San Francisco',
  country: 'United States',
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData>(INITIAL_DATA);
  const [isEditing, setIsEditing] = useState(false);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Allow access to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfile({ ...profile, avatarUri: result.assets[0].uri });
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleCancel = () => {
    setProfile(INITIAL_DATA);
    setIsEditing(false);
  };

  return (
    <View style={S.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0a1628', '#0d1b33', '#0a1628']} style={StyleSheet.absoluteFillObject} />
      
      {/* Navigation Bar */}
      <View style={S.navOuter}>
        <View style={S.navBloom} />
        <BlurView intensity={55} tint="dark" style={S.navPill}>
          <View style={S.navSpecular} />
          <View style={S.navContent}>
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="chevron-back" size={24} color="#0A84FF" />
            </TouchableOpacity>
            <Text style={S.navTitle}>Profile</Text>
            <TouchableOpacity 
              style={S.editBtn} 
              onPress={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Text style={S.editBtnText}>{isEditing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={S.scroll}
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={S.avatarSection}>
            <TouchableOpacity 
              style={S.avatarContainer} 
              onPress={isEditing ? handlePickImage : undefined}
              disabled={!isEditing}
            >
              <View style={S.avatarRing}>
                <LinearGradient colors={['#1a6fff', '#0A84FF']} style={StyleSheet.absoluteFillObject} />
              </View>
              {profile.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={S.avatarImage} />
              ) : (
                <View style={S.avatarPlaceholder}>
                  <Text style={S.avatarInitials}>{profile.firstName[0]}{profile.lastName[0]}</Text>
                </View>
              )}
              {isEditing && (
                <View style={S.avatarEditBadge}>
                  <Ionicons name="camera" size={18} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={S.profileName}>{profile.firstName} {profile.lastName}</Text>
            <View style={S.premiumBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#30D158" />
              <Text style={S.premiumText}>Premium Member</Text>
            </View>
          </View>

          {/* Personal Information */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Personal Information</Text>
            
            <View style={S.inputRow}>
              <View style={S.inputHalf}>
                <Text style={S.inputLabel}>First Name</Text>
                <View style={S.inputContainer}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                  <TextInput
                    style={S.input}
                    value={profile.firstName}
                    onChangeText={(text) => setProfile({ ...profile, firstName: text })}
                    editable={isEditing}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
              
              <View style={S.inputHalf}>
                <Text style={S.inputLabel}>Last Name</Text>
                <View style={S.inputContainer}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                  <TextInput
                    style={S.input}
                    value={profile.lastName}
                    onChangeText={(text) => setProfile({ ...profile, lastName: text })}
                    editable={isEditing}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
            </View>

            <View style={S.inputField}>
              <Text style={S.inputLabel}>Email Address</Text>
              <View style={S.inputContainer}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                <TextInput
                  style={S.input}
                  value={profile.email}
                  onChangeText={(text) => setProfile({ ...profile, email: text })}
                  editable={isEditing}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
            </View>

            <View style={S.inputField}>
              <Text style={S.inputLabel}>Phone Number</Text>
              <View style={S.inputContainer}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="call-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                <TextInput
                  style={S.input}
                  value={profile.phone}
                  onChangeText={(text) => setProfile({ ...profile, phone: text })}
                  editable={isEditing}
                  keyboardType="phone-pad"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
            </View>
          </View>

          {/* Address Information */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Address</Text>
            
            <View style={S.inputField}>
              <Text style={S.inputLabel}>Street Address</Text>
              <View style={S.inputContainer}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="home-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                <TextInput
                  style={S.input}
                  value={profile.address}
                  onChangeText={(text) => setProfile({ ...profile, address: text })}
                  editable={isEditing}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
            </View>

            <View style={S.inputRow}>
              <View style={S.inputHalf}>
                <Text style={S.inputLabel}>City</Text>
                <View style={S.inputContainer}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                  <TextInput
                    style={S.input}
                    value={profile.city}
                    onChangeText={(text) => setProfile({ ...profile, city: text })}
                    editable={isEditing}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
              
              <View style={S.inputHalf}>
                <Text style={S.inputLabel}>Country</Text>
                <View style={S.inputContainer}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="globe-outline" size={18} color="rgba(255,255,255,0.4)" style={S.inputIcon} />
                  <TextInput
                    style={S.input}
                    value={profile.country}
                    onChangeText={(text) => setProfile({ ...profile, country: text })}
                    editable={isEditing}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {isEditing && (
            <View style={S.actionsSection}>
              <TouchableOpacity style={S.cancelBtn} onPress={handleCancel}>
                <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Text style={S.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={S.saveBtn} onPress={handleSave}>
                <LinearGradient colors={['#1a6fff', '#0A84FF']} style={StyleSheet.absoluteFillObject} />
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={S.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: IOS_BOTTOM + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: IOS_TOP + 70,
    paddingHorizontal: H_PAD,
  },
  
  // Navigation
  navOuter: {
    position: 'absolute',
    top: IOS_TOP,
    left: H_PAD,
    right: H_PAD,
    height: 52,
    zIndex: 100,
  },
  navBloom: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 92,
    backgroundColor: 'rgba(10,132,255,0.08)',
    borderRadius: 40,
  },
  navPill: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  navSpecular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  navContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  editBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A84FF',
  },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    top: -4,
    left: -4,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0a1628',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
  },
  premiumText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#30D158',
  },
  
  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  
  // Input Fields
  inputField: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputContainer: {
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    zIndex: 1,
  },
  
  // Actions
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    zIndex: 1,
  },
  saveBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
