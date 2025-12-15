import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { TabView, TabBar } from 'react-native-tab-view';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { useTasks } from "../utils/TaskContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

// --- Types ---
type DayPress = { dateString: string; day: number; month: number; year: number; timestamp: number };

type EventItem = {
  id: string;
  title: string;
  allDay: boolean;
  start: string; // ISO
  end: string;   // ISO
  category?: string;
};
type EventsByDate = Record<string, EventItem[]>; // "YYYY-MM-DD" -> events[]

const STORAGE_KEY = 'my_calendar_events_v1';
const CATEGORY_STORAGE_KEY = 'my_calendar_categories_v1';
const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// --- ICS Utilities ---
const pad2 = (n: number) => String(n).padStart(2, '0');

const parseLocalDate = (dateString: string) => {
  if (!dateString) return new Date(NaN);
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const formatDateBasic = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
const formatDateTimeUTC = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours()
  )}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

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

function formatTime(date: Date, is24: boolean) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !is24,
  });
}

function buildICS(evMap: EventsByDate) {
  const events = flattenEvents(evMap);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YourApp//InAppCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const dtstamp = formatDateTimeUTC(new Date());

  for (const ev of events) {
    const uid = (ev.id || Math.random().toString(36).slice(2)) + '@yourapp.local';
    let dtstart = '';
    let dtend = '';

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
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      dtend,
      `SUMMARY:${escapeICS(ev.title || 'Event')}`,
      'END:VEVENT'
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
const DayRoute = ({ events = {}, tasks = [], selected, timeFormat24 }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const buildBlocks = () => {
    if (!selected) return [];

    const selectedDate = parseLocalDate(selected);
    const blocks: any[] = [];

    // ---- Calendar Events ----
    Object.entries(events).forEach(([dateKey, eventList]) => {
      if (dateKey !== selected) return; // Only show events for selected day

      eventList.forEach(ev => {
        const start = new Date(ev.start);
        const end = new Date(ev.end);

        // Skip multi-day events for now (optional: we can support later)
        if (
          start.toDateString() !== selectedDate.toDateString()
        ) return;

        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = endMinutes - startMinutes;

        blocks.push({
          id: ev.id,
          title: ev.title,
          top: startMinutes,
          height: duration,
          startTime: start,
          endTime: end,
          color: "#007AFF33",
          borderColor: "#007AFF",
        });
      });
    });

    // ---- Tasks ----
    tasks.forEach(task => {
      const d = task.getDTstart();
      const y = parseInt(d.substring(0, 4));
      const m = parseInt(d.substring(4, 6));
      const day = parseInt(d.substring(6, 8));
      const hr = parseInt(d.substring(9, 11));
      const min = parseInt(d.substring(11, 13));

      const start = new Date(y, m - 1, day, hr, min);

      if (start.toDateString() !== selectedDate.toDateString()) return;

      const endStr = task.getDTend();
      const endH = parseInt(endStr.substring(9, 11));
      const endM = parseInt(endStr.substring(11, 13));
      const end = new Date(y, m - 1, day, endH, endM);

      const startMinutes = hr * 60 + min;
      const duration = (endH - hr) * 60 + (endM - min);

      blocks.push({
        id: task.getUid(),
        title: task.getSummary(),
        top: startMinutes,
        height: duration,
        startTime: start,
        endTime: end,
        color: "#34C75933",
        borderColor: "#34C759",
      });
    });

    return blocks;
  };

  const blocks = buildBlocks();

  // Format time labels inside event boxes
  const fmt = (date) => {
    if (timeFormat24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>

      {/* ---- DATE HEADER ---- */}
      <View style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#f8f8f8"
      }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>
          {parseLocalDate(selected).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </Text>
      </View>

      {/* ---- SCROLLABLE DAY GRID ---- */}
      <ScrollView style={styles.dayScroll} contentContainerStyle={{ height: 60 * 24 }}>
        {hours.map(hour => (
          <View key={hour} style={styles.hourRow}>
            <Text style={styles.hourText}>
              {timeFormat24
                ? `${hour.toString().padStart(2, "0")}:00`
                : new Date(0, 0, 0, hour).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </Text>
            <View style={styles.hourDivider} />
          </View>
        ))}

        {/* blocks */}
        {blocks.map(b => (
          <View
            key={b.id}
            style={{
              position: "absolute",
              left: 70,
              right: 20,
              top: b.top,
              height: b.height,
              backgroundColor: b.color,
              borderLeftWidth: 4,
              borderLeftColor: b.borderColor,
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontWeight: "600", color: "#003" }}>{b.title}</Text>
            <Text style={{ fontSize: 11, color: "#333" }}>
              {fmt(b.startTime)} – {fmt(b.endTime)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const WeekRoute = ({ events = {}, timeFormat24, weekAnchorDate, setWeekAnchorDate }) => {
  const { tasks } = useTasks();

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  /* Build Week Dates (Sun → Sat) */
  const today = new Date();
  const startOfWeek = new Date(weekAnchorDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);

    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      isToday:
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate(),
      dateObj: d,
    };
  });

  /*Convert events & tasks into blocks */
  const blocks = [];

  // Build calendar event blocks for all 7 days
  weekDays.forEach((wd, dayIndex) => {
    const dateKey = wd.dateObj.toISOString().split("T")[0];

    const dayEvents = events[dateKey] ?? [];

    dayEvents.forEach(ev => {
      const start = new Date(ev.start);
      const end = new Date(ev.end);

      const hour = start.getHours();
      const minute = start.getMinutes();

      const duration = (end.getTime() - start.getTime()) / 60000;

      blocks.push({
        id: ev.id,
        title: ev.title,
        dayIndex,
        top: hour * 60 + minute,
        height: duration,
        color: "#007AFF33",
        border: "#007AFF",
        startTime: start,
        endTime: end,
      });
    });
  });

  // Task events
  tasks.forEach((task) => {
    const d = task.getDTstart();
    const y = parseInt(d.substring(0, 4));
    const m = parseInt(d.substring(4, 6)) - 1;
    const da = parseInt(d.substring(6, 8));
    const h = parseInt(d.substring(9, 11));
    const mm = parseInt(d.substring(11, 13));

    const dObj = new Date(y, m, da);
    const dayIndex = dObj.getDay();

    const endStr = task.getDTend();
    const eh = parseInt(endStr.substring(9, 11));
    const em = parseInt(endStr.substring(11, 13));
    const duration = (eh - h) * 60 + (em - mm);

    blocks.push({
      id: task.getUid(),
      title: task.getSummary(),
      dayIndex,
      top: h * 60 + mm,
      height: duration,
      color: "#34C75933",
      border: "#34C759",
    });
  });

  /** RENDERS WEEK VIEW  */
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>

      {/* WEEKDAY HEADER */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd" }}>
        {/* Hour column spacer */}
        <View style={{ width: 40 }} />

        {/* Days */}
        <View style={{ flexDirection: "row", flex: 1 }}>
          {weekDays.map((d, idx) => (
            <View key={idx} style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: d.isToday ? "#007AFF22" : "transparent",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: d.isToday ? "#007AFF" : "#000" }}>
                  {d.label}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "600" }}>
                  {d.dayNum}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* WEEK NAV BAR */}
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,           //chaging 8 to 10
        borderBottomWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#f8f8f8",
      }}>
        <Text
          onPress={() =>
            setWeekAnchorDate(prev => {
              const d = new Date(prev);
              d.setDate(d.getDate() - 7);
              return d;
            })
          }
          style={{ fontSize: 18 }}
        >
          ←
        </Text>

        <Text style={{ fontWeight: "700", fontSize: 16 }}>
          {startOfWeek.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6)
            .toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
        </Text>

        <Text
          onPress={() =>
            setWeekAnchorDate(prev => {
              const d = new Date(prev);
              d.setDate(d.getDate() + 7);
              return d;
            })
          }
          style={{ fontSize: 18 }}
        >
          →
        </Text>
      </View>
      
      {/* Body */}
      <ScrollView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row" }}>

          {/* Hour labels */}
          <View>
            {HOURS.map((hr) => {
              const label = timeFormat24
                ? `${hr.toString().padStart(2, "0")}:00`
                : new Date(2020, 0, 1, hr, 0).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

              return (
                <View key={hr} style={{ height: 60, justifyContent: "flex-start" }}>
                  <Text style={{ width: 40, textAlign: "right", marginRight: 4, color: "#666" }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 7 columns */}
          <View style={{ flexDirection: "row", flex: 1 }}>
            {weekDays.map((_, columnIndex) => (
              <View key={columnIndex} style={{ width: `${100 / 7}%`, borderLeftWidth: 1, borderColor: "#eee" }}>

                {/* Column events */}
                {blocks
                  .filter((b) => b.dayIndex === columnIndex)
                  .map((b) => (
                    <View
                      key={b.id}
                      style={{
                        position: "absolute",
                        top: b.top,
                        height: b.height,
                        left: 2,
                        right: 2,
                        backgroundColor: b.color,
                        borderLeftColor: b.border,
                        borderLeftWidth: 4,
                        borderRadius: 6,
                        padding: 4,
                      }}
                    >
                      <Text style={{ fontWeight: "600", fontSize: 12 }}>{b.title}</Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

type Notification = {
  id: number;
  message: string;
  anim: Animated.Value;
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
  timeFormat24: boolean;
  setTimeFormat24: (v: boolean) => void;

  // Form props
  title: string;
  setTitle: (t: string) => void;
  allDay: boolean;
  setAllDay: (v: boolean) => void;
  startHour: string;
  setStartHour: (t: string) => void;
  endHour: string;
  setEndHour: (t: string) => void;
  multiDay: boolean;
  setMultiDay: (v: boolean) => void;
  daysLong: string;
  setDaysLong: (d: string) => void;
  category: string;
  setCategory: (c: string) => void;

  categories: string[];
  newCategory: string;
  setNewCategory: (c: string) => void;
  addCategory: () => void;

  // notifications
  notifications: Notification[];
};

// Month View: contains the Calendar, notifications, and the event creation form
const MonthRoute = (props: MonthRouteProps) => {
  const insets = useSafeAreaInsets();
  const {
    selected, markedDates, setSelected, eventsForSelected, removeEvent,
    addEventLocal, exportICS: handleExportICS, title, setTitle, allDay, setAllDay,
    startHour, setStartHour, endHour, setEndHour, multiDay, setMultiDay, daysLong, setDaysLong, category, setCategory, categories, newCategory, setNewCategory, addCategory, notifications, timeFormat24, setTimeFormat24
  } = props;

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={insets.top + 48} // Adjusted offset to clear TabBar/Safe Area
      >
        {/* Notification stack */}
        {Array.isArray(notifications) && notifications.length > 0 && (

          <View
            style={[styles.notificationsContainer, { top: insets.top + 8 }]}
            pointerEvents="none"
          >
            {[...notifications].reverse().map((n) => (
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
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
            />

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>All-day</Text>
              <Switch value={allDay} onValueChange={setAllDay} />
            </View>

            <Text style={styles.h4}>Category</Text>
            <Picker
              selectedValue={category}
              onValueChange={(value) => setCategory(value)}
              style={{
                backgroundColor: '#A9A9A9', // light gray
                color: 'black',
              }}
            >
              {categories.map((cat) => (
                <Picker.Item
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  value={cat}
                />
              ))}
            </Picker>

            <Text style={styles.label2}>Add new category</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new category"
              value={newCategory}
              onChangeText={setNewCategory}
            />
            <Button title="Add Category" onPress={addCategory} />

            {!allDay && (
              <>
                <Text style={styles.label2}>Start (HH:mm)</Text>
                <TextInput
                  style={styles.input}
                  value={startHour}
                  onChangeText={setStartHour}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.label2}>End (HH:mm)</Text>
                <TextInput
                  style={styles.input}
                  value={endHour}
                  onChangeText={setEndHour}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            <View style={styles.rowBetween}>
              <Text style={styles.labelInline}>Multi-day</Text>
              <Switch value={multiDay} onValueChange={setMultiDay} />
            </View>

            {multiDay && (
              <>
                <Text style={styles.label2}># of days</Text>
                <TextInput
                  style={styles.input}
                  value={daysLong}
                  onChangeText={setDaysLong}
                  keyboardType="number-pad"
                />
              </>
            )}

            <Button title="Add to in-app calendar" onPress={addEventLocal} disabled={!selected} />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.labelInline}>24-hour time</Text>
            <Switch value={timeFormat24} onValueChange={setTimeFormat24}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.h4}>Events on {selected || '—'}</Text>
            {eventsForSelected.length === 0 ? (
              <Text style={styles.muted}>No events yet</Text>
            ) : (
              eventsForSelected.map((ev) => {
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                const timeText = ev.allDay
                  ? `All-day${start.toDateString() !== end.toDateString()
                    ? ` (${start.toDateString()} → ${end.toDateString()})`
                    : ''
                  }`
                  : `${start.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} — ${end.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`;

                return (
                  <View key={ev.id} style={styles.eventCard}>
                    <Text style={styles.addEventTittle}>• {ev.title}</Text>
                    <Text style={styles.addEventTime}>{timeText}</Text>
                    {ev.category && (
                      <Text style={styles.addEventCategory}>
                        Category: {ev.category}
                      </Text>
                    )}
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
  const [timeFormat24, setTimeFormat24] = useState(true);
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("timeFormat24");
      if (saved !== null) setTimeFormat24(saved === "true");
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("timeFormat24", String(timeFormat24));
  }, [timeFormat24]);

  const { tasks } = useTasks();
  const [index, setIndex] = useState(2); // start with Month
  const [routes] = useState([
    { key: 'day', title: 'Day' },
    { key: 'week', title: 'Week' },
    { key: 'month', title: 'Month' },
  ]);

  const [selected, setSelected] = useState('');
  const [events, setEvents] = useState<EventsByDate>({});

  const [weekAnchorDate, setWeekAnchorDate] = useState<Date>(() => {   //test
    return selected ? parseLocalDate(selected) : new Date();
  });


  // simple form state
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startHour, setStartHour] = useState('10:00'); // HH:mm local
  const [endHour, setEndHour] = useState('11:00');
  const [multiDay, setMultiDay] = useState(false);
  const [daysLong, setDaysLong] = useState('2');
  const [category, setCategory] = useState<string>('personal');

  const [categories, setCategories] = useState<string[]>([
    'general',
    'work',
    'personal',
    'school',
  ]);
  const [newCategory, setNewCategory] = useState('');

  // load & persist events
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events)).catch(() => { });
  }, [events]);

  // load & persist categories
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CATEGORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load categories', e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories)).catch(() => { });
  }, [categories]);

  const addCategory = useCallback(() => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();

    setCategories((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });

    setCategory(key);
    setNewCategory('');
  }, [newCategory]);

  const MAX_DOTS = 3;

  useEffect(() => {
    if (selected) {
      setWeekAnchorDate(parseLocalDate(selected));
    }
  }, [selected]);

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
      category,
    };

    setEvents((prev) => {
      const copy = { ...prev };
      const key = selected;
      copy[key] = [...(copy[key] || []), ev];
      return copy;
    });
  }, [selected, allDay, multiDay, daysLong, startHour, endHour, title, category]);

  const removeEvent = useCallback((dateKey: string, id: string) => {
    setEvents((prev) => {
      const list = prev[dateKey] || [];
      return { ...prev, [dateKey]: list.filter((e) => e.id !== id) };
    });
  }, []);

  const handleExportICS = useCallback(() => exportICS(events), [events]);

  const eventsForSelected = events[selected] || [];

  // ---- notifications / toasts ----
  const BANNER_DURATION = 1500;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextIdRef = useRef(0);

  const showNotification = (message: string) => {
    const id = nextIdRef.current++;
    const anim = new Animated.Value(0);
    const newNotification: Notification = { id, message, anim };

    setNotifications((prev) => [...prev, newNotification]);

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
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });
  };

  const handleAddEventLocalWithNotification = () => {
    if (!selected) return;
    addEventLocal();
    if (title.trim()) {
      showNotification(`Added event: ${title.trim()}`);
    } else {
      showNotification('Added event');
    }
  };

  // Pass all state and handlers to MonthRoute
  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'day':
        return (
          <DayRoute
            events={events}
            tasks={tasks}
            selected={selected}
            timeFormat24={timeFormat24}
          />
        );
      case 'week':
        return (
          <WeekRoute
            events={events}
            timeFormat24={timeFormat24}

            weekAnchorDate={weekAnchorDate}
            setWeekAnchorDate={setWeekAnchorDate}
          //        selected={selected}
          />
        );

      case 'month':
        return (
          <MonthRoute
            selected={selected}
            markedDates={markedDates}
            setSelected={setSelected}
            eventsForSelected={eventsForSelected}
            removeEvent={removeEvent}
            addEventLocal={handleAddEventLocalWithNotification}
            exportICS={handleExportICS}
            title={title}
            setTitle={setTitle}
            allDay={allDay}
            setAllDay={setAllDay}
            startHour={startHour}
            setStartHour={setStartHour}
            endHour={endHour}
            setEndHour={setEndHour}
            multiDay={multiDay}
            setMultiDay={setMultiDay}
            daysLong={daysLong}
            setDaysLong={setDaysLong}
            category={category}
            setCategory={setCategory}
            categories={categories}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            addCategory={addCategory}
            notifications={notifications}
            timeFormat24={timeFormat24}
            setTimeFormat24={setTimeFormat24}
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
          />
        </SafeAreaView>
      )}
    />
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  // ---------- Layout ----------
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },

  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  scrollContent: {
    padding: 16,
  },

  section: {
    marginTop: 16,
    gap: 8,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ---------- Tabs ----------
  tabBar: {
    backgroundColor: '#007AFF',
  },
  indicator: {
    backgroundColor: 'white',
    height: 3,
  },

  // ---------- Day View ----------
  dayScroll: {
    flex: 1,
    backgroundColor: '#fff',
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

  // ---------- Week View ----------
  weekWrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },

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

  categoryText: {
    width: 50,
    textAlign: 'right',
    marginRight: 10,
    color: '#000',
  },

  // ---------- Event Cards ----------
  eventCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  addEventTittle: {
    fontWeight: '600',
  },
  addEventTime: {
    color: '#333',
  },
  addEventCategory: {
    color: '#000',
    marginTop: 4,
  },

  // ---------- Text ----------
  h4: {
    fontWeight: '700',
    fontSize: 16,
  },
  value: {
    color: '#333',
  },
  label2: {
    fontWeight: '600',
    marginTop: 6,
  },
  labelInline: {
    fontWeight: '600',
  },
  muted: {
    color: '#666',
  },

  // ---------- Inputs ----------
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
  },

  // ---------- Notifications ----------
  notificationsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    flexDirection: 'column',
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
});

