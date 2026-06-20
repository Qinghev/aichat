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
    backgroundColor: "#07c160"
  }
};

export default config;
