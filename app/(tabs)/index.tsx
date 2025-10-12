import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

function App() {
  const [selected, setSelected] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <Calendar
        onDayPress={day => {
          setSelected(day.dateString);
        }}
        markedDates={{
          [selected]: { selected: true, disableTouchEvent: true, selectedDotColor: 'orange' }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 20, // Optional: Add padding for better spacing
  },
});

export default App;

