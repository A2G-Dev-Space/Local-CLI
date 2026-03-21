/**
 * BrowserScreen - WebView 기반 브라우저 화면
 *
 * LLM이 browser_* 도구로 제어할 수 있는 내장 브라우저.
 * CDP/Playwright를 대체하여 안드로이드에서 브라우저 자동화 수행.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import {
  browserCommandQueue,
  browserStateManager,
  BROWSER_INJECTION_SCRIPTS,
} from '../../tools/browser/browser-client';
import type { BrowserCommand, AndroidToolResult } from '../../tools/types';

interface BrowserScreenProps {
  onBack: () => void;
  initialUrl?: string;
}

export default function BrowserScreen({ onBack, initialUrl }: BrowserScreenProps) {
  const { c } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [url, setUrl] = useState(initialUrl || '');
  const [inputUrl, setInputUrl] = useState(initialUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const pendingScriptCallbacks = useRef<Map<string, (result: string) => void>>(new Map());

  // Handle commands from the tool system
  useEffect(() => {
    const unsubscribe = browserCommandQueue.onCommand(async (command: BrowserCommand) => {
      try {
        const result = await handleBrowserCommand(command);
        command.resolve(result);
      } catch (error) {
        command.resolve({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'Browser command failed',
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const injectScript = useCallback((script: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!webViewRef.current) {
        reject(new Error('WebView not available'));
        return;
      }

      const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Wrap the script to send result back via postMessage
      const wrappedScript = `
        (async function() {
          try {
            const __result = await (async function() { return ${script} })();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: '__script_result',
              callbackId: '${callbackId}',
              result: typeof __result === 'string' ? __result : JSON.stringify(__result),
            }));
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: '__script_result',
              callbackId: '${callbackId}',
              result: JSON.stringify({ success: false, error: e.message }),
            }));
          }
        })();
        true;
      `;

      pendingScriptCallbacks.current.set(callbackId, resolve);

      // Timeout after 15 seconds
      setTimeout(() => {
        if (pendingScriptCallbacks.current.has(callbackId)) {
          pendingScriptCallbacks.current.delete(callbackId);
          resolve(JSON.stringify({ success: false, error: 'Script execution timed out' }));
        }
      }, 15000);

      webViewRef.current.injectJavaScript(wrappedScript);
    });
  }, []);

  const handleBrowserCommand = useCallback(async (command: BrowserCommand): Promise<AndroidToolResult> => {
    const { type, payload } = command;
    setStatusText(`Executing: ${type}`);

    switch (type) {
      case 'navigate': {
        let targetUrl = String(payload.url);
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
        setUrl(targetUrl);
        setInputUrl(targetUrl);
        return { success: true, output: `Navigating to: ${targetUrl}` };
      }

      case 'click': {
        const script = payload.selector
          ? BROWSER_INJECTION_SCRIPTS.clickElement(String(payload.selector))
          : BROWSER_INJECTION_SCRIPTS.clickByText(String(payload.text));
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'fill': {
        const script = BROWSER_INJECTION_SCRIPTS.fillInput(
          String(payload.selector),
          String(payload.value),
        );
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'get_text': {
        const script = BROWSER_INJECTION_SCRIPTS.getText(
          payload.selector ? String(payload.selector) : undefined,
        );
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'get_html': {
        const script = BROWSER_INJECTION_SCRIPTS.getHtml(
          payload.selector ? String(payload.selector) : undefined,
        );
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'execute_script': {
        const script = BROWSER_INJECTION_SCRIPTS.executeScript(String(payload.script));
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'press_key': {
        const script = BROWSER_INJECTION_SCRIPTS.pressKey(String(payload.key));
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'wait': {
        if (payload.selector) {
          const script = BROWSER_INJECTION_SCRIPTS.waitForElement(
            String(payload.selector),
            Number(payload.timeout || 5000),
          );
          const result = await injectScript(script);
          try { return JSON.parse(result); } catch { return { success: true, output: result }; }
        }
        await new Promise(resolve => setTimeout(resolve, Number(payload.timeout || 1000)));
        return { success: true, output: `Waited ${payload.timeout || 1000}ms` };
      }

      case 'get_console': {
        const result = await injectScript(BROWSER_INJECTION_SCRIPTS.getConsoleLogs);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'get_network': {
        const result = await injectScript(BROWSER_INJECTION_SCRIPTS.getNetworkRequests);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'get_page_info': {
        const result = await injectScript(BROWSER_INJECTION_SCRIPTS.getPageInfo);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'scroll': {
        const script = payload.relative
          ? BROWSER_INJECTION_SCRIPTS.scrollBy(Number(payload.x), Number(payload.y))
          : BROWSER_INJECTION_SCRIPTS.scroll(Number(payload.x), Number(payload.y));
        const result = await injectScript(script);
        try { return JSON.parse(result); } catch { return { success: true, output: result }; }
      }

      case 'go_back': {
        webViewRef.current?.goBack();
        return { success: true, output: 'Navigated back' };
      }

      case 'go_forward': {
        webViewRef.current?.goForward();
        return { success: true, output: 'Navigated forward' };
      }

      case 'refresh': {
        webViewRef.current?.reload();
        return { success: true, output: 'Page refreshed' };
      }

      case 'screenshot': {
        // WebView screenshot via ViewShot (limited in RN, return page info instead)
        const result = await injectScript(BROWSER_INJECTION_SCRIPTS.getPageInfo);
        try {
          const parsed = JSON.parse(result);
          return {
            success: true,
            output: `Screenshot captured (page info): ${parsed.output || result}`,
            data: parsed.data,
          };
        } catch {
          return { success: true, output: `Current page: ${url}, Title: ${title}` };
        }
      }

      default:
        return { success: false, output: '', error: `Unknown command: ${type}` };
    }
  }, [url, title, injectScript]);

  // Handle messages from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === '__script_result' && data.callbackId) {
        const callback = pendingScriptCallbacks.current.get(data.callbackId);
        if (callback) {
          pendingScriptCallbacks.current.delete(data.callbackId);
          callback(data.result);
        }
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, []);

  const navigateToUrl = useCallback(() => {
    let targetUrl = inputUrl.trim();
    if (!targetUrl) return;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    setUrl(targetUrl);
    setInputUrl(targetUrl);
  }, [inputUrl]);

  // Injected JS that runs on every page load
  const injectedJS = `
    ${BROWSER_INJECTION_SCRIPTS.consoleInterceptor}
    ${BROWSER_INJECTION_SCRIPTS.networkInterceptor}
    true;
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.secondaryBackground, borderBottomColor: c.separator }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.tint} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="globe-outline" size={16} color={c.secondaryLabel} />
          <Text style={[styles.headerTitleText, { color: c.label }]} numberOfLines={1}>
            {title || 'Browser'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.headerBtn}>
          <Ionicons name="refresh" size={20} color={c.tint} />
        </TouchableOpacity>
      </View>

      {/* URL Bar */}
      <View style={[styles.urlBar, { backgroundColor: c.secondaryBackground, borderBottomColor: c.separator }]}>
        <TouchableOpacity
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={20} color={canGoBack ? c.tint : c.secondaryLabel} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoForward ? c.tint : c.secondaryLabel} />
        </TouchableOpacity>

        <View style={[styles.urlInputContainer, { backgroundColor: c.searchBar }]}>
          {isLoading && <ActivityIndicator size="small" color={c.tint} style={styles.loadingIndicator} />}
          <TextInput
            style={[styles.urlInput, { color: c.label }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={navigateToUrl}
            placeholder="Enter URL or localhost:port"
            placeholderTextColor={c.secondaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
        </View>

        <TouchableOpacity onPress={navigateToUrl} style={styles.navBtn}>
          <Ionicons name="arrow-forward" size={20} color={c.tint} />
        </TouchableOpacity>
      </View>

      {/* WebView */}
      {url ? (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={injectedJS}
          onMessage={handleMessage}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
            setTitle(navState.title || '');
            if (navState.url) setInputUrl(navState.url);
            browserStateManager.update({
              url: navState.url,
              title: navState.title,
              isLoading: navState.loading,
              canGoBack: navState.canGoBack,
              canGoForward: navState.canGoForward,
            });
          }}
          onLoadStart={() => {
            setIsLoading(true);
            setStatusText('Loading...');
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            setStatusText('Ready');
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setStatusText(`Error: ${nativeEvent.description}`);
            setIsLoading(false);
          }}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsBackForwardNavigationGestures
        />
      ) : (
        <View style={[styles.emptyState, { backgroundColor: c.background }]}>
          <Ionicons name="globe-outline" size={64} color={c.secondaryLabel} />
          <Text style={[styles.emptyTitle, { color: c.label }]}>Built-in Browser</Text>
          <Text style={[styles.emptyDesc, { color: c.secondaryLabel }]}>
            Enter a URL above or use browser tools from chat.{'\n'}
            For localhost testing, use localhost:PORT or 10.0.2.2:PORT
          </Text>

          <View style={styles.quickLinks}>
            {[
              { label: 'localhost:3000', url: 'http://10.0.2.2:3000' },
              { label: 'localhost:8080', url: 'http://10.0.2.2:8080' },
              { label: 'localhost:5173', url: 'http://10.0.2.2:5173' },
            ].map(link => (
              <TouchableOpacity
                key={link.url}
                style={[styles.quickLink, { backgroundColor: c.secondaryBackground, borderColor: c.separator }]}
                onPress={() => {
                  setUrl(link.url);
                  setInputUrl(link.url);
                }}
              >
                <Text style={[styles.quickLinkText, { color: c.tint }]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: c.secondaryBackground, borderTopColor: c.separator }]}>
        <Text style={[styles.statusText, { color: c.secondaryLabel }]} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  headerTitleText: { fontSize: 15, fontWeight: '600', flex: 1 },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  navBtn: { padding: 6 },
  urlInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
  },
  loadingIndicator: { marginRight: 6 },
  urlInput: { flex: 1, fontSize: 14, height: 36, padding: 0 },
  webview: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
    justifyContent: 'center',
  },
  quickLink: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickLinkText: { fontSize: 13, fontWeight: '600' },
  statusBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusText: { fontSize: 11 },
});
