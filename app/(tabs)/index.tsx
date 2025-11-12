import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';

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

// Month View
const MonthRoute = () => {
  const [selected, setSelected] = useState('');
  return (
    <SafeAreaView style={styles.container}>
      <Calendar
        onDayPress={(day) => setSelected(day.dateString)}
        markedDates={{
          [selected]: { selected: true, disableTouchEvent: true, selectedColor: '#007AFF' },
        }}
        theme={{
          todayTextColor: '#007AFF',
          arrowColor: '#007AFF',
          selectedDayBackgroundColor: '#007AFF',
          textMonthFontWeight: 'bold',
        }}
      />
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

  const renderScene = SceneMap({
    day: DayRoute,
    week: WeekRoute,
    month: MonthRoute,
  });

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: layout.width }}
      renderTabBar={(props) => (
        <SafeAreaView>
          <TabBar
            {...props}
            style={styles.tabBar}
            indicatorStyle={styles.indicator}
          //  labelStyle={styles.label}
          />
        </SafeAreaView>
      )}
    />
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 20,
  },
  tabBar: {
    backgroundColor: '#007AFF',
  },
  indicator: {
    backgroundColor: '#007AFF',
    height: 3,
  },
  label: {
    fontWeight: '600',
    color: '#007AFF',
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
});

