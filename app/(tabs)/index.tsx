import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView} from 'react-native-safe-area-context';
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
          [selected]: { selected: true, disableTouchEvent: true, selectedColor: 'orange' }
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

