import { StyleSheet, View } from "react-native";
import { Activity, VadivamProvider } from "vadivam-react-native";
import Search from "vadivam-react-native/icons/search";

export default function App() {
  return (
    <VadivamProvider size={32} color="#111827" strokeWidth={2}>
      <View style={styles.container}>
        <Activity testID="activity-icon" accessibilityLabel="Activity" />
        <Search testID="search-icon" accessibilityLabel="Search" />
      </View>
    </VadivamProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
  },
});
