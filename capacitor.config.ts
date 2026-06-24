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
    backgroundColor: "#f7f7f7"
  }
};

export default config;
