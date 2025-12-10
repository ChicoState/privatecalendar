import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

import { StyleSheet, Text, View, Button, TextInput, Switch, Platform, KeyboardAvoidingView, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type DayPress = { dateString: string; day: number; month: number; year: number; timestamp: number };

type EventsByDate = Record<string, EventItem[]>; // "YYYY-MM-DD" -> events[]

const STORAGE_KEY = 'my_calendar_events_v1';

const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
type EventItem = {
  id: string;
  title: string;
  allDay: boolean;
  start: string; // ISO
  end: string;   // ISO
  // optional: location?: string; notes?: string; type?: string;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateBasic = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
const formatDateTimeUTC = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

const escapeICS = (s: string) =>
  (s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Safe flatten of EventsByDate -> EventItem[] */
function flattenEvents(evMap: EventsByDate): EventItem[] {
  const out: EventItem[] = [];
  if (!evMap || typeof evMap !== 'object') return out;

  for (const date of Object.keys(evMap)) {
    const list = Array.isArray(evMap[date]) ? evMap[date] : [];
    for (const ev of list) {
      if (ev && ev.start && ev.end) out.push(ev);
    }
  }
  return out;
}

/** Build an .ics file (VCALENDAR) from all events */
function buildICS(evMap: EventsByDate) {
  const events = flattenEvents(evMap); // ← no undefined now

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YourApp//InAppCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const now = new Date();
  const dtstamp = formatDateTimeUTC(now);

  for (const ev of events) {
    const uid = (ev.id || Math.random().toString(36).slice(2)) + '@yourapp.local';

    let dtstart = '';
    let dtend = '';

    if (ev.allDay) {
      // All-day: use VALUE=DATE; DTEND is exclusive
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      dtstart = `DTSTART;VALUE=DATE:${formatDateBasic(s)}`;
      dtend = `DTEND;VALUE=DATE:${formatDateBasic(e)}`;
    } else {
      // Timed: UTC with Z
      dtstart = `DTSTART:${formatDateTimeUTC(new Date(ev.start))}`;
      dtend = `DTEND:${formatDateTimeUTC(new Date(ev.end))}`;
    }

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      dtend,
      `SUMMARY:${escapeICS(ev.title || 'Event')}`,
      // Optionally:
      // `LOCATION:${escapeICS(ev.location ?? '')}`,
      // `DESCRIPTION:${escapeICS(ev.notes ?? '')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}





export default function App() {
  const insets = useSafeAreaInsets();

  const BANNER_DURATION = 1500; // visible time in ms

  // inside your component:
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextIdRef = useRef(0);
  

type Notification = {
    id: number;
    message: string;
    anim: Animated.Value;
  };

const showNotification = (message: string) => {
  
  const id = nextIdRef.current++; // incremental ID for the notification
  const anim = new Animated.Value(0);

  const newNotification: Notification = { id, message, anim };

  //console.log('Showing notification:', message);
  // Add to list
  setNotifications(prev => [...prev, newNotification]);
  
  // Animate: fade in -> delay -> fade out
  Animated.sequence([
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }),
    Animated.delay(BANNER_DURATION),
    Animated.timing(anim, {
      toValue: 0,
      duration: 2200,
      useNativeDriver: true,
    }),
  ]).start(() => {
    // Remove when finished
    setNotifications(prev => prev.filter(n => n.id !== id));
    //console.log('removing notification:', id);
  });
};

  const [selected, setSelected] = useState('');
  const [events, setEvents] = useState<EventsByDate>({});

  // simple form
  const [title, setTitle] = useState('New Event');
  const [allDay, setAllDay] = useState(false);
  const [startHour, setStartHour] = useState('10:00'); // HH:mm local
  const [endHour, setEndHour] = useState('11:00');
  const [multiDay, setMultiDay] = useState(false);
  const [daysLong, setDaysLong] = useState('2');

  // load & persist
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setEvents(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load events', e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events)).catch(() => {});
  }, [events]);

  /*
  const markedDates = useMemo(
    () => (selected ? { [selected]: { selected: true, selectedColor: 'orange', disableTouchEvent: true } } : {}),
    [selected]
  );*/
  const dotColor: Record<string, string> = {
  meeting: '#ff3b30',
  class:   '#5856d6',
  todo:    '#34c759',
  default: '#ff9500',
};

const MAX_DOTS = 3; // max dots to show per day

const markedDates = useMemo(() => {
  const out: Record<string, any> = {};

  for (const [date, list] of Object.entries(events)) {
    if (!Array.isArray(list) || list.length === 0) continue;

    // One dot per event, each MUST have a unique `key`
    const palette = ['#ff3b30', '#ff9500', '#5856d6', '#34c759', '#00bcd4', '#9c27b0'];
    const dots = list.slice(0, MAX_DOTS).map((ev, i) => ({
      key: ev.id ?? `${date}-dot-${i}`,     // unique
      color: palette[i % palette.length],   // rotate colors (or pick a single color)
    }));

    // IMPORTANT: put dots under the date entry
    out[date] = { ...(out[date] || {}), dots };
  }

  // Merge selection without losing dots
  if (selected) {
    out[selected] = {
      ...(out[selected] || {}),
      selected: true,
      selectedColor: 'orange',
      disableTouchEvent: true,
    };
  }
  return out;
}, [events, selected]);

  const parseTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return { h: Number.isFinite(h) ? h : 10, m: Number.isFinite(m) ? m : 0 };
  };
  const toLocalDate = (dateStr: string, h = 0, m = 0) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, (mo ?? 1) - 1, d ?? 1, h, m, 0, 0);
  };



  
  const [bannerVisible, setBannerVisible] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;


  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (message: string) => {
  setBannerMessage(message);
  setBannerVisible(true);

  fadeAnim.setValue(0);

  Animated.sequence([
    Animated.timing(fadeAnim, {
      toValue: 1,           // fade in
      duration: 200,
      useNativeDriver: true,
    }),
    Animated.delay(1500),   // stay visible for 1.5s
    Animated.timing(fadeAnim, {
      toValue: 0,           // fade out
      duration: 200,
      useNativeDriver: true,
    }),
  ]).start(() => {
    setBannerVisible(false);
  });
};

  const addEventLocal = useCallback(() => {
    if (!selected) return;

    //showBanner('Event added to in-app calendar');
    let start = toLocalDate(selected);
    let end = toLocalDate(selected);

    if (allDay) {
      const days = multiDay ? Math.max(1, parseInt(daysLong || '1', 10)) : 1;
      // DTEND for all-day is exclusive; store end as the *day after* the last day
      end = new Date(start);
      end.setDate(start.getDate() + days);
    } else {
      const { h: sh, m: sm } = parseTime(startHour);
      const { h: eh, m: em } = parseTime(endHour);
      start = toLocalDate(selected, sh, sm);
      end = toLocalDate(selected, eh, em);
      if (multiDay) {
        const extra = Math.max(1, parseInt(daysLong || '1', 10)) - 1;
        end.setDate(end.getDate() + extra);
      }
      if (end <= start) {
        Alert.alert('Invalid time', 'End time must be after start time.');
        return;
      }
    }

    const ev: EventItem = {
      id: randomId(),
      title: title.trim() || 'New Event',
      allDay,
      start: start.toISOString(),
      end: end.toISOString(),
    };

    setEvents(prev => {
      const copy = { ...prev };
      const key = selected;
      copy[key] = [...(copy[key] || []), ev];
      return copy;
    });

    // optional: clear title per add
    // setTitle('New Event');
  }, [selected, allDay, multiDay, daysLong, startHour, endHour, title]);

  const handleAddEventLocal = () => {
    addEventLocal();
    showNotification(`Added event: ${title}`);
  };
  const removeEvent = (dateKey: string, id: string) => {
    setEvents(prev => {
      const list = prev[dateKey] || [];
      return { ...prev, [dateKey]: list.filter(e => e.id !== id) };
    });
  };

  async function exportICS(evMap: EventsByDate) {
  try {
    const ics = buildICS(evMap);
    const fileUri = FileSystem.Paths.cache + `my-events-${Date.now()}.ics`;

    // Don’t pass FileSystem.EncodingType.UTF8 (it may be undefined in some SDKs)
    await FileSystem.writeAsStringAsync(fileUri, ics); // defaults to UTF-8

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/calendar',
        UTI: 'public.calendar-event',
        dialogTitle: 'Export .ics',
      });
    } else {
      Alert.alert('ICS saved', fileUri);
    }
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? String(e));
  }
}

  const eventsForSelected = events[selected] || [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={insets.top}
      >
        {notifications.length > 0 && (
      <View
        style={[
          styles.notificationsContainer,
          { top: insets.top + 8 },
        ]}
        pointerEvents="none"
      >
        {[...notifications].reverse().map(n => (
          <Animated.View
            key={n.id}
            style={[
              styles.banner,
              {
                opacity: n.anim,
                // optional small slide; safe because each item takes its own row
                transform: [
                  {
                    translateY: n.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.bannerText}>{n.message}</Text>
          </Animated.View>
        ))}
      </View>
    )}
        {/*notifications.length > 0 && (
      <View
        style={[
          styles.notificationsContainer,
          { top: insets.top + 8 }, // respect notch
        ]}
        pointerEvents="none" // touches pass through
      >
        {notifications.map((n) => (
          <Animated.View
            key={n.id}
            style={[
              styles.banner,
              {
                opacity: n.anim,
                transform: [
                  {
                    translateY: n.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0], // small slide-in
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.bannerText}>{n.message}</Text>
          </Animated.View>
        ))}
      </View>
    )*/}
        
        {/*bannerVisible && (
          <Animated.View
            style={[
              styles.banner,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0], // small slide-down while fading in
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.bannerText}>{bannerMessage}</Text>
          </Animated.View>
        )*/}
        
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Calendar
            onDayPress={(d: DayPress) => setSelected(d.dateString)}
            markedDates={markedDates}
            markingType="multi-dot" // enables dots: [] support
          />

          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.h4}>Selected date</Text>
              <Button title="Export .ics" onPress={exportICS} />
            </View>
            <Text style={styles.value}>{selected || '—'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.h4}>Create event (in-app)</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" />

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>All-day</Text>
              <Switch value={allDay} onValueChange={setAllDay} />
            </View>

            {!allDay && (
              <>
                <Text style={styles.label}>Start (HH:mm)</Text>
                <TextInput style={styles.input} value={startHour} onChangeText={setStartHour} keyboardType="numbers-and-punctuation" />
                <Text style={styles.label}>End (HH:mm)</Text>
                <TextInput style={styles.input} value={endHour} onChangeText={setEndHour} keyboardType="numbers-and-punctuation" />
              </>
            )}

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>Multi-day</Text>
              <Switch value={multiDay} onValueChange={setMultiDay} />
            </View>

            {multiDay && (
              <>
                <Text style={styles.label}># of days</Text>
                <TextInput style={styles.input} value={daysLong} onChangeText={setDaysLong} keyboardType="number-pad" />
              </>
            )}

            <Button title="Add to in-app calendar" onPress={handleAddEventLocal} disabled={!selected} />
          </View>

          <View style={styles.section}>
            <Text style={styles.h4}>Events on {selected || '—'}</Text>
            {eventsForSelected.length === 0 ? (
              <Text style={styles.muted}>No events yet</Text>
            ) : (
              eventsForSelected.map(ev => {
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                const timeText = ev.allDay
                  ? `All-day${start.toDateString() !== end.toDateString() ? ` (${start.toDateString()} → ${end.toDateString()})` : ''}`
                  : `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                return (
                  <View key={ev.id} style={styles.eventCard}>
                    <Text style={styles.eventTitle}>• {ev.title}</Text>
                    <Text style={styles.eventTime}>{timeText}</Text>
                    <View style={{ height: 8 }} />
                    <Button title="Delete" onPress={() => removeEvent(selected, ev.id)} />
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 16 },
  section: { marginTop: 16, gap: 8 },
  h4: { fontWeight: '700', fontSize: 16 },
  value: { color: '#333' },
  label: { fontWeight: '600', marginTop: 6 },
  labelInline: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: '#666' },
  eventCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 10, marginTop: 10 },
  eventTitle: { fontWeight: '600' },
  eventTime: { color: '#333' },
  content: {
    padding: 16,
  },
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  bannerText: {
    color: 'white',
    fontWeight: '600',
  },
  notificationsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    flexDirection: 'column',
  },
});
