import * as SecureStore from "expo-secure-store";
import { v4 as uuidv4 } from "uuid";

const KEY = "medexplain_install_id";

export async function getInstallId(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEY);

  if (!id) {
    id = uuidv4();
    await SecureStore.setItemAsync(KEY, id);
  }

  return id;
}