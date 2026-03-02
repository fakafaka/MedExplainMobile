import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { getReports } from "../src/api/medexplain";
import { iosTheme } from "../src/ui/iosTheme";

function formatDate(iso?: string) {
  if (!iso) return "";

  const d = new Date(iso);

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) +
    " • " +
    d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
}

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);
      const res = await getReports();
      setReports(res?.reports || []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
  <View style={{ flex: 1, backgroundColor: iosTheme.bg }}>
    
    <ScrollView
  style={{ flex: 1, backgroundColor: iosTheme.bg }}
  contentContainerStyle={{ padding: iosTheme.s.screenH, paddingBottom: 28 }}
>
      {/* Header */}
      <View style={{ marginBottom: 16 }}>
  <View
  style={{
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  }}
>
  {/* Left: Back + Title */}
  <View>
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/" as any);
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={{ color: iosTheme.tint, fontSize: 17, fontWeight: "600" }}>
        Back
      </Text>
    </Pressable>

    <Text
      style={{
        marginTop: 6,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.4,
        color: iosTheme.text,
      }}
    >
      History
    </Text>
  </View>

  {/* Right: Refresh */}
  <Pressable onPress={load} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
    <Text style={{ color: iosTheme.tint, fontWeight: "600", fontSize: 17 }}>
      Refresh
    </Text>
  </Pressable>
</View>

  <Text style={{ marginTop: 4, fontSize: 15, color: iosTheme.textSecondary }}>
    Your previous analyses
  </Text>
</View>
      <View style={{ height: 8 }} />
      {loading && <ActivityIndicator size="large" />}

      {!!error && (
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#B91C1C", fontWeight: "600" }}>{error}</Text>
        </View>
      )}

      {!loading && !error && reports.length === 0 && (
        <Text style={{ color: "#6B7280" }}>
          No reports yet. Analyze a PDF or photos first.
        </Text>
      )}

      {(reports || []).map((r) => {
        const id = r?.id ?? r?.reportId;
        const idStr = String(id);

        return (
          <Pressable
            key={idStr}
            onPress={() => router.push(`/history/${idStr}`)}
            style={({ pressed }) => [
  {
    backgroundColor: iosTheme.card,
    borderRadius: iosTheme.r.card,
    borderWidth: 1,
    borderColor: iosTheme.border,
    padding: iosTheme.s.cardPad,
    marginBottom: iosTheme.s.gap,
    opacity: pressed ? 0.72 : 1,
    // iOS: clip for rounded corners, Android: keep shadow working
    overflow: "hidden",
    ...iosTheme.shadow,
  },
]}
          >
            <View
  style={{
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <Text style={{ fontSize: 17, fontWeight: "600", color: iosTheme.text }}>
    Report #{idStr}
  </Text>

  <Text style={{ color: "#C7C7CC", fontSize: 20 }}>
    ›
  </Text>
</View>

<Text
  style={{
    marginTop: 6,
    fontSize: 15,
    color: iosTheme.textSecondary,
  }}
>
  {r?.filename ?? "upload.pdf"}
</Text>

{!!r?.createdAt && (
  <Text style={{ color: iosTheme.textSecondary, marginTop: 2, fontSize: 13 }}>
    {formatDate(r.createdAt)}
  </Text>
)}

          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);
}
