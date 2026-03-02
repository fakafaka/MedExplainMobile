import { Platform } from "react-native";

export const iosTheme = {
  bg: "#F2F2F7",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.06)",
  text: "#111111",
  textSecondary: "rgba(60,60,67,0.75)",
  tint: "#007AFF",
  danger: "#FF3B30",
  r: { card: 18, pill: 999 },
  s: { screenH: 16, cardPad: 14, gap: 12 },
  shadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 3 },
    default: {},
  }) as any,
};
