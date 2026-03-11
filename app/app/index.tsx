import "react-native-get-random-values";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { iosTheme } from "../src/ui/iosTheme";
import { Stack } from "expo-router";
import * as RNIap from "react-native-iap";

function extractSectionsFromAiText(aiText?: string) {
  if (!aiText) return { disclaimer: "", questions: "" };

  const t = aiText.replace(/\r/g, "");
  const dMatch = t.match(
    /Not medical advice[:\s]*([\s\S]*?)(?:\n{2,}|Questions to ask your doctor[:\s]*|$)/i
  );
  const qMatch = t.match(/Questions to ask your doctor[:\s]*([\s\S]*?)$/i);

  const disclaimer = (dMatch?.[1] ?? "")
  .trim()
  // убрать ведущие маркеры списков вроде ". ", "• ", "- ", "– ", "— "
  .replace(/^[\s•\.\-–—]+/, "")
  .trim();

  const rawQ = (qMatch?.[1] ?? "").trim();
  const cleanedQ = rawQ
    .replace(/^[\s\-_=\u2500-\u257F\u23AF—]{3,}$/gm, "") // убрать линии/черты
    .replace(/IMPORTANT REMINDER[\s\S]*$/i, "") // убрать блок reminder
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { disclaimer, questions: cleanedQ };
}

// IMPORTANT: this file is app/app/index.tsx
// so we need to go up ONE level to reach src/*
import { analyzePdfBase64, healthCheck } from "../src/api/medexplain";
import { uploadImagesToServerWithProgress } from "../src/utils/uploadImagesWithProgress";

type Phase = "IDLE" | "UPLOADING" | "ANALYZING" | "DONE" | "ERROR";
type Filter = "ALL" | "ABNORMAL";

const API_BASE_URL = "https://med.apoteka24.me";

export default function HomeScreen() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [result, setResult] = useState<any>(null);

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ABNORMAL");
  useEffect(() => {
  let purchaseUpdateSubscription: any;

  async function initIAP() {
    try {
      await RNIap.initConnection();
      console.log("IAP connected");
      Alert.alert("IAP", "Connection initialized");

      const products = await (RNIap as any).getProducts(["medexplain.premium"]);
      console.log("IAP products:", products);

      purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
        async (purchase) => {
          console.log("Purchase success", purchase);

          await RNIap.finishTransaction({ purchase: purchase as any });

Alert.alert(
  "Purchase successful",
  "You now have 5 additional analyses."
);
        }
      );
    } catch (e) {
      console.log("IAP init error", e);
    }
  }

  initIAP();

  return () => {
    purchaseUpdateSubscription?.remove();
    RNIap.endConnection();
  };
}, []);
  async function onPickAndAnalyzePdf() {
    try {
      setPhase("UPLOADING");
      setResult(null);
      setStatus("");
      setLoading(true);
      setUploadProgress(0);
      setExpandedKey(null);

      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled) {
        setStatus("Canceled");
        setPhase("IDLE");
        return;
      }

      const file = picked.assets?.[0];
      if (!file?.uri) {
        setPhase("ERROR");
        setStatus("Error: No file selected");
        return;
      }

      setStatus(`Selected: ${file.name ?? "file.pdf"}`);
      setUploadProgress(0.2); // 20%

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setUploadProgress(0.5); // 50%

      console.log("PDF base64 length:", base64?.length);

      if (!base64 || base64.length < 100) {
        setPhase("ERROR");
        setStatus("Error: PDF base64 is empty");
        setLoading(false);
        return;
      }

      setPhase("ANALYZING");
      setStatus("Analyzing...");

      setUploadProgress(0.9); // 90%
      const apiResult = await analyzePdfBase64(
        base64,
        file.name ?? "upload.pdf"
      );

      setResult(apiResult);
      setUploadProgress(1); // 100%
      setPhase("DONE");
      setStatus("Done ✅");
    } catch (e: any) {
  if (String(e?.message || "").includes("API error 402")) {
    Alert.alert(
  "Free analysis used",
  "You already used your free analysis. Buy 5 more analyses for $1.99.",
  [
    { text: "Cancel", style: "cancel" },
    {
  text: "Buy",
  onPress: async () => {
    try {
      const products = await (RNIap as any).getProducts(["medexplain.premium"]);
      console.log("Loaded products:", products);

      await RNIap.requestPurchase("medexplain.premium" as any);
    } catch (err) {
      console.log("Purchase error", err);
    }
  }
}
  ]
);
    setPhase("IDLE");
    setLoading(false);
    return;
  }

  setUploadProgress(0);
  setPhase("ERROR");
  setStatus(`Error: ${e?.message ?? "Unknown error"}`);
} finally {
      setLoading(false);
    }
  }

  // ---------- Photos flow ----------

  async function takeOnePhoto(): Promise<string | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera permission is required.");
      return null;
    }

    const shot = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (shot.canceled) return null;
    return shot.assets?.[0]?.uri ?? null;
  }

  async function compressImageUri(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1400 } }],
      { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  }

  async function pickPhotosFromGallery(): Promise<string[]> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {

      Alert.alert("Permission needed", "Photo library permission is required.");
      return [];
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });

    if (picked.canceled) return [];

    const uris = (picked.assets ?? [])
      .map((a) => a.uri)
      .filter((uri): uri is string => typeof uri === "string" && uri.length > 0);

    const compressed = await Promise.all(uris.map((u) => compressImageUri(u)));
    return compressed;
  }

  async function askAddAnotherPage(): Promise<boolean> {
    return await new Promise((resolve) => {
      Alert.alert("Add another page?", "", [
        { text: "No", style: "cancel", onPress: () => resolve(false) },
        { text: "Yes", onPress: () => resolve(true) },
      ]);
    });
  }
  async function fetchReport(reportId: number) {
      const res = await fetch(`${API_BASE_URL}/api/reports/${reportId}`);
      if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to fetch report ${reportId}`);
      }
  const data = await res.json();
  return data.report; // <-- report содержит analysis
  }
    function onAddPhotos() {
    Alert.alert("Add photos", "Choose source", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => takePhotosFlow() },
      { text: "Choose from gallery", onPress: () => pickPhotosFlow() },
    ]);
  }

  async function pickPhotosFlow() {
    try {
      setResult(null);
      setExpandedKey(null);
      setStatus("");
      setLoading(true);
      setUploadProgress(0);

      const uris = await pickPhotosFromGallery();

      if (uris.length === 0) {
        setStatus("Canceled");
        setPhase("IDLE");
        return;
      }

      setPhase("UPLOADING");
      setStatus(`Uploading ${uris.length} photo(s)...`);

      const json = await uploadImagesToServerWithProgress({
        apiBaseUrl: API_BASE_URL,
        imageUris: uris,
        onProgress: (percent) => {
  const v = percent > 1 ? percent / 100 : percent; // 0..100 -> 0..1
  const clamped = Math.max(0, Math.min(1, v));
  setUploadProgress(clamped);
},
      });

      setPhase("DONE");
      setStatus(`Uploaded ✅ Report: ${json.reportId ?? "?"}`);

      if (json?.reportId) {
        setPhase("ANALYZING");
        setStatus(`Analyzing ✅ Fetching report: ${json.reportId}...`);

        const report = await fetchReport(Number(json.reportId));
        setResult(report);

        setPhase("DONE");
        setStatus(`Done ✅ Report: ${json.reportId}`);
      }
    } catch (e: any) {
      setPhase("ERROR");
      setStatus(`Upload error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function takePhotosFlow() {
    try {
      setResult(null);
      setExpandedKey(null);
      setStatus("");
      setLoading(true);
      setUploadProgress(0);

      const uris: string[] = [];

      while (true) {
        const uri = await takeOnePhoto();
        if (!uri) break;

        const compressedUri = await compressImageUri(uri);
        uris.push(compressedUri);

        const more = await askAddAnotherPage();
        if (!more) break;
      }

      if (uris.length === 0) {
        setStatus("Canceled");
        setPhase("IDLE");
        return;
      }

      setPhase("UPLOADING");
      setStatus(`Uploading ${uris.length} photo(s)...`);

      const json = await uploadImagesToServerWithProgress({
        apiBaseUrl: API_BASE_URL,
        imageUris: uris,
        onProgress: (percent) => {
  const v = percent > 1 ? percent / 100 : percent; // 0..100 -> 0..1
  const clamped = Math.max(0, Math.min(1, v));
  setUploadProgress(clamped);
},
      });

      // Backend должен вернуть reportId (мы это сделаем на сервере следующим шагом)
      setPhase("DONE");
      setUploadProgress(100);
      setStatus(`Uploaded ✅ Report: ${json.reportId ?? "?"}`);
      if (json?.reportId) {
      setPhase("ANALYZING");
      setStatus(`Analyzing ✅ Fetching report: ${json.reportId}...`);

      const report = await fetchReport(Number(json.reportId));
      setResult(report);

      setPhase("DONE");
      setUploadProgress(100);
      setStatus(`Done ✅ Report: ${json.reportId}`);
      }

      // router.push("/history" as any);
    } catch (e: any) {
      setPhase("ERROR");
      setStatus(`Upload error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Render ----------

  const highlights: any[] = result?.analysis?.highlights || [];

  const filteredHighlights =
    filter === "ALL"
      ? highlights
      : highlights.filter((h) => h?.flag === "HIGH" || h?.flag === "LOW");

  const aiText =
  result?.aiText ??
  result?.report?.aiText ??
  result?.analysis?.aiText ??
  result?.report?.analysis?.aiText ??
  "";

const { disclaimer, questions } = extractSectionsFromAiText(aiText);

   return (
    <View style={{ flex: 1, backgroundColor: iosTheme.bg }}>
      <Stack.Screen
  options={{
    title: "MedExplain",
    headerLargeTitle: true,
    headerShadowVisible: false,
    headerRight: () => (
      <Pressable onPress={() => router.push("/history" as any)} style={{ paddingHorizontal: 12 }}>
        <Text style={{ color: "#0A84FF", fontSize: 17, fontWeight: "600" }}>
          History
        </Text>
      </Pressable>
    ),
  }}
/>
      <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{ padding: iosTheme.s.screenH, paddingBottom: 28 }}
>
        <View>
          {/* Header */}
<View style={{ marginBottom: 16 }}>
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <Text
      style={{
        fontSize: 34,
        fontWeight: "700",
        letterSpacing: -0.6,
        color: iosTheme.text,
      }}
    >
      MedExplain
    </Text>

    <Pressable onPress={() => router.push("/history" as any)}>
      <Text style={{ color: iosTheme.tint, fontSize: 17, fontWeight: "600" }}>
        History
      </Text>
    </Pressable>
  </View>

  <Text style={{ marginTop: 4, fontSize: 15, color: iosTheme.textSecondary }}>
    Understand your lab results in plain language
  </Text>
</View>
          {/* Actions */}
<View style={{ gap: 12 }}>
  <Pressable
    onPress={onPickAndAnalyzePdf}
    style={{
      height: 48,
      borderRadius: 16,
      backgroundColor: "#0A84FF",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
      Pick PDF and analyze
    </Text>
  </Pressable>

  <Pressable
  onPress={onAddPhotos}
  style={{
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <Text style={{ color: "#0A84FF", fontSize: 16, fontWeight: "600" }}>
    Add photos
  </Text>
</Pressable>
</View>

{/* Privacy card */}
<View
  style={{
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  }}
>
  <Text style={{ fontSize: 16, fontWeight: "600" }}>Your privacy</Text>
  <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 18, color: "#666" }}>
    We analyze your documents to provide explanations and limit data retention.
    You can delete any report at any time from History. All reports are
    automatically removed from our servers after 24 hours.
  </Text>
</View>
          {/* Status (hide during progress) */}
          {!!status && !(phase === "UPLOADING" || phase === "ANALYZING") && (
  <View style={{ marginTop: 12 }}>
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E5EA",
      }}
    >
      <Text style={{ fontSize: 14, color: "#374151", fontWeight: "600" }}>
        {status}
      </Text>
    </View>
  </View>
)}

          {/* Progress */}
{(phase === "UPLOADING" || phase === "ANALYZING") && (
  <View style={{ marginTop: 12 }}>
    <Text style={{ fontSize: 13, color: "#374151" }}>
      {phase === "ANALYZING" ? "Analyzing…" : "Uploading…"}{" "}
      {Math.round(uploadProgress * 100)}%
    </Text>

    <View
      style={{
        marginTop: 8,
        height: 10,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: "100%",
          width: `${Math.round(uploadProgress * 100)}%`,
          backgroundColor: "#0A84FF",
        }}
      />
    </View>
  </View>
)}

          {loading && (
            <View className="mt-4">
              <ActivityIndicator size="large" />
            </View>
          )}

          {phase === "ERROR" && (
            <View className="mt-4">
              <Pressable
                onPress={onPickAndAnalyzePdf}
                className="h-12 items-center justify-center rounded-2xl bg-black"
              >
                <Text className="text-base font-semibold text-white">
                  Try PDF again
                </Text>
              </Pressable>
            </View>
          )}

{/* Results */}
<View style={{ marginTop: 24 }}>
  {result?.analysis ? (
    <>
      {/* Summary Card */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 16,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
          Summary
        </Text>

        <Text style={{ fontSize: 14, lineHeight: 20, color: "#374151" }}>
          {result.analysis.summary}
        </Text>
      </View>

      <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "600" }}>
        Highlights
      </Text>

      {/* Filters */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => setFilter("ABNORMAL")}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#E5E5EA",
            backgroundColor: filter === "ABNORMAL" ? "#FFFFFF" : "transparent",
          }}
        >
          <Text style={{ fontWeight: "600" }}>High/Low only</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("ALL")}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#E5E5EA",
            backgroundColor: filter === "ALL" ? "#FFFFFF" : "transparent",
          }}
        >
          <Text style={{ fontWeight: "600" }}>All</Text>
        </Pressable>
      </View>

      {/* List */}
      {filteredHighlights.length === 0 ? (
        <Text style={{ color: "#666", marginTop: 6 }}>
          {filter === "ABNORMAL"
            ? "No HIGH/LOW items found."
            : "No highlights found."}
        </Text>
      ) : (
        filteredHighlights.map((item: any) => {
          const key = `${item?.name ?? "Unknown"}|${item?.ref ?? ""}`;
          const isOpen = expandedKey === key;
          const flag = item?.flag ?? "UNKNOWN";

          return (
            <Pressable
              key={key}
              onPress={() => setExpandedKey(isOpen ? null : key)}
              style={{
                padding: 16,
                marginTop: 12,
                borderRadius: 18,
                backgroundColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700" }}>{item?.name ?? "Unknown"}</Text>

                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor:
                      flag === "HIGH"
                        ? "#FEE2E2"
                        : flag === "LOW"
                        ? "#FEF3C7"
                        : "#E6F4EA",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color:
                        flag === "HIGH"
                          ? "#B91C1C"
                          : flag === "LOW"
                          ? "#92400E"
                          : "#166534",
                    }}
                  >
                    {flag}
                  </Text>
                </View>
              </View>

              <Text style={{ marginTop: 6 }}>
                {item?.value ?? "?"} {item?.unit ?? ""}
              </Text>

              <Text style={{ marginTop: 2, color: "#555" }}>
                Reference: {item?.ref ?? "—"}
              </Text>

              {isOpen && !!item?.plainExplanation && (
                <Text style={{ marginTop: 10, fontStyle: "italic", color: "#444" }}>
                  {item.plainExplanation}
                </Text>
              )}

              <Text style={{ marginTop: 10, color: "#666" }}>
                {isOpen ? "Tap to hide details" : "Tap to show details"}
              </Text>
            </Pressable>
          );
        })
      )}

      {/* Not medical advice + Questions (AFTER analysis) */}
      {(disclaimer || questions) && (
        <View style={{ marginTop: 14, gap: 12 }}>
          {!!disclaimer && (
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
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 21,
                  color: iosTheme.textSecondary,
                }}
              >
                {disclaimer}
              </Text>
            </View>
          )}

          {!!questions && (
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
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 22,
                  color: iosTheme.textSecondary,
                }}
              >
                {questions}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  ) : result ? (
    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 10 }}>
      Got result, but no analysis field in response.
    </Text>
  ) : null}
</View>
 </View>
      </ScrollView>
    </View>
  );
}