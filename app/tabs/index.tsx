import React from 'react';
    import { SafeAreaView, StyleSheet } from 'react-native';
    import { Calendar } from 'react-native-calendars';

    function App() {
      return (
        <SafeAreaView style={styles.container}>
          <Calendar />
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

