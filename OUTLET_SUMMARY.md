# Electrical Outlet Screen Implementation

## Overview
Implemented a dedicated detail screen for electrical outlet devices with a clean UI/UX that follows the same design patterns as the Multi-Switch screen but simplified for binary ON/OFF control.

## Features Implemented

### 1. Hero Card
- **Large Power Icon**: Prominent power icon with accent color background
- **Pulsing Animation**: Subtle scale animation when outlet is active
- **Glow Effect**: Ambient glow ring around the icon when powered on
- **Status Indicator**: Visual dot + text showing POWERED ON/OFF or ERROR/DISCONNECTED
- **Toggle Control**: Master switch to turn outlet ON/OFF
- **Status Badge**: Current device status (on/off/error/offline)

### 2. Power Consumption Card
- **Current Usage**: Large display showing watts consumed
- **Power Icon**: Lightning bolt icon in accent color
- **Estimates**: When active, shows:
  - Estimated daily kWh (assuming 8 hours usage)
  - Estimated daily cost ($0.12/kWh rate)
- **Inactive State**: Shows message when outlet is off

### 3. Status Overview Card
- **4-Tile Grid** with key information:
  - Power State (ON/OFF/ERROR)
  - Connection Status (Connected/Offline)
  - Location (Room name)
  - Device Type (Power Outlet)
- Each tile has an icon and color-coded value

### 4. Device Information Card
- Device Name
- Type: "Electrical Outlet"
- Floor
- Room
- Status
- Last Updated timestamp

### 5. Quick Actions Card
- Schedule
- Automate
- Usage History
- Settings

## Technical Details

### File Structure
```
app/
  outlet/
    [id].tsx          # Outlet detail screen
```

### Navigation
Updated routing in two files:
- `components/DeviceCard.tsx` - Routes outlet devices to `/outlet/[id]`
- `app/floor-plan/index.tsx` - Routes outlet pins to `/outlet/[id]`

### Color Scheme
- **Accent Color**: `#fbbf24` (amber/yellow) - represents electrical power
- Matches with the "light" device color for electrical theme
- Updated in `constants/colors.ts`

### Device Icon
- **Card Icon**: `power-outline` (for consistency with outlet theme)
- **Hero Icon**: `power` (filled power symbol)
- Updated in `components/DeviceCard.tsx`

### Mock Data
Added new outlet device for testing:
```typescript
{
  id: 'd20',
  name: 'Kitchen Outlet',
  type: 'outlet',
  status: 'on',
  floorId: 'f0',
  roomName: 'Kitchen',
}
```

Existing outlet:
```typescript
{
  id: 'd11',
  name: 'Hallway Outlet',
  type: 'outlet',
  status: 'offline',  // Tests error state
  floorId: 'f1',
  roomName: 'Hallway',
}
```

## UI/UX Highlights

### Visual Design
- **Dark Theme**: Matches the app's luxury deep-navy theme
- **Gradient Background**: Consistent with other detail screens
- **Card-Based Layout**: Clean, separated sections
- **Responsive**: Proper spacing and scrolling

### Interactions
- **Toggle Switch**: Smooth toggle with disabled state for errors
- **Back Navigation**: Chevron button returns to previous screen
- **Tap Actions**: Quick action buttons for future features
- **Loading State**: Shows spinner while fetching data
- **Error State**: Graceful handling when device not found

### States Handled
1. **ON**: Shows power usage, estimates, active glow
2. **OFF**: Grayed out, no power consumption
3. **ERROR**: Red indicators, toggle disabled
4. **OFFLINE**: Warning color, toggle disabled
5. **DISCONNECTED**: Similar to offline

### Animations
- **Hero Icon Scale**: Gentle pulsing when active
- **Fade In**: Smooth entrance for components
- **Glow Effect**: Ambient shadow on active state

## Design Patterns

### Consistent with Multi-Switch
- Same card structure and styling
- Similar header layout
- Matching color system
- Identical quick actions layout
- Same status badge component
- Shared switch button component

### Simplified for Binary Device
- No multiple circuits (unlike multi-switch)
- Single ON/OFF control
- Direct power consumption display
- Simplified status overview (no circuit count)

## Device Type Definition
Outlet is defined as type `'outlet'` in `types/device.ts`:
```typescript
export type DeviceType =
  | 'light'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'fan'
  | 'tv'
  | 'speaker'
  | 'outlet'
  | 'iron'
  | 'multiSwitch';
```

## Testing Scenarios

### 1. Test Active Outlet
Navigate to "Kitchen Outlet" (d20):
- Should show amber glow
- Power icon pulsing
- Shows wattage (randomized 50-200W)
- Shows daily estimates
- Toggle should work

### 2. Test Offline Outlet
Navigate to "Hallway Outlet" (d11):
- Should show offline status
- Toggle disabled
- No power consumption
- Error-colored indicators

### 3. Test Toggle
- Tap toggle on active outlet
- Should immediately update UI
- Power usage should drop to 0
- Glow should disappear
- Status should change to OFF

## Future Enhancements
- Real power monitoring integration
- Historical usage graphs
- Smart scheduling
- Automation rules
- Power usage alerts
- Cost tracking over time

## Notes
- Power usage is currently simulated (50-200W random)
- Daily cost assumes $0.12/kWh electricity rate
- Daily usage assumes 8 hours of operation
- All UI elements are fully accessible with proper labels
