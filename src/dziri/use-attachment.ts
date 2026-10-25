import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useMutation } from 'convex/react';
import { dziriApi } from './api';
import { uploadMedia, type LocalMedia, type UploadedMedia } from './media-upload';
export function useAttachment(imagesOnly = false) {
  const [attachment, setAttachment] = useState<LocalMedia | null>(null),
    [uploaded, setUploaded] = useState<UploadedMedia | null>(null),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const makeUrl = useMutation(dziriApi.uploadUrl);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY),
    state = useAudioRecorderState(recorder);
  const lock = useRef(false);
  const change = useCallback((media: LocalMedia | null) => {
    setAttachment(media);
    setUploaded(null);
    setFailed(false);
  }, []);
  const finishVoice = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      const duration = state.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (recorder.uri)
        change({
          uri: recorder.uri,
          type: 'voice',
          mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
          duration,
        });
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
    }
  }, [recorder, state.durationMillis, change]);
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= 120000) void finishVoice();
  }, [state.isRecording, state.durationMillis, finishVoice]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => {
      if (value !== 'active' && recorder.isRecording)
        void recorder
          .stop()
          .then(() => setAudioModeAsync({ allowsRecording: false }))
          .catch(() => {});
    });
    return () => listener.remove();
  }, [recorder]);
  async function choose() {
    setFailed(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: imagesOnly ? ['images'] : ['images', 'videos'],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        const file = result.assets[0];
        change({
          uri: file.uri,
          type: file.type === 'video' ? 'video' : 'image',
          mime: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          width: file.width,
          height: file.height,
          duration: file.duration ?? undefined,
        });
      }
    } catch {
      setFailed(true);
    }
  }
  async function startVoice() {
    if (lock.current || imagesOnly) return;
    lock.current = true;
    setFailed(false);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone unavailable');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
    }
  }
  async function upload() {
    if (!attachment) throw new Error('No attachment');
    if (uploaded?.uri === attachment.uri) return uploaded;
    setBusy(true);
    setFailed(false);
    try {
      const media = await uploadMedia(attachment, () => makeUrl({}));
      setUploaded(media);
      return media;
    } catch (error) {
      setFailed(true);
      throw error;
    } finally {
      setBusy(false);
    }
  }
  return {
    attachment,
    change,
    choose,
    startVoice,
    finishVoice,
    upload,
    busy,
    failed,
    recording: state.isRecording,
    seconds: Math.floor(state.durationMillis / 1000),
  };
}
