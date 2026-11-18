import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ApiClient, getMapServerOrigin } from '../services/apiClient';
import { createNativeGISDocument, scriptJSON } from '../utils/nativeGISDocument';
import { getColorForIndex } from '../utils/gisColorScale';
import { GISMapAttribution, GISMapLegend, GISMapToolbar } from './GISMapControls';
import { hasRasterForIndex, InteractiveGISMapProps } from './gisMapTypes';
export type { InteractiveGISMapProps } from './gisMapTypes';
export { PALETTE_VEG, PALETTE_WATER, getColorForIndex, getClassIndex, FALLBACK_COLOR } from '../utils/gisColorScale';
export const getIndexColorFromPalette = getColorForIndex;

export const InteractiveGISMap: React.FC<InteractiveGISMapProps> = (props) => {
  const { language = 'en', activeIndex, overlayVisible = true, mapHeight = 440 } = props;
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [clipMode, setClipMode] = useState<'polygon' | 'bbox'>(props.clipMode || 'polygon');
  const [showBbox, setShowBbox] = useState<boolean>(props.showBbox !== false);

  const origin = getMapServerOrigin();
  const source = useMemo(() => ({ html: createNativeGISDocument(origin), baseUrl: origin + '/' }), [origin]);
  const payload = useMemo(
    () => ({
      ...props,
      basemap,
      clipMode,
      showBbox,
      color: getColorForIndex(activeIndex, props.indexValue),
      token: props.authorizationToken || ApiClient.getToken(),
    }),
    [props, basemap, clipMode, showBbox]
  );

  useEffect(() => {
    if (ready) {
      webview.current?.injectJavaScript(`window.updateFarmMap && window.updateFarmMap(${scriptJSON(payload)});true;`);
    }
  }, [ready, payload]);

  const command = (action: string) =>
    webview.current?.injectJavaScript(`window.controlFarmMap && window.controlFarmMap(${scriptJSON(action)});true;`);

  return (
    <View style={styles.wrapper}>
      <View style={{ height: mapHeight }}>
        <WebView
          key={retry}
          ref={webview}
          source={source}
          originWhitelist={['*']}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled={false}
          scrollEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          onShouldStartLoadWithRequest={(request) =>
            request.url === 'about:blank' || request.url === origin || request.url.startsWith(origin + '/')
          }
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'map-ready') {
                setReady(true);
                setFailed(false);
              }
              if (message.type === 'map-error') {
                setFailed(true);
                setReady(false);
              }
              if (message.type === 'pixel-inspect' && props.onInspectPixel) {
                props.onInspectPixel(message);
              }
            } catch {
              setFailed(true);
            }
          }}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
          onHttpError={() => {
            setFailed(true);
            setReady(false);
          }}
        />
        {!ready && !failed && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color="#285d3d" />
            <Text style={styles.note}>{language === 'mr' ? 'नकाशा उघडत आहे…' : 'Opening farm map…'}</Text>
          </View>
        )}
        {failed && (
          <View style={styles.loading}>
            <Text style={styles.note}>
              {language === 'mr'
                ? 'नकाशा उघडला नाही. इंटरनेट व अॅप सर्व्हर तपासा.'
                : 'Map unavailable. Check your connection and app server.'}
            </Text>
            <TouchableOpacity
              style={styles.retry}
              onPress={() => {
                setReady(false);
                setFailed(false);
                setRetry((value) => value + 1);
              }}
            >
              <Text style={styles.note}>{language === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Try again'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#0f172a',
  },
  note: {
    fontSize: 14,
    lineHeight: 21,
    color: '#94a3b8',
    textAlign: 'center',
  },
  retry: {
    padding: 14,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
});
