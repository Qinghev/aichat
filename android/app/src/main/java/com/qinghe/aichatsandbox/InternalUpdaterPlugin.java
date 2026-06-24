package com.qinghe.aichatsandbox;

import android.content.Context;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "InternalUpdater")
public class InternalUpdaterPlugin extends Plugin {
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;

            JSObject result = new JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName);
            result.put("canRequestPackageInstalls", canRequestPackageInstalls());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to read app version.", exception);
        }
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + context.getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to open install permission settings.", exception);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "weichat-update.apk");
        String sha256 = call.getString("sha256", "");

        if (url == null || url.trim().isEmpty()) {
            call.reject("Update APK url is required.");
            return;
        }

        if (!canRequestPackageInstalls()) {
            call.reject("INSTALL_PERMISSION_REQUIRED", "Install unknown apps permission is required.");
            return;
        }

        new Thread(() -> {
            try {
                File apkFile = downloadApk(url, fileName, sha256);
                getActivity().runOnUiThread(() -> installApk(apkFile, call));
            } catch (Exception exception) {
                getActivity().runOnUiThread(() -> call.reject("Unable to download update APK.", exception));
            }
        }).start();
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private File downloadApk(String urlString, String fileName, String expectedSha256) throws Exception {
        File updateDir = new File(getContext().getCacheDir(), "updates");
        if (!updateDir.exists() && !updateDir.mkdirs()) {
            throw new IllegalStateException("Unable to create update cache directory.");
        }

        String safeFileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeFileName.endsWith(".apk")) safeFileName = safeFileName + ".apk";
        File apkFile = new File(updateDir, safeFileName);

        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(120000);
        connection.setInstanceFollowRedirects(true);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException("Update server returned HTTP " + status);
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apkFile)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
                output.write(buffer, 0, count);
            }
        } finally {
            connection.disconnect();
        }

        if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
            String actualSha256 = bytesToHex(digest.digest());
            String normalizedExpected = expectedSha256.replaceAll("\\s", "").toLowerCase(Locale.US);
            if (!actualSha256.equals(normalizedExpected)) {
                //noinspection ResultOfMethodCallIgnored
                apkFile.delete();
                throw new SecurityException("Update APK SHA-256 mismatch.");
            }
        }

        return apkFile;
    }

    private void installApk(File apkFile, PluginCall call) {
        try {
            Context context = getContext();
            Uri uri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setDataAndType(uri, APK_MIME_TYPE);
            intent.setClipData(ClipData.newRawUri("update", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            intent.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, context.getPackageName());
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("path", apkFile.getAbsolutePath());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to open package installer.", exception);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            builder.append(String.format(Locale.US, "%02x", item));
        }
        return builder.toString();
    }
}
