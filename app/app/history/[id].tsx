import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getReportById } from "../../src/api/medexplain";
import { iosTheme } from "../../src/ui/iosTheme";

function extractSectionsFromAiText(aiText?: string) {
  if (!aiText) return { disclaimer: "", questions: "" };

  const t = aiText.replace(/\r/g, "");
  const dMatch = t.match(
    /Not medical advice[:\s]*([\s\S]*?)(?:\n{2,}|Questions to ask your doctor[:\s]*|$)/i
  );
  const qMatch = t.match(
  /Questions to ask your doctor[:\s]*([\s\S]*?)(?:IMPORTANT REMINDER|⚠️|Not medical advice|$)/i
);

  return {
    disclaimer: (dMatch?.[1] ?? "")
  .trim()
  .replace(/^[\s•\.\-–—]+/, "")
  .trim(),
    questions: (qMatch?.[1] ?? "").trim(),
  };
}
function cleanAiText(s?: string) {
  if (!s) return "";

  return s
    .replace(/\r/g, "")
    // убрать строки из любых "линий" (unicode, _, =, -, ─ и т.п.)
    .replace(/^[\s\-_=\u2500-\u257F\u23AF]{3,}$/gm, "")
    // убрать лишние пустые строки
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitQuestions(s?: string) {
  const t = cleanAiText(s);
  if (!t) return [];
  // попытка разделить "1. ..." по строкам
  const parts = t.split(/\n(?=\d+\.\s)/g).map((x) => x.trim()).filter(Boolean);
  if (parts.length) return parts;
  // fallback: по строкам
  return t.split("\n").map((x) => x.trim()).filter(Boolean);
}

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<any>(null);

  async function load() {
    try {
      setError("");
      setLoading(true);
      if (!id) throw new Error("Missing report id");
      const res = await getReportById(String(id));
      setReport(res.report);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }
  async function deleteReport() {
  try {
    if (!id) return;

    Alert.alert(
      "Delete report?",
      "This report will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await fetch(
              `https://med.apoteka24.me/api/reports/${id}`,
              { method: "DELETE" }
            );

            if (!res.ok) {
              throw new Error("Failed to delete report");
            }

            router.back();
          },
        },
      ]
    );
  } catch (e: any) {
    setError(e?.message ?? "Delete failed");
  }
}
  useEffect(() => {
    load();
  }, [id]);

  const analysis = useMemo(() => {
    if (!report) return null;
    // server now sends "analysis" object — use it first
    if (report.analysis && typeof report.analysis === "object") return report.analysis;

    // fallback: try parse aiJson if it exists
    if (typeof report.aiJson === "string" && report.aiJson.trim()) {
      try {
        return JSON.parse(report.aiJson);
      } catch {
        return null;
      }
    }
    return null;
  }, [report]);

  const highlights: any[] = analysis?.highlights || [];
  const { disclaimer, questions } = extractSectionsFromAiText(report?.aiText);
const disclaimerText = cleanAiText(disclaimer);
const questionsList = splitQuestions(questions);

  return (
    <ScrollView
  style={{ backgroundColor: iosTheme.bg }}
  contentContainerStyle={{ padding: iosTheme.s.screenH, paddingBottom: 40 }}
>
      {/* Header */}
<View style={{ marginBottom: 16 }}>
  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
    <View>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/history" as any);
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
        Report #{String(id)}
      </Text>
    </View>

    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Pressable onPress={load} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
        <Text style={{ color: iosTheme.tint, fontSize: 17, fontWeight: "600" }}>
          Refresh
        </Text>
      </Pressable>

      <Pressable
  onPress={deleteReport}
  style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
>
        <Text style={{ color: "#FF3B30", fontSize: 17, fontWeight: "600" }}>
          Delete
        </Text>
      </Pressable>
    </View>
  </View>

  {/* meta */}
  {!!report?.createdAt && (
    <Text style={{ marginTop: 6, fontSize: 13, color: iosTheme.textSecondary }}>
      {new Date(report.createdAt).toLocaleString()}
    </Text>
  )}
  {!!report?.filename && (
    <Text style={{ marginTop: 6, fontSize: 15, color: iosTheme.textSecondary }}>
      {report.filename}
    </Text>
  )}
</View>

      {loading && <ActivityIndicator size="large" />}
      {!!error && (
        <Text style={{ color: "red", marginBottom: 10 }}>{error}</Text>
      )}

      {!loading && report && (
        <View style={{ gap: 10 }}>

          {/* SUMMARY */}
          {!!analysis?.summary && (
  <View
    style={{
      backgroundColor: iosTheme.card,
      borderRadius: iosTheme.r.card,
      borderWidth: 1,
      borderColor: iosTheme.border,
      padding: iosTheme.s.cardPad,
      marginTop: iosTheme.s.gap,
      ...iosTheme.shadow,
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: "800", color: iosTheme.text }}>
      Summary
    </Text>

    <Text
      style={{
        marginTop: 10,
        fontSize: 15,
        lineHeight: 20,
        color: iosTheme.textSecondary,
      }}
    >
      {analysis.summary}
    </Text>
  </View>
)}

          {/* HIGHLIGHTS */}
          {highlights.length > 0 && (
            <>
              <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 10 }}>
                Highlights
              </Text>

              {highlights.map((h: any, idx: number) => {
                const flag = h?.flag ?? "UNKNOWN";
                const flagColor =
  flag === "HIGH" ? "#FF3B30" : flag === "LOW" ? "#FF9500" : "#34C759";

                return (
                  <View
                    key={`${h?.name ?? "item"}-${idx}`}
                    style={{
  backgroundColor: iosTheme.card,
  borderRadius: iosTheme.r.card,
  borderWidth: 1,
  borderColor: iosTheme.border,
  padding: iosTheme.s.cardPad,
  marginBottom: iosTheme.s.gap,
  ...iosTheme.shadow,
}}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>
                        {h?.name ?? "Unknown"}
                      </Text>
                      <Text style={{ fontWeight: "700", color: flagColor }}>
                        {flag}
                      </Text>
                    </View>

                    <Text style={{ marginTop: 4 }}>
                      {h?.value ?? "?"} {h?.unit ?? ""}
                    </Text>

                    <Text style={{ marginTop: 2, color: iosTheme.textSecondary }}>
                      Reference: {h?.ref ?? "—"}
                    </Text>

                    {!!h?.plainExplanation && (
                      <Text style={{ marginTop: 8, fontStyle: "italic" }}>
                        {h.plainExplanation}
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          )}
                  {(disclaimerText || questionsList.length > 0) && (
  <View style={{ marginTop: iosTheme.s.gap, gap: iosTheme.s.gap }}>
    {!!disclaimerText && (
      <View
        style={{
          backgroundColor: iosTheme.card,
          borderRadius: iosTheme.r.card,
          borderWidth: 1,
          borderColor: iosTheme.border,
          padding: iosTheme.s.cardPad,
          ...iosTheme.shadow,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800", color: iosTheme.text }}>
          Not medical advice
        </Text>
        <Text
          style={{
            marginTop: 10,
            fontSize: 15,
            lineHeight: 20,
            color: iosTheme.textSecondary,
          }}
        >
          {disclaimerText}
        </Text>
      </View>
    )}

    {questionsList.length > 0 && (
      <View
        style={{
          backgroundColor: iosTheme.card,
          borderRadius: iosTheme.r.card,
          borderWidth: 1,
          borderColor: iosTheme.border,
          padding: iosTheme.s.cardPad,
          ...iosTheme.shadow,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800", color: iosTheme.text }}>
          Questions to ask your doctor
        </Text>

        {questionsList.map((q, idx) => (
          <View key={idx} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 15, lineHeight: 20, color: iosTheme.textSecondary }}>
              {q}
            </Text>

            {idx !== questionsList.length - 1 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: iosTheme.border,
                  marginTop: 10,
                  opacity: 0.7,
                }}
              />
            )}
          </View>
        ))}
      </View>
    )}
  </View>
)}

        </View>
      )}
    </ScrollView>
  );
}
