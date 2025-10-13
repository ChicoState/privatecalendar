import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
          }}>
         Features 
        </ThemedText>
      </ThemedView>
      <ThemedText>This page contains various features to help the user get started.</ThemedText>
      <Collapsible title="Daily View">
        <ThemedText>
          This app has a daily screen to provide ease of access to tasks on a the current day.
        </ThemedText>
      </Collapsible>
      <Collapsible title="Weekly view">
        <ThemedText>
        This app provides a weekly view to keep a condensed layout for events happening during the current week
        </ThemedText>
      </Collapsible>
      <Collapsible title="Monthly View">
        <ThemedText>
        This app provides a monthly view for users to get a grasp of the events they have in the current month
        </ThemedText>
      </Collapsible>
      <Collapsible title="Tasks">
        <ThemedText>
        This app provides a task view for users to have ease of access to tasks they have created for themselves
        </ThemedText>
      </Collapsible>
      <Collapsible title="Animations">
        <ThemedText>
        This app contains AddEvent and AddTask buttons for users to quickly add events and tasks on the fly for convenince.
        </ThemedText>
              </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
