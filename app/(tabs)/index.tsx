import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  Button,
  TextInput,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Alert,
  View,
  Dimensions,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { TabView, TabBar } from 'react-native-tab-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// --- Types ---
type DayPress = { dateString: string; day: number; month: number; year: number; timestamp: number };

type EventItem = {
  id: string;
  title: string;
  allDay: boolean;
  start: string; // ISO
  end: string;   // ISO
};
type EventsByDate = Record<string, EventItem[]>; // "YYYY-MM-DD" -> events[]

const STORAGE_KEY = 'my_calendar_events_v1';
const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// --- ICS Utilities ---
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

function buildICS(evMap: EventsByDate) {
  const events = flattenEvents(evMap);
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YourApp//InAppCalendar//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ];
  const dtstamp = formatDateTimeUTC(new Date());

  for (const ev of events) {
    const uid = (ev.id || Math.random().toString(36).slice(2)) + '@yourapp.local';
    let dtstart = '', dtend = '';

    if (ev.allDay) {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      dtstart = `DTSTART;VALUE=DATE:${formatDateBasic(s)}`;
      dtend = `DTEND;VALUE=DATE:${formatDateBasic(e)}`;
    } else {
      dtstart = `DTSTART:${formatDateTimeUTC(new Date(ev.start))}`;
      dtend = `DTEND:${formatDateTimeUTC(new Date(ev.end))}`;
    }

    lines.push(
      'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${dtstamp}`, dtstart, dtend,
      `SUMMARY:${escapeICS(ev.title || 'Event')}`, 'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function exportICS(evMap: EventsByDate) {
  try {
    const ics = buildICS(evMap);
    const fileUri = FileSystem.Paths.cache + `my-events-${Date.now()}.ics`;

    await FileSystem.writeAsStringAsync(fileUri, ics);

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

// Day View (Hour-by-hour timeline)
const DayRoute = () => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  return (
    <ScrollView style={styles.dayScroll}>
      {hours.map((hour) => (
        <View key={hour} style={styles.hourRow}>
          <Text style={styles.hourText}>{hour}</Text>
          <View style={styles.hourDivider} />
        </View>
      ))}
      {/* Example event block */}
      <View style={[styles.eventBlock, { top: 200, height: 80 }]}>
        <Text style={styles.eventTitle}>Team Meeting</Text>
        <Text style={styles.eventTime}>9:00 – 10:00 AM</Text>
      </View>
    </ScrollView>
  );
};

// Week View in a 7-day horizontal layout
const WeekRoute = () => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <View style={styles.weekContainer}>
      {days.map((day) => (
        <View key={day} style={styles.weekDay}>
          <Text style={styles.weekDayText}>{day}</Text>
          <View style={styles.weekEventCard}>
            <Text style={styles.eventTitle}>Sample Event</Text>
            <Text style={styles.eventTime}>10 AM</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// --- MonthRoute ---
type MonthRouteProps = {
  selected: string;
  markedDates: Record<string, any>;
  setSelected: (date: string) => void;
  eventsForSelected: EventItem[];
  removeEvent: (dateKey: string, id: string) => void;
  addEventLocal: () => void;
  exportICS: () => void;
  // Form props
  title: string; setTitle: (t: string) => void;
  allDay: boolean; setAllDay: (v: boolean) => void;
  startHour: string; setStartHour: (t: string) => void;
  endHour: string; setEndHour: (t: string) => void;
  multiDay: boolean; setMultiDay: (v: boolean) => void;
  daysLong: string; setDaysLong: (d: string) => void;
};

// Month View: contains the Calendar AND the event creation form
const MonthRoute = (props: MonthRouteProps) => {
  const insets = useSafeAreaInsets();
  const {
    selected, markedDates, setSelected, eventsForSelected, removeEvent,
    addEventLocal, exportICS: handleExportICS, title, setTitle, allDay, setAllDay,
    startHour, setStartHour, endHour, setEndHour, multiDay, setMultiDay, daysLong, setDaysLong
  } = props;

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={insets.top + 48} // Adjusted offset to clear TabBar/Safe Area
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Calendar
            onDayPress={(d: DayPress) => setSelected(d.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              todayTextColor: '#007AFF',
              arrowColor: '#007AFF',
              selectedDayBackgroundColor: 'orange', // Use custom orange from markedDates
              textMonthFontWeight: 'bold',
            }}
          />

          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.h4}>Selected date</Text>
              <Button title="Export .ics" onPress={handleExportICS} />
            </View>
            <Text style={styles.value}>{selected || '—'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.h4}>Create event (in-app)</Text>

            <Text style={styles.label2}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" />

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>All-day</Text>
              <Switch value={allDay} onValueChange={setAllDay} />
            </View>

            {!allDay && (
              <>
                <Text style={styles.label2}>Start (HH:mm)</Text>
                <TextInput style={styles.input} value={startHour} onChangeText={setStartHour} keyboardType="numbers-and-punctuation" />
                <Text style={styles.label2}>End (HH:mm)</Text>
                <TextInput style={styles.input} value={endHour} onChangeText={setEndHour} keyboardType="numbers-and-punctuation" />
              </>
            )}

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>Multi-day</Text>
              <Switch value={multiDay} onValueChange={setMultiDay} />
            </View>

            {multiDay && (
              <>
                <Text style={styles.label2}># of days</Text>
                <TextInput style={styles.input} value={daysLong} onChangeText={setDaysLong} keyboardType="number-pad" />
              </>
            )}

            <Button title="Add to in-app calendar" onPress={addEventLocal} disabled={!selected} />
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
                    <Text style={styles.addEventTittle}>• {ev.title}</Text>
                    <Text style={styles.addEventTime}>{timeText}</Text>
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
};

// ---------- Main Calendar Screen ----------
export default function CalendarScreen() {
  const layout = Dimensions.get('window');
  const [index, setIndex] = useState(2); // start with Month
  const [routes] = useState([
    { key: 'day', title: 'Day' },
    { key: 'week', title: 'Week' },
    { key: 'month', title: 'Month' },
  ]);

  const [selected, setSelected] = useState('');
  const [events, setEvents] = useState<EventsByDate>({});

  // simple form state
  const [title, setTitle] = useState('');
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

  const MAX_DOTS = 3;

  const markedDates = useMemo(() => {
    const out: Record<string, any> = {};
    const palette = ['#ff3b30', '#ff9500', '#5856d6', '#34c759', '#00bcd4', '#9c27b0'];

    for (const [date, list] of Object.entries(events)) {
      if (!Array.isArray(list) || list.length === 0) continue;

      const dots = list.slice(0, MAX_DOTS).map((ev, i) => ({
        key: ev.id ?? `${date}-dot-${i}`,
        color: palette[i % palette.length],
      }));

      out[date] = { ...(out[date] || {}), dots };
    }

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

  const addEventLocal = useCallback(() => {
    if (!selected) return;

    let start = toLocalDate(selected);
    let end = toLocalDate(selected);

    if (allDay) {
      const days = multiDay ? Math.max(1, parseInt(daysLong || '1', 10)) : 1;
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
  }, [selected, allDay, multiDay, daysLong, startHour, endHour, title]);

  const removeEvent = useCallback((dateKey: string, id: string) => {
    setEvents(prev => {
      const list = prev[dateKey] || [];
      return { ...prev, [dateKey]: list.filter(e => e.id !== id) };
    });
  }, []);

  const handleExportICS = useCallback(() => exportICS(events), [events]);

  const eventsForSelected = events[selected] || [];

  // Pass all state and handlers to MonthRoute
  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'day':
        return <DayRoute />;
      case 'week':
        return <WeekRoute />;
      case 'month':
        return (
          <MonthRoute
            selected={selected}
            markedDates={markedDates}
            setSelected={setSelected}
            eventsForSelected={eventsForSelected}
            removeEvent={removeEvent}
            addEventLocal={addEventLocal}
            exportICS={handleExportICS}
            title={title} setTitle={setTitle}
            allDay={allDay} setAllDay={setAllDay}
            startHour={startHour} setStartHour={setStartHour}
            endHour={endHour} setEndHour={setEndHour}
            multiDay={multiDay} setMultiDay={setMultiDay}
            daysLong={daysLong} setDaysLong={setDaysLong}
          />
        );
      default:
        return null;
    }
  };

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: layout.width }}
      renderTabBar={(props) => (
        <SafeAreaView edges={['top']} style={{ backgroundColor: styles.tabBar.backgroundColor }}>
          <TabBar
            {...props}
            style={styles.tabBar}
            indicatorStyle={styles.indicator}
            //labelStyle={styles.label}
          />
        </SafeAreaView>
      )}
    />
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
    monthContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 20,
    },
    tabBar: {
      backgroundColor: '#007AFF',
    },
    indicator: {
      backgroundColor: 'white',
      height: 3,
    },
    label: {
      fontWeight: '600',
      color: 'white', 
    },
    // Day View Styles
    dayScroll: {
      flex: 1,
      backgroundColor: '#ffffffff',
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 60,
      borderBottomColor: '#E0E0E0',
      borderBottomWidth: 1,
    },
    hourText: {
      width: 50,
      textAlign: 'right',
      marginRight: 10,
      color: '#555',
    },
    hourDivider: {
      flex: 1,
      borderBottomWidth: 0.5,
      borderBottomColor: '#E0E0E0',
    },
    eventBlock: {
      position: 'absolute',
      left: 70,
      right: 20,
      backgroundColor: '#007AFF33',
      borderLeftColor: '#007AFF',
      borderLeftWidth: 3,
      borderRadius: 8,
      padding: 8,
    },
    eventTitle: {
      fontWeight: '600',
      color: '#007AFF',
    },
    eventTime: {
      color: '#333',
      fontSize: 12,
    },
    // Week View Styles
    weekContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 20,
      backgroundColor: '#FFF',
      flex: 1,
    },
    weekDay: {
      alignItems: 'center',
      flex: 1,
    },
    weekDayText: {
      fontWeight: '600',
      marginBottom: 8,
    },
    weekEventCard: {
      backgroundColor: '#007AFF33',
      borderRadius: 8,
      padding: 8,
      width: 70,
      alignItems: 'center',
    },
    // Add Event Styles
      flex: { 
        flex: 1,
        backgroundColor: '#fff' 
      },
      container: { flex: 1, backgroundColor: '#fff' },
      scrollContent: { padding: 16 },
      section: { marginTop: 16, gap: 8 },
      h4: { fontWeight: '700', fontSize: 16 },
      value: { color: '#333' },
      label2: { fontWeight: '600', marginTop: 6 },
      labelInline: { fontWeight: '600' },
      input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10 },
      rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
      muted: { color: '#666' },
      eventCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 10, marginTop: 10 },
      addEventTittle: { fontWeight: '600' },
      addEventTime: { color: '#333' },
  });

