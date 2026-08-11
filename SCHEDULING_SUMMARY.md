# Smart Home Scheduling System

## Overview

The scheduling system provides comprehensive time-based automation and safety controls for smart home devices. It supports two distinct types of schedules:

### A. Safety Scheduling (Auto-Shutoff)
Designed for high-risk appliances like irons, heaters, and fans to prevent accidents and save energy.

### B. Time-Based Scheduling
Allows devices to automatically turn ON or OFF at specific times on selected days.

---

## Features

### 1. Safety Scheduling

**Purpose**: Automatically turn off devices after a maximum duration to prevent fire hazards and energy waste.

**Applicable Devices**:
- Irons
- Heaters/Thermostats
- Fans
- Other high-risk appliances

**Features**:
- ✅ Configurable duration (5 to 120 minutes)
- ✅ Visual duration selector with preset options
- ✅ Enable/disable toggle
- ✅ Safety status information and warnings
- ✅ Persistent across app restarts

**UI Components**:
```
┌─────────────────────────────────────┐
│ Safety Auto-Shutoff                 │
├─────────────────────────────────────┤
│ 🛡️ Automatic Safety Timer           │
│ Device will turn off after 30 min   │
│                              [  ON] │
├─────────────────────────────────────┤
│ Maximum ON Duration                 │
│ [5] [10] [15] [20] [30] [45] ...   │
│          [Save Duration]            │
├─────────────────────────────────────┤
│ ℹ️ This safety feature prevents     │
│    fire hazards and saves energy... │
└─────────────────────────────────────┘
```

---

### 2. Time-Based Scheduling

**Purpose**: Automate device control based on time and day of week.

**Applicable Devices**: All smart home devices

**Features**:
- ✅ Set specific time (with AM/PM)
- ✅ Choose action (Turn ON or Turn OFF)
- ✅ Select days of week
- ✅ Quick day presets (Weekdays, Weekends, Every Day)
- ✅ Enable/disable individual schedules
- ✅ Multiple schedules per device
- ✅ Edit and delete schedules
- ✅ Visual time picker with quick time presets

**UI Components**:

#### Time Picker
```
┌─────────────────────────────────────┐
│ Time                                │
├─────────────────────────────────────┤
│ [Morning] [Noon] [Evening] [Night] │
│                                     │
│      ▲        ▲                     │
│   [  07  ] : [ 00  ]   [AM]        │
│      ▼        ▼                     │
└─────────────────────────────────────┘
```

#### Day Selector
```
┌─────────────────────────────────────┐
│ Repeat On                           │
├─────────────────────────────────────┤
│ [Sun] [Mon] [Tue] [Wed] [Thu] ...  │
│                                     │
│ [Weekdays] [Weekends] [Every Day]  │
└─────────────────────────────────────┘
```

#### Schedule Card
```
┌─────────────────────────────────────┐
│ 🔌 07:00 AM                         │
│    Weekdays                [  ON]  │
│                                     │
│ Turn ON                             │
│ ✏️ Edit        🗑️ Delete           │
└─────────────────────────────────────┘
```

---

## File Structure

```
app/
├── schedule/
│   ├── [id].tsx              # Main schedule list screen
│   └── edit/
│       └── [scheduleId].tsx  # Add/edit schedule screen
│
services/
└── scheduleService.ts        # Schedule CRUD operations
│
types/
└── device.ts                 # Schedule type definitions
```

---

## Data Model

### Schedule Interface

```typescript
interface Schedule {
  id: string;
  deviceId: string;
  type: 'time' | 'safety';
  enabled: boolean;
  
  // For time-based schedules
  time?: string;           // HH:MM format (e.g., "07:00")
  action?: 'on' | 'off';   // Turn device on or off
  days?: number[];         // [0-6], Sunday=0, Saturday=6
  
  // For safety schedules
  maxDurationMinutes?: number;  // Auto-shutoff duration
}
```

### Example Schedules

**Safety Schedule (Iron):**
```typescript
{
  id: 's1',
  deviceId: 'd4',
  type: 'safety',
  enabled: true,
  maxDurationMinutes: 30
}
```

**Time Schedule (Morning Light):**
```typescript
{
  id: 's2',
  deviceId: 'd1',
  type: 'time',
  enabled: true,
  time: '07:00',
  action: 'on',
  days: [1, 2, 3, 4, 5]  // Weekdays
}
```

**Time Schedule (Night Light):**
```typescript
{
  id: 's3',
  deviceId: 'd1',
  type: 'time',
  enabled: true,
  time: '23:00',
  action: 'off',
  days: [0, 1, 2, 3, 4, 5, 6]  // Every day
}
```

---

## Navigation Flow

```
Device Detail Screen
      │
      ├─── [Schedule Button]
      │
      ▼
Schedule List Screen (/schedule/[id])
      │
      ├─── Safety Schedule Card (if applicable)
      │    └─── [Enable/Disable Toggle]
      │    └─── [Duration Selector]
      │    └─── [Save Button]
      │
      └─── Time Schedules List
           ├─── Schedule Card 1
           │    ├─── [Enable/Disable Toggle]
           │    ├─── [Edit Button] ────┐
           │    └─── [Delete Button]   │
           │                            │
           ├─── Schedule Card 2         │
           │    └─── ...                │
           │                            │
           └─── [Add Schedule Button] ─┤
                                        │
                                        ▼
                    Edit Schedule Screen (/schedule/edit/[scheduleId])
                         │
                         ├─── Time Picker
                         ├─── Action Selector (ON/OFF)
                         ├─── Day Selector
                         ├─── Summary Card
                         └─── [Save Button]
```

---

## API/Service Methods

### scheduleService.ts

```typescript
// Get schedules
getSchedulesForDevice(deviceId: string): Promise<Schedule[]>
getScheduleById(id: string): Promise<Schedule | undefined>
getAllSchedules(): Promise<Schedule[]>

// Create schedule
addSchedule(data: Omit<Schedule, 'id'>): Promise<Schedule>

// Update schedule
updateSchedule(id: string, patch: Partial<Schedule>): Promise<Schedule | undefined>
toggleSchedule(id: string): Promise<Schedule | undefined>

// Delete schedule
deleteSchedule(id: string): Promise<boolean>

// Bulk operations
deleteAllSchedulesForDevice(deviceId: string): Promise<number>
enableAllSchedulesForDevice(deviceId: string): Promise<void>
disableAllSchedulesForDevice(deviceId: string): Promise<void>

// Evaluation
shouldScheduleTrigger(schedule: Schedule, now?: Date): boolean
getTriggeredSchedules(now?: Date): Promise<Schedule[]>
```

---

## User Flows

### 1. Creating a Safety Schedule (Iron)

1. Navigate to Iron device detail screen
2. Tap **Schedule** button in Quick Actions
3. See **Safety Auto-Shutoff** card at top
4. Toggle **Enable** switch
5. Select duration from grid (e.g., 30 minutes)
6. Tap **Save Duration**
7. Safety schedule is now active

### 2. Creating a Time Schedule (Morning Light)

1. Navigate to Light device detail screen
2. Tap **Schedule** button
3. Tap **Add Schedule** button (or + in header)
4. Select time using picker or quick preset (e.g., "Morning" = 07:00)
5. Select action: **Turn ON**
6. Select days: Tap **Weekdays** preset
7. Review summary card
8. Tap **Create Schedule**

### 3. Editing an Existing Schedule

1. Navigate to device schedule screen
2. Find the schedule to edit
3. Tap **Edit** button
4. Modify time, action, or days
5. Review updated summary
6. Tap **Save Changes**

### 4. Disabling a Schedule Temporarily

1. Navigate to device schedule screen
2. Find the schedule
3. Toggle the **Enable/Disable** switch to OFF
4. Schedule is preserved but won't trigger

### 5. Deleting a Schedule

1. Navigate to device schedule screen
2. Find the schedule to delete
3. Tap **Delete** button
4. Confirm in alert dialog
5. Schedule is permanently removed

---

## Design Patterns

### Color Coding
- **Safety schedules**: Device accent color (e.g., orange for irons)
- **Time schedules**: Device accent color
- **Turn ON action**: Green (#30D158)
- **Turn OFF action**: Gray (muted)
- **Enabled schedules**: Full color
- **Disabled schedules**: Muted/transparent

### Visual Hierarchy
1. **Hero Section**: Device info and primary controls
2. **Safety Schedule**: Prominent placement for applicable devices
3. **Time Schedules**: List view with cards
4. **Actions**: Sticky or easily accessible

### Accessibility
- All buttons have accessibility labels
- Touch targets are minimum 44x44 points
- High contrast text
- Clear visual feedback for interactions
- Support for VoiceOver/TalkBack

---

## Future Enhancements

### Potential Features
- [ ] Sunrise/sunset-based scheduling
- [ ] Temperature-based triggers
- [ ] Location-based automation (geofencing)
- [ ] Schedule templates (e.g., "Vacation Mode")
- [ ] Smart scheduling suggestions based on usage patterns
- [ ] Schedule conflict detection and warnings
- [ ] Push notifications when schedules trigger
- [ ] Schedule history and logs
- [ ] Schedule groups (control multiple devices)
- [ ] Random scheduling for security (simulate presence)

### Technical Improvements
- [ ] Backend integration (Supabase/Firebase)
- [ ] Real-time schedule execution (background tasks)
- [ ] Offline schedule evaluation
- [ ] Schedule sync across devices
- [ ] Advanced recurrence patterns (monthly, yearly)
- [ ] Schedule preview calendar view
- [ ] Export/import schedules

---

## Testing Scenarios

### Safety Schedule
- ✅ Enable safety schedule for iron
- ✅ Change duration from 20 to 45 minutes
- ✅ Disable safety schedule
- ✅ Verify schedule persists after app restart
- ✅ Verify UI shows correct duration

### Time Schedule
- ✅ Create morning schedule (07:00 AM, Turn ON, Weekdays)
- ✅ Create night schedule (23:00 PM, Turn OFF, Every day)
- ✅ Edit existing schedule (change time and days)
- ✅ Disable schedule temporarily
- ✅ Re-enable schedule
- ✅ Delete schedule with confirmation
- ✅ Create multiple schedules for same device
- ✅ Verify schedule summary text is accurate

### Navigation
- ✅ Access schedules from device detail screen
- ✅ Navigate to add schedule screen
- ✅ Navigate to edit schedule screen
- ✅ Return to schedule list after saving
- ✅ Return to device detail from schedule screen

---

## Code Examples

### Creating a Schedule

```typescript
// Safety schedule
const safetySchedule = await addSchedule({
  deviceId: 'd4',
  type: 'safety',
  enabled: true,
  maxDurationMinutes: 30
});

// Time schedule
const timeSchedule = await addSchedule({
  deviceId: 'd1',
  type: 'time',
  enabled: true,
  time: '07:00',
  action: 'on',
  days: [1, 2, 3, 4, 5]
});
```

### Checking if Schedule Should Trigger

```typescript
const now = new Date(); // e.g., Monday 07:00 AM

const shouldTrigger = shouldScheduleTrigger(timeSchedule, now);
// Returns true if current day is Monday-Friday and time is 07:00
```

### Getting All Active Schedules

```typescript
const activeSchedules = schedules.filter(s => s.enabled);
```

---

## Screenshots

### Schedule List Screen
Shows safety schedule (if applicable) and list of time-based schedules with enable/disable toggles.

### Edit Schedule Screen
Time picker with quick presets, action selector (ON/OFF), day selector with presets, and summary card.

### Safety Schedule Card
Enable toggle, duration grid selector, save button, and informational warning about fire safety.

---

## Integration Points

### With Device Screen
- **Schedule button** in Quick Actions section
- Navigates to `/schedule/[deviceId]`

### With Device Service
- Schedules stored in device object
- `device.schedules` array
- `device.safetyTimeout` for default duration

### With Background Tasks (Future)
- Schedule evaluation service
- Push notifications
- Device state updates

---

## Conclusion

The scheduling system provides a comprehensive solution for both safety automation (preventing accidents) and convenience automation (time-based control). The UI is intuitive, the code is maintainable, and the system is extensible for future enhancements.

Key strengths:
- ✅ Clean separation between safety and time schedules
- ✅ Intuitive UI with visual feedback
- ✅ Flexible time and day selection
- ✅ Easy enable/disable without deletion
- ✅ Comprehensive error handling
- ✅ Accessibility-compliant
- ✅ Consistent with app design language

---

**Version**: 1.0  
**Last Updated**: 2026-08-11  
**Maintained By**: Smart Home Development Team
