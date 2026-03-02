import React, { useState } from "react";
import { View, Text, Button, ScrollView, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";

// IMPORTANT: this file is at app/(tabs)/index.tsx
// so we need to go up TWO levels to reach src/api
import { analyzePdfBase64, healthCheck } from "../src/api/medexplain";

export default function HomeScreen() {
  const router = useRouter();

  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function onCheckServer() {
    try {
      setStatus("Checking server...");
      const res = await healthCheck();
      setStatus(`Server OK: ${res.status}`);
    } catch (e: any) {
      setStatus(`Server error: ${e?.message ?? String(e)}`);
    }
  }

  async function onPickAndAnalyzePdf() {
    try {
      setResult(null);
      setStatus("");
      setLoading(true);

      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled) {
        setStatus("Canceled");
        return;
      }

      const file = picked.assets?.[0];
      if (!file?.uri) {
        setStatus("No file selected");
        return;
      }

      setStatus(`Selected: ${file.name ?? "upload.pdf"}`);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setStatus("Analyzing...");
      // (optional) pass filename if your API supports it:
      // const apiResult = await analyzePdfBase64(base64, file.name ?? "upload.pdf");
      const apiResult = await analyzePdfBase64(base64);

      setResult(apiResult);
      setStatus("Done ✅");
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>MedExplain</Text>

      <Button title="Check server" onPress={onCheckServer} />
      <Button title="Pick PDF and analyze" onPress={onPickAndAnalyzePdf} />

      {/* Cast for strict typed routes setups */}
      <Button title="History" onPress={() => router.push("/history" as any)} />

      {!!status && <Text style={{ marginTop: 8 }}>{status}</Text>}
      {loading && <ActivityIndicator size="large" style={{ marginTop: 10 }} />}

      <ScrollView style={{ marginTop: 16 }}>
        {result ? (
          <Text selectable style={{ fontSize: 12, lineHeight: 18 }}>
            {JSON.stringify(result, null, 2)}
          </Text>
        ) : (
          <Text style={{ color: "#666" }}>Result will appear here…</Text>
        )}
      </ScrollView>
    </View>
  );
}
