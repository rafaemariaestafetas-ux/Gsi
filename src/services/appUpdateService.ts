import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { App } from '@capacitor/app';
import { APP_VERSION } from '../version';

// Repository details
export const GITHUB_OWNER = 'rafaemariaestafetas-ux';
export const GITHUB_REPO = 'Gsi';
export const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_WEB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Current app version fallback synced from src/version.ts
export const CURRENT_APP_VERSION = APP_VERSION;

export interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  apkAsset: GitHubReleaseAsset | null;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  isMandatory?: boolean;
}

/**
 * Extrai e normaliza partes numéricas e de pré-release de qualquer tag do GitHub.
 * Exemplos: 'v1.0.7' -> [1, 0, 7], '1.0.7-beta' -> [1, 0, 7], 'v2.1' -> [2, 1, 0]
 */
export function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0];
  
  // Limpa prefixos 'v', espaços e partes adicionais como '-build' ou '-beta'
  const cleaned = versionStr
    .trim()
    .replace(/^v/i, '')
    .split('-')[0] // remove sufixos pré-release para comparação numérica
    .replace(/[^0-9.]/g, '');
  
  if (!cleaned) return [0, 0, 0];
  const parts = cleaned.split('.').map(num => parseInt(num, 10) || 0);
  
  // Garante pelo menos 3 dígitos: [major, minor, patch]
  while (parts.length < 3) {
    parts.push(0);
  }
  
  return parts;
}

/**
 * Compara a tag/versão da release do GitHub com a versão instalada no dispositivo.
 * Retorna true se a tag da release for estritamente mais alta que a instalada.
 * Ex: 'v1.0.7' > '1.0.0' => true
 *     'v1.0.0' > '1.0.0' => false
 *     'v1.1.0' > '1.0.9' => true
 */
export function isNewerVersion(latestTagOrVersion: string, currentVersion: string): boolean {
  if (!latestTagOrVersion) return false;
  if (!currentVersion) return true;

  const latestParts = parseVersion(latestTagOrVersion);
  const currentParts = parseVersion(currentVersion);
  
  const maxLength = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < maxLength; i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Obtém a versão instalada no dispositivo utilizando o plugin App.getInfo() do Capacitor,
 * com fallback para APP_VERSION definido no código.
 */
export async function getAppVersion(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const appInfo = await App.getInfo();
      if (appInfo?.version && appInfo.version !== '0.0.0') {
        return appInfo.version;
      }
    }
  } catch (err) {
    console.warn('[AppUpdate] Failed to get app version from Capacitor App.getInfo:', err);
  }
  return CURRENT_APP_VERSION;
}

/**
 * Checks GitHub Releases API for the latest version and compares with current
 */
export async function checkForAppUpdate(): Promise<ReleaseInfo | null> {
  try {
    const currentVersion = await getAppVersion();
    
    // Fetch latest release with timeout and headers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[AppUpdate] No published releases found on GitHub repo yet.');
      } else {
        console.warn(`[AppUpdate] GitHub Releases API returned status ${response.status}`);
      }
      return null;
    }

    const releaseData = await response.json();
    const tagName = (releaseData.tag_name || releaseData.name || '').trim();
    const latestVersion = tagName.replace(/^v/i, '');

    // Look for an .apk asset in the release
    let apkAsset: GitHubReleaseAsset | null = null;
    if (Array.isArray(releaseData.assets)) {
      apkAsset = releaseData.assets.find((asset: any) => 
        asset.name && asset.name.toLowerCase().endsWith('.apk')
      ) || null;
    }

    // Compara a tag oficial da release com a versão instalada
    const hasUpdate = isNewerVersion(tagName || latestVersion, currentVersion);

    // Detecta se a release foi marcada como obrigatória no changelog
    const bodyLower = (releaseData.body || '').toLowerCase();
    const isMandatory = bodyLower.includes('[obrigatori') || 
                        bodyLower.includes('[mandatory]') || 
                        bodyLower.includes('[critico]') || 
                        bodyLower.includes('[crítico]');

    return {
      tag_name: tagName,
      name: releaseData.name || tagName,
      body: releaseData.body || '',
      published_at: releaseData.published_at || '',
      html_url: releaseData.html_url || GITHUB_RELEASES_WEB_URL,
      apkAsset,
      hasUpdate,
      currentVersion,
      latestVersion,
      isMandatory,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[AppUpdate] Request to GitHub API timed out.');
    } else {
      console.warn('[AppUpdate] Error checking for app updates:', error?.message || error);
    }
    return null;
  }
}

/**
 * Downloads the APK and invokes Android system installer
 */
export async function downloadAndInstallApk(
  downloadUrl: string,
  fileName: string = 'GSI_PRO_update.apk',
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. If running in browser (non-native Android), trigger normal browser download
    if (!Capacitor.isNativePlatform()) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true };
    }

    // 2. In Native Android: Download via fetch with progress tracking
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Falha no download da release (HTTP ${response.status})`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
    
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    if (response.body) {
      reader = response.body.getReader();
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (onProgress && totalBytes > 0) {
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
            onProgress(percent, receivedBytes, totalBytes);
          } else if (onProgress) {
            onProgress(50, receivedBytes, 0);
          }
        }
      }
    } else {
      // Fallback if stream body is unavailable
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
      receivedBytes = arrayBuffer.byteLength;
      if (onProgress) onProgress(100, receivedBytes, receivedBytes);
    }

    // Combine chunks into single ArrayBuffer
    const fullBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64 for Capacitor Filesystem write
    const base64Data = uint8ArrayToBase64(fullBuffer);

    // Save to Cache directory so other apps (PackageInstaller) can access it via FileProvider
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const writeResult = await Filesystem.writeFile({
      path: sanitizedFileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    const fileUri = writeResult.uri;

    // 3. Open the downloaded APK file with Android Package Installer
    await FileOpener.openFile({
      path: fileUri,
      mimeType: 'application/vnd.android.package-archive',
    });

    return { success: true };
  } catch (err: any) {
    console.error('[AppUpdate] Erro ao descarregar ou instalar APK:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao descarregar ou abrir o ficheiro APK.',
    };
  }
}

/**
 * Fast helper to convert Uint8Array chunks into base64 without stack overflow
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}
