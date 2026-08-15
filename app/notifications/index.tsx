import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { Alert as AlertItem, AlertType, deleteAlert, deleteAllAlerts, getAlerts, markAlertRead, markAllAlertsRead, subscribeToAlerts } from '@/services/alertService';

const IOS_TOP = Platform.OS === 'ios' ? 54 : 36;
const IOS_BOTTOM = Platform.OS === 'ios' ? 34 : 16;
const H_PAD = 20;

type NotificationCategory = 'device' | 'safety' | 'system' | 'energy';
type NotificationFilter = 'all' | 'unread' | 'device' | 'safety' | 'system' | 'energy';

interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// ─── Alert → Notification mapping (UI derives icon/color/category from type) ──
// DB alert `type` (safety/error/offline/info) → UI `category` (device/safety/
// system/energy). There's no 1:1 "energy" type, so energy alerts are not
// produced yet; `error`/`offline` map to the "device" category, `info`→"system".
const ALERT_TYPE_META: Record<AlertType, {
  category: NotificationCategory;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  safety:  { category: 'safety', icon: 'shield-checkmark',    color: '#FF9F0A' },
  error:   { category: 'device', icon: 'alert-circle',        color: '#FF375F' },
  offline: { category: 'device', icon: 'cloud-offline',       color: '#FF9F0A' },
  info:    { category: 'system', icon: 'information-circle',  color: '#0A84FF' },
};

function mapAlertToNotification(alert: AlertItem): Notification {
  const meta = ALERT_TYPE_META[alert.type];
  return {
    id: alert.id,
    category: meta.category,
    title: alert.title,
    message: alert.message,
    timestamp: alert.createdAt,
    read: alert.read,
    icon: meta.icon,
    color: meta.color,
  };
}

const FILTER_OPTIONS: { id: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'unread', label: 'Unread', icon: 'mail-unread' },
  { id: 'device', label: 'Device', icon: 'hardware-chip' },
  { id: 'safety', label: 'Safety', icon: 'shield' },
  { id: 'system', label: 'System', icon: 'cog' },
  { id: 'energy', label: 'Energy', icon: 'flash' },
];

function formatNotificationTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  // Load alerts on mount and keep them in sync via realtime.
  useEffect(() => {
    let active = true;
    getAlerts().then((alerts) => {
      if (active) setNotifications(alerts.map(mapAlertToNotification));
    });
    const unsubscribe = subscribeToAlerts((event, alert) => {
      if (!alert) return;
      setNotifications((prev) => {
        const mapped = mapAlertToNotification(alert);
        if (event === 'DELETE') return prev.filter((n) => n.id !== mapped.id);
        const exists = prev.some((n) => n.id === mapped.id);
        return exists ? prev.map((n) => (n.id === mapped.id ? mapped : n)) : [mapped, ...prev];
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.category === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggleRead = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.read) return; // DB only supports marking read, not unread
    const ok = await markAlertRead(id);
    if (ok) setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllAlerts();
            setNotifications([]);
          },
        },
      ]
    );
  };

  const handleDeleteNotification = (id: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteAlert(id);
            if (ok) setNotifications(prev => prev.filter(n => n.id !== id));
          },
        },
      ]
    );
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
            <Text style={S.navTitle}>Notifications</Text>
            <View style={S.badgeContainer}>
              {unreadCount > 0 && (
                <View style={S.unreadBadge}>
                  <Text style={S.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </BlurView>
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Tabs */}
        <View style={S.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterScroll}
          >
            {FILTER_OPTIONS.map(option => {
              const isActive = filter === option.id;
              const count = option.id === 'unread' ? unreadCount : 
                           option.id === 'all' ? notifications.length :
                           notifications.filter(n => n.category === option.id).length;
              
              return (
                <TouchableOpacity
                  key={option.id}
                  style={S.filterChipOuter}
                  onPress={() => setFilter(option.id)}
                  activeOpacity={0.7}
                >
                  <BlurView
                    intensity={isActive ? 50 : 30}
                    tint="dark"
                    style={[S.filterChip, isActive && S.filterChipActive]}
                  >
                    {isActive && (
                      <LinearGradient
                        colors={['rgba(10,132,255,0.25)', 'rgba(10,132,255,0.10)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={isActive ? '#0A84FF' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text style={[S.filterChipText, isActive && S.filterChipTextActive]}>
                      {option.label}
                    </Text>
                    {count > 0 && (
                      <View style={[S.filterCountBadge, isActive && S.filterCountBadgeActive]}>
                        <Text style={[S.filterCountText, isActive && S.filterCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Action Buttons */}
        {notifications.length > 0 && (
          <View style={S.actionsRow}>
            {unreadCount > 0 && (
              <TouchableOpacity style={S.actionBtnOuter} onPress={handleMarkAllRead}>
                <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="checkmark-done" size={18} color="#30D158" />
                <Text style={S.actionBtnText}>Mark All Read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.actionBtnOuter} onPress={handleClearAll}>
              <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="trash-outline" size={18} color="#FF375F" />
              <Text style={S.actionBtnText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <View style={S.emptyState}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={S.emptyIconRing}>
              <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.3)" />
            </View>
            <Text style={S.emptyTitle}>No Notifications</Text>
            <Text style={S.emptySubtitle}>
              {filter === 'unread' ? 'All caught up!' : 'You have no notifications at the moment'}
            </Text>
          </View>
        ) : (
          <View style={S.notificationsList}>
            {filteredNotifications.map((notification, index) => (
              <View key={notification.id}>
                <TouchableOpacity
                  style={S.notificationCardOuter}
                  onPress={() => handleToggleRead(notification.id)}
                  activeOpacity={0.8}
                >
                  <View style={[S.notificationBloom, { backgroundColor: `${notification.color}12` }]} />
                  <BlurView
                    intensity={notification.read ? 32 : 42}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View
                    style={[
                      S.notificationSpecular,
                      { backgroundColor: `${notification.color}${notification.read ? '15' : '25'}` },
                    ]}
                  />
                  <View
                    style={[
                      S.notificationBorder,
                      { borderColor: `${notification.color}${notification.read ? '15' : '30'}` },
                    ]}
                  />
                  <View style={S.notificationContent}>
                    <View style={S.notificationHeader}>
                      <View
                        style={[
                          S.notificationIconRing,
                          {
                            backgroundColor: `${notification.color}18`,
                            borderColor: `${notification.color}30`,
                          },
                        ]}
                      >
                        <Ionicons name={notification.icon} size={20} color={notification.color} />
                      </View>
                      <View style={S.notificationBody}>
                        <View style={S.notificationTitleRow}>
                          <Text
                            style={[
                              S.notificationTitle,
                              { opacity: notification.read ? 0.7 : 1 },
                            ]}
                            numberOfLines={1}
                          >
                            {notification.title}
                          </Text>
                          {!notification.read && <View style={S.unreadDot} />}
                        </View>
                        <Text
                          style={[
                            S.notificationMessage,
                            { opacity: notification.read ? 0.5 : 0.75 },
                          ]}
                          numberOfLines={2}
                        >
                          {notification.message}
                        </Text>
                        <Text style={S.notificationTime}>
                          {formatNotificationTime(notification.timestamp)}
                        </Text>
                      </View>
                    </View>
                    <View style={S.notificationActions}>
                      <TouchableOpacity
                        style={S.notificationActionBtn}
                        onPress={() => handleToggleRead(notification.id)}
                      >
                        <Ionicons
                          name={notification.read ? 'mail-unread-outline' : 'mail-open-outline'}
                          size={18}
                          color="rgba(255,255,255,0.5)"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={S.notificationActionBtn}
                        onPress={() => handleDeleteNotification(notification.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF375F" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
                {index < filteredNotifications.length - 1 && <View style={S.notificationSpacer} />}
              </View>
            ))}
          </View>
        )}

        {/* Settings Link */}
        <TouchableOpacity style={S.settingsLink} onPress={() => router.back()}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="settings-outline" size={20} color="#0A84FF" />
          <Text style={S.settingsLinkText}>Notification Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        <View style={{ height: IOS_BOTTOM + 40 }} />
      </ScrollView>
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
  badgeContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    backgroundColor: '#FF375F',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Filter Section
  filterSection: {
    marginBottom: 20,
  },
  filterScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  filterChipOuter: {
    marginRight: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  filterChipActive: {
    borderColor: 'rgba(10,132,255,0.4)',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterChipTextActive: {
    color: '#0A84FF',
  },
  filterCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(10,132,255,0.2)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  filterCountTextActive: {
    color: '#0A84FF',
  },

  // Actions Row
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtnOuter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // Notifications List
  notificationsList: {
    marginBottom: 20,
  },
  notificationCardOuter: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 110,
  },
  notificationBloom: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 30,
  },
  notificationSpecular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  notificationBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notificationIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0A84FF',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  notificationActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notificationSpacer: {
    height: 12,
  },

  // Empty State
  emptyState: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Settings Link
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  settingsLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0A84FF',
    marginLeft: 12,
  },
});
