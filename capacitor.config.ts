import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.qinghe.aichatsandbox",
  appName: "微聊",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    backgroundColor: "#000000"
  }
};

export default config;
