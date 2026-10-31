import { FarmPage } from '../components/FarmPage';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { AppText as Text, Icon, Card, ui } from '../components/ui';
import { ScanHistory } from '../components/ScanHistory';
import * as ImagePicker from 'expo-image-picker';
import { ApiClient } from '../services/apiClient';
import { DiseaseDetectionResult, FarmerProfile, WeatherData, FieldContext, HistoryData } from '../types';
import { FieldConnections } from '../components/FieldConnections';
import { CropWatchCard } from '../components/CropWatchCard';
import { colors } from '../theme/colors';

interface Props {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onWeather?: () => void;
}

export const PestDetectionScreen: React.FC<Props> = ({ farmer, language, onWeather }) => {
  const mr = language === 'mr';
  const [loading, setLoading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{file: any; uri: string} | null>(null);
  const [result, setResult] = useState<DiseaseDetectionResult | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const scanInFlight = useRef(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [context, setContext] = useState<FieldContext | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [saveHistory, setSaveHistory] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [pesticidesModal, setPesticidesModal] = useState(false);

  const fileInputRef = useRef<any>(null);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    setPendingPhoto(null);
    setShowOverlay(false);
    scanInFlight.current = false;
    setWeather(null);
    setContext(null);
    setLoading(false);
    setResult(null);
    setPreviewUri(null);
    setError('');
    if (farmer.farm_id) {
      ApiClient.getDashboard(farmer.farm_id)
        .then((value) => {
          if (active) {
            setWeather(value.weather);
            setContext(value.field_context);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      generation.current++;
    };
  }, [farmer.farm_id]);

  useEffect(() => {
    let active = true;
    setHistory(null);
    if (farmer.farm_id) {
      ApiClient.getScanHistory(farmer.farm_id)
        .then((value) => {
          if (active) setHistory(value);
        })
        .catch(() => {
          if (active) setHistory({ available: false, items: [] });
        });
    }
    return () => {
      active = false;
    };
  }, [farmer.farm_id, result?.record_id]);

  useEffect(() => () => {
    if (Platform.OS === 'web' && previewUri?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUri);
    }
  }, [previewUri]);

  const scan = async (photo: {file: any; uri: string}) => {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    const form = new FormData();
    form.append('file', photo.file);
    const uri = photo.uri;
    if (farmer.farm_id) {
      form.append('farm_id', farmer.farm_id);
      form.append('save_history', saveHistory ? 'true' : 'false');
    }
    setShowOverlay(false);
    const request = ++generation.current;
    setPreviewUri(uri);
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const value = await ApiClient.detectDisease(form);
      if (request === generation.current) setResult(value);
    } catch (reason) {
      if (request === generation.current) {
        setError(
          mr
            ? 'फोटो तपासता आला नाही. स्पष्ट फोटो निवडून पुन्हा प्रयत्न करा.'
            : reason instanceof Error && reason.name === 'AbortError'
              ? 'Analysis timed out. The server may still be starting. Retry this photo shortly.'
              : reason instanceof TypeError
                ? 'Cannot reach the scan server. Check your connection, then retry this photo.'
                : reason instanceof Error ? reason.message : 'Unable to analyse this photo. Please retry.'
        );
      }
    } finally {
      if (request === generation.current) { setLoading(false); scanInFlight.current = false; }
    }
  };

  const nativePhoto = async (camera: boolean) => {
    const selectionGeneration = generation.current;
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(
            mr ? 'फोटो घेण्यासाठी कॅमेरा परवानगी आवश्यक आहे.' : 'Camera permission is needed to take a photo.'
          );
          return;
        }
      }
      const photo = camera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.85,
            cameraType:
              cameraFacing === 'front'
                ? ImagePicker.CameraType.front
                : ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });

      if (selectionGeneration !== generation.current || photo.canceled || !photo.assets?.[0]) return;
      const asset = photo.assets[0];
      if ((asset.fileSize || 0) > 8 * 1024 * 1024) {
        setError(mr ? '८ MB पेक्षा लहान फोटो निवडा.' : 'Choose an image smaller than 8 MB.');
        return;
      }
      setPendingPhoto({file: {
        uri: asset.uri, name: asset.fileName || 'leaf.jpg', type: asset.mimeType || 'image/jpeg',
      }, uri: asset.uri});
      setShowOverlay(false);
      setPreviewUri(asset.uri);
      setResult(null);
      setError('');
    } catch (reason) {
      setError(mr ? 'फोटो उघडता आला नाही.' : 'Unable to open camera or image library.');
    }
  };

  const choose = (camera: boolean) => {
    if (Platform.OS !== 'web') {
      void nativePhoto(camera);
      return;
    }
    if (camera) fileInputRef.current?.setAttribute('capture', 'environment');
    else fileInputRef.current?.removeAttribute('capture');
    fileInputRef.current?.click();
  };

  const selected = async (event: any) => {
    const file = event.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(mr ? '८ MB पेक्षा लहान फोटो निवडा.' : 'Choose an image smaller than 8 MB.');
      return;
    }

    const uri = URL.createObjectURL(file);
    setPendingPhoto({file, uri});
    setShowOverlay(false);
    setPreviewUri(uri);
    setResult(null);
    setError('');
  };

  const detected = result?.status === 'disease_detected' && result.disease_details != null;
  const details = detected ? result?.disease_details : null;
  const confidencePct = result ? Math.round(result.confidence_score * 100) : 0;

  const diseaseTitle = detected
    ? (mr ? result.marathi_name : result.detected_disease)
    : (mr ? 'समर्थित रोग आढळला नाही' : 'No supported disease identified');

  const pathogenName = details?.pathogen || (mr ? 'याचा अर्थ पीक निरोगी आहे असा नाही' : 'This does not establish a healthy crop');

  return (
    <FarmPage page="scan" style={styles.container} contentContainerStyle={styles.content}>
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={selected}
        />
      )}

      {/* Screen Title & Subtitle */}
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{mr ? 'पीक तपासणी व रोगनिदान' : 'AI Crop Care & Pest Scan'}</Text>
        <Text style={styles.subtitle}>
          {mr
            ? 'पानाचा फोटो काढून किंवा निवडून मॉडेलद्वारे तपासणी करा'
            : 'Aim camera at leaf lesion or select a photo for AI assessment'}
        </Text>
      </View>

      {/* Camera / Scanner Viewport matching Stitch ai_pest_detection_unified_shell */}
      <View style={styles.viewport}>
        {/* Viewfinder Image or Placeholder */}
        {previewUri ? (
          <Image
            source={{ uri: showOverlay && result?.overlay_data_url ? result.overlay_data_url : previewUri }}
            style={styles.viewfinderImg}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.viewfinderPlaceholder}>
            <Image
              source={require('../assets/farmer-illustration.png')}
              style={styles.placeholderBgImg}
              resizeMode="cover"
            />
            <View style={styles.placeholderOverlay} />
          </View>
        )}

        {/* Top Floating Controls */}
        <View style={styles.topControlsRow} pointerEvents="box-none">
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => Alert.alert(mr ? 'फ्लॅश' : 'Flash', mr ? 'फोटो घेताना कॅमेऱ्यातील फ्लॅश नियंत्रण वापरा.' : 'Use the flash control in the camera when taking your photo.')}
            style={[styles.glassCircleBtn, torchActive && styles.glassCircleBtnActive]}
            activeOpacity={0.8}
          >
            <Icon
              name={torchActive ? 'flash-on' : 'flash-off'}
              size={19}
              color={torchActive ? '#000000' : '#ffffff'}
            />
          </TouchableOpacity>

          <View style={styles.aimPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.aimText}>
              {mr ? 'पानावरील डागावर लक्ष केंद्रित करा' : 'Aim at leaf lesion'}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                'AI Pest Guide',
                'Ensure sufficient sunlight, hold camera 10-15 cm from leaf lesion, and avoid blurred motion.'
              )
            }
            style={styles.glassCircleBtn}
            activeOpacity={0.8}
          >
            <Icon name="help-outline" size={19} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Reticle / Target Box with 4 Corner Brackets */}
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={styles.reticleBox}>
            {/* 4 Corner Brackets */}
            <View style={[styles.cornerBracket, styles.topLeftBracket]} />
            <View style={[styles.cornerBracket, styles.topRightBracket]} />
            <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
            <View style={[styles.cornerBracket, styles.bottomRightBracket]} />

            {/* Target Circle with Center Dot */}
            <View style={styles.targetCenterCircle}>
              <View style={styles.targetCenterDot} />
            </View>
          </View>
        </View>

        {/* Floating Live Detection HUD Tag matching Stitch */}
        {(result != null) && (
          <View style={styles.hudOverlay} pointerEvents="box-none">
            <View style={styles.hudCard}>
              <View style={styles.hudLeft}>
                <View style={styles.hudIconBox}>
                  <Icon name="bug-report" size={19} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.hudTitleRow}>
                    <Text style={styles.hudDiseaseTitle} numberOfLines={1}>
                      {diseaseTitle}
                    </Text>
                    {detected && <View style={styles.stagePill}>
                      <Text style={styles.stagePillText}>{result?.severity_level || '—'}</Text>
                    </View>}
                  </View>
                  <Text style={styles.hudPathogenText} numberOfLines={1}>
                    {pathogenName}{detected ? ` · ${confidencePct}%` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.hudRight}>
                <Text style={styles.hudConfidenceVal}>{detected ? `${confidencePct}%` : (mr ? 'तपासा' : 'Review')}</Text>
                <Text style={styles.hudConfidenceLabel}>{detected ? (mr ? 'मॉडेल गुण' : 'Model score') : (mr ? 'मर्यादित मॉडेल' : 'Limited scope')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Camera Controls Bar matching Stitch */}
        <View style={styles.bottomControlsBar} pointerEvents="box-none">
          {/* Gallery Button */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.controlPillBtn}
            disabled={loading}
            onPress={() => choose(false)}
            activeOpacity={0.8}
          >
            <View style={styles.controlIconWrap}>
              <Icon name="photo-library" size={22} color="#ffffff" />
            </View>
            <Text style={styles.controlLabel}>{mr ? 'गॅलरी' : 'Gallery'}</Text>
          </TouchableOpacity>

          {/* Large Center Shutter Scan Button */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            style={styles.shutterBtnWrap}
            disabled={loading}
            onPress={() => choose(true)}
            activeOpacity={0.85}
          >
            <View style={styles.shutterRing}>
              <View style={styles.shutterInnerCircle}>
                {loading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Icon name="photo-camera" size={26} color={colors.primary} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Rotate Camera Button */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.controlPillBtn}
            onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
            activeOpacity={0.8}
          >
            <View style={styles.controlIconWrap}>
              <Icon name="flip-camera-ios" size={22} color="#ffffff" />
            </View>
            <Text style={styles.controlLabel}>{mr ? 'फिरवा' : 'Rotate'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!result?.overlay_data_url && <TouchableOpacity accessibilityRole="button"
        style={styles.pesticidesBtn} onPress={() => setShowOverlay(value => !value)}>
        <Text style={styles.pesticidesBtnText}>{showOverlay
          ? (mr ? 'मूळ फोटो पहा' : 'Show original photo')
          : (mr ? 'मॉडेलने दर्शवलेले क्षेत्र पहा' : 'Show model overlay')}</Text>
      </TouchableOpacity>}
      {pendingPhoto && !loading && (
        <TouchableOpacity accessibilityRole="button" style={styles.pesticidesBtn}
          onPress={() => { void scan(pendingPhoto); }}>
          <Icon name="search" size={20} color="#ffffff" />
          <Text style={styles.pesticidesBtnText}>{error ? (mr ? 'पुन्हा प्रयत्न करा' : 'Retry this photo') : (mr ? 'या फोटोचे विश्लेषण करा' : 'Analyze this photo')}</Text>
        </TouchableOpacity>
      )}
      {loading && <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
        {mr ? 'फोटो तपासत आहोत. सर्व्हर सुरू होण्यास वेळ लागू शकतो.' : 'Analyzing your photo. A cold server may take longer to respond.'}
      </Text>}
      {/* Error Notice */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Icon name="error-outline" size={18} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Immediate Action Advice Card matching Stitch */}
      <View style={styles.adviceCard}>
        <View style={styles.adviceHeader}>
          <View style={styles.adviceHeaderLeft}>
            <View style={styles.medIconBox}>
              <Icon name="medical-services" size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.adviceTitle}>
                {mr ? 'पीक तपासणी मार्गदर्शन' : 'Crop Check Guidance'}
              </Text>
              <Text style={styles.adviceSub}>
                {farmer.name}
              </Text>
            </View>
          </View>
          <View style={styles.actionNeededPill}>
            <Text style={styles.actionNeededText}>
              {detected ? (mr ? 'पडताळा करा' : 'Verify finding') : (mr ? 'फोटो तपासणी' : 'Photo check')}
            </Text>
          </View>
        </View>

        {/* Quick Advice Box */}
        <View style={styles.quickAdviceBox}>
          <Icon name="verified" size={19} color="#059669" />
          <Text style={styles.quickAdviceText}>
            <Text style={styles.quickAdviceBold}>
              {mr ? 'त्वरित सल्ला: ' : 'Quick Advice: '}
            </Text>
            {details
              ? (mr ? details.prevention_mr : details.prevention)
              : mr
              ? 'स्पष्ट पानाचा फोटो निवडा. मॉडेल फक्त तपकिरी तांबेरा, मोझॅक आणि लाल कुज तपासते. रोग न आढळणे म्हणजे पीक निरोगी असल्याची खात्री नाही.'
              : 'Choose a clear leaf photo. The model checks Brown Rust, Mosaic and Red Rot only. No supported detection does not confirm a healthy crop.'}
          </Text>
        </View>

        {/* Action Buttons: View Pesticides & Consult Agronomist */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.pesticidesBtn}
            onPress={() => setPesticidesModal(true)}
            activeOpacity={0.85}
          >
            <Icon name="science" size={16} color="#ffffff" />
            <Text style={styles.pesticidesBtnText}>
              {mr ? 'तपशील पाहा' : 'View Guidance'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.agronomistBtn}
            onPress={() =>
              Alert.alert(
                mr ? 'कृषी तज्ज्ञ' : 'Agronomist review',
                mr ? 'फोटो व प्रत्यक्ष लक्षणे आपल्या स्थानिक KVK किंवा कृषी तज्ज्ञांना दाखवा.' : 'Show the photo and field symptoms to your local KVK or agronomist before selecting treatment.'
              )
            }
            activeOpacity={0.85}
          >
            <Icon name="call" size={16} color="#059669" />
            <Text style={styles.agronomistBtnText}>
              {mr ? 'तज्ज्ञांशी बोला' : 'Consult Agronomist'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {result && <View style={styles.quickAdviceBox}><Text style={styles.quickAdviceText}>{mr ? 'अंदाजित बाधित क्षेत्र' : 'Estimated affected image area'}: {result.affected_percentage.toFixed(1)}% · {result.history_note || (result.record_saved ? (mr ? 'जतन केले' : 'Saved') : (mr ? 'जतन केले नाही' : 'Not saved'))}</Text></View>}
      {/* Private History Toggle */}
      <View style={styles.historyToggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyToggleTitle}>
            {mr ? 'तपासणी खासगी इतिहासात जतन करा' : 'Save analysis to private history'}
          </Text>
          <Text style={styles.historyToggleSub}>
            {mr
              ? 'तुम्ही व अधिकृत प्रशासक नोंद पाहू शकता.'
              : 'You and authorized administrators can review saved results.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Save analysis to private history"
          value={saveHistory}
          onValueChange={setSaveHistory}
          trackColor={{ false: '#cbd5e1', true: '#86efac' }}
          thumbColor={saveHistory ? '#059669' : '#f8fafc'}
        />
      </View>

      {/* Recorded History */}
      {history && (
        <View style={styles.historyWrap}>
          <Text style={styles.historySectionTitle}>
            {mr ? 'नोंदवलेली पीक तपासणी' : 'Recorded Photo Checks'}
          </Text>
          <ScanHistory history={history} language={language} />
        </View>
      )}

      {/* Field Connections & Weather */}
      <FieldConnections context={result?.field_context || context} language={language} />
      {weather && <CropWatchCard data={weather} language={language} />}

      {/* Pesticides Modal */}
      <Modal visible={pesticidesModal} transparent animationType="slide" onRequestClose={() => setPesticidesModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mr ? 'तपासणी मार्गदर्शन' : 'Scan Guidance'}
              </Text>
              <TouchableOpacity onPress={() => setPesticidesModal(false)} style={{ padding: 4 }}>
                <Icon name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <View style={styles.productCard}>
                <Text style={styles.productName}>{diseaseTitle}</Text>
                <Text style={styles.productIng}>{details ? (mr ? details.chemical_control_mr : details.chemical_control) : (mr ? 'स्पष्ट फोटो आवश्यक. समर्थित वर्ग: तांबेरा, मोझॅक, लाल कुज.' : 'A clear photo is required. Supported classes: Brown Rust, Mosaic, Red Rot.')}</Text>
                <Text style={styles.productDose}>{mr ? 'औषध वापरण्यापूर्वी स्थानिक तज्ज्ञ व उत्पादनाचे लेबल तपासा.' : 'Confirm treatment with a local agronomist and the registered product label.'}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </FarmPage>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7faf7',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  headerBlock: {
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  viewport: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  viewfinderImg: {
    width: '100%',
    height: '100%',
  },
  viewfinderPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  placeholderBgImg: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 45, 13, 0.45)',
  },
  topControlsRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  glassCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassCircleBtnActive: {
    backgroundColor: '#f59e0b',
  },
  aimPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34d399',
  },
  aimText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  reticleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  reticleBox: {
    width: 220,
    height: 220,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#34d399',
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  targetCenterCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.6)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 96,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  hudCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  hudIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudDiseaseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  stagePill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  stagePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  hudPathogenText: {
    fontSize: 10,
    color: '#6ee7b7',
    fontWeight: '600',
    marginTop: 2,
  },
  hudRight: {
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  hudConfidenceVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#34d399',
  },
  hudConfidenceLabel: {
    fontSize: 8,
    color: '#cbd5e1',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomControlsBar: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    paddingHorizontal: 8,
  },
  controlPillBtn: {
    alignItems: 'center',
    gap: 4,
  },
  controlIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  shutterBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#34d399',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  shutterInnerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12,
    flex: 1,
  },
  adviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
    gap: 12,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  adviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adviceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  adviceSub: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  actionNeededPill: {
    backgroundColor: '#fef3c7',
    borderWidth: 0.8,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  actionNeededText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  quickAdviceBox: {
    backgroundColor: 'rgba(240, 253, 244, 0.8)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 0.8,
    borderColor: '#bbf7d0',
  },
  quickAdviceText: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 18,
  },
  quickAdviceBold: {
    fontWeight: '800',
    color: '#064e3b',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pesticidesBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  pesticidesBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  agronomistBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  agronomistBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  historyToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyToggleSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  productCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  productIng: {
    fontSize: 11,
    color: '#475569',
  },
  productDose: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
});
