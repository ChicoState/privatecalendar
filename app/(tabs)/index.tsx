import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Button, TextInput, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { openDatabaseAsync } from 'expo-sqlite';   

export default function App() {
  const [db, setDb] = useState<any>(null);
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
		  if (Platform.OS === 'web') return; // skip web to avoid WASM path
		  (async () => {
		   const adb = await openDatabaseAsync('events.db');
		   setDb(adb);
		   await adb.execAsync?.(`
				   CREATE TABLE IF NOT EXISTS events (
					   id INTEGER PRIMARY KEY AUTOINCREMENT,
					   title TEXT,
					   date TEXT,
					   notes TEXT
					   );
				   `);
		   console.log('Database ready');
		   })();
		  }, []);

  const handleAddEvent = async () => {
	  if (!db) return console.log('DB not ready yet');
	  if (!selected || !title) return console.log('Please select a date and enter a title');

	  await db.runAsync?.(
			  'INSERT INTO events (title, date, notes) VALUES (?, ?, ?);',
			  [title, selected, notes]
			  );

	  console.log('Event added!');
	  setTitle('');
	  setNotes('');
  };

  return (
		  <SafeAreaView style={styles.container}>
		  <Calendar
		  onDayPress={(day) => setSelected(day.dateString)}
		  markedDates={
		  selected
		  ? { [selected]: { selected: true, selectedColor: 'orange' } }
		  : undefined
		  }
		  />
		  <View style={styles.inputContainer}>
		  <TextInput
		  placeholder="Event title"
		  value={title}
		  onChangeText={setTitle}
		  style={styles.input}
		  />
		  <TextInput
		  placeholder="Notes"
		  value={notes}
		  onChangeText={setNotes}
		  style={[styles.input, { height: 60 }]}
		  multiline
			  />
			  </View>
			  <View style={styles.buttonContainer}>
			  <Button title="Add Event to Calendar" onPress={handleAddEvent} />
			  </View>
			  </SafeAreaView>
			  );
}

const styles = StyleSheet.create({
container: { flex: 1, paddingTop: 20, justifyContent: 'flex-start' },
inputContainer: { padding: 16 },
input: {
borderWidth: 1,
borderColor: '#ccc',
borderRadius: 8,
padding: 8,
marginVertical: 4,
},
buttonContainer: { padding: 16 },
});

